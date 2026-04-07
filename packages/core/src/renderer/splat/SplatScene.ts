import * as THREE from 'three'
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
    this.camera = new THREE.PerspectiveCamera(30, aspect, 0.1, 100)
    this.camera.position.set(0, 1.5, 1.5)
    this.camera.lookAt(0, 1.4, 0)

    this.renderer = new THREE.WebGLRenderer({
      antialias: quality === 'high',
      alpha: true,
      powerPreference: quality === 'low' ? 'low-power' : 'high-performance',
    })
    this.renderer.setSize(container.clientWidth, container.clientHeight)
    this.renderer.setPixelRatio(quality === 'low' ? 1 : Math.min(window.devicePixelRatio, 2))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    container.appendChild(this.renderer.domElement)

    // Lighting for any non-splat objects
    const ambient = new THREE.AmbientLight(0xffffff, 0.5)
    this.scene.add(ambient)

    this.resizeObserver = new ResizeObserver(() => this.handleResize())
    this.resizeObserver.observe(container)
  }

  async initBackend(gaussianCount: number): Promise<void> {
    this.gaussianCount = gaussianCount
    // Spark is loaded dynamically to avoid import issues in Node/test environments
    try {
      const spark = await import('@sparkjsdev/spark')
      this.packedSplats = new spark.PackedSplats()
      // Pre-allocate with dummy data — will be overwritten by uploadGaussians
      const zeroVec3 = new THREE.Vector3(0, 0, 0)
      const identityQuat = new THREE.Quaternion(0, 0, 0, 1)
      const defaultScale = new THREE.Vector3(0.001, 0.001, 0.001)
      const black = new THREE.Color(0, 0, 0)
      for (let i = 0; i < gaussianCount; i++) {
        this.packedSplats.pushSplat(zeroVec3, defaultScale, identityQuat, 0, black)
      }

      this.splatMesh = new spark.SplatMesh({
        packedSplats: this.packedSplats,
      })
      this.scene.add(this.splatMesh)
    } catch (err) {
      throw new Error(`Failed to initialize Spark splat renderer: ${err}`)
    }
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
