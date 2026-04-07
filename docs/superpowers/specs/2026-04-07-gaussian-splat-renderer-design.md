# Gaussian Splat Photorealistic Renderer — Design Specification

**Date:** 2026-04-07
**Status:** Approved
**Goal:** Add photorealistic avatar rendering to the Low-Cost Avatar SDK using Gaussian splatting + FLAME parametric head model, competing with HeyGen quality while keeping rendering client-side.

---

## 1. Problem Statement

The current SDK renders 3D polygon mesh avatars via Three.js. While functional, these look like "video game characters" — not photorealistic humans. To compete with HeyGen/D-ID, we need avatars that look like real people.

**Solution:** Replace the polygon mesh renderer with a Gaussian splatting renderer driven by the FLAME parametric head model. Gaussian splats capture real appearance data from video/photos and render photorealistically in real-time in the browser.

## 2. Architecture

The new renderer plugs into the existing SDK as an alternative to the Three.js mesh renderer. The public API does not change — the developer just sets `renderer: 'splat'`.

```
LowCostAvatar (unchanged public API)
│
├── renderer: 'mesh'    → SceneManager + AvatarModel (existing Three.js)
│
└── renderer: 'splat'   → SplatRenderer + FLAMEModel (NEW)
                           │
                           ├── SplatRenderer
                           │   WebGPU Gaussian splat rendering
                           │   WebGL 2.0 fallback
                           │
                           ├── FLAMEModel
                           │   FLAME parametric head deformation
                           │   Converts expression params → vertex positions
                           │   Maps vertices → Gaussian positions via triangle binding
                           │
                           ├── BlendshapeToFLAME
                           │   Maps ARKit/Oculus weights → FLAME expression params
                           │   Single matrix multiplication per frame
                           │
                           └── SplatAsset
                               Loads .lca avatar files
```

### Data Flow Per Frame

```
Existing Animation Systems (unchanged)
  LipSyncEngine → viseme weights
  IdleSystem → blink/breathing weights
  EmotionSystem → emotion weights
  BlendshapeMixer → combined ARKit weights (67 floats)
        │
        ▼
BlendshapeToFLAME
  ARKit weights × mapping matrix → FLAME expression (100 floats)
  Viseme weights × jaw matrix → jaw pose (3 floats)
  Eye blendshapes → eye pose (6 floats)
        │
        ▼
FLAMEModel
  template + shape_blend + expression_blend + pose_blend
  → 5023 deformed vertex positions
        │
        ▼
Gaussian Position Update
  Each Gaussian bound to a triangle
  New position = triangle transform × local offset
  → 60,000-100,000 updated Gaussian positions
        │
        ▼
SplatRenderer (WebGPU)
  1. Upload positions to GPU
  2. Depth sort (compute shader)
  3. Splat rendering (alpha blend, front-to-back)
  → Photorealistic frame on <canvas>
```

### Developer API

```js
// Only change: renderer option and .splat/.lca file
const avatar = new LowCostAvatar({
  container: document.getElementById('avatar'),
  avatar: './photorealistic-person.lca',
  renderer: 'splat',
  quality: 'auto',
})

await avatar.load()

// Everything else identical to mesh renderer
avatar.setEmotion('happy', { intensity: 0.8, transition: 400 })
avatar.speak(audioBuffer)
avatar.playGesture('nod')
avatar.setBlendshapes({ mouthSmileLeft: 0.9 })
```

## 3. FLAME Model

FLAME (Faces Learned with an Articulated Model and Expressions) is an open-source parametric head model from Max Planck Institute.

### Parameters

| Parameter | Dimensions | Per-Avatar or Per-Frame |
|---|---|---|
| Shape | 300 | Per-avatar (fixed — defines face geometry) |
| Expression | 100 | Per-frame (facial expressions) |
| Jaw pose | 3 | Per-frame (jaw open/rotation) |
| Neck pose | 3 | Per-frame (neck rotation) |
| Eye pose | 6 | Per-frame (left/right eye gaze) |

### Deformation Formula

```
vertices = template_vertices
         + shape_blendshapes × shape_params
         + expression_blendshapes × expression_params
         + pose_blendshapes × pose_params
         + LBS(joints, skinning_weights)
```

All operations are linear algebra (matrix multiplications and additions). Runs in JavaScript — no GPU needed for deformation.

### FLAME Assets (~4MB total, shipped with SDK)

- `flame_template.bin` — 5023 vertices × 3 floats (neutral face mesh)
- `flame_shapedirs.bin` — 5023 × 3 × 300 (shape blendshape directions)
- `flame_exprdirs.bin` — 5023 × 3 × 100 (expression blendshape directions)
- `flame_posedirs.bin` — 5023 × 3 × 36 (pose blendshape directions)
- `flame_lbs_weights.bin` — 5023 × 5 (skinning weights)
- `flame_joints.bin` — joint positions and kinematic tree
- `flame_faces.bin` — 9976 triangles (face topology for Gaussian binding)

## 4. Blendshape-to-FLAME Mapping

### Mapping Matrix

A precomputed matrix that converts 67 ARKit/Oculus blendshape weights to FLAME parameters:

- `arkit_to_flame_expr.bin` — 67 × 100 float32 matrix (~27KB)
- `viseme_to_jaw.bin` — 15 × 3 float32 matrix (~180 bytes)
- `eye_blendshape_to_eye_pose.bin` — 14 × 6 float32 matrix (~336 bytes)

Total mapping assets: ~28KB.

### Per-Frame Computation

```
flameExpr[100] = matMul(arkitToFlameMatrix[67×100], arkitWeights[67])
jawPose[3] = matMul(visemeToJawMatrix[15×3], visemeWeights[15])
eyePose[6] = matMul(eyeToFlameMatrix[14×6], eyeBlendshapes[14])
```

Three small matrix multiplications — microseconds per frame.

### Creating the Mapping (One-Time, Offline)

1. Generate 10,000 random FLAME expressions
2. For each, render the face and compute ARKit blendshape values (using mediapipe or similar)
3. Learn the inverse mapping via linear regression
4. Export the resulting matrix

This is done once and ships with the SDK.

## 5. Gaussian Splat Renderer

### Gaussian Data Per Avatar

Each avatar: 60,000-100,000 Gaussians.

Per Gaussian:
- Position (3 floats) — updated each frame from FLAME
- Color (spherical harmonics, 48 floats for degree 3, or 3 floats for degree 0) — fixed
- Opacity (1 float) — fixed
- Scale (3 floats) — fixed
- Rotation (4 floats, quaternion) — partially updated from FLAME

### WebGPU Rendering Pipeline

**Compute pass (depth sort):**
- Compute each Gaussian's screen-space depth
- Radix sort by depth (GPU compute shader)
- Output sorted index buffer

**Render pass (splatting):**
- For each Gaussian (sorted front-to-back):
  - Project 3D covariance to 2D screen-space ellipse
  - Render as a quad with Gaussian falloff alpha
  - Alpha-blend onto framebuffer

### WebGL 2.0 Fallback

When WebGPU is unavailable:
- Depth sort on CPU using TypedArray sort (slower but functional)
- Render via instanced quads with custom fragment shader
- Target: 30fps on mid-range devices (vs 60fps with WebGPU)

### Auto-Detection

```js
if (navigator.gpu) {
  // Use WebGPU path
} else {
  // Fall back to WebGL 2.0
}
```

## 6. Asset Format (.lca)

Each avatar is a single `.lca` file (a zip archive):

```
avatar.lca:
├── gaussians.bin        # Positions, SH colors, opacity, scale, rotation (~2MB compressed)
├── flame_binding.bin    # Per-Gaussian: triangle index + barycentric coords + local offset (~0.5MB)
├── flame_shape.bin      # FLAME shape params for this person (300 floats, ~1.2KB)
├── metadata.json        # { version, gaussianCount, shDegree, flameVersion }
└── thumbnail.webp       # Preview image (~10KB)
```

**Total per avatar: ~2.5-3MB compressed.**

The FLAME model matrices and blendshape-to-FLAME mapping are shared across all avatars and shipped once with the SDK (~4MB).

## 7. MVP Scope

### Build

| Component | File | Description |
|---|---|---|
| SplatRenderer | `packages/core/src/renderer/splat/SplatRenderer.ts` | WebGPU/WebGL Gaussian rendering |
| FLAMEModel | `packages/core/src/renderer/splat/FLAMEModel.ts` | FLAME mesh deformation in JS |
| BlendshapeToFLAME | `packages/core/src/renderer/splat/BlendshapeToFLAME.ts` | ARKit → FLAME mapping |
| SplatAsset | `packages/core/src/renderer/splat/SplatAsset.ts` | .lca file loader |
| GPU sort shader | `packages/core/src/renderer/splat/gpu/sort.wgsl` | WebGPU depth sort |
| GPU render shader | `packages/core/src/renderer/splat/gpu/render.wgsl` | WebGPU splatting |
| WebGL fallback sort | `packages/core/src/renderer/splat/gpu/sort-webgl.ts` | CPU depth sort |
| WebGL fallback render | `packages/core/src/renderer/splat/gpu/render-webgl.ts` | WebGL instanced splatting |
| LowCostAvatar update | `packages/core/src/LowCostAvatar.ts` | Add `renderer: 'splat'` support |
| Pre-made avatars | `assets/splat-avatars/` | 2-3 photorealistic .lca files |

### Don't Build (MVP)

- Avatar creation pipeline (use GaussianAvatars/SplattingAvatar offline)
- Custom avatar upload flow
- Body below shoulders
- Hair physics
- Real-time relighting
- WASM optimization of FLAME (JS is fast enough for MVP)

### Pre-Made Avatar Creation (One-Time Offline)

1. Rent GPU machine (~$5-10, Lambda/RunPod)
2. Record 1-2 min selfie videos of 2-3 diverse people
3. Run SplattingAvatar or GaussianAvatars training
4. Export FLAME-rigged Gaussian splats
5. Package as .lca files
6. Host on CDN or ship with examples

## 8. Performance Budgets

| Metric | Target (WebGPU) | Target (WebGL fallback) |
|---|---|---|
| FPS | 60fps desktop, 30fps mobile | 30fps desktop, 20fps mobile |
| FLAME deformation | <2ms | <2ms |
| Gaussian sort | <2ms (GPU) | <5ms (CPU) |
| Gaussian render | <3ms | <8ms |
| Total frame time | <8ms | <16ms |
| GPU memory | <100MB | <100MB |
| Asset download | <3MB per avatar | <3MB per avatar |
| SDK overhead | <50KB (splat module) | <50KB |

## 9. Testing Strategy

| Layer | What | Tool |
|---|---|---|
| Unit: FLAMEModel | Deformation math correct — compare against Python FLAME output for 5 test expressions | Vitest |
| Unit: BlendshapeToFLAME | ARKit weights map to correct FLAME params | Vitest |
| Unit: SplatAsset | .lca file parsing works | Vitest |
| Integration: Full pipeline | Blendshape → FLAME → deformed positions flow | Vitest |
| Visual: Browser rendering | Gaussians render correctly, expressions animate | Playwright screenshots |
| Performance | 60fps sustained on desktop | Custom benchmark harness |
| Fallback | WebGL path works when WebGPU unavailable | Force WebGL, verify rendering |

## 10. Device Support

- **Primary:** WebGPU — Chrome 113+, Firefox 130+, Safari 18+, Edge 113+
- **Fallback:** WebGL 2.0 — all modern browsers
- **Not supported:** WebGL 1.0 only devices (very old)
- **Mobile:** WebGPU on Android Chrome, WebGL fallback on iOS Safari (WebGPU coming to iOS)

## 11. Future Considerations

- Avatar creation pipeline (cloud API + self-hosted CLI)
- Avatar marketplace
- Full body Gaussian splat avatars
- Real-time relighting from environment maps
- WASM-optimized FLAME deformation
- Streaming Gaussian splat loading (progressive quality)
- Hair dynamics post-processing
