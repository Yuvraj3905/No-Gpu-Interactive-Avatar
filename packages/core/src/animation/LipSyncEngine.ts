import type { BlendshapeMap, OculusVisemeName } from '../types/index.js'
import { OCULUS_VISEMES } from '../types/index.js'

const VISEME_PROFILES: Record<OculusVisemeName, [number, number, number, number, number]> = {
  viseme_sil: [0, 0, 0, 0, 0],
  viseme_PP:  [0.3, 0.1, 0.1, 0.1, 0.0],
  viseme_FF:  [0.1, 0.1, 0.1, 0.3, 0.5],
  viseme_TH:  [0.1, 0.1, 0.1, 0.4, 0.4],
  viseme_DD:  [0.4, 0.3, 0.2, 0.3, 0.1],
  viseme_kk:  [0.3, 0.2, 0.1, 0.4, 0.2],
  viseme_CH:  [0.1, 0.1, 0.1, 0.5, 0.6],
  viseme_SS:  [0.0, 0.0, 0.1, 0.4, 0.8],
  viseme_nn:  [0.5, 0.3, 0.2, 0.1, 0.0],
  viseme_RR:  [0.5, 0.4, 0.3, 0.2, 0.1],
  viseme_aa:  [0.9, 0.5, 0.2, 0.1, 0.0],
  viseme_E:   [0.6, 0.7, 0.5, 0.1, 0.0],
  viseme_I:   [0.3, 0.3, 0.8, 0.2, 0.0],
  viseme_O:   [0.8, 0.3, 0.1, 0.1, 0.0],
  viseme_U:   [0.7, 0.2, 0.1, 0.1, 0.0],
}

const SMOOTHING = 0.3
const SILENCE_THRESHOLD = 15

export class LipSyncEngine {
  private analyser: AnalyserNode | null = null
  private frequencyData: Uint8Array = new Uint8Array(0)
  private prevWeights: Map<OculusVisemeName, number> = new Map()

  constructor(private audioContext: AudioContext) {
    for (const v of OCULUS_VISEMES) {
      this.prevWeights.set(v, 0)
    }
  }

  connectAnalyser(analyser: AnalyserNode): void {
    this.analyser = analyser
    this.analyser.fftSize = 256
    this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount)
  }

  update(): BlendshapeMap {
    if (!this.analyser) return {}

    this.analyser.getByteFrequencyData(this.frequencyData)

    const bands = this.computeBands()
    const totalEnergy = bands.reduce((a, b) => a + b, 0)

    if (totalEnergy < SILENCE_THRESHOLD) {
      const result: BlendshapeMap = {}
      for (const viseme of OCULUS_VISEMES) {
        const prev = this.prevWeights.get(viseme) ?? 0
        const smoothed = prev * (1 - SMOOTHING)
        this.prevWeights.set(viseme, smoothed)
        if (smoothed > 0.01) {
          result[viseme] = smoothed
        }
      }
      return result
    }

    const maxBand = Math.max(...bands, 1)
    const normBands = bands.map((b) => b / maxBand) as [number, number, number, number, number]

    const scores = new Map<OculusVisemeName, number>()
    let maxScore = 0
    for (const viseme of OCULUS_VISEMES) {
      if (viseme === 'viseme_sil') continue
      const profile = VISEME_PROFILES[viseme]
      let score = 0
      for (let i = 0; i < 5; i++) {
        score += normBands[i] * profile[i]
      }
      scores.set(viseme, score)
      if (score > maxScore) maxScore = score
    }

    const result: BlendshapeMap = {}
    for (const viseme of OCULUS_VISEMES) {
      if (viseme === 'viseme_sil') continue
      const raw = (scores.get(viseme) ?? 0) / (maxScore || 1)
      const thresholded = raw > 0.5 ? (raw - 0.5) * 2 : 0
      const prev = this.prevWeights.get(viseme) ?? 0
      const smoothed = prev * (1 - SMOOTHING) + thresholded * SMOOTHING
      this.prevWeights.set(viseme, smoothed)
      if (smoothed > 0.01) {
        result[viseme] = smoothed
      }
    }

    return result
  }

  reset(): void {
    for (const v of OCULUS_VISEMES) {
      this.prevWeights.set(v, 0)
    }
  }

  private computeBands(): [number, number, number, number, number] {
    const data = this.frequencyData
    const len = data.length

    const bandRanges: [number, number][] = [
      [0, Math.floor(len * 0.05)],
      [Math.floor(len * 0.05), Math.floor(len * 0.12)],
      [Math.floor(len * 0.12), Math.floor(len * 0.23)],
      [Math.floor(len * 0.23), Math.floor(len * 0.38)],
      [Math.floor(len * 0.38), Math.floor(len * 0.6)],
    ]

    return bandRanges.map(([start, end]) => {
      let sum = 0
      const count = Math.max(1, end - start)
      for (let i = start; i < end && i < len; i++) {
        sum += data[i]!
      }
      return sum / count
    }) as [number, number, number, number, number]
  }
}
