import "./ui/styles/main.scss";
import { getHistory } from "./core/jira-client";
import type { HistoryEntry } from "./core/state";
import { setupI18n, updateUI, t } from "./core/i18n/i18n";
import { initConnectionUI, checkConnection } from "./core/connection-ui";
import { showError } from "./core/errors";
import { open } from "@tauri-apps/plugin-shell";

async function renderList(): Promise<void> {
  const tbody = document.getElementById("history-body");
  const empty = document.getElementById("history-empty");
  if (!tbody || !empty) return;

  let entries: HistoryEntry[];
  try {
    entries = await getHistory();
  } catch (error) {
    console.error("Failed to load history:", error);
    entries = [];
  }

  tbody.innerHTML = "";

  if (entries.length === 0) {
    tbody.innerHTML = "";
    empty.style.display = "block";
    return;
  }

  empty.style.display = "none";

  for (const entry of entries) {
    const tr = document.createElement("tr");

    const sourceTd = document.createElement("td");
    sourceTd.className = "cell-key";
    sourceTd.textContent = entry.source_key;
    tr.appendChild(sourceTd);

    const targetTd = document.createElement("td");
    targetTd.className = "cell-key";
    targetTd.textContent = entry.target_key;
    tr.appendChild(targetTd);

    const dateTd = document.createElement("td");
    dateTd.className = "cell-timestamp";
    dateTd.textContent = formatTimestamp(entry.timestamp);
    tr.appendChild(dateTd);

    const statusTd = document.createElement("td");
    const badge = document.createElement("span");
    if (entry.status === "success") {
      badge.className = "badge badge--success";
      badge.textContent = t("history.success");
    } else {
      badge.className = "badge badge--error";
      badge.textContent = t("history.failed");
    }
    statusTd.appendChild(badge);
    tr.appendChild(statusTd);

    const actionsTd = document.createElement("td");
    actionsTd.className = "cell-actions";
    const openBtn = document.createElement("button");
    openBtn.className = "btn btn-sm btn-ghost";
    openBtn.textContent = t("history.open");
    openBtn.addEventListener("click", () => {
      const site = extractSite(entry);
      const url = site.startsWith("http")
        ? `${site}/browse/${entry.target_key}`
        : `https://${site}/browse/${entry.target_key}`;
      open(url);
    });
    actionsTd.appendChild(openBtn);
    tr.appendChild(actionsTd);

    tbody.appendChild(tr);
  }
}

function formatTimestamp(iso: string | undefined): string {
  if (!iso) return "\u2014";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function extractSite(entry: HistoryEntry): string {
  if (entry.site_url) {
    return entry.site_url;
  }
  return "your-site.atlassian.net";
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
    await renderList();
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    showError("Nova Clone", `Init failed: ${msg}`);
  }
}

init();
