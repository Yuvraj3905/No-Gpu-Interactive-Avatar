/** FLAME model parameters for a single frame */
export interface FLAMEParams {
  /** Expression coefficients (100 floats) */
  expression: Float32Array
  /** Jaw rotation as axis-angle (3 floats) */
  jawPose: Float32Array
  /** Neck rotation as axis-angle (3 floats) */
  neckPose: Float32Array
  /** Left/right eye gaze as axis-angle (6 floats) */
  eyePose: Float32Array
}

/** Per-avatar FLAME shape (fixed after avatar creation) */
export interface FLAMEShape {
  /** Shape coefficients (300 floats) */
  params: Float32Array
}

/** FLAME model assets (shared across all avatars, ~4MB) */
export interface FLAMEAssets {
  templateVertices: Float32Array
  shapeDirs: Float32Array
  exprDirs: Float32Array
  poseDirs: Float32Array
  lbsWeights: Float32Array
  joints: Float32Array
  jointCount: number
  jointParents: Int32Array
  faces: Uint32Array
  vertexCount: number
  faceCount: number
}

/** Blendshape-to-FLAME mapping matrices */
export interface BlendshapeToFLAMEMappings {
  arkitToExpr: Float32Array
  visemeToJaw: Float32Array
  eyeToPose: Float32Array
}

/** Raw Gaussian splat data for an avatar */
export interface GaussianData {
  count: number
  positions: Float32Array
  colors: Float32Array
  shDegree: number
  opacities: Float32Array
  scales: Float32Array
  rotations: Float32Array
}

/** Per-Gaussian binding to a FLAME triangle */
export interface GaussianBinding {
  triangleIndices: Uint32Array
  barycentrics: Float32Array
  localOffsets: Float32Array
  localRotations: Float32Array
}

/** Metadata from .lca file */
export interface SplatAvatarMetadata {
  version: string
  gaussianCount: number
  shDegree: number
  flameVersion: string
}

/** Renderer backend interface — WebGPU or WebGL implements this */
export interface RenderBackend {
  init(canvas: HTMLCanvasElement, gaussianCount: number): Promise<void>
  uploadGaussians(data: GaussianData): void
  updatePositions(positions: Float32Array, rotations: Float32Array): void
  render(viewMatrix: Float32Array, projMatrix: Float32Array): void
  resize(width: number, height: number): void
  dispose(): void
}
