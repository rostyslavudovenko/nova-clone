use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;

fn basic_auth(email: &str, token: &str) -> String {
  let credentials = format!("{}:{}", email, token);
  let encoded = base64_encode(credentials.as_bytes());
  format!("Basic {}", encoded)
}

fn base64_encode(input: &[u8]) -> String {
  const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let mut result = String::new();
  for chunk in input.chunks(3) {
    let b0 = chunk[0] as u32;
    let b1 = chunk.get(1).copied().unwrap_or(0) as u32;
    let b2 = chunk.get(2).copied().unwrap_or(0) as u32;
    let triple = (b0 << 16) | (b1 << 8) | b2;
    result.push(CHARS[((triple >> 18) & 0x3F) as usize] as char);
    result.push(CHARS[((triple >> 12) & 0x3F) as usize] as char);
    if chunk.len() > 1 {
      result.push(CHARS[((triple >> 6) & 0x3F) as usize] as char);
    } else {
      result.push('=');
    }
    if chunk.len() > 2 {
      result.push(CHARS[(triple & 0x3F) as usize] as char);
    } else {
      result.push('=');
    }
  }
  result
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct IssueSummary {
  pub key: String,
  pub summary: String,
  pub issue_type: String,
  pub status: String,
  pub project: String,
  pub project_key: String,
  pub reporter: Option<String>,
  pub assignee: Option<String>,
  pub fields: Value,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProjectSummary {
  pub key: String,
  pub name: String,
  pub id: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct IssueTypeMeta {
  pub id: String,
  pub name: String,
  pub required_fields: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CreatemetaResult {
  pub issue_types: Vec<IssueTypeMeta>,
}

pub fn new_client() -> Client {
  Client::builder()
    .user_agent("nova-clone/0.1.0")
    .build()
    .expect("Failed to create HTTP client")
}

pub async fn fetch_issue(
  client: &Client,
  site_url: &str,
  email: &str,
  token: &str,
  issue_key: &str,
) -> Result<IssueSummary, String> {
  let url = format!(
    "{}/rest/api/3/issue/{}",
    site_url.trim_end_matches('/'),
    issue_key
  );
  let auth_header = basic_auth(email, token);

  let resp = client
    .get(&url)
    .header("Authorization", &auth_header)
    .header("Accept", "application/json")
    .send()
    .await
    .map_err(|e| format!("Network error: {}", e))?;

  if !resp.status().is_success() {
    return Err(format!("Failed to fetch issue: {}", extract_error(resp).await));
  }

  let body: Value = resp
    .json()
    .await
    .map_err(|e| format!("Failed to parse response: {}", e))?;

  let fields = body
    .get("fields")
    .ok_or_else(|| "Missing fields in response".to_string())?;
  let summary = fields
    .get("summary")
    .and_then(|v| v.as_str())
    .unwrap_or("")
    .to_string();
  let issue_type = fields
    .get("issuetype")
    .and_then(|v| v.get("name"))
    .and_then(|v| v.as_str())
    .unwrap_or("Unknown")
    .to_string();
  let status = fields
    .get("status")
    .and_then(|v| v.get("name"))
    .and_then(|v| v.as_str())
    .unwrap_or("Unknown")
    .to_string();
  let project = fields
    .get("project")
    .and_then(|v| v.get("name"))
    .and_then(|v| v.as_str())
    .unwrap_or("")
    .to_string();
  let project_key = fields
    .get("project")
    .and_then(|v| v.get("key"))
    .and_then(|v| v.as_str())
    .unwrap_or("")
    .to_string();
  let reporter = fields
    .get("reporter")
    .and_then(|v| v.get("displayName"))
    .and_then(|v| v.as_str())
    .map(|s| s.to_string());
  let assignee = fields
    .get("assignee")
    .and_then(|v| v.get("displayName"))
    .and_then(|v| v.as_str())
    .map(|s| s.to_string());
  let key = body
    .get("key")
    .and_then(|v| v.as_str())
    .unwrap_or("")
    .to_string();

  Ok(IssueSummary {
    key,
    summary,
    issue_type,
    status,
    project,
    project_key,
    reporter,
    assignee,
    fields: fields.clone(),
  })
}

pub async fn fetch_projects(
  client: &Client,
  site_url: &str,
  email: &str,
  token: &str,
) -> Result<Vec<ProjectSummary>, String> {
  let base_url = format!("{}/rest/api/3/project/search", site_url.trim_end_matches('/'));
  let auth_header = basic_auth(email, token);
  let mut all_projects = Vec::new();
  let mut start_at: u32 = 0;
  let page_size: u32 = 50;

  loop {
    let url = format!("{}?startAt={}&maxResults={}", base_url, start_at, page_size);
    let resp = client
      .get(&url)
      .header("Authorization", &auth_header)
      .header("Accept", "application/json")
      .send()
      .await
      .map_err(|e| format!("Network error: {}", e))?;

    if !resp.status().is_success() {
      break;
    }

    let body: Value = resp
      .json()
      .await
      .map_err(|e| format!("Failed to parse response: {}", e))?;

    let values = match body.get("values").and_then(|v| v.as_array()) {
      Some(arr) => arr,
      None => break,
    };

    for v in values {
      all_projects.push(ProjectSummary {
        key: v.get("key").and_then(|k| k.as_str()).unwrap_or("").to_string(),
        name: v.get("name").and_then(|n| n.as_str()).unwrap_or("").to_string(),
        id: v.get("id").and_then(|i| i.as_str()).unwrap_or("").to_string(),
      });
    }

    let total = body.get("total").and_then(|t| t.as_u64()).unwrap_or(0) as u32;
    start_at += page_size;
    if start_at >= total || values.is_empty() {
      break;
    }
  }

  if !all_projects.is_empty() {
    return Ok(all_projects);
  }

  // Fallback to legacy endpoint /rest/api/3/project
  let fallback_url = format!("{}/rest/api/3/project", site_url.trim_end_matches('/'));

  let resp = client
    .get(&fallback_url)
    .header("Authorization", &auth_header)
    .header("Accept", "application/json")
    .send()
    .await
    .map_err(|e| format!("Network error: {}", e))?;

  if !resp.status().is_success() {
    return Err(format!("Failed to fetch projects: {}", extract_error(resp).await));
  }

  let body: Value = resp
    .json()
    .await
    .map_err(|e| format!("Failed to parse response: {}", e))?;

  if let Some(arr) = body.as_array() {
    let projects = arr
      .iter()
      .map(|v| ProjectSummary {
        key: v.get("key").and_then(|k| k.as_str()).unwrap_or("").to_string(),
        name: v.get("name").and_then(|n| n.as_str()).unwrap_or("").to_string(),
        id: v.get("id").and_then(|i| i.as_str()).unwrap_or("").to_string(),
      })
      .collect();
    Ok(projects)
  } else {
    Err("Invalid response format from projects endpoint".to_string())
  }
}

pub async fn fetch_createmeta(
  client: &Client,
  site_url: &str,
  email: &str,
  token: &str,
  project_key: &str,
) -> Result<CreatemetaResult, String> {
  let new_url = format!(
    "{}/rest/api/3/issue/createmeta/{}/issuetypes",
    site_url.trim_end_matches('/'),
    project_key
  );
  let auth_header = basic_auth(email, token);

  let resp = client
    .get(&new_url)
    .header("Authorization", &auth_header)
    .header("Accept", "application/json")
    .send()
    .await
    .map_err(|e| format!("Network error: {}", e))?;

  if resp.status().is_success() {
    let body: Value = resp
      .json()
      .await
      .map_err(|e| format!("Failed to parse response: {}", e))?;

    if let Some(values) = body.get("values").and_then(|v| v.as_array()) {
      let issue_types = values
        .iter()
        .map(|it| {
          let id = it.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
          let name = it.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string();
          IssueTypeMeta {
            id,
            name,
            required_fields: Vec::new(),
          }
        })
        .collect();
      return Ok(CreatemetaResult { issue_types });
    }
  }

  // Fallback to legacy endpoint
  let url = format!(
    "{}/rest/api/3/issue/createmeta?projectKeys={}&expand=projects.issuetypes.fields",
    site_url.trim_end_matches('/'),
    project_key
  );

  let resp = client
    .get(&url)
    .header("Authorization", &auth_header)
    .header("Accept", "application/json")
    .send()
    .await
    .map_err(|e| format!("Network error: {}", e))?;

  if !resp.status().is_success() {
    return Err(format!("Failed to fetch createmeta: {}", extract_error(resp).await));
  }

  let body: Value = resp
    .json()
    .await
    .map_err(|e| format!("Failed to parse response: {}", e))?;

  let projects = body
    .get("projects")
    .and_then(|p| p.as_array())
    .ok_or_else(|| "Missing projects in createmeta response".to_string())?;

  let project = projects
    .first()
    .ok_or_else(|| "No project found in createmeta".to_string())?;

  let issue_types_arr = project
    .get("issuetypes")
    .and_then(|t| t.as_array())
    .ok_or_else(|| "Missing issuetypes in createmeta".to_string())?;

  let mut result = Vec::new();
  for it in issue_types_arr {
    let id = it.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let name = it.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string();

    let mut required_fields = Vec::new();
    if let Some(fields) = it.get("fields").and_then(|f| f.as_object()) {
      for (field_name, field_spec) in fields {
        if field_spec
          .get("required")
          .and_then(|r| r.as_bool())
          .unwrap_or(false)
        {
          if !field_name.starts_with("customfield_") {
            required_fields.push(field_name.clone());
          }
        }
      }
    }

    result.push(IssueTypeMeta {
      id,
      name,
      required_fields,
    });
  }

  Ok(CreatemetaResult {
    issue_types: result,
  })
}

pub async fn fetch_issue_type_fields(
  client: &Client,
  site_url: &str,
  email: &str,
  token: &str,
  project_key: &str,
  issue_type_id: &str,
) -> Result<Vec<String>, String> {
  let url = format!(
    "{}/rest/api/3/issue/createmeta/{}/issuetypes/{}",
    site_url.trim_end_matches('/'),
    project_key,
    issue_type_id
  );
  let auth_header = basic_auth(email, token);

  let resp = client
    .get(&url)
    .header("Authorization", &auth_header)
    .header("Accept", "application/json")
    .send()
    .await
    .map_err(|e| format!("Network error: {}", e))?;

  if !resp.status().is_success() {
    return Err(format!("Failed to fetch issue type fields: {}", extract_error(resp).await));
  }

  let body: Value = resp
    .json()
    .await
    .map_err(|e| format!("Failed to parse response: {}", e))?;

  let mut required_fields = Vec::new();
  if let Some(fields) = body.get("fields").and_then(|f| f.as_object()) {
    for (field_name, field_spec) in fields {
      if field_spec
        .get("required")
        .and_then(|r| r.as_bool())
        .unwrap_or(false)
      {
        if !field_name.starts_with("customfield_") {
          required_fields.push(field_name.clone());
        }
      }
    }
  }

  Ok(required_fields)
}

pub async fn create_issue(
  client: &Client,
  site_url: &str,
  email: &str,
  token: &str,
  fields: Value,
) -> Result<String, String> {
  let url = format!(
    "{}/rest/api/3/issue",
    site_url.trim_end_matches('/')
  );
  let auth_header = basic_auth(email, token);

  let payload = serde_json::json!({ "fields": fields });

  let resp = client
    .post(&url)
    .header("Authorization", &auth_header)
    .header("Accept", "application/json")
    .header("Content-Type", "application/json")
    .json(&payload)
    .send()
    .await
    .map_err(|e| format!("Network error: {}", e))?;

  if !resp.status().is_success() {
    return Err(format!("Failed to create issue: {}", extract_error(resp).await));
  }

  let body: Value = resp
    .json()
    .await
    .map_err(|e| format!("Failed to parse response: {}", e))?;

  body
    .get("key")
    .and_then(|v| v.as_str())
    .map(|s| s.to_string())
    .ok_or_else(|| "Missing issue key in response".to_string())
}

pub async fn get_comments(
  client: &Client,
  site_url: &str,
  email: &str,
  token: &str,
  issue_key: &str,
) -> Result<Vec<Value>, String> {
  let url = format!(
    "{}/rest/api/3/issue/{}/comment",
    site_url.trim_end_matches('/'),
    issue_key
  );
  let auth_header = basic_auth(email, token);

  let resp = client
    .get(&url)
    .header("Authorization", &auth_header)
    .header("Accept", "application/json")
    .send()
    .await
    .map_err(|e| format!("Network error: {}", e))?;

  if !resp.status().is_success() {
    return Err(format!("Failed to fetch comments: {}", extract_error(resp).await));
  }

  let body: Value = resp
    .json()
    .await
    .map_err(|e| format!("Failed to parse response: {}", e))?;

  let comments = body
    .get("comments")
    .and_then(|c| c.as_array())
    .cloned()
    .unwrap_or_default();

  Ok(comments)
}

pub async fn add_comment(
  client: &Client,
  site_url: &str,
  email: &str,
  token: &str,
  issue_key: &str,
  body_content: Value,
) -> Result<(), String> {
  let url = format!(
    "{}/rest/api/3/issue/{}/comment",
    site_url.trim_end_matches('/'),
    issue_key
  );
  let auth_header = basic_auth(email, token);

  let payload = serde_json::json!({ "body": body_content });

  let resp = client
    .post(&url)
    .header("Authorization", &auth_header)
    .header("Accept", "application/json")
    .header("Content-Type", "application/json")
    .json(&payload)
    .send()
    .await
    .map_err(|e| format!("Network error: {}", e))?;

  if !resp.status().is_success() {
    return Err(format!("Failed to add comment: {}", extract_error(resp).await));
  }

  Ok(())
}

pub async fn get_attachments(
  client: &Client,
  site_url: &str,
  email: &str,
  token: &str,
  issue_key: &str,
) -> Result<Vec<Value>, String> {
  let url = format!(
    "{}/rest/api/3/issue/{}?fields=attachment",
    site_url.trim_end_matches('/'),
    issue_key
  );
  let auth_header = basic_auth(email, token);

  let resp = client
    .get(&url)
    .header("Authorization", &auth_header)
    .header("Accept", "application/json")
    .send()
    .await
    .map_err(|e| format!("Network error: {}", e))?;

  if !resp.status().is_success() {
    return Err(format!("Failed to fetch attachments: {}", extract_error(resp).await));
  }

  let body: Value = resp
    .json()
    .await
    .map_err(|e| format!("Failed to parse response: {}", e))?;

  let attachments = body
    .get("fields")
    .and_then(|f| f.get("attachment"))
    .and_then(|a| a.as_array())
    .cloned()
    .unwrap_or_default();

  Ok(attachments)
}

pub async fn download_attachment(
  client: &Client,
  email: &str,
  token: &str,
  content_url: &str,
) -> Result<Vec<u8>, String> {
  let auth_header = basic_auth(email, token);

  let resp = client
    .get(content_url)
    .header("Authorization", &auth_header)
    .send()
    .await
    .map_err(|e| format!("Network error downloading attachment: {}", e))?;

  if !resp.status().is_success() {
    return Err(format!("Failed to download attachment: {}", extract_error(resp).await));
  }

  resp
    .bytes()
    .await
    .map(|b| b.to_vec())
    .map_err(|e| format!("Failed to read attachment bytes: {}", e))
}

pub async fn upload_attachment(
  client: &Client,
  site_url: &str,
  email: &str,
  token: &str,
  issue_key: &str,
  filename: &str,
  mime_type: &str,
  data: Vec<u8>,
) -> Result<(), String> {
  let url = format!(
    "{}/rest/api/3/issue/{}/attachments",
    site_url.trim_end_matches('/'),
    issue_key
  );
  let auth_header = basic_auth(email, token);

  let part = reqwest::multipart::Part::bytes(data)
    .file_name(filename.to_string())
    .mime_str(mime_type)
    .map_err(|e| format!("Invalid MIME type: {}", e))?;

  let form = reqwest::multipart::Form::new().part("file", part);

  let resp = client
    .post(&url)
    .header("Authorization", &auth_header)
    .header("X-Atlassian-Token", "no-check")
    .multipart(form)
    .send()
    .await
    .map_err(|e| format!("Network error uploading attachment: {}", e))?;

  if !resp.status().is_success() {
    return Err(format!("Failed to upload attachment: {}", extract_error(resp).await));
  }

  Ok(())
}

pub async fn link_issues(
  client: &Client,
  site_url: &str,
  email: &str,
  token: &str,
  source_key: &str,
  new_key: &str,
) -> Result<(), String> {
  let url = format!(
    "{}/rest/api/3/issueLink",
    site_url.trim_end_matches('/')
  );
  let auth_header = basic_auth(email, token);

  let payload = serde_json::json!({
    "type": { "name": "Relates" },
    "inwardIssue": { "key": new_key },
    "outwardIssue": { "key": source_key }
  });

  let resp = client
    .post(&url)
    .header("Authorization", &auth_header)
    .header("Accept", "application/json")
    .header("Content-Type", "application/json")
    .json(&payload)
    .send()
    .await
    .map_err(|e| format!("Network error: {}", e))?;

  if !resp.status().is_success() {
    return Err(format!("Failed to link issues: {}", extract_error(resp).await));
  }

  Ok(())
}

async fn extract_error(resp: reqwest::Response) -> String {
  let status = resp.status();
  let text = resp.text().await.unwrap_or_default();
  if let Ok(body) = serde_json::from_str::<Value>(&text) {
    if let Some(msg) = body
      .get("errorMessages")
      .and_then(|a| a.as_array())
      .and_then(|a| a.first())
      .and_then(|v| v.as_str())
    {
      return format!("{} (Status {})", msg, status.as_u16());
    }
    if let Some(msg) = body.get("message").and_then(|v| v.as_str()) {
      return format!("{} (Status {})", msg, status.as_u16());
    }
    if let Some(errors) = body.get("errors").and_then(|e| e.as_object()) {
      let err_list: Vec<String> = errors
        .iter()
        .map(|(k, v)| format!("{}: {}", k, v.as_str().unwrap_or("")))
        .collect();
      if !err_list.is_empty() {
        return format!("{} (Status {})", err_list.join(", "), status.as_u16());
      }
    }
  }
  if text.trim().is_empty() {
    format!("HTTP Error {}", status.as_u16())
  } else {
    let truncated = if text.len() > 200 { &text[..200] } else { &text };
    format!("{} (Status {})", truncated, status.as_u16())
  }
}
