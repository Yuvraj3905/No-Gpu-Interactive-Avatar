import type { AssetManifest as ManifestType, QualityTier } from '../types/index.js'

const QUALITY_FALLBACK: Record<QualityTier, QualityTier[]> = {
  high: ['high', 'medium', 'low'],
  medium: ['medium', 'high', 'low'],
  low: ['low', 'medium', 'high'],
}

export class AssetManifest {
  constructor(
    private manifest: ManifestType,
    private baseUrl: string,
  ) {
    if (!this.baseUrl.endsWith('/')) {
      this.baseUrl += '/'
    }
  }

  getAvatarUrl(avatarId: string, quality: QualityTier): string | null {
    const entry = this.manifest.avatars[avatarId]
    if (!entry) return null

    for (const tier of QUALITY_FALLBACK[quality]) {
      const path = entry.variants[tier]
      if (path) return this.baseUrl + path
    }
    return null
  }

  getGestureUrl(gestureId: string): string | null {
    const entry = this.manifest.gestures[gestureId]
    if (!entry) return null
    return this.baseUrl + entry.url
  }

  listAvatars(): string[] {
    return Object.keys(this.manifest.avatars)
  }

  listGestures(): string[] {
    return Object.keys(this.manifest.gestures)
  }

  getVersion(): string {
    return this.manifest.version
  }
}
