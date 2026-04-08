import { describe, it, expect } from 'vitest'
import { GaussianUpdater } from '../renderer/splat/GaussianUpdater.js'

describe('GaussianUpdater', () => {
  // Triangle: v0=(0,0,0), v1=(1,0,0), v2=(0,1,0)
  const vertices = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0])
  const faces = new Uint32Array([0, 1, 2])

  it('local origin maps to face center', () => {
    const updater = new GaussianUpdater(
      faces,
      new Uint32Array([0]),             // binding: face 0
      new Float32Array([0, 0, 0]),      // local xyz at origin
      new Float32Array([0, 0, 0]),      // local log scale
      new Float32Array([1, 0, 0, 0]),   // identity rotation (WXYZ)
    )
    updater.updateFaceProperties(vertices)
    const pos = new Float32Array(3)
    const logScales = new Float32Array(3)
    const rot = new Float32Array(4)
    updater.transformGaussians(pos, logScales, rot)
    // Should be at face centroid
    expect(pos[0]).toBeCloseTo(1/3, 1)
    expect(pos[1]).toBeCloseTo(1/3, 1)
    expect(pos[2]).toBeCloseTo(0)
  })

  it('non-zero local offset displaces from center', () => {
    const updater = new GaussianUpdater(
      faces,
      new Uint32Array([0]),
      new Float32Array([1, 0, 0]),      // offset along local x (edge direction)
      new Float32Array([0, 0, 0]),
      new Float32Array([1, 0, 0, 0]),
    )
    updater.updateFaceProperties(vertices)
    const pos = new Float32Array(3)
    const logScales = new Float32Array(3)
    const rot = new Float32Array(4)
    updater.transformGaussians(pos, logScales, rot)
    // Should be displaced from centroid
    expect(pos[0]).not.toBeCloseTo(1/3, 1)
  })

  it('handles multiple Gaussians', () => {
    const updater = new GaussianUpdater(
      faces,
      new Uint32Array([0, 0]),
      new Float32Array([0,0,0, 1,0,0]),
      new Float32Array([0,0,0, 0,0,0]),
      new Float32Array([1,0,0,0, 1,0,0,0]),
    )
    updater.updateFaceProperties(vertices)
    const pos = new Float32Array(6)
    const logScales = new Float32Array(6)
    const rot = new Float32Array(8)
    updater.transformGaussians(pos, logScales, rot)
    // Two Gaussians should be at different positions
    expect(pos[0]).not.toBeCloseTo(pos[3])
  })

  it('scale includes face scale factor', () => {
    const updater = new GaussianUpdater(
      faces,
      new Uint32Array([0]),
      new Float32Array([0, 0, 0]),
      new Float32Array([-5, -5, -5]),   // log scale = -5
      new Float32Array([1, 0, 0, 0]),
    )
    updater.updateFaceProperties(vertices)
    const pos = new Float32Array(3)
    const logScales = new Float32Array(3)
    const rot = new Float32Array(4)
    updater.transformGaussians(pos, logScales, rot)
    // Output log scale should be >= input log scale (face scale >= 1 for unit triangle)
    expect(logScales[0]).toBeGreaterThanOrEqual(-5)
  })
})
