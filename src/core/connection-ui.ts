import { store } from "./store";
import { getConnectionStatus } from "./jira-client";

let connectionStatus: HTMLElement | null;
let connectionInfo: HTMLElement | null;
let topbarContent: HTMLElement | null;
let profileAvatar: HTMLElement | null;

function ensureRefs() {
  connectionStatus = document.getElementById("connection-status");
  connectionInfo = document.getElementById("connection-info");
  topbarContent = document.getElementById("topbar-content");
  profileAvatar = document.querySelector(".profile-avatar") as HTMLElement | null;
}

function syncConnectionUI() {
  if (!connectionStatus || !connectionInfo || !topbarContent) return;

  const conn = store.state.connection;
  if (store.state.connectionStatus === "connected" && conn) {
    connectionStatus.classList.remove("hidden");
    connectionInfo.textContent = conn.email ?? "";
    topbarContent.innerHTML = `<span style="font-size: 12px; color: var(--ink-tertiary);">${conn.siteUrl ?? ""}</span>`;

    if (profileAvatar) {
      if (conn.avatarUrl) {
        profileAvatar.innerHTML = `<img src="${conn.avatarUrl}" alt="" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
      } else {
        profileAvatar.textContent = (conn.email ?? "?").charAt(0).toUpperCase();
      }
    }
  } else {
    connectionStatus.classList.add("hidden");
  }
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
      store.setConnection({ siteUrl: status.site_url, email: status.email, connectedAt, avatarUrl: status.avatar_url });
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
}
