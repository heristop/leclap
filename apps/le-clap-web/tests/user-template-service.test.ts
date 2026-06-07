import { describe, it, expect } from 'vitest'
import { UserTemplateService, type DescriptorValidator } from '../src/stores/userTemplateStore'
import type { Template } from '../src/services/templateService'

// In-memory Storage so the service can be exercised without a browser.
function memStorage(): Storage {
  const map = new Map<string, string>()

  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => { map.set(k, v) },
    removeItem: (k) => { map.delete(k) },
    clear: () => { map.clear() },
    key: (i) => [...map.keys()][i] ?? null,
    get length() { return map.size },
  } as Storage
}

const okValidator: DescriptorValidator = { validateTemplate: () => ({ success: true }) }
const failValidator: DescriptorValidator = {
  validateTemplate: () => ({ success: false, errors: [{ message: 'bad section' }] }),
}

function sampleTemplate(overrides: Partial<Template> = {}): Template {
  return {
    id: 'tmpl-1',
    name: 'My Template',
    description: 'desc',
    orientation: 'landscape',
    hasForm: false,
    complexity: 'simple',
    source: 'sample',
    descriptor: { sections: [{ name: 'video_1', type: 'project_video', options: { duration: 5 } }] },
    ...overrides,
  }
}

describe('UserTemplateService', () => {
  it('saves a template, tags it source:user with timestamps, and lists/gets it back', () => {
    const svc = new UserTemplateService(memStorage(), okValidator, () => 1000)

    const stored = svc.save(sampleTemplate())

    expect(stored.source).toBe('user')
    expect(stored.createdAt).toBe(1000)
    expect(stored.updatedAt).toBe(1000)
    expect(svc.list()).toHaveLength(1)
    expect(svc.get('tmpl-1')?.name).toBe('My Template')
  })

  it('updates in place by id — preserves createdAt, bumps updatedAt, no duplicate', () => {
    let now = 1000
    const svc = new UserTemplateService(memStorage(), okValidator, () => now)
    svc.save(sampleTemplate())

    now = 2000
    svc.save(sampleTemplate({ name: 'Renamed' }))

    const all = svc.list()
    expect(all).toHaveLength(1)
    expect(all[0].name).toBe('Renamed')
    expect(all[0].createdAt).toBe(1000)
    expect(all[0].updatedAt).toBe(2000)
  })

  it('rejects an invalid descriptor (validator failure) and persists nothing', () => {
    const storage = memStorage()
    const svc = new UserTemplateService(storage, failValidator)

    expect(() => svc.save(sampleTemplate())).toThrow(/bad section/)
    expect(svc.list()).toHaveLength(0)
  })

  it('removes a template by id', () => {
    const svc = new UserTemplateService(memStorage(), okValidator)
    svc.save(sampleTemplate())
    svc.remove('tmpl-1')
    expect(svc.list()).toHaveLength(0)
  })

  it('duplicate() clones a template with a new id and a "(copy)" name, as a user template', () => {
    const svc = new UserTemplateService(memStorage(), okValidator, () => 1000, () => 'user-dup')

    const copy = svc.duplicate(sampleTemplate())

    expect(copy.id).toBe('user-dup')
    expect(copy.name).toBe('My Template (copy)')
    expect(copy.source).toBe('user')
    expect(svc.list().map((t) => t.id)).toContain('user-dup')
  })

  it('returns an empty list (never throws) when storage is unavailable', () => {
    const svc = new UserTemplateService(null, okValidator)
    expect(svc.list()).toEqual([])
    expect(svc.get('x')).toBeNull()
  })
})
