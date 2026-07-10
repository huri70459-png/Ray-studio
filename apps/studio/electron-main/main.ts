import { app, BrowserWindow, ipcMain, Menu, webContents } from 'electron'
import { join } from 'path'
import { fileURLToPath } from 'url'
import {
  FileSystemService,
  FileSystemPathValidator,
  FileWatcher,
  DatabaseService,
  IpcServer,
  getContractRegistry,
  createIpcError,
  dbErrorToIpc,
  shellPingContract,
  shellCaptureContract,
  fsReadContract,
  fsListContract,
  watcherSubscribeContract,
  watcherEventChannel,
  dbProjectGetContract,
  dbProjectListContract,
  dbProjectUpsertContract,
  dbConfigGetContract,
  dbConfigSetContract,
  dbIngestionGetContract,
  dbIngestionSetContract,
  dbWorkspaceGetContract,
  dbWorkspaceUpsertContract,
  type ShellPingReq,
  type ShellCaptureReq,
  type FsReadReq,
  type FsListReq,
  type WatcherSubscribeReq,
  type DbProjectGetReq,
  type DbProjectListReq,
  type DbProjectUpsertReq,
  type DbConfigGetReq,
  type DbConfigSetReq,
  type DbIngestionGetReq,
  type DbIngestionSetReq,
  type DbWorkspaceGetReq,
  type DbWorkspaceUpsertReq,
} from '@ray-studio/core'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

const DEMO_CAPS = ['shell', 'fs', 'watcher', 'db'] as const

let mainWindow: BrowserWindow | null = null
let ipcServer: IpcServer | null = null
let fsService: FileSystemService | null = null
let watcher: FileWatcher | null = null
let dbService: DatabaseService | null = null

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

  // 013: grant narrow caps for this window (shell + fs + watcher + db)
  if (ipcServer) {
    ipcServer.grant(mainWindow.webContents.id, [...DEMO_CAPS])
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
  // 016: open local metadata DB under app userData (validated app dir; not workspace content)
  if (!dbService) {
    dbService = new DatabaseService()
    try {
      const dbPath = join(app.getPath('userData'), 'ray-studio-meta.sqlite')
      dbService.open({ path: dbPath })
    } catch (err) {
      // ponytail: Electron without node:sqlite surfaces DB_UNAVAILABLE; domain tests use Node 22+ host
      console.warn('[module=sqlite-layer] phase=open-failed', err instanceof Error ? err.message : err)
    }
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
  registry.register(dbWorkspaceGetContract)
  registry.register(dbWorkspaceUpsertContract)
  registry.register(dbProjectGetContract)
  registry.register(dbProjectListContract)
  registry.register(dbProjectUpsertContract)
  registry.register(dbConfigGetContract)
  registry.register(dbConfigSetContract)
  registry.register(dbIngestionGetContract)
  registry.register(dbIngestionSetContract)

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

  // 016 SQLite handlers — all access via contracts; domain errors → IPC envelope
  const requireDb = () => {
    if (!dbService || dbService.getState() !== 'ready') {
      return createIpcError({ code: 'DB_UNAVAILABLE', category: 'unavailable', message: 'Database is not ready', retryable: true })
    }
    return null
  }

  ipcServer.registerHandler(dbWorkspaceGetContract.channel, async (req: DbWorkspaceGetReq) => {
    const unavail = requireDb()
    if (unavail) return unavail
    try {
      return dbService!.getWorkspace(req.id)
    } catch (e) {
      return dbErrorToIpc(e)
    }
  })

  ipcServer.registerHandler(dbWorkspaceUpsertContract.channel, async (req: DbWorkspaceUpsertReq) => {
    const unavail = requireDb()
    if (unavail) return unavail
    try {
      return dbService!.upsertWorkspace(req)
    } catch (e) {
      return dbErrorToIpc(e)
    }
  })

  ipcServer.registerHandler(dbProjectGetContract.channel, async (req: DbProjectGetReq) => {
    const unavail = requireDb()
    if (unavail) return unavail
    try {
      return dbService!.getProject(req.id)
    } catch (e) {
      return dbErrorToIpc(e)
    }
  })

  ipcServer.registerHandler(dbProjectListContract.channel, async (req: DbProjectListReq) => {
    const unavail = requireDb()
    if (unavail) return unavail
    try {
      return dbService!.listProjects(req.workspaceId)
    } catch (e) {
      return dbErrorToIpc(e)
    }
  })

  ipcServer.registerHandler(dbProjectUpsertContract.channel, async (req: DbProjectUpsertReq) => {
    const unavail = requireDb()
    if (unavail) return unavail
    try {
      return dbService!.upsertProject({
        id: req.id,
        workspaceId: req.workspaceId,
        name: req.name,
        rootPathRef: req.rootPathRef,
        status: req.status,
        lastIndexedAt: req.lastIndexedAt ?? null,
      })
    } catch (e) {
      return dbErrorToIpc(e)
    }
  })

  ipcServer.registerHandler(dbConfigGetContract.channel, async (req: DbConfigGetReq) => {
    const unavail = requireDb()
    if (unavail) return unavail
    try {
      return dbService!.getConfig(req.key, {
        workspaceId: req.workspaceId,
        projectId: req.projectId,
      })
    } catch (e) {
      return dbErrorToIpc(e)
    }
  })

  ipcServer.registerHandler(dbConfigSetContract.channel, async (req: DbConfigSetReq) => {
    const unavail = requireDb()
    if (unavail) return unavail
    try {
      return dbService!.setConfig(req.key, req.value, {
        workspaceId: req.workspaceId,
        projectId: req.projectId,
      })
    } catch (e) {
      return dbErrorToIpc(e)
    }
  })

  ipcServer.registerHandler(dbIngestionGetContract.channel, async (req: DbIngestionGetReq) => {
    const unavail = requireDb()
    if (unavail) return unavail
    try {
      return dbService!.getIngestionStatus(req.projectId)
    } catch (e) {
      return dbErrorToIpc(e)
    }
  })

  ipcServer.registerHandler(dbIngestionSetContract.channel, async (req: DbIngestionSetReq) => {
    const unavail = requireDb()
    if (unavail) return unavail
    try {
      return dbService!.setIngestionStatus(req.projectId, req.stage, req.progress, req.lastError ?? null)
    } catch (e) {
      return dbErrorToIpc(e)
    }
  })

  // Wire actual Electron channels here (host wiring, uses pure dispatch)
  const channelsToWire = [
    shellPingContract.channel,
    shellCaptureContract.channel,
    fsReadContract.channel,
    fsListContract.channel,
    watcherSubscribeContract.channel,
    dbWorkspaceGetContract.channel,
    dbWorkspaceUpsertContract.channel,
    dbProjectGetContract.channel,
    dbProjectListContract.channel,
    dbProjectUpsertContract.channel,
    dbConfigGetContract.channel,
    dbConfigSetContract.channel,
    dbIngestionGetContract.channel,
    dbIngestionSetContract.channel,
  ]

  for (const ch of channelsToWire) {
    ipcMain.handle(ch, async (event, payload) => {
      const wcId = event.sender.id
      // ensure grant exists for this wc (in case timing)
      if (ipcServer && !ipcServer.getGrant(wcId)) {
        ipcServer.grant(wcId, [...DEMO_CAPS])
      }
      const res = await (ipcServer ? ipcServer.dispatch(ch, payload, wcId) : createIpcError({ code: 'NO_SERVER', category: 'unavailable', message: 'IPC server not initialized', retryable: false }))
      return res
    })
  }

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
  if (dbService) {
    try {
      dbService.close()
    } catch {
      /* ignore */
    }
  }
  mainWindow = null
})
