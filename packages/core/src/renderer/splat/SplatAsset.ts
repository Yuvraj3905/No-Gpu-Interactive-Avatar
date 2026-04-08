import type { GaussianData, GaussianBinding, SplatAvatarMetadata, FLAMEShape } from './types.js'

export class SplatAsset {
  private metadata: SplatAvatarMetadata | null = null
  private gaussianData: GaussianData | null = null
  private binding: GaussianBinding | null = null
  private flameShape: FLAMEShape | null = null

  async load(buffer: ArrayBuffer): Promise<void> {
    const view = new DataView(buffer)
    const headerLen = view.getUint32(0, true)
    const headerBytes = new Uint8Array(buffer, 4, headerLen)
    const headerJSON = new TextDecoder().decode(headerBytes)
    const header = JSON.parse(headerJSON) as LCAHeader

    this.metadata = {
      version: header.version,
      gaussianCount: header.gaussianCount,
      shDegree: header.shDegree,
      flameVersion: header.flameVersion,
    }

    const n = header.gaussianCount
    const rawOffset = 4 + headerLen
    let offset = (rawOffset + 3) & ~3

    if (header.format === 'local') {
      // v2 format: local-space coords with triangle binding indices
      this.loadLocalFormat(buffer, offset, n, header.shDegree)
    } else {
      // v1 format: world-space coords with barycentric binding
      this.loadWorldFormat(buffer, offset, n, header.shDegree)
    }
  }

  private loadLocalFormat(buffer: ArrayBuffer, offset: number, n: number, shDegree: number): void {
    // local_xyz, colors, opacity, local_log_scale, local_rot, binding(uint32), shape
    const localXyz = new Float32Array(buffer, offset, n * 3); offset += n * 3 * 4
    const colorComponents = shDegree === 0 ? 3 : 48
    const colors = new Float32Array(buffer, offset, n * colorComponents); offset += n * colorComponents * 4
    const opacities = new Float32Array(buffer, offset, n); offset += n * 4
    const scales = new Float32Array(buffer, offset, n * 3); offset += n * 3 * 4
    const rotations = new Float32Array(buffer, offset, n * 4); offset += n * 4 * 4

    this.gaussianData = {
      count: n,
      positions: new Float32Array(localXyz), // local positions
      colors,
      shDegree,
      opacities,
      scales,
      rotations: new Float32Array(rotations),
    }

    // Simple binding: just triangle indices
    const triangleIndices = new Uint32Array(buffer, offset, n); offset += n * 4
    this.binding = {
      triangleIndices,
      barycentrics: new Float32Array(0), // not used in local format
      localOffsets: new Float32Array(0),
      localRotations: new Float32Array(0),
    }

    const shapeParams = new Float32Array(buffer, offset, 300); offset += 300 * 4
    this.flameShape = { params: new Float32Array(shapeParams) }
  }

  private loadWorldFormat(buffer: ArrayBuffer, offset: number, n: number, shDegree: number): void {
    // v1: positions, colors, opacity, scales, rotations, triIndices, barycentrics, offsets, localRots, shape
    const positions = new Float32Array(buffer, offset, n * 3); offset += n * 3 * 4
    const colorComponents = shDegree === 0 ? 3 : 48
    const colors = new Float32Array(buffer, offset, n * colorComponents); offset += n * colorComponents * 4
    const opacities = new Float32Array(buffer, offset, n); offset += n * 4
    const scales = new Float32Array(buffer, offset, n * 3); offset += n * 3 * 4
    const rotations = new Float32Array(buffer, offset, n * 4); offset += n * 4 * 4

    this.gaussianData = {
      count: n,
      positions: new Float32Array(positions),
      colors, shDegree, opacities, scales,
      rotations: new Float32Array(rotations),
    }

    const triangleIndices = new Uint32Array(buffer, offset, n); offset += n * 4
    const barycentrics = new Float32Array(buffer, offset, n * 3); offset += n * 3 * 4
    const localOffsets = new Float32Array(buffer, offset, n * 3); offset += n * 3 * 4
    const localRotations = new Float32Array(buffer, offset, n * 4); offset += n * 4 * 4

    this.binding = { triangleIndices, barycentrics, localOffsets, localRotations }

    const shapeParams = new Float32Array(buffer, offset, 300); offset += 300 * 4
    this.flameShape = { params: new Float32Array(shapeParams) }
  }

  getMetadata(): SplatAvatarMetadata { if (!this.metadata) throw new Error('Not loaded'); return this.metadata }
  getGaussianData(): GaussianData { if (!this.gaussianData) throw new Error('Not loaded'); return this.gaussianData }
  getBinding(): GaussianBinding { if (!this.binding) throw new Error('Not loaded'); return this.binding }
  getFLAMEShape(): FLAMEShape { if (!this.flameShape) throw new Error('Not loaded'); return this.flameShape }
  isLocalFormat(): boolean { return this.metadata?.version === '2.0.0' }
}

interface LCAHeader {
  version: string
  gaussianCount: number
  shDegree: number
  flameVersion: string
  format?: 'local' | 'world'
}

export function createTestLCA(opts: {
  gaussianCount: number
  shDegree: number
  flameVersion: string
}): ArrayBuffer {
  const header: LCAHeader = { version: '1.0.0', gaussianCount: opts.gaussianCount, shDegree: opts.shDegree, flameVersion: opts.flameVersion }
  const headerBytes = new TextEncoder().encode(JSON.stringify(header))
  const n = opts.gaussianCount
  const colorComponents = opts.shDegree === 0 ? 3 : 48
  const rawDataStart = 4 + headerBytes.length
  const dataStart = (rawDataStart + 3) & ~3
  const dataSize = n*3*4 + n*colorComponents*4 + n*4 + n*3*4 + n*4*4 + n*4 + n*3*4 + n*3*4 + n*4*4 + 300*4
  const buffer = new ArrayBuffer(dataStart + dataSize)
  new DataView(buffer).setUint32(0, headerBytes.length, true)
  new Uint8Array(buffer, 4, headerBytes.length).set(headerBytes)
  return buffer
}
