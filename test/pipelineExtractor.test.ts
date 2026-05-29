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
