import { describe, it, expect, beforeEach, vi } from "vitest";
import { __setStore } from "./store-access";

function createMockStore() {
  let data: Record<string, unknown> = {};
  return {
    get: vi.fn().mockImplementation((key: string) => data[key] ?? null),
    set: vi.fn().mockImplementation((key: string, val: unknown) => {
      data[key] = val;
    }),
    delete: vi.fn().mockImplementation((key: string) => {
      delete data[key];
    }),
    save: vi.fn().mockResolvedValue(undefined),
  };
}

describe("history storage", () => {
  let mockStore: ReturnType<typeof createMockStore>;

  beforeEach(() => {
    mockStore = createMockStore();
    __setStore(mockStore as any);
  });

  it("returns empty array when no history", async () => {
    const { getHistory } = await import("./history");
    const history = await getHistory();
    expect(history).toEqual([]);
  });

  it("adds and retrieves history entries", async () => {
    const { addHistoryEntry, getHistory } = await import("./history");

    await addHistoryEntry({
      source_key: "OLD-1",
      target_key: "NEW-1",
      timestamp: "2026-01-01T00:00:00Z",
      status: "success",
    });

    await addHistoryEntry({
      source_key: "OLD-2",
      target_key: "NEW-2",
      timestamp: "2026-01-02T00:00:00Z",
      status: "success",
    });

    const history = await getHistory();
    expect(history).toHaveLength(2);
    // Most recent first
    expect(history[0].source_key).toBe("OLD-2");
    expect(history[1].source_key).toBe("OLD-1");
  });

  it("clears all history", async () => {
    const { addHistoryEntry, getHistory, clearHistory } = await import("./history");

    await addHistoryEntry({
      source_key: "OLD-1",
      target_key: "NEW-1",
      timestamp: "2026-01-01T00:00:00Z",
      status: "success",
    });

    await clearHistory();
    const history = await getHistory();
    expect(history).toEqual([]);
  });
});
