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
