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
    if (isPlainObject(v) && isPlainObject(result[k])) {
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
