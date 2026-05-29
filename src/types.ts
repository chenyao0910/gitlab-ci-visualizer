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
