import { describe, it, expect, vi, afterEach } from "vitest";
import { store } from "./store";

describe("store", () => {
  afterEach(() => {
    store.reset();
  });

  it("starts in disconnected state", () => {
    expect(store.state.connectionStatus).toBe("disconnected");
    expect(store.state.connection).toBeNull();
  });

  it("sets connection status and notifies", () => {
    const listener = vi.fn();
    store.subscribe(listener);

    store.setConnectionStatus("connected");
    expect(store.state.connectionStatus).toBe("connected");
    expect(listener).toHaveBeenCalledOnce();
  });

  it("sets connection config", () => {
    const config = { siteUrl: "https://test.atlassian.net", email: "a@b.com" };
    store.setConnection(config);
    expect(store.state.connection).toEqual(config);
  });

  it("sets connect error", () => {
    store.setConnectError("Invalid token");
    expect(store.state.connectError).toBe("Invalid token");
  });

  it("sets current issue and notifies", () => {
    const listener = vi.fn();
    store.subscribe(listener);

    const issue = {
      key: "TEST-1",
      summary: "Test",
      issue_type: "Bug",
      status: "Open",
      project: "Test",
      project_key: "TEST",
      reporter: "user",
      assignee: null,
      fields: {},
    };

    store.setCurrentIssue(issue);
    expect(store.state.currentIssue).toEqual(issue);
    expect(listener).toHaveBeenCalled();
  });

  it("manages clone phase transitions", () => {
    store.setClonePhase("configuring");
    expect(store.state.clonePhase).toBe("configuring");
    store.setClonePhase("cloning");
    expect(store.state.clonePhase).toBe("cloning");
  });

  it("accumulates progress events", () => {
    store.addProgressEvent({ step: "fetching_source", status: "progress" });
    store.addProgressEvent({ step: "creating_issue", status: "progress" });

    expect(store.state.cloneProgress).toHaveLength(2);
    expect(store.state.cloneProgress[0].step).toBe("fetching_source");
    expect(store.state.cloneProgress[1].step).toBe("creating_issue");
  });

  it("resets clone state without affecting connection", () => {
    store.setConnectionStatus("connected");
    store.setClonePhase("cloning");
    store.setCloneResult({
      new_issue_key: "NEW-1",
      comments_copied: 0,
      attachments_copied: 0,
      link_created: false,
      site_url: "https://test.atlassian.net",
      skipped_custom_fields: [],
    });

    store.resetClone();

    expect(store.state.clonePhase).toBe("idle");
    expect(store.state.cloneResult).toBeNull();
    expect(store.state.cloneProgress).toHaveLength(0);
    expect(store.state.connectionStatus).toBe("connected"); // still connected
  });

  it("subscribes and unsubscribes listeners", () => {
    const listener = vi.fn();
    const unsub = store.subscribe(listener);

    store.setConnectionStatus("connected");
    expect(listener).toHaveBeenCalledTimes(1);

    unsub();
    store.setConnectionStatus("disconnected");
    expect(listener).toHaveBeenCalledTimes(1); // no change after unsubscribe
  });

  it("supports checkbox config changes", () => {
    store.setCloneConfig({ copyComments: false });
    expect(store.state.cloneConfig.copyComments).toBe(false);

    store.setCloneConfig({ copyAttachments: true });
    expect(store.state.cloneConfig.copyAttachments).toBe(true);
    expect(store.state.cloneConfig.copyComments).toBe(false); // unchanged
  });
});
