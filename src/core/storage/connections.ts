import { getStore, CONNECTION_KEY } from "./store-access";
import type { ConnectionConfig } from "../state";
import { StoreError } from "../errors";

export async function getConnection(): Promise<ConnectionConfig | null> {
  try {
    const store = await getStore();
    const conn = await store.get<ConnectionConfig>(CONNECTION_KEY);
    return conn ?? null;
  } catch (error) {
    console.error("Failed to load connection:", error);
    return null;
  }
}

export async function saveConnection(config: ConnectionConfig): Promise<void> {
  try {
    const store = await getStore();
    await store.set(CONNECTION_KEY, config);
  } catch (error) {
    throw new StoreError("Failed to save connection", String(error));
  }
}

export async function clearConnection(): Promise<void> {
  try {
    const store = await getStore();
    await store.delete(CONNECTION_KEY);
  } catch (error) {
    throw new StoreError("Failed to clear connection", String(error));
  }
}
