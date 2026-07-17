import { showToast } from "../ui/toast";

export class AppError extends Error {
  constructor(
    message: string,
    public readonly details?: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class JiraError extends AppError {
  constructor(
    message: string,
    public readonly statusCode?: number,
    details?: string,
  ) {
    super(message, details);
    this.name = "JiraError";
  }
}

export class StoreError extends AppError {
  constructor(message: string, details?: string) {
    super(message, details);
    this.name = "StoreError";
  }
}

export class CloneError extends AppError {
  constructor(
    message: string,
    public readonly step?: string,
    details?: string,
  ) {
    super(message, details);
    this.name = "CloneError";
  }
}

export function showError(title: string, message: string): void {
  showToast(`${title}: ${message}`, "error", 6000);
}

export function getErrorMessage(error: unknown, fallback = "Something went wrong"): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return fallback;
}

export async function withRetry<T>(fn: () => Promise<T>, maxRetries = 2, delay = 500): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}
