// Shared in-memory state for the desktop shell: the active project root and
// the running runtime child process.

use std::path::PathBuf;
use std::sync::Mutex;

#[derive(Default)]
pub struct AppState {
    pub project_root: Mutex<Option<PathBuf>>,
    pub runtime_process: Mutex<Option<std::process::Child>>,
    pub latest_runtime_log: Mutex<Option<PathBuf>>,
    pub latest_runtime_snapshot: Mutex<Option<PathBuf>>,
}
