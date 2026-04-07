import { describe, it, expect } from 'vitest'
import { EmotionSystem } from '../animation/EmotionSystem.js'

describe('EmotionSystem', () => {
  it('returns empty blendshapes when no emotion is set', () => {
    const system = new EmotionSystem()
    const result = system.update(0.016)
    expect(Object.keys(result)).toHaveLength(0)
  })

  it('returns target blendshapes immediately when transition is 0', () => {
    const system = new EmotionSystem()
    system.setEmotion('happy', { intensity: 1.0, transition: 0 })
    const result = system.update(0.016)
    expect(result.mouthSmileLeft).toBeCloseTo(0.7)
    expect(result.mouthSmileRight).toBeCloseTo(0.7)
  })

  it('scales blendshapes by intensity', () => {
    const system = new EmotionSystem()
    system.setEmotion('happy', { intensity: 0.5, transition: 0 })
    const result = system.update(0.016)
    expect(result.mouthSmileLeft).toBeCloseTo(0.35)
  })

  it('transitions smoothly over time', () => {
    const system = new EmotionSystem()
    system.setEmotion('happy', { intensity: 1.0, transition: 1000 })
    const result = system.update(0.5)
    expect(result.mouthSmileLeft).toBeGreaterThan(0.1)
    expect(result.mouthSmileLeft).toBeLessThan(0.6)
  })

  it('clears emotion with transition', () => {
    const system = new EmotionSystem()
    system.setEmotion('happy', { intensity: 1.0, transition: 0 })
    system.update(0.016)
    system.clearEmotion({ transition: 0 })
    const result = system.update(0.016)
    expect(result.mouthSmileLeft).toBeUndefined()
  })

  it('exposes current emotion modifiers', () => {
    const system = new EmotionSystem()
    system.setEmotion('sad', { intensity: 1.0, transition: 0 })
    system.update(0.016)
    const mods = system.getCurrentModifiers()
    expect(mods.blinkRateMultiplier).toBeCloseTo(1.4)
    expect(mods.headPitchOffset).toBeCloseTo(8)
    expect(mods.breathingRateMultiplier).toBeCloseTo(0.85)
  })
})
