import { contextBridge, ipcRenderer } from 'electron'

// Exposed API to renderer — strict boundary, no direct node access
export interface RayStudioAPI {
  ping: (message: string) => Promise<{ pong: string; timestamp: number }>
  capture: (content: string, metadata?: Record<string, unknown>) => Promise<{ success: boolean; id?: string }>
  // Event subscription example (for core -> shell)
  onProjectChanged: (callback: (projectId: string) => void) => () => void
}

const api: RayStudioAPI = {
  ping: (message: string) => ipcRenderer.invoke('shell:ping', { message }),
  capture: (content: string, metadata) => ipcRenderer.invoke('shell:capture', { content, metadata }),
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
