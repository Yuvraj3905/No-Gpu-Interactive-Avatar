# Low-Cost Avatar SDK Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-ready, client-side avatar rendering SDK using Three.js + GLB blendshapes that eliminates server GPU costs.

**Architecture:** Monorepo with a vanilla TypeScript core SDK, framework wrappers (React/Vue/Angular), and examples. The core SDK uses Three.js to render GLB avatars with 52 ARKit blendshapes + 15 Oculus visemes. A Web Audio worklet extracts visemes from audio in real-time. A BlendshapeMixer combines lip-sync, idle, emotion, gesture, and direct animation sources each frame.

**Tech Stack:** TypeScript, Three.js, Web Audio API (AudioWorklet), Vitest, Playwright, pnpm workspaces, Turborepo, tsup (bundler)

---

## Phase 1: Project Scaffold & Build Infrastructure

### Task 1: Initialize Monorepo

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `.gitignore`
- Create: `.npmrc`
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/tsup.config.ts`
- Create: `packages/react/package.json`
- Create: `packages/react/tsconfig.json`
- Create: `packages/vue/package.json`
- Create: `packages/vue/tsconfig.json`
- Create: `packages/angular/package.json`
- Create: `packages/angular/tsconfig.json`

- [ ] **Step 1: Create root package.json**

```json
{
  "name": "low-cost-avatar-monorepo",
  "private": true,
  "packageManager": "pnpm@9.15.4",
  "scripts": {
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "clean": "turbo run clean"
  },
  "devDependencies": {
    "turbo": "^2.4.0",
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 2: Create pnpm-workspace.yaml**

```yaml
packages:
  - "packages/*"
  - "examples/*"
```

- [ ] **Step 3: Create turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["build"]
    },
    "lint": {},
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "clean": {
      "cache": false
    }
  }
}
```

- [ ] **Step 4: Create .gitignore**

```
node_modules/
dist/
*.tsbuildinfo
.turbo/
coverage/
.DS_Store
```

- [ ] **Step 5: Create .npmrc**

```
auto-install-peers=true
strict-peer-dependencies=false
```

- [ ] **Step 6: Create packages/core/package.json**

```json
{
  "name": "low-cost-avatar",
  "version": "0.1.0",
  "description": "Client-side avatar rendering SDK — zero GPU cost, low latency",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "three": "^0.172.0"
  },
  "devDependencies": {
    "@types/three": "^0.172.0",
    "tsup": "^8.4.0",
    "typescript": "^5.7.0",
    "vitest": "^3.1.0",
    "eslint": "^9.20.0",
    "@eslint/js": "^9.20.0",
    "typescript-eslint": "^8.25.0"
  },
  "peerDependencies": {
    "three": ">=0.160.0"
  },
  "license": "MIT"
}
```

- [ ] **Step 7: Create packages/core/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

- [ ] **Step 8: Create packages/core/tsup.config.ts**

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
})
```

- [ ] **Step 9: Create placeholder entry point**

Create `packages/core/src/index.ts`:

```ts
export const VERSION = '0.1.0'
```

- [ ] **Step 10: Install dependencies and verify build**

Run: `cd /home/13843K/Desktop/low-cost-avatar && pnpm install && pnpm build`
Expected: Build succeeds, produces `packages/core/dist/index.js`, `index.cjs`, `index.d.ts`

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: initialize monorepo with pnpm workspaces, turborepo, and core package scaffold"
```

---

## Phase 2: Type Definitions

### Task 2: Define All Public Types

**Files:**
- Create: `packages/core/src/types/index.ts`
- Create: `packages/core/src/types/blendshapes.ts`
- Create: `packages/core/src/types/emotions.ts`

These types are the contract for the entire SDK. Every subsequent task imports from here.

- [ ] **Step 1: Create blendshapes.ts**

```ts
/** 52 ARKit blendshape names */
export const ARKIT_BLENDSHAPES = [
  'eyeBlinkLeft', 'eyeLookDownLeft', 'eyeLookInLeft', 'eyeLookOutLeft',
  'eyeLookUpLeft', 'eyeSquintLeft', 'eyeWideLeft',
  'eyeBlinkRight', 'eyeLookDownRight', 'eyeLookInRight', 'eyeLookOutRight',
  'eyeLookUpRight', 'eyeSquintRight', 'eyeWideRight',
  'jawForward', 'jawLeft', 'jawRight', 'jawOpen',
  'mouthClose', 'mouthFunnel', 'mouthPucker', 'mouthLeft', 'mouthRight',
  'mouthSmileLeft', 'mouthSmileRight', 'mouthFrownLeft', 'mouthFrownRight',
  'mouthDimpleLeft', 'mouthDimpleRight', 'mouthStretchLeft', 'mouthStretchRight',
  'mouthRollLower', 'mouthRollUpper', 'mouthShrugLower', 'mouthShrugUpper',
  'mouthPressLeft', 'mouthPressRight', 'mouthLowerDownLeft', 'mouthLowerDownRight',
  'mouthUpperUpLeft', 'mouthUpperUpRight',
  'browDownLeft', 'browDownRight', 'browInnerUp', 'browOuterUpLeft', 'browOuterUpRight',
  'cheekPuff', 'cheekSquintLeft', 'cheekSquintRight',
  'noseSneerLeft', 'noseSneerRight',
  'tongueOut',
] as const

export type ARKitBlendshapeName = typeof ARKIT_BLENDSHAPES[number]

/** 15 Oculus viseme names */
export const OCULUS_VISEMES = [
  'viseme_sil', 'viseme_PP', 'viseme_FF', 'viseme_TH', 'viseme_DD',
  'viseme_kk', 'viseme_CH', 'viseme_SS', 'viseme_nn', 'viseme_RR',
  'viseme_aa', 'viseme_E', 'viseme_I', 'viseme_O', 'viseme_U',
] as const

export type OculusVisemeName = typeof OCULUS_VISEMES[number]

export type BlendshapeName = ARKitBlendshapeName | OculusVisemeName

/** Map of blendshape name to weight (0.0 - 1.0) */
export type BlendshapeMap = Partial<Record<BlendshapeName, number>>

/** Blendshape names that control the mouth region (lip-sync priority) */
export const MOUTH_BLENDSHAPES: readonly BlendshapeName[] = [
  'jawForward', 'jawLeft', 'jawRight', 'jawOpen',
  'mouthClose', 'mouthFunnel', 'mouthPucker', 'mouthLeft', 'mouthRight',
  'mouthSmileLeft', 'mouthSmileRight', 'mouthFrownLeft', 'mouthFrownRight',
  'mouthDimpleLeft', 'mouthDimpleRight', 'mouthStretchLeft', 'mouthStretchRight',
  'mouthRollLower', 'mouthRollUpper', 'mouthShrugLower', 'mouthShrugUpper',
  'mouthPressLeft', 'mouthPressRight', 'mouthLowerDownLeft', 'mouthLowerDownRight',
  'mouthUpperUpLeft', 'mouthUpperUpRight', 'tongueOut',
  'viseme_sil', 'viseme_PP', 'viseme_FF', 'viseme_TH', 'viseme_DD',
  'viseme_kk', 'viseme_CH', 'viseme_SS', 'viseme_nn', 'viseme_RR',
  'viseme_aa', 'viseme_E', 'viseme_I', 'viseme_O', 'viseme_U',
] as const

/** Blendshape names that control the eye region (emotion priority) */
export const EYE_BLENDSHAPES: readonly BlendshapeName[] = [
  'eyeBlinkLeft', 'eyeLookDownLeft', 'eyeLookInLeft', 'eyeLookOutLeft',
  'eyeLookUpLeft', 'eyeSquintLeft', 'eyeWideLeft',
  'eyeBlinkRight', 'eyeLookDownRight', 'eyeLookInRight', 'eyeLookOutRight',
  'eyeLookUpRight', 'eyeSquintRight', 'eyeWideRight',
] as const
```

- [ ] **Step 2: Create emotions.ts**

```ts
import type { BlendshapeMap } from './blendshapes.js'

export type EmotionName = 'neutral' | 'happy' | 'sad' | 'angry' | 'surprised' | 'thinking' | 'disgusted' | 'fearful'

export interface EmotionPreset {
  blendshapes: BlendshapeMap
  /** Multiplier for blink rate (1.0 = normal) */
  blinkRateMultiplier: number
  /** Head pitch offset in degrees */
  headPitchOffset: number
  /** Head yaw offset in degrees */
  headYawOffset: number
  /** Multiplier for breathing rate (1.0 = normal) */
  breathingRateMultiplier: number
}

export const EMOTION_PRESETS: Record<EmotionName, EmotionPreset> = {
  neutral: {
    blendshapes: {},
    blinkRateMultiplier: 1.0,
    headPitchOffset: 0,
    headYawOffset: 0,
    breathingRateMultiplier: 1.0,
  },
  happy: {
    blendshapes: {
      mouthSmileLeft: 0.7,
      mouthSmileRight: 0.7,
      cheekSquintLeft: 0.4,
      cheekSquintRight: 0.4,
      eyeSquintLeft: 0.2,
      eyeSquintRight: 0.2,
    },
    blinkRateMultiplier: 0.8,
    headPitchOffset: -3,
    headYawOffset: 0,
    breathingRateMultiplier: 1.1,
  },
  sad: {
    blendshapes: {
      mouthFrownLeft: 0.6,
      mouthFrownRight: 0.6,
      browInnerUp: 0.5,
      browDownLeft: 0.3,
      browDownRight: 0.3,
      eyeLookDownLeft: 0.3,
      eyeLookDownRight: 0.3,
    },
    blinkRateMultiplier: 1.4,
    headPitchOffset: 8,
    headYawOffset: 0,
    breathingRateMultiplier: 0.85,
  },
  angry: {
    blendshapes: {
      browDownLeft: 0.7,
      browDownRight: 0.7,
      eyeSquintLeft: 0.4,
      eyeSquintRight: 0.4,
      jawForward: 0.2,
      mouthPressLeft: 0.5,
      mouthPressRight: 0.5,
      noseSneerLeft: 0.5,
      noseSneerRight: 0.5,
    },
    blinkRateMultiplier: 0.6,
    headPitchOffset: -2,
    headYawOffset: 0,
    breathingRateMultiplier: 1.3,
  },
  surprised: {
    blendshapes: {
      eyeWideLeft: 0.8,
      eyeWideRight: 0.8,
      browInnerUp: 0.7,
      browOuterUpLeft: 0.7,
      browOuterUpRight: 0.7,
      jawOpen: 0.4,
      mouthFunnel: 0.3,
    },
    blinkRateMultiplier: 0.3,
    headPitchOffset: -5,
    headYawOffset: 0,
    breathingRateMultiplier: 1.2,
  },
  thinking: {
    blendshapes: {
      eyeLookUpLeft: 0.5,
      eyeLookInLeft: 0.3,
      eyeSquintLeft: 0.2,
      eyeSquintRight: 0.2,
      browInnerUp: 0.3,
      mouthPucker: 0.2,
    },
    blinkRateMultiplier: 0.7,
    headPitchOffset: -3,
    headYawOffset: -8,
    breathingRateMultiplier: 0.9,
  },
  disgusted: {
    blendshapes: {
      noseSneerLeft: 0.7,
      noseSneerRight: 0.7,
      mouthUpperUpLeft: 0.4,
      mouthUpperUpRight: 0.4,
      browDownLeft: 0.4,
      browDownRight: 0.4,
      eyeSquintLeft: 0.3,
      eyeSquintRight: 0.3,
    },
    blinkRateMultiplier: 0.9,
    headPitchOffset: 3,
    headYawOffset: -5,
    breathingRateMultiplier: 0.9,
  },
  fearful: {
    blendshapes: {
      eyeWideLeft: 0.7,
      eyeWideRight: 0.7,
      browInnerUp: 0.8,
      browOuterUpLeft: 0.5,
      browOuterUpRight: 0.5,
      mouthStretchLeft: 0.3,
      mouthStretchRight: 0.3,
      jawOpen: 0.2,
    },
    blinkRateMultiplier: 1.5,
    headPitchOffset: 2,
    headYawOffset: 0,
    breathingRateMultiplier: 1.4,
  },
}
```

- [ ] **Step 3: Create types/index.ts with all public types**

```ts
export type { ARKitBlendshapeName, OculusVisemeName, BlendshapeName, BlendshapeMap } from './blendshapes.js'
export { ARKIT_BLENDSHAPES, OCULUS_VISEMES, MOUTH_BLENDSHAPES, EYE_BLENDSHAPES } from './blendshapes.js'
export type { EmotionName, EmotionPreset } from './emotions.js'
export { EMOTION_PRESETS } from './emotions.js'

export type QualityTier = 'high' | 'medium' | 'low'

export interface AvatarOptions {
  /** DOM element to render into */
  container: HTMLElement
  /** Built-in avatar ID or URL to a custom GLB file */
  avatar: string
  /** Quality tier. 'auto' runs a benchmark to decide. Default: 'auto' */
  quality?: QualityTier | 'auto'
  /** Base URL where avatar assets are hosted */
  assetsBaseUrl?: string
  /** Enable IndexedDB caching. Default: true */
  cache?: boolean
}

export interface SpeakOptions {
  /** Emotion to apply during speech */
  emotion?: EmotionName
  /** Timed gestures during speech */
  gestures?: Array<{ time: number; name: string }>
}

export interface EmotionOptions {
  /** Emotion intensity from 0.0 to 1.0. Default: 1.0 */
  intensity?: number
  /** Crossfade transition duration in ms. Default: 300 */
  transition?: number
}

export interface TransitionOptions {
  /** Crossfade transition duration in ms. Default: 300 */
  transition?: number
}

export interface BoneRotation {
  pitch: number
  yaw: number
  roll: number
}

export type AvatarEventMap = {
  loaded: []
  speakStart: []
  speakEnd: []
  gestureComplete: [name: string]
  error: [error: Error]
  performanceWarning: [metrics: PerformanceMetrics]
}

export type AvatarEvent = keyof AvatarEventMap

export interface PerformanceMetrics {
  fps: number
  gpuMemoryMB: number
  jsHeapMB: number
  qualityTier: QualityTier
}

/** Priority weights for the BlendshapeMixer. Higher = wins conflicts. */
export interface MixerPriorities {
  lipSync: number
  emotion: number
  idle: number
  gesture: number
  direct: number
}

export const DEFAULT_MIXER_PRIORITIES: MixerPriorities = {
  lipSync: 1.0,
  emotion: 0.8,
  idle: 0.3,
  gesture: 0.6,
  direct: 1.0,
}

/** Asset manifest JSON structure */
export interface AssetManifest {
  version: string
  avatars: Record<string, AvatarManifestEntry>
  gestures: Record<string, GestureManifestEntry>
}

export interface AvatarManifestEntry {
  name: string
  variants: {
    high?: string
    medium?: string
    low?: string
  }
  thumbnail?: string
}

export interface GestureManifestEntry {
  url: string
  /** Size in bytes (for download progress) */
  size: number
}

/** Animation source channel — each system writes to one of these */
export type AnimationChannel = 'lipSync' | 'emotion' | 'idle' | 'gesture' | 'direct'
```

- [ ] **Step 4: Update packages/core/src/index.ts to re-export types**

```ts
export { VERSION } from './version.js'
export type {
  AvatarOptions, SpeakOptions, EmotionOptions, TransitionOptions,
  BoneRotation, AvatarEvent, AvatarEventMap, PerformanceMetrics,
  QualityTier, MixerPriorities, AssetManifest, AvatarManifestEntry,
  GestureManifestEntry, AnimationChannel,
  ARKitBlendshapeName, OculusVisemeName, BlendshapeName, BlendshapeMap,
  EmotionName, EmotionPreset,
} from './types/index.js'
export {
  ARKIT_BLENDSHAPES, OCULUS_VISEMES, MOUTH_BLENDSHAPES, EYE_BLENDSHAPES,
  EMOTION_PRESETS, DEFAULT_MIXER_PRIORITIES,
} from './types/index.js'
```

Create `packages/core/src/version.ts`:

```ts
export const VERSION = '0.1.0'
```

- [ ] **Step 5: Verify types compile**

Run: `cd packages/core && pnpm typecheck`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/types/ packages/core/src/index.ts packages/core/src/version.ts
git commit -m "feat: define all public types — blendshapes, emotions, SDK options, events"
```

---

## Phase 3: Core Engine Components

### Task 3: EventEmitter

**Files:**
- Create: `packages/core/src/EventEmitter.ts`
- Create: `packages/core/src/__tests__/EventEmitter.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from 'vitest'
import { EventEmitter } from '../EventEmitter.js'
import type { AvatarEventMap } from '../types/index.js'

describe('EventEmitter', () => {
  it('calls registered listener when event is emitted', () => {
    const emitter = new EventEmitter<AvatarEventMap>()
    const listener = vi.fn()
    emitter.on('loaded', listener)
    emitter.emit('loaded')
    expect(listener).toHaveBeenCalledOnce()
  })

  it('passes arguments to listeners', () => {
    const emitter = new EventEmitter<AvatarEventMap>()
    const listener = vi.fn()
    emitter.on('gestureComplete', listener)
    emitter.emit('gestureComplete', 'wave')
    expect(listener).toHaveBeenCalledWith('wave')
  })

  it('removes listener with off()', () => {
    const emitter = new EventEmitter<AvatarEventMap>()
    const listener = vi.fn()
    emitter.on('loaded', listener)
    emitter.off('loaded', listener)
    emitter.emit('loaded')
    expect(listener).not.toHaveBeenCalled()
  })

  it('supports multiple listeners per event', () => {
    const emitter = new EventEmitter<AvatarEventMap>()
    const a = vi.fn()
    const b = vi.fn()
    emitter.on('speakStart', a)
    emitter.on('speakStart', b)
    emitter.emit('speakStart')
    expect(a).toHaveBeenCalledOnce()
    expect(b).toHaveBeenCalledOnce()
  })

  it('removeAllListeners clears everything', () => {
    const emitter = new EventEmitter<AvatarEventMap>()
    const listener = vi.fn()
    emitter.on('loaded', listener)
    emitter.on('speakEnd', listener)
    emitter.removeAllListeners()
    emitter.emit('loaded')
    emitter.emit('speakEnd')
    expect(listener).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm test -- EventEmitter`
Expected: FAIL — module not found

- [ ] **Step 3: Implement EventEmitter**

```ts
export class EventEmitter<TEventMap extends Record<string, unknown[]>> {
  private listeners = new Map<keyof TEventMap, Set<(...args: unknown[]) => void>>()

  on<K extends keyof TEventMap>(event: K, listener: (...args: TEventMap[K]) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(listener as (...args: unknown[]) => void)
  }

  off<K extends keyof TEventMap>(event: K, listener: (...args: TEventMap[K]) => void): void {
    this.listeners.get(event)?.delete(listener as (...args: unknown[]) => void)
  }

  emit<K extends keyof TEventMap>(event: K, ...args: TEventMap[K]): void {
    this.listeners.get(event)?.forEach((listener) => {
      try {
        listener(...args)
      } catch (err) {
        console.error(`Error in ${String(event)} listener:`, err)
      }
    })
  }

  removeAllListeners(): void {
    this.listeners.clear()
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && pnpm test -- EventEmitter`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/EventEmitter.ts packages/core/src/__tests__/EventEmitter.test.ts
git commit -m "feat: add typed EventEmitter for SDK events"
```

---

### Task 4: BlendshapeMixer

**Files:**
- Create: `packages/core/src/animation/BlendshapeMixer.ts`
- Create: `packages/core/src/__tests__/BlendshapeMixer.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest'
import { BlendshapeMixer } from '../animation/BlendshapeMixer.js'
import { DEFAULT_MIXER_PRIORITIES } from '../types/index.js'

describe('BlendshapeMixer', () => {
  it('returns empty map when no channels have data', () => {
    const mixer = new BlendshapeMixer(DEFAULT_MIXER_PRIORITIES)
    const result = mixer.mix()
    expect(Object.keys(result)).toHaveLength(0)
  })

  it('returns single channel values scaled by priority', () => {
    const mixer = new BlendshapeMixer(DEFAULT_MIXER_PRIORITIES)
    mixer.setChannel('idle', { eyeBlinkLeft: 1.0 })
    const result = mixer.mix()
    expect(result.eyeBlinkLeft).toBeCloseTo(0.3) // idle priority = 0.3
  })

  it('lip-sync priority overrides idle for mouth blendshapes', () => {
    const mixer = new BlendshapeMixer(DEFAULT_MIXER_PRIORITIES)
    mixer.setChannel('idle', { jawOpen: 0.1 })
    mixer.setChannel('lipSync', { jawOpen: 0.8 })
    const result = mixer.mix()
    // lipSync(0.8 * 1.0) + idle(0.1 * 0.3) = 0.83, clamped to 1.0
    expect(result.jawOpen).toBeCloseTo(0.83)
  })

  it('clamps values to 0.0 - 1.0 range', () => {
    const mixer = new BlendshapeMixer(DEFAULT_MIXER_PRIORITIES)
    mixer.setChannel('lipSync', { jawOpen: 0.9 })
    mixer.setChannel('direct', { jawOpen: 0.5 })
    const result = mixer.mix()
    expect(result.jawOpen).toBeLessThanOrEqual(1.0)
    expect(result.jawOpen).toBeGreaterThanOrEqual(0.0)
  })

  it('clearChannel removes channel data', () => {
    const mixer = new BlendshapeMixer(DEFAULT_MIXER_PRIORITIES)
    mixer.setChannel('emotion', { mouthSmileLeft: 0.7 })
    mixer.clearChannel('emotion')
    const result = mixer.mix()
    expect(result.mouthSmileLeft).toBeUndefined()
  })

  it('clearAll removes all channel data', () => {
    const mixer = new BlendshapeMixer(DEFAULT_MIXER_PRIORITIES)
    mixer.setChannel('idle', { eyeBlinkLeft: 1.0 })
    mixer.setChannel('emotion', { mouthSmileLeft: 0.5 })
    mixer.clearAll()
    const result = mixer.mix()
    expect(Object.keys(result)).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm test -- BlendshapeMixer`
Expected: FAIL — module not found

- [ ] **Step 3: Implement BlendshapeMixer**

```ts
import type { AnimationChannel, BlendshapeMap, BlendshapeName, MixerPriorities } from '../types/index.js'

export class BlendshapeMixer {
  private channels = new Map<AnimationChannel, BlendshapeMap>()

  constructor(private priorities: MixerPriorities) {}

  setChannel(channel: AnimationChannel, values: BlendshapeMap): void {
    this.channels.set(channel, values)
  }

  clearChannel(channel: AnimationChannel): void {
    this.channels.delete(channel)
  }

  clearAll(): void {
    this.channels.clear()
  }

  mix(): BlendshapeMap {
    const result: BlendshapeMap = {}
    const allKeys = new Set<BlendshapeName>()

    for (const values of this.channels.values()) {
      for (const key of Object.keys(values) as BlendshapeName[]) {
        allKeys.add(key)
      }
    }

    for (const key of allKeys) {
      let total = 0
      for (const [channel, values] of this.channels) {
        const value = values[key]
        if (value !== undefined) {
          const priority = this.priorities[channel]
          total += value * priority
        }
      }
      result[key] = Math.min(1.0, Math.max(0.0, total))
    }

    return result
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && pnpm test -- BlendshapeMixer`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/animation/BlendshapeMixer.ts packages/core/src/__tests__/BlendshapeMixer.test.ts
git commit -m "feat: add BlendshapeMixer — combines animation channels with priority weights"
```

---

### Task 5: IdleSystem

**Files:**
- Create: `packages/core/src/animation/IdleSystem.ts`
- Create: `packages/core/src/__tests__/IdleSystem.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { IdleSystem } from '../animation/IdleSystem.js'

describe('IdleSystem', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns blendshape values when updated', () => {
    const idle = new IdleSystem()
    idle.start()
    const result = idle.update(0.016) // 1 frame at 60fps
    expect(result).toBeDefined()
    expect(typeof result).toBe('object')
  })

  it('produces blink values that go from 0 to 1 and back', () => {
    const idle = new IdleSystem()
    idle.start()
    // Run updates for several seconds to trigger a blink
    let sawBlink = false
    for (let t = 0; t < 10; t += 0.016) {
      const result = idle.update(0.016)
      if (result.eyeBlinkLeft !== undefined && result.eyeBlinkLeft > 0.5) {
        sawBlink = true
        break
      }
    }
    expect(sawBlink).toBe(true)
  })

  it('produces breathing values (jawOpen or chest-related)', () => {
    const idle = new IdleSystem()
    idle.start()
    // Breathing is continuous — should always have some value
    const result = idle.update(0.5) // half second in
    // Breathing affects jawOpen subtly
    expect(result).toBeDefined()
  })

  it('stop() halts updates', () => {
    const idle = new IdleSystem()
    idle.start()
    idle.stop()
    const result = idle.update(0.016)
    expect(Object.keys(result)).toHaveLength(0)
  })

  it('respects blinkRateMultiplier', () => {
    const idle = new IdleSystem()
    idle.start()
    idle.setBlinkRateMultiplier(0.0) // disable blinks
    let sawBlink = false
    for (let t = 0; t < 20; t += 0.016) {
      const result = idle.update(0.016)
      if (result.eyeBlinkLeft !== undefined && result.eyeBlinkLeft > 0.5) {
        sawBlink = true
        break
      }
    }
    expect(sawBlink).toBe(false)
  })

  it('respects breathingRateMultiplier', () => {
    const idle = new IdleSystem()
    idle.start()
    idle.setBreathingRateMultiplier(2.0)
    // Just ensure it doesn't crash and produces output
    const result = idle.update(1.0)
    expect(result).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm test -- IdleSystem`
Expected: FAIL — module not found

- [ ] **Step 3: Implement IdleSystem**

```ts
import type { BlendshapeMap } from '../types/index.js'

export class IdleSystem {
  private running = false
  private elapsed = 0
  private nextBlinkTime = 0
  private blinkPhase = -1 // -1 = not blinking, 0..1 = blink progress
  private blinkDuration = 0.15 // seconds for a full blink
  private blinkRateMultiplier = 1.0
  private breathingRateMultiplier = 1.0
  private baseBreathingRate = 14 / 60 // 14 cycles per minute in Hz

  start(): void {
    this.running = true
    this.elapsed = 0
    this.scheduleNextBlink()
  }

  stop(): void {
    this.running = false
  }

  setBlinkRateMultiplier(multiplier: number): void {
    this.blinkRateMultiplier = multiplier
  }

  setBreathingRateMultiplier(multiplier: number): void {
    this.breathingRateMultiplier = multiplier
  }

  update(deltaTime: number): BlendshapeMap {
    if (!this.running) return {}

    this.elapsed += deltaTime
    const result: BlendshapeMap = {}

    // --- Blinks ---
    this.updateBlink(deltaTime, result)

    // --- Breathing ---
    const breathFreq = this.baseBreathingRate * this.breathingRateMultiplier
    const breathVal = (Math.sin(this.elapsed * breathFreq * Math.PI * 2) + 1) * 0.5
    result.jawOpen = (result.jawOpen ?? 0) + breathVal * 0.02 // very subtle

    // --- Micro-saccades (tiny eye movements) ---
    const saccadeX = Math.sin(this.elapsed * 0.7) * 0.03 + Math.sin(this.elapsed * 1.3) * 0.02
    const saccadeY = Math.cos(this.elapsed * 0.9) * 0.03 + Math.cos(this.elapsed * 1.1) * 0.02
    if (saccadeX > 0) {
      result.eyeLookOutLeft = Math.abs(saccadeX)
      result.eyeLookInRight = Math.abs(saccadeX)
    } else {
      result.eyeLookInLeft = Math.abs(saccadeX)
      result.eyeLookOutRight = Math.abs(saccadeX)
    }
    if (saccadeY > 0) {
      result.eyeLookUpLeft = Math.abs(saccadeY)
      result.eyeLookUpRight = Math.abs(saccadeY)
    } else {
      result.eyeLookDownLeft = Math.abs(saccadeY)
      result.eyeLookDownRight = Math.abs(saccadeY)
    }

    // --- Head micro-drift (perlin-like via combined sines) ---
    // Exposed as metadata, applied by SceneManager to head bone
    // Not a blendshape, so we skip it here. SceneManager queries getHeadDrift().

    return result
  }

  getHeadDrift(): { pitch: number; yaw: number; roll: number } {
    const pitch = Math.sin(this.elapsed * 0.3) * 0.5 + Math.sin(this.elapsed * 0.7) * 0.3
    const yaw = Math.sin(this.elapsed * 0.2) * 0.4 + Math.cos(this.elapsed * 0.5) * 0.3
    const roll = Math.sin(this.elapsed * 0.15) * 0.15
    return { pitch, yaw, roll }
  }

  private updateBlink(deltaTime: number, result: BlendshapeMap): void {
    if (this.blinkPhase >= 0) {
      // Currently blinking
      this.blinkPhase += deltaTime / this.blinkDuration
      if (this.blinkPhase >= 1) {
        this.blinkPhase = -1
        this.scheduleNextBlink()
      } else {
        // Blink curve: fast close (0-0.3), hold (0.3-0.5), slow open (0.5-1.0)
        let blinkWeight: number
        if (this.blinkPhase < 0.3) {
          blinkWeight = this.blinkPhase / 0.3
        } else if (this.blinkPhase < 0.5) {
          blinkWeight = 1.0
        } else {
          blinkWeight = 1.0 - (this.blinkPhase - 0.5) / 0.5
        }
        result.eyeBlinkLeft = blinkWeight
        result.eyeBlinkRight = blinkWeight
      }
    } else if (this.elapsed >= this.nextBlinkTime && this.blinkRateMultiplier > 0) {
      // Trigger blink
      this.blinkPhase = 0
    }
  }

  private scheduleNextBlink(): void {
    if (this.blinkRateMultiplier <= 0) {
      this.nextBlinkTime = Infinity
      return
    }
    // Random interval 2-6 seconds, scaled by multiplier
    const baseInterval = 2 + Math.random() * 4
    this.nextBlinkTime = this.elapsed + baseInterval / this.blinkRateMultiplier
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && pnpm test -- IdleSystem`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/animation/IdleSystem.ts packages/core/src/__tests__/IdleSystem.test.ts
git commit -m "feat: add IdleSystem — procedural blinks, breathing, micro-saccades"
```

---

### Task 6: EmotionSystem

**Files:**
- Create: `packages/core/src/animation/EmotionSystem.ts`
- Create: `packages/core/src/__tests__/EmotionSystem.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest'
import { EmotionSystem } from '../animation/EmotionSystem.js'

describe('EmotionSystem', () => {
  it('returns empty blendshapes when no emotion is set', () => {
    const system = new EmotionSystem()
    const result = system.update(0.016)
    expect(Object.keys(result)).toHaveLength(0)
  })

  it('returns target blendshapes immediately when transition is 0', () => {
    const system = new EmotionSystem()
    system.setEmotion('happy', { intensity: 1.0, transition: 0 })
    const result = system.update(0.016)
    expect(result.mouthSmileLeft).toBeCloseTo(0.7)
    expect(result.mouthSmileRight).toBeCloseTo(0.7)
  })

  it('scales blendshapes by intensity', () => {
    const system = new EmotionSystem()
    system.setEmotion('happy', { intensity: 0.5, transition: 0 })
    const result = system.update(0.016)
    expect(result.mouthSmileLeft).toBeCloseTo(0.35)
  })

  it('transitions smoothly over time', () => {
    const system = new EmotionSystem()
    system.setEmotion('happy', { intensity: 1.0, transition: 1000 })
    // After 500ms (half transition), values should be roughly half
    const result = system.update(0.5)
    expect(result.mouthSmileLeft).toBeGreaterThan(0.1)
    expect(result.mouthSmileLeft).toBeLessThan(0.6)
  })

  it('clears emotion with transition', () => {
    const system = new EmotionSystem()
    system.setEmotion('happy', { intensity: 1.0, transition: 0 })
    system.update(0.016) // apply
    system.clearEmotion({ transition: 0 })
    const result = system.update(0.016)
    expect(result.mouthSmileLeft).toBeUndefined()
  })

  it('exposes current emotion modifiers', () => {
    const system = new EmotionSystem()
    system.setEmotion('sad', { intensity: 1.0, transition: 0 })
    system.update(0.016)
    const mods = system.getCurrentModifiers()
    expect(mods.blinkRateMultiplier).toBeCloseTo(1.4)
    expect(mods.headPitchOffset).toBeCloseTo(8)
    expect(mods.breathingRateMultiplier).toBeCloseTo(0.85)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm test -- EmotionSystem`
Expected: FAIL — module not found

- [ ] **Step 3: Implement EmotionSystem**

```ts
import type { BlendshapeMap, BlendshapeName, EmotionName, EmotionOptions, TransitionOptions } from '../types/index.js'
import { EMOTION_PRESETS } from '../types/index.js'

interface EmotionModifiers {
  blinkRateMultiplier: number
  headPitchOffset: number
  headYawOffset: number
  breathingRateMultiplier: number
}

const NEUTRAL_MODIFIERS: EmotionModifiers = {
  blinkRateMultiplier: 1.0,
  headPitchOffset: 0,
  headYawOffset: 0,
  breathingRateMultiplier: 1.0,
}

export class EmotionSystem {
  private currentBlendshapes: BlendshapeMap = {}
  private targetBlendshapes: BlendshapeMap = {}
  private currentModifiers: EmotionModifiers = { ...NEUTRAL_MODIFIERS }
  private targetModifiers: EmotionModifiers = { ...NEUTRAL_MODIFIERS }
  private transitionDuration = 0
  private transitionElapsed = 0
  private transitioning = false
  private prevBlendshapes: BlendshapeMap = {}
  private prevModifiers: EmotionModifiers = { ...NEUTRAL_MODIFIERS }

  setEmotion(emotion: EmotionName, options: EmotionOptions = {}): void {
    const { intensity = 1.0, transition = 300 } = options
    const preset = EMOTION_PRESETS[emotion]

    this.prevBlendshapes = { ...this.currentBlendshapes }
    this.prevModifiers = { ...this.currentModifiers }

    this.targetBlendshapes = {}
    for (const [key, value] of Object.entries(preset.blendshapes)) {
      this.targetBlendshapes[key as BlendshapeName] = (value as number) * intensity
    }

    this.targetModifiers = {
      blinkRateMultiplier: lerp(1.0, preset.blinkRateMultiplier, intensity),
      headPitchOffset: preset.headPitchOffset * intensity,
      headYawOffset: preset.headYawOffset * intensity,
      breathingRateMultiplier: lerp(1.0, preset.breathingRateMultiplier, intensity),
    }

    this.transitionDuration = transition / 1000 // convert ms to seconds
    this.transitionElapsed = 0
    this.transitioning = this.transitionDuration > 0
    if (!this.transitioning) {
      this.currentBlendshapes = { ...this.targetBlendshapes }
      this.currentModifiers = { ...this.targetModifiers }
    }
  }

  clearEmotion(options: TransitionOptions = {}): void {
    this.setEmotion('neutral', { intensity: 1.0, transition: options.transition ?? 300 })
  }

  update(deltaTime: number): BlendshapeMap {
    if (!this.transitioning) {
      return { ...this.currentBlendshapes }
    }

    this.transitionElapsed += deltaTime
    const t = Math.min(1.0, this.transitionElapsed / this.transitionDuration)
    const eased = smoothstep(t)

    // Lerp blendshapes
    const allKeys = new Set<BlendshapeName>([
      ...Object.keys(this.prevBlendshapes) as BlendshapeName[],
      ...Object.keys(this.targetBlendshapes) as BlendshapeName[],
    ])

    this.currentBlendshapes = {}
    for (const key of allKeys) {
      const from = this.prevBlendshapes[key] ?? 0
      const to = this.targetBlendshapes[key] ?? 0
      const val = lerp(from, to, eased)
      if (val > 0.001) {
        this.currentBlendshapes[key] = val
      }
    }

    // Lerp modifiers
    this.currentModifiers = {
      blinkRateMultiplier: lerp(this.prevModifiers.blinkRateMultiplier, this.targetModifiers.blinkRateMultiplier, eased),
      headPitchOffset: lerp(this.prevModifiers.headPitchOffset, this.targetModifiers.headPitchOffset, eased),
      headYawOffset: lerp(this.prevModifiers.headYawOffset, this.targetModifiers.headYawOffset, eased),
      breathingRateMultiplier: lerp(this.prevModifiers.breathingRateMultiplier, this.targetModifiers.breathingRateMultiplier, eased),
    }

    if (t >= 1.0) {
      this.transitioning = false
    }

    return { ...this.currentBlendshapes }
  }

  getCurrentModifiers(): EmotionModifiers {
    return { ...this.currentModifiers }
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && pnpm test -- EmotionSystem`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/animation/EmotionSystem.ts packages/core/src/__tests__/EmotionSystem.test.ts
git commit -m "feat: add EmotionSystem — preset emotions with smooth crossfade transitions"
```

---

### Task 7: LipSyncEngine

**Files:**
- Create: `packages/core/src/animation/LipSyncEngine.ts`
- Create: `packages/core/src/audio/AudioAnalyzer.ts`
- Create: `packages/core/src/audio/viseme-worklet.ts`
- Create: `packages/core/src/__tests__/LipSyncEngine.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect, vi } from 'vitest'
import { LipSyncEngine } from '../animation/LipSyncEngine.js'

// Mock AudioContext for Node.js test environment
const mockAnalyserNode = {
  fftSize: 256,
  frequencyBinCount: 128,
  getByteFrequencyData: vi.fn((array: Uint8Array) => {
    // Simulate audio data with energy in speech frequencies
    for (let i = 0; i < array.length; i++) {
      array[i] = i < 30 ? 150 : 10 // energy in low-mid frequencies
    }
  }),
  connect: vi.fn(),
  disconnect: vi.fn(),
}

const mockAudioContext = {
  createAnalyser: vi.fn(() => mockAnalyserNode),
  createMediaStreamSource: vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn() })),
  createBufferSource: vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    buffer: null,
    onended: null,
  })),
  destination: {},
  sampleRate: 44100,
  state: 'running' as const,
  close: vi.fn(),
} as unknown as AudioContext

describe('LipSyncEngine', () => {
  it('creates with audio context', () => {
    const engine = new LipSyncEngine(mockAudioContext)
    expect(engine).toBeDefined()
  })

  it('returns viseme weights from frequency analysis', () => {
    const engine = new LipSyncEngine(mockAudioContext)
    engine.connectAnalyser(mockAnalyserNode as unknown as AnalyserNode)
    const result = engine.update()
    // Should produce some viseme output given the mock frequency data
    expect(result).toBeDefined()
    expect(typeof result).toBe('object')
  })

  it('returns silence viseme when no audio energy', () => {
    const silentAnalyser = {
      ...mockAnalyserNode,
      getByteFrequencyData: vi.fn((array: Uint8Array) => {
        array.fill(0)
      }),
    }
    const engine = new LipSyncEngine(mockAudioContext)
    engine.connectAnalyser(silentAnalyser as unknown as AnalyserNode)
    const result = engine.update()
    // When silent, viseme_sil should dominate or all weights should be ~0
    const totalWeight = Object.values(result).reduce((sum, v) => sum + (v ?? 0), 0)
    expect(totalWeight).toBeLessThan(0.5)
  })

  it('smooths transitions between visemes', () => {
    const engine = new LipSyncEngine(mockAudioContext)
    engine.connectAnalyser(mockAnalyserNode as unknown as AnalyserNode)
    const result1 = engine.update()
    const result2 = engine.update()
    // Both should exist — smoothing means values don't jump discontinuously
    expect(result1).toBeDefined()
    expect(result2).toBeDefined()
  })

  it('reset() clears state', () => {
    const engine = new LipSyncEngine(mockAudioContext)
    engine.connectAnalyser(mockAnalyserNode as unknown as AnalyserNode)
    engine.update()
    engine.reset()
    const result = engine.update()
    // After reset, should start fresh
    expect(result).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm test -- LipSyncEngine`
Expected: FAIL — module not found

- [ ] **Step 3: Implement LipSyncEngine**

```ts
import type { BlendshapeMap, OculusVisemeName } from '../types/index.js'
import { OCULUS_VISEMES } from '../types/index.js'

/**
 * Maps frequency band energy levels to Oculus viseme weights.
 * Uses a simplified frequency-to-viseme mapping based on formant frequencies.
 *
 * Band layout (assuming 256 FFT bins, 44100Hz sample rate):
 *   Each bin = ~172Hz
 *   Bands 0-3:   0-690Hz    (F1 region — vowel height)
 *   Bands 4-8:   690-1550Hz (F1-F2 transition)
 *   Bands 8-15:  1380-2580Hz (F2 region — vowel frontness)
 *   Bands 15-25: 2580-4300Hz (F3 region — consonants)
 *   Bands 25-40: 4300-6900Hz (high frequency — sibilants)
 */

// Viseme mapping: each viseme has energy profile across 5 frequency bands
const VISEME_PROFILES: Record<OculusVisemeName, [number, number, number, number, number]> = {
  viseme_sil: [0, 0, 0, 0, 0],
  viseme_PP:  [0.3, 0.1, 0.1, 0.1, 0.0], // bilabial
  viseme_FF:  [0.1, 0.1, 0.1, 0.3, 0.5], // labiodental fricative
  viseme_TH:  [0.1, 0.1, 0.1, 0.4, 0.4], // dental fricative
  viseme_DD:  [0.4, 0.3, 0.2, 0.3, 0.1], // alveolar stop
  viseme_kk:  [0.3, 0.2, 0.1, 0.4, 0.2], // velar stop
  viseme_CH:  [0.1, 0.1, 0.1, 0.5, 0.6], // postalveolar
  viseme_SS:  [0.0, 0.0, 0.1, 0.4, 0.8], // alveolar sibilant
  viseme_nn:  [0.5, 0.3, 0.2, 0.1, 0.0], // nasal
  viseme_RR:  [0.5, 0.4, 0.3, 0.2, 0.1], // approximant
  viseme_aa:  [0.9, 0.5, 0.2, 0.1, 0.0], // open vowel
  viseme_E:   [0.6, 0.7, 0.5, 0.1, 0.0], // front mid vowel
  viseme_I:   [0.3, 0.3, 0.8, 0.2, 0.0], // front close vowel
  viseme_O:   [0.8, 0.3, 0.1, 0.1, 0.0], // back rounded vowel
  viseme_U:   [0.7, 0.2, 0.1, 0.1, 0.0], // close back vowel
}

const SMOOTHING = 0.3 // lower = smoother transitions
const SILENCE_THRESHOLD = 15 // byte value below which we consider silence

export class LipSyncEngine {
  private analyser: AnalyserNode | null = null
  private frequencyData: Uint8Array = new Uint8Array(0)
  private prevWeights: Map<OculusVisemeName, number> = new Map()

  constructor(private audioContext: AudioContext) {
    for (const v of OCULUS_VISEMES) {
      this.prevWeights.set(v, 0)
    }
  }

  connectAnalyser(analyser: AnalyserNode): void {
    this.analyser = analyser
    this.analyser.fftSize = 256
    this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount)
  }

  update(): BlendshapeMap {
    if (!this.analyser) return {}

    this.analyser.getByteFrequencyData(this.frequencyData)

    // Compute energy in 5 frequency bands
    const bands = this.computeBands()
    const totalEnergy = bands.reduce((a, b) => a + b, 0)

    if (totalEnergy < SILENCE_THRESHOLD) {
      // Fade all visemes toward zero
      const result: BlendshapeMap = {}
      for (const viseme of OCULUS_VISEMES) {
        const prev = this.prevWeights.get(viseme) ?? 0
        const smoothed = prev * (1 - SMOOTHING)
        this.prevWeights.set(viseme, smoothed)
        if (smoothed > 0.01) {
          result[viseme] = smoothed
        }
      }
      return result
    }

    // Normalize bands to 0-1
    const maxBand = Math.max(...bands, 1)
    const normBands = bands.map((b) => b / maxBand) as [number, number, number, number, number]

    // Score each viseme by dot product with its profile
    const scores = new Map<OculusVisemeName, number>()
    let maxScore = 0
    for (const viseme of OCULUS_VISEMES) {
      if (viseme === 'viseme_sil') continue
      const profile = VISEME_PROFILES[viseme]
      let score = 0
      for (let i = 0; i < 5; i++) {
        score += normBands[i] * profile[i]
      }
      scores.set(viseme, score)
      if (score > maxScore) maxScore = score
    }

    // Normalize scores and apply smoothing
    const result: BlendshapeMap = {}
    for (const viseme of OCULUS_VISEMES) {
      if (viseme === 'viseme_sil') continue
      const raw = (scores.get(viseme) ?? 0) / (maxScore || 1)
      // Only keep top visemes (threshold at 0.5 of max)
      const thresholded = raw > 0.5 ? (raw - 0.5) * 2 : 0
      const prev = this.prevWeights.get(viseme) ?? 0
      const smoothed = prev * (1 - SMOOTHING) + thresholded * SMOOTHING
      this.prevWeights.set(viseme, smoothed)
      if (smoothed > 0.01) {
        result[viseme] = smoothed
      }
    }

    return result
  }

  reset(): void {
    for (const v of OCULUS_VISEMES) {
      this.prevWeights.set(v, 0)
    }
  }

  private computeBands(): [number, number, number, number, number] {
    const data = this.frequencyData
    const len = data.length

    const bandRanges: [number, number][] = [
      [0, Math.floor(len * 0.05)],    // 0-~350Hz
      [Math.floor(len * 0.05), Math.floor(len * 0.12)], // ~350-1000Hz
      [Math.floor(len * 0.12), Math.floor(len * 0.23)], // ~1000-2000Hz
      [Math.floor(len * 0.23), Math.floor(len * 0.38)], // ~2000-3300Hz
      [Math.floor(len * 0.38), Math.floor(len * 0.6)],  // ~3300-5200Hz
    ]

    return bandRanges.map(([start, end]) => {
      let sum = 0
      const count = Math.max(1, end - start)
      for (let i = start; i < end && i < len; i++) {
        sum += data[i]!
      }
      return sum / count
    }) as [number, number, number, number, number]
  }
}
```

- [ ] **Step 4: Implement AudioAnalyzer**

```ts
export class AudioAnalyzer {
  private audioContext: AudioContext
  private analyser: AnalyserNode
  private sourceNode: AudioBufferSourceNode | null = null

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext
    this.analyser = audioContext.createAnalyser()
    this.analyser.fftSize = 256
    this.analyser.smoothingTimeConstant = 0.5
  }

  getAnalyser(): AnalyserNode {
    return this.analyser
  }

  getAudioContext(): AudioContext {
    return this.audioContext
  }

  playBuffer(buffer: AudioBuffer, onEnded?: () => void): AudioBufferSourceNode {
    this.stop()
    this.sourceNode = this.audioContext.createBufferSource()
    this.sourceNode.buffer = buffer
    this.sourceNode.connect(this.analyser)
    this.analyser.connect(this.audioContext.destination)
    if (onEnded) {
      this.sourceNode.onended = onEnded
    }
    this.sourceNode.start()
    return this.sourceNode
  }

  stop(): void {
    if (this.sourceNode) {
      try {
        this.sourceNode.stop()
        this.sourceNode.disconnect()
      } catch {
        // Already stopped
      }
      this.sourceNode = null
    }
  }

  dispose(): void {
    this.stop()
    this.analyser.disconnect()
  }
}
```

- [ ] **Step 5: Create viseme-worklet.ts placeholder**

```ts
/**
 * AudioWorklet processor for real-time MFCC-based viseme extraction.
 *
 * This is a placeholder for the advanced audio worklet pipeline.
 * The current LipSyncEngine uses AnalyserNode FFT directly, which is
 * sufficient for v0.1. The worklet approach would offer lower latency
 * (~5ms vs ~20ms) and more accurate MFCC-based viseme classification.
 *
 * TODO(v0.2): Implement MFCC extraction in AudioWorklet for improved
 * lip-sync accuracy and lower latency.
 */
export const VISEME_WORKLET_AVAILABLE = false
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd packages/core && pnpm test -- LipSyncEngine`
Expected: All 5 tests PASS

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/animation/LipSyncEngine.ts packages/core/src/audio/AudioAnalyzer.ts packages/core/src/audio/viseme-worklet.ts packages/core/src/__tests__/LipSyncEngine.test.ts
git commit -m "feat: add LipSyncEngine and AudioAnalyzer — frequency-to-viseme lip-sync pipeline"
```

---

### Task 8: GesturePlayer

**Files:**
- Create: `packages/core/src/animation/GesturePlayer.ts`
- Create: `packages/core/src/__tests__/GesturePlayer.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect, vi } from 'vitest'
import { GesturePlayer } from '../animation/GesturePlayer.js'
import * as THREE from 'three'

describe('GesturePlayer', () => {
  function createMockMixer() {
    const mixer = new THREE.AnimationMixer(new THREE.Object3D())
    return mixer
  }

  it('creates without error', () => {
    const player = new GesturePlayer()
    expect(player).toBeDefined()
  })

  it('registers a clip by name', () => {
    const player = new GesturePlayer()
    const clip = new THREE.AnimationClip('nod', 1.0, [])
    player.registerClip('nod', clip)
    expect(player.hasClip('nod')).toBe(true)
  })

  it('hasClip returns false for unregistered names', () => {
    const player = new GesturePlayer()
    expect(player.hasClip('unknown')).toBe(false)
  })

  it('play returns false for unregistered clip', () => {
    const mixer = createMockMixer()
    const player = new GesturePlayer()
    player.setMixer(mixer)
    const result = player.play('unknown')
    expect(result).toBe(false)
  })

  it('play returns true for registered clip', () => {
    const mixer = createMockMixer()
    const player = new GesturePlayer()
    player.setMixer(mixer)
    const clip = new THREE.AnimationClip('wave', 1.5, [])
    player.registerClip('wave', clip)
    const result = player.play('wave')
    expect(result).toBe(true)
  })

  it('stop does not throw when nothing is playing', () => {
    const player = new GesturePlayer()
    expect(() => player.stop()).not.toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm test -- GesturePlayer`
Expected: FAIL — module not found

- [ ] **Step 3: Implement GesturePlayer**

```ts
import * as THREE from 'three'

export class GesturePlayer {
  private clips = new Map<string, THREE.AnimationClip>()
  private mixer: THREE.AnimationMixer | null = null
  private currentAction: THREE.AnimationAction | null = null
  private onCompleteCallback: ((name: string) => void) | null = null

  setMixer(mixer: THREE.AnimationMixer): void {
    this.mixer = mixer
  }

  registerClip(name: string, clip: THREE.AnimationClip): void {
    this.clips.set(name, clip)
  }

  hasClip(name: string): boolean {
    return this.clips.has(name)
  }

  play(name: string, crossfadeDuration = 0.3): boolean {
    if (!this.mixer) return false
    const clip = this.clips.get(name)
    if (!clip) return false

    const action = this.mixer.clipAction(clip)
    action.clampWhenFinished = true
    action.loop = THREE.LoopOnce

    if (this.currentAction) {
      action.crossFadeFrom(this.currentAction, crossfadeDuration, true)
    }

    action.reset().play()

    const onFinished = (e: { action: THREE.AnimationAction }) => {
      if (e.action === action) {
        this.mixer?.removeEventListener('finished', onFinished)
        this.currentAction = null
        this.onCompleteCallback?.(name)
      }
    }
    this.mixer.addEventListener('finished', onFinished)

    this.currentAction = action
    return true
  }

  stop(crossfadeDuration = 0.2): void {
    if (this.currentAction) {
      this.currentAction.fadeOut(crossfadeDuration)
      this.currentAction = null
    }
  }

  onComplete(callback: (name: string) => void): void {
    this.onCompleteCallback = callback
  }

  update(deltaTime: number): void {
    this.mixer?.update(deltaTime)
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && pnpm test -- GesturePlayer`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/animation/GesturePlayer.ts packages/core/src/__tests__/GesturePlayer.test.ts
git commit -m "feat: add GesturePlayer — skeletal animation playback with crossfade"
```

---

## Phase 4: Asset Management

### Task 9: CacheProvider

**Files:**
- Create: `packages/core/src/assets/CacheProvider.ts`
- Create: `packages/core/src/__tests__/CacheProvider.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CacheProvider } from '../assets/CacheProvider.js'

// Mock IndexedDB for Node test environment
const mockStore: Map<string, unknown> = new Map()

const mockIDB = {
  open: vi.fn(() => {
    const request = {
      result: {
        transaction: vi.fn(() => ({
          objectStore: vi.fn(() => ({
            get: vi.fn((key: string) => {
              const req = { result: mockStore.get(key), onsuccess: null as (() => void) | null, onerror: null as (() => void) | null }
              setTimeout(() => req.onsuccess?.(), 0)
              return req
            }),
            put: vi.fn((value: unknown, key: string) => {
              mockStore.set(key, value)
              const req = { onsuccess: null as (() => void) | null, onerror: null as (() => void) | null }
              setTimeout(() => req.onsuccess?.(), 0)
              return req
            }),
            delete: vi.fn((key: string) => {
              mockStore.delete(key)
              const req = { onsuccess: null as (() => void) | null, onerror: null as (() => void) | null }
              setTimeout(() => req.onsuccess?.(), 0)
              return req
            }),
          })),
        })),
        objectStoreNames: { contains: vi.fn(() => true) },
        createObjectStore: vi.fn(),
      },
      onsuccess: null as (() => void) | null,
      onupgradeneeded: null as (() => void) | null,
      onerror: null as (() => void) | null,
    }
    setTimeout(() => request.onsuccess?.(), 0)
    return request
  }),
}

describe('CacheProvider', () => {
  beforeEach(() => {
    mockStore.clear()
  })

  it('get returns undefined for missing key (with fallback)', async () => {
    const cache = new CacheProvider()
    const result = await cache.get('nonexistent')
    expect(result).toBeUndefined()
  })

  it('set and get roundtrip works (in-memory fallback)', async () => {
    const cache = new CacheProvider()
    const data = new ArrayBuffer(8)
    await cache.set('test-key', data)
    const result = await cache.get('test-key')
    expect(result).toEqual(data)
  })

  it('delete removes entry', async () => {
    const cache = new CacheProvider()
    await cache.set('key1', new ArrayBuffer(4))
    await cache.delete('key1')
    const result = await cache.get('key1')
    expect(result).toBeUndefined()
  })

  it('has returns true for existing keys', async () => {
    const cache = new CacheProvider()
    await cache.set('exists', new ArrayBuffer(4))
    expect(await cache.has('exists')).toBe(true)
    expect(await cache.has('nope')).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm test -- CacheProvider`
Expected: FAIL — module not found

- [ ] **Step 3: Implement CacheProvider**

```ts
const DB_NAME = 'low-cost-avatar-cache'
const DB_VERSION = 1
const STORE_NAME = 'assets'

export class CacheProvider {
  private db: IDBDatabase | null = null
  private memoryFallback = new Map<string, ArrayBuffer>()
  private useMemory = false
  private initPromise: Promise<void> | null = null

  constructor() {
    this.initPromise = this.init()
  }

  private async init(): Promise<void> {
    if (typeof indexedDB === 'undefined') {
      this.useMemory = true
      return
    }
    try {
      this.db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION)
        request.onupgradeneeded = () => {
          const db = request.result
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME)
          }
        }
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
    } catch {
      this.useMemory = true
    }
  }

  async get(key: string): Promise<ArrayBuffer | undefined> {
    await this.initPromise
    if (this.useMemory) {
      return this.memoryFallback.get(key)
    }
    return new Promise((resolve) => {
      const tx = this.db!.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const request = store.get(key)
      request.onsuccess = () => resolve(request.result ?? undefined)
      request.onerror = () => resolve(undefined)
    })
  }

  async set(key: string, data: ArrayBuffer): Promise<void> {
    await this.initPromise
    if (this.useMemory) {
      this.memoryFallback.set(key, data)
      return
    }
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const request = store.put(data, key)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async delete(key: string): Promise<void> {
    await this.initPromise
    if (this.useMemory) {
      this.memoryFallback.delete(key)
      return
    }
    return new Promise((resolve) => {
      const tx = this.db!.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const request = store.delete(key)
      request.onsuccess = () => resolve()
      request.onerror = () => resolve()
    })
  }

  async has(key: string): Promise<boolean> {
    const result = await this.get(key)
    return result !== undefined
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && pnpm test -- CacheProvider`
Expected: All 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/assets/CacheProvider.ts packages/core/src/__tests__/CacheProvider.test.ts
git commit -m "feat: add CacheProvider — IndexedDB cache with in-memory fallback"
```

---

### Task 10: AssetManager

**Files:**
- Create: `packages/core/src/assets/AssetManifest.ts`
- Create: `packages/core/src/assets/AssetManager.ts`
- Create: `packages/core/src/__tests__/AssetManager.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect, vi } from 'vitest'
import { AssetManifest } from '../assets/AssetManifest.js'
import { AssetManager } from '../assets/AssetManager.js'
import type { AssetManifest as ManifestType } from '../types/index.js'

describe('AssetManifest', () => {
  const sampleManifest: ManifestType = {
    version: '1.0.0',
    avatars: {
      'professional-woman': {
        name: 'Professional Woman',
        variants: {
          high: 'avatars/professional-woman/high.glb',
          medium: 'avatars/professional-woman/medium.glb',
        },
        thumbnail: 'avatars/professional-woman/thumb.webp',
      },
    },
    gestures: {
      core: { url: 'gestures/core.glb', size: 512000 },
    },
  }

  it('resolves avatar URL for a given quality tier', () => {
    const manifest = new AssetManifest(sampleManifest, 'https://cdn.example.com/')
    const url = manifest.getAvatarUrl('professional-woman', 'high')
    expect(url).toBe('https://cdn.example.com/avatars/professional-woman/high.glb')
  })

  it('falls back to lower quality if requested tier unavailable', () => {
    const manifest = new AssetManifest(sampleManifest, 'https://cdn.example.com/')
    // 'low' is not available, should fall back to 'medium'
    const url = manifest.getAvatarUrl('professional-woman', 'low')
    expect(url).toBe('https://cdn.example.com/avatars/professional-woman/medium.glb')
  })

  it('returns null for unknown avatar', () => {
    const manifest = new AssetManifest(sampleManifest, 'https://cdn.example.com/')
    const url = manifest.getAvatarUrl('unknown', 'high')
    expect(url).toBeNull()
  })

  it('resolves gesture URL', () => {
    const manifest = new AssetManifest(sampleManifest, 'https://cdn.example.com/')
    const url = manifest.getGestureUrl('core')
    expect(url).toBe('https://cdn.example.com/gestures/core.glb')
  })

  it('lists available avatars', () => {
    const manifest = new AssetManifest(sampleManifest, 'https://cdn.example.com/')
    expect(manifest.listAvatars()).toEqual(['professional-woman'])
  })
})

describe('AssetManager', () => {
  it('isCustomUrl returns true for http URLs', () => {
    expect(AssetManager.isCustomUrl('https://example.com/avatar.glb')).toBe(true)
    expect(AssetManager.isCustomUrl('http://example.com/avatar.glb')).toBe(true)
  })

  it('isCustomUrl returns true for relative paths ending in .glb', () => {
    expect(AssetManager.isCustomUrl('./my-avatar.glb')).toBe(true)
    expect(AssetManager.isCustomUrl('/assets/avatar.glb')).toBe(true)
  })

  it('isCustomUrl returns false for plain avatar IDs', () => {
    expect(AssetManager.isCustomUrl('professional-woman')).toBe(false)
    expect(AssetManager.isCustomUrl('friendly-guy')).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm test -- AssetManager`
Expected: FAIL — module not found

- [ ] **Step 3: Implement AssetManifest**

```ts
import type { AssetManifest as ManifestType, QualityTier } from '../types/index.js'

const QUALITY_FALLBACK: Record<QualityTier, QualityTier[]> = {
  high: ['high', 'medium', 'low'],
  medium: ['medium', 'high', 'low'],
  low: ['low', 'medium', 'high'],
}

export class AssetManifest {
  constructor(
    private manifest: ManifestType,
    private baseUrl: string,
  ) {
    // Ensure baseUrl ends with /
    if (!this.baseUrl.endsWith('/')) {
      this.baseUrl += '/'
    }
  }

  getAvatarUrl(avatarId: string, quality: QualityTier): string | null {
    const entry = this.manifest.avatars[avatarId]
    if (!entry) return null

    for (const tier of QUALITY_FALLBACK[quality]) {
      const path = entry.variants[tier]
      if (path) return this.baseUrl + path
    }
    return null
  }

  getGestureUrl(gestureId: string): string | null {
    const entry = this.manifest.gestures[gestureId]
    if (!entry) return null
    return this.baseUrl + entry.url
  }

  listAvatars(): string[] {
    return Object.keys(this.manifest.avatars)
  }

  listGestures(): string[] {
    return Object.keys(this.manifest.gestures)
  }

  getVersion(): string {
    return this.manifest.version
  }
}
```

- [ ] **Step 4: Implement AssetManager**

```ts
import { CacheProvider } from './CacheProvider.js'
import { AssetManifest } from './AssetManifest.js'
import type { AssetManifest as ManifestType, QualityTier } from '../types/index.js'

export class AssetManager {
  private cache: CacheProvider | null
  private manifest: AssetManifest | null = null
  private baseUrl: string

  constructor(baseUrl: string, enableCache: boolean) {
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/'
    this.cache = enableCache ? new CacheProvider() : null
  }

  async loadManifest(): Promise<AssetManifest> {
    const manifestUrl = this.baseUrl + 'manifests/v1.json'
    const response = await fetch(manifestUrl)
    if (!response.ok) {
      throw new Error(`Failed to load asset manifest from ${manifestUrl}: ${response.status}`)
    }
    const data = (await response.json()) as ManifestType
    this.manifest = new AssetManifest(data, this.baseUrl)
    return this.manifest
  }

  async loadAvatarGLB(avatarId: string, quality: QualityTier): Promise<ArrayBuffer> {
    // If it's a custom URL, fetch it directly
    if (AssetManager.isCustomUrl(avatarId)) {
      return this.fetchWithCache(avatarId)
    }

    if (!this.manifest) {
      throw new Error('Manifest not loaded. Call loadManifest() first or provide a direct URL.')
    }

    const url = this.manifest.getAvatarUrl(avatarId, quality)
    if (!url) {
      throw new Error(`Avatar "${avatarId}" not found in manifest`)
    }
    return this.fetchWithCache(url)
  }

  async loadGestureGLB(gestureId: string): Promise<ArrayBuffer> {
    if (!this.manifest) {
      throw new Error('Manifest not loaded. Call loadManifest() first.')
    }
    const url = this.manifest.getGestureUrl(gestureId)
    if (!url) {
      throw new Error(`Gesture "${gestureId}" not found in manifest`)
    }
    return this.fetchWithCache(url)
  }

  private async fetchWithCache(url: string): Promise<ArrayBuffer> {
    if (this.cache) {
      const cached = await this.cache.get(url)
      if (cached) return cached
    }

    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status}`)
    }
    const buffer = await response.arrayBuffer()

    if (this.cache) {
      await this.cache.set(url, buffer).catch(() => {
        // Cache write failure is non-fatal
      })
    }

    return buffer
  }

  static isCustomUrl(avatar: string): boolean {
    return avatar.startsWith('http://') ||
      avatar.startsWith('https://') ||
      avatar.startsWith('./') ||
      avatar.startsWith('/') ||
      avatar.endsWith('.glb') ||
      avatar.endsWith('.gltf')
  }

  getManifest(): AssetManifest | null {
    return this.manifest
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/core && pnpm test -- AssetManager`
Expected: All 8 tests PASS

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/assets/AssetManifest.ts packages/core/src/assets/AssetManager.ts packages/core/src/__tests__/AssetManager.test.ts
git commit -m "feat: add AssetManifest and AssetManager — manifest resolution, caching, custom URLs"
```

---

## Phase 5: Renderer

### Task 11: SceneManager

**Files:**
- Create: `packages/core/src/renderer/SceneManager.ts`

- [ ] **Step 1: Implement SceneManager**

```ts
import * as THREE from 'three'
import type { QualityTier } from '../types/index.js'

export interface SceneConfig {
  container: HTMLElement
  quality: QualityTier
}

export class SceneManager {
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private renderer: THREE.WebGLRenderer
  private container: HTMLElement
  private animationFrameId: number | null = null
  private onRenderCallback: ((delta: number) => void) | null = null
  private clock = new THREE.Clock()
  private resizeObserver: ResizeObserver | null = null

  constructor(config: SceneConfig) {
    this.container = config.container
    this.scene = new THREE.Scene()

    // Camera setup — framed for head + upper torso
    const aspect = this.container.clientWidth / this.container.clientHeight
    this.camera = new THREE.PerspectiveCamera(30, aspect, 0.1, 100)
    this.camera.position.set(0, 1.5, 1.5) // eye level, slight distance
    this.camera.lookAt(0, 1.4, 0)

    // Renderer setup
    this.renderer = new THREE.WebGLRenderer({
      antialias: config.quality === 'high',
      alpha: true,
      powerPreference: config.quality === 'low' ? 'low-power' : 'high-performance',
    })
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight)
    this.renderer.setPixelRatio(config.quality === 'low' ? 1 : Math.min(window.devicePixelRatio, 2))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.0
    this.container.appendChild(this.renderer.domElement)

    // Lighting — 3-point lighting setup for realistic face rendering
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.2)
    keyLight.position.set(1, 2, 2)
    this.scene.add(keyLight)

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.5)
    fillLight.position.set(-1, 1, 1)
    this.scene.add(fillLight)

    const rimLight = new THREE.DirectionalLight(0xffffff, 0.3)
    rimLight.position.set(0, 1, -2)
    this.scene.add(rimLight)

    const ambient = new THREE.AmbientLight(0xffffff, 0.4)
    this.scene.add(ambient)

    // Handle resize
    this.resizeObserver = new ResizeObserver(() => this.handleResize())
    this.resizeObserver.observe(this.container)
  }

  getScene(): THREE.Scene {
    return this.scene
  }

  getCamera(): THREE.PerspectiveCamera {
    return this.camera
  }

  onRender(callback: (delta: number) => void): void {
    this.onRenderCallback = callback
  }

  startRenderLoop(): void {
    if (this.animationFrameId !== null) return
    this.clock.start()
    const loop = () => {
      this.animationFrameId = requestAnimationFrame(loop)
      const delta = this.clock.getDelta()
      this.onRenderCallback?.(delta)
      this.renderer.render(this.scene, this.camera)
    }
    loop()
  }

  stopRenderLoop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }
  }

  dispose(): void {
    this.stopRenderLoop()
    this.resizeObserver?.disconnect()
    this.renderer.dispose()
    this.renderer.domElement.remove()
    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose()
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose())
        } else {
          obj.material.dispose()
        }
      }
    })
  }

  private handleResize(): void {
    const w = this.container.clientWidth
    const h = this.container.clientHeight
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/core/src/renderer/SceneManager.ts
git commit -m "feat: add SceneManager — Three.js scene, camera, lighting, render loop"
```

---

### Task 12: AvatarModel

**Files:**
- Create: `packages/core/src/renderer/AvatarModel.ts`

- [ ] **Step 1: Implement AvatarModel**

```ts
import * as THREE from 'three'
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { BlendshapeMap, BlendshapeName } from '../types/index.js'

export class AvatarModel {
  private gltf: GLTF | null = null
  private meshesWithMorphs: THREE.Mesh[] = []
  private blendshapeIndices = new Map<string, Map<string, number>>()
  private headBone: THREE.Bone | null = null
  private skeleton: THREE.Skeleton | null = null

  async loadFromArrayBuffer(buffer: ArrayBuffer): Promise<THREE.Group> {
    const loader = new GLTFLoader()
    return new Promise((resolve, reject) => {
      loader.parse(buffer, '', (gltf) => {
        this.gltf = gltf
        this.indexBlendshapes(gltf.scene)
        this.findBones(gltf.scene)
        resolve(gltf.scene)
      }, (error) => {
        reject(new Error(`Failed to parse GLB: ${error}`))
      })
    })
  }

  applyBlendshapes(weights: BlendshapeMap): void {
    for (const mesh of this.meshesWithMorphs) {
      const indices = this.blendshapeIndices.get(mesh.uuid)
      if (!indices || !mesh.morphTargetInfluences) continue

      for (const [name, value] of Object.entries(weights)) {
        const index = indices.get(name)
        if (index !== undefined) {
          mesh.morphTargetInfluences[index] = value as number
        }
      }
    }
  }

  resetBlendshapes(): void {
    for (const mesh of this.meshesWithMorphs) {
      if (mesh.morphTargetInfluences) {
        mesh.morphTargetInfluences.fill(0)
      }
    }
  }

  setHeadRotation(pitch: number, yaw: number, roll: number): void {
    if (!this.headBone) return
    this.headBone.rotation.set(
      THREE.MathUtils.degToRad(pitch),
      THREE.MathUtils.degToRad(yaw),
      THREE.MathUtils.degToRad(roll),
    )
  }

  getHeadBone(): THREE.Bone | null {
    return this.headBone
  }

  getSkeleton(): THREE.Skeleton | null {
    return this.skeleton
  }

  getAnimationClips(): THREE.AnimationClip[] {
    return this.gltf?.animations ?? []
  }

  getAvailableBlendshapes(): string[] {
    const names = new Set<string>()
    for (const indices of this.blendshapeIndices.values()) {
      for (const name of indices.keys()) {
        names.add(name)
      }
    }
    return [...names]
  }

  dispose(): void {
    if (this.gltf) {
      this.gltf.scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose()
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose())
          } else {
            obj.material.dispose()
          }
        }
      })
    }
    this.meshesWithMorphs = []
    this.blendshapeIndices.clear()
    this.gltf = null
  }

  private indexBlendshapes(root: THREE.Object3D): void {
    root.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.morphTargetDictionary && obj.morphTargetInfluences) {
        this.meshesWithMorphs.push(obj)
        const indices = new Map<string, number>()
        for (const [name, index] of Object.entries(obj.morphTargetDictionary)) {
          indices.set(name, index)
        }
        this.blendshapeIndices.set(obj.uuid, indices)
      }
    })
  }

  private findBones(root: THREE.Object3D): void {
    root.traverse((obj) => {
      if (obj instanceof THREE.SkinnedMesh && obj.skeleton) {
        this.skeleton = obj.skeleton
      }
      if (obj instanceof THREE.Bone) {
        const name = obj.name.toLowerCase()
        if (name === 'head' || name.includes('head')) {
          if (!this.headBone) this.headBone = obj
        }
      }
    })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/core/src/renderer/AvatarModel.ts
git commit -m "feat: add AvatarModel — GLB loading, blendshape indexing, bone access"
```

---

### Task 13: QualityManager

**Files:**
- Create: `packages/core/src/renderer/QualityManager.ts`
- Create: `packages/core/src/__tests__/QualityManager.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest'
import { QualityManager } from '../renderer/QualityManager.js'

describe('QualityManager', () => {
  it('returns the explicitly set tier', () => {
    const qm = new QualityManager('high')
    expect(qm.getCurrentTier()).toBe('high')
  })

  it('recordFps triggers downgrade at sustained low fps', () => {
    const qm = new QualityManager('high')
    // Feed 60 frames of low FPS (< 45)
    for (let i = 0; i < 60; i++) {
      qm.recordFps(30)
    }
    expect(qm.getCurrentTier()).not.toBe('high')
  })

  it('does not downgrade from a few bad frames', () => {
    const qm = new QualityManager('high')
    // Just 5 bad frames
    for (let i = 0; i < 5; i++) {
      qm.recordFps(30)
    }
    expect(qm.getCurrentTier()).toBe('high')
  })

  it('does not downgrade below low', () => {
    const qm = new QualityManager('low')
    for (let i = 0; i < 120; i++) {
      qm.recordFps(15)
    }
    expect(qm.getCurrentTier()).toBe('low')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm test -- QualityManager`
Expected: FAIL — module not found

- [ ] **Step 3: Implement QualityManager**

```ts
import type { QualityTier, PerformanceMetrics } from '../types/index.js'

const TIER_ORDER: QualityTier[] = ['high', 'medium', 'low']
const FPS_THRESHOLD_1 = 45
const FPS_THRESHOLD_2 = 30
const SUSTAINED_FRAMES = 30 // number of consecutive low-fps frames before downgrade

export class QualityManager {
  private currentTier: QualityTier
  private lowFpsCount = 0
  private veryLowFpsCount = 0
  private onChangeCallback: ((tier: QualityTier) => void) | null = null

  constructor(initialTier: QualityTier | 'auto') {
    this.currentTier = initialTier === 'auto' ? this.benchmark() : initialTier
  }

  getCurrentTier(): QualityTier {
    return this.currentTier
  }

  recordFps(fps: number): void {
    if (fps < FPS_THRESHOLD_2) {
      this.veryLowFpsCount++
      this.lowFpsCount++
    } else if (fps < FPS_THRESHOLD_1) {
      this.lowFpsCount++
      this.veryLowFpsCount = 0
    } else {
      this.lowFpsCount = 0
      this.veryLowFpsCount = 0
    }

    if (this.veryLowFpsCount >= SUSTAINED_FRAMES) {
      this.downgrade()
      this.downgrade() // skip a tier for very low fps
      this.veryLowFpsCount = 0
      this.lowFpsCount = 0
    } else if (this.lowFpsCount >= SUSTAINED_FRAMES) {
      this.downgrade()
      this.lowFpsCount = 0
    }
  }

  getMetrics(fps: number): PerformanceMetrics {
    return {
      fps,
      gpuMemoryMB: 0, // Not reliably available in browsers
      jsHeapMB: typeof performance !== 'undefined' && 'memory' in performance
        ? (performance as unknown as { memory: { usedJSHeapSize: number } }).memory.usedJSHeapSize / 1024 / 1024
        : 0,
      qualityTier: this.currentTier,
    }
  }

  onChange(callback: (tier: QualityTier) => void): void {
    this.onChangeCallback = callback
  }

  private downgrade(): void {
    const currentIndex = TIER_ORDER.indexOf(this.currentTier)
    if (currentIndex < TIER_ORDER.length - 1) {
      this.currentTier = TIER_ORDER[currentIndex + 1]!
      this.onChangeCallback?.(this.currentTier)
    }
  }

  private benchmark(): QualityTier {
    // Quick GPU capability check
    if (typeof document === 'undefined') return 'medium'
    try {
      const canvas = document.createElement('canvas')
      const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
      if (!gl) return 'low'

      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
      if (debugInfo) {
        const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) as string
        const lowerRenderer = renderer.toLowerCase()
        // Discrete GPU indicators
        if (lowerRenderer.includes('nvidia') || lowerRenderer.includes('radeon') || lowerRenderer.includes('geforce')) {
          return 'high'
        }
        // Known weak GPUs
        if (lowerRenderer.includes('swiftshader') || lowerRenderer.includes('llvmpipe')) {
          return 'low'
        }
      }

      // Check hardware concurrency as a proxy for device capability
      if (navigator.hardwareConcurrency >= 8) return 'high'
      if (navigator.hardwareConcurrency >= 4) return 'medium'
      return 'low'
    } catch {
      return 'medium'
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && pnpm test -- QualityManager`
Expected: All 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/renderer/QualityManager.ts packages/core/src/__tests__/QualityManager.test.ts
git commit -m "feat: add QualityManager — auto-detection, runtime FPS-based adaptation"
```

---

## Phase 6: Main SDK Class

### Task 14: LowCostAvatar (Main Entry Point)

**Files:**
- Create: `packages/core/src/LowCostAvatar.ts`
- Modify: `packages/core/src/index.ts`

This is the public API that ties all components together.

- [ ] **Step 1: Implement LowCostAvatar**

```ts
import * as THREE from 'three'
import { EventEmitter } from './EventEmitter.js'
import { SceneManager } from './renderer/SceneManager.js'
import { AvatarModel } from './renderer/AvatarModel.js'
import { QualityManager } from './renderer/QualityManager.js'
import { BlendshapeMixer } from './animation/BlendshapeMixer.js'
import { LipSyncEngine } from './animation/LipSyncEngine.js'
import { IdleSystem } from './animation/IdleSystem.js'
import { EmotionSystem } from './animation/EmotionSystem.js'
import { GesturePlayer } from './animation/GesturePlayer.js'
import { AudioAnalyzer } from './audio/AudioAnalyzer.js'
import { AssetManager } from './assets/AssetManager.js'
import type {
  AvatarOptions, AvatarEventMap, SpeakOptions, EmotionName,
  EmotionOptions, TransitionOptions, BlendshapeMap, BoneRotation,
  QualityTier,
} from './types/index.js'
import { DEFAULT_MIXER_PRIORITIES } from './types/index.js'

export class LowCostAvatar extends EventEmitter<AvatarEventMap> {
  private options: Required<AvatarOptions>
  private sceneManager: SceneManager | null = null
  private avatarModel: AvatarModel | null = null
  private qualityManager: QualityManager
  private blendshapeMixer: BlendshapeMixer
  private lipSyncEngine: LipSyncEngine | null = null
  private idleSystem: IdleSystem
  private emotionSystem: EmotionSystem
  private gesturePlayer: GesturePlayer
  private audioAnalyzer: AudioAnalyzer | null = null
  private assetManager: AssetManager
  private loaded = false
  private speaking = false
  private fpsFrames: number[] = []
  private lastFrameTime = 0

  constructor(options: AvatarOptions) {
    super()
    this.options = {
      container: options.container,
      avatar: options.avatar,
      quality: options.quality ?? 'auto',
      assetsBaseUrl: options.assetsBaseUrl ?? './',
      cache: options.cache ?? true,
    }

    this.qualityManager = new QualityManager(this.options.quality)
    this.blendshapeMixer = new BlendshapeMixer(DEFAULT_MIXER_PRIORITIES)
    this.idleSystem = new IdleSystem()
    this.emotionSystem = new EmotionSystem()
    this.gesturePlayer = new GesturePlayer()
    this.assetManager = new AssetManager(this.options.assetsBaseUrl, this.options.cache)

    this.qualityManager.onChange((tier) => {
      this.emit('performanceWarning', this.qualityManager.getMetrics(this.getCurrentFps()))
    })
  }

  async load(): Promise<void> {
    const quality = this.qualityManager.getCurrentTier()

    // Initialize scene
    this.sceneManager = new SceneManager({
      container: this.options.container,
      quality,
    })

    // Load avatar model
    this.avatarModel = new AvatarModel()
    let glbBuffer: ArrayBuffer

    if (AssetManager.isCustomUrl(this.options.avatar)) {
      const response = await fetch(this.options.avatar)
      if (!response.ok) throw new Error(`Failed to load avatar from ${this.options.avatar}`)
      glbBuffer = await response.arrayBuffer()
    } else {
      try {
        await this.assetManager.loadManifest()
      } catch {
        throw new Error(
          `Failed to load asset manifest. Provide assetsBaseUrl pointing to your asset CDN, or pass a direct URL/path to a .glb file as the avatar option.`,
        )
      }
      glbBuffer = await this.assetManager.loadAvatarGLB(this.options.avatar, quality)
    }

    const avatarScene = await this.avatarModel.loadFromArrayBuffer(glbBuffer)
    this.sceneManager.getScene().add(avatarScene)

    // Setup animation mixer for gestures
    const mixer = new THREE.AnimationMixer(avatarScene)
    this.gesturePlayer.setMixer(mixer)

    // Register any embedded animations
    for (const clip of this.avatarModel.getAnimationClips()) {
      this.gesturePlayer.registerClip(clip.name, clip)
    }

    this.gesturePlayer.onComplete((name) => {
      this.emit('gestureComplete', name)
    })

    // Initialize audio (lazy — created on first speak)
    // Start idle animations
    this.idleSystem.start()

    // Start render loop
    this.sceneManager.onRender((delta) => this.onFrame(delta))
    this.sceneManager.startRenderLoop()

    this.loaded = true
    this.emit('loaded')
  }

  // --- High-Level API ---

  async speak(audio: AudioBuffer, options: SpeakOptions = {}): Promise<void> {
    this.ensureLoaded()

    // Initialize audio context on first use (requires user gesture)
    if (!this.audioAnalyzer) {
      const ctx = new AudioContext()
      this.audioAnalyzer = new AudioAnalyzer(ctx)
      this.lipSyncEngine = new LipSyncEngine(ctx)
      this.lipSyncEngine.connectAnalyser(this.audioAnalyzer.getAnalyser())
    }

    // Set emotion if provided
    if (options.emotion) {
      this.setEmotion(options.emotion, { transition: 200 })
    }

    this.speaking = true
    this.emit('speakStart')

    // Schedule gestures
    const gestureTimeouts: ReturnType<typeof setTimeout>[] = []
    if (options.gestures) {
      for (const g of options.gestures) {
        gestureTimeouts.push(setTimeout(() => this.playGesture(g.name), g.time * 1000))
      }
    }

    // Play audio and wait for completion
    return new Promise<void>((resolve) => {
      this.audioAnalyzer!.playBuffer(audio, () => {
        this.speaking = false
        this.lipSyncEngine?.reset()
        this.blendshapeMixer.clearChannel('lipSync')
        gestureTimeouts.forEach(clearTimeout)
        if (options.emotion) {
          this.clearEmotion({ transition: 500 })
        }
        this.emit('speakEnd')
        resolve()
      })
    })
  }

  setEmotion(emotion: EmotionName, options?: EmotionOptions): void {
    this.emotionSystem.setEmotion(emotion, options)
    const mods = this.emotionSystem.getCurrentModifiers()
    this.idleSystem.setBlinkRateMultiplier(mods.blinkRateMultiplier)
    this.idleSystem.setBreathingRateMultiplier(mods.breathingRateMultiplier)
  }

  clearEmotion(options?: TransitionOptions): void {
    this.emotionSystem.clearEmotion(options)
    this.idleSystem.setBlinkRateMultiplier(1.0)
    this.idleSystem.setBreathingRateMultiplier(1.0)
  }

  playGesture(name: string): boolean {
    return this.gesturePlayer.play(name)
  }

  stopGesture(options?: TransitionOptions): void {
    this.gesturePlayer.stop((options?.transition ?? 200) / 1000)
  }

  setIdle(enabled: boolean): void {
    if (enabled) {
      this.idleSystem.start()
    } else {
      this.idleSystem.stop()
    }
  }

  // --- Low-Level API ---

  setBlendshapes(weights: BlendshapeMap): void {
    this.blendshapeMixer.setChannel('direct', weights)
  }

  clearBlendshapes(): void {
    this.blendshapeMixer.clearChannel('direct')
  }

  setBoneRotation(boneName: string, rotation: BoneRotation): void {
    this.ensureLoaded()
    if (boneName === 'head') {
      this.avatarModel!.setHeadRotation(rotation.pitch, rotation.yaw, rotation.roll)
    }
  }

  createTimeline(): Timeline {
    return new Timeline(this)
  }

  // --- Lifecycle ---

  destroy(): void {
    this.sceneManager?.dispose()
    this.avatarModel?.dispose()
    this.audioAnalyzer?.dispose()
    this.idleSystem.stop()
    this.blendshapeMixer.clearAll()
    this.removeAllListeners()
    this.loaded = false
  }

  // --- Internal ---

  private onFrame(delta: number): void {
    // Track FPS
    const now = performance.now()
    if (this.lastFrameTime > 0) {
      const fps = 1000 / (now - this.lastFrameTime)
      this.qualityManager.recordFps(fps)
    }
    this.lastFrameTime = now

    // Update animation systems
    const lipSyncWeights = this.speaking && this.lipSyncEngine ? this.lipSyncEngine.update() : {}
    const idleWeights = this.idleSystem.update(delta)
    const emotionWeights = this.emotionSystem.update(delta)

    // Feed channels into mixer
    this.blendshapeMixer.setChannel('lipSync', lipSyncWeights)
    this.blendshapeMixer.setChannel('idle', idleWeights)
    this.blendshapeMixer.setChannel('emotion', emotionWeights)

    // Mix and apply
    const finalWeights = this.blendshapeMixer.mix()
    this.avatarModel?.applyBlendshapes(finalWeights)

    // Apply head drift from idle + emotion
    const drift = this.idleSystem.getHeadDrift()
    const emotionMods = this.emotionSystem.getCurrentModifiers()
    this.avatarModel?.setHeadRotation(
      drift.pitch + emotionMods.headPitchOffset,
      drift.yaw + emotionMods.headYawOffset,
      drift.roll,
    )

    // Update gesture player
    this.gesturePlayer.update(delta)
  }

  private getCurrentFps(): number {
    if (this.lastFrameTime === 0) return 60
    return 1000 / (performance.now() - this.lastFrameTime)
  }

  private ensureLoaded(): void {
    if (!this.loaded) {
      throw new Error('Avatar not loaded. Call load() first.')
    }
  }
}

// --- Timeline API ---

interface TimelineEntry {
  time: number
  action: (avatar: LowCostAvatar) => void
}

export class Timeline {
  private entries: TimelineEntry[] = []
  private avatar: LowCostAvatar

  constructor(avatar: LowCostAvatar) {
    this.avatar = avatar
  }

  at(time: number): TimelineAction {
    return new TimelineAction(this, time)
  }

  addEntry(entry: TimelineEntry): void {
    this.entries.push(entry)
  }

  async play(audio: AudioBuffer): Promise<void> {
    // Sort entries by time
    this.entries.sort((a, b) => a.time - b.time)

    // Schedule all entries
    const timeouts: ReturnType<typeof setTimeout>[] = []
    for (const entry of this.entries) {
      timeouts.push(setTimeout(() => entry.action(this.avatar), entry.time * 1000))
    }

    // Play audio and wait
    return new Promise<void>((resolve) => {
      this.avatar.speak(audio, {}).then(() => {
        timeouts.forEach(clearTimeout)
        resolve()
      })
    })
  }
}

class TimelineAction {
  constructor(
    private timeline: Timeline,
    private time: number,
  ) {}

  setEmotion(emotion: EmotionName, options?: EmotionOptions): TimelineAction {
    this.timeline.addEntry({
      time: this.time,
      action: (avatar) => avatar.setEmotion(emotion, options),
    })
    return this
  }

  setBlendshapes(weights: BlendshapeMap): TimelineAction {
    this.timeline.addEntry({
      time: this.time,
      action: (avatar) => avatar.setBlendshapes(weights),
    })
    return this
  }

  playGesture(name: string): TimelineAction {
    this.timeline.addEntry({
      time: this.time,
      action: (avatar) => avatar.playGesture(name),
    })
    return this
  }
}
```

- [ ] **Step 2: Update index.ts exports**

```ts
export { VERSION } from './version.js'
export { LowCostAvatar } from './LowCostAvatar.js'
export { Timeline } from './LowCostAvatar.js'
export type {
  AvatarOptions, SpeakOptions, EmotionOptions, TransitionOptions,
  BoneRotation, AvatarEvent, AvatarEventMap, PerformanceMetrics,
  QualityTier, MixerPriorities, AssetManifest, AvatarManifestEntry,
  GestureManifestEntry, AnimationChannel,
  ARKitBlendshapeName, OculusVisemeName, BlendshapeName, BlendshapeMap,
  EmotionName, EmotionPreset,
} from './types/index.js'
export {
  ARKIT_BLENDSHAPES, OCULUS_VISEMES, MOUTH_BLENDSHAPES, EYE_BLENDSHAPES,
  EMOTION_PRESETS, DEFAULT_MIXER_PRIORITIES,
} from './types/index.js'
```

- [ ] **Step 3: Verify build**

Run: `cd /home/13843K/Desktop/low-cost-avatar && pnpm build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/LowCostAvatar.ts packages/core/src/index.ts
git commit -m "feat: add LowCostAvatar main class — ties all systems into the public API"
```

---

## Phase 7: React Wrapper

### Task 15: React Component

**Files:**
- Create: `packages/react/package.json`
- Create: `packages/react/tsconfig.json`
- Create: `packages/react/tsup.config.ts`
- Create: `packages/react/src/Avatar.tsx`
- Create: `packages/react/src/index.ts`

- [ ] **Step 1: Create packages/react/package.json**

```json
{
  "name": "@low-cost-avatar/react",
  "version": "0.1.0",
  "description": "React component for low-cost-avatar SDK",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "low-cost-avatar": "workspace:*"
  },
  "peerDependencies": {
    "react": ">=18.0.0",
    "three": ">=0.160.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "react": "^19.0.0",
    "tsup": "^8.4.0",
    "typescript": "^5.7.0"
  },
  "license": "MIT"
}
```

- [ ] **Step 2: Create tsup.config.ts and tsconfig.json**

`packages/react/tsup.config.ts`:
```ts
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ['react', 'three', 'low-cost-avatar'],
})
```

`packages/react/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM"],
    "jsx": "react-jsx",
    "declaration": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Implement Avatar.tsx**

```tsx
import { useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react'
import { LowCostAvatar } from 'low-cost-avatar'
import type {
  AvatarOptions, SpeakOptions, EmotionName, EmotionOptions,
  TransitionOptions, BlendshapeMap, BoneRotation, AvatarEvent, AvatarEventMap,
} from 'low-cost-avatar'

export interface AvatarProps {
  /** Built-in avatar ID or URL to custom GLB */
  avatar: string
  /** Quality tier. Default: 'auto' */
  quality?: AvatarOptions['quality']
  /** Base URL for avatar assets */
  assetsBaseUrl?: string
  /** Enable IndexedDB caching. Default: true */
  cache?: boolean
  /** CSS class for the container div */
  className?: string
  /** Inline style for the container div */
  style?: React.CSSProperties
  /** Event callbacks */
  onLoaded?: () => void
  onSpeakStart?: () => void
  onSpeakEnd?: () => void
  onGestureComplete?: (name: string) => void
  onError?: (error: Error) => void
}

export interface AvatarHandle {
  speak: (audio: AudioBuffer, options?: SpeakOptions) => Promise<void>
  setEmotion: (emotion: EmotionName, options?: EmotionOptions) => void
  clearEmotion: (options?: TransitionOptions) => void
  playGesture: (name: string) => boolean
  stopGesture: (options?: TransitionOptions) => void
  setIdle: (enabled: boolean) => void
  setBlendshapes: (weights: BlendshapeMap) => void
  setBoneRotation: (bone: string, rotation: BoneRotation) => void
  getInstance: () => LowCostAvatar | null
}

export const Avatar = forwardRef<AvatarHandle, AvatarProps>(function Avatar(props, ref) {
  const containerRef = useRef<HTMLDivElement>(null)
  const instanceRef = useRef<LowCostAvatar | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const avatar = new LowCostAvatar({
      container: containerRef.current,
      avatar: props.avatar,
      quality: props.quality,
      assetsBaseUrl: props.assetsBaseUrl,
      cache: props.cache,
    })

    instanceRef.current = avatar

    // Wire up events
    if (props.onLoaded) avatar.on('loaded', props.onLoaded)
    if (props.onSpeakStart) avatar.on('speakStart', props.onSpeakStart)
    if (props.onSpeakEnd) avatar.on('speakEnd', props.onSpeakEnd)
    if (props.onGestureComplete) avatar.on('gestureComplete', props.onGestureComplete)
    if (props.onError) avatar.on('error', props.onError)

    avatar.load().catch((err) => {
      props.onError?.(err instanceof Error ? err : new Error(String(err)))
    })

    return () => {
      avatar.destroy()
      instanceRef.current = null
    }
  }, [props.avatar, props.quality, props.assetsBaseUrl, props.cache])

  useImperativeHandle(ref, () => ({
    speak: (audio, options) => instanceRef.current?.speak(audio, options) ?? Promise.resolve(),
    setEmotion: (emotion, options) => instanceRef.current?.setEmotion(emotion, options),
    clearEmotion: (options) => instanceRef.current?.clearEmotion(options),
    playGesture: (name) => instanceRef.current?.playGesture(name) ?? false,
    stopGesture: (options) => instanceRef.current?.stopGesture(options),
    setIdle: (enabled) => instanceRef.current?.setIdle(enabled),
    setBlendshapes: (weights) => instanceRef.current?.setBlendshapes(weights),
    setBoneRotation: (bone, rotation) => instanceRef.current?.setBoneRotation(bone, rotation),
    getInstance: () => instanceRef.current,
  }), [])

  return (
    <div
      ref={containerRef}
      className={props.className}
      style={{ width: '100%', height: '100%', ...props.style }}
    />
  )
})
```

- [ ] **Step 4: Create index.ts**

```ts
export { Avatar } from './Avatar.js'
export type { AvatarProps, AvatarHandle } from './Avatar.js'
```

- [ ] **Step 5: Install deps and verify build**

Run: `cd /home/13843K/Desktop/low-cost-avatar && pnpm install && pnpm build`
Expected: Both core and react packages build successfully

- [ ] **Step 6: Commit**

```bash
git add packages/react/
git commit -m "feat: add @low-cost-avatar/react — Avatar component with ref-based API"
```

---

## Phase 8: Vanilla Example

### Task 16: Vanilla HTML Example

**Files:**
- Create: `examples/vanilla/index.html`
- Create: `examples/vanilla/package.json`

- [ ] **Step 1: Create examples/vanilla/package.json**

```json
{
  "name": "example-vanilla",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  },
  "dependencies": {
    "low-cost-avatar": "workspace:*",
    "three": "^0.172.0"
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
  <title>Low-Cost Avatar — Vanilla Example</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; background: #1a1a2e; color: #fff; }
    #app {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      gap: 20px;
    }
    #avatar-container {
      width: 400px;
      height: 500px;
      border-radius: 12px;
      overflow: hidden;
      background: #16213e;
    }
    .controls {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      justify-content: center;
      max-width: 500px;
    }
    button {
      padding: 8px 16px;
      border: 1px solid #555;
      border-radius: 6px;
      background: #0f3460;
      color: #fff;
      cursor: pointer;
      font-size: 14px;
    }
    button:hover { background: #1a5276; }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    h1 { font-size: 24px; font-weight: 400; }
    .status { font-size: 12px; color: #888; }
  </style>
</head>
<body>
  <div id="app">
    <h1>Low-Cost Avatar SDK</h1>
    <div id="avatar-container"></div>
    <div class="controls">
      <button id="btn-happy">Happy</button>
      <button id="btn-sad">Sad</button>
      <button id="btn-angry">Angry</button>
      <button id="btn-surprised">Surprised</button>
      <button id="btn-thinking">Thinking</button>
      <button id="btn-neutral">Neutral</button>
    </div>
    <div class="controls">
      <button id="btn-nod">Nod</button>
      <button id="btn-wave">Wave</button>
      <button id="btn-shrug">Shrug</button>
    </div>
    <p class="status" id="status">Loading avatar...</p>
  </div>

  <script type="module">
    import { LowCostAvatar } from 'low-cost-avatar'

    const status = document.getElementById('status')
    const container = document.getElementById('avatar-container')

    const avatar = new LowCostAvatar({
      container,
      // Replace with your avatar GLB path:
      avatar: './sample-avatar.glb',
      quality: 'auto',
      cache: true,
    })

    avatar.on('loaded', () => {
      status.textContent = 'Avatar loaded! Try the controls below.'
    })

    avatar.on('error', (err) => {
      status.textContent = `Error: ${err.message}`
    })

    avatar.on('performanceWarning', (metrics) => {
      status.textContent = `Quality adjusted to ${metrics.qualityTier} (${Math.round(metrics.fps)} FPS)`
    })

    avatar.load().catch((err) => {
      status.textContent = `Failed to load: ${err.message}`
    })

    // Emotion buttons
    const emotions = ['happy', 'sad', 'angry', 'surprised', 'thinking', 'neutral']
    for (const emotion of emotions) {
      document.getElementById(`btn-${emotion}`)?.addEventListener('click', () => {
        if (emotion === 'neutral') {
          avatar.clearEmotion({ transition: 500 })
        } else {
          avatar.setEmotion(emotion, { intensity: 0.8, transition: 500 })
        }
      })
    }

    // Gesture buttons
    const gestures = ['nod', 'wave', 'shrug']
    for (const gesture of gestures) {
      document.getElementById(`btn-${gesture}`)?.addEventListener('click', () => {
        avatar.playGesture(gesture)
      })
    }
  </script>
</body>
</html>
```

- [ ] **Step 3: Install and verify dev server starts**

Run: `cd /home/13843K/Desktop/low-cost-avatar && pnpm install && cd examples/vanilla && pnpm dev`
Expected: Vite dev server starts, page loads at localhost

- [ ] **Step 4: Commit**

```bash
git add examples/vanilla/
git commit -m "feat: add vanilla HTML example with emotion and gesture controls"
```

---

## Phase 9: CI & Linting Setup

### Task 17: ESLint, Prettier, and CI

**Files:**
- Create: `packages/core/eslint.config.js`
- Create: `.prettierrc`
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create packages/core/eslint.config.js**

```js
import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    ignores: ['dist/', 'node_modules/', '*.config.*'],
  },
)
```

- [ ] **Step 2: Create .prettierrc**

```json
{
  "semi": false,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
```

- [ ] **Step 3: Create .github/workflows/ci.yml**

```yaml
name: CI

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test
      - run: pnpm build

      # Bundle size check
      - name: Check core bundle size
        run: |
          SIZE=$(wc -c < packages/core/dist/index.js)
          GZIP_SIZE=$(gzip -c packages/core/dist/index.js | wc -c)
          echo "Bundle size: $SIZE bytes (gzipped: $GZIP_SIZE bytes)"
          MAX_GZIP=204800  # 200KB
          if [ "$GZIP_SIZE" -gt "$MAX_GZIP" ]; then
            echo "ERROR: Bundle size exceeds 200KB gzipped limit!"
            exit 1
          fi
```

- [ ] **Step 4: Commit**

```bash
git add packages/core/eslint.config.js .prettierrc .github/
git commit -m "feat: add ESLint, Prettier config, and GitHub Actions CI pipeline"
```

---

## Phase 10: Final Integration Test

### Task 18: Integration Test — Full Pipeline

**Files:**
- Create: `packages/core/src/__tests__/integration.test.ts`

- [ ] **Step 1: Write integration test**

```ts
import { describe, it, expect, vi } from 'vitest'
import { BlendshapeMixer } from '../animation/BlendshapeMixer.js'
import { IdleSystem } from '../animation/IdleSystem.js'
import { EmotionSystem } from '../animation/EmotionSystem.js'
import { DEFAULT_MIXER_PRIORITIES } from '../types/index.js'

/**
 * Integration test: simulates a full animation frame pipeline
 * without Three.js or browser APIs (those are tested in E2E).
 */
describe('Animation Pipeline Integration', () => {
  it('produces combined blendshape output from idle + emotion', () => {
    const mixer = new BlendshapeMixer(DEFAULT_MIXER_PRIORITIES)
    const idle = new IdleSystem()
    const emotion = new EmotionSystem()

    idle.start()
    emotion.setEmotion('happy', { intensity: 0.8, transition: 0 })

    // Simulate 1 second of frames at 60fps
    for (let i = 0; i < 60; i++) {
      const idleWeights = idle.update(1 / 60)
      const emotionWeights = emotion.update(1 / 60)

      mixer.setChannel('idle', idleWeights)
      mixer.setChannel('emotion', emotionWeights)

      const final = mixer.mix()

      // Should have emotion blendshapes
      expect(final.mouthSmileLeft).toBeDefined()
      // Values should be in valid range
      for (const val of Object.values(final)) {
        expect(val).toBeGreaterThanOrEqual(0)
        expect(val).toBeLessThanOrEqual(1)
      }
    }
  })

  it('emotion transition smoothly blends over time', () => {
    const emotion = new EmotionSystem()
    emotion.setEmotion('happy', { intensity: 1.0, transition: 1000 })

    const values: number[] = []
    for (let i = 0; i < 60; i++) {
      const weights = emotion.update(1 / 60)
      values.push(weights.mouthSmileLeft ?? 0)
    }

    // Should be monotonically increasing (smooth transition)
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]! - 0.001) // allow tiny float error
    }

    // Final value should be close to target (0.7)
    expect(values[values.length - 1]).toBeCloseTo(0.7, 1)
  })

  it('idle system produces natural blink over extended period', () => {
    const idle = new IdleSystem()
    idle.start()

    let blinkCount = 0
    let wasBlinking = false

    // Simulate 30 seconds
    for (let t = 0; t < 30; t += 1 / 60) {
      const weights = idle.update(1 / 60)
      const isBlinking = (weights.eyeBlinkLeft ?? 0) > 0.5
      if (isBlinking && !wasBlinking) blinkCount++
      wasBlinking = isBlinking
    }

    // Should blink 5-15 times in 30 seconds (natural rate)
    expect(blinkCount).toBeGreaterThanOrEqual(3)
    expect(blinkCount).toBeLessThanOrEqual(20)
  })
})
```

- [ ] **Step 2: Run all tests**

Run: `cd packages/core && pnpm test`
Expected: All tests PASS (EventEmitter, BlendshapeMixer, IdleSystem, EmotionSystem, LipSyncEngine, GesturePlayer, CacheProvider, AssetManager, integration)

- [ ] **Step 3: Run full build**

Run: `cd /home/13843K/Desktop/low-cost-avatar && pnpm build`
Expected: All packages build successfully

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/__tests__/integration.test.ts
git commit -m "feat: add integration tests — animation pipeline, emotion transitions, natural blinks"
```

---

## Summary

| Phase | Tasks | What It Delivers |
|---|---|---|
| 1 | Task 1 | Monorepo scaffold, build infra |
| 2 | Task 2 | All TypeScript types and constants |
| 3 | Tasks 3-8 | EventEmitter, BlendshapeMixer, IdleSystem, EmotionSystem, LipSyncEngine, GesturePlayer |
| 4 | Tasks 9-10 | CacheProvider, AssetManifest, AssetManager |
| 5 | Tasks 11-13 | SceneManager, AvatarModel, QualityManager |
| 6 | Task 14 | LowCostAvatar main class (public API) |
| 7 | Task 15 | React wrapper component |
| 8 | Task 16 | Vanilla HTML example |
| 9 | Task 17 | ESLint, Prettier, GitHub Actions CI |
| 10 | Task 18 | Integration tests |

After all 18 tasks, the SDK is fully functional: a developer can `npm install low-cost-avatar`, drop an `<Avatar />` component (or use the vanilla JS API), point it at a GLB file, and have a realistic animated avatar with lip-sync, emotions, gestures, and idle animations — all rendering client-side with zero GPU server cost.
