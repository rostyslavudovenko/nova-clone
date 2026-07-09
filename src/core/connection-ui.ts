import { store } from "./store";
import { getConnectionStatus, disconnect as jiraDisconnect } from "./jira-client";
import { t } from "./i18n/i18n";
import { showError } from "./errors";
import { showToast } from "../ui/toast";

let connectionStatus: HTMLElement | null;
let connectionInfo: HTMLElement | null;
let topbarContent: HTMLElement | null;
let btnDisconnect: HTMLElement | null;

function ensureRefs() {
  connectionStatus = document.getElementById("connection-status");
  connectionInfo = document.getElementById("connection-info");
  topbarContent = document.getElementById("topbar-content");
  btnDisconnect = document.getElementById("btn-disconnect") as HTMLElement | null;
}

function syncConnectionUI() {
  if (!connectionStatus || !connectionInfo || !topbarContent) return;

  const conn = store.state.connection;
  if (store.state.connectionStatus === "connected" && conn) {
    connectionStatus.classList.remove("hidden");
    connectionInfo.textContent = conn.email ?? "";
    topbarContent.innerHTML = `<span style="font-size: 12px; color: var(--ink-tertiary);">${conn.siteUrl ?? ""}</span>`;
  } else {
    connectionStatus.classList.add("hidden");
  }
}

function onDisconnectClick() {
  if (!btnDisconnect) return;
  btnDisconnect.addEventListener("click", async () => {
    try {
      await jiraDisconnect();
      store.setConnection(null);
      store.setConnectionStatus("disconnected");
      showToast(t("notification.disconnected"), "info");
    } catch (error) {
      showError("Disconnect", error instanceof Error ? error.message : "Failed to disconnect");
    }
  });
}

export async function checkConnection() {
  try {
    store.setConnectionStatus("connecting");
    const status = await getConnectionStatus();
    if (status.connected && status.site_url && status.email) {
      const connectedAt = (() => {
        try {
          return localStorage.getItem("nova-clone-connected-at") ?? undefined;
        } catch {
          return undefined;
        }
      })();
      store.setConnection({ siteUrl: status.site_url, email: status.email, connectedAt });
      store.setConnectionStatus("connected");
    } else {
      store.setConnectionStatus("disconnected");
    }
  } catch {
    store.setConnectionStatus("disconnected");
  }
}

export function initConnectionUI() {
  ensureRefs();
  syncConnectionUI();
  store.subscribe(syncConnectionUI);
  onDisconnectClick();
}
