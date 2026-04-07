import { describe, it, expect } from 'vitest'
import { SplatAsset, createTestLCA } from '../renderer/splat/SplatAsset.js'

describe('SplatAsset', () => {
  it('parses metadata from a mock .lca buffer', async () => {
    const lcaBuffer = createTestLCA({ gaussianCount: 100, shDegree: 0, flameVersion: '2020' })
    const asset = new SplatAsset()
    await asset.load(lcaBuffer)
    expect(asset.getMetadata().gaussianCount).toBe(100)
    expect(asset.getMetadata().shDegree).toBe(0)
  })

  it('provides Gaussian data after loading', async () => {
    const lcaBuffer = createTestLCA({ gaussianCount: 50, shDegree: 0, flameVersion: '2020' })
    const asset = new SplatAsset()
    await asset.load(lcaBuffer)
    const data = asset.getGaussianData()
    expect(data.count).toBe(50)
    expect(data.positions.length).toBe(150)
    expect(data.opacities.length).toBe(50)
    expect(data.scales.length).toBe(150)
    expect(data.rotations.length).toBe(200)
  })

  it('provides binding data after loading', async () => {
    const lcaBuffer = createTestLCA({ gaussianCount: 50, shDegree: 0, flameVersion: '2020' })
    const asset = new SplatAsset()
    await asset.load(lcaBuffer)
    const binding = asset.getBinding()
    expect(binding.triangleIndices.length).toBe(50)
    expect(binding.barycentrics.length).toBe(150)
    expect(binding.localOffsets.length).toBe(150)
    expect(binding.localRotations.length).toBe(200)
  })

  it('provides FLAME shape params', async () => {
    const lcaBuffer = createTestLCA({ gaussianCount: 10, shDegree: 0, flameVersion: '2020' })
    const asset = new SplatAsset()
    await asset.load(lcaBuffer)
    const shape = asset.getFLAMEShape()
    expect(shape.params.length).toBe(300)
  })
})
