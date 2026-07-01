import { describe, it, expect, beforeEach, vi } from "vitest";
import { __setStore } from "./store-access";

// Mock store
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

describe("connections storage", () => {
  let mockStore: ReturnType<typeof createMockStore>;

  beforeEach(() => {
    mockStore = createMockStore();
    __setStore(mockStore as any);
  });

  it("saves and loads connection config", async () => {
    const { saveConnection, getConnection } = await import("./connections");

    const config = {
      siteUrl: "https://test.atlassian.net",
      email: "user@example.com",
    };

    await saveConnection(config);
    const loaded = await getConnection();
    expect(loaded).toEqual(config);
  });

  it("returns null when no connection saved", async () => {
    const { getConnection } = await import("./connections");
    const loaded = await getConnection();
    expect(loaded).toBeNull();
  });

  it("clears connection", async () => {
    const { saveConnection, getConnection, clearConnection } = await import("./connections");

    await saveConnection({
      siteUrl: "https://test.atlassian.net",
      email: "user@example.com",
    });
    await clearConnection();
    const loaded = await getConnection();
    expect(loaded).toBeNull();
  });
});
