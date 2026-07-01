import { load } from "@tauri-apps/plugin-store";
import { withRetry } from "../errors";

export const STORE_FILE = "nova-clone.json";
export const CONNECTION_KEY = "connection";
export const HISTORY_KEY = "clone_history";

let _store: Awaited<ReturnType<typeof load>> | null = null;

export async function getStore() {
  if (!_store) {
    _store = await withRetry(() => load(STORE_FILE, { defaults: {}, autoSave: true }), 2, 300);
  }
  return _store;
}

/** @internal — inject mock store for testing */
export function __setStore(store: Awaited<ReturnType<typeof load>> | null): void {
  _store = store;
}
