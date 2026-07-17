import { createStore } from "zustand/vanilla";
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

export type CloneMode = "single" | "multiple";

interface AppState {
  connectionStatus: ConnectionStatus;
  connection: ConnectionConfig | null;
  connectError: string | null;

  currentIssue: JiraIssue | null;
  currentIssueKeys: string[];
  projects: ProjectSummary[];
  issueTypes: IssueTypeMeta[];
  selectedProject: string | null;
  selectedIssueType: string | null;

  cloneMode: CloneMode;
  cloneConfig: CloneConfig;
  clonePhase: ClonePhase;
  cloneProgress: ProgressEvent[];
  cloneResult: CloneResult | null;
  cloneError: string | null;
}

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
    currentIssueKeys: [],
    projects: [],
    issueTypes: [],
    selectedProject: null,
    selectedIssueType: null,

    cloneMode: "single",
    cloneConfig: createInitialCloneConfig(),
    clonePhase: "idle",
    cloneProgress: [],
    cloneResult: null,
    cloneError: null,
  };
}

const zustandStore = createStore<AppState>()(() => createInitialState());

export const store = {
  get state(): Readonly<AppState> {
    return zustandStore.getState();
  },
  subscribe(fn: () => void): () => void {
    return zustandStore.subscribe(fn);
  },
  reset() {
    zustandStore.setState(createInitialState(), true);
  },
  setConnectionStatus(status: ConnectionStatus) {
    zustandStore.setState({ connectionStatus: status });
  },
  setConnection(config: ConnectionConfig | null) {
    zustandStore.setState({ connection: config });
  },
  setConnectError(error: string | null) {
    zustandStore.setState({ connectError: error });
  },
  setCurrentIssue(issue: JiraIssue | null) {
    zustandStore.setState({ currentIssue: issue });
  },
  setCurrentIssueKeys(keys: string[]) {
    zustandStore.setState({ currentIssueKeys: keys });
  },
  setCloneMode(mode: CloneMode) {
    zustandStore.setState({ cloneMode: mode });
  },
  setProjects(projects: ProjectSummary[]) {
    zustandStore.setState({ projects });
  },
  setIssueTypes(types: IssueTypeMeta[]) {
    zustandStore.setState({ issueTypes: types });
  },
  setSelectedProject(key: string | null) {
    zustandStore.setState((state) => ({
      selectedProject: key,
      cloneConfig: { ...state.cloneConfig, targetProjectKey: key ?? "" },
    }));
  },
  setSelectedIssueType(id: string | null) {
    zustandStore.setState((state) => ({
      selectedIssueType: id,
      cloneConfig: { ...state.cloneConfig, targetIssueTypeId: id ?? "" },
    }));
  },
  setCloneConfig(config: Partial<CloneConfig>) {
    zustandStore.setState((state) => ({
      cloneConfig: { ...state.cloneConfig, ...config },
    }));
  },
  setClonePhase(phase: ClonePhase) {
    zustandStore.setState({ clonePhase: phase });
  },
  addProgressEvent(event: ProgressEvent) {
    zustandStore.setState((state) => ({
      cloneProgress: [...state.cloneProgress, event],
    }));
  },
  setCloneResult(result: CloneResult | null) {
    zustandStore.setState({ cloneResult: result });
  },
  setCloneError(error: string | null) {
    zustandStore.setState({ cloneError: error });
  },
  resetClone() {
    zustandStore.setState({
      clonePhase: "idle",
      cloneProgress: [],
      cloneResult: null,
      cloneError: null,
      cloneConfig: createInitialCloneConfig(),
      currentIssue: null,
      currentIssueKeys: [],
      selectedProject: null,
      selectedIssueType: null,
      issueTypes: [],
    });
  },
};
