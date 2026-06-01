use std::path::PathBuf;

const APP_DIR_NAME: &str = "RPGCreatorAI";

pub fn app_data_root() -> Result<PathBuf, String> {
    if let Ok(appdata) = std::env::var("APPDATA") {
        return Ok(PathBuf::from(appdata).join(APP_DIR_NAME));
    }
    if let Ok(local) = std::env::var("LOCALAPPDATA") {
        return Ok(PathBuf::from(local).join(APP_DIR_NAME));
    }
    if let Ok(home) = std::env::var("HOME") {
        return Ok(PathBuf::from(home).join(".rpgcreatorai"));
    }
    Err("no app data directory available".to_string())
}

pub fn config_dir() -> Result<PathBuf, String> {
    app_data_root()
}

pub fn runtime_logs_dir() -> Result<PathBuf, String> {
    Ok(app_data_root()?.join("runtime-logs"))
}

pub fn playtest_sessions_dir() -> Result<PathBuf, String> {
    Ok(app_data_root()?.join("playtest-sessions"))
}

#[cfg(test)]
pub(crate) fn environment_lock() -> &'static std::sync::Mutex<()> {
    static LOCK: std::sync::OnceLock<std::sync::Mutex<()>> = std::sync::OnceLock::new();
    LOCK.get_or_init(|| std::sync::Mutex::new(()))
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
    fn app_data_root_prefers_roaming_appdata_for_user_state() {
        let _guard = environment_lock().lock().unwrap();
        let previous_appdata = std::env::var_os("APPDATA");
        let previous_local = std::env::var_os("LOCALAPPDATA");
        let previous_home = std::env::var_os("HOME");
        let appdata = tempfile::TempDir::new().unwrap();
        let local = tempfile::TempDir::new().unwrap();
        let home = tempfile::TempDir::new().unwrap();

        std::env::set_var("APPDATA", appdata.path());
        std::env::set_var("LOCALAPPDATA", local.path());
        std::env::set_var("HOME", home.path());

        let result = app_data_root().unwrap();

        restore_env(previous_appdata, previous_local, previous_home);
        assert_eq!(result, appdata.path().join(APP_DIR_NAME));
    }

    #[test]
    fn app_data_root_uses_local_appdata_before_home() {
        let _guard = environment_lock().lock().unwrap();
        let previous_appdata = std::env::var_os("APPDATA");
        let previous_local = std::env::var_os("LOCALAPPDATA");
        let previous_home = std::env::var_os("HOME");
        let local = tempfile::TempDir::new().unwrap();
        let home = tempfile::TempDir::new().unwrap();

        std::env::remove_var("APPDATA");
        std::env::set_var("LOCALAPPDATA", local.path());
        std::env::set_var("HOME", home.path());

        let result = app_data_root().unwrap();

        restore_env(previous_appdata, previous_local, previous_home);
        assert_eq!(result, local.path().join(APP_DIR_NAME));
    }

    #[test]
    fn derived_directories_stay_under_the_app_data_root() {
        let _guard = environment_lock().lock().unwrap();
        let previous_appdata = std::env::var_os("APPDATA");
        let previous_local = std::env::var_os("LOCALAPPDATA");
        let previous_home = std::env::var_os("HOME");
        let appdata = tempfile::TempDir::new().unwrap();

        std::env::set_var("APPDATA", appdata.path());
        std::env::remove_var("LOCALAPPDATA");
        std::env::remove_var("HOME");

        let root = appdata.path().join(APP_DIR_NAME);
        let config = config_dir().unwrap();
        let logs = runtime_logs_dir().unwrap();
        let sessions = playtest_sessions_dir().unwrap();

        restore_env(previous_appdata, previous_local, previous_home);
        assert_eq!(config, root);
        assert_eq!(logs, root.join("runtime-logs"));
        assert_eq!(sessions, root.join("playtest-sessions"));
    }
}
