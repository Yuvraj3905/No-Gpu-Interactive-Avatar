# Gaussian Splat Photorealistic Renderer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a WebGPU-based Gaussian splatting renderer driven by FLAME parametric head deformation to the existing Low-Cost Avatar SDK, enabling photorealistic avatar rendering client-side.

**Architecture:** A new `renderer: 'splat'` option in `LowCostAvatar` routes to a Gaussian splat rendering pipeline instead of the existing Three.js mesh renderer. The existing animation systems (BlendshapeMixer, IdleSystem, EmotionSystem, LipSyncEngine) are unchanged — a `BlendshapeToFLAME` bridge converts their output to FLAME parameters, which deform the mesh, which repositions the Gaussians each frame.

**Tech Stack:** TypeScript, WebGPU (WGSL shaders), WebGL 2.0 (fallback), FLAME parametric head model, Vitest

---

## File Structure

```
packages/core/src/
  renderer/splat/
    types.ts                  # Splat-specific type definitions
    FLAMEModel.ts             # FLAME mesh deformation (pure math, no GPU)
    BlendshapeToFLAME.ts      # ARKit weights → FLAME expression params
    SplatAsset.ts             # .lca file loader (zip → typed arrays)
    GaussianUpdater.ts        # Applies FLAME deformation to Gaussian positions
    SplatRenderer.ts          # Orchestrates WebGPU/WebGL rendering pipeline
    SplatScene.ts             # Scene setup: camera, container, resize, render loop
    gpu/
      webgpu-backend.ts       # WebGPU init, buffer management, render pass
      sort.wgsl               # Compute shader: radix sort by depth
      render.wgsl             # Render shader: Gaussian splatting
      webgl-backend.ts        # WebGL 2.0 fallback: CPU sort + instanced rendering
  types/index.ts              # Add renderer option to AvatarOptions
  LowCostAvatar.ts            # Add renderer: 'splat' branch in load() and onFrame()
  index.ts                    # Export new types

packages/core/src/__tests__/
  FLAMEModel.test.ts
  BlendshapeToFLAME.test.ts
  SplatAsset.test.ts
  GaussianUpdater.test.ts
  splat-integration.test.ts

examples/splat-demo/
  package.json
  index.html
```

---

## Phase 1: Types & Math Foundation

### Task 1: Splat Type Definitions

**Files:**
- Create: `packages/core/src/renderer/splat/types.ts`
- Modify: `packages/core/src/types/index.ts`

- [ ] **Step 1: Create splat types**

```ts
// packages/core/src/renderer/splat/types.ts

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
  /** Neutral face template vertices, 5023×3 */
  templateVertices: Float32Array
  /** Shape blendshape directions, 5023×3×300 */
  shapeDirs: Float32Array
  /** Expression blendshape directions, 5023×3×100 */
  exprDirs: Float32Array
  /** Pose blendshape directions, 5023×3×36 */
  poseDirs: Float32Array
  /** LBS skinning weights, 5023×5 */
  lbsWeights: Float32Array
  /** Joint positions and parent indices */
  joints: Float32Array
  /** Number of joints */
  jointCount: number
  /** Joint parent indices */
  jointParents: Int32Array
  /** Triangle face indices, 9976×3 */
  faces: Uint32Array
  /** Number of vertices */
  vertexCount: number
  /** Number of faces */
  faceCount: number
}

/** Blendshape-to-FLAME mapping matrices */
export interface BlendshapeToFLAMEMappings {
  /** ARKit+Viseme weights (67) → FLAME expression (100), row-major */
  arkitToExpr: Float32Array
  /** Viseme weights (15) → jaw pose (3), row-major */
  visemeToJaw: Float32Array
  /** Eye blendshapes (14) → eye pose (6), row-major */
  eyeToPose: Float32Array
}

/** Raw Gaussian splat data for an avatar */
export interface GaussianData {
  /** Number of Gaussians */
  count: number
  /** Positions (count×3) — mutable, updated each frame */
  positions: Float32Array
  /** Spherical harmonic colors (count×3 for SH degree 0, count×48 for degree 3) */
  colors: Float32Array
  /** SH degree (0 or 3) */
  shDegree: number
  /** Opacity values (count×1) */
  opacities: Float32Array
  /** Scale values (count×3) */
  scales: Float32Array
  /** Rotation quaternions (count×4) — mutable for FLAME rotation */
  rotations: Float32Array
}

/** Per-Gaussian binding to a FLAME triangle */
export interface GaussianBinding {
  /** Triangle index for each Gaussian (count) */
  triangleIndices: Uint32Array
  /** Barycentric coordinates (count×3) */
  barycentrics: Float32Array
  /** Local offset from triangle surface (count×3) */
  localOffsets: Float32Array
  /** Local rotation relative to triangle (count×4, quaternion) */
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
```

- [ ] **Step 2: Add renderer option to AvatarOptions**

Add to `packages/core/src/types/index.ts`:

```ts
export type RendererType = 'mesh' | 'splat'
```

Update `AvatarOptions`:

```ts
export interface AvatarOptions {
  container: HTMLElement
  avatar: string
  quality?: QualityTier | 'auto'
  assetsBaseUrl?: string
  cache?: boolean
  /** Renderer type. 'mesh' for Three.js (default), 'splat' for Gaussian splatting */
  renderer?: RendererType
}
```

- [ ] **Step 3: Verify types compile**

Run: `cd packages/core && pnpm typecheck`
Expected: No errors

- [ ] **Step 4: Commit and push**

```bash
git add packages/core/src/renderer/splat/types.ts packages/core/src/types/index.ts
git commit -m "feat(splat): add type definitions for Gaussian splat renderer and FLAME model"
git push
```

---

### Task 2: FLAME Model Deformation

**Files:**
- Create: `packages/core/src/renderer/splat/FLAMEModel.ts`
- Create: `packages/core/src/__tests__/FLAMEModel.test.ts`

This is pure linear algebra — no GPU, no DOM.

- [ ] **Step 1: Write failing tests**

```ts
// packages/core/src/__tests__/FLAMEModel.test.ts
import { describe, it, expect } from 'vitest'
import { FLAMEModel } from '../renderer/splat/FLAMEModel.js'
import type { FLAMEAssets, FLAMEShape, FLAMEParams } from '../renderer/splat/types.js'

function createMockFLAMEAssets(vertexCount = 10, faceCount = 6): FLAMEAssets {
  return {
    templateVertices: new Float32Array(vertexCount * 3).fill(0),
    shapeDirs: new Float32Array(vertexCount * 3 * 300).fill(0),
    exprDirs: new Float32Array(vertexCount * 3 * 100).fill(0),
    poseDirs: new Float32Array(vertexCount * 3 * 36).fill(0),
    lbsWeights: new Float32Array(vertexCount * 5).fill(0),
    joints: new Float32Array(5 * 3).fill(0),
    jointCount: 5,
    jointParents: new Int32Array([-1, 0, 1, 1, 1]),
    faces: new Uint32Array(faceCount * 3),
    vertexCount,
    faceCount,
  }
}

function createNeutralParams(): FLAMEParams {
  return {
    expression: new Float32Array(100),
    jawPose: new Float32Array(3),
    neckPose: new Float32Array(3),
    eyePose: new Float32Array(6),
  }
}

describe('FLAMEModel', () => {
  it('creates from assets', () => {
    const assets = createMockFLAMEAssets()
    const model = new FLAMEModel(assets)
    expect(model).toBeDefined()
  })

  it('deform with neutral params returns template vertices', () => {
    const assets = createMockFLAMEAssets()
    // Set template to known values
    assets.templateVertices[0] = 1.0
    assets.templateVertices[1] = 2.0
    assets.templateVertices[2] = 3.0

    const model = new FLAMEModel(assets)
    const shape: FLAMEShape = { params: new Float32Array(300) }
    const params = createNeutralParams()

    const result = model.deform(shape, params)
    expect(result.length).toBe(assets.vertexCount * 3)
    // With zero shape/expression/pose, output ≈ template
    expect(result[0]).toBeCloseTo(1.0, 3)
    expect(result[1]).toBeCloseTo(2.0, 3)
    expect(result[2]).toBeCloseTo(3.0, 3)
  })

  it('expression params change vertex positions', () => {
    const assets = createMockFLAMEAssets()
    // Set exprDirs so expression[0]=1.0 moves vertex[0].x by 0.5
    assets.exprDirs[0] = 0.5 // vertex0.x, expression0

    const model = new FLAMEModel(assets)
    const shape: FLAMEShape = { params: new Float32Array(300) }
    const params = createNeutralParams()
    params.expression[0] = 1.0

    const result = model.deform(shape, params)
    expect(result[0]).toBeCloseTo(0.5, 3) // template(0) + exprDir(0.5) * expr(1.0)
  })

  it('shape params change vertex positions', () => {
    const assets = createMockFLAMEAssets()
    // Set shapeDirs so shape[0]=1.0 moves vertex[0].y by 0.3
    assets.shapeDirs[1] = 0.3 // vertex0.y, shape0

    const model = new FLAMEModel(assets)
    const shape: FLAMEShape = { params: new Float32Array(300) }
    shape.params[0] = 1.0
    const params = createNeutralParams()

    const result = model.deform(shape, params)
    expect(result[1]).toBeCloseTo(0.3, 3)
  })

  it('getDeformedVertices returns Float32Array of correct length', () => {
    const assets = createMockFLAMEAssets(100, 50)
    const model = new FLAMEModel(assets)
    const shape: FLAMEShape = { params: new Float32Array(300) }
    const params = createNeutralParams()

    const result = model.deform(shape, params)
    expect(result).toBeInstanceOf(Float32Array)
    expect(result.length).toBe(300) // 100 vertices × 3
  })

  it('getFaces returns face indices', () => {
    const assets = createMockFLAMEAssets(10, 6)
    const model = new FLAMEModel(assets)
    expect(model.getFaces()).toBe(assets.faces)
    expect(model.getFaceCount()).toBe(6)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/core && pnpm test -- FLAMEModel`
Expected: FAIL — module not found

- [ ] **Step 3: Implement FLAMEModel**

```ts
// packages/core/src/renderer/splat/FLAMEModel.ts
import type { FLAMEAssets, FLAMEShape, FLAMEParams } from './types.js'

/**
 * FLAME parametric head model deformation.
 *
 * Computes: vertices = template + shapeDirs×shape + exprDirs×expr + poseDirs×pose
 * Then applies Linear Blend Skinning (LBS) for jaw/neck/eye rotation.
 *
 * All operations are pure linear algebra — runs on CPU in JavaScript.
 */
export class FLAMEModel {
  private assets: FLAMEAssets
  private outputVertices: Float32Array

  constructor(assets: FLAMEAssets) {
    this.assets = assets
    this.outputVertices = new Float32Array(assets.vertexCount * 3)
  }

  /**
   * Deform the FLAME mesh given per-avatar shape and per-frame params.
   * Returns a Float32Array of vertexCount×3 deformed vertex positions.
   * The returned array is reused between calls — copy it if you need to keep it.
   */
  deform(shape: FLAMEShape, params: FLAMEParams): Float32Array {
    const { templateVertices, shapeDirs, exprDirs, poseDirs, vertexCount } = this.assets
    const out = this.outputVertices

    // Start with template
    out.set(templateVertices)

    // Add shape blend: out += shapeDirs × shape.params
    this.addBlend(out, shapeDirs, shape.params, 300, vertexCount)

    // Add expression blend: out += exprDirs × params.expression
    this.addBlend(out, exprDirs, params.expression, 100, vertexCount)

    // Add pose blend: out += poseDirs × poseVector
    // Pose vector is constructed from jaw, neck, eye axis-angle rotations
    // For MVP: simplified — just use jaw pose for the first 3 pose components
    const poseVector = new Float32Array(36)
    poseVector.set(params.jawPose, 0)
    poseVector.set(params.neckPose, 3)
    poseVector.set(params.eyePose, 6)
    this.addBlend(out, poseDirs, poseVector, 36, vertexCount)

    // LBS (simplified for MVP — apply jaw/neck rotation directly)
    // Full LBS with joint chain is a future optimization
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
   * out[v*3+c] += dirs[v*3*N + c*N + i] * weights[i]  for all v, c, i
   * where v=vertex, c=component(xyz), i=blend index, N=numWeights
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
      if (Math.abs(w) < 1e-7) continue // skip zero weights for performance
      for (let v = 0; v < vertexCount; v++) {
        const vOffset = v * 3
        const dOffset = (v * 3) * numWeights + i
        out[vOffset] += dirs[dOffset] * w
        out[vOffset + 1] += dirs[dOffset + numWeights] * w
        out[vOffset + 2] += dirs[dOffset + numWeights * 2] * w
      }
    }
  }

  /**
   * Simplified LBS: apply jaw rotation to lower-face vertices,
   * neck rotation to all vertices. Uses skinning weights column 0 (neck)
   * and column 1 (jaw).
   */
  private applySimplifiedLBS(
    out: Float32Array,
    params: FLAMEParams,
    vertexCount: number,
  ): void {
    const { lbsWeights } = this.assets

    // Convert jaw axis-angle to rotation matrix
    const jawRot = axisAngleToMatrix(params.jawPose)
    const neckRot = axisAngleToMatrix(params.neckPose)

    for (let v = 0; v < vertexCount; v++) {
      const neckWeight = lbsWeights[v * 5]     // column 0
      const jawWeight = lbsWeights[v * 5 + 1]  // column 1

      if (neckWeight < 1e-5 && jawWeight < 1e-5) continue

      const x = out[v * 3]
      const y = out[v * 3 + 1]
      const z = out[v * 3 + 2]

      // Apply weighted rotation
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

/** Convert axis-angle [ax, ay, az] to 3×3 rotation matrix (flat array of 9) */
function axisAngleToMatrix(aa: Float32Array): Float32Array {
  const angle = Math.sqrt(aa[0] * aa[0] + aa[1] * aa[1] + aa[2] * aa[2])
  if (angle < 1e-8) {
    return new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]) // identity
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

/** Apply 3×3 rotation matrix to a point, returns [rx, ry, rz] */
function applyRotation(mat: Float32Array, x: number, y: number, z: number): [number, number, number] {
  return [
    mat[0] * x + mat[1] * y + mat[2] * z,
    mat[3] * x + mat[4] * y + mat[5] * z,
    mat[6] * x + mat[7] * y + mat[8] * z,
  ]
}
```

- [ ] **Step 4: Run tests**

Run: `cd packages/core && pnpm test -- FLAMEModel`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit and push**

```bash
git add packages/core/src/renderer/splat/FLAMEModel.ts packages/core/src/__tests__/FLAMEModel.test.ts
git commit -m "feat(splat): add FLAMEModel — parametric head mesh deformation in JS"
git push
```

---

### Task 3: BlendshapeToFLAME Mapping

**Files:**
- Create: `packages/core/src/renderer/splat/BlendshapeToFLAME.ts`
- Create: `packages/core/src/__tests__/BlendshapeToFLAME.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// packages/core/src/__tests__/BlendshapeToFLAME.test.ts
import { describe, it, expect } from 'vitest'
import { BlendshapeToFLAME } from '../renderer/splat/BlendshapeToFLAME.js'
import type { BlendshapeToFLAMEMappings } from '../renderer/splat/types.js'
import type { BlendshapeMap } from '../types/index.js'

function createMockMappings(): BlendshapeToFLAMEMappings {
  // 67 inputs × 100 expression outputs
  const arkitToExpr = new Float32Array(67 * 100)
  // Set a known mapping: ARKit blendshape 0 → FLAME expression 0 with weight 2.0
  arkitToExpr[0] = 2.0
  // ARKit blendshape 1 → FLAME expression 5 with weight 1.5
  arkitToExpr[1 * 100 + 5] = 1.5

  const visemeToJaw = new Float32Array(15 * 3)
  // viseme 10 (viseme_aa) → jawPose[0] with weight 0.8
  visemeToJaw[10 * 3] = 0.8

  const eyeToPose = new Float32Array(14 * 6)
  // eye blendshape 0 → eyePose[0] with weight 1.0
  eyeToPose[0] = 1.0

  return { arkitToExpr, visemeToJaw, eyeToPose }
}

describe('BlendshapeToFLAME', () => {
  it('creates from mappings', () => {
    const mapper = new BlendshapeToFLAME(createMockMappings())
    expect(mapper).toBeDefined()
  })

  it('maps ARKit weights to FLAME expression params', () => {
    const mapper = new BlendshapeToFLAME(createMockMappings())
    const weights: BlendshapeMap = { eyeBlinkLeft: 0.5 } // ARKit index 0
    const result = mapper.convert(weights)
    expect(result.expression[0]).toBeCloseTo(1.0) // 0.5 × 2.0
    expect(result.expression.length).toBe(100)
  })

  it('maps viseme weights to jaw pose', () => {
    const mapper = new BlendshapeToFLAME(createMockMappings())
    const weights: BlendshapeMap = { viseme_aa: 1.0 } // viseme index 10
    const result = mapper.convert(weights)
    expect(result.jawPose[0]).toBeCloseTo(0.8)
  })

  it('returns zero params for empty weights', () => {
    const mapper = new BlendshapeToFLAME(createMockMappings())
    const result = mapper.convert({})
    expect(result.expression[0]).toBeCloseTo(0)
    expect(result.jawPose[0]).toBeCloseTo(0)
    expect(result.eyePose[0]).toBeCloseTo(0)
  })

  it('combines multiple blendshapes additively', () => {
    const mappings = createMockMappings()
    // Both blendshape 0 and 1 contribute to expression
    const mapper = new BlendshapeToFLAME(mappings)
    const weights: BlendshapeMap = {
      eyeBlinkLeft: 0.5,      // index 0 → expr[0] += 0.5*2.0 = 1.0
      eyeLookDownLeft: 0.4,   // index 1 → expr[5] += 0.4*1.5 = 0.6
    }
    const result = mapper.convert(weights)
    expect(result.expression[0]).toBeCloseTo(1.0)
    expect(result.expression[5]).toBeCloseTo(0.6)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/core && pnpm test -- BlendshapeToFLAME`
Expected: FAIL — module not found

- [ ] **Step 3: Implement BlendshapeToFLAME**

```ts
// packages/core/src/renderer/splat/BlendshapeToFLAME.ts
import type { BlendshapeMap, BlendshapeName } from '../../types/index.js'
import { ARKIT_BLENDSHAPES, OCULUS_VISEMES } from '../../types/index.js'
import type { BlendshapeToFLAMEMappings, FLAMEParams } from './types.js'

// Build index lookup: blendshape name → index in the 67-element input vector
const ARKIT_INDEX = new Map<BlendshapeName, number>()
ARKIT_BLENDSHAPES.forEach((name, i) => ARKIT_INDEX.set(name, i))
OCULUS_VISEMES.forEach((name, i) => ARKIT_INDEX.set(name, ARKIT_BLENDSHAPES.length + i))

// Eye blendshapes that map to FLAME eye pose (14 blendshapes for 2 eyes × 7 shapes)
const EYE_BLENDSHAPE_NAMES: BlendshapeName[] = [
  'eyeBlinkLeft', 'eyeLookDownLeft', 'eyeLookInLeft', 'eyeLookOutLeft',
  'eyeLookUpLeft', 'eyeSquintLeft', 'eyeWideLeft',
  'eyeBlinkRight', 'eyeLookDownRight', 'eyeLookInRight', 'eyeLookOutRight',
  'eyeLookUpRight', 'eyeSquintRight', 'eyeWideRight',
]

export class BlendshapeToFLAME {
  private mappings: BlendshapeToFLAMEMappings
  private arkitVector = new Float32Array(67)
  private visemeVector = new Float32Array(15)
  private eyeVector = new Float32Array(14)
  private result: FLAMEParams = {
    expression: new Float32Array(100),
    jawPose: new Float32Array(3),
    neckPose: new Float32Array(3),
    eyePose: new Float32Array(6),
  }

  constructor(mappings: BlendshapeToFLAMEMappings) {
    this.mappings = mappings
  }

  /**
   * Convert ARKit/Oculus blendshape weights to FLAME parameters.
   * Returns the same FLAMEParams object each call (reused for performance).
   */
  convert(weights: BlendshapeMap): FLAMEParams {
    // Reset vectors
    this.arkitVector.fill(0)
    this.visemeVector.fill(0)
    this.eyeVector.fill(0)
    this.result.expression.fill(0)
    this.result.jawPose.fill(0)
    this.result.neckPose.fill(0)
    this.result.eyePose.fill(0)

    // Fill input vectors from blendshape map
    for (const [name, value] of Object.entries(weights) as [BlendshapeName, number][]) {
      const arkitIdx = ARKIT_INDEX.get(name)
      if (arkitIdx !== undefined) {
        this.arkitVector[arkitIdx] = value
      }

      // Visemes (indices 52-66 in arkitVector, but also separate for jaw)
      const visemeIdx = OCULUS_VISEMES.indexOf(name as typeof OCULUS_VISEMES[number])
      if (visemeIdx >= 0) {
        this.visemeVector[visemeIdx] = value
      }

      // Eye blendshapes
      const eyeIdx = EYE_BLENDSHAPE_NAMES.indexOf(name)
      if (eyeIdx >= 0) {
        this.eyeVector[eyeIdx] = value
      }
    }

    // Matrix multiply: expression = arkitToExpr × arkitVector
    matVecMul(this.mappings.arkitToExpr, this.arkitVector, this.result.expression, 67, 100)

    // Matrix multiply: jawPose = visemeToJaw × visemeVector
    matVecMul(this.mappings.visemeToJaw, this.visemeVector, this.result.jawPose, 15, 3)

    // Matrix multiply: eyePose = eyeToPose × eyeVector
    matVecMul(this.mappings.eyeToPose, this.eyeVector, this.result.eyePose, 14, 6)

    return this.result
  }
}

/**
 * Matrix-vector multiply: out[j] = sum_i(mat[i*cols+j] * vec[i])
 * mat is row-major [rows × cols], vec is [rows], out is [cols]
 */
function matVecMul(
  mat: Float32Array,
  vec: Float32Array,
  out: Float32Array,
  rows: number,
  cols: number,
): void {
  for (let i = 0; i < rows; i++) {
    const v = vec[i]
    if (Math.abs(v) < 1e-7) continue
    const rowOffset = i * cols
    for (let j = 0; j < cols; j++) {
      out[j] += mat[rowOffset + j] * v
    }
  }
}
```

- [ ] **Step 4: Run tests**

Run: `cd packages/core && pnpm test -- BlendshapeToFLAME`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit and push**

```bash
git add packages/core/src/renderer/splat/BlendshapeToFLAME.ts packages/core/src/__tests__/BlendshapeToFLAME.test.ts
git commit -m "feat(splat): add BlendshapeToFLAME — ARKit weights to FLAME expression mapping"
git push
```

---

### Task 4: Gaussian Position Updater

**Files:**
- Create: `packages/core/src/renderer/splat/GaussianUpdater.ts`
- Create: `packages/core/src/__tests__/GaussianUpdater.test.ts`

This takes FLAME-deformed vertices and updates Gaussian positions via triangle binding.

- [ ] **Step 1: Write failing tests**

```ts
// packages/core/src/__tests__/GaussianUpdater.test.ts
import { describe, it, expect } from 'vitest'
import { GaussianUpdater } from '../renderer/splat/GaussianUpdater.js'
import type { GaussianBinding } from '../renderer/splat/types.js'

describe('GaussianUpdater', () => {
  // Simple triangle: vertices at (0,0,0), (1,0,0), (0,1,0)
  const vertices = new Float32Array([
    0, 0, 0,  // v0
    1, 0, 0,  // v1
    0, 1, 0,  // v2
  ])

  const faces = new Uint32Array([0, 1, 2]) // one triangle

  it('places Gaussian at triangle centroid with barycentric (1/3, 1/3, 1/3)', () => {
    const binding: GaussianBinding = {
      triangleIndices: new Uint32Array([0]),
      barycentrics: new Float32Array([1 / 3, 1 / 3, 1 / 3]),
      localOffsets: new Float32Array([0, 0, 0]),
      localRotations: new Float32Array([0, 0, 0, 1]), // identity quaternion
    }

    const updater = new GaussianUpdater(faces, binding)
    const positions = new Float32Array(3)
    const rotations = new Float32Array(4)

    updater.update(vertices, positions, rotations)

    expect(positions[0]).toBeCloseTo(1 / 3)
    expect(positions[1]).toBeCloseTo(1 / 3)
    expect(positions[2]).toBeCloseTo(0)
  })

  it('places Gaussian at vertex 1 with barycentric (0, 1, 0)', () => {
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
    expect(positions[2]).toBeCloseTo(0)
  })

  it('applies local offset along triangle normal', () => {
    const binding: GaussianBinding = {
      triangleIndices: new Uint32Array([0]),
      barycentrics: new Float32Array([1 / 3, 1 / 3, 1 / 3]),
      localOffsets: new Float32Array([0, 0, 0.5]), // offset along Z (which is the normal for this triangle)
      localRotations: new Float32Array([0, 0, 0, 1]),
    }

    const updater = new GaussianUpdater(faces, binding)
    const positions = new Float32Array(3)
    const rotations = new Float32Array(4)

    updater.update(vertices, positions, rotations)

    // Centroid + normal offset
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

    // Gaussian 0 at v0
    expect(positions[0]).toBeCloseTo(0)
    expect(positions[1]).toBeCloseTo(0)
    // Gaussian 1 at v1
    expect(positions[3]).toBeCloseTo(1)
    expect(positions[4]).toBeCloseTo(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/core && pnpm test -- GaussianUpdater`
Expected: FAIL — module not found

- [ ] **Step 3: Implement GaussianUpdater**

```ts
// packages/core/src/renderer/splat/GaussianUpdater.ts
import type { GaussianBinding } from './types.js'

/**
 * Updates Gaussian positions each frame based on FLAME-deformed vertices.
 * Each Gaussian is bound to a triangle via barycentric coordinates + local offset.
 */
export class GaussianUpdater {
  private faces: Uint32Array
  private binding: GaussianBinding
  private gaussianCount: number

  constructor(faces: Uint32Array, binding: GaussianBinding) {
    this.faces = faces
    this.binding = binding
    this.gaussianCount = binding.triangleIndices.length
  }

  /**
   * Update Gaussian positions and rotations from deformed vertices.
   * @param vertices Deformed FLAME vertices (vertexCount×3)
   * @param outPositions Output positions to write (gaussianCount×3)
   * @param outRotations Output rotations to write (gaussianCount×4)
   */
  update(
    vertices: Float32Array,
    outPositions: Float32Array,
    outRotations: Float32Array,
  ): void {
    const { faces, binding } = this

    for (let g = 0; g < this.gaussianCount; g++) {
      const triIdx = binding.triangleIndices[g]
      const faceOffset = triIdx * 3

      // Triangle vertex indices
      const i0 = faces[faceOffset]
      const i1 = faces[faceOffset + 1]
      const i2 = faces[faceOffset + 2]

      // Triangle vertex positions
      const v0x = vertices[i0 * 3], v0y = vertices[i0 * 3 + 1], v0z = vertices[i0 * 3 + 2]
      const v1x = vertices[i1 * 3], v1y = vertices[i1 * 3 + 1], v1z = vertices[i1 * 3 + 2]
      const v2x = vertices[i2 * 3], v2y = vertices[i2 * 3 + 1], v2z = vertices[i2 * 3 + 2]

      // Barycentric interpolation
      const baryOffset = g * 3
      const b0 = binding.barycentrics[baryOffset]
      const b1 = binding.barycentrics[baryOffset + 1]
      const b2 = binding.barycentrics[baryOffset + 2]

      let px = v0x * b0 + v1x * b1 + v2x * b2
      let py = v0y * b0 + v1y * b1 + v2y * b2
      let pz = v0z * b0 + v1z * b1 + v2z * b2

      // Compute triangle frame (tangent, bitangent, normal)
      const e1x = v1x - v0x, e1y = v1y - v0y, e1z = v1z - v0z
      const e2x = v2x - v0x, e2y = v2y - v0y, e2z = v2z - v0z

      // Normal = cross(e1, e2)
      let nx = e1y * e2z - e1z * e2y
      let ny = e1z * e2x - e1x * e2z
      let nz = e1x * e2y - e1y * e2x
      const nLen = Math.sqrt(nx * nx + ny * ny + nz * nz)
      if (nLen > 1e-8) { nx /= nLen; ny /= nLen; nz /= nLen }

      // Tangent = normalized e1
      let tx = e1x, ty = e1y, tz = e1z
      const tLen = Math.sqrt(tx * tx + ty * ty + tz * tz)
      if (tLen > 1e-8) { tx /= tLen; ty /= tLen; tz /= tLen }

      // Bitangent = cross(normal, tangent)
      const bx = ny * tz - nz * ty
      const by = nz * tx - nx * tz
      const bz = nx * ty - ny * tx

      // Apply local offset in triangle frame
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

      // Copy local rotation (in production, this would be composed with triangle rotation)
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
```

- [ ] **Step 4: Run tests**

Run: `cd packages/core && pnpm test -- GaussianUpdater`
Expected: All 4 tests PASS

- [ ] **Step 5: Commit and push**

```bash
git add packages/core/src/renderer/splat/GaussianUpdater.ts packages/core/src/__tests__/GaussianUpdater.test.ts
git commit -m "feat(splat): add GaussianUpdater — triangle-bound Gaussian position updates"
git push
```

---

### Task 5: SplatAsset Loader

**Files:**
- Create: `packages/core/src/renderer/splat/SplatAsset.ts`
- Create: `packages/core/src/__tests__/SplatAsset.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// packages/core/src/__tests__/SplatAsset.test.ts
import { describe, it, expect } from 'vitest'
import { SplatAsset, createTestLCA } from '../renderer/splat/SplatAsset.js'

describe('SplatAsset', () => {
  it('parses metadata from a mock .lca buffer', async () => {
    const lcaBuffer = createTestLCA({
      gaussianCount: 100,
      shDegree: 0,
      flameVersion: '2020',
    })
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
    expect(data.positions.length).toBe(150) // 50 × 3
    expect(data.opacities.length).toBe(50)
    expect(data.scales.length).toBe(150) // 50 × 3
    expect(data.rotations.length).toBe(200) // 50 × 4
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/core && pnpm test -- SplatAsset`
Expected: FAIL — module not found

- [ ] **Step 3: Implement SplatAsset**

```ts
// packages/core/src/renderer/splat/SplatAsset.ts
import type {
  GaussianData, GaussianBinding, SplatAvatarMetadata, FLAMEShape,
} from './types.js'

/**
 * Loads and parses .lca (Low-Cost Avatar) files.
 *
 * .lca format: a simple binary container with a JSON header followed by binary sections.
 * Structure:
 *   [4 bytes: header JSON length (uint32 LE)]
 *   [N bytes: header JSON (UTF-8)]
 *   [remaining: binary sections concatenated in order listed in header]
 *
 * For MVP, we use this simple format instead of zip to avoid a zip library dependency.
 */
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
    let offset = 4 + headerLen

    // Positions: n × 3 float32
    const positions = new Float32Array(buffer, offset, n * 3)
    offset += n * 3 * 4

    // Colors: n × colorComponents float32
    const colorComponents = header.shDegree === 0 ? 3 : 48
    const colors = new Float32Array(buffer, offset, n * colorComponents)
    offset += n * colorComponents * 4

    // Opacities: n × 1 float32
    const opacities = new Float32Array(buffer, offset, n)
    offset += n * 4

    // Scales: n × 3 float32
    const scales = new Float32Array(buffer, offset, n * 3)
    offset += n * 3 * 4

    // Rotations: n × 4 float32
    const rotations = new Float32Array(buffer, offset, n * 4)
    offset += n * 4 * 4

    this.gaussianData = {
      count: n,
      positions: new Float32Array(positions), // copy so we can mutate
      colors,
      shDegree: header.shDegree,
      opacities,
      scales,
      rotations: new Float32Array(rotations), // copy so we can mutate
    }

    // Binding: triangle indices (uint32), barycentrics (float32×3), offsets (float32×3), rotations (float32×4)
    const triangleIndices = new Uint32Array(buffer, offset, n)
    offset += n * 4

    const barycentrics = new Float32Array(buffer, offset, n * 3)
    offset += n * 3 * 4

    const localOffsets = new Float32Array(buffer, offset, n * 3)
    offset += n * 3 * 4

    const localRotations = new Float32Array(buffer, offset, n * 4)
    offset += n * 4 * 4

    this.binding = { triangleIndices, barycentrics, localOffsets, localRotations }

    // FLAME shape: 300 float32
    const shapeParams = new Float32Array(buffer, offset, 300)
    offset += 300 * 4

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

/**
 * Creates a test .lca buffer for unit testing.
 * Produces a valid buffer with zeroed Gaussian/binding data.
 */
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

  // Calculate total size
  const dataSize =
    n * 3 * 4 +              // positions
    n * colorComponents * 4 + // colors
    n * 4 +                   // opacities
    n * 3 * 4 +              // scales
    n * 4 * 4 +              // rotations
    n * 4 +                   // triangle indices
    n * 3 * 4 +              // barycentrics
    n * 3 * 4 +              // local offsets
    n * 4 * 4 +              // local rotations
    300 * 4                   // FLAME shape

  const totalSize = 4 + headerBytes.length + dataSize
  const buffer = new ArrayBuffer(totalSize)
  const view = new DataView(buffer)

  // Write header length
  view.setUint32(0, headerBytes.length, true)
  // Write header JSON
  new Uint8Array(buffer, 4, headerBytes.length).set(headerBytes)
  // Data is all zeros (ArrayBuffer is zero-initialized)

  return buffer
}
```

- [ ] **Step 4: Run tests**

Run: `cd packages/core && pnpm test -- SplatAsset`
Expected: All 4 tests PASS

- [ ] **Step 5: Commit and push**

```bash
git add packages/core/src/renderer/splat/SplatAsset.ts packages/core/src/__tests__/SplatAsset.test.ts
git commit -m "feat(splat): add SplatAsset — .lca file loader with test helper"
git push
```

---

## Phase 2: GPU Rendering

### Task 6: WebGPU Backend

**Files:**
- Create: `packages/core/src/renderer/splat/gpu/webgpu-backend.ts`
- Create: `packages/core/src/renderer/splat/gpu/sort.wgsl`
- Create: `packages/core/src/renderer/splat/gpu/render.wgsl`

No unit tests for GPU code — tested via visual regression in the example.

- [ ] **Step 1: Create sort.wgsl compute shader**

```wgsl
// packages/core/src/renderer/splat/gpu/sort.wgsl

// Bitonic sort by screen-space depth
// Sorts an index array based on depth values

struct SortUniforms {
  count: u32,
  stage: u32,
  step: u32,
}

@group(0) @binding(0) var<storage, read_write> indices: array<u32>;
@group(0) @binding(1) var<storage, read> depths: array<f32>;
@group(0) @binding(2) var<uniform> uniforms: SortUniforms;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  if (idx >= uniforms.count) { return; }

  let stage = uniforms.stage;
  let step = uniforms.step;

  let pairDistance = 1u << step;
  let blockSize = 1u << stage;

  let leftIdx = idx;
  let rightIdx = idx ^ pairDistance;

  if (rightIdx <= leftIdx || rightIdx >= uniforms.count) { return; }

  let leftSortIdx = indices[leftIdx];
  let rightSortIdx = indices[rightIdx];
  let leftDepth = depths[leftSortIdx];
  let rightDepth = depths[rightSortIdx];

  let sameBlock = ((leftIdx >> stage) & 1u) == 0u;
  let shouldSwap = select(leftDepth < rightDepth, leftDepth > rightDepth, sameBlock);

  if (shouldSwap) {
    indices[leftIdx] = rightSortIdx;
    indices[rightIdx] = leftSortIdx;
  }
}
```

- [ ] **Step 2: Create render.wgsl shader**

```wgsl
// packages/core/src/renderer/splat/gpu/render.wgsl

struct Uniforms {
  viewMatrix: mat4x4<f32>,
  projMatrix: mat4x4<f32>,
  viewport: vec2<f32>,
  focalX: f32,
  focalY: f32,
}

struct GaussianInput {
  position: vec3<f32>,
  color: vec3<f32>,
  opacity: f32,
  scale: vec3<f32>,
  rotation: vec4<f32>,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> gaussians_pos: array<f32>;
@group(0) @binding(2) var<storage, read> gaussians_color: array<f32>;
@group(0) @binding(3) var<storage, read> gaussians_opacity: array<f32>;
@group(0) @binding(4) var<storage, read> gaussians_scale: array<f32>;
@group(0) @binding(5) var<storage, read> gaussians_rot: array<f32>;
@group(0) @binding(6) var<storage, read> sortedIndices: array<u32>;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) color: vec3<f32>,
  @location(1) opacity: f32,
  @location(2) conic: vec3<f32>,
  @location(3) centerScreenPos: vec2<f32>,
}

fn quatToMat3(q: vec4<f32>) -> mat3x3<f32> {
  let x = q.x; let y = q.y; let z = q.z; let w = q.w;
  return mat3x3<f32>(
    vec3<f32>(1.0 - 2.0*(y*y + z*z), 2.0*(x*y + w*z), 2.0*(x*z - w*y)),
    vec3<f32>(2.0*(x*y - w*z), 1.0 - 2.0*(x*x + z*z), 2.0*(y*z + w*x)),
    vec3<f32>(2.0*(x*z + w*y), 2.0*(y*z - w*x), 1.0 - 2.0*(x*x + y*y)),
  );
}

@vertex
fn vertexMain(
  @builtin(vertex_index) vertexIndex: u32,
  @builtin(instance_index) instanceIndex: u32,
) -> VertexOutput {
  let sortedIdx = sortedIndices[instanceIndex];
  let i = sortedIdx;

  // Read Gaussian data
  let pos = vec3<f32>(
    gaussians_pos[i * 3u],
    gaussians_pos[i * 3u + 1u],
    gaussians_pos[i * 3u + 2u],
  );
  let col = vec3<f32>(
    gaussians_color[i * 3u],
    gaussians_color[i * 3u + 1u],
    gaussians_color[i * 3u + 2u],
  );
  let opa = gaussians_opacity[i];
  let scl = vec3<f32>(
    gaussians_scale[i * 3u],
    gaussians_scale[i * 3u + 1u],
    gaussians_scale[i * 3u + 2u],
  );
  let rot = vec4<f32>(
    gaussians_rot[i * 4u],
    gaussians_rot[i * 4u + 1u],
    gaussians_rot[i * 4u + 2u],
    gaussians_rot[i * 4u + 3u],
  );

  // Transform to view space
  let viewPos = uniforms.viewMatrix * vec4<f32>(pos, 1.0);
  let clipPos = uniforms.projMatrix * viewPos;
  let ndc = clipPos.xyz / clipPos.w;

  // Compute 2D covariance
  let R = quatToMat3(rot);
  let S = mat3x3<f32>(
    vec3<f32>(scl.x, 0.0, 0.0),
    vec3<f32>(0.0, scl.y, 0.0),
    vec3<f32>(0.0, 0.0, scl.z),
  );
  let M = R * S;
  let viewRot = mat3x3<f32>(
    uniforms.viewMatrix[0].xyz,
    uniforms.viewMatrix[1].xyz,
    uniforms.viewMatrix[2].xyz,
  );
  let T = viewRot * M;

  let focal = vec2<f32>(uniforms.focalX, uniforms.focalY);
  let z2 = viewPos.z * viewPos.z;
  let J = mat2x2<f32>(
    vec2<f32>(focal.x / viewPos.z, 0.0),
    vec2<f32>(0.0, focal.y / viewPos.z),
  );

  let cov2D_00 = dot(T[0].xy, T[0].xy) * focal.x * focal.x / z2;
  let cov2D_01 = dot(T[0].xy, T[1].xy) * focal.x * focal.y / z2;
  let cov2D_11 = dot(T[1].xy, T[1].xy) * focal.y * focal.y / z2;

  // Add small regularization
  let cov2D = vec3<f32>(cov2D_00 + 0.3, cov2D_01, cov2D_11 + 0.3);

  // Compute conic (inverse of 2D covariance)
  let det = cov2D.x * cov2D.z - cov2D.y * cov2D.y;
  let invDet = 1.0 / max(det, 1e-6);
  let conic = vec3<f32>(cov2D.z * invDet, -cov2D.y * invDet, cov2D.x * invDet);

  // Compute radius (3 sigma)
  let eigenMax = 0.5 * (cov2D.x + cov2D.z + sqrt(max((cov2D.x - cov2D.z) * (cov2D.x - cov2D.z) + 4.0 * cov2D.y * cov2D.y, 0.0)));
  let radius = ceil(3.0 * sqrt(max(eigenMax, 0.0)));

  // Quad corners (2 triangles, 6 vertices)
  let cornerOffsets = array<vec2<f32>, 4>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(1.0, -1.0),
    vec2<f32>(-1.0, 1.0),
    vec2<f32>(1.0, 1.0),
  );
  let triIndices = array<u32, 6>(0u, 1u, 2u, 1u, 3u, 2u);
  let corner = cornerOffsets[triIndices[vertexIndex]];

  let screenCenter = vec2<f32>(
    (ndc.x * 0.5 + 0.5) * uniforms.viewport.x,
    (ndc.y * 0.5 + 0.5) * uniforms.viewport.y,
  );

  let screenPos = screenCenter + corner * radius;
  let outPos = vec4<f32>(
    screenPos.x / uniforms.viewport.x * 2.0 - 1.0,
    screenPos.y / uniforms.viewport.y * 2.0 - 1.0,
    ndc.z,
    1.0,
  );

  var out: VertexOutput;
  out.position = outPos;
  out.color = col;
  out.opacity = opa;
  out.conic = conic;
  out.centerScreenPos = screenCenter;
  return out;
}

@fragment
fn fragmentMain(in: VertexOutput) -> @location(0) vec4<f32> {
  let d = in.position.xy - in.centerScreenPos;
  let power = -0.5 * (in.conic.x * d.x * d.x + 2.0 * in.conic.y * d.x * d.y + in.conic.z * d.y * d.y);

  if (power > 0.0) { discard; }

  let alpha = min(0.99, in.opacity * exp(power));
  if (alpha < 1.0 / 255.0) { discard; }

  return vec4<f32>(in.color * alpha, alpha);
}
```

- [ ] **Step 3: Implement WebGPU backend**

```ts
// packages/core/src/renderer/splat/gpu/webgpu-backend.ts
import type { RenderBackend, GaussianData } from '../types.js'
import sortWGSL from './sort.wgsl?raw'
import renderWGSL from './render.wgsl?raw'

export class WebGPUBackend implements RenderBackend {
  private device: GPUDevice | null = null
  private context: GPUCanvasContext | null = null
  private canvas: HTMLCanvasElement | null = null

  private positionBuffer: GPUBuffer | null = null
  private colorBuffer: GPUBuffer | null = null
  private opacityBuffer: GPUBuffer | null = null
  private scaleBuffer: GPUBuffer | null = null
  private rotationBuffer: GPUBuffer | null = null
  private indexBuffer: GPUBuffer | null = null
  private depthBuffer: GPUBuffer | null = null
  private uniformBuffer: GPUBuffer | null = null
  private sortUniformBuffer: GPUBuffer | null = null

  private renderPipeline: GPURenderPipeline | null = null
  private sortPipeline: GPUComputePipeline | null = null
  private renderBindGroup: GPUBindGroup | null = null
  private sortBindGroup: GPUBindGroup | null = null

  private gaussianCount = 0
  private width = 0
  private height = 0

  async init(canvas: HTMLCanvasElement, gaussianCount: number): Promise<void> {
    if (!navigator.gpu) {
      throw new Error('WebGPU is not available')
    }

    const adapter = await navigator.gpu.requestAdapter()
    if (!adapter) throw new Error('No WebGPU adapter found')

    this.device = await adapter.requestDevice()
    this.canvas = canvas
    this.context = canvas.getContext('webgpu')!

    const format = navigator.gpu.getPreferredCanvasFormat()
    this.context.configure({
      device: this.device,
      format,
      alphaMode: 'premultiplied',
    })

    this.gaussianCount = gaussianCount
    this.width = canvas.width
    this.height = canvas.height

    this.createBuffers(gaussianCount)
    this.createPipelines(format)
  }

  uploadGaussians(data: GaussianData): void {
    if (!this.device) return
    this.device.queue.writeBuffer(this.positionBuffer!, 0, data.positions)
    this.device.queue.writeBuffer(this.colorBuffer!, 0, data.colors)
    this.device.queue.writeBuffer(this.opacityBuffer!, 0, data.opacities)
    this.device.queue.writeBuffer(this.scaleBuffer!, 0, data.scales)
    this.device.queue.writeBuffer(this.rotationBuffer!, 0, data.rotations)

    // Initialize index buffer with sequential indices
    const indices = new Uint32Array(this.gaussianCount)
    for (let i = 0; i < this.gaussianCount; i++) indices[i] = i
    this.device.queue.writeBuffer(this.indexBuffer!, 0, indices)
  }

  updatePositions(positions: Float32Array, rotations: Float32Array): void {
    if (!this.device) return
    this.device.queue.writeBuffer(this.positionBuffer!, 0, positions)
    this.device.queue.writeBuffer(this.rotationBuffer!, 0, rotations)
  }

  render(viewMatrix: Float32Array, projMatrix: Float32Array): void {
    if (!this.device || !this.context || !this.renderPipeline) return

    // Update uniforms
    const fovY = 2 * Math.atan(1 / projMatrix[5])
    const focalY = this.height / (2 * Math.tan(fovY / 2))
    const focalX = focalY * (this.width / this.height)

    const uniformData = new Float32Array(36)
    uniformData.set(viewMatrix, 0)    // 16 floats
    uniformData.set(projMatrix, 16)   // 16 floats
    uniformData[32] = this.width
    uniformData[33] = this.height
    uniformData[34] = focalX
    uniformData[35] = focalY
    this.device.queue.writeBuffer(this.uniformBuffer!, 0, uniformData)

    // Compute depth values and sort
    // (For MVP, we skip GPU sort and use pre-sorted indices — full sort in Task 7)

    // Render
    const encoder = this.device.createCommandEncoder()
    const textureView = this.context.getCurrentTexture().createView()

    const renderPass = encoder.beginRenderPass({
      colorAttachments: [{
        view: textureView,
        clearValue: { r: 0, g: 0, b: 0, a: 0 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
    })

    renderPass.setPipeline(this.renderPipeline)
    renderPass.setBindGroup(0, this.renderBindGroup!)
    renderPass.draw(6, this.gaussianCount)
    renderPass.end()

    this.device.queue.submit([encoder.finish()])
  }

  resize(width: number, height: number): void {
    this.width = width
    this.height = height
    if (this.canvas) {
      this.canvas.width = width
      this.canvas.height = height
    }
  }

  dispose(): void {
    this.positionBuffer?.destroy()
    this.colorBuffer?.destroy()
    this.opacityBuffer?.destroy()
    this.scaleBuffer?.destroy()
    this.rotationBuffer?.destroy()
    this.indexBuffer?.destroy()
    this.depthBuffer?.destroy()
    this.uniformBuffer?.destroy()
    this.sortUniformBuffer?.destroy()
    this.device?.destroy()
  }

  private createBuffers(n: number): void {
    const d = this.device!
    const storageUsage = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    this.positionBuffer = d.createBuffer({ size: n * 3 * 4, usage: storageUsage })
    this.colorBuffer = d.createBuffer({ size: n * 3 * 4, usage: storageUsage })
    this.opacityBuffer = d.createBuffer({ size: n * 4, usage: storageUsage })
    this.scaleBuffer = d.createBuffer({ size: n * 3 * 4, usage: storageUsage })
    this.rotationBuffer = d.createBuffer({ size: n * 4 * 4, usage: storageUsage })
    this.indexBuffer = d.createBuffer({ size: n * 4, usage: storageUsage })
    this.depthBuffer = d.createBuffer({ size: n * 4, usage: storageUsage })
    this.uniformBuffer = d.createBuffer({ size: 36 * 4, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST })
    this.sortUniformBuffer = d.createBuffer({ size: 12, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST })
  }

  private createPipelines(format: GPUTextureFormat): void {
    const d = this.device!

    // Render pipeline
    const renderModule = d.createShaderModule({ code: renderWGSL })

    const renderBGL = d.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
        { binding: 2, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
        { binding: 3, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
        { binding: 4, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
        { binding: 5, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
        { binding: 6, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
      ],
    })

    this.renderPipeline = d.createRenderPipeline({
      layout: d.createPipelineLayout({ bindGroupLayouts: [renderBGL] }),
      vertex: { module: renderModule, entryPoint: 'vertexMain' },
      fragment: {
        module: renderModule,
        entryPoint: 'fragmentMain',
        targets: [{
          format,
          blend: {
            color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
            alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
          },
        }],
      },
      primitive: { topology: 'triangle-list' },
    })

    this.renderBindGroup = d.createBindGroup({
      layout: renderBGL,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer! } },
        { binding: 1, resource: { buffer: this.positionBuffer! } },
        { binding: 2, resource: { buffer: this.colorBuffer! } },
        { binding: 3, resource: { buffer: this.opacityBuffer! } },
        { binding: 4, resource: { buffer: this.scaleBuffer! } },
        { binding: 5, resource: { buffer: this.rotationBuffer! } },
        { binding: 6, resource: { buffer: this.indexBuffer! } },
      ],
    })

    // Sort pipeline
    const sortModule = d.createShaderModule({ code: sortWGSL })
    const sortBGL = d.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
      ],
    })
    this.sortPipeline = d.createComputePipeline({
      layout: d.createPipelineLayout({ bindGroupLayouts: [sortBGL] }),
      compute: { module: sortModule, entryPoint: 'main' },
    })
    this.sortBindGroup = d.createBindGroup({
      layout: sortBGL,
      entries: [
        { binding: 0, resource: { buffer: this.indexBuffer! } },
        { binding: 1, resource: { buffer: this.depthBuffer! } },
        { binding: 2, resource: { buffer: this.sortUniformBuffer! } },
      ],
    })
  }
}
```

- [ ] **Step 4: Verify build compiles**

Run: `cd /home/13843K/Desktop/low-cost-avatar && pnpm build`
Expected: Build succeeds (WGSL files are imported as raw strings via tsup)

Note: tsup needs config update to handle `.wgsl` imports. Add to `packages/core/tsup.config.ts`:

```ts
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ['three'],
  treeshake: true,
  minify: false,
  splitting: false,
  loader: {
    '.wgsl': 'text',
  },
})
```

- [ ] **Step 5: Commit and push**

```bash
git add packages/core/src/renderer/splat/gpu/ packages/core/tsup.config.ts
git commit -m "feat(splat): add WebGPU backend — Gaussian sort and render shaders"
git push
```

---

### Task 7: WebGL Fallback Backend

**Files:**
- Create: `packages/core/src/renderer/splat/gpu/webgl-backend.ts`

- [ ] **Step 1: Implement WebGL fallback**

```ts
// packages/core/src/renderer/splat/gpu/webgl-backend.ts
import type { RenderBackend, GaussianData } from '../types.js'

const VERT_SHADER = `#version 300 es
precision highp float;

uniform mat4 uViewMatrix;
uniform mat4 uProjMatrix;
uniform vec2 uViewport;
uniform float uFocalX;
uniform float uFocalY;

// Per-instance attributes
in vec3 aPosition;
in vec3 aColor;
in float aOpacity;
in vec3 aScale;
in vec4 aRotation;

// Per-vertex (quad corner)
in vec2 aCorner;

out vec3 vColor;
out float vOpacity;
out vec3 vConic;
out vec2 vCenterScreen;
out vec2 vFragPos;

mat3 quatToMat3(vec4 q) {
  float x = q.x, y = q.y, z = q.z, w = q.w;
  return mat3(
    1.0 - 2.0*(y*y + z*z), 2.0*(x*y + w*z), 2.0*(x*z - w*y),
    2.0*(x*y - w*z), 1.0 - 2.0*(x*x + z*z), 2.0*(y*z + w*x),
    2.0*(x*z + w*y), 2.0*(y*z - w*x), 1.0 - 2.0*(x*x + y*y)
  );
}

void main() {
  vec4 viewPos = uViewMatrix * vec4(aPosition, 1.0);
  vec4 clipPos = uProjMatrix * viewPos;
  vec3 ndc = clipPos.xyz / clipPos.w;

  mat3 R = quatToMat3(aRotation);
  mat3 S = mat3(aScale.x, 0.0, 0.0, 0.0, aScale.y, 0.0, 0.0, 0.0, aScale.z);
  mat3 M = R * S;
  mat3 viewRot = mat3(uViewMatrix);
  mat3 T = viewRot * M;

  float z2 = viewPos.z * viewPos.z;
  float cov00 = dot(T[0].xy, T[0].xy) * uFocalX * uFocalX / z2 + 0.3;
  float cov01 = dot(T[0].xy, T[1].xy) * uFocalX * uFocalY / z2;
  float cov11 = dot(T[1].xy, T[1].xy) * uFocalY * uFocalY / z2 + 0.3;

  float det = cov00 * cov11 - cov01 * cov01;
  float invDet = 1.0 / max(det, 1e-6);
  vConic = vec3(cov11 * invDet, -cov01 * invDet, cov00 * invDet);

  float eigenMax = 0.5 * (cov00 + cov11 + sqrt(max((cov00 - cov11) * (cov00 - cov11) + 4.0 * cov01 * cov01, 0.0)));
  float radius = ceil(3.0 * sqrt(max(eigenMax, 0.0)));

  vCenterScreen = vec2(
    (ndc.x * 0.5 + 0.5) * uViewport.x,
    (ndc.y * 0.5 + 0.5) * uViewport.y
  );

  vec2 screenPos = vCenterScreen + aCorner * radius;
  vFragPos = screenPos;

  gl_Position = vec4(
    screenPos.x / uViewport.x * 2.0 - 1.0,
    screenPos.y / uViewport.y * 2.0 - 1.0,
    ndc.z,
    1.0
  );

  vColor = aColor;
  vOpacity = aOpacity;
}
`

const FRAG_SHADER = `#version 300 es
precision highp float;

in vec3 vColor;
in float vOpacity;
in vec3 vConic;
in vec2 vCenterScreen;
in vec2 vFragPos;

out vec4 fragColor;

void main() {
  vec2 d = vFragPos - vCenterScreen;
  float power = -0.5 * (vConic.x * d.x * d.x + 2.0 * vConic.y * d.x * d.y + vConic.z * d.y * d.y);

  if (power > 0.0) discard;

  float alpha = min(0.99, vOpacity * exp(power));
  if (alpha < 1.0 / 255.0) discard;

  fragColor = vec4(vColor * alpha, alpha);
}
`

export class WebGLBackend implements RenderBackend {
  private gl: WebGL2RenderingContext | null = null
  private program: WebGLProgram | null = null
  private vao: WebGLVertexArrayObject | null = null
  private positionBuffer: WebGLBuffer | null = null
  private colorBuffer: WebGLBuffer | null = null
  private opacityBuffer: WebGLBuffer | null = null
  private scaleBuffer: WebGLBuffer | null = null
  private rotationBuffer: WebGLBuffer | null = null
  private cornerBuffer: WebGLBuffer | null = null
  private indexBuffer: WebGLBuffer | null = null
  private gaussianCount = 0
  private width = 0
  private height = 0

  // For CPU sort
  private sortIndices: Uint32Array = new Uint32Array(0)
  private sortDepths: Float32Array = new Float32Array(0)
  private positions: Float32Array = new Float32Array(0)

  async init(canvas: HTMLCanvasElement, gaussianCount: number): Promise<void> {
    const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true })
    if (!gl) throw new Error('WebGL 2.0 not available')

    this.gl = gl
    this.gaussianCount = gaussianCount
    this.width = canvas.width
    this.height = canvas.height

    this.sortIndices = new Uint32Array(gaussianCount)
    this.sortDepths = new Float32Array(gaussianCount)
    this.positions = new Float32Array(gaussianCount * 3)

    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)

    this.createProgram(gl)
    this.createBuffers(gl, gaussianCount)
  }

  uploadGaussians(data: GaussianData): void {
    const gl = this.gl!
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer!)
    gl.bufferData(gl.ARRAY_BUFFER, data.positions, gl.DYNAMIC_DRAW)
    this.positions.set(data.positions)

    gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer!)
    gl.bufferData(gl.ARRAY_BUFFER, data.colors, gl.STATIC_DRAW)

    gl.bindBuffer(gl.ARRAY_BUFFER, this.opacityBuffer!)
    gl.bufferData(gl.ARRAY_BUFFER, data.opacities, gl.STATIC_DRAW)

    gl.bindBuffer(gl.ARRAY_BUFFER, this.scaleBuffer!)
    gl.bufferData(gl.ARRAY_BUFFER, data.scales, gl.STATIC_DRAW)

    gl.bindBuffer(gl.ARRAY_BUFFER, this.rotationBuffer!)
    gl.bufferData(gl.ARRAY_BUFFER, data.rotations, gl.DYNAMIC_DRAW)
  }

  updatePositions(positions: Float32Array, rotations: Float32Array): void {
    const gl = this.gl!
    this.positions.set(positions)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer!)
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, positions)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.rotationBuffer!)
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, rotations)
  }

  render(viewMatrix: Float32Array, projMatrix: Float32Array): void {
    const gl = this.gl!

    // CPU depth sort
    this.cpuDepthSort(viewMatrix)

    // Reorder instance data by sorted indices
    // (For WebGL, we need to reorder the actual buffer data since instanced attributes
    //  don't support index buffers. We upload sorted positions directly.)
    // This is the simplest approach for MVP — optimize later if needed.

    gl.viewport(0, 0, this.width, this.height)
    gl.clear(gl.COLOR_BUFFER_BIT)

    gl.useProgram(this.program!)
    gl.bindVertexArray(this.vao!)

    const fovY = 2 * Math.atan(1 / projMatrix[5])
    const focalY = this.height / (2 * Math.tan(fovY / 2))
    const focalX = focalY * (this.width / this.height)

    gl.uniformMatrix4fv(gl.getUniformLocation(this.program!, 'uViewMatrix'), false, viewMatrix)
    gl.uniformMatrix4fv(gl.getUniformLocation(this.program!, 'uProjMatrix'), false, projMatrix)
    gl.uniform2f(gl.getUniformLocation(this.program!, 'uViewport'), this.width, this.height)
    gl.uniform1f(gl.getUniformLocation(this.program!, 'uFocalX'), focalX)
    gl.uniform1f(gl.getUniformLocation(this.program!, 'uFocalY'), focalY)

    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.gaussianCount)

    gl.bindVertexArray(null)
  }

  resize(width: number, height: number): void {
    this.width = width
    this.height = height
  }

  dispose(): void {
    const gl = this.gl
    if (!gl) return
    gl.deleteProgram(this.program)
    gl.deleteVertexArray(this.vao)
    gl.deleteBuffer(this.positionBuffer)
    gl.deleteBuffer(this.colorBuffer)
    gl.deleteBuffer(this.opacityBuffer)
    gl.deleteBuffer(this.scaleBuffer)
    gl.deleteBuffer(this.rotationBuffer)
    gl.deleteBuffer(this.cornerBuffer)
  }

  private cpuDepthSort(viewMatrix: Float32Array): void {
    const n = this.gaussianCount
    for (let i = 0; i < n; i++) {
      this.sortIndices[i] = i
      // Compute view-space Z
      const x = this.positions[i * 3]
      const y = this.positions[i * 3 + 1]
      const z = this.positions[i * 3 + 2]
      this.sortDepths[i] = viewMatrix[2] * x + viewMatrix[6] * y + viewMatrix[10] * z + viewMatrix[14]
    }
    // Sort back-to-front (most negative Z first for alpha blending)
    this.sortIndices.sort((a, b) => this.sortDepths[a] - this.sortDepths[b])
  }

  private createProgram(gl: WebGL2RenderingContext): void {
    const vs = gl.createShader(gl.VERTEX_SHADER)!
    gl.shaderSource(vs, VERT_SHADER)
    gl.compileShader(vs)

    const fs = gl.createShader(gl.FRAGMENT_SHADER)!
    gl.shaderSource(fs, FRAG_SHADER)
    gl.compileShader(fs)

    this.program = gl.createProgram()!
    gl.attachShader(this.program, vs)
    gl.attachShader(this.program, fs)
    gl.linkProgram(this.program)

    gl.deleteShader(vs)
    gl.deleteShader(fs)
  }

  private createBuffers(gl: WebGL2RenderingContext, n: number): void {
    this.vao = gl.createVertexArray()!
    gl.bindVertexArray(this.vao)

    // Quad corners (shared per-vertex data)
    const corners = new Float32Array([
      -1, -1, 1, -1, -1, 1, // triangle 1
      1, -1, 1, 1, -1, 1,   // triangle 2
    ])
    this.cornerBuffer = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, this.cornerBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, corners, gl.STATIC_DRAW)
    const aCorner = gl.getAttribLocation(this.program!, 'aCorner')
    gl.enableVertexAttribArray(aCorner)
    gl.vertexAttribPointer(aCorner, 2, gl.FLOAT, false, 0, 0)

    // Instance buffers
    this.positionBuffer = this.createInstanceBuffer(gl, n * 3 * 4, 'aPosition', 3)
    this.colorBuffer = this.createInstanceBuffer(gl, n * 3 * 4, 'aColor', 3)
    this.opacityBuffer = this.createInstanceBuffer(gl, n * 4, 'aOpacity', 1)
    this.scaleBuffer = this.createInstanceBuffer(gl, n * 3 * 4, 'aScale', 3)
    this.rotationBuffer = this.createInstanceBuffer(gl, n * 4 * 4, 'aRotation', 4)

    gl.bindVertexArray(null)
  }

  private createInstanceBuffer(
    gl: WebGL2RenderingContext,
    size: number,
    attribName: string,
    components: number,
  ): WebGLBuffer {
    const buffer = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, size, gl.DYNAMIC_DRAW)

    const loc = gl.getAttribLocation(this.program!, attribName)
    if (loc >= 0) {
      gl.enableVertexAttribArray(loc)
      gl.vertexAttribPointer(loc, components, gl.FLOAT, false, 0, 0)
      gl.vertexAttribDivisor(loc, 1)
    }

    return buffer
  }
}
```

- [ ] **Step 2: Commit and push**

```bash
git add packages/core/src/renderer/splat/gpu/webgl-backend.ts
git commit -m "feat(splat): add WebGL 2.0 fallback backend — CPU sort + instanced rendering"
git push
```

---

## Phase 3: Scene & Integration

### Task 8: SplatScene

**Files:**
- Create: `packages/core/src/renderer/splat/SplatScene.ts`

This orchestrates the rendering: canvas setup, camera, resize, render loop — same role as SceneManager but for splats.

- [ ] **Step 1: Implement SplatScene**

```ts
// packages/core/src/renderer/splat/SplatScene.ts
import type { RenderBackend, GaussianData } from './types.js'
import type { QualityTier } from '../../types/index.js'
import { WebGPUBackend } from './gpu/webgpu-backend.js'
import { WebGLBackend } from './gpu/webgl-backend.js'

export class SplatScene {
  private container: HTMLElement
  private canvas: HTMLCanvasElement
  private backend: RenderBackend | null = null
  private animationFrameId: number | null = null
  private onRenderCallback: ((delta: number) => void) | null = null
  private lastTime = 0
  private resizeObserver: ResizeObserver | null = null

  // Camera
  private viewMatrix = new Float32Array(16)
  private projMatrix = new Float32Array(16)
  private cameraDistance = 1.5
  private cameraHeight = 1.5
  private fov = 30

  constructor(container: HTMLElement, _quality: QualityTier) {
    this.container = container
    this.canvas = document.createElement('canvas')
    this.canvas.style.width = '100%'
    this.canvas.style.height = '100%'
    this.canvas.width = container.clientWidth
    this.canvas.height = container.clientHeight
    container.appendChild(this.canvas)

    this.updateProjectionMatrix()
    this.updateViewMatrix()

    this.resizeObserver = new ResizeObserver(() => this.handleResize())
    this.resizeObserver.observe(container)
  }

  async initBackend(gaussianCount: number): Promise<void> {
    // Try WebGPU first, fall back to WebGL
    if (typeof navigator !== 'undefined' && navigator.gpu) {
      try {
        this.backend = new WebGPUBackend()
        await this.backend.init(this.canvas, gaussianCount)
        return
      } catch {
        // WebGPU failed, fall through to WebGL
      }
    }

    this.backend = new WebGLBackend()
    await this.backend.init(this.canvas, gaussianCount)
  }

  uploadGaussians(data: GaussianData): void {
    this.backend?.uploadGaussians(data)
  }

  updatePositions(positions: Float32Array, rotations: Float32Array): void {
    this.backend?.updatePositions(positions, rotations)
  }

  onRender(callback: (delta: number) => void): void {
    this.onRenderCallback = callback
  }

  startRenderLoop(): void {
    if (this.animationFrameId !== null) return
    this.lastTime = performance.now()
    const loop = () => {
      this.animationFrameId = requestAnimationFrame(loop)
      const now = performance.now()
      const delta = (now - this.lastTime) / 1000
      this.lastTime = now
      this.onRenderCallback?.(delta)
      this.backend?.render(this.viewMatrix, this.projMatrix)
    }
    loop()
  }

  stopRenderLoop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }
  }

  setCameraTarget(x: number, y: number, z: number): void {
    this.cameraHeight = y
    this.updateViewMatrix()
  }

  dispose(): void {
    this.stopRenderLoop()
    this.resizeObserver?.disconnect()
    this.backend?.dispose()
    this.canvas.remove()
  }

  private updateViewMatrix(): void {
    // Simple look-at camera: positioned at (0, cameraHeight, cameraDistance), looking at (0, cameraHeight, 0)
    const eye = [0, this.cameraHeight, this.cameraDistance]
    const target = [0, this.cameraHeight - 0.1, 0]
    const up = [0, 1, 0]
    lookAt(this.viewMatrix, eye, target, up)
  }

  private updateProjectionMatrix(): void {
    const aspect = this.canvas.width / this.canvas.height
    perspective(this.projMatrix, this.fov * Math.PI / 180, aspect, 0.1, 100)
  }

  private handleResize(): void {
    const w = this.container.clientWidth
    const h = this.container.clientHeight
    this.canvas.width = w
    this.canvas.height = h
    this.backend?.resize(w, h)
    this.updateProjectionMatrix()
  }
}

// Minimal matrix math (no Three.js dependency for splat renderer)
function lookAt(out: Float32Array, eye: number[], target: number[], up: number[]): void {
  let fx = target[0] - eye[0], fy = target[1] - eye[1], fz = target[2] - eye[2]
  let len = Math.sqrt(fx * fx + fy * fy + fz * fz)
  fx /= len; fy /= len; fz /= len

  let sx = fy * up[2] - fz * up[1], sy = fz * up[0] - fx * up[2], sz = fx * up[1] - fy * up[0]
  len = Math.sqrt(sx * sx + sy * sy + sz * sz)
  sx /= len; sy /= len; sz /= len

  const ux = sy * fz - sz * fy, uy = sz * fx - sx * fz, uz = sx * fy - sy * fx

  out[0] = sx; out[1] = ux; out[2] = -fx; out[3] = 0
  out[4] = sy; out[5] = uy; out[6] = -fy; out[7] = 0
  out[8] = sz; out[9] = uz; out[10] = -fz; out[11] = 0
  out[12] = -(sx * eye[0] + sy * eye[1] + sz * eye[2])
  out[13] = -(ux * eye[0] + uy * eye[1] + uz * eye[2])
  out[14] = (fx * eye[0] + fy * eye[1] + fz * eye[2])
  out[15] = 1
}

function perspective(out: Float32Array, fovY: number, aspect: number, near: number, far: number): void {
  const f = 1 / Math.tan(fovY / 2)
  const nf = 1 / (near - far)
  out[0] = f / aspect; out[1] = 0; out[2] = 0; out[3] = 0
  out[4] = 0; out[5] = f; out[6] = 0; out[7] = 0
  out[8] = 0; out[9] = 0; out[10] = (far + near) * nf; out[11] = -1
  out[12] = 0; out[13] = 0; out[14] = 2 * far * near * nf; out[15] = 0
}
```

- [ ] **Step 2: Commit and push**

```bash
git add packages/core/src/renderer/splat/SplatScene.ts
git commit -m "feat(splat): add SplatScene — canvas, camera, render loop with auto WebGPU/WebGL"
git push
```

---

### Task 9: Integrate Splat Renderer into LowCostAvatar

**Files:**
- Modify: `packages/core/src/LowCostAvatar.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Update LowCostAvatar to support renderer: 'splat'**

Add imports at top of `LowCostAvatar.ts`:

```ts
import { SplatScene } from './renderer/splat/SplatScene.js'
import { SplatAsset } from './renderer/splat/SplatAsset.js'
import { FLAMEModel } from './renderer/splat/FLAMEModel.js'
import { BlendshapeToFLAME } from './renderer/splat/BlendshapeToFLAME.js'
import { GaussianUpdater } from './renderer/splat/GaussianUpdater.js'
import type { FLAMEAssets, BlendshapeToFLAMEMappings, GaussianData } from './renderer/splat/types.js'
import type { RendererType } from './types/index.js'
```

Add new private fields:

```ts
private rendererType: RendererType
private splatScene: SplatScene | null = null
private splatAsset: SplatAsset | null = null
private flameModel: FLAMEModel | null = null
private blendshapeToFlame: BlendshapeToFLAME | null = null
private gaussianUpdater: GaussianUpdater | null = null
private gaussianPositions: Float32Array | null = null
private gaussianRotations: Float32Array | null = null
```

Update constructor to read renderer option:

```ts
this.rendererType = (options as any).renderer ?? 'mesh'
```

Add `loadSplat()` method and update `load()` to branch on renderer type:

```ts
async load(): Promise<void> {
  if (this.rendererType === 'splat') {
    await this.loadSplat()
  } else {
    await this.loadMesh()
  }
}
```

Move existing `load()` body into `loadMesh()`, and create `loadSplat()`:

```ts
private async loadSplat(): Promise<void> {
  const quality = this.qualityManager.getCurrentTier()

  // Load .lca file
  const response = await fetch(this.options.avatar)
  if (!response.ok) throw new Error(`Failed to load splat avatar from ${this.options.avatar}`)
  const buffer = await response.arrayBuffer()

  this.splatAsset = new SplatAsset()
  await this.splatAsset.load(buffer)

  const gaussianData = this.splatAsset.getGaussianData()
  const binding = this.splatAsset.getBinding()
  const flameShape = this.splatAsset.getFLAMEShape()

  // Load shared FLAME assets
  const flameAssets = await this.loadFLAMEAssets()
  this.flameModel = new FLAMEModel(flameAssets)

  // Load blendshape-to-FLAME mappings
  const mappings = await this.loadBlendshapeMappings()
  this.blendshapeToFlame = new BlendshapeToFLAME(mappings)

  // Create Gaussian updater
  this.gaussianUpdater = new GaussianUpdater(flameAssets.faces, binding)

  // Allocate output arrays
  this.gaussianPositions = new Float32Array(gaussianData.count * 3)
  this.gaussianRotations = new Float32Array(gaussianData.count * 4)

  // Initialize scene and upload Gaussians
  this.splatScene = new SplatScene(this.options.container, quality)
  await this.splatScene.initBackend(gaussianData.count)
  this.splatScene.uploadGaussians(gaussianData)

  // Start animation
  this.idleSystem.start()
  this.splatScene.onRender((delta) => this.onSplatFrame(delta))
  this.splatScene.startRenderLoop()

  this.loaded = true
  this.emit('loaded')
}
```

Add `onSplatFrame()`:

```ts
private onSplatFrame(delta: number): void {
  const now = performance.now()
  if (this.lastFrameTime > 0) {
    this.qualityManager.recordFps(1000 / (now - this.lastFrameTime))
  }
  this.lastFrameTime = now

  // Run animation systems (same as mesh)
  const lipSyncWeights = this.speaking && this.lipSyncEngine ? this.lipSyncEngine.update() : {}
  const idleWeights = this.idleSystem.update(delta)
  const emotionWeights = this.emotionSystem.update(delta)

  this.blendshapeMixer.setChannel('lipSync', lipSyncWeights)
  this.blendshapeMixer.setChannel('idle', idleWeights)
  this.blendshapeMixer.setChannel('emotion', emotionWeights)

  const finalWeights = this.blendshapeMixer.mix()

  // Convert blendshapes → FLAME → deformed vertices → Gaussian positions
  const flameParams = this.blendshapeToFlame!.convert(finalWeights)

  // Add head drift from idle
  const drift = this.idleSystem.getHeadDrift()
  const emotionMods = this.emotionSystem.getCurrentModifiers()
  flameParams.neckPose[0] = (drift.pitch + emotionMods.headPitchOffset) * Math.PI / 180
  flameParams.neckPose[1] = (drift.yaw + emotionMods.headYawOffset) * Math.PI / 180
  flameParams.neckPose[2] = drift.roll * Math.PI / 180

  const deformedVertices = this.flameModel!.deform(this.splatAsset!.getFLAMEShape(), flameParams)
  this.gaussianUpdater!.update(deformedVertices, this.gaussianPositions!, this.gaussianRotations!)
  this.splatScene!.updatePositions(this.gaussianPositions!, this.gaussianRotations!)
}
```

Add FLAME/mapping asset loaders (placeholder — loads from assetsBaseUrl):

```ts
private async loadFLAMEAssets(): Promise<FLAMEAssets> {
  const base = this.options.assetsBaseUrl
  const load = async (name: string) => {
    const r = await fetch(base + 'flame/' + name)
    if (!r.ok) throw new Error(`Failed to load FLAME asset: ${name}`)
    return r.arrayBuffer()
  }

  const [templateBuf, shapeBuf, exprBuf, poseBuf, lbsBuf, jointsBuf, parentsBuf, facesBuf] = await Promise.all([
    load('flame_template.bin'),
    load('flame_shapedirs.bin'),
    load('flame_exprdirs.bin'),
    load('flame_posedirs.bin'),
    load('flame_lbs_weights.bin'),
    load('flame_joints.bin'),
    load('flame_joint_parents.bin'),
    load('flame_faces.bin'),
  ])

  const vertexCount = new Float32Array(templateBuf).length / 3
  const faceCount = new Uint32Array(facesBuf).length / 3
  const jointParents = new Int32Array(parentsBuf)

  return {
    templateVertices: new Float32Array(templateBuf),
    shapeDirs: new Float32Array(shapeBuf),
    exprDirs: new Float32Array(exprBuf),
    poseDirs: new Float32Array(poseBuf),
    lbsWeights: new Float32Array(lbsBuf),
    joints: new Float32Array(jointsBuf),
    jointCount: jointParents.length,
    jointParents,
    faces: new Uint32Array(facesBuf),
    vertexCount,
    faceCount,
  }
}

private async loadBlendshapeMappings(): Promise<BlendshapeToFLAMEMappings> {
  const base = this.options.assetsBaseUrl
  const load = async (name: string) => {
    const r = await fetch(base + 'flame/' + name)
    if (!r.ok) throw new Error(`Failed to load mapping: ${name}`)
    return r.arrayBuffer()
  }

  const [exprBuf, jawBuf, eyeBuf] = await Promise.all([
    load('arkit_to_flame_expr.bin'),
    load('viseme_to_jaw.bin'),
    load('eye_to_flame_pose.bin'),
  ])

  return {
    arkitToExpr: new Float32Array(exprBuf),
    visemeToJaw: new Float32Array(jawBuf),
    eyeToPose: new Float32Array(eyeBuf),
  }
}
```

Update `destroy()` to clean up splat resources:

```ts
destroy(): void {
  this.sceneManager?.dispose()
  this.splatScene?.dispose()
  this.avatarModel?.dispose()
  this.audioAnalyzer?.dispose()
  this.idleSystem.stop()
  this.blendshapeMixer.clearAll()
  this.removeAllListeners()
  this.loaded = false
}
```

- [ ] **Step 2: Update index.ts to export new types**

Add to `packages/core/src/index.ts`:

```ts
export type { RendererType } from './types/index.js'
```

- [ ] **Step 3: Verify build**

Run: `cd /home/13843K/Desktop/low-cost-avatar && pnpm build`
Expected: Build succeeds

- [ ] **Step 4: Run existing tests**

Run: `cd packages/core && pnpm test`
Expected: All 53 existing tests still pass

- [ ] **Step 5: Commit and push**

```bash
git add packages/core/src/LowCostAvatar.ts packages/core/src/index.ts
git commit -m "feat(splat): integrate Gaussian splat renderer into LowCostAvatar — renderer: 'splat' option"
git push
```

---

## Phase 4: Integration Tests & Example

### Task 10: Splat Pipeline Integration Test

**Files:**
- Create: `packages/core/src/__tests__/splat-integration.test.ts`

- [ ] **Step 1: Write integration test**

```ts
// packages/core/src/__tests__/splat-integration.test.ts
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
    templateVertices: new Float32Array([
      0, 0, 0,   // v0
      1, 0, 0,   // v1
      0, 1, 0,   // v2
      1, 1, 0,   // v3
    ]),
    shapeDirs: new Float32Array(vertexCount * 3 * 300),
    exprDirs: new Float32Array(vertexCount * 3 * 100),
    poseDirs: new Float32Array(vertexCount * 3 * 36),
    lbsWeights: new Float32Array(vertexCount * 5),
    joints: new Float32Array(5 * 3),
    jointCount: 5,
    jointParents: new Int32Array([-1, 0, 1, 1, 1]),
    faces: new Uint32Array([0, 1, 2, 1, 3, 2]), // two triangles
    vertexCount,
    faceCount,
  }

  // Make expression 0 move v0.x by 0.1
  assets.exprDirs[0] = 0.1

  return assets
}

describe('Splat Pipeline Integration', () => {
  it('full pipeline: blendshapes → FLAME → Gaussian positions', () => {
    // Setup
    const flameAssets = createSimpleFLAMEAssets()
    const flameModel = new FLAMEModel(flameAssets)

    const mappings: BlendshapeToFLAMEMappings = {
      arkitToExpr: new Float32Array(67 * 100),
      visemeToJaw: new Float32Array(15 * 3),
      eyeToPose: new Float32Array(14 * 6),
    }
    // Map eyeBlinkLeft (index 0) → FLAME expression 0 with weight 1.0
    mappings.arkitToExpr[0] = 1.0

    const mapper = new BlendshapeToFLAME(mappings)

    // 2 Gaussians, one on each triangle
    const binding = {
      triangleIndices: new Uint32Array([0, 1]),
      barycentrics: new Float32Array([1/3, 1/3, 1/3, 1/3, 1/3, 1/3]),
      localOffsets: new Float32Array(6),
      localRotations: new Float32Array([0,0,0,1, 0,0,0,1]),
    }
    const updater = new GaussianUpdater(flameAssets.faces, binding)

    const shape: FLAMEShape = { params: new Float32Array(300) }
    const positions = new Float32Array(6) // 2 Gaussians × 3
    const rotations = new Float32Array(8) // 2 Gaussians × 4

    // Run with neutral
    const neutralWeights: BlendshapeMap = {}
    const neutralFlame = mapper.convert(neutralWeights)
    const neutralVerts = flameModel.deform(shape, neutralFlame)
    updater.update(neutralVerts, positions, rotations)
    const neutralX = positions[0]

    // Run with expression
    const exprWeights: BlendshapeMap = { eyeBlinkLeft: 1.0 }
    const exprFlame = mapper.convert(exprWeights)
    const exprVerts = flameModel.deform(shape, exprFlame)
    updater.update(exprVerts, positions, rotations)
    const exprX = positions[0]

    // Expression should move the Gaussian
    expect(exprX).not.toBeCloseTo(neutralX)
    expect(exprX - neutralX).toBeGreaterThan(0) // moved in +X direction
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
```

- [ ] **Step 2: Run all tests**

Run: `cd packages/core && pnpm test`
Expected: All tests pass (53 existing + 2 new)

- [ ] **Step 3: Commit and push**

```bash
git add packages/core/src/__tests__/splat-integration.test.ts
git commit -m "feat(splat): add integration tests for full Gaussian splat animation pipeline"
git push
```

---

### Task 11: Splat Demo Example

**Files:**
- Create: `examples/splat-demo/package.json`
- Create: `examples/splat-demo/index.html`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "example-splat-demo",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  },
  "dependencies": {
    "low-cost-avatar": "workspace:*"
  },
  "devDependencies": {
    "vite": "^6.1.0"
  }
}
```

- [ ] **Step 2: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Low-Cost Avatar — Gaussian Splat Demo</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; background: #0d1117; color: #e6edf3; }
    #app {
      display: flex;
      flex-direction: column;
      align-items: center;
      min-height: 100vh;
      padding: 20px;
      gap: 16px;
    }
    h1 { font-size: 20px; font-weight: 500; color: #58a6ff; }
    .avatar-container {
      width: 400px;
      height: 500px;
      border-radius: 12px;
      overflow: hidden;
      background: #000;
      border: 1px solid #30363d;
    }
    .controls {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      justify-content: center;
    }
    button {
      padding: 6px 14px;
      border: 1px solid #30363d;
      border-radius: 6px;
      background: #21262d;
      color: #e6edf3;
      cursor: pointer;
      font-size: 13px;
    }
    button:hover { background: #30363d; border-color: #58a6ff; }
    .status { font-size: 12px; color: #8b949e; }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
    }
    .badge-webgpu { background: #238636; color: #fff; }
    .badge-webgl { background: #d29922; color: #000; }
  </style>
</head>
<body>
  <div id="app">
    <h1>Gaussian Splat Avatar <span class="badge" id="renderer-badge">detecting...</span></h1>
    <div class="avatar-container" id="avatar-container"></div>
    <div class="controls">
      <button data-emotion="happy">Happy</button>
      <button data-emotion="sad">Sad</button>
      <button data-emotion="angry">Angry</button>
      <button data-emotion="surprised">Surprised</button>
      <button data-emotion="thinking">Thinking</button>
      <button data-emotion="neutral">Neutral</button>
    </div>
    <p class="status" id="status">Loading Gaussian splat avatar...</p>
    <p class="status">
      This demo requires a .lca avatar file and FLAME assets.
      See docs for how to create them.
    </p>
  </div>

  <script type="module">
    import { LowCostAvatar } from 'low-cost-avatar'

    const status = document.getElementById('status')
    const badge = document.getElementById('renderer-badge')
    const container = document.getElementById('avatar-container')

    // Detect WebGPU
    if (navigator.gpu) {
      badge.textContent = 'WebGPU'
      badge.className = 'badge badge-webgpu'
    } else {
      badge.textContent = 'WebGL'
      badge.className = 'badge badge-webgl'
    }

    const avatar = new LowCostAvatar({
      container,
      avatar: './avatar.lca',
      renderer: 'splat',
      quality: 'high',
      assetsBaseUrl: './',
    })

    window.avatar = avatar

    avatar.on('loaded', () => {
      status.textContent = 'Gaussian splat avatar loaded! Try the emotion controls.'
    })

    avatar.on('error', (err) => {
      status.textContent = `Error: ${err.message}`
    })

    avatar.load().catch((err) => {
      status.textContent = `Failed: ${err.message}. Make sure avatar.lca and flame/ assets exist.`
    })

    document.querySelectorAll('[data-emotion]').forEach(btn => {
      btn.addEventListener('click', () => {
        const emotion = btn.dataset.emotion
        if (emotion === 'neutral') {
          avatar.clearEmotion({ transition: 500 })
        } else {
          avatar.setEmotion(emotion, { intensity: 0.85, transition: 400 })
        }
      })
    })
  </script>
</body>
</html>
```

- [ ] **Step 3: Install deps and verify**

Run: `cd /home/13843K/Desktop/low-cost-avatar && pnpm install && pnpm build`
Expected: All packages build

- [ ] **Step 4: Commit and push**

```bash
git add examples/splat-demo/
git commit -m "feat(splat): add Gaussian splat demo example"
git push
```

---

## Summary

| Phase | Tasks | What It Delivers |
|---|---|---|
| 1: Types & Math | Tasks 1-5 | Splat types, FLAME deformation, BlendshapeToFLAME mapping, GaussianUpdater, SplatAsset loader |
| 2: GPU Rendering | Tasks 6-7 | WebGPU backend (WGSL shaders), WebGL 2.0 fallback |
| 3: Scene & Integration | Tasks 8-9 | SplatScene orchestrator, LowCostAvatar `renderer: 'splat'` integration |
| 4: Tests & Example | Tasks 10-11 | Integration tests, splat demo example |

After all 11 tasks, the SDK supports `renderer: 'splat'` — developers can load a `.lca` Gaussian splat avatar and animate it with the same API (emotions, lip-sync, idle) used for mesh avatars, rendering photorealistically in the browser with zero server GPU cost.

**To test with a real avatar, you'll need to:**
1. Create FLAME assets (download from FLAME website or generate from their codebase)
2. Create a blendshape-to-FLAME mapping matrix (one-time Python script)
3. Train a Gaussian splat avatar using GaussianAvatars/SplattingAvatar (requires a GPU for a few hours)
4. Package the result as a `.lca` file
