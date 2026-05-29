import { Pipeline, Job, Rule } from '../types'

const RESERVED_KEYS = new Set([
  'stages', 'include', 'variables', 'default', 'workflow',
  'image', 'services', 'before_script', 'after_script', 'cache',
])

export function extractPipeline(doc: Record<string, unknown>): Pipeline {
  const resolved = resolveExtends(doc)
  const stages = extractStages(resolved)
  const jobs = extractJobs(resolved)
  return { stages, jobs }
}

function resolveExtends(doc: Record<string, unknown>): Record<string, unknown> {
  const rawJobs: Record<string, Record<string, unknown>> = {}
  for (const [key, value] of Object.entries(doc)) {
    if (!RESERVED_KEYS.has(key) && isPlainObject(value)) {
      rawJobs[key] = value as Record<string, unknown>
    }
  }

  const resolved: Record<string, Record<string, unknown>> = {}

  function resolveJob(name: string, chain: Set<string>): Record<string, unknown> {
    if (resolved[name]) return resolved[name]
    if (chain.has(name)) return rawJobs[name] ?? {}

    const raw = rawJobs[name]
    if (!raw) return {}

    const parents = raw['extends']
    if (!parents) {
      resolved[name] = raw
      return raw
    }

    const parentNames = Array.isArray(parents) ? parents : [parents]
    const newChain = new Set(chain).add(name)

    let merged: Record<string, unknown> = {}
    for (const p of parentNames) {
      if (typeof p === 'string' && rawJobs[p]) {
        const parentResolved = resolveJob(p, newChain)
        merged = deepMerge(merged, parentResolved)
      }
    }
    const { extends: _ext, ...ownProps } = raw
    merged = deepMerge(merged, ownProps)
    resolved[name] = merged
    return merged
  }

  for (const name of Object.keys(rawJobs)) {
    resolveJob(name, new Set())
  }

  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(doc)) {
    if (RESERVED_KEYS.has(key) || !isPlainObject(value)) {
      result[key] = value
    } else {
      result[key] = resolved[key] ?? value
    }
  }
  return result
}

function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>
): Record<string, unknown> {
  const out = { ...target }
  for (const [key, val] of Object.entries(source)) {
    if (isPlainObject(val) && isPlainObject(out[key])) {
      out[key] = deepMerge(out[key] as Record<string, unknown>, val as Record<string, unknown>)
    } else {
      out[key] = val
    }
  }
  return out
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
