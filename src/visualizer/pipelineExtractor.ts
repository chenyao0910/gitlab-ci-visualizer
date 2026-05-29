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
