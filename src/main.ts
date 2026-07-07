import "./ui/styles/main.scss";
import { store } from "./core/store";
import { parseIssueKey, type ProgressEvent, type JiraIssue, type CloneResult } from "./core/state";
import {
  validateConnection,
  getConnectionStatus,
  disconnect,
  fetchIssue,
  fetchProjects,
  fetchCreatemeta,
  fetchIssueTypeFields,
  cloneIssue,
} from "./core/jira-client";
import { notify } from "./core/notify";
import { setupI18n, updateUI, t } from "./core/i18n/i18n";
import { showError } from "./core/errors";
import { showToast } from "./ui/toast";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-shell";

// ─── DOM refs ────────────────────────────────────────
const $ = (id: string) => document.getElementById(id);
const connectView = $("connect-view")!;
const cloneView = $("clone-view")!;
const inputSiteUrl = $("input-site-url") as HTMLInputElement;
const inputEmail = $("input-email") as HTMLInputElement;
const inputToken = $("input-token") as HTMLInputElement;
const btnConnect = $("btn-connect") as HTMLButtonElement;
const connectError = $("connect-error")!;
const connectionStatus = $("connection-status")!;
const connectionInfo = $("connection-info")!;
const btnDisconnect = $("btn-disconnect") as HTMLButtonElement;
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
const btnClone = $("btn-clone") as HTMLButtonElement;
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
const topbarContent = $("topbar-content")!;

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

// ─── Connection flow ─────────────────────────────────
async function checkConnection() {
  try {
    store.setConnectionStatus("connecting");
    const status = await getConnectionStatus();
    if (status.connected && status.site_url && status.email) {
      store.setConnection({ siteUrl: status.site_url, email: status.email });
      store.setConnectionStatus("connected");
      showConnectedUI();
    } else {
      store.setConnectionStatus("disconnected");
      showDisconnectedUI();
    }
  } catch {
    store.setConnectionStatus("disconnected");
    showDisconnectedUI();
  }
}

function showConnectedUI() {
  const conn = store.state.connection;
  hide(connectView);
  show(cloneView);
  show(connectionStatus);
  connectionInfo.textContent = conn?.email ?? "";
  topbarContent.innerHTML = `<span style="font-size: 12px; color: var(--ink-tertiary);">${conn?.siteUrl ?? ""}</span>`;
  loadProjects();
}

function showDisconnectedUI() {
  show(connectView);
  hide(cloneView);
  hide(connectionStatus);
  hide(progressSection);
  hide(resultSection);
  hide(issuePreviewSection);
  hide(cloneConfigSection);
  connectError.classList.add("hidden");
}

// ─── Connect button ──────────────────────────────────
btnConnect.addEventListener("click", async () => {
  const siteUrl = inputSiteUrl.value.trim();
  const email = inputEmail.value.trim();
  const token = inputToken.value.trim();

  if (!siteUrl) {
    connectError.textContent = t("connect.invalidUrl");
    connectError.classList.remove("hidden");
    return;
  }
  if (!email) {
    connectError.textContent = t("connect.invalidEmail");
    connectError.classList.remove("hidden");
    return;
  }
  if (!token) {
    connectError.textContent = t("connect.invalidToken");
    connectError.classList.remove("hidden");
    return;
  }

  connectError.classList.add("hidden");
  setButtonLoading(btnConnect, true);

  try {
    await validateConnection(siteUrl, email, token);
    store.setConnection({ siteUrl, email });
    store.setConnectionStatus("connected");
    showConnectedUI();
    showToast(t("connect.connected", { site: siteUrl }), "success");
  } catch (error) {
    const msg = typeof error === "string" ? error : error instanceof Error ? error.message : "Connection failed";
    connectError.textContent = msg;
    connectError.classList.remove("hidden");
  } finally {
    setButtonLoading(btnConnect, false);
  }
});

// ─── Disconnect ──────────────────────────────────────
btnDisconnect.addEventListener("click", async () => {
  try {
    await disconnect();
    store.setConnection(null);
    store.setConnectionStatus("disconnected");
    showDisconnectedUI();
    showToast(t("notification.disconnected"), "info");
  } catch (error) {
    showError("Disconnect", error instanceof Error ? error.message : "Failed to disconnect");
  }
});

// ─── Issue lookup ────────────────────────────────────
btnLookup.addEventListener("click", async () => {
  const raw = inputIssueKey.value.trim();
  if (!raw) return;

  const key = parseIssueKey(raw);
  if (!key) {
    issueError.textContent = t("clone.issueNotFound");
    issueError.classList.remove("hidden");
    return;
  }

  issueError.classList.add("hidden");
  setButtonLoading(btnLookup, true, "clone.lookUp");

  try {
    const issue = await fetchIssue(key);
    store.setCurrentIssue(issue);
    renderPreview(issue);
    hide(issueError);
    show(issuePreviewSection);
    store.setClonePhase("preview");
    show(cloneConfigSection);
  } catch (error) {
    issueError.textContent =
      typeof error === "string" ? error : error instanceof Error ? error.message : t("clone.issueNotFound");
    issueError.classList.remove("hidden");
    hide(issuePreviewSection);
    hide(cloneConfigSection);
  } finally {
    setButtonLoading(btnLookup, false, "clone.lookUp");
  }
});

inputIssueKey.addEventListener("keydown", (e) => {
  if (e.key === "Enter") btnLookup.click();
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

selectIssueType.addEventListener("change", () => {
  store.setSelectedIssueType(selectIssueType.value);
  checkMissingFields();
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
  };

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
  inputIssueKey.value = "";
  selectProject.value = "";
  selectIssueType.innerHTML = `<option value="">${t("clone.targetIssueTypePlaceholder")}</option>`;
});

btnRetry.addEventListener("click", () => {
  btnClone.click();
});

// ─── Init ────────────────────────────────────────────
async function init() {
  try {
    await setupI18n();
    updateUI();
    document.documentElement.style.visibility = "";
    await checkConnection();
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    showError("Nova Clone", `Init failed: ${msg}`);
  }
}

init();
