mod auth;
mod clone;
mod commands;
mod jira;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .plugin(tauri_plugin_store::Builder::default().build())
    .plugin(tauri_plugin_notification::init())
    .plugin(tauri_plugin_shell::init())
    .invoke_handler(tauri::generate_handler![
      commands::validate_connection,
      commands::get_connection_status,
      commands::disconnect,
      commands::fetch_issue,
      commands::fetch_projects,
      commands::fetch_createmeta,
      commands::clone_issue,
      commands::get_history,
      commands::persist_connection,
      commands::fetch_issue_type_fields,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
