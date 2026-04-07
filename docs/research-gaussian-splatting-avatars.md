# Gaussian Splatting for Photorealistic Animatable Avatars in the Browser

**Research Date:** April 2026  
**Purpose:** Evaluate feasibility of client-side Gaussian splat avatars as an alternative to server-rendered video avatars (e.g., HeyGen)

---

## 1. Browser-Based Gaussian Splatting Renderers

### Major Libraries

| Library | Renderer | Stars | Status | Key Notes |
|---------|----------|-------|--------|-----------|
| **[Spark](https://github.com/sparkjsdev/spark)** (World Labs) | Three.js / WebGL2 | Active | **Current leader** | Named one of GitHub's most influential libraries 2025. v2.0 supports huge dynamic worlds. 98%+ WebGL2 device support. Supports .PLY, .SPZ, .SPLAT, .KSPLAT, .SOG formats. |
| **[GaussianSplats3D](https://github.com/mkkellogg/GaussianSplats3D)** | Three.js / WebGL | Active | Mature | Supports .ply, .splat, .ksplat. Good integration with Three.js ecosystem. |
| **[gsplat.js](https://github.com/huggingface/gsplat.js)** (Hugging Face) | WebGL | Active | General-purpose | Easy-to-use API similar to Three.js but for Gaussian Splatting. npm package available. |
| **[antimatter15/splat](https://github.com/antimatter15/splat)** | WebGL 1.0 | Stable | Minimal, no deps | Pure WebGL 1.0, zero dependencies. Good reference implementation. |
| **[Visionary](https://github.com/Visionary-Laboratory/visionary)** | **WebGPU** | Active | **Most advanced** | WebGPU + ONNX Runtime. Supports animatable neural avatars. 2-16ms/frame on RTX 4090. Up to 135x faster than WebGL viewers. |
| **[Scthe/gaussian-splatting-webgpu](https://github.com/Scthe/gaussian-splatting-webgpu)** | WebGPU | Stable | Reference | WebGPU compute shaders for sorting. |
| **[WebSplatter](https://arxiv.org/html/2602.03207)** | WebGPU | Research | Academic paper (Feb 2026) | Fully GPU compute-render pipeline. Cross-device efficient rendering. |
| **Babylon.js 8.0** | WebGL/WebGPU | Built-in | Native support | Gaussian splatting as first-class feature in Babylon.js. |
| **PlayCanvas** | WebGL/WebGPU | Built-in | Production | Includes [SuperSplat editor](https://superspl.at/editor). |

### Performance Benchmarks

- **Desktop (RTX 3080Ti):** ~147 FPS for 6.1M splats (native renderer)
- **Desktop (WebGPU, RTX 4090-class):** 2-16ms/frame via Visionary
- **Mobile (Snapdragon 8 Gen 3):** 116 FPS at 1600x1063 via Mobile-GS (native, not browser)
- **Browser WebGL:** Typically 30-60 FPS for scenes <500K splats on desktop; significantly lower on mobile
- **Head avatars (60-100K splats):** Should render well in browser even on WebGL

### WebGL vs WebGPU Decision

| Factor | WebGL | WebGPU |
|--------|-------|--------|
| Browser support | ~98% of devices | ~70% as of early 2026 |
| Safari iOS | Full support | Requires iOS 26+ (Safari 26.0, released Sept 2025) |
| Firefox | Full support | Windows + macOS Apple Silicon only; Android behind flag |
| Chrome Android | Full support | Works on recent hardware |
| Sorting performance | CPU-based (JavaScript/WASM) -- bottleneck | GPU compute shaders -- much faster |
| Animation support | Manual implementation needed | Visionary has ONNX-based animation built in |

**Recommendation:** Start with WebGL2 (Spark or GaussianSplats3D) for maximum compatibility. Add WebGPU path (Visionary) for high-performance devices. Head avatars with 60-100K splats are small enough that WebGL sorting is feasible.

### File Formats and Sizes

| Format | Typical Size (500K gaussians) | GPU Memory | Notes |
|--------|-------------------------------|------------|-------|
| .PLY (uncompressed) | 118 MB | 890 MB | Original format. Too large for web. |
| .SPLAT | 16.2 MB (7.3x smaller) | 245 MB | No SH coefficients (no view-dependent color). |
| .KSPLAT | 11.4 MB (10.4x smaller) | 210 MB | GaussianSplats3D custom format. |
| .SPZ | 11.8 MB (10x smaller) | 230 MB | Google's format. |
| .SOG | ~8-10 MB (~12x smaller) | ~200 MB | PlayCanvas's latest. 2-3x better than compressed PLY. |
| Compressed .PLY | ~30 MB (4x smaller) | ~250 MB | PlayCanvas compressed variant. |

**For a head avatar (60-100K splats):**
- Uncompressed .PLY: ~15-25 MB
- .SPLAT format: ~2-4 MB
- .KSPLAT/.SPZ/.SOG: ~1.5-3 MB
- With aggressive compression: <2 MB is achievable

**Critical mobile constraint:** iPhones have 4-6 GB shared memory. PLY scenes above 1M gaussians will crash Safari. Head avatars at 60-100K are well within safe limits.

---

## 2. Animatable Gaussian Splat Avatars

### Research Papers and Implementations (Sorted by Relevance)

#### Tier 1: Open-Source, Animatable, FLAME-Rigged

| Project | Venue | Open Source | Rigging Method | Gaussians | Training Time | Key Feature |
|---------|-------|-------------|----------------|-----------|---------------|-------------|
| **[GaussianAvatars](https://github.com/ShenhanQian/GaussianAvatars)** | CVPR 2024 Highlight | Yes | FLAME mesh triangles | 60-100K | Hours on single GPU | Gold standard. One Gaussian per FLAME triangle + densification. Joint optimization of FLAME params + Gaussians. |
| **[FlashAvatar](https://ustc3dv.github.io/FlashAvatar/)** | 2024 | Code not released | FLAME mesh | 74,083 (fixed) | **Minutes on RTX 3090** | Fastest training. Coarse appearance in seconds, photo-realistic in minutes. |
| **[MonoGaussianAvatar](https://github.com/yufan1012/MonoGaussianAvatar)** | 2024 | Yes | FLAME + learned offsets | ~10K mesh-attached | Hours | Monocular video input. |
| **[SplattingAvatar](https://github.com/initialneil/SplattingAvatar)** | CVPR 2024 | Yes | Mesh-embedded Gaussians | Variable | Hours | 300 FPS on RTX 3090; **30 FPS on iPhone 13** (notable mobile result) |
| **[FateAvatar (FATE)](https://github.com/zjwfufu/FateAvatar)** | CVPR 2025 | Yes | FLAME + completion | Variable | Hours | **First animatable 360-degree full-head** from monocular video. Handles hair/back of head. Textural editing. |
| **[Gaussian-Head-Avatar](https://github.com/YuelangX/Gaussian-Head-Avatar)** | CVPR 2024 | Yes | Dynamic Gaussians + MLP | Variable | Hours | Ultra high-fidelity. Training + reenactment scripts. |
| **[GaussianAvatar](https://github.com/aipixel/GaussianAvatar)** | CVPR 2024 | Yes | Deformable 3DGS | Variable | Hours | Full body from single video. |

#### Tier 2: Audio-Driven Talking Heads (Gaussian Splatting)

| Project | Venue | Open Source | Audio-to-Motion | FPS | Key Feature |
|---------|-------|-------------|-----------------|-----|-------------|
| **[GaussianTalker](https://github.com/cvlab-kaist/GaussianTalker)** (KAIST) | ACM MM 2024 | Yes | Audio -> Gaussian attribute offsets | 130 FPS (RTX 4090) | Spatial-audio attention module. Encodes Gaussian attributes into shared implicit features merged with audio. |
| **[GaussianTalker](https://arxiv.org/abs/2404.14037)** (variant 2) | ACM MM 2024 | Partial | Audio -> FLAME blendshapes -> Gaussians | 130 FPS (RTX 4090) | Speaker-specific BlendShapes. Wav2Vec audio features -> FLAME. |
| **[GaussianHeadTalk](https://arxiv.org/html/2512.10939)** | 2025 | Research | Transformer + Wav2Vec 2.0 -> FLAME params | Real-time | Wobble-free. Long-term audio context. Direct mesh prediction. |
| **[TaoAvatar](https://taoavatar.org/)** (Alibaba) | CVPR 2025 Highlight | Partial | Full pipeline | **90 FPS on Apple Vision Pro** | Full-body talking avatar. Lightweight MLP + distillation. Mobile-first. |
| **[THGS](https://onlinelibrary.wiley.com/doi/10.1111/cgf.15282)** | CGF 2025 | Research | Audio -> talking head | Real-time | Lifelike talking avatar from monocular video. |

#### Tier 3: Cutting-Edge Research (2025-2026)

| Project | Venue | Key Innovation |
|---------|-------|----------------|
| **[ScaffoldAvatar](https://studios.disneyresearch.com/2025/07/09/scaffoldavatar-high-fidelity-gaussian-avatars-with-patch-expressions/)** (Disney Research) | SIGGRAPH 2025 | Patch-level expressions. Ultra-high fidelity -- freckles, micro-expressions. Real-time. |
| **[GeoAvatar](https://arxiv.org/html/2507.18155)** | ICCV 2025 | Adaptive geometry. Segments Gaussians into rigid/flexible sets. |
| **[TeGA](https://arxiv.org/html/2505.05672v1)** | SIGGRAPH 2025 | Texture-space Gaussians for high-res dynamic heads. |
| **[MeGA](https://cg.cs.tsinghua.edu.cn/papers/CVPR-2025-MeGA.pdf)** | CVPR 2025 | Hybrid Mesh-Gaussian for high-fidelity rendering + head pose. |
| **[HyperGaussians](https://gserifi.github.io/HyperGaussians/)** | 2025 | High-dimensional GS for animatable face avatars. |
| **[SHARP](https://openreview.net/forum?id=dfC2ji6nek)** | 2025 | Relightable photorealistic Gaussian head avatars. |
| **[FastAvatar](https://arxiv.org/html/2508.18389)** | 2025 | Instant 3DGS for faces from single unconstrained pose. |
| **[UniGAHA](https://arxiv.org/html/2509.18924)** | 2025 | Audio-driven universal Gaussian head avatars. Gaussian Blendshapes as explicit formulation. |
| **[SqueezeMe](https://forresti.github.io/squeezeme/)** | 2025 | Distills full-body Gaussian avatars for VR. 3 avatars at 72 FPS on Meta Quest 3. |
| **[HRM2Avatar](https://acennr-engine.github.io/HRM2Avatar/)** | SIGGRAPH Asia 2025 | 120 FPS on mobile, 90 FPS on standalone VR at 2K. From phone scans. |

### How Animation/Rigging Works

The dominant approach:

1. **FLAME parametric face model** provides a triangular mesh with ~10K faces
2. Each FLAME triangle gets one or more 3D Gaussians attached to it
3. FLAME provides expression parameters (50 blendshape coefficients), jaw pose, eye pose
4. When FLAME parameters change, the mesh deforms, and Gaussians move/rotate/scale with their parent triangles
5. Additional learned offsets (MLPs or direct optimization) capture fine details beyond FLAME

**For audio-driven animation:**
- Audio (wav) -> Wav2Vec 2.0 or HuBERT encoder -> features
- Features -> Transformer/MLP -> FLAME expression parameters (or direct Gaussian offsets)
- FLAME deformation drives Gaussian positions
- Rendering at 30-130+ FPS depending on method and hardware

---

## 3. Avatar Creation Pipeline

### Input Requirements

| Method | Input Required | Quality Level |
|--------|---------------|---------------|
| Multi-view video (16+ cameras) | Studio capture rig | Highest quality (GaussianAvatars) |
| Monocular video (phone) | 1-3 min selfie video, turn head slowly | Good quality (FATE, MonoGaussianAvatar, GSAC) |
| Single photo | One portrait | Lower quality, less animatable (FastAvatar) |
| 3D scan + photos | Structured light scan + texture | High quality but requires hardware |

### End-to-End Pipelines

#### Option A: Research Pipeline (GaussianAvatars)
1. **Capture:** Multi-view video or monocular video
2. **Face tracking:** Extract FLAME parameters per frame (using [VHAP](https://github.com/ShenhanQian/VHAP) or EMOCA)
3. **Structure from Motion:** COLMAP for camera poses (if not multi-view calibrated)
4. **Training:** Joint optimization of Gaussian splat parameters + FLAME parameters
5. **Export:** Trained model (FLAME mesh + per-triangle Gaussian attributes)
6. **Requirements:** NVIDIA GPU (RTX 3090+), Python, PyTorch, CUDA 11.7+
7. **Training time:** Hours (GaussianAvatars) to minutes (FlashAvatar)

#### Option B: Streamlined Pipeline (GSAC, 2025)
1. **Capture:** Single monocular phone-recorded video
2. **Processing:** End-to-end pipeline handles preprocessing, FLAME fitting, training
3. **Output:** Photorealistic avatar compatible with Unity
4. **Time:** Under 40 minutes total
5. **Requirements:** GPU server (CUDA)

#### Option C: Mobile-First (HRM2Avatar, 2025)
1. **Capture:** Phone scan (monocular)
2. **Output:** Avatar that renders at 120 FPS on mobile, 90 FPS on VR
3. **Quality:** Photorealistic from phone scan

### Tools and Software

| Tool | Purpose | URL |
|------|---------|-----|
| **Nerfstudio (Splatfacto)** | General 3DGS training | [docs.nerf.studio](https://docs.nerf.studio/nerfology/methods/splat.html) |
| **Original 3DGS repo** (INRIA) | Reference implementation | [github.com/graphdeco-inria/gaussian-splatting](https://github.com/graphdeco-inria/gaussian-splatting) |
| **nerfstudio gsplat** | CUDA-accelerated rasterization | [github.com/nerfstudio-project/gsplat](https://github.com/nerfstudio-project/gsplat) |
| **COLMAP** | Structure from Motion | Required for camera pose estimation |
| **SuperSplat** | Browser-based splat editing/compression | [superspl.at/editor](https://superspl.at/editor) |
| **SplatTransform** | CLI format conversion | [github.com/playcanvas/splat-transform](https://github.com/playcanvas/splat-transform) |
| **FLAME model** | Parametric face mesh | [flame.is.tue.mpg.de](https://flame.is.tue.mpg.de/) |
| **VHAP** | Video-based head alignment | [github.com/ShenhanQian/VHAP](https://github.com/ShenhanQian/VHAP) |

### Hardware Requirements for Training

- **Minimum:** NVIDIA RTX 3090 (24GB VRAM)
- **Recommended:** NVIDIA A100/A6000 for research pipelines
- **FlashAvatar:** Can train in minutes on RTX 3090
- **GaussianAvatars:** Several hours on RTX 3090
- **Consumer GPU feasibility:** Yes, RTX 3090/4090 is consumer hardware. RTX 4070+ may work for smaller models.
- **Cloud alternative:** Any cloud GPU provider (Lambda, RunPod, etc.) with A100s

---

## 4. Current Limitations

### Technical Challenges

1. **Hair, ears, neck:** FLAME mesh does not cover these regions well. Hair is particularly problematic -- long hair, hair movement, and hair-face boundaries remain unsolved in most methods. FATE (2025) is the first to attempt full 360-degree head including hair via a completion framework.

2. **Fine facial details:** Eyes and teeth lack explicit geometric modeling in FLAME, leading to suboptimal initialization. Microexpressions, wrinkles, and pore-level detail require very high Gaussian counts or patch-based approaches (ScaffoldAvatar).

3. **Wobble artifacts:** Audio-driven methods (GaussianTalker, TalkingGaussian) produce wobbling artifacts due to lack of long-term temporal information and improper 3D parameter tracking during training. GaussianHeadTalk (2025) specifically targets this.

4. **Animation fidelity vs reconstruction:** Animatable models lose fidelity compared to static reconstructions. Expression-dependent appearance (e.g., skin stretching, wrinkle formation) is hard to capture.

5. **Relighting:** Most methods assume fixed lighting. SHARP (2025) is one of the first to address relightable Gaussian avatars.

6. **Memory on mobile:** Uncompressed PLY >1M gaussians will crash Safari. Head avatars (60-100K) are fine, but adding body/hair pushes limits.

7. **No production browser animation pipeline exists yet:** While Visionary supports animatable avatars via ONNX in browser, and SplattingAvatar achieves 30 FPS on iPhone 13, there is no turnkey "create avatar -> animate in browser" product available today.

### What Works TODAY vs Research-Only

| Capability | Status | Evidence |
|------------|--------|----------|
| Static Gaussian splat rendering in browser | **Production ready** | Spark, GaussianSplats3D, PlayCanvas, Babylon.js all work |
| Compressed splat formats for web | **Production ready** | .KSPLAT, .SPZ, .SOG all under 3 MB for a head |
| Creating a Gaussian splat of a face | **Works, needs GPU** | Multiple open-source pipelines (GaussianAvatars, FATE, GSAC) |
| FLAME-rigged animatable head | **Works offline** | GaussianAvatars, SplattingAvatar, FATE all open source |
| Audio-driven talking head (Gaussian) | **Works offline** | GaussianTalker achieves 130 FPS on RTX 4090 |
| Animatable Gaussian avatar in browser | **Early/experimental** | Visionary (WebGPU + ONNX) is the only option. Requires WebGPU. |
| Mobile Gaussian avatar (native) | **Demonstrated** | SplattingAvatar: 30 FPS iPhone 13. TaoAvatar: 90 FPS Vision Pro. HRM2Avatar: 120 FPS mobile. |
| End-to-end product (video in -> animated avatar out -> browser) | **Does not exist** | No turnkey solution. Would need to be built. |

---

## 5. Commercial Landscape

### Companies Using or Exploring Gaussian Splatting for Avatars

| Company | What They're Doing | Status |
|---------|-------------------|--------|
| **Qualcomm** | On-device 3DGS avatar rendering. Published [blog post](https://www.qualcomm.com/developer/blog/2024/12/driving-photorealistic03d-avatars-in-real-time-on-device-3d-gaussian-splatting) Dec 2024 on photorealistic avatars via on-device 3DGS. | R&D / demo |
| **Disney Research** | ScaffoldAvatar (SIGGRAPH 2025). Ultra-high fidelity patch-based expressions. | Research |
| **Apple** | HUGS (Human Gaussian Splats) research. WebGPU in Safari 26. | Research + platform enablement |
| **Alibaba** | TaoAvatar (CVPR 2025 Highlight). Full-body talking avatars for AR on mobile. | Research / internal product |
| **Meta** | Splat viewing in Quest. D3GA (Drivable 3D Gaussian Avatars) research. SqueezeMe for Quest 3. | R&D |
| **World Labs** | Spark (Three.js Gaussian renderer). Most popular web GS library. | Open-source product |
| **PlayCanvas** | SuperSplat editor + engine integration. SOG compression format. | Production tooling |
| **4DViews** | Volumetric video with 3DGS for hair/fur/reflective surfaces. | Production (film) |
| **OTOY** | OctaneRender 2026 with path-traced Gaussian splat support. | Production (VFX) |

### Notable Absence

**HeyGen and Simli** have not publicly announced Gaussian splatting integration. HeyGen continues to use server-side neural rendering (likely NeRF-derived or diffusion-based). Simli uses a streaming approach. Neither has published work on client-side 3DGS avatars.

This represents a potential competitive opportunity: no one is offering a **browser-based, client-side, Gaussian splat animated avatar SDK** as a product yet.

---

## 6. Recommended Architecture for Browser Avatar SDK

Based on this research, the most viable path:

### Rendering Stack
- **Primary:** Spark (Three.js, WebGL2) for ~98% device coverage
- **Enhanced:** Visionary (WebGPU + ONNX) for modern browsers with animation support
- **Format:** .KSPLAT or .SPZ (1.5-3 MB per head avatar)

### Avatar Creation (Server-Side, One-Time)
- **Input:** 1-3 minute monocular selfie video
- **Pipeline:** FLAME tracking (VHAP) -> GaussianAvatars or FATE training -> export
- **Time:** 30-60 minutes on cloud GPU
- **Output:** FLAME-rigged Gaussian splat + expression basis

### Animation (Client-Side, Real-Time)
- **Expression driving:** Audio -> Wav2Vec/HuBERT -> FLAME expression params (can run via ONNX in browser)
- **Deformation:** FLAME mesh deformation drives Gaussian positions (can be done in JS/WASM)
- **Rendering:** Spark or custom WebGL renderer for deformed Gaussians
- **Target:** 30+ FPS for head avatar (60-100K splats) on desktop, 20+ FPS on mobile

### Key Technical Gaps to Solve
1. **FLAME deformation in browser:** Need JS/WASM implementation of FLAME forward kinematics + LBS
2. **Audio-to-expression in browser:** Need lightweight model (ONNX via WebGPU or WASM)
3. **Splat deformation pipeline:** No existing browser library handles per-triangle Gaussian binding + deformation
4. **Hair/neck quality:** May need to accept FLAME-region-only rendering or invest in FATE-style completion

---

## Sources

### Browser Renderers
- [Spark (World Labs)](https://github.com/sparkjsdev/spark)
- [GaussianSplats3D](https://github.com/mkkellogg/GaussianSplats3D)
- [gsplat.js (Hugging Face)](https://github.com/huggingface/gsplat.js)
- [antimatter15/splat](https://github.com/antimatter15/splat)
- [Visionary](https://github.com/Visionary-Laboratory/visionary)
- [WebSplatter paper](https://arxiv.org/html/2602.03207)
- [Scthe/gaussian-splatting-webgpu](https://github.com/Scthe/gaussian-splatting-webgpu)

### Avatar Research (Open Source)
- [GaussianAvatars (ShenhanQian)](https://github.com/ShenhanQian/GaussianAvatars)
- [FateAvatar](https://github.com/zjwfufu/FateAvatar)
- [SplattingAvatar](https://github.com/initialneil/SplattingAvatar)
- [MonoGaussianAvatar](https://github.com/yufan1012/MonoGaussianAvatar)
- [Gaussian-Head-Avatar](https://github.com/YuelangX/Gaussian-Head-Avatar)
- [GaussianAvatar](https://github.com/aipixel/GaussianAvatar)
- [GaussianTalker](https://github.com/cvlab-kaist/GaussianTalker)
- [HeadStudio](https://github.com/ZhenglinZhou/HeadStudio)

### Audio-Driven Talking Heads
- [GaussianTalker paper](https://arxiv.org/abs/2404.16012)
- [GaussianHeadTalk](https://arxiv.org/html/2512.10939)
- [TaoAvatar](https://taoavatar.org/)
- [UniGAHA](https://arxiv.org/html/2509.18924)

### Compression and Formats
- [PlayCanvas Compression Blog](https://blog.playcanvas.com/compressing-gaussian-splats/)
- [3DGS Formats Compared (2026)](https://www.polyvia3d.com/formats/gaussian-splatting-formats)
- [SuperSplat Editor](https://superspl.at/editor)
- [SplatTransform CLI](https://github.com/playcanvas/splat-transform)

### Mobile/VR
- [Mobile-GS](https://xiaobiaodu.github.io/mobile-gs-project/)
- [HRM2Avatar](https://acennr-engine.github.io/HRM2Avatar/)
- [SqueezeMe](https://forresti.github.io/squeezeme/)
- [Qualcomm on-device 3DGS](https://www.qualcomm.com/developer/blog/2024/12/driving-photorealistic03d-avatars-in-real-time-on-device-3d-gaussian-splatting)

### Creation Pipelines
- [GSAC paper](https://arxiv.org/abs/2504.12999)
- [Nerfstudio Splatfacto](https://docs.nerf.studio/nerfology/methods/splat.html)
- [Original 3DGS (INRIA)](https://github.com/graphdeco-inria/gaussian-splatting)
- [nerfstudio gsplat](https://github.com/nerfstudio-project/gsplat)
- [VHAP](https://github.com/ShenhanQian/VHAP)

### Latest Research (2025-2026)
- [ScaffoldAvatar (Disney)](https://studios.disneyresearch.com/2025/07/09/scaffoldavatar-high-fidelity-gaussian-avatars-with-patch-expressions/)
- [GeoAvatar](https://arxiv.org/html/2507.18155)
- [TeGA](https://arxiv.org/html/2505.05672v1)
- [MeGA](https://cg.cs.tsinghua.edu.cn/papers/CVPR-2025-MeGA.pdf)
- [SHARP](https://openreview.net/forum?id=dfC2ji6nek)
- [FastAvatar](https://arxiv.org/html/2508.18389)
- [Gaussian Head Avatars Summary (TDS)](https://towardsdatascience.com/gaussian-head-avatars-a-summary-2bd17bd48500/)
- [3DGS Complete Guide 2026](https://www.utsubo.com/blog/gaussian-splatting-guide)
- [WebGPU Browser Support Status](https://caniuse.com/webgpu)
