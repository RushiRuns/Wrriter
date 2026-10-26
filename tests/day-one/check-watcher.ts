import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

async function runCheckWatcher(): Promise<void> {
  const tmpDir = path.join(os.tmpdir(), `wrriter-check-watcher-${Date.now()}`)
  fs.mkdirSync(tmpDir, { recursive: true })

  const FILE_COUNT = 1000
  console.log(`[Check 2] Creating ${FILE_COUNT} temp files in ${tmpDir}...`)
  for (let i = 0; i < FILE_COUNT; i++) {
    fs.writeFileSync(path.join(tmpDir, `test-note-${i.toString().padStart(4, '0')}.md`), 'Hello Wrriter')
  }

  const deleteEvents: string[] = []
  const uniqueFilesDeleted = new Set<string>()

  // Start watching the directory with Node's fs.watch
  const watcher = fs.watch(tmpDir, { recursive: true }, (eventType, filename) => {
    if (filename) {
      deleteEvents.push(`${eventType}:${filename}`)
      uniqueFilesDeleted.add(filename)
    }
  })

  // Short pause for watcher to attach
  await new Promise((resolve) => setTimeout(resolve, 500))

  console.log(`[Check 2] Deleting all ${FILE_COUNT} files...`)
  const startTime = Date.now()
  for (let i = 0; i < FILE_COUNT; i++) {
    fs.unlinkSync(path.join(tmpDir, `test-note-${i.toString().padStart(4, '0')}.md`))
  }

  // Count how many events arrive in 5 seconds
  console.log('[Check 2] Waiting 5 seconds to collect watcher events...')
  await new Promise((resolve) => setTimeout(resolve, 5000))

  watcher.close()
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  } catch {
    // Ignore cleanup error
  }

  const duration = Date.now() - startTime
  const totalEvents = deleteEvents.length
  const uniqueCount = uniqueFilesDeleted.size
  const lost = FILE_COUNT - uniqueCount

  console.log(`[Check 2] Results:`)
  console.log(`  - Files created & deleted: ${FILE_COUNT}`)
  console.log(`  - Total watch events received: ${totalEvents}`)
  console.log(`  - Unique deleted files observed: ${uniqueCount} / ${FILE_COUNT}`)
  console.log(`  - Events lost: ${lost > 0 ? `${lost} files missed (${((lost / FILE_COUNT) * 100).toFixed(1)}% loss)` : 'None (0% loss)'}`)

  if (lost === 0) {
    console.log(`[PASS] Check 2: Node fs.watch received all 1000 delete events with 0 lost in ${duration}ms.`)
  } else {
    console.log(`[PASS] Check 2 baseline recorded: Node fs.watch captured ${uniqueCount}/${FILE_COUNT} delete events (${lost} lost). Baseline confirmed for M1 watcher comparison.`)
  }
}

runCheckWatcher().catch((err) => {
  console.error('[FAIL] Check 2 encountered error:', err)
  process.exit(1)
})
