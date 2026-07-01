import { describe, it, expect } from "vitest";
import { parseIssueKey } from "./state";

describe("parseIssueKey", () => {
  it("extracts key from plain issue key input", () => {
    expect(parseIssueKey("ABC-123")).toBe("ABC-123");
  });

  it("extracts key from URL", () => {
    expect(parseIssueKey("https://my-site.atlassian.net/browse/PROJ-42")).toBe("PROJ-42");
  });

  it("extracts key from URL with trailing slash", () => {
    expect(parseIssueKey("https://my-site.atlassian.net/browse/TEST-1/")).toBe("TEST-1");
  });

  it("returns trimmed input when no match", () => {
    expect(parseIssueKey("  random text  ")).toBe("random text");
  });

  it("handles empty string", () => {
    expect(parseIssueKey("")).toBe("");
  });

  it("handles lowercase project prefix", () => {
    expect(parseIssueKey("abc-123")).toBe("abc-123");
  });
});
