import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'

// 013 IPC Framework — typed boundary (contract channels with @version)
// Legacy surface kept for shell commands during transition.
export interface RayStudioAPI {
  ping: (message: string) => Promise<{ pong: string; timestamp: number }>
  capture: (content: string, metadata?: Record<string, unknown>) => Promise<{ success: boolean; id?: string }>
  // 013 contract-aware
  invoke: (channel: string, payload?: unknown) => Promise<unknown>
  on: (channel: string, cb: (payload: unknown) => void) => () => void
  // legacy event compat
  onProjectChanged: (callback: (projectId: string) => void) => () => void
}

const api: RayStudioAPI = {
  ping: (message: string) => ipcRenderer.invoke('shell:ping@1.0', { message }),
  capture: (content: string, metadata) => ipcRenderer.invoke('shell:capture@1.0', { content, metadata }),
  invoke: (channel: string, payload?: unknown) => ipcRenderer.invoke(channel, payload),
  on: (channel: string, cb: (payload: unknown) => void) => {
    const handler = (_e: IpcRendererEvent, p: unknown) => cb(p)
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  },
  onProjectChanged: (callback) => {
    const handler = (_event: unknown, projectId: string) => callback(projectId)
    ipcRenderer.on('core:project-changed', handler)
    return () => ipcRenderer.removeListener('core:project-changed', handler)
  },
}

// Expose under a controlled namespace only
contextBridge.exposeInMainWorld('rayStudio', api)

// Type augmentation for window
declare global {
  interface Window {
    rayStudio: RayStudioAPI
  }
}
