import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads'
import Database from 'better-sqlite3'

if (isMainThread) {
  const dbPath = ':memory:'
  // execArgv ensures worker thread also inherits tsx loader
  const worker = new Worker(new URL(import.meta.url), {
    workerData: { dbPath },
    execArgv: ['--experimental-strip-types']
  })

  worker.on('message', (msg: { ok: boolean; result?: unknown; error?: string }) => {
    if (msg.ok) {
      console.log(`[PASS] Check 1 (better-sqlite3 in worker): result = ${JSON.stringify(msg.result)}`)
      process.exit(0)
    } else {
      console.error(`[FAIL] Check 1 (better-sqlite3 in worker): ${msg.error}`)
      process.exit(1)
    }
  })

  worker.on('error', (err) => {
    console.error(`[FAIL] Check 1 (better-sqlite3 in worker error):`, err)
    process.exit(1)
  })
} else {
  try {
    const { dbPath } = workerData as { dbPath: string }
    const db = new Database(dbPath)
    const row = db.prepare('SELECT 1 AS solution').get()
    db.close()
    parentPort?.postMessage({ ok: true, result: row })
  } catch (err: unknown) {
    parentPort?.postMessage({
      ok: false,
      error: err instanceof Error ? err.message : String(err)
    })
  }
}
