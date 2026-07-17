import { describe, it, expect, vi } from "vitest";
import { AppError, JiraError, StoreError, CloneError, withRetry } from "./errors";

describe("AppError", () => {
  it("creates with message and optional details", () => {
    const err = new AppError("test", "details");
    expect(err.message).toBe("test");
    expect(err.details).toBe("details");
    expect(err.name).toBe("AppError");
  });

  it("creates with message only", () => {
    const err = new AppError("test");
    expect(err.message).toBe("test");
    expect(err.details).toBeUndefined();
  });
});

describe("JiraError", () => {
  it("creates with status code", () => {
    const err = new JiraError("not found", 404);
    expect(err.message).toBe("not found");
    expect(err.statusCode).toBe(404);
    expect(err.name).toBe("JiraError");
  });
});

describe("StoreError", () => {
  it("creates with message", () => {
    const err = new StoreError("store fail");
    expect(err.name).toBe("StoreError");
  });
});

describe("CloneError", () => {
  it("creates with step info", () => {
    const err = new CloneError("failed", "copying_comments");
    expect(err.step).toBe("copying_comments");
    expect(err.name).toBe("CloneError");
  });
});

describe("withRetry", () => {
  it("retries on failure and succeeds", async () => {
    let attempts = 0;
    const fn = vi.fn().mockImplementation(() => {
      attempts++;
      if (attempts < 3) return Promise.reject(new Error("fail"));
      return Promise.resolve("ok");
    });

    const result = await withRetry(fn, 3, 10);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  // retries should stop after maxRetries and propagate the last error
  it("throws after exhausting retries", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("persistent"));
    await expect(withRetry(fn, 2, 10)).rejects.toThrow("persistent");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("succeeds on first attempt", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(fn, 3, 10);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
