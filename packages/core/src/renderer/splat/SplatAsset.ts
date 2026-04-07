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
    // Align offset to 4-byte boundary for typed array views
    const rawOffset = 4 + headerLen
    let offset = (rawOffset + 3) & ~3

    const positions = new Float32Array(buffer, offset, n * 3); offset += n * 3 * 4
    const colorComponents = header.shDegree === 0 ? 3 : 48
    const colors = new Float32Array(buffer, offset, n * colorComponents); offset += n * colorComponents * 4
    const opacities = new Float32Array(buffer, offset, n); offset += n * 4
    const scales = new Float32Array(buffer, offset, n * 3); offset += n * 3 * 4
    const rotations = new Float32Array(buffer, offset, n * 4); offset += n * 4 * 4

    this.gaussianData = {
      count: n,
      positions: new Float32Array(positions),
      colors,
      shDegree: header.shDegree,
      opacities,
      scales,
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

  getMetadata(): SplatAvatarMetadata {
    if (!this.metadata) throw new Error('Asset not loaded')
    return this.metadata
  }

  getGaussianData(): GaussianData {
    if (!this.gaussianData) throw new Error('Asset not loaded')
    return this.gaussianData
  }

  getBinding(): GaussianBinding {
    if (!this.binding) throw new Error('Asset not loaded')
    return this.binding
  }

  getFLAMEShape(): FLAMEShape {
    if (!this.flameShape) throw new Error('Asset not loaded')
    return this.flameShape
  }
}

interface LCAHeader {
  version: string
  gaussianCount: number
  shDegree: number
  flameVersion: string
}

export function createTestLCA(opts: {
  gaussianCount: number
  shDegree: number
  flameVersion: string
}): ArrayBuffer {
  const header: LCAHeader = {
    version: '1.0.0',
    gaussianCount: opts.gaussianCount,
    shDegree: opts.shDegree,
    flameVersion: opts.flameVersion,
  }

  const headerJSON = JSON.stringify(header)
  const headerBytes = new TextEncoder().encode(headerJSON)
  const n = opts.gaussianCount
  const colorComponents = opts.shDegree === 0 ? 3 : 48

  // Align data start to 4-byte boundary
  const rawDataStart = 4 + headerBytes.length
  const dataStart = (rawDataStart + 3) & ~3

  const dataSize =
    n * 3 * 4 +
    n * colorComponents * 4 +
    n * 4 +
    n * 3 * 4 +
    n * 4 * 4 +
    n * 4 +
    n * 3 * 4 +
    n * 3 * 4 +
    n * 4 * 4 +
    300 * 4

  const totalSize = dataStart + dataSize
  const buffer = new ArrayBuffer(totalSize)
  const view = new DataView(buffer)

  view.setUint32(0, headerBytes.length, true)
  new Uint8Array(buffer, 4, headerBytes.length).set(headerBytes)

  return buffer
}
