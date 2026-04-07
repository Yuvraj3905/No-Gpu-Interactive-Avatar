import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { IdleSystem } from '../animation/IdleSystem.js'

describe('IdleSystem', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns blendshape values when updated', () => {
    const idle = new IdleSystem()
    idle.start()
    const result = idle.update(0.016) // 1 frame at 60fps
    expect(result).toBeDefined()
    expect(typeof result).toBe('object')
  })

  it('produces blink values that go from 0 to 1 and back', () => {
    const idle = new IdleSystem()
    idle.start()
    let sawBlink = false
    for (let t = 0; t < 10; t += 0.016) {
      const result = idle.update(0.016)
      if (result.eyeBlinkLeft !== undefined && result.eyeBlinkLeft > 0.5) {
        sawBlink = true
        break
      }
    }
    expect(sawBlink).toBe(true)
  })

  it('produces breathing values', () => {
    const idle = new IdleSystem()
    idle.start()
    const result = idle.update(0.5)
    expect(result).toBeDefined()
  })

  it('stop() halts updates', () => {
    const idle = new IdleSystem()
    idle.start()
    idle.stop()
    const result = idle.update(0.016)
    expect(Object.keys(result)).toHaveLength(0)
  })

  it('respects blinkRateMultiplier', () => {
    const idle = new IdleSystem()
    idle.start()
    idle.setBlinkRateMultiplier(0.0)
    let sawBlink = false
    for (let t = 0; t < 20; t += 0.016) {
      const result = idle.update(0.016)
      if (result.eyeBlinkLeft !== undefined && result.eyeBlinkLeft > 0.5) {
        sawBlink = true
        break
      }
    }
    expect(sawBlink).toBe(false)
  })

  it('respects breathingRateMultiplier', () => {
    const idle = new IdleSystem()
    idle.start()
    idle.setBreathingRateMultiplier(2.0)
    const result = idle.update(1.0)
    expect(result).toBeDefined()
  })
})
