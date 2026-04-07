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
