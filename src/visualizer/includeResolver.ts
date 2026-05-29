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
