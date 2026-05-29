# GitLab CI Visualizer

Instantly visualize your `.gitlab-ci.yml` pipeline — stages, jobs, dependencies, and `include` expansion — right inside VS Code.

## Features

- **Auto-visualize** — opens the pipeline panel whenever you switch to or save a `.gitlab-ci.yml` file
- **`include` expansion** — recursively expands `include.local`, `include.project`, and `include.remote` before rendering
- **`extends` resolution** — fully merges inherited job properties so you see the complete effective configuration
- **Job detail panel** — click any job to see its `stage`, `image`, `script`, `needs`, `when`, and `rules`
- **Manual job badges** — manual jobs are visually distinct with a gray dot and MANUAL badge
- **`needs` indicators** — shows upstream job dependencies inline on each job card

## Getting Started

1. Install the extension
2. Open a workspace containing a `.gitlab-ci.yml` file
3. Click the **GitLab CI** icon in the Activity Bar to open the Pipeline Visualizer panel
4. Open any `.gitlab-ci.yml` — the pipeline renders automatically

## Configuration

| Setting | Default | Description |
|---|---|---|
| `gitlabCiVisualizer.instanceUrl` | `https://gitlab.com` | Your GitLab instance URL |

## GitLab Access Token

Required only for `include.project` (fetching files from other GitLab repositories).

Run the command **GitLab CI: Set Access Token** (`Ctrl+Shift+P`) and enter a Personal Access Token with `read_api` scope. The token is stored securely using VS Code's Secret Storage — never written to `settings.json`.

## Supported `include` Types

| Type | Status |
|---|---|
| `include.local` | ✅ Supported |
| `include.project` | ✅ Supported (requires token) |
| `include.remote` | ✅ Supported |
| `include.template` | ⏳ Planned |

## Commands

| Command | Description |
|---|---|
| `GitLab CI: Visualize Pipeline` | Manually trigger visualization of the active file |
| `GitLab CI: Set Access Token` | Store a GitLab Personal Access Token |

## Requirements

VS Code 1.90 or later.

## License

MIT
