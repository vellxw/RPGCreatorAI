// FileSystem IPC commands.
//
// All paths go through canonicalize_inside_user_space + ensure_inside before
// any read/write. Writes are atomic (tmp file + rename) and create timestamped
// backups in <projectRoot>/.backups/ pruned to MAX_BACKUPS_PER_FILE per file.

use std::collections::{HashMap, HashSet};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use tauri::State;
use tauri_plugin_dialog::DialogExt;

use crate::app_paths;
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
    #[serde(default)]
    pub parent_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub order: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expanded: Option<bool>,
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
    pub weapons: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub armors: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub states: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub types: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub terms: Option<String>,
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
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        rename = "commonEvents"
    )]
    pub common_events: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub animations: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tilesets: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub audio: Option<String>,
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
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub asset_catalog: Option<String>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        rename = "visualProfile"
    )]
    pub visual_profile: Option<serde_json::Value>,
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
    #[serde(default = "default_asset_catalog")]
    pub assets: serde_json::Value,
}

fn default_asset_catalog() -> serde_json::Value {
    serde_json::json!({ "schemaVersion": 1, "assets": [] })
}

#[derive(Serialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ImportedImageAsset {
    pub id: String,
    pub name: String,
    pub kind: String,
    pub path: String,
    pub source: String,
    pub tags: Vec<String>,
}

#[derive(Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ImageImportResult {
    pub success: bool,
    pub cancelled: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub asset: Option<ImportedImageAsset>,
}

#[derive(Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SpritesheetImportMetadata {
    pub id_base: String,
    pub name: String,
    pub frame_width: u32,
    pub frame_height: u32,
    pub frame_count: u32,
}

#[derive(Serialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ImportedSpritesheetAsset {
    pub id: String,
    pub name: String,
    pub kind: String,
    pub path: String,
    pub source: String,
    pub tags: Vec<String>,
    pub frame_width: u32,
    pub frame_height: u32,
    pub frames: u32,
}

#[derive(Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SpritesheetImportResult {
    pub success: bool,
    pub cancelled: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub asset: Option<ImportedSpritesheetAsset>,
}

#[derive(Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct TilesetImportMetadata {
    pub id_base: String,
    pub name: String,
    pub tile_size: u32,
    pub columns: u32,
    pub tile_count: u32,
}

#[derive(Serialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ImportedTilesetAsset {
    pub id: String,
    pub name: String,
    pub kind: String,
    pub path: String,
    pub source: String,
    pub tags: Vec<String>,
    pub width: u32,
    pub height: u32,
}

#[derive(Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct TilesetImportResult {
    pub success: bool,
    pub cancelled: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub asset: Option<ImportedTilesetAsset>,
}

#[derive(Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AudioImportMetadata {
    pub usage: String,
}

#[derive(Serialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ImportedAudioAsset {
    pub id: String,
    pub name: String,
    pub kind: String,
    pub path: String,
    pub source: String,
    pub tags: Vec<String>,
}

#[derive(Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AudioImportResult {
    pub success: bool,
    pub cancelled: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub asset: Option<ImportedAudioAsset>,
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

#[derive(Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PlaytestSessionRequest {
    pub mode: String,
    #[serde(default)]
    pub current_map_id: Option<String>,
    #[serde(default)]
    pub selected_event_map_id: Option<String>,
    #[serde(default)]
    pub selected_event_id: Option<String>,
}

#[derive(Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PlaytestSessionResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_root: Option<String>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub pruned_session_roots: Vec<String>,
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
pub fn fs_create_project_dialog(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    project_state: FullProjectState,
) -> Result<OpenDialogResult, String> {
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

    write_new_project_at(&root, &project_state).map_err(|e| e.to_string())?;
    let reloaded = read_project_at(&root).map_err(|e| e.to_string())?;
    *state.project_root.lock().unwrap() = Some(root.clone());

    Ok(OpenDialogResult {
        root: Some(root.to_string_lossy().to_string()),
        cancelled: false,
        state: Some(reloaded),
    })
}

#[tauri::command]
pub fn fs_import_image_asset_dialog(
    app: tauri::AppHandle,
    root: String,
    existing_asset_ids: Vec<String>,
) -> Result<ImageImportResult, String> {
    let canonical = canonicalize_inside_user_space(&root).map_err(|e| e.to_string())?;
    must_contain_project_json(&canonical).map_err(|e| e.to_string())?;

    let Some(source) = app
        .dialog()
        .file()
        .add_filter("Image files", &["png", "jpg", "jpeg", "bmp", "webp"])
        .blocking_pick_file()
    else {
        return Ok(ImageImportResult {
            success: false,
            cancelled: true,
            error: None,
            asset: None,
        });
    };

    match source
        .into_path()
        .map_err(|e| e.to_string())
        .and_then(|path| import_image_asset_file(&canonical, &path, &existing_asset_ids))
    {
        Ok(asset) => Ok(ImageImportResult {
            success: true,
            cancelled: false,
            error: None,
            asset: Some(asset),
        }),
        Err(error) => Ok(ImageImportResult {
            success: false,
            cancelled: false,
            error: Some(error),
            asset: None,
        }),
    }
}

#[tauri::command]
pub fn fs_import_spritesheet_asset_dialog(
    app: tauri::AppHandle,
    root: String,
    existing_asset_ids: Vec<String>,
    metadata: SpritesheetImportMetadata,
) -> Result<SpritesheetImportResult, String> {
    let canonical = canonicalize_inside_user_space(&root).map_err(|e| e.to_string())?;
    must_contain_project_json(&canonical).map_err(|e| e.to_string())?;

    let Some(source) = app
        .dialog()
        .file()
        .add_filter("Spritesheet images", &["png", "jpg", "jpeg", "bmp", "webp"])
        .blocking_pick_file()
    else {
        return Ok(SpritesheetImportResult {
            success: false,
            cancelled: true,
            error: None,
            asset: None,
        });
    };

    match source
        .into_path()
        .map_err(|e| e.to_string())
        .and_then(|path| {
            import_spritesheet_asset_file(&canonical, &path, &existing_asset_ids, metadata)
        }) {
        Ok(asset) => Ok(SpritesheetImportResult {
            success: true,
            cancelled: false,
            error: None,
            asset: Some(asset),
        }),
        Err(error) => Ok(SpritesheetImportResult {
            success: false,
            cancelled: false,
            error: Some(error),
            asset: None,
        }),
    }
}

#[tauri::command]
pub fn fs_import_tileset_asset_dialog(
    app: tauri::AppHandle,
    root: String,
    existing_asset_ids: Vec<String>,
    metadata: TilesetImportMetadata,
) -> Result<TilesetImportResult, String> {
    let canonical = canonicalize_inside_user_space(&root).map_err(|e| e.to_string())?;
    must_contain_project_json(&canonical).map_err(|e| e.to_string())?;

    let Some(source) = app
        .dialog()
        .file()
        .add_filter("Tileset images", &["png", "jpg", "jpeg", "bmp", "webp"])
        .blocking_pick_file()
    else {
        return Ok(TilesetImportResult {
            success: false,
            cancelled: true,
            error: None,
            asset: None,
        });
    };

    match source
        .into_path()
        .map_err(|e| e.to_string())
        .and_then(|path| {
            import_tileset_asset_file(&canonical, &path, &existing_asset_ids, metadata)
        }) {
        Ok(asset) => Ok(TilesetImportResult {
            success: true,
            cancelled: false,
            error: None,
            asset: Some(asset),
        }),
        Err(error) => Ok(TilesetImportResult {
            success: false,
            cancelled: false,
            error: Some(error),
            asset: None,
        }),
    }
}

#[tauri::command]
pub fn fs_import_audio_asset_dialog(
    app: tauri::AppHandle,
    root: String,
    existing_asset_ids: Vec<String>,
    metadata: AudioImportMetadata,
) -> Result<AudioImportResult, String> {
    let canonical = canonicalize_inside_user_space(&root).map_err(|e| e.to_string())?;
    must_contain_project_json(&canonical).map_err(|e| e.to_string())?;

    let Some(source) = app
        .dialog()
        .file()
        .add_filter("WAV audio files", &["wav"])
        .blocking_pick_file()
    else {
        return Ok(AudioImportResult {
            success: false,
            cancelled: true,
            error: None,
            asset: None,
        });
    };

    match source
        .into_path()
        .map_err(|e| e.to_string())
        .and_then(|path| import_audio_asset_file(&canonical, &path, &existing_asset_ids, metadata))
    {
        Ok(asset) => Ok(AudioImportResult {
            success: true,
            cancelled: false,
            error: None,
            asset: Some(asset),
        }),
        Err(error) => Ok(AudioImportResult {
            success: false,
            cancelled: false,
            error: Some(error),
            asset: None,
        }),
    }
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
    let mut map_paths = HashSet::new();
    for map_ref in &project_state.project.maps {
        let path_key = map_ref.path.trim().replace('\\', "/").to_lowercase();
        if path_key.is_empty() {
            return Err(format!("map '{}' has an empty path", map_ref.id));
        }
        if !map_paths.insert(path_key) {
            return Err(format!(
                "duplicate map path '{}' would overwrite map data",
                map_ref.path
            ));
        }
        let map_value = project_state
            .maps
            .get(&map_ref.id)
            .ok_or_else(|| format!("save state is missing data for map id '{}'", map_ref.id))?;
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

    if let Some(rel) = project_state.project.asset_catalog.as_ref() {
        write_with_backup(&canonical, rel, &project_state.assets, &mut warnings)
            .map_err(|e| e.to_string())?;
    }

    // 3b. Phase 6 database shards. Each is wrapped in `{ schemaVersion, <key>: ... }`
    // so old runtime/editor pipelines keep parsing them.
    if let serde_json::Value::Object(map) = &project_state.databases {
        let pairs: [(&str, Option<&String>); 19] = [
            ("actors", project_state.project.database.actors.as_ref()),
            ("classes", project_state.project.database.classes.as_ref()),
            ("skills", project_state.project.database.skills.as_ref()),
            ("weapons", project_state.project.database.weapons.as_ref()),
            ("armors", project_state.project.database.armors.as_ref()),
            ("states", project_state.project.database.states.as_ref()),
            ("types", project_state.project.database.types.as_ref()),
            ("terms", project_state.project.database.terms.as_ref()),
            ("enemies", project_state.project.database.enemies.as_ref()),
            ("troops", project_state.project.database.troops.as_ref()),
            ("quests", project_state.project.database.quests.as_ref()),
            ("shops", project_state.project.database.shops.as_ref()),
            ("system", project_state.project.database.system.as_ref()),
            ("switches", project_state.project.database.switches.as_ref()),
            (
                "variables",
                project_state.project.database.variables.as_ref(),
            ),
            (
                "commonEvents",
                project_state.project.database.common_events.as_ref(),
            ),
            (
                "animations",
                project_state.project.database.animations.as_ref(),
            ),
            ("tilesets", project_state.project.database.tilesets.as_ref()),
            ("audio", project_state.project.database.audio.as_ref()),
        ];
        for (key, maybe_rel) in pairs {
            let Some(rel) = maybe_rel else { continue };
            let Some(payload) = map.get(key) else {
                continue;
            };
            let wrapped = if is_object_database_shard(key) {
                let mut m = serde_json::Map::new();
                m.insert("schemaVersion".into(), serde_json::Value::from(1));
                if let serde_json::Value::Object(object_payload) = payload {
                    for (k, v) in object_payload {
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

#[tauri::command]
pub fn fs_create_playtest_session(
    source_root: String,
    project_state: FullProjectState,
    request: PlaytestSessionRequest,
) -> Result<PlaytestSessionResult, String> {
    let canonical = canonicalize_inside_user_space(&source_root).map_err(|e| e.to_string())?;
    must_contain_project_json(&canonical).map_err(|e| e.to_string())?;
    let sessions = playtest_sessions_dir()?;
    create_playtest_session_at(&sessions, &canonical, &project_state, request)
}

// ------------------------------ Helpers ------------------------------

const MAX_PLAYTEST_SESSIONS: usize = 5;

fn playtest_sessions_dir() -> Result<PathBuf, String> {
    app_paths::playtest_sessions_dir()
        .map_err(|_| "no app data directory available for playtest sessions".to_string())
}

fn create_playtest_session_at(
    sessions_base: &Path,
    source_root: &Path,
    project_state: &FullProjectState,
    request: PlaytestSessionRequest,
) -> Result<PlaytestSessionResult, String> {
    fs::create_dir_all(sessions_base).map_err(|e| format!("mkdir playtest sessions: {e}"))?;
    let mut project = project_state.project.clone();
    apply_playtest_request(&mut project, project_state, &request)?;

    let mut session_root = sessions_base.join(
        chrono::Utc::now()
            .format("session-%Y%m%dT%H%M%S%.3fZ")
            .to_string(),
    );
    let mut suffix = 1;
    while session_root.exists() {
        session_root = sessions_base.join(format!(
            "{}-{suffix}",
            chrono::Utc::now().format("session-%Y%m%dT%H%M%S%.3fZ")
        ));
        suffix += 1;
    }
    fs::create_dir_all(&session_root)
        .map_err(|e| format!("mkdir playtest session {}: {e}", session_root.display()))?;

    write_project_snapshot(&session_root, &project, project_state)?;
    copy_optional_dir(&source_root.join("assets"), &session_root.join("assets"))?;
    copy_bundled_assets_if_available(&session_root)?;
    let pruned =
        prune_playtest_sessions(sessions_base, MAX_PLAYTEST_SESSIONS, Some(&session_root))?;

    Ok(PlaytestSessionResult {
        success: true,
        error: None,
        session_root: Some(session_root.to_string_lossy().to_string()),
        pruned_session_roots: pruned,
    })
}

fn apply_playtest_request(
    project: &mut ProjectData,
    project_state: &FullProjectState,
    request: &PlaytestSessionRequest,
) -> Result<(), String> {
    match request.mode.as_str() {
        "projectStart" => Ok(()),
        "currentMap" => {
            let map_id = request
                .current_map_id
                .as_deref()
                .ok_or_else(|| "currentMap playtest requires currentMapId".to_string())?;
            if !project_state.maps.contains_key(map_id) {
                return Err(format!("current map '{map_id}' is not loaded"));
            }
            let original_start = project.start_map_id.clone();
            project.start_map_id = map_id.to_string();
            if original_start != map_id {
                project.start_position = StartPosition {
                    x: 0,
                    y: 0,
                    direction: "down".into(),
                };
            }
            Ok(())
        }
        "selectedEvent" => {
            let map_id = request
                .selected_event_map_id
                .as_deref()
                .or(request.current_map_id.as_deref())
                .ok_or_else(|| "selectedEvent playtest requires selectedEventMapId".to_string())?;
            let event_id = request
                .selected_event_id
                .as_deref()
                .ok_or_else(|| "selectedEvent playtest requires selectedEventId".to_string())?;
            let map = project_state
                .maps
                .get(map_id)
                .ok_or_else(|| format!("selected event map '{map_id}' is not loaded"))?;
            let event = find_event(map, event_id)
                .ok_or_else(|| format!("selected event '{event_id}' was not found"))?;
            project.start_map_id = map_id.to_string();
            project.start_position = StartPosition {
                x: event.0,
                y: event.1,
                direction: "down".into(),
            };
            Ok(())
        }
        other => Err(format!("unsupported playtest mode '{other}'")),
    }
}

fn find_event(map: &serde_json::Value, event_id: &str) -> Option<(i64, i64)> {
    let events = map.get("events")?.as_array()?;
    for event in events {
        if event.get("id").and_then(|id| id.as_str()) == Some(event_id) {
            let x = event.get("x").and_then(|x| x.as_i64())?;
            let y = event.get("y").and_then(|y| y.as_i64())?;
            return Some((x, y));
        }
    }
    None
}

fn write_project_snapshot(
    session_root: &Path,
    project: &ProjectData,
    project_state: &FullProjectState,
) -> Result<(), String> {
    write_json_inside(session_root, "data/project.json", project)?;

    let mut map_paths = HashSet::new();
    for map_ref in &project.maps {
        let path_key = map_ref.path.trim().replace('\\', "/").to_lowercase();
        if path_key.is_empty() {
            return Err(format!("map '{}' has an empty path", map_ref.id));
        }
        if !map_paths.insert(path_key) {
            return Err(format!(
                "duplicate map path '{}' would overwrite map data",
                map_ref.path
            ));
        }
        let map_value = project_state
            .maps
            .get(&map_ref.id)
            .ok_or_else(|| format!("playtest state is missing map id '{}'", map_ref.id))?;
        write_json_inside(session_root, &map_ref.path, map_value)?;
    }

    write_json_inside(session_root, &project.database.items, &project_state.items)?;
    if let Some(rel) = project.asset_catalog.as_ref() {
        write_json_inside(session_root, rel, &project_state.assets)?;
    }

    if let serde_json::Value::Object(map) = &project_state.databases {
        let pairs: [(&str, Option<&String>); 19] = [
            ("actors", project.database.actors.as_ref()),
            ("classes", project.database.classes.as_ref()),
            ("skills", project.database.skills.as_ref()),
            ("weapons", project.database.weapons.as_ref()),
            ("armors", project.database.armors.as_ref()),
            ("states", project.database.states.as_ref()),
            ("types", project.database.types.as_ref()),
            ("terms", project.database.terms.as_ref()),
            ("enemies", project.database.enemies.as_ref()),
            ("troops", project.database.troops.as_ref()),
            ("quests", project.database.quests.as_ref()),
            ("shops", project.database.shops.as_ref()),
            ("system", project.database.system.as_ref()),
            ("switches", project.database.switches.as_ref()),
            ("variables", project.database.variables.as_ref()),
            ("commonEvents", project.database.common_events.as_ref()),
            ("animations", project.database.animations.as_ref()),
            ("tilesets", project.database.tilesets.as_ref()),
            ("audio", project.database.audio.as_ref()),
        ];
        for (key, maybe_rel) in pairs {
            let Some(rel) = maybe_rel else { continue };
            let Some(payload) = map.get(key) else {
                continue;
            };
            let wrapped = if is_object_database_shard(key) {
                let mut m = serde_json::Map::new();
                m.insert("schemaVersion".into(), serde_json::Value::from(1));
                if let serde_json::Value::Object(object_payload) = payload {
                    for (k, v) in object_payload {
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
            write_json_inside(session_root, rel, &wrapped)?;
        }
    }

    Ok(())
}

const IMAGE_IMPORT_DIR: &str = "assets/imported/images";
const SPRITESHEET_IMPORT_DIR: &str = "assets/imported/spritesheets";
const TILESET_IMPORT_DIR: &str = "assets/imported/tilesets";
const AUDIO_IMPORT_DIR: &str = "assets/imported/audio";
const ALLOWED_IMAGE_EXTENSIONS: &[&str] = &["png", "jpg", "jpeg", "bmp", "webp"];
const ALLOWED_AUDIO_EXTENSIONS: &[&str] = &["wav"];

fn import_image_asset_file(
    root: &Path,
    source: &Path,
    existing_asset_ids: &[String],
) -> Result<ImportedImageAsset, String> {
    let source = source
        .canonicalize()
        .map_err(|e| format!("source image {}: {e}", source.display()))?;
    let metadata =
        fs::metadata(&source).map_err(|e| format!("source image {}: {e}", source.display()))?;
    if !metadata.is_file() {
        return Err(format!("source image {} is not a file", source.display()));
    }

    let extension = source
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase())
        .unwrap_or_default();
    if !ALLOWED_IMAGE_EXTENSIONS.contains(&extension.as_str()) {
        return Err(format!("Unsupported image type \".{}\".", extension));
    }

    let raw_stem = source
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("image");
    let file_stem = slugify(raw_stem, '-');
    let id_base = slugify(raw_stem, '_');
    let asset_id = unique_asset_id(&id_base, existing_asset_ids);
    let name = titleize(raw_stem);

    let import_dir = root.join(IMAGE_IMPORT_DIR);
    fs::create_dir_all(&import_dir).map_err(|e| format!("mkdir {}: {e}", import_dir.display()))?;

    let mut suffix = 1usize;
    let (relative_path, destination) = loop {
        let candidate_name = if suffix == 1 {
            format!("{file_stem}.{extension}")
        } else {
            format!("{file_stem}-{suffix}.{extension}")
        };
        let relative_path = format!("{IMAGE_IMPORT_DIR}/{candidate_name}");
        let destination = join_inside(root, &relative_path).map_err(|e| e.to_string())?;
        ensure_inside(root, &destination).map_err(|e| e.to_string())?;
        if !destination.exists() {
            break (relative_path, destination);
        }
        suffix += 1;
    };

    fs::copy(&source, &destination).map_err(|e| {
        format!(
            "copy image {} to {}: {e}",
            source.display(),
            destination.display()
        )
    })?;

    Ok(ImportedImageAsset {
        id: asset_id,
        name,
        kind: "image".into(),
        path: relative_path,
        source: "imported".into(),
        tags: vec!["imported".into(), "image".into()],
    })
}

fn import_spritesheet_asset_file(
    root: &Path,
    source: &Path,
    existing_asset_ids: &[String],
    metadata: SpritesheetImportMetadata,
) -> Result<ImportedSpritesheetAsset, String> {
    if metadata.id_base.trim().is_empty() {
        return Err("Spritesheet asset id is required.".into());
    }
    if metadata.name.trim().is_empty() {
        return Err("Spritesheet asset name is required.".into());
    }
    if metadata.frame_width == 0 {
        return Err("Spritesheet frame width must be a positive integer.".into());
    }
    if metadata.frame_height == 0 {
        return Err("Spritesheet frame height must be a positive integer.".into());
    }
    if metadata.frame_count == 0 {
        return Err("Spritesheet frame count must be a positive integer.".into());
    }

    let source = source
        .canonicalize()
        .map_err(|e| format!("source spritesheet {}: {e}", source.display()))?;
    let file_metadata = fs::metadata(&source)
        .map_err(|e| format!("source spritesheet {}: {e}", source.display()))?;
    if !file_metadata.is_file() {
        return Err(format!(
            "source spritesheet {} is not a file",
            source.display()
        ));
    }

    let extension = source
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase())
        .unwrap_or_default();
    if !ALLOWED_IMAGE_EXTENSIONS.contains(&extension.as_str()) {
        return Err(format!("Unsupported spritesheet type \".{}\".", extension));
    }

    let raw_stem = source
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("spritesheet");
    let file_stem = slugify(raw_stem, '-');
    let id_base = slugify(&metadata.id_base, '_');
    let asset_id = unique_asset_id(&id_base, existing_asset_ids);

    let import_dir = root.join(SPRITESHEET_IMPORT_DIR);
    fs::create_dir_all(&import_dir).map_err(|e| format!("mkdir {}: {e}", import_dir.display()))?;

    let mut suffix = 1usize;
    let (relative_path, destination) = loop {
        let candidate_name = if suffix == 1 {
            format!("{file_stem}.{extension}")
        } else {
            format!("{file_stem}-{suffix}.{extension}")
        };
        let relative_path = format!("{SPRITESHEET_IMPORT_DIR}/{candidate_name}");
        let destination = join_inside(root, &relative_path).map_err(|e| e.to_string())?;
        ensure_inside(root, &destination).map_err(|e| e.to_string())?;
        if !destination.exists() {
            break (relative_path, destination);
        }
        suffix += 1;
    };

    fs::copy(&source, &destination).map_err(|e| {
        format!(
            "copy spritesheet {} to {}: {e}",
            source.display(),
            destination.display()
        )
    })?;

    Ok(ImportedSpritesheetAsset {
        id: asset_id,
        name: metadata.name.trim().to_string(),
        kind: "spritesheet".into(),
        path: relative_path,
        source: "imported".into(),
        tags: vec!["imported".into(), "spritesheet".into()],
        frame_width: metadata.frame_width,
        frame_height: metadata.frame_height,
        frames: metadata.frame_count,
    })
}

fn import_tileset_asset_file(
    root: &Path,
    source: &Path,
    existing_asset_ids: &[String],
    metadata: TilesetImportMetadata,
) -> Result<ImportedTilesetAsset, String> {
    if metadata.id_base.trim().is_empty() {
        return Err("Tileset asset id is required.".into());
    }
    if metadata.name.trim().is_empty() {
        return Err("Tileset asset name is required.".into());
    }
    if metadata.tile_size == 0 {
        return Err("Tileset tile size must be a positive integer.".into());
    }
    if metadata.columns == 0 {
        return Err("Tileset column count must be a positive integer.".into());
    }
    if metadata.tile_count == 0 {
        return Err("Tileset tile count must be a positive integer.".into());
    }

    let source = source
        .canonicalize()
        .map_err(|e| format!("source tileset {}: {e}", source.display()))?;
    let file_metadata =
        fs::metadata(&source).map_err(|e| format!("source tileset {}: {e}", source.display()))?;
    if !file_metadata.is_file() {
        return Err(format!("source tileset {} is not a file", source.display()));
    }

    let extension = source
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase())
        .unwrap_or_default();
    if !ALLOWED_IMAGE_EXTENSIONS.contains(&extension.as_str()) {
        return Err(format!("Unsupported tileset type \".{}\".", extension));
    }

    let raw_stem = source
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("tileset");
    let file_stem = slugify(raw_stem, '-');
    let id_base = slugify(&metadata.id_base, '_');
    let asset_id = unique_asset_id(&id_base, existing_asset_ids);
    let rows = metadata.tile_count.div_ceil(metadata.columns);
    let width = metadata.tile_size.saturating_mul(metadata.columns);
    let height = metadata.tile_size.saturating_mul(rows);

    let import_dir = root.join(TILESET_IMPORT_DIR);
    fs::create_dir_all(&import_dir).map_err(|e| format!("mkdir {}: {e}", import_dir.display()))?;

    let mut suffix = 1usize;
    let (relative_path, destination) = loop {
        let candidate_name = if suffix == 1 {
            format!("{file_stem}.{extension}")
        } else {
            format!("{file_stem}-{suffix}.{extension}")
        };
        let relative_path = format!("{TILESET_IMPORT_DIR}/{candidate_name}");
        let destination = join_inside(root, &relative_path).map_err(|e| e.to_string())?;
        ensure_inside(root, &destination).map_err(|e| e.to_string())?;
        if !destination.exists() {
            break (relative_path, destination);
        }
        suffix += 1;
    };

    fs::copy(&source, &destination).map_err(|e| {
        format!(
            "copy tileset {} to {}: {e}",
            source.display(),
            destination.display()
        )
    })?;

    Ok(ImportedTilesetAsset {
        id: asset_id,
        name: metadata.name.trim().to_string(),
        kind: "tileset".into(),
        path: relative_path,
        source: "imported".into(),
        tags: vec!["imported".into(), "tileset".into()],
        width,
        height,
    })
}

fn import_audio_asset_file(
    root: &Path,
    source: &Path,
    existing_asset_ids: &[String],
    metadata: AudioImportMetadata,
) -> Result<ImportedAudioAsset, String> {
    let usage = metadata.usage.trim().to_ascii_lowercase();
    if usage != "bgm" && usage != "sfx" {
        return Err("Audio usage must be \"bgm\" or \"sfx\".".into());
    }

    let source = source
        .canonicalize()
        .map_err(|e| format!("source audio {}: {e}", source.display()))?;
    let file_metadata =
        fs::metadata(&source).map_err(|e| format!("source audio {}: {e}", source.display()))?;
    if !file_metadata.is_file() {
        return Err(format!("source audio {} is not a file", source.display()));
    }

    let extension = source
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase())
        .unwrap_or_default();
    if !ALLOWED_AUDIO_EXTENSIONS.contains(&extension.as_str()) {
        return Err(format!("Unsupported audio type \".{}\".", extension));
    }

    let raw_stem = source
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("audio");
    let file_stem = slugify(raw_stem, '-');
    let id_base = slugify(raw_stem, '_');
    let asset_id = unique_asset_id(&id_base, existing_asset_ids);
    let name = titleize(raw_stem);

    let import_dir = root.join(AUDIO_IMPORT_DIR);
    fs::create_dir_all(&import_dir).map_err(|e| format!("mkdir {}: {e}", import_dir.display()))?;

    let mut suffix = 1usize;
    let (relative_path, destination) = loop {
        let candidate_name = if suffix == 1 {
            format!("{file_stem}.{extension}")
        } else {
            format!("{file_stem}-{suffix}.{extension}")
        };
        let relative_path = format!("{AUDIO_IMPORT_DIR}/{candidate_name}");
        let destination = join_inside(root, &relative_path).map_err(|e| e.to_string())?;
        ensure_inside(root, &destination).map_err(|e| e.to_string())?;
        if !destination.exists() {
            break (relative_path, destination);
        }
        suffix += 1;
    };

    fs::copy(&source, &destination).map_err(|e| {
        format!(
            "copy audio {} to {}: {e}",
            source.display(),
            destination.display()
        )
    })?;

    Ok(ImportedAudioAsset {
        id: asset_id,
        name,
        kind: "audio".into(),
        path: relative_path,
        source: "imported".into(),
        tags: vec!["imported".into(), "audio".into(), usage],
    })
}

fn slugify(input: &str, separator: char) -> String {
    let mut out = String::new();
    let mut last_was_separator = false;
    for ch in input.chars() {
        if ch.is_ascii_alphanumeric() {
            out.push(ch.to_ascii_lowercase());
            last_was_separator = false;
        } else if !last_was_separator && !out.is_empty() {
            out.push(separator);
            last_was_separator = true;
        }
    }
    while out.ends_with(separator) {
        out.pop();
    }
    if out.is_empty() {
        "image".into()
    } else {
        out
    }
}

fn unique_asset_id(base: &str, existing_asset_ids: &[String]) -> String {
    let existing: HashSet<&str> = existing_asset_ids.iter().map(String::as_str).collect();
    if !existing.contains(base) {
        return base.to_string();
    }
    let mut suffix = 2usize;
    loop {
        let candidate = format!("{base}_{suffix}");
        if !existing.contains(candidate.as_str()) {
            return candidate;
        }
        suffix += 1;
    }
}

fn titleize(input: &str) -> String {
    let words: Vec<String> = input
        .split(|ch: char| !ch.is_ascii_alphanumeric())
        .filter(|word| !word.is_empty())
        .map(|word| {
            let mut chars = word.chars();
            let first = chars
                .next()
                .map(|ch| ch.to_ascii_uppercase())
                .unwrap_or('I');
            format!("{first}{}", chars.as_str())
        })
        .collect();
    if words.is_empty() {
        "Image".into()
    } else {
        words.join(" ")
    }
}

fn write_json_inside<T: Serialize>(root: &Path, relative: &str, value: &T) -> Result<(), String> {
    let target = join_inside(root, relative).map_err(|e| e.to_string())?;
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("mkdir {}: {e}", parent.display()))?;
    }
    let pretty =
        serde_json::to_string_pretty(value).map_err(|e| format!("serialise {relative}: {e}"))?;
    serde_json::from_str::<serde_json::Value>(&pretty)
        .map_err(|e| format!("post-serialise validation failed for {relative}: {e}"))?;
    fs::write(&target, pretty).map_err(|e| format!("write {}: {e}", target.display()))
}

fn copy_optional_dir(source: &Path, target: &Path) -> Result<(), String> {
    if !source.exists() {
        return Ok(());
    }
    if !source.is_dir() {
        return Ok(());
    }
    fs::create_dir_all(target).map_err(|e| format!("mkdir {}: {e}", target.display()))?;
    for entry in fs::read_dir(source).map_err(|e| format!("read_dir {}: {e}", source.display()))? {
        let entry = entry.map_err(|e| e.to_string())?;
        let file_type = entry.file_type().map_err(|e| e.to_string())?;
        if file_type.is_symlink() {
            continue;
        }
        let src = entry.path();
        let dst = target.join(entry.file_name());
        if file_type.is_dir() {
            copy_optional_dir(&src, &dst)?;
        } else if file_type.is_file() {
            if let Some(parent) = dst.parent() {
                fs::create_dir_all(parent)
                    .map_err(|e| format!("mkdir {}: {e}", parent.display()))?;
            }
            fs::copy(&src, &dst)
                .map_err(|e| format!("copy {} to {}: {e}", src.display(), dst.display()))?;
        }
    }
    Ok(())
}

fn copy_bundled_assets_if_available(project_root: &Path) -> Result<(), String> {
    let bundled_assets = Path::new("assets");
    if !bundled_assets.is_dir() {
        return Ok(());
    }
    let target = project_root.join("assets");
    copy_optional_dir(bundled_assets, &target)
}

fn prune_playtest_sessions(
    base: &Path,
    keep: usize,
    protected: Option<&Path>,
) -> Result<Vec<String>, String> {
    if !base.exists() {
        return Ok(vec![]);
    }
    let mut sessions: Vec<PathBuf> = fs::read_dir(base)
        .map_err(|e| format!("read_dir {}: {e}", base.display()))?
        .filter_map(|entry| entry.ok().map(|entry| entry.path()))
        .filter(|path| {
            path.is_dir()
                && path
                    .file_name()
                    .and_then(|name| name.to_str())
                    .is_some_and(|name| name.starts_with("session-"))
        })
        .collect();
    sessions.sort_by(|a, b| {
        let a_modified = fs::metadata(a).and_then(|m| m.modified()).ok();
        let b_modified = fs::metadata(b).and_then(|m| m.modified()).ok();
        a_modified.cmp(&b_modified).then_with(|| a.cmp(b))
    });
    let drop_count = sessions.len().saturating_sub(keep);
    let mut pruned = Vec::new();
    let mut removed = 0;
    for path in sessions {
        if removed >= drop_count {
            break;
        }
        if protected.is_some_and(|protected| protected == path.as_path()) {
            continue;
        }
        let display = path.to_string_lossy().to_string();
        fs::remove_dir_all(&path).map_err(|e| format!("remove {}: {e}", path.display()))?;
        pruned.push(display);
        removed += 1;
    }
    Ok(pruned)
}

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

    let assets = if let Some(rel) = project.asset_catalog.as_ref() {
        let path = join_inside(root, rel).map_err(|e| e.to_string())?;
        if path.exists() {
            read_json(&path).map_err(|e| format!("asset catalog: {e}"))?
        } else {
            default_asset_catalog()
        }
    } else {
        default_asset_catalog()
    };

    // Phase 6 — read every additional database shard if its path is declared
    // and the file exists on disk. Missing files are tolerated and surface as
    // empty defaults; the renderer's `mergeDatabases()` fills the gaps.
    let mut databases = serde_json::Map::new();
    let pairs: [(&str, Option<&String>); 19] = [
        ("actors", project.database.actors.as_ref()),
        ("classes", project.database.classes.as_ref()),
        ("skills", project.database.skills.as_ref()),
        ("weapons", project.database.weapons.as_ref()),
        ("armors", project.database.armors.as_ref()),
        ("states", project.database.states.as_ref()),
        ("types", project.database.types.as_ref()),
        ("terms", project.database.terms.as_ref()),
        ("enemies", project.database.enemies.as_ref()),
        ("troops", project.database.troops.as_ref()),
        ("quests", project.database.quests.as_ref()),
        ("shops", project.database.shops.as_ref()),
        ("system", project.database.system.as_ref()),
        ("switches", project.database.switches.as_ref()),
        ("variables", project.database.variables.as_ref()),
        ("commonEvents", project.database.common_events.as_ref()),
        ("animations", project.database.animations.as_ref()),
        ("tilesets", project.database.tilesets.as_ref()),
        ("audio", project.database.audio.as_ref()),
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
        assets,
    })
}

/// Most database shards on disk wrap their payload in `{ "schemaVersion": 1, "<key>": [...] }`.
/// The renderer's in-memory shape is the unwrapped list (or object shards like
/// system and animations).
/// Round-trip safely by extracting the inner field when it exists; otherwise
/// pass the raw value through.
fn extract_database_payload(key: &str, value: serde_json::Value) -> serde_json::Value {
    if let serde_json::Value::Object(mut map) = value {
        if is_object_database_shard(key) {
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

fn is_object_database_shard(key: &str) -> bool {
    matches!(
        key,
        "system" | "animations" | "tilesets" | "types" | "terms" | "audio"
    )
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

fn ensure_new_project_target(root: &Path) -> Result<(), String> {
    let project_path = root.join("data/project.json");
    if project_path.exists() {
        return Err(format!(
            "selected folder already contains data/project.json (looked at {})",
            project_path.display()
        ));
    }

    let data_dir = root.join("data");
    if data_dir.exists() {
        if !data_dir.is_dir() {
            return Err(format!(
                "selected folder contains a non-directory data path at {}",
                data_dir.display()
            ));
        }
        let mut entries = fs::read_dir(&data_dir).map_err(|e| e.to_string())?;
        if entries
            .next()
            .transpose()
            .map_err(|e| e.to_string())?
            .is_some()
        {
            return Err(format!(
                "selected folder has a non-empty data directory at {}",
                data_dir.display()
            ));
        }
    }

    Ok(())
}

fn read_json<T: serde::de::DeserializeOwned>(path: &Path) -> Result<T, String> {
    let bytes = fs::read(path).map_err(|e| format!("read {}: {e}", path.display()))?;
    serde_json::from_slice(&bytes).map_err(|e| format!("parse {}: {e}", path.display()))
}

fn write_new_project_at(
    root: &Path,
    project_state: &FullProjectState,
) -> Result<SaveResult, String> {
    ensure_new_project_target(root)?;

    let mut map_paths = HashSet::new();
    for map_ref in &project_state.project.maps {
        let path_key = map_ref.path.trim().replace('\\', "/").to_lowercase();
        if path_key.is_empty() {
            return Err(format!("map '{}' has an empty path", map_ref.id));
        }
        if !map_paths.insert(path_key) {
            return Err(format!(
                "duplicate map path '{}' would overwrite map data",
                map_ref.path
            ));
        }
        if !project_state.maps.contains_key(&map_ref.id) {
            return Err(format!(
                "new project state is missing data for map id '{}'",
                map_ref.id
            ));
        }
    }

    let mut warnings: Vec<String> = Vec::new();
    write_new_json(root, "data/project.json", &project_state.project)?;
    for map_ref in &project_state.project.maps {
        let map_value = project_state.maps.get(&map_ref.id).unwrap();
        write_new_json(root, &map_ref.path, map_value)?;
    }
    write_new_json(
        root,
        &project_state.project.database.items,
        &project_state.items,
    )?;
    if let Some(rel) = project_state.project.asset_catalog.as_ref() {
        write_new_json(root, rel, &project_state.assets)?;
    }

    if let serde_json::Value::Object(map) = &project_state.databases {
        let pairs: [(&str, Option<&String>); 19] = [
            ("actors", project_state.project.database.actors.as_ref()),
            ("classes", project_state.project.database.classes.as_ref()),
            ("skills", project_state.project.database.skills.as_ref()),
            ("weapons", project_state.project.database.weapons.as_ref()),
            ("armors", project_state.project.database.armors.as_ref()),
            ("states", project_state.project.database.states.as_ref()),
            ("types", project_state.project.database.types.as_ref()),
            ("terms", project_state.project.database.terms.as_ref()),
            ("enemies", project_state.project.database.enemies.as_ref()),
            ("troops", project_state.project.database.troops.as_ref()),
            ("quests", project_state.project.database.quests.as_ref()),
            ("shops", project_state.project.database.shops.as_ref()),
            ("system", project_state.project.database.system.as_ref()),
            ("switches", project_state.project.database.switches.as_ref()),
            (
                "variables",
                project_state.project.database.variables.as_ref(),
            ),
            (
                "commonEvents",
                project_state.project.database.common_events.as_ref(),
            ),
            (
                "animations",
                project_state.project.database.animations.as_ref(),
            ),
            ("tilesets", project_state.project.database.tilesets.as_ref()),
            ("audio", project_state.project.database.audio.as_ref()),
        ];
        for (key, maybe_rel) in pairs {
            let Some(rel) = maybe_rel else { continue };
            let Some(payload) = map.get(key) else {
                continue;
            };
            let wrapped = if is_object_database_shard(key) {
                let mut m = serde_json::Map::new();
                m.insert("schemaVersion".into(), serde_json::Value::from(1));
                if let serde_json::Value::Object(object_payload) = payload {
                    for (k, v) in object_payload {
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
            write_new_json(root, rel, &wrapped)?;
        }
    }

    if let Err(e) = ensure_gitignore_mentions_backups(root) {
        warnings.push(format!("could not update .gitignore: {e}"));
    }
    if let Err(e) = copy_bundled_assets_if_available(root) {
        warnings.push(format!("could not copy bundled runtime assets: {e}"));
    }

    Ok(SaveResult {
        success: true,
        error: None,
        warnings,
        backup_path: None,
    })
}

fn write_new_json<T: Serialize>(root: &Path, relative: &str, value: &T) -> Result<(), String> {
    let target = join_inside(root, relative).map_err(|e| e.to_string())?;
    if target.exists() {
        return Err(format!(
            "refusing to overwrite existing file {}",
            target.display()
        ));
    }

    let pretty =
        serde_json::to_string_pretty(value).map_err(|e| format!("serialise {relative}: {e}"))?;
    serde_json::from_str::<serde_json::Value>(&pretty)
        .map_err(|e| format!("post-serialise validation failed for {relative}: {e}"))?;

    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("mkdir {}: {e}", parent.display()))?;
    }

    let mut f = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&target)
        .map_err(|e| format!("create {}: {e}", target.display()))?;
    f.write_all(pretty.as_bytes())
        .map_err(|e| format!("write {}: {e}", target.display()))?;
    f.sync_all()
        .map_err(|e| format!("fsync {}: {e}", target.display()))?;

    Ok(())
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
    let pretty =
        serde_json::to_string_pretty(value).map_err(|e| format!("serialise {relative}: {e}"))?;
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

    let ts = chrono::Utc::now().format("%Y-%m-%dT%H-%M-%SZ").to_string();
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
        files.sort_by_key(|p| fs::metadata(p).and_then(|m| m.modified()).ok());
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
            "maps": [{ "id": "town", "path": "data/maps/town.json", "parentId": null, "order": 0, "expanded": true }],
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
        fs::write(root.join("data/database/items.json"), r#"{"items":[]}"#).unwrap();
    }

    #[test]
    fn read_project_loads_full_state() {
        let tmp = TempDir::new().unwrap();
        let root = tmp.path().canonicalize().unwrap();
        make_project(&root);

        let result = read_project_at(&root).unwrap();
        assert_eq!(result.project.title, "T");
        assert!(result.maps.contains_key("town"));
        assert_eq!(result.project.maps[0].order, Some(0));
        assert_eq!(result.project.maps[0].expanded, Some(true));
    }

    fn starter_project_state() -> FullProjectState {
        let project = ProjectData {
            schema_version: 1,
            title: "New Game".into(),
            start_map_id: "town".into(),
            start_position: StartPosition {
                x: 1,
                y: 1,
                direction: "down".into(),
            },
            maps: vec![MapReference {
                id: "town".into(),
                path: "data/maps/town.json".into(),
                parent_id: None,
                order: Some(0),
                expanded: Some(true),
            }],
            database: DatabaseRefs {
                items: "data/database/items.json".into(),
                actors: Some("data/database/actors.json".into()),
                classes: None,
                skills: None,
                weapons: None,
                armors: None,
                states: None,
                types: None,
                terms: None,
                enemies: None,
                troops: None,
                quests: None,
                shops: None,
                system: Some("data/database/system.json".into()),
                switches: None,
                variables: None,
                common_events: None,
                animations: None,
                tilesets: Some("data/database/tilesets.json".into()),
                audio: None,
            },
            asset_catalog: Some("data/assets/catalog.json".into()),
            visual_profile: Some(serde_json::json!({
                "aspectRatio": "16:9",
                "baseResolution": { "width": 1280, "height": 720 },
                "tileSize": 32,
                "cameraMode": "follow-player",
                "mapPresentation": "full-scene",
                "zoom": 1,
                "integerScale": true
            })),
        };
        let mut maps = HashMap::new();
        maps.insert(
            "town".into(),
            serde_json::json!({
                "schemaVersion": 1,
                "id": "town",
                "name": "Town",
                "width": 2,
                "height": 2,
                "tileSize": 32,
                "layers": [
                    { "name": "ground", "type": "visual", "tiles": [1,1,1,1] },
                    { "name": "collision", "type": "collision", "tiles": [0,0,0,0] }
                ],
                "events": []
            }),
        );
        FullProjectState {
            project,
            maps,
            items: serde_json::json!({ "items": [] }),
            databases: serde_json::json!({
                "actors": [],
                "system": { "startingParty": [], "startingGold": 0 },
                "tilesets": { "tilesets": [] }
            }),
            assets: serde_json::json!({
                "schemaVersion": 1,
                "assets": [
                    {
                        "id": "starter_asset",
                        "name": "Starter Asset",
                        "kind": "image",
                        "path": "assets/generated/web/player_adventurer.png",
                        "source": "generated"
                    }
                ]
            }),
        }
    }

    #[test]
    fn create_new_project_writes_required_files_and_reloads() {
        let tmp = TempDir::new().unwrap();
        let root = tmp.path().canonicalize().unwrap();
        let state = starter_project_state();

        let result = write_new_project_at(&root, &state).unwrap();

        assert!(result.success);
        assert!(root.join("data/project.json").is_file());
        assert!(root.join("data/maps/town.json").is_file());
        assert!(root.join("data/database/items.json").is_file());
        assert!(root.join("data/database/actors.json").is_file());
        assert!(root.join("data/database/system.json").is_file());
        assert!(root.join("data/database/tilesets.json").is_file());
        assert!(root.join("data/assets/catalog.json").is_file());
        assert!(root.join("data/project.json").is_file());
        let project_json: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(root.join("data/project.json")).unwrap())
                .unwrap();
        assert_eq!(
            project_json["visualProfile"]["aspectRatio"].as_str(),
            Some("16:9")
        );
        if Path::new("assets/generated/runtime/tile_grass.bmp").exists() {
            assert!(root
                .join("assets/generated/runtime/tile_grass.bmp")
                .is_file());
        }
        let reloaded = read_project_at(&root).unwrap();
        assert_eq!(reloaded.project.title, "New Game");
        assert!(reloaded.maps.contains_key("town"));
        assert_eq!(
            reloaded.assets["assets"][0]["id"].as_str(),
            Some("starter_asset")
        );
        assert!(fs::read_to_string(root.join(".gitignore"))
            .unwrap()
            .contains(".backups/"));
    }

    #[test]
    fn import_image_asset_file_copies_allowed_images_without_overwrite() {
        let project_tmp = TempDir::new().unwrap();
        let source_tmp = TempDir::new().unwrap();
        let root = project_tmp.path().canonicalize().unwrap();
        let source = source_tmp.path().join("Castle Gate.PNG");
        fs::write(&source, b"fixture image").unwrap();
        fs::create_dir_all(root.join("assets/imported/images")).unwrap();
        fs::write(
            root.join("assets/imported/images/castle-gate.png"),
            b"existing",
        )
        .unwrap();

        let imported = import_image_asset_file(&root, &source, &["castle_gate".into()]).unwrap();

        assert_eq!(imported.id, "castle_gate_2");
        assert_eq!(imported.name, "Castle Gate");
        assert_eq!(imported.kind, "image");
        assert_eq!(imported.source, "imported");
        assert_eq!(imported.path, "assets/imported/images/castle-gate-2.png");
        assert_eq!(imported.tags, vec!["imported", "image"]);
        assert_eq!(
            fs::read(root.join("assets/imported/images/castle-gate.png")).unwrap(),
            b"existing"
        );
        assert_eq!(
            fs::read(root.join("assets/imported/images/castle-gate-2.png")).unwrap(),
            b"fixture image"
        );
    }

    #[test]
    fn import_image_asset_file_rejects_invalid_files() {
        let project_tmp = TempDir::new().unwrap();
        let source_tmp = TempDir::new().unwrap();
        let root = project_tmp.path().canonicalize().unwrap();
        let source = source_tmp.path().join("notes.txt");
        fs::write(&source, b"not an image").unwrap();

        let result = import_image_asset_file(&root, &source, &[]);

        assert!(result.unwrap_err().contains("Unsupported image type"));
        assert!(!root.join("assets/imported/images/notes.txt").exists());
    }

    #[test]
    fn import_spritesheet_asset_file_generates_frame_metadata_without_overwrite() {
        let project_tmp = TempDir::new().unwrap();
        let source_tmp = TempDir::new().unwrap();
        let root = project_tmp.path().canonicalize().unwrap();
        let source = source_tmp.path().join("Hero Run Sheet.PNG");
        fs::write(&source, b"spritesheet fixture").unwrap();
        fs::create_dir_all(root.join("assets/imported/spritesheets")).unwrap();
        fs::write(
            root.join("assets/imported/spritesheets/hero-run-sheet.png"),
            b"existing",
        )
        .unwrap();

        let imported = import_spritesheet_asset_file(
            &root,
            &source,
            &["hero_run_sheet".into()],
            SpritesheetImportMetadata {
                id_base: "hero_run_sheet".into(),
                name: "Hero Run Sheet".into(),
                frame_width: 64,
                frame_height: 64,
                frame_count: 6,
            },
        )
        .unwrap();

        assert_eq!(imported.id, "hero_run_sheet_2");
        assert_eq!(imported.name, "Hero Run Sheet");
        assert_eq!(imported.kind, "spritesheet");
        assert_eq!(imported.source, "imported");
        assert_eq!(
            imported.path,
            "assets/imported/spritesheets/hero-run-sheet-2.png"
        );
        assert_eq!(imported.tags, vec!["imported", "spritesheet"]);
        assert_eq!(imported.frame_width, 64);
        assert_eq!(imported.frame_height, 64);
        assert_eq!(imported.frames, 6);
        assert_eq!(
            fs::read(root.join("assets/imported/spritesheets/hero-run-sheet.png")).unwrap(),
            b"existing"
        );
        assert_eq!(
            fs::read(root.join("assets/imported/spritesheets/hero-run-sheet-2.png")).unwrap(),
            b"spritesheet fixture"
        );
    }

    #[test]
    fn import_tileset_asset_file_generates_tileset_metadata_without_overwrite() {
        let project_tmp = TempDir::new().unwrap();
        let source_tmp = TempDir::new().unwrap();
        let root = project_tmp.path().canonicalize().unwrap();
        let source = source_tmp.path().join("Forest Pack.PNG");
        fs::write(&source, b"tileset fixture").unwrap();
        fs::create_dir_all(root.join("assets/imported/tilesets")).unwrap();
        fs::write(
            root.join("assets/imported/tilesets/forest-pack.png"),
            b"existing",
        )
        .unwrap();

        let imported = import_tileset_asset_file(
            &root,
            &source,
            &["forest_pack".into()],
            TilesetImportMetadata {
                id_base: "forest_pack".into(),
                name: "Forest Pack".into(),
                tile_size: 32,
                columns: 8,
                tile_count: 64,
            },
        )
        .unwrap();

        assert_eq!(imported.id, "forest_pack_2");
        assert_eq!(imported.name, "Forest Pack");
        assert_eq!(imported.kind, "tileset");
        assert_eq!(imported.source, "imported");
        assert_eq!(imported.path, "assets/imported/tilesets/forest-pack-2.png");
        assert_eq!(imported.tags, vec!["imported", "tileset"]);
        assert_eq!(imported.width, 256);
        assert_eq!(imported.height, 256);
        assert_eq!(
            fs::read(root.join("assets/imported/tilesets/forest-pack.png")).unwrap(),
            b"existing"
        );
        assert_eq!(
            fs::read(root.join("assets/imported/tilesets/forest-pack-2.png")).unwrap(),
            b"tileset fixture"
        );
    }

    #[test]
    fn import_tileset_asset_file_rejects_invalid_metadata_and_extensions() {
        let project_tmp = TempDir::new().unwrap();
        let source_tmp = TempDir::new().unwrap();
        let root = project_tmp.path().canonicalize().unwrap();
        let source = source_tmp.path().join("forest.txt");
        fs::write(&source, b"not an image").unwrap();

        let bad_metadata = import_tileset_asset_file(
            &root,
            &source,
            &[],
            TilesetImportMetadata {
                id_base: "forest_pack".into(),
                name: "Forest Pack".into(),
                tile_size: 0,
                columns: 8,
                tile_count: 64,
            },
        );
        assert!(bad_metadata.unwrap_err().contains("Tileset tile size"));

        let bad_extension = import_tileset_asset_file(
            &root,
            &source,
            &[],
            TilesetImportMetadata {
                id_base: "forest_pack".into(),
                name: "Forest Pack".into(),
                tile_size: 32,
                columns: 8,
                tile_count: 64,
            },
        );
        assert!(bad_extension
            .unwrap_err()
            .contains("Unsupported tileset type"));
        assert!(!root.join("assets/imported/tilesets/forest.txt").exists());
    }

    #[test]
    fn import_audio_asset_file_copies_wav_and_tags_usage_without_overwrite() {
        let project_tmp = TempDir::new().unwrap();
        let source_tmp = TempDir::new().unwrap();
        let root = project_tmp.path().canonicalize().unwrap();
        let source = source_tmp.path().join("Town Loop.WAV");
        fs::write(&source, b"audio fixture").unwrap();
        fs::create_dir_all(root.join("assets/imported/audio")).unwrap();
        fs::write(
            root.join("assets/imported/audio/town-loop.wav"),
            b"existing",
        )
        .unwrap();

        let imported = import_audio_asset_file(
            &root,
            &source,
            &["town_loop".into()],
            AudioImportMetadata {
                usage: "bgm".into(),
            },
        )
        .unwrap();

        assert_eq!(imported.id, "town_loop_2");
        assert_eq!(imported.name, "Town Loop");
        assert_eq!(imported.kind, "audio");
        assert_eq!(imported.source, "imported");
        assert_eq!(imported.path, "assets/imported/audio/town-loop-2.wav");
        assert_eq!(imported.tags, vec!["imported", "audio", "bgm"]);
        assert_eq!(
            fs::read(root.join("assets/imported/audio/town-loop.wav")).unwrap(),
            b"existing"
        );
        assert_eq!(
            fs::read(root.join("assets/imported/audio/town-loop-2.wav")).unwrap(),
            b"audio fixture"
        );
    }

    #[test]
    fn import_audio_asset_file_rejects_non_wav_and_unknown_usage() {
        let project_tmp = TempDir::new().unwrap();
        let source_tmp = TempDir::new().unwrap();
        let root = project_tmp.path().canonicalize().unwrap();
        let source = source_tmp.path().join("theme.mp3");
        fs::write(&source, b"not a wav").unwrap();

        let bad_usage = import_audio_asset_file(
            &root,
            &source,
            &[],
            AudioImportMetadata {
                usage: "voice".into(),
            },
        );
        assert!(bad_usage.unwrap_err().contains("Audio usage"));

        let bad_extension = import_audio_asset_file(
            &root,
            &source,
            &[],
            AudioImportMetadata {
                usage: "sfx".into(),
            },
        );
        assert!(bad_extension
            .unwrap_err()
            .contains("Unsupported audio type"));
        assert!(!root.join("assets/imported/audio/theme.mp3").exists());
    }

    #[test]
    fn create_new_project_rejects_non_empty_data_directory() {
        let tmp = TempDir::new().unwrap();
        let root = tmp.path().canonicalize().unwrap();
        fs::create_dir_all(root.join("data")).unwrap();
        fs::write(root.join("data/notes.txt"), "keep me").unwrap();

        let result = write_new_project_at(&root, &starter_project_state());

        assert!(result.is_err());
        let err = match result {
            Ok(_) => panic!("expected non-empty data directory to be rejected"),
            Err(err) => err,
        };
        assert!(err.contains("non-empty data directory"));
        assert!(root.join("data/notes.txt").is_file());
        assert!(!root.join("data/project.json").exists());
    }

    fn make_playtest_project(root: &Path) {
        make_project(root);
        let mut project: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(root.join("data/project.json")).unwrap())
                .unwrap();
        project["maps"] = serde_json::json!([
            { "id": "town", "path": "data/maps/town.json" },
            { "id": "house", "path": "data/maps/house.json" }
        ]);
        fs::write(
            root.join("data/project.json"),
            serde_json::to_string_pretty(&project).unwrap(),
        )
        .unwrap();
        let house = serde_json::json!({
            "schemaVersion": 1, "id": "house", "name": "House",
            "width": 2, "height": 2, "tileSize": 32,
            "layers": [
                { "name": "g", "type": "visual", "tiles": [1,1,1,1] },
                { "name": "c", "type": "collision", "tiles": [0,0,0,0] }
            ],
            "events": [
                { "id": "npc_1", "type": "npc", "x": 1, "y": 0, "solid": false, "trigger": "interact", "commands": [] }
            ]
        });
        fs::write(
            root.join("data/maps/house.json"),
            serde_json::to_string_pretty(&house).unwrap(),
        )
        .unwrap();
        fs::create_dir_all(root.join("assets/generated/runtime")).unwrap();
        fs::write(root.join("assets/generated/runtime/marker.txt"), "asset").unwrap();
    }

    #[test]
    fn playtest_current_map_creates_temp_project_without_mutating_source() {
        let source = TempDir::new().unwrap();
        let source_root = source.path().canonicalize().unwrap();
        make_playtest_project(&source_root);
        let original_project = fs::read_to_string(source_root.join("data/project.json")).unwrap();
        let state = read_project_at(&source_root).unwrap();
        let sessions = TempDir::new().unwrap();
        let request = PlaytestSessionRequest {
            mode: "currentMap".into(),
            current_map_id: Some("house".into()),
            selected_event_map_id: None,
            selected_event_id: None,
        };

        let result =
            create_playtest_session_at(sessions.path(), &source_root, &state, request).unwrap();

        assert!(result.success);
        let session_root = PathBuf::from(result.session_root.unwrap());
        let session_project: ProjectData =
            read_json(&session_root.join("data/project.json")).unwrap();
        assert_eq!(session_project.start_map_id, "house");
        assert_eq!(session_project.start_position.x, 0);
        assert_eq!(session_project.start_position.y, 0);
        assert_eq!(session_project.start_position.direction, "down");
        assert!(session_root.join("data/maps/house.json").is_file());
        assert!(session_root
            .join("assets/generated/runtime/marker.txt")
            .is_file());
        assert_eq!(
            fs::read_to_string(source_root.join("data/project.json")).unwrap(),
            original_project
        );
    }

    #[test]
    fn playtest_project_start_preserves_source_start_and_data() {
        let source = TempDir::new().unwrap();
        let source_root = source.path().canonicalize().unwrap();
        make_playtest_project(&source_root);
        let original_project = fs::read_to_string(source_root.join("data/project.json")).unwrap();
        let original_house = fs::read_to_string(source_root.join("data/maps/house.json")).unwrap();
        let state = read_project_at(&source_root).unwrap();
        let sessions = TempDir::new().unwrap();
        let request = PlaytestSessionRequest {
            mode: "projectStart".into(),
            current_map_id: Some("house".into()),
            selected_event_map_id: Some("house".into()),
            selected_event_id: Some("npc_1".into()),
        };

        let result =
            create_playtest_session_at(sessions.path(), &source_root, &state, request).unwrap();

        assert!(result.success);
        let session_root = PathBuf::from(result.session_root.unwrap());
        let session_project: ProjectData =
            read_json(&session_root.join("data/project.json")).unwrap();
        let source_project: ProjectData =
            read_json(&source_root.join("data/project.json")).unwrap();
        assert_eq!(session_project.start_map_id, source_project.start_map_id);
        assert_eq!(
            session_project.start_position.x,
            source_project.start_position.x
        );
        assert_eq!(
            session_project.start_position.y,
            source_project.start_position.y
        );
        assert_eq!(
            session_project.start_position.direction,
            source_project.start_position.direction
        );
        assert!(session_root.join("data/maps/town.json").is_file());
        assert!(session_root.join("data/maps/house.json").is_file());
        assert!(session_root
            .join("assets/generated/runtime/marker.txt")
            .is_file());
        assert_eq!(
            fs::read_to_string(source_root.join("data/project.json")).unwrap(),
            original_project
        );
        assert_eq!(
            fs::read_to_string(source_root.join("data/maps/house.json")).unwrap(),
            original_house
        );
    }

    #[test]
    fn playtest_selected_event_starts_at_event_position() {
        let source = TempDir::new().unwrap();
        let source_root = source.path().canonicalize().unwrap();
        make_playtest_project(&source_root);
        let state = read_project_at(&source_root).unwrap();
        let sessions = TempDir::new().unwrap();
        let request = PlaytestSessionRequest {
            mode: "selectedEvent".into(),
            current_map_id: Some("town".into()),
            selected_event_map_id: Some("house".into()),
            selected_event_id: Some("npc_1".into()),
        };

        let result =
            create_playtest_session_at(sessions.path(), &source_root, &state, request).unwrap();

        let session_root = PathBuf::from(result.session_root.unwrap());
        let session_project: ProjectData =
            read_json(&session_root.join("data/project.json")).unwrap();
        assert_eq!(session_project.start_map_id, "house");
        assert_eq!(session_project.start_position.x, 1);
        assert_eq!(session_project.start_position.y, 0);
        assert_eq!(session_project.start_position.direction, "down");
    }

    #[test]
    fn playtest_session_prunes_older_sessions_beyond_five() {
        let source = TempDir::new().unwrap();
        let source_root = source.path().canonicalize().unwrap();
        make_playtest_project(&source_root);
        let state = read_project_at(&source_root).unwrap();
        let sessions = TempDir::new().unwrap();
        for i in 0..6 {
            fs::create_dir_all(sessions.path().join(format!("session-old-{i}"))).unwrap();
        }

        let result = create_playtest_session_at(
            sessions.path(),
            &source_root,
            &state,
            PlaytestSessionRequest {
                mode: "projectStart".into(),
                current_map_id: None,
                selected_event_map_id: None,
                selected_event_id: None,
            },
        )
        .unwrap();

        assert!(result.success);
        assert!(!result.pruned_session_roots.is_empty());
        let remaining = fs::read_dir(sessions.path()).unwrap().count();
        assert_eq!(remaining, 5);
    }

    #[test]
    fn playtest_session_pruning_preserves_protected_session() {
        let sessions = TempDir::new().unwrap();
        let protected = sessions.path().join("session-0000");
        let older = sessions.path().join("session-old");
        fs::create_dir_all(&protected).unwrap();
        fs::create_dir_all(&older).unwrap();

        let pruned = prune_playtest_sessions(sessions.path(), 1, Some(&protected)).unwrap();

        assert!(protected.is_dir());
        assert!(!older.exists());
        assert_eq!(pruned, vec![older.to_string_lossy().to_string()]);
    }

    #[test]
    fn project_data_serializes_root_parent_id_as_null() {
        let project = ProjectData {
            schema_version: 1,
            title: "T".into(),
            start_map_id: "town".into(),
            start_position: StartPosition {
                x: 0,
                y: 0,
                direction: "down".into(),
            },
            maps: vec![MapReference {
                id: "town".into(),
                path: "data/maps/town.json".into(),
                parent_id: None,
                order: Some(0),
                expanded: Some(true),
            }],
            database: DatabaseRefs {
                items: "data/database/items.json".into(),
                actors: None,
                classes: None,
                skills: None,
                weapons: None,
                armors: None,
                states: None,
                types: None,
                terms: None,
                enemies: None,
                troops: None,
                quests: None,
                shops: None,
                system: None,
                switches: None,
                variables: None,
                common_events: None,
                animations: None,
                tilesets: None,
                audio: None,
            },
            asset_catalog: None,
            visual_profile: None,
        };

        let json = serde_json::to_value(project).unwrap();
        assert!(json["maps"][0].get("parentId").unwrap().is_null());
        assert_eq!(json["maps"][0]["order"], 0);
        assert_eq!(json["maps"][0]["expanded"], true);
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
        let backup_name = backups[0]
            .as_ref()
            .unwrap()
            .file_name()
            .to_string_lossy()
            .to_string();
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
                "weapons": "data/database/weapons.json",
                "armors": "data/database/armors.json",
                "states": "data/database/states.json",
                "types": "data/database/types.json",
                "terms": "data/database/terms.json",
                "system": "data/database/system.json",
                "switches": "data/database/switches.json",
                "animations": "data/database/animations.json",
                "audio": "data/database/audio.json"
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
            root.join("data/database/weapons.json"),
            r#"{"schemaVersion":1,"weapons":[{"id":"iron_sword","name":"Iron Sword"}]}"#,
        )
        .unwrap();
        fs::write(
            root.join("data/database/armors.json"),
            r#"{"schemaVersion":1,"armors":[{"id":"leather_armor","name":"Leather Armor"}]}"#,
        )
        .unwrap();
        fs::write(
            root.join("data/database/states.json"),
            r#"{"schemaVersion":1,"states":[{"id":"poison","name":"Poison"}]}"#,
        )
        .unwrap();
        fs::write(
            root.join("data/database/types.json"),
            r#"{"schemaVersion":1,"weaponTypes":[{"id":"sword","name":"Sword"}],"equipmentSlots":[{"id":"weapon","name":"Weapon"},{"id":"armor","name":"Armor"},{"id":"accessory","name":"Accessory"}]}"#,
        )
        .unwrap();
        fs::write(
            root.join("data/database/terms.json"),
            r#"{"schemaVersion":1,"currencyUnit":"G","stats":{"attack":"Attack"},"menu":{"item":"Item"},"battle":{"fight":"Fight"}}"#,
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
        fs::write(
            root.join("data/database/animations.json"),
            r#"{"schemaVersion":1,"sets":[{"id":"player_adventurer","clips":[{"action":"idle","direction":"down","asset":"player_adventurer_idle_down","frameSize":{"width":64,"height":64},"frameCount":4,"fps":6,"loop":true,"anchor":{"x":32,"y":54}}]}]}"#,
        )
        .unwrap();
        fs::write(
            root.join("data/database/audio.json"),
            r#"{"schemaVersion":1,"audio":{"confirm":"assets/audio/confirm.wav"},"sounds":[{"id":"click","path":"assets/audio/click.wav"}],"bgm":[{"id":"town","path":"assets/audio/town.wav"}]}"#,
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
        assert!(dbs.contains_key("weapons"));
        assert!(dbs.contains_key("armors"));
        assert!(dbs.contains_key("states"));
        assert!(dbs.contains_key("types"));
        assert!(dbs.contains_key("terms"));
        assert!(dbs.contains_key("system"));
        assert!(dbs.contains_key("switches"));
        assert!(dbs.contains_key("animations"));
        assert!(dbs.contains_key("audio"));
        // actors should be unwrapped to the list, not the wrapping object
        let actors = dbs.get("actors").unwrap().as_array().unwrap();
        assert_eq!(actors.len(), 1);
        assert_eq!(actors[0].get("id").unwrap(), "arc");
        let weapons = dbs.get("weapons").unwrap().as_array().unwrap();
        assert_eq!(weapons[0].get("id").unwrap(), "iron_sword");
        let armors = dbs.get("armors").unwrap().as_array().unwrap();
        assert_eq!(armors[0].get("id").unwrap(), "leather_armor");
        let states = dbs.get("states").unwrap().as_array().unwrap();
        assert_eq!(states[0].get("id").unwrap(), "poison");
        let types = dbs.get("types").unwrap().as_object().unwrap();
        assert!(types.get("weaponTypes").unwrap().as_array().unwrap().len() > 0);
        let terms = dbs.get("terms").unwrap().as_object().unwrap();
        assert_eq!(terms.get("currencyUnit").unwrap(), "G");
        // system should be unwrapped to the bare object
        let system = dbs.get("system").unwrap().as_object().unwrap();
        assert_eq!(system.get("startingGold").unwrap(), 50);
        let animations = dbs.get("animations").unwrap().as_object().unwrap();
        assert!(animations.get("sets").unwrap().as_array().unwrap().len() > 0);
        let audio = dbs.get("audio").unwrap().as_object().unwrap();
        assert_eq!(
            audio.get("audio").unwrap().get("confirm").unwrap(),
            "assets/audio/confirm.wav"
        );
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
            let pairs: [(&str, Option<&String>); 19] = [
                ("actors", state.project.database.actors.as_ref()),
                ("classes", state.project.database.classes.as_ref()),
                ("skills", state.project.database.skills.as_ref()),
                ("weapons", state.project.database.weapons.as_ref()),
                ("armors", state.project.database.armors.as_ref()),
                ("states", state.project.database.states.as_ref()),
                ("types", state.project.database.types.as_ref()),
                ("terms", state.project.database.terms.as_ref()),
                ("enemies", state.project.database.enemies.as_ref()),
                ("troops", state.project.database.troops.as_ref()),
                ("quests", state.project.database.quests.as_ref()),
                ("shops", state.project.database.shops.as_ref()),
                ("system", state.project.database.system.as_ref()),
                ("switches", state.project.database.switches.as_ref()),
                ("variables", state.project.database.variables.as_ref()),
                (
                    "commonEvents",
                    state.project.database.common_events.as_ref(),
                ),
                ("animations", state.project.database.animations.as_ref()),
                ("tilesets", state.project.database.tilesets.as_ref()),
                ("audio", state.project.database.audio.as_ref()),
            ];
            for (key, maybe_rel) in pairs {
                let Some(rel) = maybe_rel else { continue };
                let Some(payload) = map.get(key) else {
                    continue;
                };
                let wrapped = if is_object_database_shard(key) {
                    let mut m = serde_json::Map::new();
                    m.insert("schemaVersion".into(), serde_json::Value::from(1));
                    if let serde_json::Value::Object(object_payload) = payload {
                        for (k, v) in object_payload {
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
        let animations = reloaded
            .databases
            .as_object()
            .unwrap()
            .get("animations")
            .unwrap()
            .as_object()
            .unwrap();
        assert!(animations.get("sets").unwrap().is_array());
        let types = reloaded
            .databases
            .as_object()
            .unwrap()
            .get("types")
            .unwrap()
            .as_object()
            .unwrap();
        assert!(types.get("weaponTypes").unwrap().is_array());
        let terms = reloaded
            .databases
            .as_object()
            .unwrap()
            .get("terms")
            .unwrap()
            .as_object()
            .unwrap();
        assert_eq!(terms.get("currencyUnit").unwrap(), "G");
        let audio = reloaded
            .databases
            .as_object()
            .unwrap()
            .get("audio")
            .unwrap()
            .as_object()
            .unwrap();
        assert_eq!(
            audio.get("audio").unwrap().get("confirm").unwrap(),
            "assets/audio/confirm.wav"
        );
    }

    #[test]
    fn write_then_read_round_trips_map_edits() {
        let tmp = TempDir::new().unwrap();
        let root = tmp.path().canonicalize().unwrap();
        make_project(&root);

        let mut state = read_project_at(&root).unwrap();
        let town = state.maps.get_mut("town").unwrap();
        let town_obj = town.as_object_mut().unwrap();
        let layers = town_obj.get_mut("layers").unwrap().as_array_mut().unwrap();
        layers[0].get_mut("tiles").unwrap().as_array_mut().unwrap()[0] = serde_json::Value::from(3);
        town_obj
            .get_mut("events")
            .unwrap()
            .as_array_mut()
            .unwrap()
            .push(serde_json::json!({
                "id": "roundtrip_event",
                "type": "trigger",
                "x": 0,
                "y": 0,
                "solid": false,
                "trigger": "touch",
                "commands": []
            }));

        let mut warnings = Vec::new();
        write_with_backup(
            &root,
            "data/maps/town.json",
            state.maps.get("town").unwrap(),
            &mut warnings,
        )
        .unwrap();

        let reloaded = read_project_at(&root).unwrap();
        let map = reloaded.maps.get("town").unwrap().as_object().unwrap();
        let layers = map.get("layers").unwrap().as_array().unwrap();
        let first_tile = layers[0].get("tiles").unwrap().as_array().unwrap()[0]
            .as_i64()
            .unwrap();
        let events = map.get("events").unwrap().as_array().unwrap();

        assert_eq!(first_tile, 3);
        assert!(events
            .iter()
            .any(|event| event.get("id").and_then(|id| id.as_str()) == Some("roundtrip_event")));
    }
}
