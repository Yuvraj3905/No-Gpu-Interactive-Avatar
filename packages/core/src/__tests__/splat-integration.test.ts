import { describe, it, expect } from 'vitest'
import { FLAMEModel } from '../renderer/splat/FLAMEModel.js'
import { BlendshapeToFLAME } from '../renderer/splat/BlendshapeToFLAME.js'
import { GaussianUpdater } from '../renderer/splat/GaussianUpdater.js'
import { SplatAsset, createTestLCA } from '../renderer/splat/SplatAsset.js'
import type { FLAMEAssets, FLAMEShape, BlendshapeToFLAMEMappings } from '../renderer/splat/types.js'
import type { BlendshapeMap } from '../types/index.js'

function createSimpleFLAMEAssets(): FLAMEAssets {
  const vertexCount = 4
  const faceCount = 2

  const assets: FLAMEAssets = {
    templateVertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0]),
    shapeDirs: new Float32Array(vertexCount * 3 * 300),
    exprDirs: new Float32Array(vertexCount * 3 * 100),
    poseDirs: new Float32Array(vertexCount * 3 * 36),
    lbsWeights: new Float32Array(vertexCount * 5),
    joints: new Float32Array(5 * 3),
    jointCount: 5,
    jointParents: new Int32Array([-1, 0, 1, 1, 1]),
    faces: new Uint32Array([0, 1, 2, 1, 3, 2]),
    vertexCount,
    faceCount,
  }

  // vertex 0, x component, expression 0 = 0.1
  assets.exprDirs[0 * 100 + 0] = 0.1

  return assets
}

describe('Splat Pipeline Integration', () => {
  it('full pipeline: blendshapes to FLAME to Gaussian positions', () => {
    const flameAssets = createSimpleFLAMEAssets()
    const flameModel = new FLAMEModel(flameAssets)

    const mappings: BlendshapeToFLAMEMappings = {
      arkitToExpr: new Float32Array(67 * 100),
      visemeToJaw: new Float32Array(15 * 3),
      eyeToPose: new Float32Array(14 * 6),
    }
    mappings.arkitToExpr[0 * 100 + 0] = 1.0

    const mapper = new BlendshapeToFLAME(mappings)

    const binding = {
      triangleIndices: new Uint32Array([0, 1]),
      barycentrics: new Float32Array([1/3, 1/3, 1/3, 1/3, 1/3, 1/3]),
      localOffsets: new Float32Array(6),
      localRotations: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1]),
    }
    const updater = new GaussianUpdater(flameAssets.faces, binding)

    const shape: FLAMEShape = { params: new Float32Array(300) }
    const positions = new Float32Array(6)
    const rotations = new Float32Array(8)

    const neutralWeights: BlendshapeMap = {}
    const neutralFlame = mapper.convert(neutralWeights)
    const neutralVerts = flameModel.deform(shape, neutralFlame)
    updater.update(neutralVerts, positions, rotations)
    const neutralX = positions[0]

    const exprWeights: BlendshapeMap = { eyeBlinkLeft: 1.0 }
    const exprFlame = mapper.convert(exprWeights)
    const exprVerts = flameModel.deform(shape, exprFlame)
    updater.update(exprVerts, positions, rotations)
    const exprX = positions[0]

    expect(exprX).not.toBeCloseTo(neutralX)
    expect(exprX - neutralX).toBeGreaterThan(0)
  })

  it('SplatAsset loads and provides data for the pipeline', async () => {
    const lca = createTestLCA({ gaussianCount: 20, shDegree: 0, flameVersion: '2020' })
    const asset = new SplatAsset()
    await asset.load(lca)

    expect(asset.getGaussianData().count).toBe(20)
    expect(asset.getBinding().triangleIndices.length).toBe(20)
    expect(asset.getFLAMEShape().params.length).toBe(300)
  })
})
