# GitLab CI Visualizer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a VS Code extension that parses `.gitlab-ci.yml` (expanding `include` directives) and displays the pipeline as stage/job cards in a secondary sidebar panel, auto-refreshing on every file save.

**Architecture:** Extension host owns all I/O (file reads, GitLab API calls, SecretStorage). On save, it resolves includes recursively, merges YAML docs per GitLab semantics, extracts pipeline structure, and sends a typed `postMessage` to the Webview. Webview is a pure renderer with zero side effects.

**Tech Stack:** TypeScript, VS Code Extension API, js-yaml, esbuild (two bundles: node20 extension host + browser webview renderer), Vanilla TS webview, vitest for unit tests.

---

## File Map

| File | Responsibility |
|------|---------------|
| `src/types.ts` | Shared types: `Pipeline`, `Job`, `Rule`, `PipelineMessage` |
| `src/extension.ts` | `activate()`: register commands, FileWatcher, SidebarProvider |
| `src/visualizer/parser.ts` | `parseYaml(content)` → raw YAML object via js-yaml |
| `src/visualizer/merger.ts` | `mergeDocuments(docs[])` → merged YAML per GitLab semantics |
| `src/visualizer/pipelineExtractor.ts` | `extractPipeline(doc)` → `Pipeline` |
| `src/visualizer/localResolver.ts` | `resolveLocal(path, workspaceRoot)` → file content string |
| `src/visualizer/gitlabApiResolver.ts` | `resolveGitLabProject(project, file, ref, config)` → file content string |
| `src/visualizer/includeResolver.ts` | `resolveIncludes(doc, ctx)` → `YamlDoc[]` (recursive, depth-limited) |
| `src/webview/sidebarProvider.ts` | `WebviewViewProvider` implementation, `postMessage()` |
| `src/webview/renderer.ts` | Webview-side TS: handles messages, renders DOM |
| `src/webview/styles.css` | Card UI styles using VS Code CSS variables |
| `esbuild.js` | Two-entry build script |
| `package.json` | Extension manifest, contributes, scripts, deps |
| `tsconfig.json` | Type-check only (noEmit), includes src + test |
| `vitest.config.ts` | Vitest config pointing to `test/` |
| `test/parser.test.ts` | Unit tests for parser |
| `test/merger.test.ts` | Unit tests for merger |
| `test/pipelineExtractor.test.ts` | Unit tests for pipelineExtractor |
| `resources/icon.svg` | Activity bar icon (16×16 SVG) |

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `esbuild.js`
- Create: `.gitignore`
- Create: `.vscodeignore`
- Create: `resources/icon.svg`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "gitlab-ci-visualizer",
  "displayName": "GitLab CI Visualizer",
  "description": "Visualize your GitLab CI pipeline with include expansion",
  "version": "0.1.0",
  "publisher": "your-publisher-id",
  "engines": { "vscode": "^1.90.0" },
  "categories": ["Other"],
  "activationEvents": [],
  "main": "./dist/extension.js",
  "contributes": {
    "viewsContainers": {
      "activitybar": [
        {
          "id": "gitlab-ci-panel",
          "title": "GitLab CI",
          "icon": "resources/icon.svg"
        }
      ]
    },
    "views": {
      "gitlab-ci-panel": [
        {
          "type": "webview",
          "id": "gitlabCiVisualizer.sidebar",
          "name": "Pipeline Visualizer"
        }
      ]
    },
    "commands": [
      {
        "command": "gitlabCiVisualizer.visualize",
        "title": "GitLab CI: Visualize Pipeline"
      },
      {
        "command": "gitlabCiVisualizer.setToken",
        "title": "GitLab CI: Set Access Token"
      }
    ],
    "configuration": {
      "title": "GitLab CI Visualizer",
      "properties": {
        "gitlabCiVisualizer.instanceUrl": {
          "type": "string",
          "default": "https://gitlab.com",
          "description": "GitLab instance URL (e.g. https://gitlab.yourcompany.com)"
        }
      }
    }
  },
  "scripts": {
    "compile": "node esbuild.js",
    "watch": "node esbuild.js --watch",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@types/js-yaml": "^4.0.9",
    "@types/node": "^20.0.0",
    "@types/vscode": "^1.90.0",
    "esbuild": "^0.21.0",
    "typescript": "^5.4.0",
    "vitest": "^1.6.0"
  },
  "dependencies": {
    "js-yaml": "^4.1.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2020",
    "lib": ["ES2020", "DOM"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "noEmit": true
  },
  "include": ["src/**/*", "test/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
  },
})
```

- [ ] **Step 4: Create `esbuild.js`**

```js
const esbuild = require('esbuild')
const watch = process.argv.includes('--watch')

async function build() {
  const baseConfig = {
    bundle: true,
    minify: false,
    sourcemap: true,
  }

  const configs = [
    {
      ...baseConfig,
      entryPoints: ['src/extension.ts'],
      platform: 'node',
      target: 'node20',
      outfile: 'dist/extension.js',
      external: ['vscode'],
      format: 'cjs',
    },
    {
      ...baseConfig,
      entryPoints: ['src/webview/renderer.ts'],
      platform: 'browser',
      outfile: 'dist/renderer.js',
      format: 'iife',
    },
  ]

  if (watch) {
    const contexts = await Promise.all(configs.map(c => esbuild.context(c)))
    await Promise.all(contexts.map(ctx => ctx.watch()))
    console.log('Watching for changes...')
  } else {
    await Promise.all(configs.map(c => esbuild.build(c)))
    console.log('Build complete')
  }
}

build().catch(() => process.exit(1))
```

- [ ] **Step 5: Create `.gitignore`**

```
node_modules/
dist/
*.vsix
.vscode-test/
```

- [ ] **Step 6: Create `.vscodeignore`**

```
.vscode/**
src/**
test/**
node_modules/**
esbuild.js
tsconfig.json
vitest.config.ts
*.map
docs/**
resources/**/*.md
```

- [ ] **Step 7: Create `resources/icon.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">
  <rect x="1" y="3" width="3" height="10" rx="1" fill="currentColor" opacity="0.7"/>
  <rect x="6" y="1" width="3" height="14" rx="1" fill="currentColor"/>
  <rect x="11" y="4" width="3" height="8" rx="1" fill="currentColor" opacity="0.7"/>
  <line x1="4" y1="8" x2="6" y2="8" stroke="currentColor" stroke-width="1"/>
  <line x1="9" y1="8" x2="11" y2="8" stroke="currentColor" stroke-width="1"/>
</svg>
```

- [ ] **Step 8: Install dependencies and verify build runs**

```bash
cd ~/gitlab-ci-visualizer
npm install
mkdir -p src/visualizer src/webview test dist
# Create stub files so esbuild can resolve entry points
echo 'export function activate() {}; export function deactivate() {}' > src/extension.ts
echo '// renderer stub' > src/webview/renderer.ts
node esbuild.js
```

Expected: `Build complete` with `dist/extension.js` and `dist/renderer.js` created.

- [ ] **Step 9: Commit**

```bash
git add package.json tsconfig.json vitest.config.ts esbuild.js .gitignore .vscodeignore resources/
git commit -m "feat: project scaffold with esbuild, TypeScript, vitest"
```

---

## Task 2: Shared Types

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: Create `src/types.ts`**

```typescript
export interface Pipeline {
  stages: string[]
  jobs: Record<string, Job>
}

export interface Job {
  name: string
  stage: string
  script?: string[]
  image?: string
  needs?: string[]
  when?: string
  rules?: Rule[]
  tags?: string[]
}

export interface Rule {
  if?: string
  when?: string
  changes?: string[]
}

export type PipelineMessage =
  | { type: 'update'; pipeline: Pipeline }
  | { type: 'error'; message: string; detail?: string }
  | { type: 'loading' }
```

- [ ] **Step 2: Commit**

```bash
git add src/types.ts
git commit -m "feat: shared Pipeline/Job/PipelineMessage types"
```

---

## Task 3: Parser (TDD)

**Files:**
- Create: `src/visualizer/parser.ts`
- Create: `test/parser.test.ts`

- [ ] **Step 1: Write the failing tests in `test/parser.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { parseYaml } from '../src/visualizer/parser'

describe('parseYaml', () => {
  it('parses a valid gitlab-ci.yml and returns stages', () => {
    const content = `
stages:
  - build
  - test
build-job:
  stage: build
  script:
    - npm run build
`
    const result = parseYaml(content)
    expect(result['stages']).toEqual(['build', 'test'])
  })

  it('returns empty object for empty content', () => {
    expect(parseYaml('')).toEqual({})
  })

  it('returns empty object for content that is only whitespace', () => {
    expect(parseYaml('   \n   ')).toEqual({})
  })

  it('throws with line number on YAML syntax error', () => {
    expect(() => parseYaml('key: [\ninvalid')).toThrow(/YAML parse error at line/)
  })

  it('preserves include keys (consumed later by resolver)', () => {
    const content = `
include:
  - local: 'ci/build.yml'
stages:
  - build
`
    const result = parseYaml(content)
    expect(result['include']).toBeDefined()
    expect(result['stages']).toEqual(['build'])
  })
})
```

- [ ] **Step 2: Run tests and verify they fail**

```bash
cd ~/gitlab-ci-visualizer
npm test
```

Expected: FAIL — `Cannot find module '../src/visualizer/parser'`

- [ ] **Step 3: Implement `src/visualizer/parser.ts`**

```typescript
import * as yaml from 'js-yaml'

export function parseYaml(content: string): Record<string, unknown> {
  if (!content.trim()) return {}

  try {
    const result = yaml.load(content)
    if (result === null || result === undefined) return {}
    if (typeof result !== 'object' || Array.isArray(result)) {
      throw new Error('YAML root must be a mapping object')
    }
    return result as Record<string, unknown>
  } catch (e) {
    if (e instanceof yaml.YAMLException) {
      const line = e.mark ? e.mark.line + 1 : '?'
      throw new Error(`YAML parse error at line ${line}: ${e.reason}`)
    }
    throw e
  }
}
```

- [ ] **Step 4: Run tests and verify they pass**

```bash
npm test
```

Expected: 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/visualizer/parser.ts test/parser.test.ts
git commit -m "feat: YAML parser with line-number error reporting"
```

---

## Task 4: Merger (TDD)

**Files:**
- Create: `src/visualizer/merger.ts`
- Create: `test/merger.test.ts`

- [ ] **Step 1: Write the failing tests in `test/merger.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { mergeDocuments } from '../src/visualizer/merger'

describe('mergeDocuments', () => {
  it('returns empty object for empty array', () => {
    expect(mergeDocuments([])).toEqual({})
  })

  it('later job overrides earlier job with same name', () => {
    const docs = [
      { 'build-job': { stage: 'build', script: ['echo first'] } },
      { 'build-job': { stage: 'build', script: ['echo second'] } },
    ]
    const result = mergeDocuments(docs)
    expect((result['build-job'] as any).script).toEqual(['echo second'])
  })

  it('stages is replaced entirely by later document, not concatenated', () => {
    const docs = [
      { stages: ['build', 'test'] },
      { stages: ['deploy'] },
    ]
    const result = mergeDocuments(docs)
    expect(result['stages']).toEqual(['deploy'])
  })

  it('variables are deep-merged, later values override earlier', () => {
    const docs = [
      { variables: { FOO: 'foo', BAR: 'bar' } },
      { variables: { BAR: 'baz', QUX: 'qux' } },
    ]
    const result = mergeDocuments(docs)
    expect(result['variables']).toEqual({ FOO: 'foo', BAR: 'baz', QUX: 'qux' })
  })

  it('default block is deep-merged, later values override earlier', () => {
    const docs = [
      { default: { image: 'node:20', retry: 2 } },
      { default: { image: 'node:22' } },
    ]
    const result = mergeDocuments(docs)
    expect(result['default']).toEqual({ image: 'node:22', retry: 2 })
  })

  it('include key is stripped from output', () => {
    const docs = [{ include: [{ local: 'ci/build.yml' }], stages: ['build'] }]
    const result = mergeDocuments(docs)
    expect(result['include']).toBeUndefined()
    expect(result['stages']).toEqual(['build'])
  })

  it('jobs from multiple documents are all present when names differ', () => {
    const docs = [
      { 'build-job': { stage: 'build' } },
      { 'test-job': { stage: 'test' } },
    ]
    const result = mergeDocuments(docs)
    expect(result['build-job']).toBeDefined()
    expect(result['test-job']).toBeDefined()
  })
})
```

- [ ] **Step 2: Run tests and verify they fail**

```bash
npm test
```

Expected: FAIL — `Cannot find module '../src/visualizer/merger'`

- [ ] **Step 3: Implement `src/visualizer/merger.ts`**

```typescript
type YamlDoc = Record<string, unknown>

export function mergeDocuments(docs: YamlDoc[]): YamlDoc {
  const result: YamlDoc = {}

  for (const doc of docs) {
    for (const [key, value] of Object.entries(doc)) {
      if (key === 'include') continue

      if (key === 'stages') {
        result[key] = value
      } else if (key === 'default' || key === 'variables') {
        result[key] = deepMergeObjects(
          (result[key] as Record<string, unknown>) ?? {},
          value as Record<string, unknown>
        )
      } else {
        result[key] = value
      }
    }
  }

  return result
}

function deepMergeObjects(
  base: Record<string, unknown>,
  override: Record<string, unknown>
): Record<string, unknown> {
  const result = { ...base }
  for (const [k, v] of Object.entries(override)) {
    if (
      isPlainObject(v) && isPlainObject(result[k])
    ) {
      result[k] = deepMergeObjects(
        result[k] as Record<string, unknown>,
        v as Record<string, unknown>
      )
    } else {
      result[k] = v
    }
  }
  return result
}

function isPlainObject(v: unknown): boolean {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}
```

- [ ] **Step 4: Run tests and verify they pass**

```bash
npm test
```

Expected: 7 merger tests + 5 parser tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/visualizer/merger.ts test/merger.test.ts
git commit -m "feat: YAML merger with GitLab merge semantics"
```

---

## Task 5: Pipeline Extractor (TDD)

**Files:**
- Create: `src/visualizer/pipelineExtractor.ts`
- Create: `test/pipelineExtractor.test.ts`

- [ ] **Step 1: Write the failing tests in `test/pipelineExtractor.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { extractPipeline } from '../src/visualizer/pipelineExtractor'

describe('extractPipeline', () => {
  it('extracts stages in declared order', () => {
    const doc = {
      stages: ['build', 'test', 'deploy'],
      'build-job': { stage: 'build', script: ['npm run build'] },
    }
    const { stages } = extractPipeline(doc)
    expect(stages).toEqual(['build', 'test', 'deploy'])
  })

  it('maps each job to its declared stage', () => {
    const doc = {
      stages: ['build', 'test'],
      'build-job': { stage: 'build', script: ['npm run build'] },
      'test-job': { stage: 'test', script: ['npm test'] },
    }
    const { jobs } = extractPipeline(doc)
    expect(jobs['build-job'].stage).toBe('build')
    expect(jobs['test-job'].stage).toBe('test')
  })

  it('defaults job stage to "test" when stage not specified', () => {
    const doc = {
      stages: ['test'],
      'my-job': { script: ['echo hi'] },
    }
    const { jobs } = extractPipeline(doc)
    expect(jobs['my-job'].stage).toBe('test')
  })

  it('skips GitLab reserved top-level keys (stages, variables, default, etc)', () => {
    const doc = {
      stages: ['build'],
      variables: { FOO: 'bar' },
      default: { image: 'node:20' },
      workflow: { rules: [] },
      'build-job': { stage: 'build', script: ['npm run build'] },
    }
    const { jobs } = extractPipeline(doc)
    expect(Object.keys(jobs)).toEqual(['build-job'])
  })

  it('extracts script as array', () => {
    const doc = {
      stages: ['build'],
      'build-job': { stage: 'build', script: ['step1', 'step2'] },
    }
    const { jobs } = extractPipeline(doc)
    expect(jobs['build-job'].script).toEqual(['step1', 'step2'])
  })

  it('extracts needs, image, when, tags', () => {
    const doc = {
      stages: ['build', 'test'],
      'test-job': {
        stage: 'test',
        image: 'node:20',
        needs: ['build-job'],
        when: 'on_success',
        tags: ['docker'],
        script: ['npm test'],
      },
    }
    const { jobs } = extractPipeline(doc)
    const job = jobs['test-job']
    expect(job.image).toBe('node:20')
    expect(job.needs).toEqual(['build-job'])
    expect(job.when).toBe('on_success')
    expect(job.tags).toEqual(['docker'])
  })

  it('infers stages from jobs when stages key is absent', () => {
    const doc = {
      'build-job': { stage: 'build', script: ['echo build'] },
      'test-job': { stage: 'test', script: ['echo test'] },
    }
    const { stages } = extractPipeline(doc)
    expect(stages).toContain('build')
    expect(stages).toContain('test')
  })
})
```

- [ ] **Step 2: Run tests and verify they fail**

```bash
npm test
```

Expected: FAIL — `Cannot find module '../src/visualizer/pipelineExtractor'`

- [ ] **Step 3: Implement `src/visualizer/pipelineExtractor.ts`**

```typescript
import { Pipeline, Job, Rule } from '../types'

const RESERVED_KEYS = new Set([
  'stages', 'include', 'variables', 'default', 'workflow',
  'image', 'services', 'before_script', 'after_script', 'cache',
])

export function extractPipeline(doc: Record<string, unknown>): Pipeline {
  const stages = extractStages(doc)
  const jobs = extractJobs(doc)
  return { stages, jobs }
}

function extractStages(doc: Record<string, unknown>): string[] {
  if (Array.isArray(doc['stages'])) {
    return doc['stages'] as string[]
  }
  const inferred = new Set<string>()
  for (const [key, value] of Object.entries(doc)) {
    if (!RESERVED_KEYS.has(key) && isPlainObject(value)) {
      const stage = (value as any).stage
      if (typeof stage === 'string') inferred.add(stage)
    }
  }
  return inferred.size > 0 ? Array.from(inferred) : ['test']
}

function extractJobs(doc: Record<string, unknown>): Record<string, Job> {
  const jobs: Record<string, Job> = {}

  for (const [key, value] of Object.entries(doc)) {
    if (RESERVED_KEYS.has(key) || !isPlainObject(value)) continue

    const raw = value as Record<string, unknown>
    const stage = typeof raw['stage'] === 'string' ? raw['stage'] : 'test'

    jobs[key] = {
      name: key,
      stage,
      script: toStringArray(raw['script']),
      image: resolveImage(raw['image']),
      needs: toStringArray(raw['needs']),
      when: typeof raw['when'] === 'string' ? raw['when'] : undefined,
      rules: Array.isArray(raw['rules']) ? (raw['rules'] as Rule[]) : undefined,
      tags: toStringArray(raw['tags']),
    }
  }

  return jobs
}

function resolveImage(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (isPlainObject(value) && typeof (value as any).name === 'string') {
    return (value as any).name
  }
  return undefined
}

function isPlainObject(v: unknown): boolean {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function toStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const strings = value.filter((v): v is string => typeof v === 'string')
  return strings.length > 0 ? strings : undefined
}
```

- [ ] **Step 4: Run all tests and verify they pass**

```bash
npm test
```

Expected: all tests PASS (parser 5 + merger 7 + extractor 7 = 19 total)

- [ ] **Step 5: Commit**

```bash
git add src/visualizer/pipelineExtractor.ts test/pipelineExtractor.test.ts
git commit -m "feat: pipeline extractor — stages and jobs from merged YAML"
```

---

## Task 6: Local Include Resolver

**Files:**
- Create: `src/visualizer/localResolver.ts`

No unit test (requires filesystem). Covered by integration and error handling.

- [ ] **Step 1: Create `src/visualizer/localResolver.ts`**

```typescript
import * as fs from 'fs/promises'
import * as path from 'path'

export async function resolveLocal(
  filePath: string,
  workspaceRoot: string
): Promise<string> {
  const relative = filePath.startsWith('/') ? filePath.slice(1) : filePath
  const absolute = path.join(workspaceRoot, relative)

  try {
    return await fs.readFile(absolute, 'utf-8')
  } catch (e: any) {
    if (e.code === 'ENOENT') {
      throw new Error(`include.local: file not found: ${filePath}`)
    }
    throw e
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/visualizer/localResolver.ts
git commit -m "feat: local include resolver (workspace-relative file reads)"
```

---

## Task 7: GitLab API Resolver

**Files:**
- Create: `src/visualizer/gitlabApiResolver.ts`

- [ ] **Step 1: Create `src/visualizer/gitlabApiResolver.ts`**

```typescript
import * as https from 'https'
import * as http from 'http'

export interface GitLabConfig {
  instanceUrl: string
  token: string | undefined
}

export async function resolveGitLabProject(
  project: string,
  file: string,
  ref: string,
  config: GitLabConfig
): Promise<string> {
  if (!config.token) {
    throw new Error(
      'include.project requires a GitLab access token.\nRun: GitLab CI: Set Access Token'
    )
  }

  const encodedProject = encodeURIComponent(project)
  const filePath = file.startsWith('/') ? file.slice(1) : file
  const encodedFile = encodeURIComponent(filePath)
  const base = config.instanceUrl.replace(/\/$/, '')
  const url = `${base}/api/v4/projects/${encodedProject}/repository/files/${encodedFile}/raw?ref=${encodeURIComponent(ref)}`

  return fetchWithToken(url, config.token)
}

function fetchWithToken(url: string, token: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const lib = parsed.protocol === 'https:' ? https : http

    const req = lib.get(url, { headers: { 'PRIVATE-TOKEN': token } }, (res) => {
      if (res.statusCode === 401 || res.statusCode === 403) {
        return reject(new Error(
          `GitLab API ${res.statusCode}: token lacks required permissions.\nRun: GitLab CI: Set Access Token`
        ))
      }
      if (res.statusCode === 404) {
        return reject(new Error(
          `GitLab API 404: project path or file path not found.\nURL: ${url}`
        ))
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`GitLab API error ${res.statusCode}: ${url}`))
      }

      const chunks: Buffer[] = []
      res.on('data', (chunk: Buffer) => chunks.push(chunk))
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
      res.on('error', reject)
    })

    req.on('error', reject)
    req.end()
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/visualizer/gitlabApiResolver.ts
git commit -m "feat: GitLab API resolver for include.project"
```

---

## Task 8: Include Resolver (Orchestrator)

**Files:**
- Create: `src/visualizer/includeResolver.ts`

- [ ] **Step 1: Create `src/visualizer/includeResolver.ts`**

```typescript
import { parseYaml } from './parser'
import { resolveLocal } from './localResolver'
import { resolveGitLabProject, GitLabConfig } from './gitlabApiResolver'

const MAX_DEPTH = 10

type YamlDoc = Record<string, unknown>

export interface ResolverContext {
  workspaceRoot: string
  gitlabConfig: GitLabConfig
}

export async function resolveIncludes(
  doc: YamlDoc,
  ctx: ResolverContext,
  depth = 0
): Promise<YamlDoc[]> {
  if (depth > MAX_DEPTH) {
    throw new Error(
      `include recursion exceeded ${MAX_DEPTH} levels — possible circular include`
    )
  }

  const raw = doc['include']
  if (!raw) return [doc]

  const entries = Array.isArray(raw) ? raw : [raw]
  const result: YamlDoc[] = [doc]

  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue

    let content: string

    if ('local' in entry) {
      content = await resolveLocal((entry as any).local, ctx.workspaceRoot)
    } else if ('project' in entry) {
      const e = entry as any
      content = await resolveGitLabProject(
        e.project,
        e.file ?? '/.gitlab-ci.yml',
        e.ref ?? 'HEAD',
        ctx.gitlabConfig
      )
    } else {
      continue
    }

    const childDoc = parseYaml(content)
    const childDocs = await resolveIncludes(childDoc, ctx, depth + 1)
    result.push(...childDocs)
  }

  return result
}
```

- [ ] **Step 2: Commit**

```bash
git add src/visualizer/includeResolver.ts
git commit -m "feat: recursive include resolver (local + project, depth limit 10)"
```

---

## Task 9: Webview Styles

**Files:**
- Create: `src/webview/styles.css`

- [ ] **Step 1: Create `src/webview/styles.css`**

```css
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: var(--vscode-font-family);
  font-size: var(--vscode-font-size);
  color: var(--vscode-foreground);
  background: var(--vscode-sideBar-background);
  padding: 8px;
  overflow-x: auto;
}

/* ── Loading ── */
.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  gap: 12px;
  color: var(--vscode-descriptionForeground);
}

.spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--vscode-progressBar-background);
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ── Error ── */
.error {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  background: var(--vscode-inputValidation-errorBackground);
  border: 1px solid var(--vscode-inputValidation-errorBorder);
  border-radius: 4px;
}

.error-icon { font-size: 20px; }

.error-message {
  font-weight: 600;
  white-space: pre-wrap;
  word-break: break-word;
}

.error-detail {
  font-size: 0.85em;
  color: var(--vscode-descriptionForeground);
  white-space: pre-wrap;
}

/* ── Pipeline ── */
.pipeline {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 0;
  padding-bottom: 8px;
}

.stage-wrapper {
  display: flex;
  flex-direction: row;
  align-items: center;
}

.stage-card {
  min-width: 110px;
  border: 1px solid var(--vscode-panel-border);
  border-radius: 4px;
  background: var(--vscode-editor-background);
  overflow: hidden;
}

.stage-name {
  font-size: 0.72em;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 5px 8px;
  background: var(--vscode-badge-background);
  color: var(--vscode-badge-foreground);
  text-align: center;
}

.jobs {
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.job-card {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 7px;
  border-radius: 3px;
  cursor: pointer;
  transition: background 0.1s;
  user-select: none;
}

.job-card:hover {
  background: var(--vscode-list-hoverBackground);
}

.job-card.selected {
  background: var(--vscode-list-activeSelectionBackground);
  color: var(--vscode-list-activeSelectionForeground);
}

.job-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #31af64;
  flex-shrink: 0;
}

.job-name {
  font-size: 0.82em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 90px;
}

.arrow {
  padding: 0 5px;
  color: var(--vscode-descriptionForeground);
  font-size: 16px;
  flex-shrink: 0;
}

/* ── Job detail panel ── */
.job-detail {
  margin-top: 12px;
  border: 1px solid var(--vscode-panel-border);
  border-radius: 4px;
  background: var(--vscode-editor-background);
  overflow: hidden;
}

.job-detail.hidden { display: none; }

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 10px;
  background: var(--vscode-badge-background);
  color: var(--vscode-badge-foreground);
}

.detail-title {
  font-weight: 700;
  font-size: 0.88em;
}

.detail-close {
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  font-size: 13px;
  padding: 0 2px;
  opacity: 0.7;
  line-height: 1;
}

.detail-close:hover { opacity: 1; }

.detail-row {
  display: flex;
  gap: 8px;
  padding: 5px 10px;
  border-bottom: 1px solid var(--vscode-panel-border);
  font-size: 0.82em;
  align-items: flex-start;
}

.detail-row:last-child { border-bottom: none; }

.detail-label {
  font-weight: 700;
  min-width: 52px;
  color: var(--vscode-descriptionForeground);
  flex-shrink: 0;
}

.needs-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.badge {
  padding: 1px 6px;
  background: var(--vscode-badge-background);
  color: var(--vscode-badge-foreground);
  border-radius: 10px;
  font-size: 0.8em;
}

.script-lines {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-family: var(--vscode-editor-font-family);
}

.script-line {
  padding: 1px 0;
  white-space: pre-wrap;
  word-break: break-all;
}

.rules-pre {
  font-family: var(--vscode-editor-font-family);
  font-size: 0.85em;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--vscode-descriptionForeground);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/webview/styles.css
git commit -m "feat: webview CSS using VS Code theme variables"
```

---

## Task 10: Webview Renderer

**Files:**
- Create: `src/webview/renderer.ts`

- [ ] **Step 1: Create `src/webview/renderer.ts`**

```typescript
import { Pipeline, Job, PipelineMessage } from '../types'

let selectedJobId: string | null = null
let currentPipeline: Pipeline | null = null

window.addEventListener('message', (event: MessageEvent<PipelineMessage>) => {
  const msg = event.data
  if (msg.type === 'loading') renderLoading()
  else if (msg.type === 'error') renderError(msg.message, msg.detail)
  else if (msg.type === 'update') renderPipeline(msg.pipeline)
})

function renderLoading(): void {
  selectedJobId = null
  currentPipeline = null
  getApp().innerHTML = `
    <div class="loading">
      <div class="spinner"></div>
      <p>Loading pipeline...</p>
    </div>`
}

function renderError(message: string, detail?: string): void {
  selectedJobId = null
  currentPipeline = null
  getApp().innerHTML = `
    <div class="error">
      <div class="error-icon">⚠</div>
      <p class="error-message">${esc(message)}</p>
      ${detail ? `<p class="error-detail">${esc(detail)}</p>` : ''}
    </div>`
}

function renderPipeline(pipeline: Pipeline): void {
  currentPipeline = pipeline
  const app = getApp()

  const jobsByStage: Record<string, Job[]> = {}
  for (const stage of pipeline.stages) jobsByStage[stage] = []
  for (const job of Object.values(pipeline.jobs)) {
    if (!jobsByStage[job.stage]) jobsByStage[job.stage] = []
    jobsByStage[job.stage].push(job)
  }

  app.innerHTML = `
    <div class="pipeline">
      ${pipeline.stages.map((stage, i) => `
        <div class="stage-wrapper">
          <div class="stage-card">
            <div class="stage-name">${esc(stage)}</div>
            <div class="jobs">
              ${(jobsByStage[stage] ?? []).map(job => `
                <div class="job-card" data-job="${esc(job.name)}">
                  <span class="job-dot"></span>
                  <span class="job-name" title="${esc(job.name)}">${esc(job.name)}</span>
                </div>`).join('')}
            </div>
          </div>
          ${i < pipeline.stages.length - 1 ? '<div class="arrow">›</div>' : ''}
        </div>`).join('')}
    </div>
    <div id="job-detail" class="job-detail hidden"></div>`

  app.querySelectorAll<HTMLElement>('.job-card').forEach(card => {
    card.addEventListener('click', () => {
      if (currentPipeline) toggleDetail(card.dataset.job!, currentPipeline)
    })
  })
}

function toggleDetail(jobName: string, pipeline: Pipeline): void {
  const detail = document.getElementById('job-detail')!

  if (selectedJobId === jobName) {
    selectedJobId = null
    detail.classList.add('hidden')
    document.querySelectorAll('.job-card').forEach(c => c.classList.remove('selected'))
    return
  }

  selectedJobId = jobName
  document.querySelectorAll<HTMLElement>('.job-card').forEach(c =>
    c.classList.toggle('selected', c.dataset.job === jobName)
  )

  const job = pipeline.jobs[jobName]
  detail.classList.remove('hidden')
  detail.innerHTML = `
    <div class="detail-header">
      <span class="detail-title">${esc(job.name)}</span>
      <button class="detail-close" id="detail-close-btn">✕</button>
    </div>
    <div class="detail-row">
      <span class="detail-label">stage</span>
      <span>${esc(job.stage)}</span>
    </div>
    ${job.image ? `
    <div class="detail-row">
      <span class="detail-label">image</span>
      <span>${esc(job.image)}</span>
    </div>` : ''}
    ${job.when ? `
    <div class="detail-row">
      <span class="detail-label">when</span>
      <span>${esc(job.when)}</span>
    </div>` : ''}
    ${job.needs?.length ? `
    <div class="detail-row">
      <span class="detail-label">needs</span>
      <div class="needs-badges">${job.needs.map(n => `<span class="badge">${esc(n)}</span>`).join('')}</div>
    </div>` : ''}
    ${job.script?.length ? `
    <div class="detail-row">
      <span class="detail-label">script</span>
      <div class="script-lines">${job.script.map(s => `<div class="script-line">${esc(s)}</div>`).join('')}</div>
    </div>` : ''}
    ${job.rules?.length ? `
    <div class="detail-row">
      <span class="detail-label">rules</span>
      <pre class="rules-pre">${esc(JSON.stringify(job.rules, null, 2))}</pre>
    </div>` : ''}`

  document.getElementById('detail-close-btn')!.addEventListener('click', () => {
    selectedJobId = null
    detail.classList.add('hidden')
    document.querySelectorAll('.job-card').forEach(c => c.classList.remove('selected'))
  })
}

function getApp(): HTMLElement {
  return document.getElementById('app')!
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
```

- [ ] **Step 2: Verify build still works**

```bash
npm run compile
```

Expected: `Build complete` — both `dist/extension.js` and `dist/renderer.js` updated.

- [ ] **Step 3: Commit**

```bash
git add src/webview/renderer.ts
git commit -m "feat: webview renderer — loading/error/pipeline states with job detail panel"
```

---

## Task 11: Sidebar Provider

**Files:**
- Create: `src/webview/sidebarProvider.ts`

- [ ] **Step 1: Create `src/webview/sidebarProvider.ts`**

```typescript
import * as vscode from 'vscode'
import { PipelineMessage } from '../types'

export class SidebarProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView

  constructor(private readonly extensionUri: vscode.Uri) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.view = webviewView

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, 'dist'),
        vscode.Uri.joinPath(this.extensionUri, 'src', 'webview'),
      ],
    }

    webviewView.webview.html = this.buildHtml(webviewView.webview)
  }

  postMessage(message: PipelineMessage): void {
    this.view?.webview.postMessage(message)
  }

  private buildHtml(webview: vscode.Webview): string {
    const rendererUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'renderer.js')
    )
    const stylesUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'src', 'webview', 'styles.css')
    )
    const nonce = getNonce()

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none';
             style-src ${webview.cspSource};
             script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="${stylesUri}">
  <title>GitLab CI Pipeline</title>
</head>
<body>
  <div id="app"></div>
  <script nonce="${nonce}" src="${rendererUri}"></script>
</body>
</html>`
  }
}

function getNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  return Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}
```

- [ ] **Step 2: Commit**

```bash
git add src/webview/sidebarProvider.ts
git commit -m "feat: WebviewViewProvider with CSP nonce and resource URIs"
```

---

## Task 12: Extension Entry Point

**Files:**
- Modify: `src/extension.ts` (replace stub)

- [ ] **Step 1: Replace `src/extension.ts` with the full implementation**

```typescript
import * as vscode from 'vscode'
import { SidebarProvider } from './webview/sidebarProvider'
import { parseYaml } from './visualizer/parser'
import { resolveIncludes } from './visualizer/includeResolver'
import { mergeDocuments } from './visualizer/merger'
import { extractPipeline } from './visualizer/pipelineExtractor'
import { PipelineMessage } from './types'

export function activate(context: vscode.ExtensionContext): void {
  const sidebar = new SidebarProvider(context.extensionUri)

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('gitlabCiVisualizer.sidebar', sidebar)
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('gitlabCiVisualizer.setToken', async () => {
      const token = await vscode.window.showInputBox({
        prompt: 'Enter your GitLab Personal Access Token (read_api scope)',
        password: true,
        ignoreFocusOut: true,
        placeHolder: 'glpat-xxxxxxxxxxxxxxxxxxxx',
      })
      if (token !== undefined) {
        await context.secrets.store('gitlabCiVisualizer.token', token)
        vscode.window.showInformationMessage('GitLab CI Visualizer: access token saved.')
      }
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('gitlabCiVisualizer.visualize', () => {
      const doc = vscode.window.activeTextEditor?.document
      if (doc && isGitlabCi(doc)) {
        triggerUpdate(doc, context, sidebar)
      } else {
        vscode.window.showWarningMessage('Open a .gitlab-ci.yml file first.')
      }
    })
  )

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(doc => {
      if (isGitlabCi(doc)) triggerUpdate(doc, context, sidebar)
    })
  )
}

function isGitlabCi(doc: vscode.TextDocument): boolean {
  return doc.fileName.endsWith('.gitlab-ci.yml')
}

async function triggerUpdate(
  document: vscode.TextDocument,
  context: vscode.ExtensionContext,
  sidebar: SidebarProvider
): Promise<void> {
  sidebar.postMessage({ type: 'loading' })

  try {
    const workspaceRoot =
      vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath ?? ''
    const token = await context.secrets.get('gitlabCiVisualizer.token')
    const instanceUrl =
      vscode.workspace.getConfiguration('gitlabCiVisualizer')
        .get<string>('instanceUrl') ?? 'https://gitlab.com'

    const rootDoc = parseYaml(document.getText())
    const docs = await resolveIncludes(rootDoc, {
      workspaceRoot,
      gitlabConfig: { instanceUrl, token },
    })
    const merged = mergeDocuments(docs)
    const pipeline = extractPipeline(merged)

    sidebar.postMessage({ type: 'update', pipeline })
  } catch (e: any) {
    const msg: PipelineMessage = {
      type: 'error',
      message: e.message ?? 'Unknown error',
    }
    sidebar.postMessage(msg)
  }
}

export function deactivate(): void {}
```

- [ ] **Step 2: Run full build and all tests**

```bash
npm run compile && npm test
```

Expected: `Build complete` + all 19 tests PASS

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

Expected: No TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/extension.ts
git commit -m "feat: extension entry point — FileWatcher, commands, activate/deactivate"
```

---

## Task 13: End-to-End Smoke Test

No automated test — manual verification in VS Code.

- [ ] **Step 1: Open the extension in VS Code's Extension Development Host**

Press `F5` in VS Code (with the `gitlab-ci-visualizer` folder open). A new VS Code window opens.

In the Extension Development Host window:
1. Click the GitLab CI icon in the activity bar (pipeline icon). The sidebar panel opens showing a blank state.
2. Open or create a `.gitlab-ci.yml` file with this content:

```yaml
stages:
  - build
  - test
  - deploy

build-job:
  stage: build
  image: node:20
  script:
    - npm install
    - npm run build

test-job:
  stage: test
  needs: [build-job]
  script:
    - npm test

deploy-job:
  stage: deploy
  when: manual
  script:
    - echo "deploying"
```

3. Save the file (Cmd+S). Expected: sidebar shows 3 stage cards (build → test → deploy) each with their jobs.
4. Click `build-job`. Expected: detail panel shows stage, image, script lines.
5. Click `test-job`. Expected: detail panel updates, shows `needs: [build-job]` badge.
6. Click `test-job` again. Expected: detail panel closes.

- [ ] **Step 2: Test error state**

Edit the file to introduce a YAML syntax error (e.g. add `bad: [` at the end). Save.
Expected: sidebar shows full-block error with line number.

Fix the syntax error and save. Expected: pipeline renders again.

- [ ] **Step 3: Test Set Access Token command**

Open the Command Palette (`Cmd+Shift+P`), run `GitLab CI: Set Access Token`.
Expected: input box appears asking for token. Enter any value. Expected: "access token saved" notification.

- [ ] **Step 4: Commit final state**

```bash
git add -A
git commit -m "chore: verify end-to-end smoke test complete"
```

---

## Notes

- **Secondary sidebar:** VS Code doesn't allow extensions to force views into the secondary sidebar. After installing, users can drag the "GitLab CI" activity bar icon to the secondary sidebar via View → Appearance → Secondary Side Bar.
- **`include.remote` and `include.template`:** Not implemented in MVP. The resolver silently skips these entry types. Add in post-MVP.
- **Publisher ID:** Replace `"your-publisher-id"` in `package.json` before publishing to Marketplace. Create at https://marketplace.visualstudio.com/manage.
