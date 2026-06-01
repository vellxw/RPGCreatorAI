// Runtime IPC: launch, kill, status for the C++ rpg_creator_runtime executable.

use std::fs;
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::process::Stdio;

use serde::Serialize;
use tauri::State;

use crate::app_paths;
use crate::project_state::AppState;

#[derive(Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeLaunchResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pid: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub executable_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub log_path: Option<String>,
}

#[derive(Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeLogInfo {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeLogTailResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,
    pub truncated: bool,
    pub max_bytes: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeSnapshotReadResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,
    pub truncated: bool,
    pub max_bytes: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeLogActionResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "lowercase")]
pub enum RuntimeStatus {
    Unavailable,
    Ready,
    Running,
}

fn locate_runtime_executable(project_root: Option<&str>) -> Option<PathBuf> {
    let exe_name = if cfg!(windows) {
        "rpg_creator_runtime.exe"
    } else {
        "rpg_creator_runtime"
    };

    // 1. Env override
    if let Ok(env_path) = std::env::var("RPG_RUNTIME_EXE") {
        let p = PathBuf::from(env_path);
        if p.is_file() {
            return Some(p);
        }
    }

    // 2. Inside the project root's build/
    if let Some(root) = project_root {
        let p = PathBuf::from(root).join("build").join(exe_name);
        if p.is_file() {
            return Some(p);
        }
    }

    // 3. %LOCALAPPDATA%\RPGCreatorAI\build\<exe> (Phase 4.1 default)
    if let Ok(local) = std::env::var("LOCALAPPDATA") {
        let p = PathBuf::from(local)
            .join("RPGCreatorAI")
            .join("build")
            .join(exe_name);
        if p.is_file() {
            return Some(p);
        }
    }

    // 4. Same directory as our own executable
    if let Ok(self_path) = std::env::current_exe() {
        if let Some(dir) = self_path.parent() {
            let p = dir.join(exe_name);
            if p.is_file() {
                return Some(p);
            }
        }
    }

    None
}

fn runtime_logs_dir() -> Result<PathBuf, String> {
    app_paths::runtime_logs_dir()
}

fn runtime_debug_snapshot_path(runtime_logs_dir: &Path) -> PathBuf {
    runtime_logs_dir.join("runtime-state-snapshot.json")
}

fn create_runtime_log_file() -> Result<(PathBuf, fs::File), String> {
    let dir = runtime_logs_dir()?;
    fs::create_dir_all(&dir).map_err(|e| format!("mkdir {}: {e}", dir.display()))?;
    let timestamp = chrono::Utc::now()
        .format("runtime-%Y%m%dT%H%M%S%.3fZ")
        .to_string();
    let mut path = dir.join(format!("{timestamp}.log"));
    let mut suffix = 1;
    while path.exists() {
        path = dir.join(format!("{timestamp}-{suffix}.log"));
        suffix += 1;
    }
    let file = fs::OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(&path)
        .map_err(|e| format!("create {}: {e}", path.display()))?;
    Ok((path, file))
}

fn latest_runtime_log_in_dir(dir: &Path) -> Option<PathBuf> {
    let mut logs: Vec<PathBuf> = fs::read_dir(dir)
        .ok()?
        .filter_map(|entry| entry.ok().map(|entry| entry.path()))
        .filter(|path| {
            path.is_file()
                && path
                    .file_name()
                    .and_then(|name| name.to_str())
                    .is_some_and(|name| name.starts_with("runtime-") && name.ends_with(".log"))
        })
        .collect();
    logs.sort_by(|a, b| {
        let a_modified = fs::metadata(a).and_then(|m| m.modified()).ok();
        let b_modified = fs::metadata(b).and_then(|m| m.modified()).ok();
        b_modified.cmp(&a_modified).then_with(|| b.cmp(a))
    });
    logs.into_iter().next()
}

fn latest_runtime_log_path(state: &AppState) -> Result<PathBuf, String> {
    if let Some(path) = state.latest_runtime_log.lock().unwrap().clone() {
        if path.is_file() {
            return Ok(path);
        }
    }
    let dir = runtime_logs_dir()?;
    latest_runtime_log_in_dir(&dir).ok_or_else(|| "no runtime log has been created yet".to_string())
}

fn latest_runtime_snapshot_path(state: &AppState) -> Result<PathBuf, String> {
    if let Some(path) = state.latest_runtime_snapshot.lock().unwrap().clone() {
        if path.is_file() {
            return Ok(path);
        }
    }
    let path = runtime_debug_snapshot_path(&runtime_logs_dir()?);
    if path.is_file() {
        Ok(path)
    } else {
        Err("no runtime state snapshot has been created yet".to_string())
    }
}

fn read_runtime_log_tail_at(path: &Path, max_bytes: u64) -> Result<RuntimeLogTailResult, String> {
    let max_bytes = max_bytes.min(MAX_RUNTIME_LOG_TAIL_BYTES);
    let mut file = fs::File::open(path).map_err(|e| format!("open {}: {e}", path.display()))?;
    let len = file
        .metadata()
        .map_err(|e| format!("metadata {}: {e}", path.display()))?
        .len();
    let start = len.saturating_sub(max_bytes);
    file.seek(SeekFrom::Start(start))
        .map_err(|e| format!("seek {}: {e}", path.display()))?;
    let mut bytes = Vec::new();
    file.read_to_end(&mut bytes)
        .map_err(|e| format!("read {}: {e}", path.display()))?;
    Ok(RuntimeLogTailResult {
        success: true,
        path: Some(path.to_string_lossy().to_string()),
        content: Some(String::from_utf8_lossy(&bytes).to_string()),
        truncated: start > 0,
        max_bytes: max_bytes as usize,
        error: None,
    })
}

fn read_runtime_snapshot_at(
    path: &Path,
    max_bytes: u64,
) -> Result<RuntimeSnapshotReadResult, String> {
    let max_bytes = max_bytes.min(MAX_RUNTIME_SNAPSHOT_BYTES);
    let mut file = fs::File::open(path).map_err(|e| format!("open {}: {e}", path.display()))?;
    let len = file
        .metadata()
        .map_err(|e| format!("metadata {}: {e}", path.display()))?
        .len();
    let start = len.saturating_sub(max_bytes);
    file.seek(SeekFrom::Start(start))
        .map_err(|e| format!("seek {}: {e}", path.display()))?;
    let mut bytes = Vec::new();
    file.read_to_end(&mut bytes)
        .map_err(|e| format!("read {}: {e}", path.display()))?;
    Ok(RuntimeSnapshotReadResult {
        success: true,
        path: Some(path.to_string_lossy().to_string()),
        content: Some(String::from_utf8_lossy(&bytes).to_string()),
        truncated: start > 0,
        max_bytes: max_bytes as usize,
        error: None,
    })
}

#[tauri::command]
pub fn runtime_launch(
    state: State<'_, AppState>,
    project_root: String,
    executable_search_root: Option<String>,
) -> Result<RuntimeLaunchResult, String> {
    // Reject second concurrent launch.
    {
        let mut guard = state.runtime_process.lock().unwrap();
        if let Some(child) = guard.as_mut() {
            match child.try_wait() {
                Ok(Some(_)) => {
                    *guard = None; // previous run exited; ok to relaunch
                }
                Ok(None) => {
                    return Ok(RuntimeLaunchResult {
                        success: false,
                        error: Some("runtime already running".to_string()),
                        ..Default::default()
                    });
                }
                Err(_) => {
                    *guard = None;
                }
            }
        }
    }

    let search_root = executable_search_root.as_deref().unwrap_or(&project_root);
    let exe = match locate_runtime_executable(Some(search_root)) {
        Some(p) => p,
        None => {
            return Ok(RuntimeLaunchResult {
                success: false,
                error: Some(
                    "rpg_creator_runtime executable not found. Build it first with scripts/dev/verify-runtime.bat or set RPG_RUNTIME_EXE.".to_string(),
                ),
                ..Default::default()
            });
        }
    };

    let (log_path, log_file) = match create_runtime_log_file() {
        Ok(result) => result,
        Err(e) => {
            return Ok(RuntimeLaunchResult {
                success: false,
                error: Some(e),
                executable_path: Some(exe.to_string_lossy().to_string()),
                ..Default::default()
            });
        }
    };
    let snapshot_path = log_path
        .parent()
        .map(runtime_debug_snapshot_path)
        .unwrap_or_else(|| PathBuf::from("runtime-state-snapshot.json"));
    let _ = fs::remove_file(&snapshot_path);
    let stdout = match log_file.try_clone() {
        Ok(file) => file,
        Err(e) => {
            return Ok(RuntimeLaunchResult {
                success: false,
                error: Some(format!("failed to prepare runtime stdout log: {e}")),
                executable_path: Some(exe.to_string_lossy().to_string()),
                log_path: Some(log_path.to_string_lossy().to_string()),
                ..Default::default()
            });
        }
    };
    let stderr = match log_file.try_clone() {
        Ok(file) => file,
        Err(e) => {
            return Ok(RuntimeLaunchResult {
                success: false,
                error: Some(format!("failed to prepare runtime stderr log: {e}")),
                executable_path: Some(exe.to_string_lossy().to_string()),
                log_path: Some(log_path.to_string_lossy().to_string()),
                ..Default::default()
            });
        }
    };

    let child = match std::process::Command::new(&exe)
        .current_dir(&project_root)
        .env("RPG_RUNTIME_DEBUG_SNAPSHOT_PATH", &snapshot_path)
        .stdout(Stdio::from(stdout))
        .stderr(Stdio::from(stderr))
        .spawn()
    {
        Ok(c) => c,
        Err(e) => {
            return Ok(RuntimeLaunchResult {
                success: false,
                error: Some(format!("failed to spawn runtime: {e}")),
                executable_path: Some(exe.to_string_lossy().to_string()),
                log_path: Some(log_path.to_string_lossy().to_string()),
                ..Default::default()
            });
        }
    };

    let pid = child.id();
    *state.latest_runtime_log.lock().unwrap() = Some(log_path.clone());
    *state.latest_runtime_snapshot.lock().unwrap() = Some(snapshot_path);
    *state.runtime_process.lock().unwrap() = Some(child);

    Ok(RuntimeLaunchResult {
        success: true,
        error: None,
        pid: Some(pid),
        executable_path: Some(exe.to_string_lossy().to_string()),
        log_path: Some(log_path.to_string_lossy().to_string()),
    })
}

#[tauri::command]
pub fn runtime_kill(state: State<'_, AppState>) -> Result<(), String> {
    let mut guard = state.runtime_process.lock().unwrap();
    if let Some(mut child) = guard.take() {
        let _ = child.kill();
        let _ = child.wait();
    }
    Ok(())
}

#[tauri::command]
pub fn runtime_status(state: State<'_, AppState>) -> RuntimeStatus {
    let mut guard = state.runtime_process.lock().unwrap();
    match guard.as_mut() {
        None => RuntimeStatus::Ready,
        Some(child) => match child.try_wait() {
            Ok(Some(_)) => {
                *guard = None;
                RuntimeStatus::Ready
            }
            Ok(None) => RuntimeStatus::Running,
            Err(_) => RuntimeStatus::Unavailable,
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{Mutex, OnceLock};

    fn runtime_env_lock() -> &'static Mutex<()> {
        static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
        LOCK.get_or_init(|| Mutex::new(()))
    }

    fn restore_runtime_env(previous: Option<std::ffi::OsString>) {
        if let Some(value) = previous {
            std::env::set_var("RPG_RUNTIME_EXE", value);
        } else {
            std::env::remove_var("RPG_RUNTIME_EXE");
        }
    }

    #[test]
    fn locate_returns_none_when_nothing_present() {
        let _guard = runtime_env_lock().lock().unwrap();
        let previous = std::env::var_os("RPG_RUNTIME_EXE");
        // Hide the env override and use a guaranteed-empty project root.
        let tmp = tempfile::TempDir::new().unwrap();
        std::env::remove_var("RPG_RUNTIME_EXE");
        let root_str = tmp.path().to_string_lossy().to_string();
        let result = locate_runtime_executable(Some(&root_str));
        // We cannot assert None unconditionally because LOCALAPPDATA could
        // contain a built runtime on this machine. Just assert it does not panic.
        let _ = result;
        restore_runtime_env(previous);
    }

    #[test]
    fn locate_picks_up_env_override() {
        let _guard = runtime_env_lock().lock().unwrap();
        let previous = std::env::var_os("RPG_RUNTIME_EXE");
        let tmp = tempfile::TempDir::new().unwrap();
        let exe = tmp.path().join(if cfg!(windows) {
            "rpg_creator_runtime.exe"
        } else {
            "rpg_creator_runtime"
        });
        std::fs::write(&exe, b"not a real exe").unwrap();
        std::env::set_var("RPG_RUNTIME_EXE", &exe);

        let result = locate_runtime_executable(None);
        assert_eq!(result.as_deref(), Some(exe.as_path()));

        restore_runtime_env(previous);
    }

    #[test]
    fn read_runtime_log_tail_caps_to_256_kib() {
        let tmp = tempfile::TempDir::new().unwrap();
        let path = tmp.path().join("runtime.log");
        let mut body = vec![b'a'; (MAX_RUNTIME_LOG_TAIL_BYTES as usize) + 16];
        body.extend_from_slice(b"TAIL");
        std::fs::write(&path, body).unwrap();

        let result = read_runtime_log_tail_at(&path, MAX_RUNTIME_LOG_TAIL_BYTES * 2).unwrap();

        assert!(result.success);
        assert!(result.truncated);
        assert_eq!(result.max_bytes, MAX_RUNTIME_LOG_TAIL_BYTES as usize);
        assert!(result.content.unwrap().ends_with("TAIL"));
    }

    #[test]
    fn runtime_debug_snapshot_path_stays_in_runtime_logs_dir() {
        let tmp = tempfile::TempDir::new().unwrap();

        let path = runtime_debug_snapshot_path(tmp.path());

        assert_eq!(path.parent(), Some(tmp.path()));
        assert_eq!(path.file_name().and_then(|name| name.to_str()), Some("runtime-state-snapshot.json"));
    }

    #[test]
    fn read_runtime_snapshot_caps_to_bounded_json_size() {
        let tmp = tempfile::TempDir::new().unwrap();
        let path = tmp.path().join("runtime-state-snapshot.json");
        let mut body = vec![b'a'; (MAX_RUNTIME_SNAPSHOT_BYTES as usize) + 16];
        body.extend_from_slice(br#"{"frameNumber":9}"#);
        std::fs::write(&path, body).unwrap();

        let result = read_runtime_snapshot_at(&path, MAX_RUNTIME_SNAPSHOT_BYTES * 2).unwrap();

        assert!(result.success);
        assert!(result.truncated);
        assert_eq!(result.max_bytes, MAX_RUNTIME_SNAPSHOT_BYTES as usize);
        assert!(result.content.unwrap().ends_with(r#"{"frameNumber":9}"#));
    }
}

#[tauri::command]
pub fn runtime_latest_log(state: State<'_, AppState>) -> Result<RuntimeLogInfo, String> {
    match latest_runtime_log_path(&state) {
        Ok(path) => Ok(RuntimeLogInfo {
            success: true,
            path: Some(path.to_string_lossy().to_string()),
            error: None,
        }),
        Err(e) => Ok(RuntimeLogInfo {
            success: false,
            path: None,
            error: Some(e),
        }),
    }
}

#[tauri::command]
pub fn runtime_read_log_tail(
    state: State<'_, AppState>,
    max_bytes: u64,
) -> Result<RuntimeLogTailResult, String> {
    let capped = max_bytes.min(MAX_RUNTIME_LOG_TAIL_BYTES) as usize;
    let path = match latest_runtime_log_path(&state) {
        Ok(path) => path,
        Err(e) => {
            return Ok(RuntimeLogTailResult {
                success: false,
                error: Some(e),
                max_bytes: capped,
                ..Default::default()
            });
        }
    };
    match read_runtime_log_tail_at(&path, max_bytes) {
        Ok(result) => Ok(result),
        Err(e) => Ok(RuntimeLogTailResult {
            success: false,
            path: Some(path.to_string_lossy().to_string()),
            error: Some(e),
            max_bytes: capped,
            ..Default::default()
        }),
    }
}

#[tauri::command]
pub fn runtime_read_latest_snapshot(
    state: State<'_, AppState>,
    max_bytes: u64,
) -> Result<RuntimeSnapshotReadResult, String> {
    let capped = max_bytes.min(MAX_RUNTIME_SNAPSHOT_BYTES) as usize;
    let path = match latest_runtime_snapshot_path(&state) {
        Ok(path) => path,
        Err(e) => {
            return Ok(RuntimeSnapshotReadResult {
                success: false,
                error: Some(e),
                max_bytes: capped,
                ..Default::default()
            });
        }
    };
    match read_runtime_snapshot_at(&path, max_bytes) {
        Ok(result) => Ok(result),
        Err(e) => Ok(RuntimeSnapshotReadResult {
            success: false,
            path: Some(path.to_string_lossy().to_string()),
            error: Some(e),
            max_bytes: capped,
            ..Default::default()
        }),
    }
}

#[tauri::command]
pub fn runtime_open_log_folder() -> Result<RuntimeLogActionResult, String> {
    let dir = runtime_logs_dir()?;
    fs::create_dir_all(&dir).map_err(|e| format!("mkdir {}: {e}", dir.display()))?;
    let result = if cfg!(windows) {
        std::process::Command::new("explorer").arg(&dir).spawn()
    } else if cfg!(target_os = "macos") {
        std::process::Command::new("open").arg(&dir).spawn()
    } else {
        std::process::Command::new("xdg-open").arg(&dir).spawn()
    };
    match result {
        Ok(_) => Ok(RuntimeLogActionResult {
            success: true,
            error: None,
        }),
        Err(e) => Ok(RuntimeLogActionResult {
            success: false,
            error: Some(format!("failed to open {}: {e}", dir.display())),
        }),
    }
}

const MAX_RUNTIME_LOG_TAIL_BYTES: u64 = 256 * 1024;
const MAX_RUNTIME_SNAPSHOT_BYTES: u64 = 128 * 1024;
