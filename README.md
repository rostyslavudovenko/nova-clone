# Nova Clone

A desktop app for cloning Jira Cloud issues. Paste an issue key, pick a target project and issue type, and clone with comments, attachments, and issue links — all without leaving your desk.

Built with **Tauri v2**, **Vite 8**, **TypeScript 6**, and **SCSS**. The Rust backend handles all Jira REST API v3 calls; the frontend communicates via Tauri's IPC bridge. Clone history is persisted locally using `tauri-plugin-store`.

## How It Works

1. **Connect** — enter your Jira Cloud site URL, email, and an [Atlassian API token](https://id.atlassian.com/manage-profile/security/api-tokens)
2. **Look Up** — paste an issue key (e.g. `ABC-123`) or a full Jira URL; the app fetches a preview with summary, type, status, and assignee
3. **Configure** — select the target project and issue type, choose which system fields to copy (summary, description, priority), and toggle clone options (comments, attachments, link to original)
4. **Clone** — the Rust backend orchestrates the full clone pipeline with real-time progress events

The app supports both English and Ukrainian interfaces and remembers your connection across restarts.

## Features

- Connect to any Jira Cloud instance via email + API token
- Look up issues by key or URL with instant preview
- Clone to any accessible project and issue type (paginated project list, auto-refreshes on view switch)
- Copy comments from source to cloned issue
- Copy attachments (download from source, upload to clone)
- Link cloned issue to original via "Relates" link type
- Smart field transformation — skips system fields, rank fields, entity references, and user arrays; optionally copies `summary`, `description`, `priority`, and non-empty custom fields via selectable System Fields checkboxes
- Real-time clone progress with step-by-step status
- Clone history with open-in-browser, timestamps, and status
- Desktop notifications on clone completion and errors
- Connection persistence across app restarts
- System notification and error handling with typed error classes

## Jira REST API Endpoints

Nova Clone uses the **Jira Cloud REST API v3** (`/rest/api/3/...`). All HTTP calls are made server-side from the Rust backend via `reqwest` with HTTP Basic Auth.

| Endpoint                                             | Method | Purpose                                 | Docs                                                                                                                                                                               |
| ---------------------------------------------------- | ------ | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/rest/api/3/myself`                                 | GET    | Validate credentials on connect         | [docs.atlassian.com](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-myself/#api-rest-api-3-myself-get)                                                      |
| `/rest/api/3/issue/{key}`                            | GET    | Fetch source issue details              | [docs.atlassian.com](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/#api-rest-api-3-issue-issueidorkey-get)                                          |
| `/rest/api/3/project/search`                         | GET    | List accessible projects (paginated)    | [docs.atlassian.com](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-project-search/#api-rest-api-3-project-search-get)                                      |
| `/rest/api/3/project`                                | GET    | List projects (fallback)                | [docs.atlassian.com](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-projects/#api-rest-api-3-project-get)                                                   |
| `/rest/api/3/issue/createmeta/{key}/issuetypes`      | GET    | Get issue types for a project           | [docs.atlassian.com](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-types/#api-rest-api-3-issue-createmeta-projectidorkey-issuetypes-get)             |
| `/rest/api/3/issue/createmeta?projectKeys=...`       | GET    | Get issue types (fallback)              | [docs.atlassian.com](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/)                                                                                |
| `/rest/api/3/issue/createmeta/{key}/issuetypes/{id}` | GET    | Fetch required fields for an issue type | [docs.atlassian.com](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-types/#api-rest-api-3-issue-createmeta-projectidorkey-issuetypes-issuetypeid-get) |
| `/rest/api/3/issue`                                  | POST   | Create the cloned issue                 | [docs.atlassian.com](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/#api-rest-api-3-issue-post)                                                      |
| `/rest/api/3/issue/{key}/comment`                    | GET    | Fetch comments from source              | [docs.atlassian.com](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-comments/#api-rest-api-3-issue-issueidorkey-comment-get)                          |
| `/rest/api/3/issue/{key}/comment`                    | POST   | Add comment to cloned issue             | [docs.atlassian.com](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-comments/#api-rest-api-3-issue-issueidorkey-comment-post)                         |
| `/rest/api/3/issue/{key}?fields=attachment`          | GET    | Get attachment metadata                 | [docs.atlassian.com](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-attachments/)                                                                     |
| `/rest/api/3/issue/{key}/attachments`                | POST   | Upload attachment to cloned issue       | [docs.atlassian.com](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-attachments/#api-rest-api-3-issue-issueidorkey-attachments-post)                  |
| `/rest/api/3/issueLink`                              | POST   | Link cloned issue to original           | [docs.atlassian.com](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-links/#api-rest-api-3-issuelink-post)                                             |

Attachment binaries are downloaded via their dynamic `content` URL from the attachment metadata response, then uploaded as multipart form data with the `X-Atlassian-Token: no-check` header.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) ≥ 20
- [Rust](https://rustup.rs/) (stable)
- [Tauri prerequisites](https://tauri.app/start/prerequisites/) for your OS

### Installation

1. Clone the repository:

```bash
git clone https://github.com/rostyslavudovenko/nova-clone.git
cd nova-clone
```

2. Install dependencies:

```bash
npm install
```

3. Run in development mode:

```bash
npm run tauri:dev
```

### Build

```bash
npm run tauri:build
```

The installer will be in `src-tauri/target/release/bundle/`.

### Development Commands

| Command                 | Description                                            |
| ----------------------- | ------------------------------------------------------ |
| `npm run dev`           | Start Vite dev server only (browser preview, no Tauri) |
| `npm run tauri:dev`     | Start full Tauri app in development mode               |
| `npm run tauri:build`   | Build production app bundle                            |
| `npm run build`         | Build frontend only (Vite)                             |
| `npm run test`          | Run all tests once (Vitest)                            |
| `npm run test:watch`    | Run tests in watch mode                                |
| `npm run release:patch` | Bump patch version and sync across all config files    |
| `npm run release:minor` | Bump minor version                                     |
| `npm run release:major` | Bump major version                                     |

Version bumping runs `sync-version.mjs` automatically via the `version` npm lifecycle hook, which updates `package.json`, `tauri.conf.json`, `Cargo.toml`, `Cargo.lock`, and HTML files in sync, and stages them in git.

## Build Pipeline

The frontend is built with **Vite 8** as a single-page app with one entry point:

```
index.html → main.ts (connect, clone, history, settings — view switching via CSS)
```

- All TypeScript is transpiled by Vite's esbuild-based pipeline
- SCSS files are compiled to CSS via `sass-embedded` with Vite's built-in Sass support
- The frontend is served from `dist/` in production, embedded into the Tauri binary
- `__APP_VERSION__` is injected at build time from `package.json` via Vite's `define`

The Rust backend is compiled with `profile.release` optimizations:

- `lto = true`, `opt-level = "s"` (size-optimized), `strip = true`, `codegen-units = 1`

## Architecture

The app is a single-page application — clone, history, and settings views live in `index.html` and are toggled via CSS class switching. No frontend framework is used.

- **State management:** A reactive store built with [Zustand](https://github.com/pmndrs/zustand) (vanilla engine) using a subscription-based observable pattern. Pages re-render automatically when relevant state changes.
- **Backend communication:** All Jira calls go through Tauri's `invoke()` IPC bridge to Rust commands. The TypeScript layer never makes direct HTTP requests.
- **Clone orchestration:** The Rust backend (`src-tauri/src/clone/mod.rs`) runs the full pipeline — fetch source, transform fields, create issue, copy comments, copy attachments, link issues — emitting progress events via Tauri's event system.
- **Field transformation:** System fields (id, key, created, status, project, issuetype, reporter, assignee, etc.) are skipped. Rank fields, entity references, user arrays, and empty values are filtered out. `summary`, `description`, `priority.id`, and non-empty custom fields are optionally copied based on user-selected System Fields checkboxes.
- **Localization (i18n):** Strings are extracted to `en.json` and `uk.json`, loaded dynamically at startup. HTML elements use `data-i18n` attributes; code calls `t("key", {params})` for interpolation.
- **Error handling:** Typed error classes with `showError()` helper and inline toast notifications. All async operations are wrapped in try/catch with user-visible feedback.
- **Data storage:** Connection config and clone history are persisted via `tauri-plugin-store` in `nova-clone.json`.

## Testing

Run all tests:

```bash
npm run test
```

Tests are written with [Vitest](https://vitest.dev/) and located alongside their source files:

- `src/core/state.test.ts` — `parseIssueKey()` URL and key parsing
- `src/core/store.test.ts` — reactive store methods, subscriptions, state mutations
- `src/core/validate.test.ts` — form validation (uses `happy-dom`)
- `src/core/errors.test.ts` — error class hierarchy and retry logic

## File Structure

```
nova-clone/
├── public/                          # Static assets (icon.svg)
├── src-tauri/                       # Rust / Tauri backend
│   ├── capabilities/
│   │   └── default.json             # Tauri permission declarations
│   ├── icons/                       # App icons (PNG, ICO, ICNS)
│   ├── src/
│   │   ├── auth/
│   │   │   └── mod.rs               # Credential validation (/rest/api/3/myself)
│   │   ├── jira/
│   │   │   └── mod.rs               # All Jira REST API v3 calls
│   │   ├── clone/
│   │   │   └── mod.rs               # Clone orchestration and progress events
│   │   ├── commands.rs              # Tauri command handlers
│   │   ├── lib.rs                   # Plugin registration and app setup
│   │   └── main.rs                  # Entry point
│   ├── build.rs
│   ├── Cargo.toml                   # Rust dependencies
│   └── tauri.conf.json              # Tauri app configuration
├── src/
│   ├── core/
│   │   ├── i18n/
│   │   │   ├── locales/
│   │   │   │   ├── en.json          # English localization
│   │   │   │   └── uk.json          # Ukrainian localization
│   │   │   └── i18n.ts              # Translation loader, t(), updateUI()
│   │   ├── jira-client.ts           # Frontend API layer (invoke wrappers)
│   │   ├── connection-ui.ts         # Connection UI flow
│   │   ├── state.ts                 # Types (JiraIssue, CloneConfig, etc.)
│   │   ├── store.ts                 # Reactive store with subscriptions
│   │   ├── notify.ts                # System notification helper
│   │   ├── errors.ts                # Typed error classes, showError(), withRetry()
│   │   ├── validate.ts              # Form validation
│   │   ├── storage/
│   │   │   └── store-access.ts      # Shared getStore(), STORE_FILE
│   │   ├── state.test.ts            # Tests for state utilities
│   │   ├── store.test.ts            # Tests for reactive store
│   │   ├── validate.test.ts         # Tests for form validation
│   │   └── errors.test.ts           # Tests for error classes and retry logic
│   ├── ui/
│   │   ├── toast.ts                 # Toast notification component
│   │   ├── confirm-dialog.ts        # Confirm dialog (Promise<boolean>)
│   │   └── styles/
│   │       ├── base/                # Reset, typography, globals
│   │       ├── components/          # Buttons, cards, inputs, table, badges, toast, confirm-dialog, progress
│   │       ├── layout/              # Sidebar, container, grid
│   │       ├── media/               # Responsive breakpoints
│   │       ├── pages/               # Page-specific styles (connect, clone, history, settings)
│   │       ├── themes/              # CSS variables (--primary: #6366f1)
│   │       └── main.scss            # SCSS entry point
│   ├── vite-env.d.ts                # Type declarations
│   └── main.ts                      # App logic (connect, clone, history, settings)
├── index.html                       # Single-page app (all views)
├── sync-version.mjs                 # Version sync script across all config files
├── package.json
├── tsconfig.json                    # TypeScript configuration
├── vite.config.ts                   # Vite + Vitest configuration
└── .github/workflows/
    └── build.yml                    # CI/CD: builds on v* tags for Ubuntu, macOS, Windows
```

## Data Storage

Clone history and connection config are stored via `tauri-plugin-store` in `nova-clone.json`, located at:

- **macOS:** `~/Library/Application Support/com.novaclone.dev/`
- **Windows:** `%APPDATA%\com.novaclone.dev\`
- **Linux:** `~/.local/share/com.novaclone.dev/`

## Third-party Assets

- **Desktop framework:** [Tauri](https://tauri.app/), used under the [MIT License](https://github.com/tauri-apps/tauri/blob/dev/LICENSE_MIT)
- **Typography:** [Inter](https://fonts.google.com/specimen/Inter) by [Rasmus Andersson](https://rsms.me/inter/), used under the [SIL Open Font License](https://scripts.sil.org/OFL)
- **HTTP client (Rust):** [reqwest](https://github.com/seanmonstar/reqwest), used under the [MIT License](https://github.com/seanmonstar/reqwest/blob/master/LICENSE)
- **Date/Time handling (Rust):** [chrono](https://github.com/chronotope/chrono), used under the [MIT License](https://github.com/chronotope/chrono/blob/main/LICENSE-MIT)
- **Serialization (Rust):** [serde](https://github.com/serde-rs/serde) and [serde_json](https://github.com/serde-rs/json), used under the [MIT License](https://github.com/serde-rs/serde/blob/master/LICENSE-MIT)
- **State management (JS/TS):** [Zustand](https://github.com/pmndrs/zustand), used under the [MIT License](https://github.com/pmndrs/zustand/blob/main/LICENSE)
- **Tauri plugins:** [notification](https://github.com/tauri-apps/plugins-workspace/tree/v2/plugins/notification), [shell](https://github.com/tauri-apps/plugins-workspace/tree/v2/plugins/shell), and [store](https://github.com/tauri-apps/plugins-workspace/tree/v2/plugins/store), used under the [MIT License](https://github.com/tauri-apps/plugins-workspace/blob/v2/LICENSE)

## License

Licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

Made with ❤️ by [Rostyslav Udovenko](mailto:rostyslavudovenko@icloud.com)
