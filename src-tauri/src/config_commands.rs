// Recent-projects config persisted under %APPDATA%/RPGCreatorAI/config.json.

use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

#[derive(Default, Serialize, Deserialize)]
struct ShellConfig {
    #[serde(default)]
    recents: Vec<String>,
}

const MAX_RECENTS: usize = 8;

fn config_dir() -> Option<PathBuf> {
    // Prefer APPDATA on Windows, fall back to the home dir.
    if let Ok(appdata) = std::env::var("APPDATA") {
        return Some(PathBuf::from(appdata).join("RPGCreatorAI"));
    }
    if let Ok(home) = std::env::var("HOME") {
        return Some(PathBuf::from(home).join(".rpgcreatorai"));
    }
    None
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
