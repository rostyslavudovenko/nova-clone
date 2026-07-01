import type {
  ConnectionConfig,
  JiraIssue,
  ProjectSummary,
  IssueTypeMeta,
  CloneConfig,
  CloneResult,
  ProgressEvent,
  ConnectionStatus,
  ClonePhase,
} from "./state";

interface AppState {
  connectionStatus: ConnectionStatus;
  connection: ConnectionConfig | null;
  connectError: string | null;

  currentIssue: JiraIssue | null;
  projects: ProjectSummary[];
  issueTypes: IssueTypeMeta[];
  selectedProject: string | null;
  selectedIssueType: string | null;

  cloneConfig: CloneConfig;
  clonePhase: ClonePhase;
  cloneProgress: ProgressEvent[];
  cloneResult: CloneResult | null;
  cloneError: string | null;
}

type Listener = () => void;

function createInitialCloneConfig(): CloneConfig {
  return {
    sourceIssueKey: "",
    targetProjectKey: "",
    targetIssueTypeId: "",
    copyComments: true,
    copyAttachments: false,
    copyLinks: true,
  };
}

function createInitialState(): AppState {
  return {
    connectionStatus: "disconnected",
    connection: null,
    connectError: null,

    currentIssue: null,
    projects: [],
    issueTypes: [],
    selectedProject: null,
    selectedIssueType: null,

    cloneConfig: createInitialCloneConfig(),
    clonePhase: "idle",
    cloneProgress: [],
    cloneResult: null,
    cloneError: null,
  };
}

function createStore() {
  const _state = createInitialState();
  const listeners = new Set<Listener>();

  function subscribe(fn: Listener): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function notify(): void {
    listeners.forEach((fn) => fn());
  }

  function reset(): void {
    const fresh = createInitialState();
    Object.assign(_state, fresh);
    notify();
  }

  function setConnectionStatus(status: ConnectionStatus): void {
    _state.connectionStatus = status;
    notify();
  }

  function setConnection(config: ConnectionConfig | null): void {
    _state.connection = config;
    notify();
  }

  function setConnectError(error: string | null): void {
    _state.connectError = error;
    notify();
  }

  function setCurrentIssue(issue: JiraIssue | null): void {
    _state.currentIssue = issue;
    notify();
  }

  function setProjects(projects: ProjectSummary[]): void {
    _state.projects = projects;
    notify();
  }

  function setIssueTypes(types: IssueTypeMeta[]): void {
    _state.issueTypes = types;
    notify();
  }

  function setSelectedProject(key: string | null): void {
    _state.selectedProject = key;
    _state.cloneConfig.targetProjectKey = key ?? "";
    notify();
  }

  function setSelectedIssueType(id: string | null): void {
    _state.selectedIssueType = id;
    _state.cloneConfig.targetIssueTypeId = id ?? "";
    notify();
  }

  function setCloneConfig(config: Partial<CloneConfig>): void {
    Object.assign(_state.cloneConfig, config);
    notify();
  }

  function setClonePhase(phase: ClonePhase): void {
    _state.clonePhase = phase;
    notify();
  }

  function addProgressEvent(event: ProgressEvent): void {
    _state.cloneProgress.push(event);
    notify();
  }

  function setCloneResult(result: CloneResult | null): void {
    _state.cloneResult = result;
    notify();
  }

  function setCloneError(error: string | null): void {
    _state.cloneError = error;
    notify();
  }

  function resetClone(): void {
    _state.clonePhase = "idle";
    _state.cloneProgress = [];
    _state.cloneResult = null;
    _state.cloneError = null;
    _state.cloneConfig = createInitialCloneConfig();
    _state.currentIssue = null;
    _state.selectedProject = null;
    _state.selectedIssueType = null;
    _state.issueTypes = [];
    notify();
  }

  return {
    get state(): Readonly<AppState> {
      return _state;
    },
    subscribe,
    reset,
    setConnectionStatus,
    setConnection,
    setConnectError,
    setCurrentIssue,
    setProjects,
    setIssueTypes,
    setSelectedProject,
    setSelectedIssueType,
    setCloneConfig,
    setClonePhase,
    addProgressEvent,
    setCloneResult,
    setCloneError,
    resetClone,
  };
}

export const store = createStore();
