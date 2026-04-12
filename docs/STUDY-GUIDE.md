# Low-Cost Avatar SDK — Study Guide & References

A comprehensive guide to all the technologies, concepts, and tools used in this project.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Core Technologies](#core-technologies)
3. [3D Rendering in the Browser](#3d-rendering-in-the-browser)
4. [Gaussian Splatting](#gaussian-splatting)
5. [FLAME Parametric Head Model](#flame-parametric-head-model)
6. [Facial Animation & Blendshapes](#facial-animation--blendshapes)
7. [Audio & Lip Sync](#audio--lip-sync)
8. [Build Tools & Infrastructure](#build-tools--infrastructure)
9. [Key Research Papers](#key-research-papers)
10. [Open Source Projects Used](#open-source-projects-used)
11. [Learning Path](#learning-path)

---

## Project Overview

This SDK renders interactive avatars entirely in the client's browser — no server GPU needed. It has two rendering modes:

- **Mesh renderer** — Three.js renders GLB models with ARKit blendshapes for cartoon/semi-realistic avatars
- **Splat renderer** — Spark renders Gaussian splats driven by FLAME parametric head for photorealistic avatars

### Architecture Diagram

```
Developer's App
    |
    v
LowCostAvatar (SDK entry point)
    |
    +-- Animation Systems (shared by both renderers)
    |   +-- LipSyncEngine (audio frequency → viseme weights)
    |   +-- IdleSystem (procedural blinks, breathing, micro-saccades)
    |   +-- EmotionSystem (emotion presets with crossfade)
    |   +-- GesturePlayer (skeletal animation clips)
    |   +-- BlendshapeMixer (combines all channels with priority)
    |
    +-- Mesh Renderer Path
    |   +-- SceneManager (Three.js scene, camera, lighting)
    |   +-- AvatarModel (GLB loading, blendshape control)
    |   +-- QualityManager (auto FPS adaptation)
    |
    +-- Splat Renderer Path
        +-- SplatAsset (.lca file loader)
        +-- FLAMEModel (parametric head deformation)
        +-- BlendshapeToFLAME (ARKit → FLAME mapping)
        +-- GaussianUpdater (triangle-bound position transform)
        +-- SplatScene (Spark rendering + orbit controls)
```

---

## Core Technologies

### TypeScript
- **What:** Typed superset of JavaScript
- **Why we use it:** Type safety for the SDK's public API, better IDE support, catches bugs at compile time
- **Learn:** https://www.typescriptlang.org/docs/handbook/intro.html

### WebGL / WebGPU
- **What:** Browser APIs for GPU-accelerated rendering
- **WebGL 2.0:** Widely supported, used by Three.js and Spark's fallback path
- **WebGPU:** Next-gen GPU API, used by Spark's primary rendering path for Gaussian splatting
- **Learn WebGL:** https://webglfundamentals.org/
- **Learn WebGPU:** https://webgpufundamentals.org/
- **WebGPU spec:** https://www.w3.org/TR/webgpu/
- **Browser support:** https://caniuse.com/webgpu

### Web Audio API
- **What:** Browser API for audio processing
- **Why we use it:** Real-time audio analysis for lip-sync (FFT frequency extraction)
- **Learn:** https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API
- **AudioWorklet:** https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet

### IndexedDB
- **What:** Browser-based database for large binary data
- **Why we use it:** Cache downloaded avatar assets locally so subsequent visits load instantly
- **Learn:** https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API

---

## 3D Rendering in the Browser

### Three.js
- **What:** The most popular 3D rendering library for the web
- **Why we use it:** Renders GLB mesh avatars, handles scene/camera/lighting, used by Spark internally
- **Docs:** https://threejs.org/docs/
- **Examples:** https://threejs.org/examples/
- **Source:** https://github.com/mrdoob/three.js
- **Key concepts we use:**
  - Scene, Camera, Renderer: https://threejs.org/docs/#manual/en/introduction/Creating-a-scene
  - GLTFLoader (loads GLB files): https://threejs.org/docs/#examples/en/loaders/GLTFLoader
  - Morph targets (blendshapes): https://threejs.org/docs/#api/en/core/BufferGeometry.morphAttributes
  - AnimationMixer (gesture playback): https://threejs.org/docs/#api/en/animation/AnimationMixer
  - Skeleton/Bones: https://threejs.org/docs/#api/en/objects/Bone

### GLB/GLTF Format
- **What:** Standard 3D model format for the web (GL Transmission Format)
- **Why we use it:** Avatar models with blendshapes, textures, and animations
- **Spec:** https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html
- **Validator:** https://github.khronos.org/glTF-Validator/

### Ready Player Me (Historical)
- **What:** Was the leading avatar creation platform (shut down Jan 2026)
- **Legacy:** Many existing GLB avatars with ARKit blendshapes were created here
- **Alternatives:** https://avaturn.me, https://avatarsdk.com

---

## Gaussian Splatting

### What is 3D Gaussian Splatting?
- **Core idea:** Represent a 3D scene as millions of tiny colored 3D ellipsoids ("Gaussians") instead of triangles
- **Why it's photorealistic:** Each Gaussian captures actual appearance data from real photos/video
- **How rendering works:** Project each 3D Gaussian to a 2D screen-space ellipse, alpha-blend front-to-back

### Key Resources
- **Original paper:** "3D Gaussian Splatting for Real-Time Radiance Field Rendering" (Kerbl et al., SIGGRAPH 2023)
  - Paper: https://repo-sam.inria.fr/fungraph/3d-gaussian-splatting/
  - Code: https://github.com/graphdeco-inria/gaussian-splatting
- **Explained simply:** https://aras-p.info/blog/2023/09/05/Gaussian-Splatting-is-pretty-cool/
- **Video explanation:** Search "3D Gaussian Splatting explained" on YouTube

### Spark (@sparkjsdev/spark)
- **What:** Production-ready Gaussian splat renderer for Three.js
- **Why we use it:** Handles depth sorting, WebGPU/WebGL rendering, proper alpha blending
- **Docs:** https://sparkjs.dev/
- **GitHub:** https://github.com/sparkjsdev/spark
- **Key APIs we use:**
  - SplatMesh: https://sparkjs.dev/docs/splat-mesh/
  - PackedSplats: https://sparkjs.dev/docs/procedural-splats/
  - Loading formats: `.ply`, `.splat`, `.spz`, `.ksplat`

### Other Gaussian Splat Viewers
- **GaussianSplats3D:** https://github.com/mkkellogg/GaussianSplats3D (2K+ stars, Three.js based)
- **gsplat.js:** https://github.com/huggingface/gsplat.js (Hugging Face)
- **antimatter15/splat:** https://github.com/antimatter15/splat (minimal WebGL viewer)
- **PlayCanvas:** https://playcanvas.com/ (game engine with splat support)

### Gaussian Splat File Formats
- **PLY:** Standard format from original 3DGS paper. Per-Gaussian: position, SH colors, opacity, scale, rotation
- **SPLAT:** Compressed binary format (antimatter15)
- **SPZ:** Niantic's compressed format (used by Spark)
- **KSPLAT:** GaussianSplats3D's compressed format
- **Format comparison:** https://www.polyvia3d.com/formats/gaussian-splatting-formats

---

## FLAME Parametric Head Model

### What is FLAME?
- **Full name:** Faces Learned with an Articulated Model and Expressions
- **Created by:** Max Planck Institute for Intelligent Systems
- **Core idea:** Any human face can be described by a compact set of numbers (shape, expression, pose)
- **Why we use it:** Drives the Gaussian splat avatar's facial deformation from expression parameters

### Key Resources
- **Official site:** https://flame.is.tue.mpg.de/
- **Paper:** "Learning a model of facial shape and expression from 4D scans" (Li et al., SIGGRAPH Asia 2017)
  - https://flame.is.tue.mpg.de/static/FLAME_2017.pdf
- **FLAME Universe (all related projects):** https://github.com/TimoBolkart/FLAME-Universe
- **License:** CC-BY-4.0 (commercial use allowed)

### FLAME Parameters
| Parameter | Dims | What it controls |
|-----------|------|-----------------|
| Shape (β) | 300 | Face geometry — wide jaw, narrow nose, etc. |
| Expression (ψ) | 100 | Facial expressions — smile, frown, brow raise |
| Jaw pose | 3 | Jaw rotation (axis-angle) |
| Neck pose | 3 | Neck rotation |
| Eye pose | 6 | Left/right eye gaze direction |

### FLAME Deformation Math
```
vertices = template
         + shapedirs × shape_params      (identity)
         + exprdirs × expression_params   (expression)
         + posedirs × pose_params         (pose correctives)
         + LBS(joints, skinning_weights)  (articulation)
```

### Related Projects
- **DECA:** Reconstructs FLAME params from a single photo — https://github.com/YadiraF/DECA
- **EMOCA:** Emotion-aware FLAME fitting — https://github.com/radekd91/emoca
- **FLAME head tracker:** Tracks FLAME params from video — https://github.com/PeizhiYan/flame-head-tracker

---

## Facial Animation & Blendshapes

### ARKit Blendshapes (Apple)
- **What:** 52 named facial blend shapes defined by Apple for Face ID
- **Standard names:** eyeBlinkLeft, mouthSmileRight, jawOpen, browInnerUp, etc.
- **Why we use them:** Industry standard adopted by Ready Player Me, Avaturn, and most avatar platforms
- **Full list:** https://developer.apple.com/documentation/arkit/arfaceanchor/blendshapelocation

### Oculus Visemes
- **What:** 15 mouth shapes corresponding to speech sounds
- **Names:** viseme_sil, viseme_PP, viseme_FF, viseme_TH, viseme_DD, viseme_kk, viseme_CH, viseme_SS, viseme_nn, viseme_RR, viseme_aa, viseme_E, viseme_I, viseme_O, viseme_U
- **Why we use them:** Maps audio frequencies to mouth shapes for lip-sync
- **Reference:** https://developer.oculus.com/documentation/unity/audio-ovrlipsync-viseme-reference/

### Blendshape-to-FLAME Mapping
- **What:** A matrix that converts ARKit blendshape weights to FLAME expression parameters
- **Project we used:** https://github.com/PeizhiYan/mediapipe-blendshapes-to-flame
- **How it works:** Linear regression trained on paired ARKit/FLAME data

### Emotion Presets
Our SDK maps emotion names to specific blendshape combinations:
- happy → mouthSmileLeft/Right + cheekSquint + eyeSquint
- sad → mouthFrownLeft/Right + browInnerUp + eyeLookDown
- angry → browDown + eyeSquint + noseSneer + mouthPress
- surprised → eyeWide + browUp + jawOpen + mouthFunnel
- thinking → eyeLookUp + browInnerUp + mouthPucker
- etc.

---

## Audio & Lip Sync

### How Our Lip-Sync Works
1. TTS audio plays through Web Audio API
2. AnalyserNode extracts frequency spectrum (FFT)
3. Frequencies grouped into 5 bands (formant regions)
4. Each band pattern matched against viseme profiles (dot product)
5. Top-scoring visemes weighted and smoothed
6. Viseme weights fed to BlendshapeMixer → drive mouth shapes

### Key Concepts
- **Formants:** Resonant frequencies of the vocal tract that distinguish vowels/consonants
  - F1 (300-1000 Hz): vowel height (open/close)
  - F2 (800-2500 Hz): vowel frontness
  - F3 (2000-3500 Hz): consonant identity
- **MFCC:** Mel-Frequency Cepstral Coefficients — compact audio feature representation
  - https://en.wikipedia.org/wiki/Mel-frequency_cepstrum
- **Viseme:** A visual mouth shape corresponding to a phoneme or group of phonemes

### Audio Processing References
- **Web Audio API:** https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API
- **AnalyserNode:** https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode
- **AudioWorklet:** https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet

---

## Build Tools & Infrastructure

### pnpm
- **What:** Fast, disk-efficient package manager (alternative to npm/yarn)
- **Why we use it:** Monorepo workspace support, faster installs
- **Docs:** https://pnpm.io/

### Turborepo
- **What:** Build system for JavaScript/TypeScript monorepos
- **Why we use it:** Parallel builds, caching, task dependencies across packages
- **Docs:** https://turbo.build/repo/docs

### tsup
- **What:** Zero-config TypeScript bundler (powered by esbuild)
- **Why we use it:** Produces ESM, CJS, and type declaration files from TypeScript
- **Docs:** https://tsup.egoist.dev/
- **Source:** https://github.com/egoist/tsup

### Vite
- **What:** Next-generation frontend build tool
- **Why we use it:** Dev server for examples with hot module replacement
- **Docs:** https://vite.dev/

### Vitest
- **What:** Unit testing framework compatible with Vite
- **Why we use it:** Fast TypeScript-native testing with Jest-compatible API
- **Docs:** https://vitest.dev/

### ESLint + Prettier
- **ESLint:** JavaScript/TypeScript linter — https://eslint.org/
- **Prettier:** Code formatter — https://prettier.io/
- **typescript-eslint:** TypeScript-specific lint rules — https://typescript-eslint.io/

---

## Key Research Papers

### Gaussian Splatting
1. **3D Gaussian Splatting for Real-Time Radiance Field Rendering** (Kerbl et al., 2023)
   - The foundational paper. Introduced using 3D Gaussians for real-time novel view synthesis.
   - https://repo-sam.inria.fr/fungraph/3d-gaussian-splatting/

2. **GaussianAvatars: Photorealistic Head Avatars with Rigged 3D Gaussians** (Qian et al., CVPR 2024)
   - Binds Gaussians to FLAME mesh triangles for animatable head avatars.
   - https://shenhanqian.github.io/gaussian-avatars
   - Code: https://github.com/ShenhanQian/GaussianAvatars

3. **SplattingAvatar: Realistic Real-Time Human Avatars with Mesh-Embedded Gaussian Splatting** (Shao et al., CVPR 2024)
   - Embeds Gaussians on mesh surface for real-time avatar rendering.
   - https://initialneil.github.io/SplattingAvatar
   - Code: https://github.com/initialneil/SplattingAvatar

4. **FlashAvatar: High-Fidelity Head Avatar with Efficient Gaussian Embedding** (Xiang et al., CVPR 2024)
   - Ultra-fast training (5-15 min) for Gaussian head avatars.
   - Code: https://github.com/USTC3DV/FlashAvatar-code

5. **GaussianTalker: Real-Time High-Fidelity Talking Head Synthesis with Audio-Driven 3D Gaussian Splatting** (2024)
   - Audio-driven talking head using Gaussian splatting, 130 FPS on RTX 4090.

### FLAME Model
6. **Learning a model of facial shape and expression from 4D scans** (Li et al., 2017)
   - The FLAME paper. Parametric head model with shape, expression, pose.
   - https://flame.is.tue.mpg.de/

### Neural Radiance Fields (Background)
7. **NeRF: Representing Scenes as Neural Radiance Fields for View Synthesis** (Mildenhall et al., 2020)
   - Predecessor to Gaussian splatting. Neural network-based 3D scene representation.
   - https://www.matthewtancik.com/nerf

---

## Open Source Projects Used

| Project | What it does | URL |
|---------|-------------|-----|
| **Three.js** | 3D rendering engine | https://github.com/mrdoob/three.js |
| **Spark** | Gaussian splat renderer | https://github.com/sparkjsdev/spark |
| **GaussianAvatars** | FLAME-rigged Gaussian training | https://github.com/ShenhanQian/GaussianAvatars |
| **mediapipe-blendshapes-to-flame** | ARKit→FLAME mapping | https://github.com/PeizhiYan/mediapipe-blendshapes-to-flame |
| **FLAME** | Parametric head model | https://flame.is.tue.mpg.de/ |
| **TalkingHead** | Browser lip-sync avatar | https://github.com/met4citizen/TalkingHead |
| **Turborepo** | Monorepo build system | https://github.com/vercel/turborepo |
| **tsup** | TypeScript bundler | https://github.com/egoist/tsup |
| **Vitest** | Test framework | https://github.com/vitest-dev/vitest |
| **Vite** | Dev server & bundler | https://github.com/vitejs/vite |

---

## Learning Path

### If you're new to 3D web development:
1. **Learn Three.js basics** — https://threejs.org/manual/#en/fundamentals
2. **Understand GLB/GLTF** — Load and display a 3D model in the browser
3. **Learn blendshapes** — How morph targets deform a mesh
4. **Web Audio API** — Analyze audio frequencies in real-time

### If you want to understand Gaussian splatting:
1. **Read the intro blog post** — https://aras-p.info/blog/2023/09/05/Gaussian-Splatting-is-pretty-cool/
2. **Watch a video explanation** — Search "3D Gaussian Splatting explained"
3. **Play with a viewer** — Load a .ply in Spark or GaussianSplats3D
4. **Read the original paper** — Section 3 (Representation) and Section 5 (Rendering)
5. **Study GaussianAvatars** — How Gaussians are bound to FLAME triangles

### If you want to understand FLAME:
1. **Register and download** — https://flame.is.tue.mpg.de/
2. **Read the paper** — Focus on Sections 3 (Model) and 4 (Training)
3. **Study the Python code** — The `forward()` function in flame.py
4. **Understand LBS** — Linear Blend Skinning is how joints rotate vertices
5. **Try DECA** — Reconstruct FLAME params from a photo

### If you want to train your own avatar:
1. **Read FlashAvatar paper** — Understand UV-space Gaussian embedding
2. **Set up a GPU instance** — Vast.ai or RunPod (~$0.30/hr)
3. **Record a selfie video** — 1-2 min, good lighting, varied expressions
4. **Run FlashAvatar training** — 15 minutes
5. **Convert to .lca format** — Use our conversion scripts

---

## Glossary

| Term | Definition |
|------|-----------|
| **ARKit** | Apple's augmented reality framework, defines 52 facial blendshapes |
| **Blendshape** | A deformation target that morphs a mesh from neutral to a specific pose |
| **FLAME** | Faces Learned with an Articulated Model and Expressions — parametric head model |
| **Gaussian splat** | A 3D ellipsoid with position, color, opacity, scale, rotation — building block of 3DGS |
| **GLB** | Binary GL Transmission Format — compressed 3D model file |
| **LBS** | Linear Blend Skinning — technique for deforming mesh vertices with bone rotations |
| **LCA** | Low-Cost Avatar — our custom file format for FLAME-rigged Gaussian splat avatars |
| **Morph target** | Same as blendshape — a stored vertex displacement |
| **SH** | Spherical Harmonics — mathematical representation of view-dependent color |
| **Viseme** | A visual mouth shape corresponding to a speech sound |
| **WebGPU** | Modern GPU API for the web (successor to WebGL) |
| **WGSL** | WebGPU Shading Language — shader language for WebGPU |
