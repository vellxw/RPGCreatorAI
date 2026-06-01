// RPGCreatorAI desktop shell — Phase 5
//
// Exposes a small, allowlisted IPC surface to the renderer:
//   fs.openProjectDialog / readProject / writeProject / listBackups / closeProject / createPlaytestSession
//   runtime.launch / kill / status / latestLog / readLogTail / readLatestSnapshot / openLogFolder
//   config.getRecents / addRecent
//   shell.info
//
// All filesystem work is sandboxed to the active project root. The runtime
// bridge spawns the C++ executable located via a documented search order.

mod app_paths;
mod config_commands;
mod fs_commands;
mod project_state;
mod runtime_commands;
mod safe_path;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(project_state::AppState::default())
        .invoke_handler(tauri::generate_handler![
            shell_info,
            fs_commands::fs_open_project_dialog,
            fs_commands::fs_read_project,
            fs_commands::fs_write_project,
            fs_commands::fs_list_backups,
            fs_commands::fs_close_project,
            fs_commands::fs_create_playtest_session,
            runtime_commands::runtime_launch,
            runtime_commands::runtime_kill,
            runtime_commands::runtime_status,
            runtime_commands::runtime_latest_log,
            runtime_commands::runtime_read_log_tail,
            runtime_commands::runtime_read_latest_snapshot,
            runtime_commands::runtime_open_log_folder,
            config_commands::config_get_recents,
            config_commands::config_add_recent,
        ])
        .setup(|app| {
            // No-op for now; window setup is declarative in tauri.conf.json.
            let _ = app.get_webview_window("main");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[derive(serde::Serialize)]
struct ShellInfo {
    name: &'static str,
    version: &'static str,
}

#[tauri::command]
fn shell_info() -> ShellInfo {
    ShellInfo {
        name: "tauri",
        version: env!("CARGO_PKG_VERSION"),
    }
}
