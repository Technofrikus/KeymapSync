//! Native file dialogs and file access.
//!
//! The app never supplies raw paths: a file the user picks (or the default
//! configuration) is registered here and handed to the app as an opaque grant.
//! Reading, validating and serializing stays in the shared app.

use serde::Serialize;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};
use tauri_plugin_dialog::DialogExt;

#[derive(Clone, Serialize)]
pub struct Grant {
    id: String,
    kind: String,
    #[serde(rename = "displayPath")]
    display_path: String,
}

#[derive(Default)]
pub struct Grants {
    inner: Mutex<GrantTable>,
}

#[derive(Default)]
struct GrantTable {
    next: u32,
    paths: HashMap<String, PathBuf>,
}

impl Grants {
    fn register(&self, path: PathBuf) -> Result<Grant, String> {
        let mut table = self.inner.lock().map_err(|_| "grant table is poisoned".to_string())?;
        // The same file always gets the same grant.
        if let Some((id, _)) = table.paths.iter().find(|(_, p)| **p == path) {
            return Ok(grant(id.clone(), &path));
        }
        table.next += 1;
        let id = format!("grant-{}", table.next);
        table.paths.insert(id.clone(), path.clone());
        Ok(grant(id, &path))
    }

    fn resolve(&self, id: &str) -> Result<PathBuf, String> {
        let table = self.inner.lock().map_err(|_| "grant table is poisoned".to_string())?;
        table
            .paths
            .get(id)
            .cloned()
            .ok_or_else(|| "This configuration is no longer available. Please pick the file again.".to_string())
    }
}

fn grant(id: String, path: &Path) -> Grant {
    Grant { id, kind: "config".into(), display_path: path.to_string_lossy().into_owned() }
}

/// Write to a temporary file first so a failed write never damages the original.
fn write_atomic(target: &Path, text: &str) -> Result<(), String> {
    if let Some(dir) = target.parent() {
        fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    let mut temporary = target.as_os_str().to_owned();
    temporary.push(format!(".{}.tmp", std::process::id()));
    let temporary = PathBuf::from(temporary);
    fs::write(&temporary, text).map_err(|e| e.to_string())?;
    fs::rename(&temporary, target).map_err(|e| {
        let _ = fs::remove_file(&temporary);
        e.to_string()
    })
}

#[tauri::command]
pub fn app_defaults(app: AppHandle, grants: State<Grants>) -> Result<serde_json::Value, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let grant = grants.register(dir.join("alpha_layers.json"))?;
    Ok(serde_json::json!({ "config": grant }))
}

/// Ask the user for a configuration file. Returns the grant and the file text.
#[tauri::command]
pub async fn config_choose(app: AppHandle, grants: State<'_, Grants>) -> Result<Option<serde_json::Value>, String> {
    let picked = app
        .dialog()
        .file()
        .add_filter("JSON configuration", &["json"])
        .blocking_pick_file();
    let Some(picked) = picked else { return Ok(None) };
    let path = picked.into_path().map_err(|e| e.to_string())?;
    let text = fs::read_to_string(&path)
        .map_err(|e| format!("Could not read {}: {e}", path.display()))?;
    let grant = grants.register(path)?;
    Ok(Some(serde_json::json!({ "grant": grant, "text": text })))
}

/// The grant's text, or null when the file does not exist yet (first run).
#[tauri::command]
pub fn config_read(grant_id: String, grants: State<Grants>) -> Result<Option<serde_json::Value>, String> {
    let path = grants.resolve(&grant_id)?;
    let text = match fs::read_to_string(&path) {
        Ok(text) => Some(text),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => None,
        Err(e) => return Err(format!("Could not read {}: {e}", path.display())),
    };
    Ok(Some(serde_json::json!({ "grant": grant(grant_id, &path), "text": text })))
}

#[tauri::command]
pub fn config_write(grant_id: String, text: String, grants: State<Grants>) -> Result<Grant, String> {
    let path = grants.resolve(&grant_id)?;
    write_atomic(&path, &text)?;
    Ok(grant(grant_id, &path))
}

/// Save a `.vil` backup where the user chooses. Returns the path, or null if cancelled.
#[tauri::command]
pub async fn backup_save(app: AppHandle, suggested_name: String, text: String) -> Result<Option<String>, String> {
    let name = Path::new(&suggested_name)
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .filter(|n| !n.trim().is_empty())
        .ok_or_else(|| "A backup filename is required.".to_string())?;
    let picked = app
        .dialog()
        .file()
        .set_file_name(name)
        .add_filter("Vial Layout", &["vil"])
        .blocking_save_file();
    let Some(picked) = picked else { return Ok(None) };
    let path = picked.into_path().map_err(|e| e.to_string())?;
    write_atomic(&path, &text)?;
    Ok(Some(path.to_string_lossy().into_owned()))
}
