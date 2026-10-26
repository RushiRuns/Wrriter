import { app, BrowserWindow, ipcMain, session } from 'electron'
import { join } from 'path'

// 1. Single running copy check
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
}

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 500,
    show: false,
    frame: false,
    backgroundColor: '#18181A',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // Prevent white flash: show only when first frame is ready
  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  // Deny new windows & navigation
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  mainWindow.webContents.on('will-navigate', (event) => {
    event.preventDefault()
  })

  // Load URL in dev mode or file in production
  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(async () => {
  // Check for packaged Day-One SQLite test flag
  if (process.argv.includes('--test-sqlite')) {
    const Database = (await import('better-sqlite3')).default
    const { Worker } = await import('worker_threads')
    const { utilityProcess } = await import('electron')

    const fs = await import('fs')
    const logPath = join(process.cwd(), 'day-one-sqlite-packaged.log')
    const logs: string[] = []
    const log = (msg: string): void => {
      console.log(msg)
      logs.push(msg)
    }

    log('=== PACKAGED DAY-ONE CHECK 1: better-sqlite3 and Worker Types ===')
    try {
      const db = new Database(':memory:')
      const row = db.prepare('SELECT 1 + 1 AS solution, sqlite_version() AS version').get() as {
        solution: number
        version: string
      }
      log(`[PASS] Packaged Main Process: solution = ${row.solution}, version = ${row.version}`)
      db.close()
    } catch (err: unknown) {
      log(`[FAIL] Packaged Main Process: ${err instanceof Error ? err.message : String(err)}`)
    }

    const workerScript = join(__dirname, 'worker-index.js')
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
      log(`[PASS] Packaged Node worker_threads: ${JSON.stringify(threadResult)}`)
    } catch (err: unknown) {
      log(`[FAIL] Packaged Node worker_threads: ${err instanceof Error ? err.message : String(err)}`)
    }

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
      log(`[PASS] Packaged Electron utilityProcess: ${JSON.stringify(utilityResult)}`)
    } catch (err: unknown) {
      log(`[FAIL] Packaged Electron utilityProcess: ${err instanceof Error ? err.message : String(err)}`)
    }

    log('=== END PACKAGED DAY-ONE CHECK 1 ===')
    fs.writeFileSync(logPath, logs.join('\n'), 'utf8')
    app.quit()
    return
  }

  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false)
  })

  // IPC handlers for window controls
  ipcMain.on('window.minimize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    win?.minimize()
  })

  ipcMain.on('window.maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win?.isMaximized()) {
      win.unmaximize()
    } else {
      win?.maximize()
    }
  })

  ipcMain.on('window.close', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    win?.close()
  })

  ipcMain.handle('window.isMaximized', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    return win?.isMaximized() ?? false
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
