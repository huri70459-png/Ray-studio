import { useState, useEffect, useCallback } from 'react'
import { Search, Terminal, Globe, Settings, Zap, FolderOpen } from 'lucide-react'
import {
  getProjectManager,
  activateProject,
} from './project/useProject'
import {
  getFileSystemService,
  initFileSystem,
  fsValidatePath,
  fsReadFile,
  fsWriteFile,
  fsListDirectory,
  updateFsRoots,
} from './fs/useFileSystem'

interface Command {
  id: string
  title: string
  keywords: string[]
  shortcut?: string
  action: () => void | Promise<void>
}

type Surface = 'overview' | 'graph' | 'capture' | 'settings'

export default function App() {
  const [isPaletteOpen, setIsPaletteOpen] = useState(false)
  const [paletteQuery, setPaletteQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [currentSurface, setCurrentSurface] = useState<Surface>('overview')
  const [lastPing, setLastPing] = useState<string | null>(null)
  const [captureStatus, setCaptureStatus] = useState<string>('')

  // Demo commands (will be extended by surfaces and plugins via registration contract)
  const commands: Command[] = [
    {
      id: 'capture',
      title: 'Quick Capture',
      keywords: ['capture', 'note', 'save'],
      shortcut: '⌘⇧C',
      action: async () => {
        const text = prompt('Capture text (demo):') || 'Demo capture from palette'
        try {
          const result = await window.rayStudio?.capture(text, { source: 'command-palette' })
          setCaptureStatus(result?.success ? `Captured (${result.id})` : 'Capture failed')
          setTimeout(() => setCaptureStatus(''), 2000)
        } catch {
          setCaptureStatus('Capture error (IPC stub)')
        }
        setIsPaletteOpen(false)
      },
    },
    {
      id: 'ping',
      title: 'Ping Core (IPC test)',
      keywords: ['ping', 'ipc', 'health'],
      action: async () => {
        try {
          const res = await window.rayStudio?.ping('hello from shell')
          setLastPing(`Pong: ${res?.pong} @ ${new Date(res?.timestamp || 0).toLocaleTimeString()}`)
        } catch {
          setLastPing('IPC not available (stub)')
        }
        setIsPaletteOpen(false)
      },
    },
    {
      id: 'switch-graph',
      title: 'Open Graph Explorer',
      keywords: ['graph', 'explore', 'knowledge'],
      action: () => {
        setCurrentSurface('graph')
        setIsPaletteOpen(false)
      },
    },
    {
      id: 'switch-capture',
      title: 'Open Capture',
      keywords: ['capture', 'input'],
      action: () => {
        setCurrentSurface('capture')
        setIsPaletteOpen(false)
      },
    },
    {
      id: 'theme-toggle',
      title: 'Toggle Theme (dark/light)',
      keywords: ['theme', 'dark', 'light'],
      action: () => {
        // Stub: full theme manager in later iteration
        document.documentElement.classList.toggle('light')
        setIsPaletteOpen(false)
      },
    },
    {
      id: 'settings',
      title: 'Open Settings',
      keywords: ['settings', 'preferences'],
      action: () => {
        setCurrentSurface('settings')
        setIsPaletteOpen(false)
      },
    },
    // 011 File System Service demos (ponytail: direct until 013 IPC)
    {
      id: 'fs-activate-demo',
      title: 'FS: Activate demo workspace + project',
      keywords: ['fs', 'activate', 'workspace', 'project', '011'],
      action: async () => {
        const ws = 'F:/Projects/Ray-studio Creations/Ray Studio'
        const proj = ws // use root as demo project for now
        try {
          await activateProject(ws, proj)
          updateFsRoots(ws, proj)
          await initFileSystem(ws, proj)
          alert('FS roots activated (demo). Use other FS commands.')
        } catch (e) {
          alert('FS activate error: ' + (e as Error).message)
        }
        setIsPaletteOpen(false)
      },
    },
    {
      id: 'fs-list',
      title: 'FS: List current project root',
      keywords: ['fs', 'list', 'dir', '011'],
      action: async () => {
        try {
          const svc = getFileSystemService()
          // ensure roots if not
          updateFsRoots('F:/Projects/Ray-studio Creations/Ray Studio', 'F:/Projects/Ray-studio Creations/Ray Studio')
          await svc.initialize('F:/Projects/Ray-studio Creations/Ray Studio', 'F:/Projects/Ray-studio Creations/Ray Studio')
          const res = await fsListDirectory('F:/Projects/Ray-studio Creations/Ray Studio')
          if ('entries' in res) {
            alert('Listed ' + res.entries.length + ' entries (first: ' + (res.entries[0]?.name || 'n/a') + ')')
          } else {
            alert('List error: ' + (res as any).message)
          }
        } catch (e) {
          alert('FS list error')
        }
        setIsPaletteOpen(false)
      },
    },
    {
      id: 'fs-validate',
      title: 'FS: Validate path (in/out of scope)',
      keywords: ['fs', 'validate', 'scope', '011'],
      action: async () => {
        try {
          const inScope = await fsValidatePath('F:/Projects/Ray-studio Creations/Ray Studio/README.md')
          const outScope = await fsValidatePath('C:/Windows/System32/notepad.exe')
          alert(`In-scope: ${inScope.valid} | Out-of-scope: ${outScope.valid} (should be false)`)
        } catch (e) {
          alert('FS validate error')
        }
        setIsPaletteOpen(false)
      },
    },
  ]

  const filteredCommands = commands.filter(cmd =>
    cmd.title.toLowerCase().includes(paletteQuery.toLowerCase()) ||
    cmd.keywords.some(k => k.includes(paletteQuery.toLowerCase()))
  )

  const executeSelected = useCallback(() => {
    const cmd = filteredCommands[selectedIndex]
    if (cmd) cmd.action()
  }, [filteredCommands, selectedIndex])

  // Global keyboard handler (command palette + navigation)
  useEffect(() => {
    const onKeyDown = (_e: KeyboardEvent) => {
      const e = _e
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setIsPaletteOpen(v => !v)
        setPaletteQuery('')
        setSelectedIndex(0)
        return
      }

      if (!isPaletteOpen) return

      if (e.key === 'Escape') {
        setIsPaletteOpen(false)
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(i => Math.min(i + 1, filteredCommands.length - 1))
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(i => Math.max(i - 1, 0))
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        executeSelected()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isPaletteOpen, filteredCommands.length, executeSelected])

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [paletteQuery])

  const renderSurface = () => {
    switch (currentSurface) {
      case 'graph':
        return (
          <div className="surface-container">
            <div className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Globe className="w-5 h-5" /> Graph Explorer <span className="text-xs text-slate-500">(Module 001 stub)</span>
            </div>
            <div className="text-sm text-slate-400">Placeholder for graph visualization. Retrieval delegated to Context Engine.</div>
            <div className="mt-6 p-4 bg-slate-900 border border-slate-800 rounded">0 nodes • Use command palette (⌘K) to test IPC</div>
          </div>
        )
      case 'capture':
        return (
          <div className="surface-container max-w-xl">
            <div className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5" /> Quick Capture
            </div>
            <textarea
              className="w-full h-40 bg-slate-900 border border-slate-700 rounded p-3 font-mono text-sm"
              placeholder="Type to capture... (hotkey will route via IPC)"
              onKeyDown={async (e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  const val = (e.target as HTMLTextAreaElement).value.trim()
                  if (val) {
                    const r = await window.rayStudio?.capture(val, { source: 'surface' })
                    setCaptureStatus(r?.success ? `Captured: ${r.id}` : 'Failed')
                  }
                }
              }}
            />
            <div className="text-xs mt-2 text-slate-500">⌘⏎ to capture • Routes through shell IPC boundary</div>
            {captureStatus && <div className="mt-2 text-emerald-400 text-sm">{captureStatus}</div>}
          </div>
        )
      case 'settings':
        return (
          <div className="surface-container">
            <div className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5" /> Settings
            </div>
            <div className="space-y-2 text-sm">
              <div>Theme: Dark (stub)</div>
              <div>Keyboard-first: Enabled</div>
              <div>IPC Boundary: Enforced (renderer cannot access privileged APIs)</div>
              <div className="text-slate-500 mt-4 text-xs">Module 001: Foundations validated. Full settings owned by later modules.</div>
            </div>
          </div>
        )
      default:
        return (
          <div className="surface-container">
            <div className="max-w-2xl">
              <h1 className="text-3xl font-semibold tracking-tight">Ray Studio</h1>
              <p className="mt-2 text-slate-400">AI-native development operating system. Command palette is your primary interface.</p>

              <div className="mt-8 grid grid-cols-2 gap-3 text-sm">
                <div className="p-4 bg-slate-900 border border-slate-800 rounded">
                  <div className="font-medium">Status</div>
                  <div className="text-emerald-400">Shell ready • IPC boundary live</div>
                  {lastPing && <div className="text-xs mt-1 text-slate-400">{lastPing}</div>}
                </div>
                <div className="p-4 bg-slate-900 border border-slate-800 rounded">
                  <div className="font-medium">Next</div>
                  <div>Press <kbd className="font-mono bg-slate-800 px-1 rounded">⌘K</kbd> for command palette</div>
                </div>
              </div>

              <div className="mt-6 text-xs text-slate-500">
                Module 001 (Studio Shell) — validating monorepo, Electron, React, IPC, build, test, and deterministic process.
              </div>
            </div>
          </div>
        )
    }
  }

  return (
    <div className="shell-layout">
      {/* Top bar */}
      <div className="topbar">
        <div className="font-semibold tracking-tight">Ray Studio</div>
        <div className="flex-1" />
        <button
          onClick={() => { setIsPaletteOpen(true); setPaletteQuery('') }}
          className="flex items-center gap-2 px-3 py-1 text-xs bg-slate-800 hover:bg-slate-700 rounded border border-slate-700"
        >
          <Search className="w-3.5 h-3.5" /> Command Palette <span className="opacity-50">⌘K</span>
        </button>
        <div className="text-xs text-slate-500 ml-4">001 • Sprint 1</div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex">
        {/* Minimal nav rail */}
        <div className="w-14 border-r border-slate-800 flex flex-col items-center pt-2 gap-1 text-xs">
          {(['overview', 'graph', 'capture', 'settings'] as const).map(s => (
            <button
              key={s}
              onClick={() => setCurrentSurface(s)}
              className={`w-10 h-10 flex items-center justify-center rounded hover:bg-slate-800 ${currentSurface === s ? 'bg-slate-800 text-white' : 'text-slate-400'}`}
              title={s}
            >
              {s === 'overview' && <Terminal className="w-4 h-4" />}
              {s === 'graph' && <Globe className="w-4 h-4" />}
              {s === 'capture' && <Zap className="w-4 h-4" />}
              {s === 'settings' && <Settings className="w-4 h-4" />}
            </button>
          ))}
        </div>

        <div className="flex-1 flex flex-col">
          {renderSurface()}
        </div>
      </div>

      <div className="status-bar">
        {captureStatus || lastPing || 'Ready — all privileged actions via IPC'} • Electron + React • Keyboard first
      </div>

      {/* Command Palette */}
      {isPaletteOpen && (
        <div className="command-palette" onClick={() => setIsPaletteOpen(false)}>
          <div className="command-palette-content" onClick={e => e.stopPropagation()}>
            <input
              autoFocus
              className="command-input"
              placeholder="Type a command or search..."
              value={paletteQuery}
              onChange={e => setPaletteQuery(e.target.value)}
            />
            <div className="command-list">
              {filteredCommands.length === 0 && (
                <div className="px-4 py-3 text-sm text-slate-500">No matching commands</div>
              )}
              {filteredCommands.map((cmd, idx) => (
                <div
                  key={cmd.id}
                  className={`command-item ${idx === selectedIndex ? 'selected' : ''}`}
                  onClick={() => { setSelectedIndex(idx); cmd.action() }}
                >
                  <div className="title">{cmd.title}</div>
                  {cmd.shortcut && <div className="shortcut">{cmd.shortcut}</div>}
                </div>
              ))}
            </div>
            <div className="px-4 py-2 text-[10px] text-slate-500 border-t border-slate-800">↑↓ navigate • ⏎ execute • esc close</div>
          </div>
        </div>
      )}
    </div>
  )
}
