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
  #[serde(default)]
  avatar_url: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ConnectionStatus {
  pub connected: bool,
  pub site_url: Option<String>,
  pub email: Option<String>,
  pub avatar_url: Option<String>,
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

  let avatar_url = result["avatarUrls"]["48x48"]
    .as_str()
    .unwrap_or("")
    .to_string();

  save_connection(
    &app,
    &StoredConnection {
      site_url,
      email,
      token,
      avatar_url,
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
      avatar_url: if conn.avatar_url.is_empty() { None } else { Some(conn.avatar_url) },
    }),
    Err(_) => Ok(ConnectionStatus {
      connected: false,
      site_url: None,
      email: None,
      avatar_url: None,
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
  copy_summary: bool,
  copy_description: bool,
  copy_priority: bool,
  custom_field_keys: Vec<String>,
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
    copy_summary,
    copy_description,
    copy_priority,
    custom_field_keys,
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
  chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Secs, true)
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
pub async fn persist_connection(app: AppHandle, mut site_url: String, email: String, token: String, avatar_url: String) -> Result<(), String> {
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
      avatar_url,
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

#[tauri::command]
pub async fn fetch_field_metadata(
  app: AppHandle,
) -> Result<Vec<jira::FieldInfo>, String> {
  let conn = get_connection(&app)?;
  let client = jira::new_client();

  jira::fetch_field_metadata(&client, &conn.site_url, &conn.email, &conn.token).await
}

#[tauri::command]
pub async fn fetch_target_fields(
  app: AppHandle,
  project_key: String,
  issue_type_id: String,
) -> Result<Vec<jira::FieldInfo>, String> {
  let conn = get_connection(&app)?;
  let client = jira::new_client();

  jira::fetch_target_fields(&client, &conn.site_url, &conn.email, &conn.token, &project_key, &issue_type_id).await
}
