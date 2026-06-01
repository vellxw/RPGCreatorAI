// Recent-projects config persisted under the shared RPGCreatorAI app-data root.

use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use crate::app_paths;

#[derive(Default, Serialize, Deserialize)]
struct ShellConfig {
    #[serde(default)]
    recents: Vec<String>,
}

const MAX_RECENTS: usize = 8;

fn config_dir() -> Option<PathBuf> {
    app_paths::config_dir().ok()
}

fn config_path() -> Option<PathBuf> {
    config_dir().map(|d| d.join("config.json"))
}

fn load() -> ShellConfig {
    let Some(path) = config_path() else { return ShellConfig::default(); };
    let Ok(bytes) = fs::read(&path) else { return ShellConfig::default(); };
    serde_json::from_slice(&bytes).unwrap_or_default()
}

fn save(cfg: &ShellConfig) -> Result<(), String> {
    let Some(dir) = config_dir() else {
        return Err("no config dir available".to_string());
    };
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join("config.json");
    let body = serde_json::to_string_pretty(cfg).map_err(|e| e.to_string())?;
    fs::write(&path, body).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn config_get_recents() -> Vec<String> {
    load().recents
}

#[tauri::command]
pub fn config_add_recent(root: String) -> Result<Vec<String>, String> {
    let mut cfg = load();
    cfg.recents.retain(|r| r != &root);
    cfg.recents.insert(0, root);
    cfg.recents.truncate(MAX_RECENTS);
    save(&cfg)?;
    Ok(cfg.recents)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn config_dir_uses_local_appdata_before_home_when_appdata_is_missing() {
        let _guard = crate::app_paths::environment_lock().lock().unwrap();
        let previous_appdata = std::env::var_os("APPDATA");
        let previous_local = std::env::var_os("LOCALAPPDATA");
        let previous_home = std::env::var_os("HOME");
        let local = tempfile::TempDir::new().unwrap();
        let home = tempfile::TempDir::new().unwrap();

        std::env::remove_var("APPDATA");
        std::env::set_var("LOCALAPPDATA", local.path());
        std::env::set_var("HOME", home.path());

        let result = config_dir().unwrap();
        if let Some(value) = previous_appdata {
            std::env::set_var("APPDATA", value);
        } else {
            std::env::remove_var("APPDATA");
        }
        if let Some(value) = previous_local {
            std::env::set_var("LOCALAPPDATA", value);
        } else {
            std::env::remove_var("LOCALAPPDATA");
        }
        if let Some(value) = previous_home {
            std::env::set_var("HOME", value);
        } else {
            std::env::remove_var("HOME");
        }

        assert_eq!(result, local.path().join("RPGCreatorAI"));
    }
}
