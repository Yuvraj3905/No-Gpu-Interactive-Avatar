import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { GaussianData } from './types.js'
import type { QualityTier } from '../../types/index.js'

/**
 * SplatScene uses @sparkjsdev/spark's SplatMesh for rendering Gaussian splats.
 * Spark handles depth sorting, WebGPU/WebGL rendering, and proper alpha blending.
 *
 * We use PackedSplats to construct Gaussians from our .lca data, and the
 * onFrame callback to update positions each frame from FLAME deformation.
 */
export class SplatScene {
  private container: HTMLElement
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private animationFrameId: number | null = null
  private onRenderCallback: ((delta: number) => void) | null = null
  private lastTime = 0
  private resizeObserver: ResizeObserver | null = null

  private controls: OrbitControls | null = null

  // Spark splat mesh
  private splatMesh: any = null
  private packedSplats: any = null
  private gaussianCount = 0

  // Stored Gaussian data for updates
  private colors: Float32Array | null = null
  private opacities: Float32Array | null = null
  private scales: Float32Array | null = null

  constructor(container: HTMLElement, quality: QualityTier) {
    this.container = container

    // Three.js setup
    this.scene = new THREE.Scene()

    const aspect = container.clientWidth / container.clientHeight
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.01, 1000)
    this.camera.position.set(0, 0, 3)
    this.camera.lookAt(0, 0, 0)

    this.renderer = new THREE.WebGLRenderer({
      antialias: quality === 'high',
      alpha: true,
      powerPreference: quality === 'low' ? 'low-power' : 'high-performance',
    })
    this.renderer.setSize(container.clientWidth, container.clientHeight)
    this.renderer.setPixelRatio(quality === 'low' ? 1 : Math.min(window.devicePixelRatio, 2))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    container.appendChild(this.renderer.domElement)

    // Orbit controls for interactive viewing
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.target.set(0, 0, 0)

    // Lighting for any non-splat objects
    const ambient = new THREE.AmbientLight(0xffffff, 0.5)
    this.scene.add(ambient)

    this.resizeObserver = new ResizeObserver(() => this.handleResize())
    this.resizeObserver.observe(container)
  }

  /**
   * Load a static PLY/SPLAT/SPZ file directly with Spark.
   * No FLAME deformation — just render as-is.
   */
  async loadFromUrl(url: string): Promise<void> {
    try {
      const spark = await import('@sparkjsdev/spark')
      this.splatMesh = new spark.SplatMesh({ url })
      this.scene.add(this.splatMesh)
    } catch (err) {
      throw new Error(`Failed to load splat from ${url}: ${err}`)
    }
  }

  async initBackend(gaussianCount: number): Promise<void> {
    this.gaussianCount = gaussianCount
    // Just store the count — actual mesh creation happens in buildSplatMesh
  }

  uploadGaussians(data: GaussianData): void {
    if (!this.packedSplats) return

    this.colors = data.colors
    this.opacities = data.opacities
    this.scales = data.scales

    const center = new THREE.Vector3()
    const scale = new THREE.Vector3()
    const quat = new THREE.Quaternion()
    const color = new THREE.Color()

    for (let i = 0; i < data.count; i++) {
      center.set(data.positions[i * 3], data.positions[i * 3 + 1], data.positions[i * 3 + 2])
      scale.set(
        Math.exp(data.scales[i * 3]),
        Math.exp(data.scales[i * 3 + 1]),
        Math.exp(data.scales[i * 3 + 2]),
      )
      quat.set(data.rotations[i * 4], data.rotations[i * 4 + 1], data.rotations[i * 4 + 2], data.rotations[i * 4 + 3])
      quat.normalize()

      const opacity = 1 / (1 + Math.exp(-data.opacities[i])) // sigmoid

      color.setRGB(data.colors[i * 3], data.colors[i * 3 + 1], data.colors[i * 3 + 2])

      this.packedSplats.setSplat(i, center, scale, quat, opacity, color)
    }

    this.packedSplats.needsUpdate = true
  }

  updatePositions(positions: Float32Array, rotations: Float32Array): void {
    if (!this.packedSplats || !this.colors || !this.opacities || !this.scales) return

    const center = new THREE.Vector3()
    const scale = new THREE.Vector3()
    const quat = new THREE.Quaternion()
    const color = new THREE.Color()

    for (let i = 0; i < this.gaussianCount; i++) {
      center.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2])
      scale.set(
        Math.exp(this.scales[i * 3]),
        Math.exp(this.scales[i * 3 + 1]),
        Math.exp(this.scales[i * 3 + 2]),
      )
      quat.set(rotations[i * 4], rotations[i * 4 + 1], rotations[i * 4 + 2], rotations[i * 4 + 3])
      quat.normalize()

      const opacity = 1 / (1 + Math.exp(-this.opacities[i]))
      color.setRGB(this.colors[i * 3], this.colors[i * 3 + 1], this.colors[i * 3 + 2])

      this.packedSplats.setSplat(i, center, scale, quat, opacity, color)
    }

    this.packedSplats.needsUpdate = true
  }

  /**
   * Build (or rebuild) the SplatMesh from pre-computed world-space transforms.
   * Creates a fresh PackedSplats + SplatMesh each call.
   */
  async updateFromTransform(
    positions: Float32Array,
    logScales: Float32Array,
    rotations: Float32Array,
    colors: Float32Array,
    opacities: Float32Array,
  ): Promise<void> {
    // Remove old mesh
    if (this.splatMesh) {
      this.scene.remove(this.splatMesh)
      this.splatMesh.dispose?.()
      this.splatMesh = null
    }

    const spark = await import('@sparkjsdev/spark')
    const ps = new spark.PackedSplats()
    this.packedSplats = ps

    const center = new THREE.Vector3()
    const scale = new THREE.Vector3()
    const quat = new THREE.Quaternion()
    const color = new THREE.Color()

    for (let i = 0; i < this.gaussianCount; i++) {
      center.set(positions[i*3], positions[i*3+1], positions[i*3+2])
      scale.set(Math.exp(logScales[i*3]), Math.exp(logScales[i*3+1]), Math.exp(logScales[i*3+2]))
      quat.set(rotations[i*4+1], rotations[i*4+2], rotations[i*4+3], rotations[i*4])
      quat.normalize()
      const opa = 1 / (1 + Math.exp(-opacities[i]))
      color.setRGB(colors[i*3], colors[i*3+1], colors[i*3+2])
      ps.pushSplat(center, scale, quat, opa, color)
    }

    this.splatMesh = new spark.SplatMesh({ packedSplats: ps })
    this.scene.add(this.splatMesh)
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
      this.controls?.update()
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
    this.controls?.dispose()
    if (this.splatMesh) {
      this.scene.remove(this.splatMesh)
      this.splatMesh.dispose?.()
    }
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }

  private handleResize(): void {
    const w = this.container.clientWidth
    const h = this.container.clientHeight
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
  }
}
