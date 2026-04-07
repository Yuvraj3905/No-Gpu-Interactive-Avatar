import type { BlendshapeMap } from './blendshapes.js'

export type EmotionName = 'neutral' | 'happy' | 'sad' | 'angry' | 'surprised' | 'thinking' | 'disgusted' | 'fearful'

export interface EmotionPreset {
  blendshapes: BlendshapeMap
  blinkRateMultiplier: number
  headPitchOffset: number
  headYawOffset: number
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
