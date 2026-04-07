import { describe, it, expect } from 'vitest'
import { BlendshapeMixer } from '../animation/BlendshapeMixer.js'
import { DEFAULT_MIXER_PRIORITIES } from '../types/index.js'

describe('BlendshapeMixer', () => {
  it('returns empty map when no channels have data', () => {
    const mixer = new BlendshapeMixer(DEFAULT_MIXER_PRIORITIES)
    const result = mixer.mix()
    expect(Object.keys(result)).toHaveLength(0)
  })

  it('returns single channel values scaled by priority', () => {
    const mixer = new BlendshapeMixer(DEFAULT_MIXER_PRIORITIES)
    mixer.setChannel('idle', { eyeBlinkLeft: 1.0 })
    const result = mixer.mix()
    expect(result.eyeBlinkLeft).toBeCloseTo(0.3) // idle priority = 0.3
  })

  it('lip-sync priority overrides idle for mouth blendshapes', () => {
    const mixer = new BlendshapeMixer(DEFAULT_MIXER_PRIORITIES)
    mixer.setChannel('idle', { jawOpen: 0.1 })
    mixer.setChannel('lipSync', { jawOpen: 0.8 })
    const result = mixer.mix()
    // lipSync(0.8 * 1.0) + idle(0.1 * 0.3) = 0.83, clamped to 1.0
    expect(result.jawOpen).toBeCloseTo(0.83)
  })

  it('clamps values to 0.0 - 1.0 range', () => {
    const mixer = new BlendshapeMixer(DEFAULT_MIXER_PRIORITIES)
    mixer.setChannel('lipSync', { jawOpen: 0.9 })
    mixer.setChannel('direct', { jawOpen: 0.5 })
    const result = mixer.mix()
    expect(result.jawOpen).toBeLessThanOrEqual(1.0)
    expect(result.jawOpen).toBeGreaterThanOrEqual(0.0)
  })

  it('clearChannel removes channel data', () => {
    const mixer = new BlendshapeMixer(DEFAULT_MIXER_PRIORITIES)
    mixer.setChannel('emotion', { mouthSmileLeft: 0.7 })
    mixer.clearChannel('emotion')
    const result = mixer.mix()
    expect(result.mouthSmileLeft).toBeUndefined()
  })

  it('clearAll removes all channel data', () => {
    const mixer = new BlendshapeMixer(DEFAULT_MIXER_PRIORITIES)
    mixer.setChannel('idle', { eyeBlinkLeft: 1.0 })
    mixer.setChannel('emotion', { mouthSmileLeft: 0.5 })
    mixer.clearAll()
    const result = mixer.mix()
    expect(Object.keys(result)).toHaveLength(0)
  })
})
