import { describe, it, expect, beforeEach } from 'vitest'
import { FileSystemService } from './service.js'
import { FileSystemPathValidator } from './validator.js'
import * as fs from 'node:fs/promises'
import * as nodePath from 'node:path'
import * as os from 'node:os'

describe('FileSystemService (011)', () => {
  let service: FileSystemService
  let tmpRoot: string
  let testFile: string

  beforeEach(async () => {
    service = new FileSystemService({ validator: new FileSystemPathValidator() })
    tmpRoot = await fs.mkdtemp(nodePath.join(os.tmpdir(), 'ray-fs-test-'))
    testFile = nodePath.join(tmpRoot, 'test.txt')
    await fs.writeFile(testFile, 'hello ray')
    await service.initialize(tmpRoot, tmpRoot)
  })

  it('starts ready after init', () => {
    expect(service.getState()).toBe('ready')
  })

  it('validates in-scope path and rejects out-of-scope (FT-001)', async () => {
    const good = await service.validatePath(testFile)
    expect(good.valid).toBe(true)

    const bad = await service.validatePath(nodePath.join(os.tmpdir(), 'outside.txt'))
    expect(bad.valid).toBe(false)
    if (!bad.valid) expect(bad.error?.code).toBe('ACCESS_DENIED')
  })

  it('reads file content + metadata for valid path (FT-002)', async () => {
    const res = await service.readFile(testFile)
    if ('content' in res) {
      expect(res.content).toBe('hello ray')
      expect(res.metadata.isFile).toBe(true)
    } else {
      throw new Error('expected read success')
    }
  })

  it('writes file and returns metadata (FT-002)', async () => {
    const p = nodePath.join(tmpRoot, 'new.txt')
    const wr = await service.writeFile(p, 'written')
    if ('success' in wr) {
      expect(wr.success).toBe(true)
      const readBack = await service.readFile(p)
      if ('content' in readBack) expect(readBack.content).toBe('written')
    } else {
      throw new Error('write failed')
    }
  })

  it('lists directory (FT-002)', async () => {
    const listing = await service.listDirectory(tmpRoot)
    if ('entries' in listing) {
      expect(listing.entries.length).toBeGreaterThan(0)
    } else {
      throw new Error('list failed')
    }
  })

  it('rejects operations outside scope with safe error (FT-003)', async () => {
    const res = await service.readFile('/etc/passwd')
    // either validation or later error
    expect(res).toBeInstanceOf(Error)
  })
})
