use reqwest::Client;

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

pub async fn validate_credentials(
  client: &Client,
  site_url: &str,
  email: &str,
  token: &str,
) -> Result<serde_json::Value, String> {
  let mut formatted_url = site_url.trim().to_string();
  if !formatted_url.starts_with("http://") && !formatted_url.starts_with("https://") {
    formatted_url = format!("https://{}", formatted_url);
  }
  let url = format!("{}/rest/api/3/myself", formatted_url.trim_end_matches('/'));
  let auth_header = basic_auth(email, token);

  let resp = client
    .get(&url)
    .header("Authorization", auth_header)
    .header("Accept", "application/json")
    .send()
    .await
    .map_err(|e| format!("Network error: {}", e))?;

  let status = resp.status();
  if !status.is_success() {
    let text = resp.text().await.unwrap_or_default();
    let body: serde_json::Value = serde_json::from_str(&text).unwrap_or_default();
    let msg = body
      .get("errorMessages")
      .and_then(|a| a.as_array())
      .and_then(|a| a.first())
      .and_then(|v| v.as_str())
      .unwrap_or_else(|| body.get("message").and_then(|v| v.as_str()).unwrap_or(&text));
    return Err(format!("Authentication failed ({}): {}", status.as_u16(), msg));
  }

  let body: serde_json::Value = resp
    .json()
    .await
    .map_err(|e| format!("Failed to parse response: {}", e))?;

  Ok(body)
}


