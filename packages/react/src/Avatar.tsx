import { useRef, useEffect, useImperativeHandle, forwardRef } from 'react'
import { LowCostAvatar } from 'low-cost-avatar'
import type {
  AvatarOptions, SpeakOptions, EmotionName, EmotionOptions,
  TransitionOptions, BlendshapeMap, BoneRotation,
} from 'low-cost-avatar'

export interface AvatarProps {
  avatar: string
  quality?: AvatarOptions['quality']
  assetsBaseUrl?: string
  cache?: boolean
  className?: string
  style?: React.CSSProperties
  onLoaded?: () => void
  onSpeakStart?: () => void
  onSpeakEnd?: () => void
  onGestureComplete?: (name: string) => void
  onError?: (error: Error) => void
}

export interface AvatarHandle {
  speak: (audio: AudioBuffer, options?: SpeakOptions) => Promise<void>
  setEmotion: (emotion: EmotionName, options?: EmotionOptions) => void
  clearEmotion: (options?: TransitionOptions) => void
  playGesture: (name: string) => boolean
  stopGesture: (options?: TransitionOptions) => void
  setIdle: (enabled: boolean) => void
  setBlendshapes: (weights: BlendshapeMap) => void
  setBoneRotation: (bone: string, rotation: BoneRotation) => void
  getInstance: () => LowCostAvatar | null
}

export const Avatar = forwardRef<AvatarHandle, AvatarProps>(function Avatar(props, ref) {
  const containerRef = useRef<HTMLDivElement>(null)
  const instanceRef = useRef<LowCostAvatar | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const avatar = new LowCostAvatar({
      container: containerRef.current,
      avatar: props.avatar,
      quality: props.quality,
      assetsBaseUrl: props.assetsBaseUrl,
      cache: props.cache,
    })

    instanceRef.current = avatar

    if (props.onLoaded) avatar.on('loaded', props.onLoaded)
    if (props.onSpeakStart) avatar.on('speakStart', props.onSpeakStart)
    if (props.onSpeakEnd) avatar.on('speakEnd', props.onSpeakEnd)
    if (props.onGestureComplete) avatar.on('gestureComplete', props.onGestureComplete)
    if (props.onError) avatar.on('error', props.onError)

    avatar.load().catch((err) => {
      props.onError?.(err instanceof Error ? err : new Error(String(err)))
    })

    return () => {
      avatar.destroy()
      instanceRef.current = null
    }
  }, [props.avatar, props.quality, props.assetsBaseUrl, props.cache])

  useImperativeHandle(ref, () => ({
    speak: (audio, options) => instanceRef.current?.speak(audio, options) ?? Promise.resolve(),
    setEmotion: (emotion, options) => instanceRef.current?.setEmotion(emotion, options),
    clearEmotion: (options) => instanceRef.current?.clearEmotion(options),
    playGesture: (name) => instanceRef.current?.playGesture(name) ?? false,
    stopGesture: (options) => instanceRef.current?.stopGesture(options),
    setIdle: (enabled) => instanceRef.current?.setIdle(enabled),
    setBlendshapes: (weights) => instanceRef.current?.setBlendshapes(weights),
    setBoneRotation: (bone, rotation) => instanceRef.current?.setBoneRotation(bone, rotation),
    getInstance: () => instanceRef.current,
  }), [])

  return (
    <div
      ref={containerRef}
      className={props.className}
      style={{ width: '100%', height: '100%', ...props.style }}
    />
  )
})
