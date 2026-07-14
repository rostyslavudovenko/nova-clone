import { invoke } from "@tauri-apps/api/core";
import type { JiraIssue, ProjectSummary, CreatemetaResult, CloneResult } from "./state";

export interface ConnectionStatus {
  connected: boolean;
  site_url?: string;
  email?: string;
  avatar_url?: string;
}

export async function validateConnection(siteUrl: string, email: string, token: string): Promise<void> {
  await invoke("validate_connection", {
    siteUrl,
    email,
    token,
  });
}

export async function getConnectionStatus(): Promise<ConnectionStatus> {
  return invoke<ConnectionStatus>("get_connection_status");
}

export async function disconnect(): Promise<void> {
  await invoke("disconnect");
}

export async function fetchIssue(issueKey: string): Promise<JiraIssue> {
  return invoke<JiraIssue>("fetch_issue", { issueKey });
}

export async function fetchProjects(): Promise<ProjectSummary[]> {
  return invoke<ProjectSummary[]>("fetch_projects");
}

export async function fetchCreatemeta(projectKey: string): Promise<CreatemetaResult> {
  return invoke<CreatemetaResult>("fetch_createmeta", { projectKey });
}

export async function fetchIssueTypeFields(projectKey: string, issueTypeId: string): Promise<string[]> {
  return invoke<string[]>("fetch_issue_type_fields", { projectKey, issueTypeId });
}

export async function cloneIssue(
  sourceIssueKey: string,
  targetProjectKey: string,
  targetIssueTypeId: string,
  copyComments: boolean,
  copyAttachments: boolean,
  copyLinks: boolean,
  copySummary: boolean,
  copyDescription: boolean,
  copyPriority: boolean,
): Promise<CloneResult> {
  return invoke<CloneResult>("clone_issue", {
    sourceIssueKey,
    targetProjectKey,
    targetIssueTypeId,
    copyComments,
    copyAttachments,
    copyLinks,
    copySummary,
    copyDescription,
    copyPriority,
  });
}

export async function getHistory(): Promise<import("./state").HistoryEntry[]> {
  return invoke<import("./state").HistoryEntry[]>("get_history");
}
