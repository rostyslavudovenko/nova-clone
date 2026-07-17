import { describe, it, expect } from "vitest";
import { validateCloneConfig, getMissingRequiredFields } from "./validate";
import type { CloneConfig, IssueTypeMeta } from "./state";

describe("validateCloneConfig", () => {
  it("returns no errors for valid config with issue", () => {
    const config: CloneConfig = {
      sourceIssueKey: "ABC-123",
      targetProjectKey: "PROJ",
      targetIssueTypeId: "10001",
      copyComments: true,
      copyAttachments: false,
      copyLinks: true,
    };

    const errors = validateCloneConfig(config, null, []);
    expect(errors).toHaveLength(0);
  });

  it("returns error for missing source key", () => {
    const config: CloneConfig = {
      sourceIssueKey: "",
      targetProjectKey: "PROJ",
      targetIssueTypeId: "10001",
      copyComments: true,
      copyAttachments: false,
      copyLinks: true,
    };

    const errors = validateCloneConfig(config, null, []);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].field).toBe("sourceIssueKey");
  });

  it("returns error for missing target project", () => {
    const config: CloneConfig = {
      sourceIssueKey: "ABC-123",
      targetProjectKey: "",
      targetIssueTypeId: "10001",
      copyComments: true,
      copyAttachments: false,
      copyLinks: true,
    };

    const errors = validateCloneConfig(config, null, []);
    expect(errors.some((e) => e.field === "targetProjectKey")).toBe(true);
  });

  it("returns error for missing target issue type", () => {
    const config: CloneConfig = {
      sourceIssueKey: "ABC-123",
      targetProjectKey: "PROJ",
      targetIssueTypeId: "",
      copyComments: true,
      copyAttachments: false,
      copyLinks: true,
    };

    const errors = validateCloneConfig(config, null, []);
    expect(errors.some((e) => e.field === "targetIssueTypeId")).toBe(true);
  });
});

describe("getMissingRequiredFields", () => {
  it("returns empty when no missing fields", () => {
    const issueType: IssueTypeMeta = {
      id: "10001",
      name: "Task",
      required_fields: ["summary", "description"],
    };

    const sourceFields = {
      summary: "Test",
      description: "Desc",
      priority: { id: "1" },
    };

    expect(getMissingRequiredFields(issueType, sourceFields)).toEqual([]);
  });

  // custom fields not present in source should be flagged as missing
  it("includes customfield in missing list if not present in source", () => {
    const issueType: IssueTypeMeta = {
      id: "10001",
      name: "Task",
      required_fields: ["summary", "customfield_10000"],
    };

    const sourceFields = {
      summary: "Test",
    };

    const missing = getMissingRequiredFields(issueType, sourceFields);
    expect(missing).toEqual(["customfield_10000"]);
  });

  it("returns missing fields", () => {
    const issueType: IssueTypeMeta = {
      id: "10001",
      name: "Task",
      required_fields: ["summary", "duedate", "priority"],
    };

    const sourceFields = {
      summary: "Test",
    };

    const missing = getMissingRequiredFields(issueType, sourceFields);
    expect(missing).toEqual(["duedate", "priority"]);
  });
});
