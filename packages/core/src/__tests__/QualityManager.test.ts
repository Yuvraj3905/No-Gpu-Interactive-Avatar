import { describe, it, expect } from 'vitest'
import { QualityManager } from '../renderer/QualityManager.js'

describe('QualityManager', () => {
  it('returns the explicitly set tier', () => {
    const qm = new QualityManager('high')
    expect(qm.getCurrentTier()).toBe('high')
  })

  it('recordFps triggers downgrade at sustained low fps', () => {
    const qm = new QualityManager('high')
    for (let i = 0; i < 60; i++) {
      qm.recordFps(30)
    }
    expect(qm.getCurrentTier()).not.toBe('high')
  })

  it('does not downgrade from a few bad frames', () => {
    const qm = new QualityManager('high')
    for (let i = 0; i < 5; i++) {
      qm.recordFps(30)
    }
    expect(qm.getCurrentTier()).toBe('high')
  })

  it('does not downgrade below low', () => {
    const qm = new QualityManager('low')
    for (let i = 0; i < 120; i++) {
      qm.recordFps(15)
    }
    expect(qm.getCurrentTier()).toBe('low')
  })
})
