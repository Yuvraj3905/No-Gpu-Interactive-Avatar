/**
 * Updates Gaussian positions/scales each frame based on FLAME mesh deformation.
 *
 * Uses the GaussianAvatars transform:
 *   world_pos = face_orien[f] @ local_xyz * face_scale[f] + face_center[f]
 *   world_scale = exp(local_log_scale) * face_scale[f]
 */
export class GaussianUpdater {
  private faces: Uint32Array
  private binding: Uint32Array
  private localXyz: Float32Array
  private localLogScale: Float32Array
  private localRotWxyz: Float32Array
  private gaussianCount: number

  private faceCenter: Float32Array
  private faceOrien: Float32Array   // faceCount * 9 (3x3 matrices row-major)
  private faceScale: Float32Array
  private faceCount: number

  constructor(
    faces: Uint32Array,
    binding: Uint32Array,
    localXyz: Float32Array,
    localLogScale: Float32Array,
    localRotWxyz: Float32Array,
  ) {
    this.faces = faces
    this.binding = binding
    this.localXyz = localXyz
    this.localLogScale = localLogScale
    this.localRotWxyz = localRotWxyz
    this.gaussianCount = binding.length
    this.faceCount = faces.length / 3

    this.faceCenter = new Float32Array(this.faceCount * 3)
    this.faceOrien = new Float32Array(this.faceCount * 9)
    this.faceScale = new Float32Array(this.faceCount)
  }

  /**
   * Recompute face properties from deformed FLAME vertices.
   */
  updateFaceProperties(vertices: Float32Array): void {
    const faces = this.faces
    for (let f = 0; f < this.faceCount; f++) {
      const i0 = faces[f*3], i1 = faces[f*3+1], i2 = faces[f*3+2]

      const v0x = vertices[i0*3], v0y = vertices[i0*3+1], v0z = vertices[i0*3+2]
      const v1x = vertices[i1*3], v1y = vertices[i1*3+1], v1z = vertices[i1*3+2]
      const v2x = vertices[i2*3], v2y = vertices[i2*3+1], v2z = vertices[i2*3+2]

      this.faceCenter[f*3] = (v0x+v1x+v2x)/3
      this.faceCenter[f*3+1] = (v0y+v1y+v2y)/3
      this.faceCenter[f*3+2] = (v0z+v1z+v2z)/3

      const e0x = v1x-v0x, e0y = v1y-v0y, e0z = v1z-v0z
      const e1x = v2x-v0x, e1y = v2y-v0y, e1z = v2z-v0z

      const e0len = Math.sqrt(e0x*e0x+e0y*e0y+e0z*e0z) || 1e-8
      const a0x = e0x/e0len, a0y = e0y/e0len, a0z = e0z/e0len

      let nx = a0y*e1z-a0z*e1y, ny = a0z*e1x-a0x*e1z, nz = a0x*e1y-a0y*e1x
      const nlen = Math.sqrt(nx*nx+ny*ny+nz*nz) || 1e-8
      const a1x = nx/nlen, a1y = ny/nlen, a1z = nz/nlen

      let bx = a1y*a0z-a1z*a0y, by = a1z*a0x-a1x*a0z, bz = a1x*a0y-a1y*a0x
      const blen = Math.sqrt(bx*bx+by*by+bz*bz) || 1e-8
      const a2x = -bx/blen, a2y = -by/blen, a2z = -bz/blen

      const base = f * 9
      this.faceOrien[base]   = a0x; this.faceOrien[base+1] = a1x; this.faceOrien[base+2] = a2x
      this.faceOrien[base+3] = a0y; this.faceOrien[base+4] = a1y; this.faceOrien[base+5] = a2y
      this.faceOrien[base+6] = a0z; this.faceOrien[base+7] = a1z; this.faceOrien[base+8] = a2z

      const s0 = e0len
      const s1 = Math.abs(a2x*e1x + a2y*e1y + a2z*e1z)
      this.faceScale[f] = (s0 + s1) / 2
    }
  }

  /**
   * Transform all Gaussians from local to world space.
   */
  transformGaussians(
    outPositions: Float32Array,
    outLogScales: Float32Array,
    outRotations: Float32Array,
  ): void {
    for (let g = 0; g < this.gaussianCount; g++) {
      const f = this.binding[g]
      const ob = f * 9
      const fb = f * 3
      const fs = this.faceScale[f]

      const lx = this.localXyz[g*3], ly = this.localXyz[g*3+1], lz = this.localXyz[g*3+2]

      outPositions[g*3]   = (this.faceOrien[ob]*lx + this.faceOrien[ob+1]*ly + this.faceOrien[ob+2]*lz) * fs + this.faceCenter[fb]
      outPositions[g*3+1] = (this.faceOrien[ob+3]*lx + this.faceOrien[ob+4]*ly + this.faceOrien[ob+5]*lz) * fs + this.faceCenter[fb+1]
      outPositions[g*3+2] = (this.faceOrien[ob+6]*lx + this.faceOrien[ob+7]*ly + this.faceOrien[ob+8]*lz) * fs + this.faceCenter[fb+2]

      const logFs = Math.log(Math.max(fs, 1e-12))
      outLogScales[g*3]   = this.localLogScale[g*3] + logFs
      outLogScales[g*3+1] = this.localLogScale[g*3+1] + logFs
      outLogScales[g*3+2] = this.localLogScale[g*3+2] + logFs

      outRotations[g*4]   = this.localRotWxyz[g*4]
      outRotations[g*4+1] = this.localRotWxyz[g*4+1]
      outRotations[g*4+2] = this.localRotWxyz[g*4+2]
      outRotations[g*4+3] = this.localRotWxyz[g*4+3]
    }
  }

  getGaussianCount(): number { return this.gaussianCount }
}
