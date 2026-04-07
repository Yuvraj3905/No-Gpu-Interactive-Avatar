import type { BlendshapeMap, BlendshapeName, EmotionName, EmotionOptions, TransitionOptions } from '../types/index.js'
import { EMOTION_PRESETS } from '../types/index.js'

interface EmotionModifiers {
  blinkRateMultiplier: number
  headPitchOffset: number
  headYawOffset: number
  breathingRateMultiplier: number
}

const NEUTRAL_MODIFIERS: EmotionModifiers = {
  blinkRateMultiplier: 1.0,
  headPitchOffset: 0,
  headYawOffset: 0,
  breathingRateMultiplier: 1.0,
}

export class EmotionSystem {
  private currentBlendshapes: BlendshapeMap = {}
  private targetBlendshapes: BlendshapeMap = {}
  private currentModifiers: EmotionModifiers = { ...NEUTRAL_MODIFIERS }
  private targetModifiers: EmotionModifiers = { ...NEUTRAL_MODIFIERS }
  private transitionDuration = 0
  private transitionElapsed = 0
  private transitioning = false
  private prevBlendshapes: BlendshapeMap = {}
  private prevModifiers: EmotionModifiers = { ...NEUTRAL_MODIFIERS }

  setEmotion(emotion: EmotionName, options: EmotionOptions = {}): void {
    const { intensity = 1.0, transition = 300 } = options
    const preset = EMOTION_PRESETS[emotion]

    this.prevBlendshapes = { ...this.currentBlendshapes }
    this.prevModifiers = { ...this.currentModifiers }

    this.targetBlendshapes = {}
    for (const [key, value] of Object.entries(preset.blendshapes)) {
      this.targetBlendshapes[key as BlendshapeName] = (value as number) * intensity
    }

    this.targetModifiers = {
      blinkRateMultiplier: lerp(1.0, preset.blinkRateMultiplier, intensity),
      headPitchOffset: preset.headPitchOffset * intensity,
      headYawOffset: preset.headYawOffset * intensity,
      breathingRateMultiplier: lerp(1.0, preset.breathingRateMultiplier, intensity),
    }

    this.transitionDuration = transition / 1000
    this.transitionElapsed = 0
    this.transitioning = this.transitionDuration > 0
    if (!this.transitioning) {
      this.currentBlendshapes = { ...this.targetBlendshapes }
      this.currentModifiers = { ...this.targetModifiers }
    }
  }

  clearEmotion(options: TransitionOptions = {}): void {
    this.setEmotion('neutral', { intensity: 1.0, transition: options.transition ?? 300 })
  }

  update(deltaTime: number): BlendshapeMap {
    if (!this.transitioning) {
      return { ...this.currentBlendshapes }
    }

    this.transitionElapsed += deltaTime
    const t = Math.min(1.0, this.transitionElapsed / this.transitionDuration)
    const eased = smoothstep(t)

    const allKeys = new Set<BlendshapeName>([
      ...Object.keys(this.prevBlendshapes) as BlendshapeName[],
      ...Object.keys(this.targetBlendshapes) as BlendshapeName[],
    ])

    this.currentBlendshapes = {}
    for (const key of allKeys) {
      const from = this.prevBlendshapes[key] ?? 0
      const to = this.targetBlendshapes[key] ?? 0
      const val = lerp(from, to, eased)
      if (val > 0.001) {
        this.currentBlendshapes[key] = val
      }
    }

    this.currentModifiers = {
      blinkRateMultiplier: lerp(this.prevModifiers.blinkRateMultiplier, this.targetModifiers.blinkRateMultiplier, eased),
      headPitchOffset: lerp(this.prevModifiers.headPitchOffset, this.targetModifiers.headPitchOffset, eased),
      headYawOffset: lerp(this.prevModifiers.headYawOffset, this.targetModifiers.headYawOffset, eased),
      breathingRateMultiplier: lerp(this.prevModifiers.breathingRateMultiplier, this.targetModifiers.breathingRateMultiplier, eased),
    }

    if (t >= 1.0) {
      this.transitioning = false
    }

    return { ...this.currentBlendshapes }
  }

  getCurrentModifiers(): EmotionModifiers {
    return { ...this.currentModifiers }
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t)
}
