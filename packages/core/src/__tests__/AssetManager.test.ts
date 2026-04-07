import { describe, it, expect } from 'vitest'
import { AssetManifest } from '../assets/AssetManifest.js'
import { AssetManager } from '../assets/AssetManager.js'
import type { AssetManifest as ManifestType } from '../types/index.js'

describe('AssetManifest', () => {
  const sampleManifest: ManifestType = {
    version: '1.0.0',
    avatars: {
      'professional-woman': {
        name: 'Professional Woman',
        variants: {
          high: 'avatars/professional-woman/high.glb',
          medium: 'avatars/professional-woman/medium.glb',
        },
        thumbnail: 'avatars/professional-woman/thumb.webp',
      },
    },
    gestures: {
      core: { url: 'gestures/core.glb', size: 512000 },
    },
  }

  it('resolves avatar URL for a given quality tier', () => {
    const manifest = new AssetManifest(sampleManifest, 'https://cdn.example.com/')
    const url = manifest.getAvatarUrl('professional-woman', 'high')
    expect(url).toBe('https://cdn.example.com/avatars/professional-woman/high.glb')
  })

  it('falls back to lower quality if requested tier unavailable', () => {
    const manifest = new AssetManifest(sampleManifest, 'https://cdn.example.com/')
    const url = manifest.getAvatarUrl('professional-woman', 'low')
    expect(url).toBe('https://cdn.example.com/avatars/professional-woman/medium.glb')
  })

  it('returns null for unknown avatar', () => {
    const manifest = new AssetManifest(sampleManifest, 'https://cdn.example.com/')
    const url = manifest.getAvatarUrl('unknown', 'high')
    expect(url).toBeNull()
  })

  it('resolves gesture URL', () => {
    const manifest = new AssetManifest(sampleManifest, 'https://cdn.example.com/')
    const url = manifest.getGestureUrl('core')
    expect(url).toBe('https://cdn.example.com/gestures/core.glb')
  })

  it('lists available avatars', () => {
    const manifest = new AssetManifest(sampleManifest, 'https://cdn.example.com/')
    expect(manifest.listAvatars()).toEqual(['professional-woman'])
  })
})

describe('AssetManager', () => {
  it('isCustomUrl returns true for http URLs', () => {
    expect(AssetManager.isCustomUrl('https://example.com/avatar.glb')).toBe(true)
    expect(AssetManager.isCustomUrl('http://example.com/avatar.glb')).toBe(true)
  })

  it('isCustomUrl returns true for relative paths ending in .glb', () => {
    expect(AssetManager.isCustomUrl('./my-avatar.glb')).toBe(true)
    expect(AssetManager.isCustomUrl('/assets/avatar.glb')).toBe(true)
  })

  it('isCustomUrl returns false for plain avatar IDs', () => {
    expect(AssetManager.isCustomUrl('professional-woman')).toBe(false)
    expect(AssetManager.isCustomUrl('friendly-guy')).toBe(false)
  })
})
