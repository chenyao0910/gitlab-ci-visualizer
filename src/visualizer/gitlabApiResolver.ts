import * as https from 'https'
import * as http from 'http'

export interface GitLabConfig {
  instanceUrl: string
  token: string | undefined
}

export async function resolveGitLabProject(
  project: string,
  file: string,
  ref: string,
  config: GitLabConfig
): Promise<string> {
  if (!config.token) {
    throw new Error(
      'include.project requires a GitLab access token.\nRun: GitLab CI: Set Access Token'
    )
  }

  const encodedProject = encodeURIComponent(project)
  const filePath = file.startsWith('/') ? file.slice(1) : file
  const encodedFile = encodeURIComponent(filePath)
  const base = config.instanceUrl.replace(/\/$/, '')
  const url = `${base}/api/v4/projects/${encodedProject}/repository/files/${encodedFile}/raw?ref=${encodeURIComponent(ref)}`

  return fetchWithToken(url, config.token)
}

function fetchWithToken(url: string, token: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const lib = parsed.protocol === 'https:' ? https : http

    const req = lib.get(url, { headers: { 'PRIVATE-TOKEN': token } }, (res) => {
      if (res.statusCode === 401 || res.statusCode === 403) {
        return reject(new Error(
          `GitLab API ${res.statusCode}: token lacks required permissions.\nRun: GitLab CI: Set Access Token`
        ))
      }
      if (res.statusCode === 404) {
        return reject(new Error(
          `GitLab API 404: project path or file path not found.\nURL: ${url}`
        ))
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`GitLab API error ${res.statusCode}: ${url}`))
      }

      const chunks: Buffer[] = []
      res.on('data', (chunk: Buffer) => chunks.push(chunk))
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
      res.on('error', reject)
    })

    req.on('error', reject)
    req.end()
  })
}
