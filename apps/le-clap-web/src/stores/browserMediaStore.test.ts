import { describe, it, expect } from 'vitest'
import { BrowserMediaStore, type MediaBackend, type MediaRecord } from './browserMediaStore'

function fakeBackend(): MediaBackend {
  const map = new Map<string, MediaRecord>()

  return {
    put: async (rec) => { map.set(rec.key, rec) },
    get: async (key) => map.get(key) ?? null,
    delete: async (key) => { map.delete(key) },
  }
}

function fakeFile(name: string, bytes = [1, 2, 3]): File {
  return new File([new Uint8Array(bytes)], name, { type: 'audio/mpeg' })
}

describe('BrowserMediaStore', () => {
  it('saves a file under a generated key with its kind, ext and name', async () => {
    let n = 0
    const store = new BrowserMediaStore(fakeBackend(), () => `key-${++n}`)

    const saved = await store.save(fakeFile('My Track.mp3'), 'music')

    expect(saved.key).toBe('key-1')
    expect(saved.ext).toBe('mp3')
    const meta = await store.getMeta('key-1')
    expect(meta).toEqual({ kind: 'music', ext: 'mp3', name: 'My Track.mp3' })
  })

  it('returns the raw bytes for materialization', async () => {
    const store = new BrowserMediaStore(fakeBackend(), () => 'k')
    await store.save(fakeFile('a.mp3', [9, 8, 7]), 'music')

    expect(await store.getBytes('k')).toEqual(new Uint8Array([9, 8, 7]))
    expect(await store.getBytes('missing')).toBeNull()
  })

  it('removes a record', async () => {
    const store = new BrowserMediaStore(fakeBackend(), () => 'k')
    await store.save(fakeFile('a.mp3'), 'music')
    await store.remove('k')

    expect(await store.getBytes('k')).toBeNull()
  })

  it('derives ext from the file name, defaulting to bin', async () => {
    const store = new BrowserMediaStore(fakeBackend(), () => 'k')
    const saved = await store.save(new File([new Uint8Array([1])], 'noext'), 'picture')

    expect(saved.ext).toBe('bin')
  })
})
