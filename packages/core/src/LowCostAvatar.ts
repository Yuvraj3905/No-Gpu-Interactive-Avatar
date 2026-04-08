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
import { registerProceduralGestures } from './animation/ProceduralGestures.js'
import { AudioAnalyzer } from './audio/AudioAnalyzer.js'
import { AssetManager } from './assets/AssetManager.js'
import { SplatScene } from './renderer/splat/SplatScene.js'
import { SplatAsset } from './renderer/splat/SplatAsset.js'
import { FLAMEModel } from './renderer/splat/FLAMEModel.js'
import { BlendshapeToFLAME } from './renderer/splat/BlendshapeToFLAME.js'
import { GaussianUpdater } from './renderer/splat/GaussianUpdater.js'
import type { FLAMEAssets, BlendshapeToFLAMEMappings } from './renderer/splat/types.js'
import type { RendererType } from './types/index.js'
import type {
  AvatarOptions, AvatarEventMap, SpeakOptions, EmotionName,
  EmotionOptions, TransitionOptions, BlendshapeMap, BoneRotation,
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
  private lastFrameTime = 0
  private rendererType: RendererType
  private splatScene: SplatScene | null = null
  private splatAsset: SplatAsset | null = null
  private flameModel: FLAMEModel | null = null
  private blendshapeToFlame: BlendshapeToFLAME | null = null
  private gaussianUpdater: GaussianUpdater | null = null
  private gaussianPositions: Float32Array | null = null
  private gaussianLogScales: Float32Array | null = null
  private gaussianRotations: Float32Array | null = null
  private gaussianColors: Float32Array | null = null
  private gaussianOpacities: Float32Array | null = null
  private splatDirty = false
  private splatRebuilding = false
  private splatLastRebuild = 0
  private splatRebuildInterval = 150 // ms between rebuilds during transitions

  constructor(options: AvatarOptions) {
    super()
    this.options = {
      container: options.container,
      avatar: options.avatar,
      quality: options.quality ?? 'auto',
      assetsBaseUrl: options.assetsBaseUrl ?? './',
      cache: options.cache ?? true,
      renderer: options.renderer ?? 'mesh',
    }

    this.rendererType = options.renderer ?? 'mesh'
    this.qualityManager = new QualityManager(this.options.quality)
    this.blendshapeMixer = new BlendshapeMixer(DEFAULT_MIXER_PRIORITIES)
    this.idleSystem = new IdleSystem()
    this.emotionSystem = new EmotionSystem()
    this.gesturePlayer = new GesturePlayer()
    this.assetManager = new AssetManager(this.options.assetsBaseUrl, this.options.cache)

    this.qualityManager.onChange(() => {
      this.emit('performanceWarning', this.qualityManager.getMetrics(this.getCurrentFps()))
    })
  }

  async load(): Promise<void> {
    if (this.rendererType === 'splat') {
      await this.loadSplat()
    } else {
      await this.loadMesh()
    }
  }

  private async loadMesh(): Promise<void> {
    const quality = this.qualityManager.getCurrentTier()

    this.sceneManager = new SceneManager({
      container: this.options.container,
      quality,
    })

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

    const mixer = new THREE.AnimationMixer(avatarScene)
    this.gesturePlayer.setMixer(mixer)

    for (const clip of this.avatarModel.getAnimationClips()) {
      this.gesturePlayer.registerClip(clip.name, clip)
    }

    // Register procedural gestures (nod, wave, shrug) from skeleton bones
    registerProceduralGestures(avatarScene, (name, clip) => {
      if (!this.gesturePlayer.hasClip(name)) {
        this.gesturePlayer.registerClip(name, clip)
      }
    })

    this.gesturePlayer.onComplete((name) => {
      this.emit('gestureComplete', name)
    })

    this.idleSystem.start()

    this.sceneManager.onRender((delta) => this.onFrame(delta))
    this.sceneManager.startRenderLoop()

    this.loaded = true
    this.emit('loaded')
  }

  private async loadSplat(): Promise<void> {
    const quality = this.qualityManager.getCurrentTier()
    const avatarUrl = this.options.avatar
    const isStaticPly = avatarUrl.endsWith('.ply') || avatarUrl.endsWith('.splat') || avatarUrl.endsWith('.spz')

    this.splatScene = new SplatScene(this.options.container, quality)

    if (isStaticPly) {
      // Static mode: load PLY/SPLAT/SPZ directly with Spark (no FLAME)
      await this.splatScene.loadFromUrl(avatarUrl)
    } else {
      // Animated mode: load .lca with FLAME deformation pipeline
      const response = await fetch(avatarUrl)
      if (!response.ok) throw new Error(`Failed to load splat avatar from ${avatarUrl}`)
      const buffer = await response.arrayBuffer()

      this.splatAsset = new SplatAsset()
      await this.splatAsset.load(buffer)

      const gaussianData = this.splatAsset.getGaussianData()
      const binding = this.splatAsset.getBinding()

      const flameAssets = await this.loadFLAMEAssets()
      this.flameModel = new FLAMEModel(flameAssets)

      const mappings = await this.loadBlendshapeMappings()
      this.blendshapeToFlame = new BlendshapeToFLAME(mappings)

      const n = gaussianData.count
      this.gaussianUpdater = new GaussianUpdater(
        flameAssets.faces,
        binding.triangleIndices,
        gaussianData.positions,     // local xyz
        gaussianData.scales,        // local log scales
        gaussianData.rotations,     // local rotations (WXYZ)
      )
      this.gaussianPositions = new Float32Array(n * 3)
      this.gaussianLogScales = new Float32Array(n * 3)
      this.gaussianRotations = new Float32Array(n * 4)
      this.gaussianColors = gaussianData.colors
      this.gaussianOpacities = gaussianData.opacities

      // Do initial FLAME deform to get first frame
      const shape = this.splatAsset.getFLAMEShape()
      const neutralParams = this.blendshapeToFlame.convert({})
      const verts = this.flameModel.deform(shape, neutralParams)
      this.gaussianUpdater.updateFaceProperties(verts)
      this.gaussianUpdater.transformGaussians(this.gaussianPositions, this.gaussianLogScales, this.gaussianRotations)

      // Init Spark with the computed world-space data
      await this.splatScene.initBackend(n)
      await this.splatScene.updateFromTransform(
        this.gaussianPositions, this.gaussianLogScales, this.gaussianRotations,
        this.gaussianColors, this.gaussianOpacities,
      )
    }

    this.idleSystem.start()
    this.splatScene.onRender((delta) => this.onSplatFrame(delta))
    this.splatScene.startRenderLoop()

    this.loaded = true
    this.emit('loaded')
  }

  // --- High-Level API ---

  async speak(audio: AudioBuffer, options: SpeakOptions = {}): Promise<void> {
    this.ensureLoaded()

    if (!this.audioAnalyzer) {
      const ctx = new AudioContext()
      this.audioAnalyzer = new AudioAnalyzer(ctx)
      this.lipSyncEngine = new LipSyncEngine(ctx)
      this.lipSyncEngine.connectAnalyser(this.audioAnalyzer.getAnalyser())
    }

    if (options.emotion) {
      this.setEmotion(options.emotion, { transition: 200 })
    }

    this.speaking = true
    this.emit('speakStart')

    const gestureTimeouts: ReturnType<typeof setTimeout>[] = []
    if (options.gestures) {
      for (const g of options.gestures) {
        gestureTimeouts.push(setTimeout(() => this.playGesture(g.name), g.time * 1000))
      }
    }

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
    this.splatDirty = true
  }

  clearEmotion(options?: TransitionOptions): void {
    this.emotionSystem.clearEmotion(options)
    this.idleSystem.setBlinkRateMultiplier(1.0)
    this.idleSystem.setBreathingRateMultiplier(1.0)
    this.splatDirty = true
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
    this.splatScene?.dispose()
    this.audioAnalyzer?.dispose()
    this.idleSystem.stop()
    this.blendshapeMixer.clearAll()
    this.removeAllListeners()
    this.loaded = false
  }

  // --- Internal ---

  private onFrame(delta: number): void {
    const now = performance.now()
    if (this.lastFrameTime > 0) {
      const fps = 1000 / (now - this.lastFrameTime)
      this.qualityManager.recordFps(fps)
    }
    this.lastFrameTime = now

    const lipSyncWeights = this.speaking && this.lipSyncEngine ? this.lipSyncEngine.update() : {}
    const idleWeights = this.idleSystem.update(delta)
    const emotionWeights = this.emotionSystem.update(delta)

    this.blendshapeMixer.setChannel('lipSync', lipSyncWeights)
    this.blendshapeMixer.setChannel('idle', idleWeights)
    this.blendshapeMixer.setChannel('emotion', emotionWeights)

    const finalWeights = this.blendshapeMixer.mix()
    this.avatarModel?.applyBlendshapes(finalWeights)

    const drift = this.idleSystem.getHeadDrift()
    const emotionMods = this.emotionSystem.getCurrentModifiers()
    this.avatarModel?.setHeadRotation(
      drift.pitch + emotionMods.headPitchOffset,
      drift.yaw + emotionMods.headYawOffset,
      drift.roll,
    )

    this.gesturePlayer.update(delta)
  }

  private onSplatFrame(delta: number): void {
    const now = performance.now()
    if (this.lastFrameTime > 0) {
      this.qualityManager.recordFps(1000 / (now - this.lastFrameTime))
    }
    this.lastFrameTime = now

    // Static PLY mode — no FLAME pipeline, just render
    if (!this.blendshapeToFlame || !this.flameModel || !this.gaussianUpdater) return

    const lipSyncWeights = this.speaking && this.lipSyncEngine ? this.lipSyncEngine.update() : {}
    const idleWeights = this.idleSystem.update(delta)
    const emotionWeights = this.emotionSystem.update(delta)

    this.blendshapeMixer.setChannel('lipSync', lipSyncWeights)
    this.blendshapeMixer.setChannel('idle', idleWeights)
    this.blendshapeMixer.setChannel('emotion', emotionWeights)

    const finalWeights = this.blendshapeMixer.mix()
    const flameParams = this.blendshapeToFlame.convert(finalWeights)

    // Mark dirty if any weights are non-zero (emotion transitioning, speaking, etc.)
    const hasActivity = Object.keys(emotionWeights).length > 0 || Object.keys(lipSyncWeights).length > 0
    if (hasActivity) this.splatDirty = true

    // Apply head drift from idle + emotion
    const drift = this.idleSystem.getHeadDrift()
    const emotionMods = this.emotionSystem.getCurrentModifiers()
    flameParams.neckPose[0] = (drift.pitch + emotionMods.headPitchOffset) * Math.PI / 180
    flameParams.neckPose[1] = (drift.yaw + emotionMods.headYawOffset) * Math.PI / 180
    flameParams.neckPose[2] = drift.roll * Math.PI / 180

    // FLAME deform → face properties → Gaussian transform
    const verts = this.flameModel.deform(this.splatAsset!.getFLAMEShape(), flameParams)
    this.gaussianUpdater.updateFaceProperties(verts)
    this.gaussianUpdater.transformGaussians(
      this.gaussianPositions!, this.gaussianLogScales!, this.gaussianRotations!,
    )

    // Rebuild SplatMesh when expression changed, throttled to avoid flooding
    const now2 = performance.now()
    const timeSinceRebuild = now2 - this.splatLastRebuild
    if (this.splatDirty && !this.splatRebuilding && timeSinceRebuild > this.splatRebuildInterval) {
      this.splatDirty = false
      this.splatRebuilding = true
      this.splatLastRebuild = now2
      this.splatScene!.updateFromTransform(
        this.gaussianPositions!, this.gaussianLogScales!, this.gaussianRotations!,
        this.gaussianColors!, this.gaussianOpacities!,
      ).then(() => {
        this.splatRebuilding = false
      })
    }
  }

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
    this.entries.sort((a, b) => a.time - b.time)

    const timeouts: ReturnType<typeof setTimeout>[] = []
    for (const entry of this.entries) {
      timeouts.push(setTimeout(() => entry.action(this.avatar), entry.time * 1000))
    }

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
