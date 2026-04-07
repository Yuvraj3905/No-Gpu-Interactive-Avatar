import { describe, it, expect } from 'vitest'
import { FLAMEModel } from '../renderer/splat/FLAMEModel.js'
import type { FLAMEAssets, FLAMEShape, FLAMEParams } from '../renderer/splat/types.js'

function createMockFLAMEAssets(vertexCount = 10, faceCount = 6): FLAMEAssets {
  return {
    templateVertices: new Float32Array(vertexCount * 3).fill(0),
    shapeDirs: new Float32Array(vertexCount * 3 * 300).fill(0),
    exprDirs: new Float32Array(vertexCount * 3 * 100).fill(0),
    poseDirs: new Float32Array(vertexCount * 3 * 36).fill(0),
    lbsWeights: new Float32Array(vertexCount * 5).fill(0),
    joints: new Float32Array(5 * 3).fill(0),
    jointCount: 5,
    jointParents: new Int32Array([-1, 0, 1, 1, 1]),
    faces: new Uint32Array(faceCount * 3),
    vertexCount,
    faceCount,
  }
}

function createNeutralParams(): FLAMEParams {
  return {
    expression: new Float32Array(100),
    jawPose: new Float32Array(3),
    neckPose: new Float32Array(3),
    eyePose: new Float32Array(6),
  }
}

describe('FLAMEModel', () => {
  it('creates from assets', () => {
    const assets = createMockFLAMEAssets()
    const model = new FLAMEModel(assets)
    expect(model).toBeDefined()
  })

  it('deform with neutral params returns template vertices', () => {
    const assets = createMockFLAMEAssets()
    assets.templateVertices[0] = 1.0
    assets.templateVertices[1] = 2.0
    assets.templateVertices[2] = 3.0

    const model = new FLAMEModel(assets)
    const shape: FLAMEShape = { params: new Float32Array(300) }
    const params = createNeutralParams()

    const result = model.deform(shape, params)
    expect(result.length).toBe(assets.vertexCount * 3)
    expect(result[0]).toBeCloseTo(1.0, 3)
    expect(result[1]).toBeCloseTo(2.0, 3)
    expect(result[2]).toBeCloseTo(3.0, 3)
  })

  it('expression params change vertex positions', () => {
    const assets = createMockFLAMEAssets()
    // exprDirs layout: for vertex v, component c, expression i:
    // index = (v * 3 + c) * 100 + i
    // Set: vertex 0, component x (c=0), expression 0 (i=0) = 0.5
    assets.exprDirs[0 * 100 + 0] = 0.5

    const model = new FLAMEModel(assets)
    const shape: FLAMEShape = { params: new Float32Array(300) }
    const params = createNeutralParams()
    params.expression[0] = 1.0

    const result = model.deform(shape, params)
    expect(result[0]).toBeCloseTo(0.5, 3)
  })

  it('shape params change vertex positions', () => {
    const assets = createMockFLAMEAssets()
    // shapeDirs layout: for vertex v, component c, shape i:
    // index = (v * 3 + c) * 300 + i
    // Set: vertex 0, component y (c=1), shape 0 (i=0) = 0.3
    assets.shapeDirs[1 * 300 + 0] = 0.3

    const model = new FLAMEModel(assets)
    const shape: FLAMEShape = { params: new Float32Array(300) }
    shape.params[0] = 1.0
    const params = createNeutralParams()

    const result = model.deform(shape, params)
    expect(result[1]).toBeCloseTo(0.3, 3)
  })

  it('getDeformedVertices returns Float32Array of correct length', () => {
    const assets = createMockFLAMEAssets(100, 50)
    const model = new FLAMEModel(assets)
    const shape: FLAMEShape = { params: new Float32Array(300) }
    const params = createNeutralParams()

    const result = model.deform(shape, params)
    expect(result).toBeInstanceOf(Float32Array)
    expect(result.length).toBe(300)
  })

  it('getFaces returns face indices', () => {
    const assets = createMockFLAMEAssets(10, 6)
    const model = new FLAMEModel(assets)
    expect(model.getFaces()).toBe(assets.faces)
    expect(model.getFaceCount()).toBe(6)
  })
})
