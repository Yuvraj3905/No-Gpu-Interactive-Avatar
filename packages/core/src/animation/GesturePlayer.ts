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
