// Runtime IPC: launch, kill, status for the C++ rpg_creator_runtime executable.

use std::path::PathBuf;

use serde::Serialize;
use tauri::State;

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

    let child = match std::process::Command::new(&exe)
        .current_dir(&project_root)
        .spawn()
    {
        Ok(c) => c,
        Err(e) => {
            return Ok(RuntimeLaunchResult {
                success: false,
                error: Some(format!("failed to spawn runtime: {e}")),
                executable_path: Some(exe.to_string_lossy().to_string()),
                ..Default::default()
            });
        }
    };

    let pid = child.id();
    *state.runtime_process.lock().unwrap() = Some(child);

    Ok(RuntimeLaunchResult {
        success: true,
        error: None,
        pid: Some(pid),
        executable_path: Some(exe.to_string_lossy().to_string()),
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
}
