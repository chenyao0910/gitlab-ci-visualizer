import { Pipeline, Job, PipelineMessage } from '../types'

let selectedJobId: string | null = null
let currentPipeline: Pipeline | null = null

window.addEventListener('message', (event: MessageEvent<PipelineMessage>) => {
  const msg = event.data
  if (msg.type === 'loading') renderLoading()
  else if (msg.type === 'error') renderError(msg.message, msg.detail)
  else if (msg.type === 'update') renderPipeline(msg.pipeline)
})

function renderLoading(): void {
  selectedJobId = null
  currentPipeline = null
  getApp().innerHTML = `
    <div class="loading">
      <div class="spinner"></div>
      <p>Loading pipeline...</p>
    </div>`
}

function renderError(message: string, detail?: string): void {
  selectedJobId = null
  currentPipeline = null
  getApp().innerHTML = `
    <div class="error">
      <div class="error-icon">⚠</div>
      <p class="error-message">${esc(message)}</p>
      ${detail ? `<p class="error-detail">${esc(detail)}</p>` : ''}
    </div>`
}

function renderPipeline(pipeline: Pipeline): void {
  currentPipeline = pipeline
  const app = getApp()

  const jobsByStage: Record<string, Job[]> = {}
  for (const stage of pipeline.stages) jobsByStage[stage] = []
  for (const job of Object.values(pipeline.jobs)) {
    if (!jobsByStage[job.stage]) jobsByStage[job.stage] = []
    jobsByStage[job.stage].push(job)
  }

  app.innerHTML = `
    <div class="pipeline">
      ${pipeline.stages.map((stage, i) => `
        <div class="stage-wrapper">
          <div class="stage-card">
            <div class="stage-name">${esc(stage)}</div>
            <div class="jobs">
              ${(jobsByStage[stage] ?? []).map(job => `
                <div class="job-card" data-job="${esc(job.name)}">
                  <span class="job-dot"></span>
                  <span class="job-name" title="${esc(job.name)}">${esc(job.name)}</span>
                </div>`).join('')}
            </div>
          </div>
          ${i < pipeline.stages.length - 1 ? '<div class="arrow">›</div>' : ''}
        </div>`).join('')}
    </div>
    <div id="job-detail" class="job-detail hidden"></div>`

  app.querySelectorAll<HTMLElement>('.job-card').forEach(card => {
    card.addEventListener('click', () => {
      if (currentPipeline) toggleDetail(card.dataset.job!, currentPipeline)
    })
  })
}

function toggleDetail(jobName: string, pipeline: Pipeline): void {
  const detail = document.getElementById('job-detail')!

  if (selectedJobId === jobName) {
    selectedJobId = null
    detail.classList.add('hidden')
    document.querySelectorAll('.job-card').forEach(c => c.classList.remove('selected'))
    return
  }

  selectedJobId = jobName
  document.querySelectorAll<HTMLElement>('.job-card').forEach(c =>
    c.classList.toggle('selected', c.dataset.job === jobName)
  )

  const job = pipeline.jobs[jobName]
  detail.classList.remove('hidden')
  detail.innerHTML = `
    <div class="detail-header">
      <span class="detail-title">${esc(job.name)}</span>
      <button class="detail-close" id="detail-close-btn">✕</button>
    </div>
    <div class="detail-row">
      <span class="detail-label">stage</span>
      <span>${esc(job.stage)}</span>
    </div>
    ${job.image ? `
    <div class="detail-row">
      <span class="detail-label">image</span>
      <span>${esc(job.image)}</span>
    </div>` : ''}
    ${job.when ? `
    <div class="detail-row">
      <span class="detail-label">when</span>
      <span>${esc(job.when)}</span>
    </div>` : ''}
    ${job.needs?.length ? `
    <div class="detail-row">
      <span class="detail-label">needs</span>
      <div class="needs-badges">${job.needs.map(n => `<span class="badge">${esc(n)}</span>`).join('')}</div>
    </div>` : ''}
    ${job.script?.length ? `
    <div class="detail-row">
      <span class="detail-label">script</span>
      <div class="script-lines">${job.script.map(s => `<div class="script-line">${esc(s)}</div>`).join('')}</div>
    </div>` : ''}
    ${job.rules?.length ? `
    <div class="detail-row">
      <span class="detail-label">rules</span>
      <pre class="rules-pre">${esc(JSON.stringify(job.rules, null, 2))}</pre>
    </div>` : ''}`

  document.getElementById('detail-close-btn')!.addEventListener('click', () => {
    selectedJobId = null
    detail.classList.add('hidden')
    document.querySelectorAll('.job-card').forEach(c => c.classList.remove('selected'))
  })
}

function getApp(): HTMLElement {
  return document.getElementById('app')!
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
