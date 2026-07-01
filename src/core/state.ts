export interface ConnectionConfig {
  siteUrl: string;
  email: string;
}

export interface JiraIssue {
  key: string;
  summary: string;
  issue_type: string;
  status: string;
  project: string;
  project_key: string;
  reporter: string | null;
  assignee: string | null;
  fields: Record<string, unknown>;
}

export interface ProjectSummary {
  key: string;
  name: string;
  id: string;
}

export interface IssueTypeMeta {
  id: string;
  name: string;
  required_fields: string[];
}

export interface CreatemetaResult {
  issue_types: IssueTypeMeta[];
}

export interface CloneConfig {
  sourceIssueKey: string;
  targetProjectKey: string;
  targetIssueTypeId: string;
  copyComments: boolean;
  copyAttachments: boolean;
  copyLinks: boolean;
}

export interface CloneResult {
  new_issue_key: string;
  comments_copied: number;
  attachments_copied: number;
  link_created: boolean;
  site_url: string;
}

export interface ProgressEvent {
  step: string;
  status: string;
  current?: number;
  total?: number;
  message?: string;
}

export interface HistoryEntry {
  source_key: string;
  target_key: string;
  timestamp: string;
  status: string;
  comments_copied?: number;
  attachments_copied?: number;
  link_created?: boolean;
  site_url?: string;
}

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";
export type ClonePhase = "idle" | "preview" | "configuring" | "cloning" | "complete" | "error";

export function parseIssueKey(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/[A-Z][A-Z0-9]+-\d+/);
  if (match) return match[0];
  const urlMatch = trimmed.match(/\/browse\/([A-Z][A-Z0-9]+-\d+)/);
  if (urlMatch) return urlMatch[1];
  return trimmed;
}
