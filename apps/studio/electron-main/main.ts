import { app, BrowserWindow, ipcMain, Menu, webContents } from 'electron'
import { join } from 'path'
import { fileURLToPath } from 'url'
import {
  FileSystemService,
  FileSystemPathValidator,
  FileWatcher,
  IpcServer,
  getContractRegistry,
  createIpcError,
  shellPingContract,
  shellCaptureContract,
  fsReadContract,
  fsListContract,
  watcherSubscribeContract,
  watcherEventChannel,
  makeChannel,
  type Capability,
  type ShellPingReq,
  type ShellCaptureReq,
  type FsReadReq,
  type FsListReq,
  type WatcherSubscribeReq,
} from '@ray-studio/core'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

let mainWindow: BrowserWindow | null = null
let ipcServer: IpcServer | null = null
let fsService: FileSystemService | null = null
let watcher: FileWatcher | null = null

// 013 IPC Framework owns all channels. Legacy ShellIPC removed (now in contracts).


function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),  // built to .js
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#0f172a', // slate-900 dark default
  })

  // Load renderer
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'))
  }

  // Open DevTools in dev only (production gate: remove or gate behind env)
  if (process.env.NODE_ENV === 'development' || process.env.ELECTRON_RENDERER_URL) {
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Basic menu (keyboard-first, minimal)
  const template = [
    {
      label: 'Ray Studio',
      submenu: [
        { role: 'about' as const },
        { type: 'separator' as const },
        { role: 'quit' as const },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' as const },
        { role: 'redo' as const },
        { type: 'separator' as const },
        { role: 'cut' as const },
        { role: 'copy' as const },
        { role: 'paste' as const },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' as const },
        { role: 'forceReload' as const },
        { role: 'toggleDevTools' as const },
      ],
    },
  ]
  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)

  // 013: grant narrow caps for this window (shell + fs + watcher for demo)
  if (ipcServer) {
    ipcServer.grant(mainWindow.webContents.id, ['shell', 'fs', 'watcher'])
  }
}

// Initialize privileged services (main process only) + 013 IPC
function initPrivilegedServices() {
  if (!fsService) {
    fsService = new FileSystemService({ validator: new FileSystemPathValidator() })
  }
  if (!watcher) {
    watcher = new FileWatcher({
      onEvent: (evt) => {
        // Bridge 012 events over 013 IPC (send to all for demo)
        try {
          webContents.getAllWebContents().forEach((wc) => {
            if (!wc.isDestroyed()) wc.send(watcherEventChannel, evt)
          })
        } catch {}
        console.warn('[module=ipc-framework] phase=watcher-event-bridged')
      },
    })
  }
}

function setupIpcFramework() {
  initPrivilegedServices()

  const registry = getContractRegistry()

  // Register contracts (idempotent, ownership enforced)
  registry.register(shellPingContract)
  registry.register(shellCaptureContract)
  registry.register(fsReadContract)
  registry.register(fsListContract)
  registry.register(watcherSubscribeContract)

  ipcServer = new IpcServer({ registry })

  // Register pure handlers (013 stores, validates ordering inside dispatch)
  ipcServer.registerHandler(shellPingContract.channel, async (req: ShellPingReq) => ({
    pong: `pong: ${req.message}`,
    timestamp: Date.now(),
  }))

  ipcServer.registerHandler(shellCaptureContract.channel, async (req: ShellCaptureReq) => {
    console.warn('[module=ipc-framework] phase=capture-delegated len=' + (req.content?.length || 0))
    return { success: true, id: `cap_${Date.now()}` }
  })

  ipcServer.registerHandler(fsReadContract.channel, async (req: FsReadReq) => {
    if (!fsService) return createIpcError({ code: 'FS_UNAVAILABLE', category: 'unavailable', message: 'FS service not ready', retryable: true })
    const res = await fsService.readFile(req.path)
    if (res && 'code' in res) {
      return createIpcError({ code: res.code || 'FS_ERROR', category: 'internal', message: res.message || 'FS error', retryable: false })
    }
    return res
  })

  ipcServer.registerHandler(fsListContract.channel, async (req: FsListReq) => {
    if (!fsService) return createIpcError({ code: 'FS_UNAVAILABLE', category: 'unavailable', message: 'FS service not ready', retryable: true })
    const res = await fsService.listDirectory(req.path)
    if (res && 'code' in res) {
      return createIpcError({ code: res.code || 'FS_ERROR', category: 'internal', message: res.message || 'FS error', retryable: false })
    }
    return res
  })

  ipcServer.registerHandler(watcherSubscribeContract.channel, async (req: WatcherSubscribeReq) => {
    if (!watcher) return createIpcError({ code: 'WATCHER_UNAVAILABLE', category: 'unavailable', message: 'Watcher not ready', retryable: true })
    await watcher.setWatches(req.roots || [])
    return { subscriptionId: `sub_${Date.now()}`, activeRoots: watcher.getActiveRoots() }
  })

  // Wire actual Electron channels here (host wiring, uses pure dispatch)
  const channelsToWire = [
    shellPingContract.channel,
    shellCaptureContract.channel,
    fsReadContract.channel,
    fsListContract.channel,
    watcherSubscribeContract.channel,
  ]

  for (const ch of channelsToWire) {
    ipcMain.handle(ch, async (event, payload) => {
      const wcId = event.sender.id
      // ensure grant exists for this wc (in case timing)
      if (ipcServer && !ipcServer.getGrant(wcId)) {
        ipcServer.grant(wcId, ['shell', 'fs', 'watcher'])
      }
      const res = await (ipcServer ? ipcServer.dispatch(ch, payload, wcId) : createIpcError({ code: 'NO_SERVER', category: 'unavailable', message: 'IPC server not initialized', retryable: false }))
      return res
    })
  }

  // For watcher events: the onEvent in watcher ctor will call ipcServer.emit which is prepare
  // Actual send done here by overriding? For now patch emit in main after create:
  // (simple: in watcher onEvent we already check ipcServer.emit which now prepares, we send manually below if needed)

  ipcServer.ready().catch((e) => console.error('[ipc] ready failed', e))
  console.warn('[module=ipc-framework] phase=framework-wired')
}

app.whenReady().then(() => {
  setupIpcFramework()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Graceful shutdown
app.on('before-quit', () => {
  if (ipcServer) {
    ipcServer.close()
  }
  if (watcher) {
    watcher.dispose()
  }
  mainWindow = null
})
