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
