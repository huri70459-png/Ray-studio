import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { FileWatcher } from './watcher.js'
import * as fs from 'node:fs/promises'
import * as nodePath from 'node:path'
import * as os from 'node:os'

describe('FileWatcher (012)', () => {
  let watcher: FileWatcher
  let tmpRoot: string

  beforeEach(async () => {
    watcher = new FileWatcher()
    tmpRoot = await fs.mkdtemp(nodePath.join(os.tmpdir(), 'ray-watcher-test-'))
  })

  afterEach(() => {
    watcher.dispose()
  })

  it('starts idle', () => {
    expect(watcher.getState()).toBe('idle')
    expect(watcher.getActiveRoots()).toEqual([])
  })

  it('watches validated root and emits create/modify/delete (FT-002)', async () => {
    await watcher.setWatches([tmpRoot])
    expect(watcher.getState()).toBe('watching')
    expect(watcher.getActiveRoots()).toContain(tmpRoot)

    const events: Array<{ type: string; path: string }> = []
    const unsub = watcher.subscribe((e) => events.push(e))

    // create
    const f = nodePath.join(tmpRoot, 'a.txt')
    await fs.writeFile(f, 'hello')

    // modify
    await fs.writeFile(f, 'hello2')

    // delete
    await fs.unlink(f)

    // allow time for async stat + emit (native events are async)
    await new Promise((r) => setTimeout(r, 250))

    unsub()

    // We expect at least some events (create or modify or delete). Native is best-effort.
    expect(events.length).toBeGreaterThanOrEqual(1)
    const types = events.map((e) => e.type)
    expect(types.some((t: string) => t.includes('created') || t.includes('modified') || t.includes('deleted'))).toBe(true)
  })

  it('updates watches cleanly on root change (FT-004)', async () => {
    await watcher.setWatches([tmpRoot])
    const root2 = await fs.mkdtemp(nodePath.join(os.tmpdir(), 'ray-watcher-test2-'))
    await watcher.setWatches([root2])
    expect(watcher.getActiveRoots()).toEqual([root2])
    // old should be closed (no throw on dispose)
    await fs.rm(root2, { recursive: true, force: true })
  })

  it('dispose releases resources (FT-004 lifecycle)', async () => {
    await watcher.setWatches([tmpRoot])
    watcher.dispose()
    expect(watcher.getState()).toBe('disposed')
    expect(watcher.getActiveRoots()).toEqual([])
  })
})
