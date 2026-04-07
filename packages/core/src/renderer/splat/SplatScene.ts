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
    if (typeof navigator !== 'undefined' && navigator.gpu) {
      try {
        this.backend = new WebGPUBackend()
        await this.backend.init(this.canvas, gaussianCount)
        return
      } catch {
        // Fall through to WebGL
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

  dispose(): void {
    this.stopRenderLoop()
    this.resizeObserver?.disconnect()
    this.backend?.dispose()
    this.canvas.remove()
  }

  private updateViewMatrix(): void {
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
