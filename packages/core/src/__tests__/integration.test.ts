import { describe, it, expect } from 'vitest'
import { BlendshapeMixer } from '../animation/BlendshapeMixer.js'
import { IdleSystem } from '../animation/IdleSystem.js'
import { EmotionSystem } from '../animation/EmotionSystem.js'
import { DEFAULT_MIXER_PRIORITIES } from '../types/index.js'

/**
 * Integration test: simulates a full animation frame pipeline
 * without Three.js or browser APIs (those are tested in E2E).
 */
describe('Animation Pipeline Integration', () => {
  it('produces combined blendshape output from idle + emotion', () => {
    const mixer = new BlendshapeMixer(DEFAULT_MIXER_PRIORITIES)
    const idle = new IdleSystem()
    const emotion = new EmotionSystem()

    idle.start()
    emotion.setEmotion('happy', { intensity: 0.8, transition: 0 })

    for (let i = 0; i < 60; i++) {
      const idleWeights = idle.update(1 / 60)
      const emotionWeights = emotion.update(1 / 60)

      mixer.setChannel('idle', idleWeights)
      mixer.setChannel('emotion', emotionWeights)

      const final = mixer.mix()

      expect(final.mouthSmileLeft).toBeDefined()
      for (const val of Object.values(final)) {
        expect(val).toBeGreaterThanOrEqual(0)
        expect(val).toBeLessThanOrEqual(1)
      }
    }
  })

  it('emotion transition smoothly blends over time', () => {
    const emotion = new EmotionSystem()
    emotion.setEmotion('happy', { intensity: 1.0, transition: 1000 })

    const values: number[] = []
    for (let i = 0; i < 60; i++) {
      const weights = emotion.update(1 / 60)
      values.push(weights.mouthSmileLeft ?? 0)
    }

    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]! - 0.001)
    }

    expect(values[values.length - 1]).toBeCloseTo(0.7, 1)
  })

  it('idle system produces natural blink over extended period', () => {
    const idle = new IdleSystem()
    idle.start()

    let blinkCount = 0
    let wasBlinking = false

    for (let t = 0; t < 30; t += 1 / 60) {
      const weights = idle.update(1 / 60)
      const isBlinking = (weights.eyeBlinkLeft ?? 0) > 0.5
      if (isBlinking && !wasBlinking) blinkCount++
      wasBlinking = isBlinking
    }

    expect(blinkCount).toBeGreaterThanOrEqual(3)
    expect(blinkCount).toBeLessThanOrEqual(20)
  })
})
