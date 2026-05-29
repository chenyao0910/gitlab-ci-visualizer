# GitLab CI Visualizer — Design Spec

**Date:** 2026-05-29  
**Status:** Approved

---

## Background

Developers writing `.gitlab-ci.yml` struggle to verify stage order and job structure without running the pipeline, especially when `include` pulls in external templates across multiple files. This extension aims to: **open a `.gitlab-ci.yml`, immediately see the fully-expanded pipeline visualized.**

---

## Decisions

| Question | Decision |
|----------|----------|
| Distribution | VS Code Marketplace (public) |
| Webview refresh | Auto-refresh on every file save |
| Webview tech | esbuild + Vanilla TypeScript |
| Error behavior | Full-block error screen (no partial display) |
| Panel location | Secondary sidebar (WebviewViewProvider) |
| Architecture | Extension host owns all I/O; Webview is pure renderer |
| Node target | node20 / VS Code engines `^1.90.0` |
| Merge semantics | Follow GitLab rules exactly |

---

## Architecture

```
.gitlab-ci.yml saved
       │
       ▼
Extension Host (Node.js)
  ├── FileWatcher        onDidSaveTextDocument → trigger pipeline
  ├── Parser             js-yaml → raw YAML object
  ├── IncludeResolver    recursive include expansion
  │     ├── LocalResolver      → fs.readFile (workspace-relative)
  │     └── GitLabApiResolver  → HTTPS GET /api/v4/projects/.../files/...
  ├── Merger             deep merge per GitLab semantics
  └── PipelineExtractor  stages[] + jobs{} from merged YAML
       │
       │  postMessage({ type: 'update' | 'error' | 'loading', ... })
       ▼
Webview (Secondary Sidebar)
  ├── renderer.ts        message handler → DOM manipulation
  └── styles.css         card UI styles
```

**Key boundary:** Extension host owns all I/O (filesystem, network, SecretStorage). Webview receives JSON only and has zero side effects.

---

## Project Structure

```
gitlab-ci-visualizer/
├── src/
│   ├── extension.ts              # activate(): commands, FileWatcher, SidebarProvider
│   ├── visualizer/
│   │   ├── parser.ts             # js-yaml parse → raw YAML object
│   │   ├── includeResolver.ts    # recursive include expansion (orchestrator)
│   │   ├── localResolver.ts      # include.local → fs.readFile
│   │   ├── gitlabApiResolver.ts  # include.project → GitLab API
│   │   ├── merger.ts             # deep merge with GitLab semantics
│   │   └── pipelineExtractor.ts  # extract stages / jobs structure
│   └── webview/
│       ├── sidebarProvider.ts    # WebviewViewProvider implementation
│       ├── renderer.ts           # Webview-side TS (separate esbuild entry)
│       └── styles.css
├── test/
│   ├── parser.test.ts
│   ├── merger.test.ts
│   └── pipelineExtractor.test.ts
├── esbuild.js                    # two entries: extension + renderer
├── package.json
└── tsconfig.json
```

---

## Data Model

```typescript
// Extension host → Webview messages
type PipelineMessage =
  | { type: 'update'; pipeline: Pipeline }
  | { type: 'error'; message: string; detail?: string }
  | { type: 'loading' }

interface Pipeline {
  stages: string[]           // ordered, e.g. ['build', 'test', 'deploy']
  jobs: Record<string, Job>  // job name → job detail
}

interface Job {
  name: string
  stage: string
  script?: string[]
  image?: string
  needs?: string[]
  when?: string              // always | on_success | on_failure | manual | never
  rules?: Rule[]
  tags?: string[]
}

interface Rule {
  if?: string
  when?: string
  changes?: string[]
}
```

---

## YAML Merge Semantics (GitLab rules)

- Later `include` entries override earlier ones (same job name → last wins)
- `stages` array is **replaced entirely**, not concatenated
- `default` block is deep-merged
- `variables` are deep-merged (later overrides earlier)
- Max include recursion depth: **10 levels** (error on exceed, guards against circular includes)

---

## Include Types (MVP)

| Type | Resolution |
|------|-----------|
| `local: 'ci/build.yml'` | `fs.readFile` relative to workspace root |
| `project: 'group/repo'` + `file:` + `ref:` | GitLab API: `GET /api/v4/projects/:id/repository/files/:path/raw?ref=:ref` |
| `remote:` | Post-MVP |
| `template:` | Post-MVP |

---

## GitLab Settings

- `gitlabCiVisualizer.instanceUrl` (settings.json): GitLab instance URL, default `https://gitlab.com`
- Access token: stored via **VS Code SecretStorage API** (`context.secrets`), never in settings.json
- Command `GitLab CI: Set Access Token`: prompts user via `vscode.window.showInputBox`, stores with `context.secrets.store()`

---

## Error Handling

Full-block error screen on any include resolution failure. Specific messages:

| Scenario | User-facing message |
|----------|-------------------|
| YAML syntax error | Line number + js-yaml error text |
| `include.local` file not found | Path that was not found |
| `include.project` no token | "Run: GitLab CI: Set Access Token" |
| API 401/403 | Token lacks required permissions |
| API 404 | Project path or file path not found |
| Recursion depth > 10 | Possible circular include detected |

---

## Webview UI

- Secondary sidebar panel (`WebviewViewProvider`)
- Horizontal stage cards, arrow connectors between stages
- Each stage card lists its jobs with a green status dot
- Click job → expand inline detail panel showing: `stage`, `script` (line by line), `needs` (badge), `when`, `image`, `rules`
- Three top-level states: `loading` (spinner), `error` (full-block message + action hint), `pipeline` (card layout)
- State managed in two variables: `currentState` + `selectedJobId`

---

## Build Configuration

`esbuild.js` runs two bundles:
1. `src/extension.ts` → `dist/extension.js` (platform: node, target: node20, external: vscode)
2. `src/webview/renderer.ts` → `dist/renderer.js` (platform: browser)

Scripts in `package.json`:
- `"compile": "node esbuild.js"`
- `"watch": "node esbuild.js --watch"`
- `"test": "vitest run"`

---

## Testing

Unit tests with **vitest**:
- `parser.test.ts`: valid YAML, syntax errors, empty files, GitLab reserved keys
- `merger.test.ts`: job override, stages replacement, variables merge, default merge
- `pipelineExtractor.test.ts`: stages ordering, job-to-stage mapping, jobs without explicit stage

No mocked GitLab API tests. Integration covered by manual testing + error handling.

---

## MVP Scope

- [ ] Detect `.gitlab-ci.yml` and trigger visualization on save
- [ ] Parse `stages` and jobs, render card UI
- [ ] Support `include.local` (read workspace files)
- [ ] Support `include.project` (GitLab API, requires token)
- [ ] SecretStorage for token
- [ ] Click job to expand detail panel

## Post-MVP

- [ ] `include.remote` support
- [ ] `needs` dependency connectors
- [ ] `extends` expansion
- [ ] YAML linting / error markers
- [ ] `include.template` (GitLab official templates)
