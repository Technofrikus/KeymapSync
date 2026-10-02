// Hides the extra console window on Windows release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod files;
mod hid;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(files::Grants::default())
        .manage(hid::Keyboards::default())
        .invoke_handler(tauri::generate_handler![
            hid::hid_list,
            hid::hid_exchange,
            files::app_defaults,
            files::config_choose,
            files::config_read,
            files::config_write,
            files::backup_save,
        ])
        .run(tauri::generate_context!())
        .expect("error while running KeymapSync");
}
