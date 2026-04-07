export type { ARKitBlendshapeName, OculusVisemeName, BlendshapeName, BlendshapeMap } from './blendshapes.js'
export { ARKIT_BLENDSHAPES, OCULUS_VISEMES, MOUTH_BLENDSHAPES, EYE_BLENDSHAPES } from './blendshapes.js'
import type { EmotionName } from './emotions.js'
export type { EmotionName, EmotionPreset } from './emotions.js'
export { EMOTION_PRESETS } from './emotions.js'

export type QualityTier = 'high' | 'medium' | 'low'

export interface AvatarOptions {
  container: HTMLElement
  avatar: string
  quality?: QualityTier | 'auto'
  assetsBaseUrl?: string
  cache?: boolean
}

export interface SpeakOptions {
  emotion?: EmotionName
  gestures?: Array<{ time: number; name: string }>
}

export interface EmotionOptions {
  intensity?: number
  transition?: number
}

export interface TransitionOptions {
  transition?: number
}

export interface BoneRotation {
  pitch: number
  yaw: number
  roll: number
}

export type AvatarEventMap = {
  loaded: []
  speakStart: []
  speakEnd: []
  gestureComplete: [name: string]
  error: [error: Error]
  performanceWarning: [metrics: PerformanceMetrics]
}

export type AvatarEvent = keyof AvatarEventMap

export interface PerformanceMetrics {
  fps: number
  gpuMemoryMB: number
  jsHeapMB: number
  qualityTier: QualityTier
}

export interface MixerPriorities {
  lipSync: number
  emotion: number
  idle: number
  gesture: number
  direct: number
}

export const DEFAULT_MIXER_PRIORITIES: MixerPriorities = {
  lipSync: 1.0,
  emotion: 0.8,
  idle: 0.3,
  gesture: 0.6,
  direct: 1.0,
}

export interface AssetManifest {
  version: string
  avatars: Record<string, AvatarManifestEntry>
  gestures: Record<string, GestureManifestEntry>
}

export interface AvatarManifestEntry {
  name: string
  variants: {
    high?: string
    medium?: string
    low?: string
  }
  thumbnail?: string
}

export interface GestureManifestEntry {
  url: string
  size: number
}

export type AnimationChannel = 'lipSync' | 'emotion' | 'idle' | 'gesture' | 'direct'
