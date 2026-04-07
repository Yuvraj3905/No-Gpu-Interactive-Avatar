import type { GaussianBinding } from './types.js'

export class GaussianUpdater {
  private faces: Uint32Array
  private binding: GaussianBinding
  private gaussianCount: number

  constructor(faces: Uint32Array, binding: GaussianBinding) {
    this.faces = faces
    this.binding = binding
    this.gaussianCount = binding.triangleIndices.length
  }

  update(vertices: Float32Array, outPositions: Float32Array, outRotations: Float32Array): void {
    const { faces, binding } = this

    for (let g = 0; g < this.gaussianCount; g++) {
      const triIdx = binding.triangleIndices[g]
      const faceOffset = triIdx * 3

      const i0 = faces[faceOffset]
      const i1 = faces[faceOffset + 1]
      const i2 = faces[faceOffset + 2]

      const v0x = vertices[i0 * 3], v0y = vertices[i0 * 3 + 1], v0z = vertices[i0 * 3 + 2]
      const v1x = vertices[i1 * 3], v1y = vertices[i1 * 3 + 1], v1z = vertices[i1 * 3 + 2]
      const v2x = vertices[i2 * 3], v2y = vertices[i2 * 3 + 1], v2z = vertices[i2 * 3 + 2]

      const baryOffset = g * 3
      const b0 = binding.barycentrics[baryOffset]
      const b1 = binding.barycentrics[baryOffset + 1]
      const b2 = binding.barycentrics[baryOffset + 2]

      let px = v0x * b0 + v1x * b1 + v2x * b2
      let py = v0y * b0 + v1y * b1 + v2y * b2
      let pz = v0z * b0 + v1z * b1 + v2z * b2

      const e1x = v1x - v0x, e1y = v1y - v0y, e1z = v1z - v0z
      const e2x = v2x - v0x, e2y = v2y - v0y, e2z = v2z - v0z

      let nx = e1y * e2z - e1z * e2y
      let ny = e1z * e2x - e1x * e2z
      let nz = e1x * e2y - e1y * e2x
      const nLen = Math.sqrt(nx * nx + ny * ny + nz * nz)
      if (nLen > 1e-8) { nx /= nLen; ny /= nLen; nz /= nLen }

      let tx = e1x, ty = e1y, tz = e1z
      const tLen = Math.sqrt(tx * tx + ty * ty + tz * tz)
      if (tLen > 1e-8) { tx /= tLen; ty /= tLen; tz /= tLen }

      const bx = ny * tz - nz * ty
      const by = nz * tx - nx * tz
      const bz = nx * ty - ny * tx

      const offOffset = g * 3
      const ox = binding.localOffsets[offOffset]
      const oy = binding.localOffsets[offOffset + 1]
      const oz = binding.localOffsets[offOffset + 2]

      px += tx * ox + bx * oy + nx * oz
      py += ty * ox + by * oy + ny * oz
      pz += tz * ox + bz * oy + nz * oz

      outPositions[g * 3] = px
      outPositions[g * 3 + 1] = py
      outPositions[g * 3 + 2] = pz

      const rotOffset = g * 4
      outRotations[g * 4] = binding.localRotations[rotOffset]
      outRotations[g * 4 + 1] = binding.localRotations[rotOffset + 1]
      outRotations[g * 4 + 2] = binding.localRotations[rotOffset + 2]
      outRotations[g * 4 + 3] = binding.localRotations[rotOffset + 3]
    }
  }

  getGaussianCount(): number {
    return this.gaussianCount
  }
}
