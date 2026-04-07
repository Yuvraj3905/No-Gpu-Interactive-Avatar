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

    const aspect = this.container.clientWidth / this.container.clientHeight
    this.camera = new THREE.PerspectiveCamera(30, aspect, 0.1, 100)
    this.camera.position.set(0, 1.5, 1.5)
    this.camera.lookAt(0, 1.4, 0)

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
