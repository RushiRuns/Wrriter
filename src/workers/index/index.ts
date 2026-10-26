import Database from 'better-sqlite3'
import { parentPort as threadParentPort } from 'worker_threads'

function handleQuery(sql: string): { ok: true; rows: unknown[] } | { ok: false; error: string } {
  try {
    const db = new Database(':memory:')
    const result = db.prepare(sql).all()
    db.close()
    return { ok: true, rows: result }
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

// 1. If running inside a Node worker_thread
if (threadParentPort) {
  threadParentPort.on('message', (msg: { type: string; sql?: string }) => {
    if (msg.type === 'query' && msg.sql) {
      const res = handleQuery(msg.sql)
      threadParentPort?.postMessage(res)
    }
  })
}

// 2. If running inside an Electron utilityProcess
if (process.parentPort) {
  process.parentPort.on('message', (e: { data: { type: string; sql?: string } }) => {
    const msg = e.data
    if (msg && msg.type === 'query' && msg.sql) {
      const res = handleQuery(msg.sql)
      process.parentPort?.postMessage(res)
    }
  })
}
