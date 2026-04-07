import type { FLAMEAssets, FLAMEShape, FLAMEParams } from './types.js'

export class FLAMEModel {
  private assets: FLAMEAssets
  private outputVertices: Float32Array

  constructor(assets: FLAMEAssets) {
    this.assets = assets
    this.outputVertices = new Float32Array(assets.vertexCount * 3)
  }

  deform(shape: FLAMEShape, params: FLAMEParams): Float32Array {
    const { templateVertices, shapeDirs, exprDirs, poseDirs, vertexCount } = this.assets
    const out = this.outputVertices

    out.set(templateVertices)

    this.addBlend(out, shapeDirs, shape.params, 300, vertexCount)
    this.addBlend(out, exprDirs, params.expression, 100, vertexCount)

    const poseVector = new Float32Array(36)
    poseVector.set(params.jawPose, 0)
    poseVector.set(params.neckPose, 3)
    poseVector.set(params.eyePose, 6)
    this.addBlend(out, poseDirs, poseVector, 36, vertexCount)

    this.applySimplifiedLBS(out, params, vertexCount)

    return out
  }

  getFaces(): Uint32Array {
    return this.assets.faces
  }

  getFaceCount(): number {
    return this.assets.faceCount
  }

  getVertexCount(): number {
    return this.assets.vertexCount
  }

  /**
   * Blendshape dirs layout: flat array where for vertex v, component c, blend index i:
   *   index = (v * 3 + c) * numWeights + i
   */
  private addBlend(
    out: Float32Array,
    dirs: Float32Array,
    weights: Float32Array,
    numWeights: number,
    vertexCount: number,
  ): void {
    for (let i = 0; i < numWeights; i++) {
      const w = weights[i]
      if (Math.abs(w) < 1e-7) continue
      for (let v = 0; v < vertexCount; v++) {
        for (let c = 0; c < 3; c++) {
          const dirIdx = (v * 3 + c) * numWeights + i
          out[v * 3 + c] += dirs[dirIdx] * w
        }
      }
    }
  }

  private applySimplifiedLBS(
    out: Float32Array,
    params: FLAMEParams,
    vertexCount: number,
  ): void {
    const { lbsWeights } = this.assets

    const jawRot = axisAngleToMatrix(params.jawPose)
    const neckRot = axisAngleToMatrix(params.neckPose)

    for (let v = 0; v < vertexCount; v++) {
      const neckWeight = lbsWeights[v * 5]
      const jawWeight = lbsWeights[v * 5 + 1]

      if (neckWeight < 1e-5 && jawWeight < 1e-5) continue

      const x = out[v * 3]
      const y = out[v * 3 + 1]
      const z = out[v * 3 + 2]

      let rx = x, ry = y, rz = z

      if (jawWeight > 1e-5) {
        const [jx, jy, jz] = applyRotation(jawRot, x, y, z)
        rx += (jx - x) * jawWeight
        ry += (jy - y) * jawWeight
        rz += (jz - z) * jawWeight
      }

      if (neckWeight > 1e-5) {
        const [nx, ny, nz] = applyRotation(neckRot, rx, ry, rz)
        rx += (nx - rx) * neckWeight
        ry += (ny - ry) * neckWeight
        rz += (nz - rz) * neckWeight
      }

      out[v * 3] = rx
      out[v * 3 + 1] = ry
      out[v * 3 + 2] = rz
    }
  }
}

function axisAngleToMatrix(aa: Float32Array): Float32Array {
  const angle = Math.sqrt(aa[0] * aa[0] + aa[1] * aa[1] + aa[2] * aa[2])
  if (angle < 1e-8) {
    return new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1])
  }
  const x = aa[0] / angle
  const y = aa[1] / angle
  const z = aa[2] / angle
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  const t = 1 - c

  return new Float32Array([
    t * x * x + c,     t * x * y - s * z, t * x * z + s * y,
    t * x * y + s * z, t * y * y + c,     t * y * z - s * x,
    t * x * z - s * y, t * y * z + s * x, t * z * z + c,
  ])
}

function applyRotation(mat: Float32Array, x: number, y: number, z: number): [number, number, number] {
  return [
    mat[0] * x + mat[1] * y + mat[2] * z,
    mat[3] * x + mat[4] * y + mat[5] * z,
    mat[6] * x + mat[7] * y + mat[8] * z,
  ]
}
