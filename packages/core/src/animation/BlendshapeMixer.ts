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
