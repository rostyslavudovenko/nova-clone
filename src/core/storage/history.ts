import { getStore, HISTORY_KEY } from "./store-access";
import type { HistoryEntry } from "../state";
import { StoreError } from "../errors";

export async function getHistory(): Promise<HistoryEntry[]> {
  try {
    const store = await getStore();
    const entries = await store.get<HistoryEntry[]>(HISTORY_KEY);
    return Array.isArray(entries) ? entries : [];
  } catch (error) {
    console.error("Failed to load history:", error);
    return [];
  }
}

async function setHistory(entries: HistoryEntry[]): Promise<void> {
  try {
    const store = await getStore();
    await store.set(HISTORY_KEY, entries);
  } catch (error) {
    throw new StoreError("Failed to save history", String(error));
  }
}

export async function addHistoryEntry(entry: HistoryEntry): Promise<void> {
  const entries = await getHistory();
  entries.unshift(entry);
  await setHistory(entries);
}

export async function clearHistory(): Promise<void> {
  await setHistory([]);
}
