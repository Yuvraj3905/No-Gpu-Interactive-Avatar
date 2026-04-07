import type { QualityTier, PerformanceMetrics } from '../types/index.js'

const TIER_ORDER: QualityTier[] = ['high', 'medium', 'low']
const FPS_THRESHOLD_1 = 45
const FPS_THRESHOLD_2 = 30
const SUSTAINED_FRAMES = 30

export class QualityManager {
  private currentTier: QualityTier
  private lowFpsCount = 0
  private veryLowFpsCount = 0
  private onChangeCallback: ((tier: QualityTier) => void) | null = null

  constructor(initialTier: QualityTier | 'auto') {
    this.currentTier = initialTier === 'auto' ? this.benchmark() : initialTier
  }

  getCurrentTier(): QualityTier {
    return this.currentTier
  }

  recordFps(fps: number): void {
    if (fps < FPS_THRESHOLD_2) {
      this.veryLowFpsCount++
      this.lowFpsCount++
    } else if (fps < FPS_THRESHOLD_1) {
      this.lowFpsCount++
      this.veryLowFpsCount = 0
    } else {
      this.lowFpsCount = 0
      this.veryLowFpsCount = 0
    }

    if (this.veryLowFpsCount >= SUSTAINED_FRAMES) {
      this.downgrade()
      this.downgrade()
      this.veryLowFpsCount = 0
      this.lowFpsCount = 0
    } else if (this.lowFpsCount >= SUSTAINED_FRAMES) {
      this.downgrade()
      this.lowFpsCount = 0
    }
  }

  getMetrics(fps: number): PerformanceMetrics {
    return {
      fps,
      gpuMemoryMB: 0,
      jsHeapMB: typeof performance !== 'undefined' && 'memory' in performance
        ? (performance as unknown as { memory: { usedJSHeapSize: number } }).memory.usedJSHeapSize / 1024 / 1024
        : 0,
      qualityTier: this.currentTier,
    }
  }

  onChange(callback: (tier: QualityTier) => void): void {
    this.onChangeCallback = callback
  }

  private downgrade(): void {
    const currentIndex = TIER_ORDER.indexOf(this.currentTier)
    if (currentIndex < TIER_ORDER.length - 1) {
      this.currentTier = TIER_ORDER[currentIndex + 1]!
      this.onChangeCallback?.(this.currentTier)
    }
  }

  private benchmark(): QualityTier {
    if (typeof document === 'undefined') return 'medium'
    try {
      const canvas = document.createElement('canvas')
      const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
      if (!gl) return 'low'

      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
      if (debugInfo) {
        const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) as string
        const lowerRenderer = renderer.toLowerCase()
        if (lowerRenderer.includes('nvidia') || lowerRenderer.includes('radeon') || lowerRenderer.includes('geforce')) {
          return 'high'
        }
        if (lowerRenderer.includes('swiftshader') || lowerRenderer.includes('llvmpipe')) {
          return 'low'
        }
      }

      if (navigator.hardwareConcurrency >= 8) return 'high'
      if (navigator.hardwareConcurrency >= 4) return 'medium'
      return 'low'
    } catch {
      return 'medium'
    }
  }
}
