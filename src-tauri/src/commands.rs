use crate::auth;
use crate::clone::{self, CloneConfig, CloneResult};
use crate::jira;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

const STORE_FILE: &str = "nova-clone.json";
const CONNECTION_KEY: &str = "connection";

#[derive(Debug, Serialize, Deserialize, Clone)]
struct StoredConnection {
  site_url: String,
  email: String,
  token: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ConnectionStatus {
  pub connected: bool,
  pub site_url: Option<String>,
  pub email: Option<String>,
}

fn get_connection(app: &AppHandle) -> Result<StoredConnection, String> {
  let store = app
    .store(STORE_FILE)
    .map_err(|e| format!("Store error: {}", e))?;

  let stored = store.get(CONNECTION_KEY);

  match stored {
    Some(val) => serde_json::from_value(val).map_err(|e| format!("Deserialize error: {}", e)),
    None => Err("Not connected".to_string()),
  }
}

fn save_connection(app: &AppHandle, conn: &StoredConnection) -> Result<(), String> {
  let store = app
    .store(STORE_FILE)
    .map_err(|e| format!("Store error: {}", e))?;

  store.set(
    CONNECTION_KEY,
    serde_json::to_value(conn).map_err(|e| format!("Serialize error: {}", e))?,
  );

  store.save().map_err(|e| format!("Store save error: {}", e))?;
  Ok(())
}

fn delete_connection(app: &AppHandle) -> Result<(), String> {
  let store = app
    .store(STORE_FILE)
    .map_err(|e| format!("Store error: {}", e))?;

  store.delete(CONNECTION_KEY);
  store.save().map_err(|e| format!("Store save error: {}", e))?;
  Ok(())
}

#[tauri::command]
pub async fn validate_connection(
  app: AppHandle,
  mut site_url: String,
  email: String,
  token: String,
) -> Result<Value, String> {
  site_url = site_url.trim().to_string();
  if !site_url.starts_with("http://") && !site_url.starts_with("https://") {
    site_url = format!("https://{}", site_url);
  }

  let client = jira::new_client();
  let result = auth::validate_credentials(&client, &site_url, &email, &token).await?;

  save_connection(
    &app,
    &StoredConnection {
      site_url,
      email,
      token,
    },
  )?;

  Ok(result)
}

#[tauri::command]
pub async fn get_connection_status(app: AppHandle) -> Result<ConnectionStatus, String> {
  let conn_result = get_connection(&app);

  match conn_result {
    Ok(conn) => Ok(ConnectionStatus {
      connected: true,
      site_url: Some(conn.site_url),
      email: Some(conn.email),
    }),
    Err(_) => Ok(ConnectionStatus {
      connected: false,
      site_url: None,
      email: None,
    }),
  }
}

#[tauri::command]
pub async fn disconnect(app: AppHandle) -> Result<(), String> {
  delete_connection(&app)?;
  Ok(())
}

#[tauri::command]
pub async fn fetch_issue(
  app: AppHandle,
  issue_key: String,
) -> Result<jira::IssueSummary, String> {
  let conn = get_connection(&app)?;
  let client = jira::new_client();

  jira::fetch_issue(&client, &conn.site_url, &conn.email, &conn.token, &issue_key).await
}

#[tauri::command]
pub async fn fetch_projects(app: AppHandle) -> Result<Vec<jira::ProjectSummary>, String> {
  let conn = get_connection(&app)?;
  let client = jira::new_client();

  jira::fetch_projects(&client, &conn.site_url, &conn.email, &conn.token).await
}

#[tauri::command]
pub async fn fetch_createmeta(
  app: AppHandle,
  project_key: String,
) -> Result<jira::CreatemetaResult, String> {
  let conn = get_connection(&app)?;
  let client = jira::new_client();

  jira::fetch_createmeta(&client, &conn.site_url, &conn.email, &conn.token, &project_key).await
}

#[tauri::command]
pub async fn clone_issue(
  app: AppHandle,
  source_issue_key: String,
  target_project_key: String,
  target_issue_type_id: String,
  copy_comments: bool,
  copy_attachments: bool,
  copy_links: bool,
) -> Result<CloneResult, String> {
  let conn = get_connection(&app)?;
  let client = jira::new_client();

  let config = CloneConfig {
    site_url: conn.site_url.clone(),
    email: conn.email,
    token: conn.token,
    source_issue_key: source_issue_key.clone(),
    target_project_key,
    target_issue_type_id,
    copy_comments,
    copy_attachments,
    copy_links,
  };

  let result = clone::execute_clone(app.clone(), client, config).await?;

  // Save to history
  let store = app
    .store(STORE_FILE)
    .map_err(|e| format!("Store error: {}", e))?;

  let history_key = "clone_history";
  let history_val = store.get(history_key);

  let mut history: Vec<Value> = match history_val {
    Some(val) => serde_json::from_value(val).unwrap_or_default(),
    None => Vec::new(),
  };

  let entry = json!({
    "source_key": source_issue_key,
    "target_key": result.new_issue_key,
    "timestamp": iso_now(),
    "status": "success",
    "comments_copied": result.comments_copied,
    "attachments_copied": result.attachments_copied,
    "link_created": result.link_created,
    "site_url": result.site_url,
  });

  history.insert(0, entry);
  store.set(history_key, json!(history));
  store.save().map_err(|e| format!("Store save error: {}", e))?;

  Ok(result)
}

fn iso_now() -> String {
  let secs = std::time::SystemTime::now()
    .duration_since(std::time::UNIX_EPOCH)
    .unwrap_or_default()
    .as_secs();

  let days = secs / 86400;
  let time_secs = secs % 86400;
  let hours = time_secs / 3600;
  let minutes = (time_secs % 3600) / 60;
  let seconds = time_secs % 60;

  format!(
    "{}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
    1970 + (days / 365) as u64,
    1 + ((days % 365) / 30),
    (days % 30) + 1,
    hours,
    minutes,
    seconds
  )
}

#[tauri::command]
pub async fn get_history(app: AppHandle) -> Result<Vec<Value>, String> {
  let store = app
    .store(STORE_FILE)
    .map_err(|e| format!("Store error: {}", e))?;

  let history_key = "clone_history";
  let history_val = store.get(history_key);

  match history_val {
    Some(val) => Ok(serde_json::from_value(val).unwrap_or_default()),
    None => Ok(Vec::new()),
  }
}

#[tauri::command]
pub async fn persist_connection(app: AppHandle, mut site_url: String, email: String, token: String) -> Result<(), String> {
  site_url = site_url.trim().to_string();
  if !site_url.starts_with("http://") && !site_url.starts_with("https://") {
    site_url = format!("https://{}", site_url);
  }
  save_connection(
    &app,
    &StoredConnection {
      site_url,
      email,
      token,
    },
  )
}

#[tauri::command]
pub async fn fetch_issue_type_fields(
  app: AppHandle,
  project_key: String,
  issue_type_id: String,
) -> Result<Vec<String>, String> {
  let conn = get_connection(&app)?;
  let client = jira::new_client();

  jira::fetch_issue_type_fields(&client, &conn.site_url, &conn.email, &conn.token, &project_key, &issue_type_id).await
}
