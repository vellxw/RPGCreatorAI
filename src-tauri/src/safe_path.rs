// Path canonicalisation + sandbox checks for the FileSystemAdapter.

use std::path::{Path, PathBuf};

#[derive(thiserror::Error, Debug)]
pub enum SafePathError {
    #[error("path not found: {0}")]
    NotFound(String),
    #[error("path is outside the user's home directory")]
    OutsideUserSpace,
    #[error("path escapes the project root")]
    OutsideProjectRoot,
    #[error("io error: {0}")]
    Io(String),
}

fn user_home() -> Option<PathBuf> {
    std::env::var_os("USERPROFILE")
        .map(PathBuf::from)
        .or_else(|| std::env::var_os("HOME").map(PathBuf::from))
}

/// Canonicalise `input` and reject anything that resolves outside the user's
/// home directory. Symlink escape is handled by the canonicalize() call.
pub fn canonicalize_inside_user_space<P: AsRef<Path>>(input: P) -> Result<PathBuf, SafePathError> {
    let canonical = std::fs::canonicalize(input.as_ref())
        .map_err(|e| match e.kind() {
            std::io::ErrorKind::NotFound => SafePathError::NotFound(input.as_ref().display().to_string()),
            _ => SafePathError::Io(e.to_string()),
        })?;

    if let Some(home) = user_home() {
        let home_canonical = std::fs::canonicalize(&home).unwrap_or(home);
        if !canonical.starts_with(&home_canonical) {
            return Err(SafePathError::OutsideUserSpace);
        }
    }
    // If we cannot determine user_home we fail closed.
    if user_home().is_none() {
        return Err(SafePathError::OutsideUserSpace);
    }
    Ok(canonical)
}

/// Ensures `path` is a descendant (or equal to) `root`. Both must be canonical
/// already; passing non-canonical inputs is a programmer error.
pub fn ensure_inside(root: &Path, path: &Path) -> Result<(), SafePathError> {
    if path.starts_with(root) {
        Ok(())
    } else {
        Err(SafePathError::OutsideProjectRoot)
    }
}

/// Resolve `relative` against `root` and verify the result stays inside.
/// Used for files that may not exist yet (so we cannot canonicalize them).
pub fn join_inside(root: &Path, relative: &str) -> Result<PathBuf, SafePathError> {
    let joined = root.join(relative);
    // Walk components and reject any `..` that would lift above root.
    let mut depth: i32 = 0;
    for c in Path::new(relative).components() {
        match c {
            std::path::Component::ParentDir => {
                depth -= 1;
                if depth < 0 {
                    return Err(SafePathError::OutsideProjectRoot);
                }
            }
            std::path::Component::Normal(_) => depth += 1,
            std::path::Component::CurDir => {}
            _ => return Err(SafePathError::OutsideProjectRoot),
        }
    }
    Ok(joined)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn canonicalize_inside_user_space_accepts_user_path() {
        // USERPROFILE on the test runner is whatever the env says; we just need any
        // existing path under it. Use the cargo manifest dir as a stable choice.
        let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").unwrap();
        // Only run this assertion if the manifest is actually under USERPROFILE.
        if let Some(home) = user_home() {
            let home_can = std::fs::canonicalize(&home).unwrap_or(home);
            let manifest_can = std::fs::canonicalize(&manifest_dir).unwrap();
            if manifest_can.starts_with(&home_can) {
                let result = canonicalize_inside_user_space(&manifest_dir);
                assert!(result.is_ok(), "{:?}", result);
            }
        }
    }

    #[test]
    fn canonicalize_inside_user_space_rejects_system_path() {
        // %WINDIR% is reliably outside USERPROFILE on Windows; on Unix `/usr` works.
        #[cfg(windows)]
        let outside = std::env::var("WINDIR").unwrap_or_else(|_| r"C:\Windows".to_string());
        #[cfg(not(windows))]
        let outside = "/usr".to_string();

        if Path::new(&outside).exists() {
            let result = canonicalize_inside_user_space(&outside);
            match result {
                Err(SafePathError::OutsideUserSpace) => {}
                other => panic!("expected OutsideUserSpace, got {:?}", other),
            }
        }
    }

    #[test]
    fn ensure_inside_accepts_descendant() {
        let tmp = TempDir::new().unwrap();
        let root = tmp.path().canonicalize().unwrap();
        let child = root.join("a/b/c");
        std::fs::create_dir_all(&child).unwrap();
        let child_can = child.canonicalize().unwrap();
        assert!(ensure_inside(&root, &child_can).is_ok());
    }

    #[test]
    fn ensure_inside_rejects_sibling() {
        let tmp = TempDir::new().unwrap();
        let parent = tmp.path().canonicalize().unwrap();
        let root = parent.join("project");
        let sibling = parent.join("other");
        std::fs::create_dir_all(&root).unwrap();
        std::fs::create_dir_all(&sibling).unwrap();
        let root_can = root.canonicalize().unwrap();
        let sibling_can = sibling.canonicalize().unwrap();
        assert!(matches!(
            ensure_inside(&root_can, &sibling_can),
            Err(SafePathError::OutsideProjectRoot)
        ));
    }

    #[test]
    fn join_inside_rejects_dotdot_escape() {
        let tmp = TempDir::new().unwrap();
        let root = tmp.path().to_path_buf();
        assert!(matches!(
            join_inside(&root, "../escape.json"),
            Err(SafePathError::OutsideProjectRoot)
        ));
        assert!(matches!(
            join_inside(&root, "data/../../escape.json"),
            Err(SafePathError::OutsideProjectRoot)
        ));
    }

    #[test]
    fn join_inside_accepts_normal_relative() {
        let tmp = TempDir::new().unwrap();
        let root = tmp.path().to_path_buf();
        let path = join_inside(&root, "data/maps/town.json").unwrap();
        assert!(path.starts_with(&root));
        assert!(path.ends_with("town.json"));
    }
}
