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
