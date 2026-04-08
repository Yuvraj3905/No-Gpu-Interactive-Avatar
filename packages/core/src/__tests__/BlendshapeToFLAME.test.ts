import { describe, it, expect } from 'vitest'
import { BlendshapeToFLAME } from '../renderer/splat/BlendshapeToFLAME.js'
import type { BlendshapeToFLAMEMappings } from '../renderer/splat/types.js'
import type { BlendshapeMap } from '../types/index.js'

function createMockMappings(): BlendshapeToFLAMEMappings {
  const arkitToExpr = new Float32Array(67 * 100)
  arkitToExpr[0 * 100 + 0] = 2.0
  arkitToExpr[1 * 100 + 5] = 1.5

  const visemeToJaw = new Float32Array(15 * 3)
  visemeToJaw[10 * 3 + 0] = 0.8

  const eyeToPose = new Float32Array(14 * 6)
  eyeToPose[0 * 6 + 0] = 1.0

  return { arkitToExpr, visemeToJaw, eyeToPose }
}

describe('BlendshapeToFLAME', () => {
  it('creates from mappings', () => {
    const mapper = new BlendshapeToFLAME(createMockMappings())
    expect(mapper).toBeDefined()
  })

  it('maps ARKit weights to FLAME expression params (amplified+clamped)', () => {
    const mapper = new BlendshapeToFLAME(createMockMappings())
    const weights: BlendshapeMap = { eyeBlinkLeft: 0.5 }
    const result = mapper.convert(weights)
    // 0.5 * 2.0 (matrix) * 3.0 (EXPR_SCALE) = 3.0
    expect(result.expression[0]).toBeCloseTo(3.0)
    expect(result.expression.length).toBe(100)
  })

  it('maps viseme weights to jaw pose (amplified+clamped)', () => {
    const mapper = new BlendshapeToFLAME(createMockMappings())
    const weights: BlendshapeMap = { viseme_aa: 1.0 }
    const result = mapper.convert(weights)
    // 1.0 * 0.8 (matrix) * 3.0 (JAW_SCALE) = 2.4, clamped to 0.5
    expect(result.jawPose[0]).toBeCloseTo(0.5)
  })

  it('returns zero params for empty weights', () => {
    const mapper = new BlendshapeToFLAME(createMockMappings())
    const result = mapper.convert({})
    expect(result.expression[0]).toBeCloseTo(0)
    expect(result.jawPose[0]).toBeCloseTo(0)
    expect(result.eyePose[0]).toBeCloseTo(0)
  })

  it('combines multiple blendshapes additively (amplified+clamped)', () => {
    const mapper = new BlendshapeToFLAME(createMockMappings())
    const weights: BlendshapeMap = {
      eyeBlinkLeft: 0.5,
      eyeLookDownLeft: 0.4,
    }
    const result = mapper.convert(weights)
    // 0.5 * 2.0 * 3.0 = 3.0, 0.4 * 1.5 * 3.0 = 1.8
    expect(result.expression[0]).toBeCloseTo(3.0)
    expect(result.expression[5]).toBeCloseTo(1.8)
  })
})
