const fs = require('fs')
const path = require('path')

const TEST_DIR = path.join(__dirname, '..', 'day-one-tmp', 'vault-50k')
const FILE_COUNT = 50000

function cleanup() {
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true, force: true })
  }
}

async function runWatcherCheck() {
  console.log('=== DAY-ONE CHECK 2: File Watcher & 50,000 Files Check ===')
  cleanup()
  fs.mkdirSync(TEST_DIR, { recursive: true })

  // 1. Benchmark 50,000 file creation
  console.log(`Generating ${FILE_COUNT} markdown files in ${TEST_DIR}...`)
  const startCreate = Date.now()
  const BATCH_SIZE = 5000
  for (let batch = 0; batch < FILE_COUNT / BATCH_SIZE; batch++) {
    const subfolder = path.join(TEST_DIR, `folder-${batch}`)
    fs.mkdirSync(subfolder, { recursive: true })
    for (let i = 0; i < BATCH_SIZE; i++) {
      const filePath = path.join(subfolder, `note-${i}.md`)
      fs.writeFileSync(filePath, `# Note ${i}\n\nContent for note ${i} in batch ${batch}.`, 'utf8')
    }
  }
  const createDuration = Date.now() - startCreate
  console.log(`Created ${FILE_COUNT} files across 10 folders in ${createDuration} ms.`)

  // --- CANDIDATE 1: Node fs.watch (recursive: true on Windows) ---
  console.log('\n--- Testing Candidate 1: Node native fs.watch ---')
  const memBeforeFs = process.memoryUsage().rss / (1024 * 1024)
  let fsEvents = 0
  let fsWatchError = null
  const fsWatcher = fs.watch(TEST_DIR, { recursive: true }, (eventType, filename) => {
    fsEvents++
  })
  fsWatcher.on('error', (err) => {
    fsWatchError = err
  })

  // Modify 100 files to check event reception
  for (let i = 0; i < 100; i++) {
    fs.appendFileSync(path.join(TEST_DIR, 'folder-0', `note-${i}.md`), '\nEdited line')
  }
  await new Promise((r) => setTimeout(r, 1000))
  const memAfterFs = process.memoryUsage().rss / (1024 * 1024)
  fsWatcher.close()
  console.log(`fs.watch received ${fsEvents} events for 100 edits. Memory overhead: ~${(memAfterFs - memBeforeFs).toFixed(2)} MB. Errors: ${fsWatchError || 'None'}`)

  // --- CANDIDATE 2: @parcel/watcher ---
  console.log('\n--- Testing Candidate 2: @parcel/watcher (C++ native ReadDirectoryChangesW) ---')
  let parcelWatcher = null
  let parcelEvents = 0
  let parcelMemDelta = 0
  try {
    const watcher = require('@parcel/watcher')
    const memBeforeParcel = process.memoryUsage().rss / (1024 * 1024)
    const subscription = await watcher.subscribe(TEST_DIR, (err, events) => {
      if (err) console.error('Parcel watcher error:', err)
      else parcelEvents += events.length
    })

    // Modify 100 files
    for (let i = 100; i < 200; i++) {
      fs.appendFileSync(path.join(TEST_DIR, 'folder-0', `note-${i}.md`), '\nEdited line for parcel')
    }
    await new Promise((r) => setTimeout(r, 1000))
    const memAfterParcel = process.memoryUsage().rss / (1024 * 1024)
    parcelMemDelta = memAfterParcel - memBeforeParcel
    await subscription.unsubscribe()
    console.log(`@parcel/watcher subscribed and received ${parcelEvents} events. Memory overhead: ~${parcelMemDelta.toFixed(2)} MB.`)
  } catch (err) {
    console.error('@parcel/watcher test failed:', err)
  }

  // --- CANDIDATE 3: chokidar ---
  console.log('\n--- Testing Candidate 3: chokidar (JS-level directory watcher) ---')
  let chokidarEvents = 0
  let chokidarMemDelta = 0
  try {
    const chokidar = require('chokidar')
    const memBeforeChokidar = process.memoryUsage().rss / (1024 * 1024)
    const startChokidar = Date.now()
    const chokidarWatcher = chokidar.watch(TEST_DIR, {
      ignoreInitial: true,
      depth: 3
    })

    await new Promise((resolve) => {
      chokidarWatcher.on('ready', resolve)
    })
    const chokidarInitTime = Date.now() - startChokidar

    chokidarWatcher.on('change', () => {
      chokidarEvents++
    })

    // Modify 100 files
    for (let i = 200; i < 300; i++) {
      fs.appendFileSync(path.join(TEST_DIR, 'folder-0', `note-${i}.md`), '\nEdited line for chokidar')
    }
    await new Promise((r) => setTimeout(r, 1000))
    const memAfterChokidar = process.memoryUsage().rss / (1024 * 1024)
    chokidarMemDelta = memAfterChokidar - memBeforeChokidar
    await chokidarWatcher.close()
    console.log(`chokidar ready in ${chokidarInitTime} ms, received ${chokidarEvents} events. Memory overhead: ~${chokidarMemDelta.toFixed(2)} MB.`)
  } catch (err) {
    console.error('chokidar test failed:', err)
  }

  // --- Test Full Rescan Fallback (Features 6 / 9) ---
  console.log('\n--- Testing Fallback: Full rescan by modified time and size ---')
  const startScan = Date.now()
  let scannedCount = 0
  function scanDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        scanDir(fullPath)
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        const stats = fs.statSync(fullPath)
        scannedCount++
      }
    }
  }
  scanDir(TEST_DIR)
  const scanDuration = Date.now() - startScan
  console.log(`Full rescan of ${scannedCount} files completed in ${scanDuration} ms.`)

  cleanup()
  console.log('\nCleaned up 50,000 test files.')
  console.log('=== END DAY-ONE CHECK 2 ===')
}

runWatcherCheck().catch((err) => {
  console.error('Watcher check failed:', err)
  cleanup()
  process.exit(1)
})
