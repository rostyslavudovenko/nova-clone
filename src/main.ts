import "./ui/styles/main.scss";
import { store } from "./core/store";
import { parseIssueKey, type ProgressEvent, type JiraIssue, type CloneResult, type HistoryEntry, type FieldInfo } from "./core/state";
import { initConnectionUI } from "./core/connection-ui";
import {
  validateConnection,
  getConnectionStatus,
  fetchIssue,
  fetchProjects,
  fetchCreatemeta,
  fetchIssueTypeFields,
  cloneIssue,
  disconnect,
  getHistory,
  fetchFieldMetadata,
  fetchTargetFields,
} from "./core/jira-client";
import { notify } from "./core/notify";
import { setupI18n, updateUI, switchLocale, t } from "./core/i18n/i18n";
import { showError } from "./core/errors";
import { showToast } from "./ui/toast";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-shell";

// ─── DOM refs ────────────────────────────────────────
const $ = (id: string) => document.getElementById(id);

// Views and Navigation
const navClone = $("nav-clone") as HTMLAnchorElement;
const navHistory = $("nav-history") as HTMLAnchorElement;
const navSettings = $("nav-settings") as HTMLAnchorElement;
const navAbout = $("nav-about") as HTMLAnchorElement;

const viewClone = $("view-clone")!;
const viewHistory = $("view-history")!;
const viewSettings = $("view-settings")!;
const viewAbout = $("view-about")!;

const allNavItems = [navClone, navHistory, navSettings, navAbout];
const allViews = [viewClone, viewHistory, viewSettings, viewAbout];

// Clone & Connect flow refs
const connectView = $("connect-view")!;
const cloneView = $("clone-view")!;
const inputSiteUrl = $("input-site-url") as HTMLInputElement;
const inputEmail = $("input-email") as HTMLInputElement;
const inputToken = $("input-token") as HTMLInputElement;
const btnConnect = $("btn-connect") as HTMLButtonElement;
const connectError = $("connect-error")!;
const inputIssueKey = $("input-issue-key") as HTMLInputElement;
const btnLookup = $("btn-lookup") as HTMLButtonElement;
const issueError = $("issue-error")!;
const issuePreviewSection = $("issue-preview-section")!;
const previewSummary = $("preview-summary")!;
const previewKey = $("preview-key")!;
const previewType = $("preview-type")!;
const previewStatus = $("preview-status")!;
const previewReporter = $("preview-reporter")!;
const previewAssignee = $("preview-assignee")!;
const cloneConfigSection = $("clone-config-section")!;
const selectProject = $("select-project") as HTMLSelectElement;
const selectIssueType = $("select-issuetype") as HTMLSelectElement;
const missingFieldsWarning = $("missing-fields-warning")!;
const chkComments = $("chk-comments") as HTMLInputElement;
const chkAttachments = $("chk-attachments") as HTMLInputElement;
const chkLinks = $("chk-links") as HTMLInputElement;
const chkSummary = $("chk-summary") as HTMLInputElement;
const chkDescription = $("chk-description") as HTMLInputElement;
const chkPriority = $("chk-priority") as HTMLInputElement;
const btnClone = $("btn-clone") as HTMLButtonElement;
const customFieldsSection = $("custom-fields-section")!;
const customFieldsList = $("custom-fields-list")!;
const customFieldsFilter = $("custom-fields-filter")!;
const progressSection = $("progress-section")!;
const progressSteps = $("progress-steps")!;
const resultSection = $("result-section")!;
const resultSuccess = $("result-success")!;
const resultError = $("result-error")!;
const resultKey = $("result-key")!;
const resultSummary = $("result-summary")!;
const resultErrorDesc = $("result-error-desc")!;
const btnOpenBrowser = $("btn-open-browser") as HTMLButtonElement;
const btnCloneAnother = $("btn-clone-another") as HTMLButtonElement;
const btnRetry = $("btn-retry") as HTMLButtonElement;

// History View refs
const historyBody = $("history-body")!;
const historyEmpty = $("history-empty")!;

// Settings View refs
const accountEmail = $("account-email")!;
const accountSite = $("account-site")!;
const accountConnectedSince = $("account-connected-since")!;
const accountConnected = $("account-connected")!;
const accountDisconnected = $("account-disconnected")!;
const accountStatusBadge = $("account-status-badge")!;
const btnDisconnect = $("btn-account-disconnect") as HTMLButtonElement;
const languageSelect = $("language-select") as HTMLSelectElement;

// Custom fields state
let fieldMetadata: FieldInfo[] = [];
let targetAvailableFields: FieldInfo[] = [];
let customFieldsFilterMode: "available" | "all" = "available";

// ─── State helpers ───────────────────────────────────
function show(view: HTMLElement) {
  view.classList.remove("hidden");
}
function hide(view: HTMLElement) {
  view.classList.add("hidden");
}

function setButtonLoading(btn: HTMLButtonElement, loading: boolean, labelKey?: string) {
  btn.disabled = loading;
  btn.textContent = loading ? t(labelKey ?? "connect.connecting") : t(labelKey ?? "connect.connect");
}

// ─── View switcher ───────────────────────────────────
function switchView(target: "clone" | "history" | "settings" | "about") {
  allViews.forEach((v) => hide(v));
  allNavItems.forEach((item) => item.classList.remove("active"));

  if (target === "clone") {
    show(viewClone);
    navClone.classList.add("active");
    if (store.state.connectionStatus === "connected") {
      loadProjects();
    }
  } else if (target === "history") {
    show(viewHistory);
    navHistory.classList.add("active");
    renderHistoryList();
  } else if (target === "settings") {
    show(viewSettings);
    navSettings.classList.add("active");
    syncAccountUI();
  } else if (target === "about") {
    show(viewAbout);
    navAbout.classList.add("active");
  }
}

navClone.addEventListener("click", (e) => {
  e.preventDefault();
  switchView("clone");
});

navHistory.addEventListener("click", (e) => {
  e.preventDefault();
  switchView("history");
});

navSettings.addEventListener("click", (e) => {
  e.preventDefault();
  switchView("settings");
});

navAbout.addEventListener("click", (e) => {
  e.preventDefault();
  switchView("about");
});

// ─── Connection flow ─────────────────────────────────
async function checkConnection() {
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

function showConnectedUI() {
  hide(connectView);
  show(cloneView);
  loadProjects();
}

function showDisconnectedUI() {
  show(connectView);
  hide(cloneView);
  hide(progressSection);
  hide(resultSection);
  hide(issuePreviewSection);
  hide(cloneConfigSection);
  connectError.classList.add("hidden");
}

// ─── Store Subscription ──────────────────────────────
let lastConnectionStatus = store.state.connectionStatus;
store.subscribe(() => {
  const currentStatus = store.state.connectionStatus;
  if (currentStatus !== lastConnectionStatus) {
    lastConnectionStatus = currentStatus;
    if (currentStatus === "connected") {
      showConnectedUI();
    } else if (currentStatus === "disconnected") {
      showDisconnectedUI();
    }
  }
  syncAccountUI();
});

// ─── Connect button ──────────────────────────────────
btnConnect.addEventListener("click", async () => {
  const siteUrl = inputSiteUrl.value.trim();
  const email = inputEmail.value.trim();
  const token = inputToken.value.trim();

  inputSiteUrl.classList.remove("input-error");
  inputEmail.classList.remove("input-error");
  inputToken.classList.remove("input-error");

  if (!siteUrl) {
    inputSiteUrl.classList.add("input-error");
    connectError.textContent = t("connect.invalidUrl");
    connectError.classList.remove("hidden");
    return;
  }
  if (!email) {
    inputEmail.classList.add("input-error");
    connectError.textContent = t("connect.invalidEmail");
    connectError.classList.remove("hidden");
    return;
  }
  if (!token) {
    inputToken.classList.add("input-error");
    connectError.textContent = t("connect.invalidToken");
    connectError.classList.remove("hidden");
    return;
  }

  connectError.classList.add("hidden");
  setButtonLoading(btnConnect, true);

  try {
    await validateConnection(siteUrl, email, token);
    const connectedAt = new Date().toISOString();
    localStorage.setItem("nova-clone-connected-at", connectedAt);
    const status = await getConnectionStatus();
    store.setConnection({ siteUrl, email, connectedAt, avatarUrl: status.avatar_url });
    store.setConnectionStatus("connected");
    showToast(t("connect.connected", { site: siteUrl }), "success");
  } catch (error) {
    const msg = typeof error === "string" ? error : error instanceof Error ? error.message : "Connection failed";
    connectError.textContent = msg;
    connectError.classList.remove("hidden");
  } finally {
    setButtonLoading(btnConnect, false);
  }
});

// ─── Issue lookup ────────────────────────────────────
btnLookup.addEventListener("click", async () => {
  const raw = inputIssueKey.value.trim();
  if (!raw) return;

  const key = parseIssueKey(raw);
  if (!key || !/^[A-Z][A-Z0-9]+-\d+$/i.test(key)) {
    inputIssueKey.classList.add("input-error");
    issueError.textContent = t("clone.invalidCharacters");
    issueError.classList.remove("hidden");
    return;
  }

  inputIssueKey.classList.remove("input-error");
  issueError.classList.add("hidden");
  setButtonLoading(btnLookup, true, "clone.lookup");

  try {
    const issue = await fetchIssue(key);
    store.setCurrentIssue(issue);
    renderPreview(issue);
    hide(issueError);
    show(issuePreviewSection);
    store.setClonePhase("preview");
    show(cloneConfigSection);
    renderCustomFields(issue.fields, targetAvailableFields);
  } catch (error) {
    inputIssueKey.classList.add("input-error");
    issueError.textContent =
      typeof error === "string" ? error : error instanceof Error ? error.message : t("clone.issueNotFound");
    issueError.classList.remove("hidden");
    hide(issuePreviewSection);
    hide(cloneConfigSection);
  } finally {
    setButtonLoading(btnLookup, false, "clone.lookup");
  }
});

inputIssueKey.addEventListener("keydown", (e) => {
  if (e.key === "Enter") btnLookup.click();
});

[inputSiteUrl, inputEmail, inputToken, inputIssueKey].forEach((input) => {
  input.addEventListener("input", () => input.classList.remove("input-error"));
});

function renderPreview(issue: JiraIssue) {
  previewSummary.textContent = issue.summary;
  previewKey.textContent = issue.key;
  previewType.textContent = issue.issue_type;
  previewStatus.textContent = issue.status;
  previewStatus.className = `badge badge--info`;
  previewReporter.textContent = issue.reporter ?? "None";
  previewAssignee.textContent = issue.assignee ?? "Unassigned";
}

function renderCustomFields(sourceFields: Record<string, unknown>, available: FieldInfo[]) {
  customFieldsList.innerHTML = "";
  const availableKeys = new Set(available.map((f) => f.key));
  const nameMap = new Map(fieldMetadata.map((f) => [f.key, f.name]));

  const customKeys = Object.keys(sourceFields).filter((k) => k.startsWith("customfield_"));

  if (customKeys.length === 0) {
    hide(customFieldsSection);
    return;
  }

  const visibleKeys = customFieldsFilterMode === "available"
    ? customKeys.filter((k) => availableKeys.has(k))
    : customKeys;

  for (const key of visibleKeys) {
    const name = nameMap.get(key) ?? key;
    const isAvailable = availableKeys.has(key);

    const row = document.createElement("div");
    row.className = `checkbox-row${isAvailable ? "" : " unavailable"}`;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = true;
    checkbox.id = `chk-${key}`;
    if (!isAvailable) {
      checkbox.disabled = true;
    }

    const label = document.createElement("label");
    label.htmlFor = `chk-${key}`;
    label.textContent = name;

    row.appendChild(checkbox);
    row.appendChild(label);
    customFieldsList.appendChild(row);
  }

  show(customFieldsSection);
}

customFieldsFilter.addEventListener("click", (e) => {
  const btn = (e.target as HTMLElement).closest(".segment") as HTMLButtonElement | null;
  if (!btn) return;
  const filter = btn.dataset.filter as "available" | "all";
  if (filter === customFieldsFilterMode) return;

  customFieldsFilterMode = filter;
  customFieldsFilter.querySelectorAll(".segment").forEach((s) => s.classList.remove("active"));
  btn.classList.add("active");

  if (store.state.currentIssue) {
    renderCustomFields(store.state.currentIssue.fields, targetAvailableFields);
  }
});

// ─── Project / Issue type loading ────────────────────
async function loadProjects() {
  try {
    const projects = await fetchProjects();
    store.setProjects(projects);
    selectProject.innerHTML = `<option value="">${t("clone.targetProjectPlaceholder")}</option>`;
    for (const p of projects) {
      const opt = document.createElement("option");
      opt.value = p.key;
      opt.textContent = `${p.name} (${p.key})`;
      selectProject.appendChild(opt);
    }
  } catch (error) {
    const msg = typeof error === "string" ? error : error instanceof Error ? error.message : "Failed to load projects";
    showError("Projects", msg);
  }
}

selectProject.addEventListener("change", async () => {
  const key = selectProject.value;
  store.setSelectedProject(key);
  selectIssueType.innerHTML = `<option value="">${t("clone.targetIssueTypePlaceholder")}</option>`;

  if (!key) return;

  try {
    selectIssueType.disabled = true;
    const meta = await fetchCreatemeta(key);
    store.setIssueTypes(meta.issue_types);
    for (const it of meta.issue_types) {
      const opt = document.createElement("option");
      opt.value = it.id;
      opt.textContent = it.name;
      selectIssueType.appendChild(opt);
    }
  } catch (error) {
    const msg =
      typeof error === "string" ? error : error instanceof Error ? error.message : "Failed to load issue types";
    showError("Issue types", msg);
  } finally {
    selectIssueType.disabled = false;
  }
});

selectIssueType.addEventListener("change", async () => {
  store.setSelectedIssueType(selectIssueType.value);
  await checkMissingFields();
  await updateTargetFields();
  if (store.state.currentIssue) {
    renderCustomFields(store.state.currentIssue.fields, targetAvailableFields);
  }
});

async function checkMissingFields() {
  const issueTypeId = selectIssueType.value;
  const projectKey = selectProject.value;
  if (!issueTypeId || !projectKey) {
    hide(missingFieldsWarning);
    return;
  }

  const fields = store.state.currentIssue?.fields;
  if (!fields) return;

  try {
    let requiredFields: string[] = [];
    const it = store.state.issueTypes.find((t) => t.id === issueTypeId);

    if (it && it.required_fields && it.required_fields.length > 0) {
      requiredFields = it.required_fields;
    } else {
      requiredFields = await fetchIssueTypeFields(projectKey, issueTypeId);
      const updatedTypes = store.state.issueTypes.map((t) => {
        if (t.id === issueTypeId) {
          return { ...t, required_fields: requiredFields };
        }
        return t;
      });
      store.setIssueTypes(updatedTypes);
    }

    const missing = requiredFields.filter((f) => {
      if (f === "summary") return false;
      return !(f in fields);
    });

    if (missing.length > 0) {
      missingFieldsWarning.textContent = t("clone.missingFields", { fields: missing.join(", ") });
      show(missingFieldsWarning);
    } else {
      hide(missingFieldsWarning);
    }
  } catch (error) {
    console.error("Failed to load required fields", error);
    const it = store.state.issueTypes.find((t) => t.id === issueTypeId);
    const requiredFields = it?.required_fields ?? [];
    const missing = requiredFields.filter((f) => {
      if (f === "summary") return false;
      return !(f in fields);
    });

    if (missing.length > 0) {
      missingFieldsWarning.textContent = t("clone.missingFields", { fields: missing.join(", ") });
      show(missingFieldsWarning);
    } else {
      hide(missingFieldsWarning);
    }
  }
}

async function updateTargetFields() {
  const projectKey = selectProject.value;
  const issueTypeId = selectIssueType.value;
  if (!projectKey || !issueTypeId) {
    targetAvailableFields = [];
    return;
  }
  try {
    targetAvailableFields = await fetchTargetFields(projectKey, issueTypeId);
  } catch {
    targetAvailableFields = [];
  }
}

// ─── Clone execution ─────────────────────────────────
btnClone.addEventListener("click", async () => {
  const sourceIssueKey = store.state.currentIssue?.key;
  const targetProjectKey = selectProject.value;
  const targetIssueTypeId = selectIssueType.value;

  if (!sourceIssueKey || !targetProjectKey || !targetIssueTypeId) {
    showToast("Please configure all clone options", "error");
    return;
  }

  const config = {
    sourceIssueKey,
    targetProjectKey,
    targetIssueTypeId,
    copyComments: chkComments.checked,
    copyAttachments: chkAttachments.checked,
    copyLinks: chkLinks.checked,
    copySummary: chkSummary.checked,
    copyDescription: chkDescription.checked,
    copyPriority: chkPriority.checked,
  };

  const customFieldKeys = targetAvailableFields
    .map((f) => f.key)
    .filter((key) => {
      const el = document.getElementById(`chk-${key}`) as HTMLInputElement | null;
      return el && el.checked;
    });

  store.resetClone();
  store.setClonePhase("cloning");
  progressSteps.innerHTML = "";
  show(progressSection);
  hide(resultSection);
  setButtonLoading(btnClone, true, "clone.cloning");

  try {
    const unlisten = await listen<ProgressEvent>("clone-progress", (event) => {
      handleProgress(event.payload);
    });

    try {
      const result = await cloneIssue(
        config.sourceIssueKey,
        config.targetProjectKey,
        config.targetIssueTypeId,
        config.copyComments,
        config.copyAttachments,
        config.copyLinks,
        config.copySummary,
        config.copyDescription,
        config.copyPriority,
        customFieldKeys,
      );
      store.setCloneResult(result);
      store.setClonePhase("complete");
      showResult(result);
      await notify("Nova Clone", t("notification.cloneComplete", { key: result.new_issue_key }));
    } finally {
      unlisten();
    }
  } catch (error) {
    store.setClonePhase("error");
    const msg = typeof error === "string" ? error : error instanceof Error ? error.message : "Clone failed";
    store.setCloneError(msg);
    showErrorResult(msg);
    await notify("Nova Clone", t("notification.cloneFailed", { error: msg }));
  } finally {
    setButtonLoading(btnClone, false, "clone.startClone");
  }
});

function handleProgress(event: ProgressEvent) {
  store.addProgressEvent(event);

  const existing = progressSteps.querySelector(`[data-step="${event.step}"]`);
  if (existing) {
    updateStepElement(existing as HTMLElement, event);
  } else {
    const el = createStepElement(event);
    progressSteps.appendChild(el);
  }
}

function createStepElement(event: ProgressEvent): HTMLElement {
  const el = document.createElement("div");
  el.className = "progress-step progress-step--active";
  el.dataset.step = event.step;
  el.innerHTML = `
    <span class="step-icon">${getStepNumber(event.step)}</span>
    <span class="step-label">${getStepLabel(event.step)}</span>
    <span class="step-status">${getStepStatus(event)}</span>
  `;
  return el;
}

function updateStepElement(el: HTMLElement, event: ProgressEvent) {
  const statusClass =
    event.status === "success"
      ? "progress-step--success"
      : event.status === "error"
        ? "progress-step--error"
        : "progress-step--active";
  el.className = `progress-step ${statusClass}`;
  const statusEl = el.querySelector(".step-status");
  if (statusEl) statusEl.textContent = getStepStatus(event);
}

function getStepNumber(step: string): number {
  const order = [
    "fetching_source",
    "creating_issue",
    "copying_comments",
    "copying_attachments",
    "linking_issues",
    "complete",
  ];
  return order.indexOf(step) + 1;
}

function getStepLabel(step: string): string {
  return t(`clone.step.${step}`, {});
}

function getStepStatus(event: ProgressEvent): string {
  if (event.status === "progress" && event.total) {
    return `${event.current ?? 0}/${event.total}`;
  }
  if (event.status === "success") return "\u2713";
  if (event.status === "error") return "\u2717";
  return "...";
}

// ─── Result display ──────────────────────────────────
function showResult(result: CloneResult) {
  hide(resultError);
  show(resultSuccess);
  resultKey.textContent = result.new_issue_key;
  const parts: string[] = [];
  if (result.comments_copied > 0) parts.push(t("clone.result.comments", { count: result.comments_copied }));
  if (result.attachments_copied > 0) parts.push(t("clone.result.attachments", { count: result.attachments_copied }));
  if (result.link_created) parts.push(t("clone.result.link"));
  if (result.skipped_custom_fields.length > 0) {
    const skippedNames = result.skipped_custom_fields
      .map((key) => fieldMetadata.find((f) => f.key === key)?.name ?? key)
      .join(", ");
    parts.push(`Skipped custom fields: ${skippedNames}`);
  }
  resultSummary.textContent = parts.join(" \u2022 ");
  show(resultSection);
  hide(progressSection);
}

function showErrorResult(msg: string) {
  hide(resultSuccess);
  show(resultError);
  resultErrorDesc.textContent = msg;
  show(resultSection);
  hide(progressSection);
}

btnOpenBrowser.addEventListener("click", () => {
  const result = store.state.cloneResult;
  if (!result) return;
  const url = `${result.site_url}/browse/${result.new_issue_key}`;
  open(url);
});

btnCloneAnother.addEventListener("click", () => {
  store.resetClone();
  hide(resultSection);
  hide(cloneConfigSection);
  hide(issuePreviewSection);
  hide(progressSection);
  hide(customFieldsSection);
  targetAvailableFields = [];
  inputIssueKey.value = "";
  selectProject.value = "";
  selectIssueType.innerHTML = `<option value="">${t("clone.targetIssueTypePlaceholder")}</option>`;
});

btnRetry.addEventListener("click", () => {
  btnClone.click();
});

// ─── Settings logic ──────────────────────────────────
function syncAccountUI() {
  const conn = store.state.connection;
  if (store.state.connectionStatus === "connected" && conn) {
    show(accountConnected);
    hide(accountDisconnected);
    accountEmail.textContent = conn.email ?? "—";
    accountSite.textContent = conn.siteUrl ?? "—";
    accountConnectedSince.textContent = conn.connectedAt ? formatTimestamp(conn.connectedAt) : "—";
    accountStatusBadge.textContent = t("settings.account.connected");
    accountStatusBadge.className = "badge badge--success";
  } else {
    hide(accountConnected);
    show(accountDisconnected);
  }
}

function initLanguageSelect() {
  let currentLang = "en";
  try {
    currentLang = localStorage.getItem("nova-clone-lang") || "en";
  } catch {
    currentLang = "en";
  }
  languageSelect.value = currentLang;

  languageSelect.addEventListener("change", async () => {
    const lang = languageSelect.value;
    const ok = await switchLocale(lang);
    if (ok) {
      syncAccountUI();
      showToast("Language changed", "success");
    }
  });
}

function initDisconnect() {
  btnDisconnect.addEventListener("click", async () => {
    try {
      await disconnect();
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

// ─── History logic ───────────────────────────────────
async function renderHistoryList(): Promise<void> {
  let entries: HistoryEntry[];
  try {
    entries = await getHistory();
  } catch (error) {
    console.error("Failed to load history:", error);
    entries = [];
  }

  historyBody.innerHTML = "";

  if (entries.length === 0) {
    historyEmpty.style.display = "block";
    return;
  }

  historyEmpty.style.display = "none";

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

    historyBody.appendChild(tr);
  }
}

function formatTimestamp(iso: string | undefined): string {
  if (!iso) return "—";
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

// ─── Init ────────────────────────────────────────────
async function init() {
  try {
    await setupI18n();
    updateUI();
    initConnectionUI();
    document.querySelector(".sidebar-profile")?.addEventListener("click", () => switchView("settings"));
    initLanguageSelect();
    initDisconnect();
    document.documentElement.style.visibility = "";
    await checkConnection();
    fetchFieldMetadata().then((meta) => { fieldMetadata = meta; }).catch(() => {});
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    showError("Nova Clone", `Init failed: ${msg}`);
  }
}

init();
