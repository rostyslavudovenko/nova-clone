use crate::jira;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, Emitter};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CloneConfig {
  pub site_url: String,
  pub email: String,
  pub token: String,
  pub source_issue_key: String,
  pub target_project_key: String,
  pub target_issue_type_id: String,
  pub copy_comments: bool,
  pub copy_attachments: bool,
  pub copy_links: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CloneResult {
  pub new_issue_key: String,
  pub comments_copied: usize,
  pub attachments_copied: usize,
  pub link_created: bool,
  pub site_url: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProgressEvent {
  pub step: String,
  pub status: String,
  pub current: Option<usize>,
  pub total: Option<usize>,
  pub message: Option<String>,
}

fn emit_progress(app: &AppHandle, step: &str, status: &str, current: Option<usize>, total: Option<usize>, message: Option<String>) {
  let _ = app.emit(
    "clone-progress",
    ProgressEvent {
      step: step.to_string(),
      status: status.to_string(),
      current,
      total,
      message,
    },
  );
}

fn is_rank_field(value: &Value) -> bool {
  if let Some(obj) = value.as_object() {
    return obj.iter().any(|(k, _)| {
      matches!(
        k.as_str(),
        "rankAfter"
          | "rankBefore"
          | "rankAfterIssue"
          | "rankBeforeIssue"
          | "rankCustomFieldId"
          | "rankSortOrder"
      )
    });
  }
  false
}

fn is_entity_reference(value: &Value) -> bool {
  value.as_object().is_some_and(|obj| obj.contains_key("self"))
}

fn is_rank_string(value: &Value) -> bool {
  value.as_str().is_some_and(|s| s.starts_with("0|"))
}

fn is_empty_value(value: &Value) -> bool {
  match value {
    Value::String(s) => s.is_empty() || s == "{}",
    Value::Number(n) => n.as_f64() == Some(0.0),
    Value::Array(a) => a.is_empty(),
    _ => false,
  }
}

fn is_user_array(value: &Value) -> bool {
  value.as_array().is_some_and(|arr| {
    arr.iter()
      .any(|v| v.as_object().is_some_and(|o| o.contains_key("self")))
  })
}

fn is_system_field(name: &str) -> bool {
  matches!(
    name,
    "id"
      | "key"
      | "created"
      | "updated"
      | "status"
      | "project"
      | "issuetype"
      | "creator"
      | "reporter"
      | "assignee"
      | "comment"
      | "attachment"
      | "issuelinks"
      | "subtasks"
      | "worklog"
      | "watches"
      | "votes"
      | "lastViewed"
      | "aggregateprogress"
      | "progress"
      | "timespent"
      | "timeestimate"
      | "timetracking"
      | "workratio"
      | "resolution"
      | "resolutiondate"
      | "duedate"
      | "security"
      | "environment"
      | "description"
      | "parent"
      | "sprint"
      | "flagged"
      | "aggregatetimespent"
      | "aggregatetimeestimate"
      | "timeoriginalestimate"
      | "components"
      | "fixVersions"
      | "versions"
  )
}

fn transform_fields(
  source_fields: &Value,
  target_project_key: &str,
  target_issue_type_id: &str,
) -> Value {
  let mut fields = serde_json::Map::new();

  fields.insert(
    "project".to_string(),
    serde_json::json!({ "key": target_project_key }),
  );
  fields.insert(
    "issuetype".to_string(),
    serde_json::json!({ "id": target_issue_type_id }),
  );

  if let Some(obj) = source_fields.as_object() {
    for (key, value) in obj {
      if is_system_field(key) {
        continue;
      }
      if key.starts_with("customfield_") {
        if value.is_null()
          || is_empty_value(value)
          || is_rank_field(value)
          || is_entity_reference(value)
          || is_rank_string(value)
          || is_user_array(value)
        {
          continue;
        }
        fields.insert(key.clone(), value.clone());
      }
    }

    // Copy summary and description
    if let Some(summary) = obj.get("summary") {
      fields.insert("summary".to_string(), summary.clone());
    }
    if let Some(desc) = obj.get("description") {
      fields.insert("description".to_string(), desc.clone());
    }
    if let Some(priority) = obj.get("priority") {
      if let Some(p) = priority.get("id") {
        fields.insert("priority".to_string(), serde_json::json!({ "id": p }));
      }
    }
  }

  Value::Object(fields)
}

pub async fn execute_clone(
  app: AppHandle,
  client: Client,
  config: CloneConfig,
) -> Result<CloneResult, String> {
  emit_progress(&app, "fetching_source", "progress", None, None, None);

  let source = jira::fetch_issue(
    &client,
    &config.site_url,
    &config.email,
    &config.token,
    &config.source_issue_key,
  )
  .await?;

  emit_progress(
    &app,
    "fetching_source",
    "success",
    None,
    None,
    Some(format!("Fetched {}", config.source_issue_key)),
  );

  emit_progress(&app, "creating_issue", "progress", None, None, None);

  let fields = transform_fields(
    &source.fields,
    &config.target_project_key,
    &config.target_issue_type_id,
  );

  let new_key = jira::create_issue(
    &client,
    &config.site_url,
    &config.email,
    &config.token,
    fields,
  )
  .await?;

  emit_progress(
    &app,
    "creating_issue",
    "success",
    None,
    None,
    Some(format!("Created {}", new_key)),
  );

  let mut comments_copied = 0;
  if config.copy_comments {
    emit_progress(&app, "copying_comments", "progress", Some(0), None, None);

    let comments =
      jira::get_comments(&client, &config.site_url, &config.email, &config.token, &config.source_issue_key)
        .await?;
    let total = comments.len();

    for (i, comment) in comments.iter().enumerate() {
      emit_progress(
        &app,
        "copying_comments",
        "progress",
        Some(i),
        Some(total),
        None,
      );

      if let Some(body) = comment.get("body") {
        jira::add_comment(
          &client,
          &config.site_url,
          &config.email,
          &config.token,
          &new_key,
          body.clone(),
        )
        .await?;
        comments_copied += 1;
      }
    }

    emit_progress(
      &app,
      "copying_comments",
      "success",
      Some(comments_copied),
      Some(total),
      if comments_copied == total {
        None
      } else {
        Some(format!("Copied {}/{} comments", comments_copied, total))
      },
    );
  }

  let mut attachments_copied = 0;
  if config.copy_attachments {
    emit_progress(
      &app,
      "copying_attachments",
      "progress",
      Some(0),
      None,
      None,
    );

    let attachments = jira::get_attachments(
      &client,
      &config.site_url,
      &config.email,
      &config.token,
      &config.source_issue_key,
    )
    .await?;
    let total = attachments.len();

    for (i, attachment) in attachments.iter().enumerate() {
      emit_progress(
        &app,
        "copying_attachments",
        "progress",
        Some(i),
        Some(total),
        None,
      );

      let content_url = attachment
        .get("content")
        .and_then(|c| c.as_str())
        .ok_or("Missing attachment content URL")?;
      let filename = attachment
        .get("filename")
        .and_then(|f| f.as_str())
        .unwrap_or("unnamed");
      let mime_type = attachment
        .get("mimeType")
        .and_then(|m| m.as_str())
        .unwrap_or("application/octet-stream");

      let data = jira::download_attachment(&client, &config.email, &config.token, content_url).await?;

      jira::upload_attachment(
        &client,
        &config.site_url,
        &config.email,
        &config.token,
        &new_key,
        filename,
        mime_type,
        data,
      )
      .await?;

      attachments_copied += 1;
    }

    emit_progress(
      &app,
      "copying_attachments",
      "success",
      Some(attachments_copied),
      Some(total),
      if attachments_copied == total {
        None
      } else {
        Some(format!("Copied {}/{} attachments", attachments_copied, total))
      },
    );
  }

  let mut link_created = false;
  if config.copy_links {
    emit_progress(&app, "linking_issues", "progress", None, None, None);

    jira::link_issues(
      &client,
      &config.site_url,
      &config.email,
      &config.token,
      &config.source_issue_key,
      &new_key,
    )
    .await?;

    link_created = true;

    emit_progress(&app, "linking_issues", "success", None, None, None);
  }

  let result = CloneResult {
    new_issue_key: new_key.clone(),
    comments_copied,
    attachments_copied,
    link_created,
    site_url: config.site_url.clone(),
  };

  emit_progress(
    &app,
    "complete",
    "success",
    None,
    None,
    Some(format!("Clone complete: {}", new_key)),
  );

  Ok(result)
}
