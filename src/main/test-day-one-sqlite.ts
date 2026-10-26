import { app, utilityProcess } from 'electron'
import { Worker } from 'worker_threads'
import Database from 'better-sqlite3'
import { join } from 'path'

app.whenReady().then(async () => {
  console.log('=== DAY-ONE CHECK 1: better-sqlite3 and Worker Types ===')

  // Test 1: Main Process
  try {
    const db = new Database(':memory:')
    const row = db.prepare('SELECT 1 + 1 AS solution, sqlite_version() AS version').get() as {
      solution: number
      version: string
    }
    console.log(
      `[PASS] Main Process query succeeded: solution = ${row.solution}, SQLite version = ${row.version}`
    )
    db.close()
  } catch (err: unknown) {
    console.error(`[FAIL] Main Process query failed:`, err)
  }

  // Test 2: Node worker_threads
  const workerScript = join(__dirname, '../workers/index.js')
  try {
    const threadResult = await new Promise<{ ok: boolean; rows?: unknown[]; error?: string }>(
      (resolve, reject) => {
        const worker = new Worker(workerScript)
        worker.on('message', (msg) => {
          worker.terminate()
          resolve(msg)
        })
        worker.on('error', reject)
        worker.postMessage({
          type: 'query',
          sql: "SELECT 40 + 2 AS solution, 'worker_threads' AS env"
        })
      }
    )
    console.log(`[PASS] Node worker_threads query succeeded:`, JSON.stringify(threadResult))
  } catch (err: unknown) {
    console.error(`[FAIL] Node worker_threads query failed:`, err)
  }

  // Test 3: Electron utilityProcess
  try {
    const utilityResult = await new Promise<{ ok: boolean; rows?: unknown[]; error?: string }>(
      (resolve, reject) => {
        const child = utilityProcess.fork(workerScript)
        child.on('message', (msg) => {
          child.kill()
          resolve(msg as { ok: boolean; rows?: unknown[]; error?: string })
        })
        child.on('error', reject)
        child.postMessage({
          type: 'query',
          sql: "SELECT 99 + 1 AS solution, 'utilityProcess' AS env"
        })
      }
    )
    console.log(`[PASS] Electron utilityProcess query succeeded:`, JSON.stringify(utilityResult))
  } catch (err: unknown) {
    console.error(`[FAIL] Electron utilityProcess query failed:`, err)
  }

  console.log('=== END DAY-ONE CHECK 1 ===')
  app.quit()
})
