import * as fs from 'fs/promises'
import * as path from 'path'

export async function resolveLocal(
  filePath: string,
  workspaceRoot: string
): Promise<string> {
  const relative = filePath.startsWith('/') ? filePath.slice(1) : filePath
  const absolute = path.join(workspaceRoot, relative)

  try {
    return await fs.readFile(absolute, 'utf-8')
  } catch (e: any) {
    if (e.code === 'ENOENT') {
      throw new Error(`include.local: file not found: ${filePath}`)
    }
    throw e
  }
}
