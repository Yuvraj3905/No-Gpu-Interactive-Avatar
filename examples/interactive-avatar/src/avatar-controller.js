import { LowCostAvatar } from 'low-cost-avatar'

const VISEME_MAP = {
  open:    { jawOpen: 0.5, viseme_aa: 0.5 },
  wide:    { viseme_E: 0.5, mouthSmileLeft: 0.15, mouthSmileRight: 0.15 },
  round:   { mouthFunnel: 0.4, viseme_O: 0.5 },
  closed:  { viseme_PP: 0.6, mouthClose: 0.3 },
  narrow:  { viseme_SS: 0.5 },
  teeth:   { viseme_FF: 0.5 },
  default: { jawOpen: 0.2, viseme_DD: 0.3 },
}

export class AvatarController {
  constructor(container) {
    this.container = container
    this.avatar = null
  }

  async init() {
    this.avatar = new LowCostAvatar({
      container: this.container,
      avatar: './sample-avatar.glb',
      quality: 'auto',
      cache: true,
    })
    await this.avatar.load()

    // Zoom camera to head+shoulders framing (hides T-pose arms)
    const scene = this.avatar.sceneManager
    if (scene) {
      const cam = scene.getCamera()
      cam.position.set(0, 1.45, 1.1)
      cam.lookAt(0, 1.4, 0)
      cam.updateProjectionMatrix()
    }
  }

  setEmotion(name, intensity = 0.8) {
    this.avatar.setEmotion(name, { intensity, transition: 400 })
  }

  clearEmotion() {
    this.avatar.clearEmotion({ transition: 500 })
  }

  setViseme(visemeName, weight = 0.7) {
    const shapes = VISEME_MAP[visemeName] || VISEME_MAP.default
    const scaled = {}
    for (const [k, v] of Object.entries(shapes)) {
      scaled[k] = v * weight
    }
    this.avatar.setBlendshapes(scaled)
  }

  setMouthOpen(amount) {
    if (amount < 0.01) {
      this.closeMouth()
      return
    }
    this.avatar.setBlendshapes({
      jawOpen: amount * 0.6,
      viseme_aa: amount * 0.3,
    })
  }

  closeMouth() {
    this.avatar.clearBlendshapes()
  }

  playGesture(name) {
    this.avatar.playGesture(name)
  }

  destroy() {
    this.avatar?.destroy()
  }
}
