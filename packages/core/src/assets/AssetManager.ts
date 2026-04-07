import { CacheProvider } from './CacheProvider.js'
import { AssetManifest } from './AssetManifest.js'
import type { AssetManifest as ManifestType, QualityTier } from '../types/index.js'

export class AssetManager {
  private cache: CacheProvider | null
  private manifest: AssetManifest | null = null
  private baseUrl: string

  constructor(baseUrl: string, enableCache: boolean) {
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/'
    this.cache = enableCache ? new CacheProvider() : null
  }

  async loadManifest(): Promise<AssetManifest> {
    const manifestUrl = this.baseUrl + 'manifests/v1.json'
    const response = await fetch(manifestUrl)
    if (!response.ok) {
      throw new Error(`Failed to load asset manifest from ${manifestUrl}: ${response.status}`)
    }
    const data = (await response.json()) as ManifestType
    this.manifest = new AssetManifest(data, this.baseUrl)
    return this.manifest
  }

  async loadAvatarGLB(avatarId: string, quality: QualityTier): Promise<ArrayBuffer> {
    if (AssetManager.isCustomUrl(avatarId)) {
      return this.fetchWithCache(avatarId)
    }

    if (!this.manifest) {
      throw new Error('Manifest not loaded. Call loadManifest() first or provide a direct URL.')
    }

    const url = this.manifest.getAvatarUrl(avatarId, quality)
    if (!url) {
      throw new Error(`Avatar "${avatarId}" not found in manifest`)
    }
    return this.fetchWithCache(url)
  }

  async loadGestureGLB(gestureId: string): Promise<ArrayBuffer> {
    if (!this.manifest) {
      throw new Error('Manifest not loaded. Call loadManifest() first.')
    }
    const url = this.manifest.getGestureUrl(gestureId)
    if (!url) {
      throw new Error(`Gesture "${gestureId}" not found in manifest`)
    }
    return this.fetchWithCache(url)
  }

  private async fetchWithCache(url: string): Promise<ArrayBuffer> {
    if (this.cache) {
      const cached = await this.cache.get(url)
      if (cached) return cached
    }

    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status}`)
    }
    const buffer = await response.arrayBuffer()

    if (this.cache) {
      await this.cache.set(url, buffer).catch(() => {
        // Cache write failure is non-fatal
      })
    }

    return buffer
  }

  static isCustomUrl(avatar: string): boolean {
    return avatar.startsWith('http://') ||
      avatar.startsWith('https://') ||
      avatar.startsWith('./') ||
      avatar.startsWith('/') ||
      avatar.endsWith('.glb') ||
      avatar.endsWith('.gltf')
  }

  getManifest(): AssetManifest | null {
    return this.manifest
  }
}
