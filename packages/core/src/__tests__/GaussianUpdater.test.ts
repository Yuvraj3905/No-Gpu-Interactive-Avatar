import { describe, it, expect } from 'vitest'
import { GaussianUpdater } from '../renderer/splat/GaussianUpdater.js'
import type { GaussianBinding } from '../renderer/splat/types.js'

describe('GaussianUpdater', () => {
  const vertices = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0])
  const faces = new Uint32Array([0, 1, 2])

  it('places Gaussian at triangle centroid', () => {
    const binding: GaussianBinding = {
      triangleIndices: new Uint32Array([0]),
      barycentrics: new Float32Array([1/3, 1/3, 1/3]),
      localOffsets: new Float32Array([0, 0, 0]),
      localRotations: new Float32Array([0, 0, 0, 1]),
    }
    const updater = new GaussianUpdater(faces, binding)
    const positions = new Float32Array(3)
    const rotations = new Float32Array(4)
    updater.update(vertices, positions, rotations)
    expect(positions[0]).toBeCloseTo(1/3)
    expect(positions[1]).toBeCloseTo(1/3)
    expect(positions[2]).toBeCloseTo(0)
  })

  it('places Gaussian at vertex 1', () => {
    const binding: GaussianBinding = {
      triangleIndices: new Uint32Array([0]),
      barycentrics: new Float32Array([0, 1, 0]),
      localOffsets: new Float32Array([0, 0, 0]),
      localRotations: new Float32Array([0, 0, 0, 1]),
    }
    const updater = new GaussianUpdater(faces, binding)
    const positions = new Float32Array(3)
    const rotations = new Float32Array(4)
    updater.update(vertices, positions, rotations)
    expect(positions[0]).toBeCloseTo(1)
    expect(positions[1]).toBeCloseTo(0)
  })

  it('applies local offset along triangle normal', () => {
    const binding: GaussianBinding = {
      triangleIndices: new Uint32Array([0]),
      barycentrics: new Float32Array([1/3, 1/3, 1/3]),
      localOffsets: new Float32Array([0, 0, 0.5]),
      localRotations: new Float32Array([0, 0, 0, 1]),
    }
    const updater = new GaussianUpdater(faces, binding)
    const positions = new Float32Array(3)
    const rotations = new Float32Array(4)
    updater.update(vertices, positions, rotations)
    expect(positions[2]).toBeCloseTo(0.5)
  })

  it('handles multiple Gaussians', () => {
    const binding: GaussianBinding = {
      triangleIndices: new Uint32Array([0, 0]),
      barycentrics: new Float32Array([1, 0, 0, 0, 1, 0]),
      localOffsets: new Float32Array([0, 0, 0, 0, 0, 0]),
      localRotations: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1]),
    }
    const updater = new GaussianUpdater(faces, binding)
    const positions = new Float32Array(6)
    const rotations = new Float32Array(8)
    updater.update(vertices, positions, rotations)
    expect(positions[0]).toBeCloseTo(0)
    expect(positions[3]).toBeCloseTo(1)
  })
})
