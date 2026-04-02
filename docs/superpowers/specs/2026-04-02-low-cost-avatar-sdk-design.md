# Low-Cost Avatar SDK — Design Specification

**Date:** 2026-04-02
**Status:** Approved
**Approach:** Three.js + GLB Blendshape Pipeline (Client-Side Rendering)

---

## 1. Problem Statement

Interactive AI avatars today are expensive ($0.05-0.32/min) and laggy (600-3000ms) because every provider renders video server-side on GPUs and streams it via WebRTC. The GPU compute for real-time neural video generation is the dominant cost driver, and the network round-trips for frame generation add latency.

**Our thesis:** Move all visual rendering to the client's browser. Only text and audio cross the network. The client's existing GPU (even integrated graphics) handles rendering for free. This reduces avatar rendering cost to effectively **zero** and eliminates 70-250ms of latency per interaction.

## 2. Market Context

### Commercial Landscape (All Server-Side)

| Provider | Cost/min | Architecture |
|---|---|---|
| Hedra | $0.05 | Server GPU + WebRTC |
| HeyGen | $0.10-0.20 | Server GPU + WebRTC |
| Tavus | ~$0.10 | Server GPU + WebRTC |
| D-ID | ~$0.32 | Server GPU + WebRTC |
| Simli | Pay-as-you-go | Server GPU (Gaussian splatting) + WebRTC |
| Soul Machines | Enterprise | Server GPU + WebRTC |

### Open-Source Validations (Client-Side Works)

| Project | Approach | Validation |
|---|---|---|
| TalkingHead (~1.1k stars) | Three.js + GLB + ARKit blendshapes | Proves full lip-sync works in browser |
| wawa-lipsync | Pure JS audio-to-viseme via Web Audio API | Proves no-server lip-sync is viable |
| Open-LLM-VTuber | Live2D in browser + local LLM | Proves fully offline avatar is possible |
| Prometheus Avatar | PIXI.js + Live2D + emotion detection | Proves emotion-driven avatars work client-side |

### The Gap

No one offers a **production-ready, embeddable SDK** for client-side avatar rendering. Open-source projects are demos. Commercial players won't cannibalize their per-minute GPU revenue. This SDK fills that gap.

## 3. Target Users

General-purpose embeddable SDK for any developer or company wanting interactive avatars — customer support, education, companionship, onboarding, sales, gaming. Distributed as an npm package + CDN-hosted assets.

## 4. Architecture Overview

```
+--------------------------------------------------+
|                Developer's App                    |
|  avatar.speak(audio) / avatar.setEmotion('happy') |
+--------------------------------------------------+
|              Low-Cost Avatar SDK                  |
|                                                   |
|  +------------+  +------------+  +--------------+ |
|  |  Asset     |  | Animation  |  |  Command     | |
|  |  Manager   |  | Engine     |  |  Controller  | |
|  |            |  |            |  |              | |
|  | -Download  |  | -Lip sync  |  | -WebSocket   | |
|  | -Cache     |  | -Blinks    |  | -REST API    | |
|  | -LOD swap  |  | -Idle      |  | -Direct JS   | |
|  | -Preload   |  | -Gestures  |  | -Events      | |
|  +------------+  +------------+  +--------------+ |
|                                                   |
|  +------------+  +------------+  +--------------+ |
|  |  Renderer  |  |  Audio     |  |  Blendshape  | |
|  | (Three.js) |  |  Analyzer  |  |  Mixer       | |
|  |            |  | (Worklet)  |  |              | |
|  +------------+  +------------+  +--------------+ |
+--------------------------------------------------+
|           Browser APIs (WebGL, Web Audio)         |
+--------------------------------------------------+
```

### Data Flow

1. Backend sends TTS audio + optional emotion/gesture tags to the SDK
2. **Audio Analyzer** (Web Audio worklet) extracts visemes from the audio in real-time
3. **Blendshape Mixer** combines viseme values + emotion blendshapes + idle animation values into a single blendshape frame
4. **Animation Engine** applies the mixed blendshapes to the 3D model each frame
5. **Renderer** (Three.js) draws the frame to a `<canvas>`

Only text and audio cross the network. All visual rendering happens locally.

## 5. Asset Management

### Avatar Assets (GLB Files)

Each avatar GLB contains:
- 3D mesh (head, body, hair, clothing)
- 52 ARKit facial blendshapes (for expressions)
- 15 Oculus viseme blendshapes (for lip-sync)
- Skeleton with bone hierarchy (for body gestures)
- PBR materials/textures

### Avatar Sources

- **Pre-built library:** Ship a set of ready-made realistic characters developers pick from
- **Custom model upload:** Developers can bring their own GLB/GLTF models with proper blendshapes

### Download & Caching Strategy

| Strategy | How |
|---|---|
| Lazy loading | Avatar GLB downloaded only when first needed |
| IndexedDB cache | After first download, cached locally (persists across sessions) |
| CDN-served assets | GLB files + gesture animations served from CDN |
| Compression | Draco/meshopt compression — reduces 15MB to ~3-5MB |
| LOD (Level of Detail) | 2-3 quality levels per avatar, auto-selected by device capability |
| Gesture packs | Body animations as separate lightweight files, downloaded on demand |

### Asset Structure

```
avatar-library/
  manifests/
    v1.json                    # Lists all available avatars + gesture packs
  avatars/
    professional-woman/
      high.glb                 # ~5MB (desktop)
      medium.glb               # ~3MB (mobile)
      thumbnail.webp           # Preview image
    friendly-guy/
      high.glb
      medium.glb
      thumbnail.webp
  gestures/
    core.glb                   # Nod, shake, wave, shrug (~500KB)
    thinking.glb               # Thinking poses (~200KB)
    emotional.glb              # Happy, sad, surprised (~300KB)
```

After first visit, subsequent sessions load instantly with zero network cost for rendering.

## 6. Animation Engine

Five independent animation systems run simultaneously, blended together every frame.

### 6.1 Lip-Sync System

```
TTS Audio Stream
  -> Web Audio API (AudioWorklet)
  -> MFCC Feature Extraction (mel-frequency cepstral coefficients)
  -> Viseme Classifier (Gaussian model, ~50KB)
  -> 15 Oculus Viseme Weights (0.0 - 1.0)
  -> Blendshape Mixer
```

- Runs entirely in browser — no server round-trip
- Processes audio in real-time chunks (~20ms windows)
- Smooth co-articulation (blends between consecutive phonemes)
- Latency: <5ms from audio sample to viseme output

### 6.2 Idle Animation System

All procedural (no pre-baked animations):

| Behavior | Method | Frequency |
|---|---|---|
| Eye blinks | Random interval (2-6s), occasional double-blink | Natural distribution |
| Micro-saccades | Tiny random eye movements | Continuous, subtle |
| Breathing | Sine wave on chest/shoulder bones | ~12-16 cycles/min |
| Head micro-drift | Perlin noise on head rotation | Continuous, very subtle |
| Weight shifting | Slow sine on body lean | Every 10-20s |
| Swallow | Throat/jaw micro-movement | Every 30-60s |

Each behavior runs on its own timer with randomized intervals.

### 6.3 Emotion System

Emotions map to blendshape presets with smooth crossfade transitions. They also influence other systems:
- Happy: blink rate decreases, head tilts slightly up
- Sad: blink rate increases, head tilts down, breathing slows
- Thinking: eyes look up-left, slight squint

### 6.4 Gesture System

Pre-built skeletal animations loaded from gesture pack GLBs:
- nod, shrug, wave, lean-in, etc.
- Blended onto skeleton with configurable weight and crossfade
- Don't interrupt lip-sync or idle animations

### 6.5 Blendshape Mixer

Every frame, combines all systems:

```
Final Weight[i] = clamp(
    lipSync[i]  x lipSyncPriority  +
    emotion[i]  x emotionPriority  +
    idle[i]     x idlePriority     +
    gesture[i]  x gesturePriority  +
    direct[i]   x directPriority
, 0.0, 1.0)
```

Priority weights ensure lip-sync wins for mouth blendshapes, emotions dominate eyebrows/eyes, idle fills in the rest.

## 7. SDK API Design

### 7.1 Initialization

```js
import { LowCostAvatar } from 'low-cost-avatar'

const avatar = new LowCostAvatar({
  container: document.getElementById('avatar-container'),
  avatar: 'professional-woman',
  quality: 'auto',
  assetsBaseUrl: 'https://cdn.example.com/avatars/',
  cache: true,
})

await avatar.load()
```

### 7.2 High-Level API

```js
// Speak with optional emotion and timed gestures
await avatar.speak(audioBuffer, {
  emotion: 'happy',
  gestures: [
    { time: 0.5, name: 'nod' },
    { time: 2.0, name: 'lean-in' }
  ]
})

// Emotions
avatar.setEmotion('thinking', { intensity: 0.6, transition: 400 })
avatar.clearEmotion({ transition: 300 })

// Gestures
avatar.playGesture('wave')
avatar.stopGesture({ transition: 200 })

// Idle state
avatar.setIdle(true)
avatar.setIdle(false)
```

### 7.3 Low-Level API (Power Users)

```js
// Direct blendshape control
avatar.setBlendshapes({
  'mouthSmileLeft': 0.8,
  'mouthSmileRight': 0.8,
  'eyeSquintLeft': 0.3,
  'eyeSquintRight': 0.3,
})

// Bone manipulation
avatar.setBoneRotation('head', { pitch: 5, yaw: -10, roll: 0 })

// Animation timeline
const timeline = avatar.createTimeline()
timeline.at(0.0).setEmotion('neutral')
timeline.at(0.5).setBlendshapes({ 'browInnerUp': 0.6 })
timeline.at(1.0).playGesture('nod')
timeline.at(2.5).setEmotion('happy')
await timeline.play(audioBuffer)
```

### 7.4 Events

```js
avatar.on('loaded', () => { })
avatar.on('speakStart', () => { })
avatar.on('speakEnd', () => { })
avatar.on('gestureComplete', (name) => { })
avatar.on('error', (err) => { })
avatar.on('performanceWarning', (metrics) => { })
```

### 7.5 Backend Integration Pattern

```js
const ws = new WebSocket('wss://your-backend.com/avatar')

ws.onmessage = (event) => {
  const cmd = JSON.parse(event.data)
  switch (cmd.type) {
    case 'speak':
      avatar.speak(base64ToBuffer(cmd.audio), cmd.options)
      break
    case 'emotion':
      avatar.setEmotion(cmd.emotion, cmd.options)
      break
    case 'gesture':
      avatar.playGesture(cmd.name)
      break
  }
}
```

SDK is backend-agnostic — developer wires their own backend to the avatar's API.

### 7.6 Audio Integration

- **Phase 1 (Launch):** BYO audio — SDK accepts AudioBuffer or streaming audio. Developer uses whatever TTS they want.
- **Phase 2 (Future):** Built-in TTS adapters for popular providers (ElevenLabs, Azure, OpenAI, etc.)

## 8. Performance & Device Adaptation

### 8.1 Performance Budgets

| Metric | Target | Fallback |
|---|---|---|
| FPS | 60fps desktop, 30fps mobile | Drop to 30/24 gracefully |
| Memory | <100MB GPU, <50MB JS heap | LOD swap if exceeded |
| Initial load | <3s on 4G | Show placeholder skeleton |
| Asset size | <5MB per avatar (compressed) | Stream progressive LOD |
| CPU usage | <15% single core | Reduce idle animation complexity |

### 8.2 Auto-Quality System

On initialization, SDK runs a quick benchmark (~200ms) and selects a tier:

- **High:** Full blendshapes, all idle behaviors, high-res textures, MSAA
- **Medium:** Full blendshapes, reduced idle, medium textures, no MSAA
- **Low:** Core visemes only, minimal idle, low-res textures, reduced FPS cap

### 8.3 Runtime Adaptation

SDK monitors FPS continuously:

1. First drop (<45fps): Reduce idle animation complexity
2. Second drop (<30fps): Switch to medium LOD model
3. Third drop (<20fps): Disable gesture animations, keep only lip-sync + blinks
4. Battery saver: When battery <20%, step down one quality tier

All degradation is invisible to the developer's code.

### 8.4 Rendering Optimizations

- Single draw call per frame (merged mesh)
- Frustum culling — pause rendering when canvas is off-screen
- requestAnimationFrame throttling when tab is background
- Shared WebGL context for multiple avatars on one page
- Texture atlas to minimize texture swaps

## 9. Device Support

- **Target:** Desktop + modern mobile (Chrome/Firefox/Safari, last ~3 years)
- **Requirement:** WebGL 2.0 + Web Audio API
- **Not supported:** IE, very old/low-end devices

## 10. Project Structure

### 10.1 Monorepo Layout

```
low-cost-avatar/
  packages/
    core/                          # The main SDK
      src/
        LowCostAvatar.ts                 # Main entry, public API
        renderer/
          SceneManager.ts                # Three.js scene setup, camera, lighting
          AvatarModel.ts                 # GLB loading, blendshape access
          QualityManager.ts              # LOD, auto-quality, runtime adaptation
        animation/
          BlendshapeMixer.ts             # Combines all animation sources
          LipSyncEngine.ts              # Audio -> viseme pipeline
          IdleSystem.ts                  # Blinks, breathing, micro-movements
          EmotionSystem.ts               # Emotion presets, transitions
          GesturePlayer.ts               # Skeletal animation playback
        audio/
          AudioAnalyzer.ts               # Web Audio API setup
          viseme-worklet.ts              # AudioWorklet for MFCC + viseme
        assets/
          AssetManager.ts                # Download, cache, preload
          AssetManifest.ts               # Parse manifest, resolve URLs
          CacheProvider.ts               # IndexedDB wrapper
        types/
          index.ts                       # All public TypeScript types
      package.json
      tsconfig.json

    react/                         # React wrapper
      src/
        Avatar.tsx
      package.json

    vue/                           # Vue wrapper
      src/
        Avatar.vue
      package.json

    angular/                       # Angular wrapper
      src/
        avatar.component.ts
      package.json

  assets/
    avatars/                       # Default avatar GLBs
    gestures/                      # Gesture animation packs

  examples/
    vanilla/                       # Plain HTML + JS example
    react-demo/                    # React integration example
    websocket-backend/             # Node.js backend example

  docs/
    getting-started.md
    api-reference.md
    custom-avatars.md

  pnpm-workspace.yaml
  turbo.json
  package.json
```

### 10.2 Build Outputs

| Format | File | Use Case |
|---|---|---|
| ESM | dist/index.esm.js | Modern bundlers (Vite, webpack 5) |
| CJS | dist/index.cjs.js | Legacy Node/bundlers |
| UMD | dist/low-cost-avatar.umd.js | `<script>` tag, no bundler |
| Types | dist/index.d.ts | TypeScript support |

### 10.3 Dependencies

```
core:
  - three (~150KB gzipped)
  - three/examples (GLTFLoader, included with three)

No other runtime dependencies. Total SDK bundle: ~180KB gzipped.
```

### 10.4 npm Packages

```
low-cost-avatar              # core SDK
@low-cost-avatar/react       # React wrapper
@low-cost-avatar/vue         # Vue wrapper
@low-cost-avatar/angular     # Angular wrapper
```

## 11. Testing & Quality Strategy

### 11.1 Testing Layers

| Layer | Tool | Covers |
|---|---|---|
| Unit tests | Vitest | BlendshapeMixer math, viseme classifier, idle timers, emotion transitions, manifest parsing |
| Visual regression | Playwright + screenshot comparison | Avatar renders correctly at each quality tier, no rendering artifacts |
| Performance tests | Custom benchmark harness | FPS budgets, memory leaks over 10-min sessions, audio worklet latency |
| Integration tests | Vitest + jsdom + WebGL mock | Full pipeline: audio in -> viseme out -> blendshape applied -> model updated |
| E2E examples | Playwright | Example apps load, avatar speaks, gestures fire |

### 11.2 Key Test Cases

- Blendshape mixing priority (lip-sync must win for mouth shapes)
- Memory leaks (Three.js objects disposed on avatar.destroy())
- Cache invalidation (new versions bust IndexedDB cache)
- Concurrent audio (speak() while already speaking)
- Quality degradation (FPS drops trigger correct adaptation)
- Custom model loading (GLBs without expected blendshapes fail gracefully)

### 11.3 CI Pipeline

```
Push/PR -> Lint (ESLint + Prettier)
        -> Type check (tsc --noEmit)
        -> Unit tests (Vitest)
        -> Build all packages (Turborepo)
        -> Visual regression (Playwright, headless Chrome with WebGL)
        -> Bundle size check (fail if core > 200KB gzipped)
```

## 12. Alternatives Considered

### Approach 2: Layered 2D Compositing (Sprite Sheets + Canvas)
Pre-render expressions as 2D image layers, composite in real-time. Rejected because it cannot achieve realistic 3D look — seam lines between patches, no head rotation, lighting discontinuities, and combinatorial explosion of required frames.

### Approach 3: Hybrid Neural + Client Rendering
Run lightweight neural model via WebGPU/ONNX.js in-browser. Rejected because WebGPU support is inconsistent, client-side neural inference is too slow on most devices (1-5 fps on mobile), and the technology is not production-ready yet.

### Pixel-Delta Rendering
Store only pixel changes between avatar states, apply diffs to base image. Rejected because independent facial regions (mouth, eyes, brows) are not truly independent on a real face — a smile lifts cheeks, squints eyes, shifts nose. Blendshapes already implement this concept (vertex deltas) but in 3D where regions blend naturally, head rotation is free, and lighting is always correct.

## 13. Future Considerations

- Built-in TTS adapters (ElevenLabs, Azure, OpenAI)
- Photo-to-avatar pipeline (when WebGPU/neural texture maps mature)
- Avatar marketplace for community-created characters
- Hand tracking / gesture recognition from webcam
- Multi-avatar scenes (e.g., two avatars in conversation)
- Pluggable renderer interface to swap Three.js for future rendering approaches
