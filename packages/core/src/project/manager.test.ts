import { describe, it, expect, beforeEach } from 'vitest'
import {
  ProjectManager,
  InMemoryProjectPathValidator,
  InMemoryProjectConfigStore,
} from './manager.js'

describe('ProjectManager (010)', () => {
  let manager: ProjectManager

  beforeEach(() => {
    manager = new ProjectManager({
      validator: new InMemoryProjectPathValidator(),
      configStore: new InMemoryProjectConfigStore(),
    })
  })

  it('starts in none state', () => {
    expect(manager.getState()).toBe('none')
    expect(manager.getCurrentProject()).toBeNull()
  })

  it('activates a valid project within workspace (FT-001)', async () => {
    const res = await manager.activate('/tmp/ws', '/tmp/ws/my-project')
    expect(res.success).toBe(true)
    expect(res.project?.metadata.rootPath).toContain('my-project')
    expect(manager.getState()).toBe('active')
    expect(manager.getCurrentConfig()).toBeTruthy()
  })

  it('rejects invalid / empty project root (FT-005)', async () => {
    const res = await manager.activate('/tmp/ws', '')
    expect(res.success).toBe(false)
    expect(manager.getState()).toBe('none')
  })

  it('rejects project outside workspace (scope guard)', async () => {
    const res = await manager.activate('/tmp/ws', '/tmp/other-project')
    expect(res.success).toBe(false)
  })

  it('deactivate resets state (FT-004)', async () => {
    await manager.activate('/tmp/ws', '/tmp/ws/p1')
    await manager.deactivate()
    expect(manager.getState()).toBe('none')
    expect(manager.getCurrentProject()).toBeNull()
  })

  it('config read/write survives in session + getConfig (FT-002)', async () => {
    await manager.activate('/tmp/ws', '/tmp/ws/pcfg')
    const up = await manager.updateConfig('theme', 'dark')
    expect(up.success).toBe(true)
    const cfg = await manager.getConfig()
    expect(cfg?.theme).toBe('dark')

    // restart-like: new manager instance reuses same in-mem store? (test only)
    // For unit: direct load check
    const cfg2 = await manager.getConfig()
    expect(cfg2?.theme).toBe('dark')
  })

  it('updateConfig requires active project', async () => {
    const up = await manager.updateConfig('foo', 1)
    expect(up.success).toBe(false)
  })
})
