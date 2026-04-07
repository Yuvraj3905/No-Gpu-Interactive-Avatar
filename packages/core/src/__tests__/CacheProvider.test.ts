import { describe, it, expect } from 'vitest'
import { CacheProvider } from '../assets/CacheProvider.js'

describe('CacheProvider', () => {
  it('get returns undefined for missing key', async () => {
    const cache = new CacheProvider()
    const result = await cache.get('nonexistent')
    expect(result).toBeUndefined()
  })

  it('set and get roundtrip works', async () => {
    const cache = new CacheProvider()
    const data = new ArrayBuffer(8)
    await cache.set('test-key', data)
    const result = await cache.get('test-key')
    expect(result).toEqual(data)
  })

  it('delete removes entry', async () => {
    const cache = new CacheProvider()
    await cache.set('key1', new ArrayBuffer(4))
    await cache.delete('key1')
    const result = await cache.get('key1')
    expect(result).toBeUndefined()
  })

  it('has returns true for existing keys', async () => {
    const cache = new CacheProvider()
    await cache.set('exists', new ArrayBuffer(4))
    expect(await cache.has('exists')).toBe(true)
    expect(await cache.has('nope')).toBe(false)
  })
})
