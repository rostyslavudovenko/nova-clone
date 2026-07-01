import type { CloneConfig, JiraIssue, IssueTypeMeta } from "./state";

export interface ValidationError {
  field: string;
  message: string;
}

export function validateCloneConfig(
  config: CloneConfig,
  issue: JiraIssue | null,
  issueTypes: IssueTypeMeta[],
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!config.sourceIssueKey) {
    errors.push({ field: "sourceIssueKey", message: "Source issue key is required" });
  }

  if (!config.targetProjectKey) {
    errors.push({ field: "targetProjectKey", message: "Target project is required" });
  }

  if (!config.targetIssueTypeId) {
    errors.push({ field: "targetIssueTypeId", message: "Target issue type is required" });
  }

  return errors;
}

export function getMissingRequiredFields(
  targetIssueType: IssueTypeMeta | undefined,
  sourceFields: Record<string, unknown> | undefined,
): string[] {
  if (!targetIssueType || !sourceFields) return [];
  const knownFields = new Set(Object.keys(sourceFields));

  return targetIssueType.required_fields.filter((f) => {
    if (knownFields.has(f)) return false;
    if (f === "summary" && sourceFields.summary) return false;
    return true;
  });
}
