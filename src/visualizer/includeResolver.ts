import * as https from 'https'
import * as http from 'http'
import { parseYaml } from './parser'
import { resolveLocal } from './localResolver'
import { resolveGitLabProject, GitLabConfig } from './gitlabApiResolver'

const MAX_DEPTH = 10

type YamlDoc = Record<string, unknown>

export interface ResolverContext {
  workspaceRoot: string
  gitlabConfig: GitLabConfig
}

function resolveRemote(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const lib = parsed.protocol === 'https:' ? https : http
    const req = lib.get(url, res => {
      if (res.statusCode !== 200) {
        reject(new Error(`include.remote: HTTP ${res.statusCode} for ${url}`))
        res.resume()
        return
      }
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    })
    req.setTimeout(10_000, () => {
      req.destroy()
      reject(new Error(`include.remote: timeout fetching ${url}`))
    })
    req.on('error', reject)
  })
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
    } else if ('remote' in entry) {
      content = await resolveRemote((entry as any).remote)
    } else {
      continue
    }

    const childDoc = parseYaml(content)
    const childDocs = await resolveIncludes(childDoc, ctx, depth + 1)
    result.push(...childDocs)
  }

  return result
}
