/// <reference types="vite/client" />

interface RayStudioAPI {
  ping: (message: string) => Promise<{ pong: string; timestamp: number }>
  capture: (content: string, metadata?: Record<string, unknown>) => Promise<{ success: boolean; id?: string }>
  onProjectChanged: (callback: (projectId: string) => void) => () => void
}

declare global {
  interface Window {
    rayStudio?: RayStudioAPI
  }
}

export {}
