import { app, BrowserWindow, ipcMain, Menu } from 'electron'
import { join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

let mainWindow: BrowserWindow | null = null

// Basic typed IPC contracts for the shell boundary (to be fulfilled by 013 IPC Framework later)
export interface ShellIPC {
  // Shell -> Core (privileged)
  'shell:ping': (payload: { message: string }) => Promise<{ pong: string; timestamp: number }>
  'shell:capture': (payload: { content: string; metadata?: Record<string, unknown> }) => Promise<{ success: boolean; id?: string }>
  // Core -> Shell events
  'core:project-changed': (projectId: string) => void
}

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
}

// IPC handlers (production stubs — real impl delegated to 013 later)
ipcMain.handle('shell:ping', async (_event, payload: { message: string }) => {
  return {
    pong: `pong: ${payload.message}`,
    timestamp: Date.now(),
  }
})

ipcMain.handle('shell:capture', async (_event, payload: { content: string; metadata?: Record<string, unknown> }) => {
  // Stub: In real system this routes through 013 IPC to ingestion/graph
  console.warn('[main] capture received (stub):', payload.content.substring(0, 80))
  return { success: true, id: `cap_${Date.now()}` }
})

app.whenReady().then(() => {
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
  if (mainWindow) {
    mainWindow = null
  }
})
