import "./ui/styles/main.scss";
import { store } from "./core/store";
import { setupI18n, updateUI, switchLocale, t } from "./core/i18n/i18n";
import { initConnectionUI, checkConnection } from "./core/connection-ui";
import { disconnect as jiraDisconnect } from "./core/jira-client";
import { showToast } from "./ui/toast";
import { showError } from "./core/errors";

const $accountEmail = document.getElementById("account-email")!;
const $accountSite = document.getElementById("account-site")!;
const $accountConnectedSince = document.getElementById("account-connected-since")!;
const $accountConnected = document.getElementById("account-connected")!;
const $accountDisconnected = document.getElementById("account-disconnected")!;
const $accountStatusBadge = document.getElementById("account-status-badge")!;
const $btnDisconnect = document.getElementById("btn-account-disconnect") as HTMLButtonElement;
const $languageSelect = document.getElementById("language-select") as HTMLSelectElement;

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function syncAccountUI() {
  const conn = store.state.connection;
  if (store.state.connectionStatus === "connected" && conn) {
    $accountConnected.classList.remove("hidden");
    $accountDisconnected.classList.add("hidden");
    $accountEmail.textContent = conn.email;
    $accountSite.textContent = conn.siteUrl;
    $accountConnectedSince.textContent = conn.connectedAt ? formatDate(conn.connectedAt) : "—";
    $accountStatusBadge.textContent = t("settings.account.connected");
    $accountStatusBadge.className = "badge badge--success";
  } else {
    $accountConnected.classList.add("hidden");
    $accountDisconnected.classList.remove("hidden");
  }
}

function initLanguageSelect() {
  let currentLang = "en";
  try {
    currentLang = localStorage.getItem("nova-clone-lang") || "en";
  } catch {
    currentLang = "en";
  }
  $languageSelect.value = currentLang;

  $languageSelect.addEventListener("change", async () => {
    const lang = $languageSelect.value;
    const ok = await switchLocale(lang);
    if (ok) {
      syncAccountUI();
      showToast("Language changed", "success");
    }
  });
}

function initDisconnect() {
  $btnDisconnect.addEventListener("click", async () => {
    try {
      await jiraDisconnect();
      store.setConnection(null);
      store.setConnectionStatus("disconnected");
      try {
        localStorage.removeItem("nova-clone-connected-at");
      } catch {
        // ignore
      }
      showToast(t("notification.disconnected"), "info");
    } catch (error) {
      showError("Disconnect", error instanceof Error ? error.message : "Failed to disconnect");
    }
  });
}

// ─── Nav ─────────────────────────────────────────────
document.querySelectorAll<HTMLAnchorElement>(".sidebar-nav .nav-item").forEach((link) => {
  link.addEventListener("click", (e) => {
    if (link.classList.contains("active")) {
      e.preventDefault();
    }
  });
});

async function init() {
  try {
    await setupI18n();
    updateUI();
    initConnectionUI();
    await checkConnection();
    document.documentElement.style.visibility = "";
    syncAccountUI();
    store.subscribe(syncAccountUI);
    initLanguageSelect();
    initDisconnect();
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    showError("Nova Clone", `Init failed: ${msg}`);
  }
}

init();
