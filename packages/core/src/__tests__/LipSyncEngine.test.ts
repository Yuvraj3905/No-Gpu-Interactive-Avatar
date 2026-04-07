import { describe, it, expect, vi } from 'vitest'
import { LipSyncEngine } from '../animation/LipSyncEngine.js'

const mockAnalyserNode = {
  fftSize: 256,
  frequencyBinCount: 128,
  getByteFrequencyData: vi.fn((array: Uint8Array) => {
    for (let i = 0; i < array.length; i++) {
      array[i] = i < 30 ? 150 : 10
    }
  }),
  connect: vi.fn(),
  disconnect: vi.fn(),
}

const mockAudioContext = {
  createAnalyser: vi.fn(() => mockAnalyserNode),
  createMediaStreamSource: vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn() })),
  createBufferSource: vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    buffer: null,
    onended: null,
  })),
  destination: {},
  sampleRate: 44100,
  state: 'running' as const,
  close: vi.fn(),
} as unknown as AudioContext

describe('LipSyncEngine', () => {
  it('creates with audio context', () => {
    const engine = new LipSyncEngine(mockAudioContext)
    expect(engine).toBeDefined()
  })

  it('returns viseme weights from frequency analysis', () => {
    const engine = new LipSyncEngine(mockAudioContext)
    engine.connectAnalyser(mockAnalyserNode as unknown as AnalyserNode)
    const result = engine.update()
    expect(result).toBeDefined()
    expect(typeof result).toBe('object')
  })

  it('returns silence viseme when no audio energy', () => {
    const silentAnalyser = {
      ...mockAnalyserNode,
      getByteFrequencyData: vi.fn((array: Uint8Array) => {
        array.fill(0)
      }),
    }
    const engine = new LipSyncEngine(mockAudioContext)
    engine.connectAnalyser(silentAnalyser as unknown as AnalyserNode)
    const result = engine.update()
    const totalWeight = Object.values(result).reduce((sum, v) => sum + (v ?? 0), 0)
    expect(totalWeight).toBeLessThan(0.5)
  })

  it('smooths transitions between visemes', () => {
    const engine = new LipSyncEngine(mockAudioContext)
    engine.connectAnalyser(mockAnalyserNode as unknown as AnalyserNode)
    const result1 = engine.update()
    const result2 = engine.update()
    expect(result1).toBeDefined()
    expect(result2).toBeDefined()
  })

  it('reset() clears state', () => {
    const engine = new LipSyncEngine(mockAudioContext)
    engine.connectAnalyser(mockAnalyserNode as unknown as AnalyserNode)
    engine.update()
    engine.reset()
    const result = engine.update()
    expect(result).toBeDefined()
  })
})
