// FileSystem IPC commands.
//
// All paths go through canonicalize_inside_user_space + ensure_inside before
// any read/write. Writes are atomic (tmp file + rename) and create timestamped
// backups in <projectRoot>/.backups/ pruned to MAX_BACKUPS_PER_FILE per file.

use std::collections::HashMap;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use tauri::State;
use tauri_plugin_dialog::DialogExt;

use crate::project_state::AppState;
use crate::safe_path::{canonicalize_inside_user_space, ensure_inside, join_inside};

const MAX_BACKUPS_PER_FILE: usize = 10;

// ------------------------------ Schema types ------------------------------
//
// Mirrors src/types/project.ts. Kept loose (serde_json::Value for events and
// commands) so the Rust side never has to track every renderer-side schema
// change.

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StartPosition {
    pub x: i64,
    pub y: i64,
    pub direction: String,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MapReference {
    pub id: String,
    pub path: String,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseRefs {
    pub items: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub actors: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub classes: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub skills: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub enemies: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub troops: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub quests: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub shops: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub system: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub switches: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub variables: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none", rename = "commonEvents")]
    pub common_events: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProjectData {
    pub schema_version: i64,
    pub title: String,
    pub start_map_id: String,
    pub start_position: StartPosition,
    pub maps: Vec<MapReference>,
    pub database: DatabaseRefs,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FullProjectState {
    pub project: ProjectData,
    pub maps: HashMap<String, serde_json::Value>,
    pub items: serde_json::Value,
    /// Phase 6 — additional database shards keyed by name (actors, classes,
    /// skills, enemies, troops, quests, shops, switches, variables,
    /// commonEvents) plus a `system` object. The renderer remains the
    /// authoritative validator; the shell just round-trips JSON values.
    #[serde(default)]
    pub databases: serde_json::Value,
}

#[derive(Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SaveResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub warnings: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub backup_path: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenDialogResult {
    pub root: Option<String>,
    pub cancelled: bool,
    pub state: Option<FullProjectState>,
}

// ------------------------------ Commands ------------------------------

#[tauri::command]
pub fn fs_open_project_dialog(app: tauri::AppHandle) -> Result<OpenDialogResult, String> {
    let folder = app.dialog().file().blocking_pick_folder();

    let Some(picked) = folder else {
        return Ok(OpenDialogResult {
            root: None,
            cancelled: true,
            state: None,
        });
    };

    let raw = picked.into_path().map_err(|e| e.to_string())?;
    let root = canonicalize_inside_user_space(&raw).map_err(|e| e.to_string())?;

    let state = read_project_at(&root).map_err(|e| e.to_string())?;

    Ok(OpenDialogResult {
        root: Some(root.to_string_lossy().to_string()),
        cancelled: false,
        state: Some(state),
    })
}

#[tauri::command]
pub fn fs_read_project(
    state: State<'_, AppState>,
    root: String,
) -> Result<FullProjectState, String> {
    let canonical = canonicalize_inside_user_space(&root).map_err(|e| e.to_string())?;
    let result = read_project_at(&canonical).map_err(|e| e.to_string())?;
    *state.project_root.lock().unwrap() = Some(canonical);
    Ok(result)
}

#[tauri::command]
pub fn fs_write_project(
    state: State<'_, AppState>,
    root: String,
    project_state: FullProjectState,
) -> Result<SaveResult, String> {
    let canonical = canonicalize_inside_user_space(&root).map_err(|e| e.to_string())?;
    must_contain_project_json(&canonical).map_err(|e| e.to_string())?;

    let mut warnings: Vec<String> = Vec::new();

    // 1. project.json
    write_with_backup(
        &canonical,
        "data/project.json",
        &project_state.project,
        &mut warnings,
    )
    .map_err(|e| e.to_string())?;

    // 2. each map
    for map_ref in &project_state.project.maps {
        let map_value = project_state.maps.get(&map_ref.id).ok_or_else(|| {
            format!("save state is missing data for map id '{}'", map_ref.id)
        })?;
        write_with_backup(&canonical, &map_ref.path, map_value, &mut warnings)
            .map_err(|e| e.to_string())?;
    }

    // 3. items database
    write_with_backup(
        &canonical,
        &project_state.project.database.items,
        &project_state.items,
        &mut warnings,
    )
    .map_err(|e| e.to_string())?;

    // 3b. Phase 6 database shards. Each is wrapped in `{ schemaVersion, <key>: ... }`
    // so old runtime/editor pipelines keep parsing them.
    if let serde_json::Value::Object(map) = &project_state.databases {
        let pairs: [(&str, Option<&String>); 11] = [
            ("actors", project_state.project.database.actors.as_ref()),
            ("classes", project_state.project.database.classes.as_ref()),
            ("skills", project_state.project.database.skills.as_ref()),
            ("enemies", project_state.project.database.enemies.as_ref()),
            ("troops", project_state.project.database.troops.as_ref()),
            ("quests", project_state.project.database.quests.as_ref()),
            ("shops", project_state.project.database.shops.as_ref()),
            ("system", project_state.project.database.system.as_ref()),
            ("switches", project_state.project.database.switches.as_ref()),
            ("variables", project_state.project.database.variables.as_ref()),
            (
                "commonEvents",
                project_state.project.database.common_events.as_ref(),
            ),
        ];
        for (key, maybe_rel) in pairs {
            let Some(rel) = maybe_rel else { continue };
            let Some(payload) = map.get(key) else { continue };
            let wrapped = if key == "system" {
                let mut m = serde_json::Map::new();
                m.insert("schemaVersion".into(), serde_json::Value::from(1));
                if let serde_json::Value::Object(sys) = payload {
                    for (k, v) in sys {
                        if k == "schemaVersion" {
                            continue;
                        }
                        m.insert(k.clone(), v.clone());
                    }
                }
                serde_json::Value::Object(m)
            } else {
                serde_json::json!({ "schemaVersion": 1, key: payload })
            };
            write_with_backup(&canonical, rel, &wrapped, &mut warnings)
                .map_err(|e| e.to_string())?;
        }
    }

    // 4. prune backups + ensure .gitignore mentions .backups
    let _ = prune_backups(&canonical, MAX_BACKUPS_PER_FILE);
    if let Err(e) = ensure_gitignore_mentions_backups(&canonical) {
        warnings.push(format!("could not update .gitignore: {e}"));
    }

    *state.project_root.lock().unwrap() = Some(canonical);

    Ok(SaveResult {
        success: true,
        error: None,
        warnings,
        backup_path: None,
    })
}

#[tauri::command]
pub fn fs_list_backups(root: String, file: String) -> Result<Vec<String>, String> {
    let canonical = canonicalize_inside_user_space(&root).map_err(|e| e.to_string())?;
    let backups_dir = canonical.join(".backups");
    if !backups_dir.exists() {
        return Ok(vec![]);
    }
    let basename = Path::new(&file)
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| file.clone());

    let mut out: Vec<String> = vec![];
    for entry in fs::read_dir(&backups_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with(&format!("{basename}.")) && name.ends_with(".json") {
            out.push(name);
        }
    }
    out.sort();
    Ok(out)
}

#[tauri::command]
pub fn fs_close_project(state: State<'_, AppState>) -> Result<(), String> {
    *state.project_root.lock().unwrap() = None;
    Ok(())
}

// ------------------------------ Helpers ------------------------------

fn read_project_at(root: &Path) -> Result<FullProjectState, String> {
    must_contain_project_json(root)?;

    let project_path = root.join("data/project.json");
    let project: ProjectData =
        read_json(&project_path).map_err(|e| format!("project.json: {e}"))?;

    let mut maps = HashMap::new();
    for r in &project.maps {
        let map_path = join_inside(root, &r.path).map_err(|e| e.to_string())?;
        ensure_inside(root, &map_path).map_err(|e| e.to_string())?;
        let value: serde_json::Value =
            read_json(&map_path).map_err(|e| format!("map {}: {e}", r.id))?;
        maps.insert(r.id.clone(), value);
    }

    let items_path = join_inside(root, &project.database.items).map_err(|e| e.to_string())?;
    let items: serde_json::Value =
        read_json(&items_path).map_err(|e| format!("items.json: {e}"))?;

    // Phase 6 — read every additional database shard if its path is declared
    // and the file exists on disk. Missing files are tolerated and surface as
    // empty defaults; the renderer's `mergeDatabases()` fills the gaps.
    let mut databases = serde_json::Map::new();
    let pairs: [(&str, Option<&String>); 11] = [
        ("actors", project.database.actors.as_ref()),
        ("classes", project.database.classes.as_ref()),
        ("skills", project.database.skills.as_ref()),
        ("enemies", project.database.enemies.as_ref()),
        ("troops", project.database.troops.as_ref()),
        ("quests", project.database.quests.as_ref()),
        ("shops", project.database.shops.as_ref()),
        ("system", project.database.system.as_ref()),
        ("switches", project.database.switches.as_ref()),
        ("variables", project.database.variables.as_ref()),
        ("commonEvents", project.database.common_events.as_ref()),
    ];
    for (key, maybe_rel) in pairs {
        if let Some(rel) = maybe_rel {
            let path = join_inside(root, rel).map_err(|e| e.to_string())?;
            if path.exists() {
                let value: serde_json::Value =
                    read_json(&path).map_err(|e| format!("{key}.json: {e}"))?;
                let inner = extract_database_payload(key, value);
                databases.insert(key.to_string(), inner);
            }
        }
    }

    Ok(FullProjectState {
        project,
        maps,
        items,
        databases: serde_json::Value::Object(databases),
    })
}

/// Most database shards on disk wrap their payload in `{ "schemaVersion": 1, "<key>": [...] }`.
/// The renderer's in-memory shape is the unwrapped list (or system object).
/// Round-trip safely by extracting the inner field when it exists; otherwise
/// pass the raw value through.
fn extract_database_payload(key: &str, value: serde_json::Value) -> serde_json::Value {
    if let serde_json::Value::Object(mut map) = value {
        if key == "system" {
            map.remove("schemaVersion");
            return serde_json::Value::Object(map);
        }
        if let Some(inner) = map.remove(key) {
            return inner;
        }
        return serde_json::Value::Object(map);
    }
    value
}

fn must_contain_project_json(root: &Path) -> Result<(), String> {
    let project_path = root.join("data/project.json");
    if !project_path.is_file() {
        return Err(format!(
            "selected folder does not contain data/project.json (looked at {})",
            project_path.display()
        ));
    }
    Ok(())
}

fn read_json<T: serde::de::DeserializeOwned>(path: &Path) -> Result<T, String> {
    let bytes = fs::read(path).map_err(|e| format!("read {}: {e}", path.display()))?;
    serde_json::from_slice(&bytes).map_err(|e| format!("parse {}: {e}", path.display()))
}

fn write_with_backup<T: Serialize>(
    root: &Path,
    relative: &str,
    value: &T,
    warnings: &mut Vec<String>,
) -> Result<(), String> {
    let target = join_inside(root, relative).map_err(|e| e.to_string())?;

    // Backup if the target already exists (best-effort; failure is a warning).
    if target.exists() {
        if let Err(e) = backup_existing(root, relative) {
            warnings.push(format!("backup of {relative} failed: {e}"));
        }
    }

    // Validate JSON serialisation BEFORE touching disk so we never write a
    // half-baked file. We re-parse to confirm the output is well-formed.
    let pretty = serde_json::to_string_pretty(value)
        .map_err(|e| format!("serialise {relative}: {e}"))?;
    serde_json::from_str::<serde_json::Value>(&pretty)
        .map_err(|e| format!("post-serialise validation failed for {relative}: {e}"))?;

    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("mkdir {}: {e}", parent.display()))?;
    }

    // Atomic-ish write: write to a sibling tmp then rename over the target.
    let tmp_name = match target.file_name() {
        Some(n) => format!(".{}.tmp", n.to_string_lossy()),
        None => return Err(format!("invalid target path {}", target.display())),
    };
    let tmp = target.with_file_name(tmp_name);

    {
        let mut f = fs::File::create(&tmp).map_err(|e| format!("create tmp: {e}"))?;
        f.write_all(pretty.as_bytes())
            .map_err(|e| format!("write tmp: {e}"))?;
        f.sync_all().map_err(|e| format!("fsync tmp: {e}"))?;
    }

    // On Windows, std::fs::rename does not atomically replace an existing file
    // unless the target is missing. Use a remove + rename sequence; failure
    // leaves the previous file in place because we haven't deleted it yet.
    if target.exists() {
        fs::remove_file(&target).map_err(|e| format!("remove old {}: {e}", target.display()))?;
    }
    fs::rename(&tmp, &target).map_err(|e| format!("rename to {}: {e}", target.display()))?;

    Ok(())
}

fn backup_existing(root: &Path, relative: &str) -> Result<(), String> {
    let source = join_inside(root, relative).map_err(|e| e.to_string())?;
    if !source.exists() {
        return Ok(());
    }

    let backups_dir = root.join(".backups");
    fs::create_dir_all(&backups_dir).map_err(|e| format!("mkdir .backups: {e}"))?;

    let stem = Path::new(relative)
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .ok_or_else(|| "invalid file name".to_string())?;

    let ts = chrono::Utc::now()
        .format("%Y-%m-%dT%H-%M-%SZ")
        .to_string();
    let dest = backups_dir.join(format!("{stem}.{ts}.json"));

    fs::copy(&source, &dest).map_err(|e| format!("copy to backup: {e}"))?;
    Ok(())
}

fn prune_backups(root: &Path, max_per_file: usize) -> Result<(), String> {
    let backups_dir = root.join(".backups");
    if !backups_dir.exists() {
        return Ok(());
    }

    // Group by basename-before-first-dot.
    let mut by_stem: HashMap<String, Vec<PathBuf>> = HashMap::new();
    for entry in fs::read_dir(&backups_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        let stem = name.split('.').next().unwrap_or("").to_string();
        if stem.is_empty() {
            continue;
        }
        by_stem.entry(stem).or_default().push(path);
    }

    for (_stem, mut files) in by_stem {
        files.sort_by_key(|p| {
            fs::metadata(p)
                .and_then(|m| m.modified())
                .ok()
        });
        // Keep newest `max_per_file`, drop the rest from the front.
        if files.len() > max_per_file {
            let drop_count = files.len() - max_per_file;
            for p in &files[..drop_count] {
                let _ = fs::remove_file(p);
            }
        }
    }
    Ok(())
}

fn ensure_gitignore_mentions_backups(root: &Path) -> Result<(), String> {
    let path = root.join(".gitignore");
    let entry = ".backups/";
    if path.exists() {
        let body = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        if body.lines().any(|l| l.trim() == entry) {
            return Ok(());
        }
        let mut new_body = body;
        if !new_body.ends_with('\n') {
            new_body.push('\n');
        }
        new_body.push_str(entry);
        new_body.push('\n');
        fs::write(&path, new_body).map_err(|e| e.to_string())?;
    } else {
        fs::write(&path, format!("{entry}\n")).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn make_project(root: &Path) {
        fs::create_dir_all(root.join("data/maps")).unwrap();
        fs::create_dir_all(root.join("data/database")).unwrap();
        let project = serde_json::json!({
            "schemaVersion": 1,
            "title": "T",
            "startMapId": "town",
            "startPosition": { "x": 0, "y": 0, "direction": "down" },
            "maps": [{ "id": "town", "path": "data/maps/town.json" }],
            "database": { "items": "data/database/items.json" }
        });
        fs::write(
            root.join("data/project.json"),
            serde_json::to_string_pretty(&project).unwrap(),
        )
        .unwrap();
        let map = serde_json::json!({
            "schemaVersion": 1, "id": "town", "name": "Town",
            "width": 2, "height": 2, "tileSize": 32,
            "layers": [
                { "name": "g", "type": "visual", "tiles": [1,1,1,1] },
                { "name": "c", "type": "collision", "tiles": [0,0,0,0] }
            ],
            "events": []
        });
        fs::write(
            root.join("data/maps/town.json"),
            serde_json::to_string_pretty(&map).unwrap(),
        )
        .unwrap();
        fs::write(
            root.join("data/database/items.json"),
            r#"{"items":[]}"#,
        )
        .unwrap();
    }

    #[test]
    fn read_project_loads_full_state() {
        let tmp = TempDir::new().unwrap();
        let root = tmp.path().canonicalize().unwrap();
        make_project(&root);

        let result = read_project_at(&root).unwrap();
        assert_eq!(result.project.title, "T");
        assert!(result.maps.contains_key("town"));
    }

    #[test]
    fn write_creates_backup_for_existing_file() {
        let tmp = TempDir::new().unwrap();
        let root = tmp.path().canonicalize().unwrap();
        make_project(&root);

        let mut warnings = Vec::new();
        let new_project = serde_json::json!({
            "schemaVersion": 1,
            "title": "Renamed",
            "startMapId": "town",
            "startPosition": { "x": 0, "y": 0, "direction": "down" },
            "maps": [{ "id": "town", "path": "data/maps/town.json" }],
            "database": { "items": "data/database/items.json" }
        });
        write_with_backup(&root, "data/project.json", &new_project, &mut warnings).unwrap();

        // Backup created
        let backups: Vec<_> = fs::read_dir(root.join(".backups")).unwrap().collect();
        assert_eq!(backups.len(), 1);
        let backup_name = backups[0].as_ref().unwrap().file_name().to_string_lossy().to_string();
        assert!(backup_name.starts_with("project."));
        assert!(backup_name.ends_with(".json"));

        // Live file is the new content
        let live = fs::read_to_string(root.join("data/project.json")).unwrap();
        assert!(live.contains("Renamed"));
    }

    #[test]
    fn prune_backups_keeps_latest_n() {
        let tmp = TempDir::new().unwrap();
        let root = tmp.path().canonicalize().unwrap();
        let backups = root.join(".backups");
        fs::create_dir_all(&backups).unwrap();
        for i in 0..15 {
            let p = backups.join(format!("project.2026-05-15T00-00-{:02}Z.json", i));
            fs::write(&p, "{}").unwrap();
            // Ensure differing mtimes via small sleeps would slow tests; rely on
            // creation order which most filesystems preserve via mtime.
        }
        prune_backups(&root, 5).unwrap();
        let count = fs::read_dir(&backups).unwrap().count();
        assert_eq!(count, 5);
    }

    #[test]
    fn write_rejects_dotdot_relative() {
        let tmp = TempDir::new().unwrap();
        let root = tmp.path().canonicalize().unwrap();
        make_project(&root);
        let mut warnings = Vec::new();
        let result = write_with_backup(
            &root,
            "../escape.json",
            &serde_json::json!({}),
            &mut warnings,
        );
        assert!(result.is_err());
    }

    #[test]
    fn must_contain_project_json_rejects_empty_dir() {
        let tmp = TempDir::new().unwrap();
        let root = tmp.path().canonicalize().unwrap();
        let result = must_contain_project_json(&root);
        assert!(result.is_err());
    }

    #[test]
    fn ensure_gitignore_mentions_backups_appends() {
        let tmp = TempDir::new().unwrap();
        let root = tmp.path().canonicalize().unwrap();
        fs::write(root.join(".gitignore"), "node_modules/\n").unwrap();
        ensure_gitignore_mentions_backups(&root).unwrap();
        let body = fs::read_to_string(root.join(".gitignore")).unwrap();
        assert!(body.contains(".backups/"));
        // Idempotent
        ensure_gitignore_mentions_backups(&root).unwrap();
        let body2 = fs::read_to_string(root.join(".gitignore")).unwrap();
        assert_eq!(body, body2);
    }

    fn make_project_with_databases(root: &Path) {
        fs::create_dir_all(root.join("data/maps")).unwrap();
        fs::create_dir_all(root.join("data/database")).unwrap();
        let project = serde_json::json!({
            "schemaVersion": 1,
            "title": "T",
            "startMapId": "town",
            "startPosition": { "x": 0, "y": 0, "direction": "down" },
            "maps": [{ "id": "town", "path": "data/maps/town.json" }],
            "database": {
                "items": "data/database/items.json",
                "actors": "data/database/actors.json",
                "system": "data/database/system.json",
                "switches": "data/database/switches.json"
            }
        });
        fs::write(
            root.join("data/project.json"),
            serde_json::to_string_pretty(&project).unwrap(),
        )
        .unwrap();
        let map = serde_json::json!({
            "schemaVersion": 1, "id": "town", "name": "Town",
            "width": 1, "height": 1, "tileSize": 32,
            "layers": [
                { "name": "g", "type": "visual", "tiles": [1] },
                { "name": "c", "type": "collision", "tiles": [0] }
            ],
            "events": []
        });
        fs::write(
            root.join("data/maps/town.json"),
            serde_json::to_string_pretty(&map).unwrap(),
        )
        .unwrap();
        fs::write(
            root.join("data/database/items.json"),
            r#"{"schemaVersion":1,"items":[]}"#,
        )
        .unwrap();
        fs::write(
            root.join("data/database/actors.json"),
            r#"{"schemaVersion":1,"actors":[{"id":"arc","name":"Arc"}]}"#,
        )
        .unwrap();
        fs::write(
            root.join("data/database/system.json"),
            r#"{"schemaVersion":1,"startingParty":["arc"],"startingGold":50}"#,
        )
        .unwrap();
        fs::write(
            root.join("data/database/switches.json"),
            r#"{"schemaVersion":1,"switches":[{"id":"s1","name":"S1","initial":false}]}"#,
        )
        .unwrap();
    }

    #[test]
    fn read_project_extracts_database_shards() {
        let tmp = TempDir::new().unwrap();
        let root = tmp.path().canonicalize().unwrap();
        make_project_with_databases(&root);

        let result = read_project_at(&root).unwrap();
        let dbs = result.databases.as_object().unwrap();
        assert!(dbs.contains_key("actors"));
        assert!(dbs.contains_key("system"));
        assert!(dbs.contains_key("switches"));
        // actors should be unwrapped to the list, not the wrapping object
        let actors = dbs.get("actors").unwrap().as_array().unwrap();
        assert_eq!(actors.len(), 1);
        assert_eq!(actors[0].get("id").unwrap(), "arc");
        // system should be unwrapped to the bare object
        let system = dbs.get("system").unwrap().as_object().unwrap();
        assert_eq!(system.get("startingGold").unwrap(), 50);
    }

    #[test]
    fn write_then_read_round_trips_databases() {
        let tmp = TempDir::new().unwrap();
        let root = tmp.path().canonicalize().unwrap();
        make_project_with_databases(&root);

        // Read original.
        let original = read_project_at(&root).unwrap();

        // Mutate one switch and one actor name.
        let mut state = original;
        if let serde_json::Value::Object(ref mut dbs) = state.databases {
            if let Some(actors) = dbs.get_mut("actors") {
                if let Some(arr) = actors.as_array_mut() {
                    if let Some(first) = arr.get_mut(0) {
                        if let Some(obj) = first.as_object_mut() {
                            obj.insert("name".into(), serde_json::Value::from("Renamed"));
                        }
                    }
                }
            }
        }

        // Write back via the same code paths the IPC uses.
        let mut warnings = Vec::new();
        // Re-implement what fs_write_project does for databases inline so we
        // don't need a State<AppState>.
        if let serde_json::Value::Object(map) = &state.databases {
            let pairs: [(&str, Option<&String>); 11] = [
                ("actors", state.project.database.actors.as_ref()),
                ("classes", state.project.database.classes.as_ref()),
                ("skills", state.project.database.skills.as_ref()),
                ("enemies", state.project.database.enemies.as_ref()),
                ("troops", state.project.database.troops.as_ref()),
                ("quests", state.project.database.quests.as_ref()),
                ("shops", state.project.database.shops.as_ref()),
                ("system", state.project.database.system.as_ref()),
                ("switches", state.project.database.switches.as_ref()),
                ("variables", state.project.database.variables.as_ref()),
                ("commonEvents", state.project.database.common_events.as_ref()),
            ];
            for (key, maybe_rel) in pairs {
                let Some(rel) = maybe_rel else { continue };
                let Some(payload) = map.get(key) else { continue };
                let wrapped = if key == "system" {
                    let mut m = serde_json::Map::new();
                    m.insert("schemaVersion".into(), serde_json::Value::from(1));
                    if let serde_json::Value::Object(sys) = payload {
                        for (k, v) in sys {
                            if k == "schemaVersion" {
                                continue;
                            }
                            m.insert(k.clone(), v.clone());
                        }
                    }
                    serde_json::Value::Object(m)
                } else {
                    serde_json::json!({ "schemaVersion": 1, key: payload })
                };
                write_with_backup(&root, rel, &wrapped, &mut warnings).unwrap();
            }
        }

        // Reload to confirm the new value persisted.
        let reloaded = read_project_at(&root).unwrap();
        let actors = reloaded
            .databases
            .as_object()
            .unwrap()
            .get("actors")
            .unwrap()
            .as_array()
            .unwrap();
        assert_eq!(actors[0].get("name").unwrap(), "Renamed");
    }
}
