use std::fs;
use std::path::PathBuf;

use serde::Serialize;

use crate::app_paths;

const STORAGE_WINDOWS_DPAPI: &str = "windows-dpapi";
const STORAGE_UNAVAILABLE: &str = "unavailable";
const REDACTED: &str = "[REDACTED]";
const MAX_SECRET_BYTES: usize = 64 * 1024;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CredentialStatus {
    provider_id: String,
    configured: bool,
    storage: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CredentialWriteResult {
    success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    status: Option<CredentialStatus>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

fn redacted_error(message: impl Into<String>, known_secret: Option<&str>) -> String {
    redact_secrets(&message.into(), known_secret.into_iter().collect::<Vec<_>>().as_slice())
}

pub fn redact_secrets(input: &str, known_secrets: &[&str]) -> String {
    let mut out = input.to_string();
    for secret in known_secrets {
        if secret.len() >= 4 {
            out = out.replace(secret, REDACTED);
        }
    }
    out
}

fn validate_provider_id(input: &str) -> Result<String, String> {
    let id = input.trim().to_ascii_lowercase();
    if id.is_empty() || id.len() > 64 {
        return Err("Invalid provider id.".to_string());
    }
    if !id
        .bytes()
        .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-' || b == b'_' || b == b'.')
    {
        return Err("Invalid provider id.".to_string());
    }
    Ok(id)
}

fn credential_dir() -> Result<PathBuf, String> {
    Ok(app_paths::config_dir()?.join("provider-credentials"))
}

fn credential_path_for(provider_id: &str) -> Result<PathBuf, String> {
    let id = validate_provider_id(provider_id)?;
    Ok(credential_dir()?.join(format!("{id}.bin")))
}

fn storage_kind() -> &'static str {
    if cfg!(windows) {
        STORAGE_WINDOWS_DPAPI
    } else {
        STORAGE_UNAVAILABLE
    }
}

fn status_for(provider_id: &str) -> CredentialStatus {
    match credential_path_for(provider_id) {
        Ok(path) => CredentialStatus {
            provider_id: validate_provider_id(provider_id).unwrap_or_else(|_| provider_id.to_string()),
            configured: path.exists(),
            storage: storage_kind().to_string(),
            error: None,
        },
        Err(error) => CredentialStatus {
            provider_id: provider_id.to_string(),
            configured: false,
            storage: STORAGE_UNAVAILABLE.to_string(),
            error: Some(redacted_error(error, None)),
        },
    }
}

#[cfg(windows)]
fn protect_secret(secret: &str) -> Result<Vec<u8>, String> {
    use std::ffi::c_void;
    use std::ptr::{null, null_mut};

    use windows_sys::Win32::Foundation::LocalFree;
    use windows_sys::Win32::Security::Cryptography::{
        CryptProtectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB,
    };

    let bytes = secret.as_bytes();
    let input = CRYPT_INTEGER_BLOB {
        cbData: bytes.len() as u32,
        pbData: bytes.as_ptr() as *mut u8,
    };
    let mut output = CRYPT_INTEGER_BLOB {
        cbData: 0,
        pbData: null_mut(),
    };

    let ok = unsafe {
        CryptProtectData(
            &input,
            null(),
            null(),
            null_mut(),
            null(),
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut output,
        )
    };
    if ok == 0 {
        return Err("Credential storage failed.".to_string());
    }

    let protected = unsafe {
        std::slice::from_raw_parts(output.pbData, output.cbData as usize).to_vec()
    };
    unsafe {
        LocalFree(output.pbData as *mut c_void);
    }
    Ok(protected)
}

#[cfg(all(windows, test))]
fn unprotect_secret(blob: &[u8]) -> Result<String, String> {
    use std::ffi::c_void;
    use std::ptr::{null, null_mut};

    use windows_sys::Win32::Foundation::LocalFree;
    use windows_sys::Win32::Security::Cryptography::{
        CryptUnprotectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB,
    };

    let input = CRYPT_INTEGER_BLOB {
        cbData: blob.len() as u32,
        pbData: blob.as_ptr() as *mut u8,
    };
    let mut output = CRYPT_INTEGER_BLOB {
        cbData: 0,
        pbData: null_mut(),
    };

    let ok = unsafe {
        CryptUnprotectData(
            &input,
            null_mut(),
            null(),
            null_mut(),
            null(),
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut output,
        )
    };
    if ok == 0 {
        return Err("Credential read failed.".to_string());
    }

    let bytes = unsafe {
        std::slice::from_raw_parts(output.pbData, output.cbData as usize).to_vec()
    };
    unsafe {
        LocalFree(output.pbData as *mut c_void);
    }
    String::from_utf8(bytes).map_err(|_| "Credential data was not valid UTF-8.".to_string())
}

#[cfg(not(windows))]
fn protect_secret(_secret: &str) -> Result<Vec<u8>, String> {
    Err("Credential storage is only implemented for Windows v1.".to_string())
}

#[tauri::command]
pub fn credentials_get_status(provider_id: String) -> CredentialStatus {
    status_for(&provider_id)
}

#[tauri::command]
pub fn credentials_list() -> Vec<CredentialStatus> {
    let Ok(dir) = credential_dir() else {
        return Vec::new();
    };
    let Ok(entries) = fs::read_dir(dir) else {
        return Vec::new();
    };

    entries
        .filter_map(Result::ok)
        .filter_map(|entry| entry.path().file_stem().and_then(|stem| stem.to_str()).map(str::to_string))
        .filter_map(|provider_id| validate_provider_id(&provider_id).ok())
        .map(|provider_id| status_for(&provider_id))
        .collect()
}

#[tauri::command]
pub fn credentials_set(provider_id: String, secret: String) -> CredentialWriteResult {
    let provider_id = match validate_provider_id(&provider_id) {
        Ok(id) => id,
        Err(error) => {
            return CredentialWriteResult {
                success: false,
                status: None,
                error: Some(redacted_error(error, Some(&secret))),
            };
        }
    };

    if secret.trim().is_empty() {
        return CredentialWriteResult {
            success: false,
            status: None,
            error: Some("Credential value is required.".to_string()),
        };
    }
    if secret.len() > MAX_SECRET_BYTES {
        return CredentialWriteResult {
            success: false,
            status: None,
            error: Some("Credential value is too large.".to_string()),
        };
    }

    let protected = match protect_secret(&secret) {
        Ok(value) => value,
        Err(error) => {
            return CredentialWriteResult {
                success: false,
                status: None,
                error: Some(redacted_error(error, Some(&secret))),
            };
        }
    };

    let path = match credential_path_for(&provider_id) {
        Ok(path) => path,
        Err(error) => {
            return CredentialWriteResult {
                success: false,
                status: None,
                error: Some(redacted_error(error, Some(&secret))),
            };
        }
    };
    if let Some(parent) = path.parent() {
        if let Err(error) = fs::create_dir_all(parent) {
            return CredentialWriteResult {
                success: false,
                status: None,
                error: Some(redacted_error(error.to_string(), Some(&secret))),
            };
        }
    }
    if let Err(error) = fs::write(&path, protected) {
        return CredentialWriteResult {
            success: false,
            status: None,
            error: Some(redacted_error(error.to_string(), Some(&secret))),
        };
    }

    CredentialWriteResult {
        success: true,
        status: Some(status_for(&provider_id)),
        error: None,
    }
}

#[tauri::command]
pub fn credentials_delete(provider_id: String) -> CredentialStatus {
    let Ok(path) = credential_path_for(&provider_id) else {
        return status_for(&provider_id);
    };
    if path.exists() {
        let _ = fs::remove_file(&path);
    }
    status_for(&provider_id)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn restore_env(
        appdata: Option<std::ffi::OsString>,
        local: Option<std::ffi::OsString>,
        home: Option<std::ffi::OsString>,
    ) {
        if let Some(value) = appdata {
            std::env::set_var("APPDATA", value);
        } else {
            std::env::remove_var("APPDATA");
        }
        if let Some(value) = local {
            std::env::set_var("LOCALAPPDATA", value);
        } else {
            std::env::remove_var("LOCALAPPDATA");
        }
        if let Some(value) = home {
            std::env::set_var("HOME", value);
        } else {
            std::env::remove_var("HOME");
        }
    }

    #[test]
    fn rejects_provider_ids_that_escape_the_credentials_directory() {
        assert!(validate_provider_id("../openai").is_err());
        assert!(validate_provider_id("openai/key").is_err());
        assert!(validate_provider_id("").is_err());
        assert_eq!(validate_provider_id("OpenAI").unwrap(), "openai");
    }

    #[test]
    fn redaction_removes_known_secret_values_from_errors() {
        let secret = "fixture-provider-token-value";
        let redacted = redact_secrets(&format!("failed to store {secret}"), &[secret]);
        assert!(!redacted.contains(secret));
        assert!(redacted.contains(REDACTED));
    }

    #[cfg(windows)]
    #[test]
    fn stores_windows_dpapi_blob_under_appdata_without_returning_plaintext() {
        let _guard = crate::app_paths::environment_lock().lock().unwrap();
        let previous_appdata = std::env::var_os("APPDATA");
        let previous_local = std::env::var_os("LOCALAPPDATA");
        let previous_home = std::env::var_os("HOME");
        let appdata = tempfile::TempDir::new().unwrap();

        std::env::set_var("APPDATA", appdata.path());
        std::env::remove_var("LOCALAPPDATA");
        std::env::remove_var("HOME");

        let secret = "fixture-provider-token-value";
        let result = credentials_set("openai".to_string(), secret.to_string());
        assert!(result.success, "{result:?}");
        let result_json = serde_json::to_string(&result).unwrap();
        assert!(!result_json.contains(secret));

        let path = credential_path_for("openai").unwrap();
        assert_eq!(
            path,
            appdata.path()
                .join("RPGCreatorAI")
                .join("provider-credentials")
                .join("openai.bin")
        );
        let bytes = fs::read(&path).unwrap();
        assert!(!String::from_utf8_lossy(&bytes).contains(secret));
        assert_eq!(unprotect_secret(&bytes).unwrap(), secret);

        let deleted = credentials_delete("openai".to_string());
        assert!(!deleted.configured);
        assert!(!path.exists());

        restore_env(previous_appdata, previous_local, previous_home);
    }
}
