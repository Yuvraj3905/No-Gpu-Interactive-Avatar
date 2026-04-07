# Low-Cost Avatar

Client-side avatar rendering SDK that eliminates server GPU costs. Render realistic 3D avatars with lip-sync, emotions, and gestures entirely in the browser.

## The Problem

Interactive AI avatars today cost $0.05-0.32/min because every provider renders video server-side on GPUs and streams it via WebRTC. This adds 600-3000ms of latency per interaction.

## Our Approach

Move all visual rendering to the client's browser using Three.js + GLB models with blendshapes. Only text and audio cross the network. The client's existing GPU handles rendering for free.

- **Zero rendering cost** — no server GPU needed
- **70-250ms less latency** — no video encoding/streaming round-trip
- **Offline capable** — assets cached locally in IndexedDB after first load

## Quick Start

```bash
npm install low-cost-avatar three
```

```js
import { LowCostAvatar } from 'low-cost-avatar'

const avatar = new LowCostAvatar({
  container: document.getElementById('avatar'),
  avatar: './my-avatar.glb',
  quality: 'auto',
})

await avatar.load()

// Speak with lip-sync
await avatar.speak(audioBuffer, {
  emotion: 'happy',
  gestures: [{ time: 0.5, name: 'nod' }],
})

// Set emotions
avatar.setEmotion('thinking', { intensity: 0.7, transition: 500 })

// Play gestures
avatar.playGesture('wave')
```

## React

```bash
npm install low-cost-avatar @low-cost-avatar/react three
```

```tsx
import { useRef } from 'react'
import { Avatar, type AvatarHandle } from '@low-cost-avatar/react'

function App() {
  const avatarRef = useRef<AvatarHandle>(null)

  return (
    <Avatar
      ref={avatarRef}
      avatar="./my-avatar.glb"
      quality="auto"
      onLoaded={() => console.log('Ready!')}
      onError={(err) => console.error(err)}
      style={{ width: 400, height: 500 }}
    />
  )
}
```

## Avatar Requirements

The SDK works with GLB/GLTF files that include:

- **52 ARKit facial blendshapes** (for expressions)
- **15 Oculus viseme blendshapes** (for lip-sync)
- **Skeleton with head bone** (for head movement)

[Ready Player Me](https://readyplayer.me/) avatars include these blendshapes out of the box.

You can also use any custom GLB — pass a URL or local path as the `avatar` option.

## API

### High-Level

```js
// Speak — streams audio with automatic lip-sync
await avatar.speak(audioBuffer, {
  emotion: 'happy',                          // optional emotion during speech
  gestures: [{ time: 1.0, name: 'nod' }],   // optional timed gestures
})

// Emotions — smooth crossfade transitions
avatar.setEmotion('sad', { intensity: 0.6, transition: 400 })
avatar.clearEmotion({ transition: 300 })

// Gestures — skeletal animation playback
avatar.playGesture('wave')
avatar.stopGesture({ transition: 200 })

// Idle — toggle procedural animations (blinks, breathing, micro-saccades)
avatar.setIdle(true)
avatar.setIdle(false)
```

### Low-Level (Power Users)

```js
// Direct blendshape control
avatar.setBlendshapes({
  mouthSmileLeft: 0.8,
  mouthSmileRight: 0.8,
})

// Bone manipulation
avatar.setBoneRotation('head', { pitch: 5, yaw: -10, roll: 0 })

// Animation timeline
const timeline = avatar.createTimeline()
timeline.at(0.0).setEmotion('neutral')
timeline.at(0.5).setBlendshapes({ browInnerUp: 0.6 })
timeline.at(1.0).playGesture('nod')
timeline.at(2.5).setEmotion('happy')
await timeline.play(audioBuffer)
```

### Events

```js
avatar.on('loaded', () => {})
avatar.on('speakStart', () => {})
avatar.on('speakEnd', () => {})
avatar.on('gestureComplete', (name) => {})
avatar.on('error', (err) => {})
avatar.on('performanceWarning', (metrics) => {})
```

### Backend Integration

The SDK is backend-agnostic. Wire your own WebSocket/REST backend:

```js
const ws = new WebSocket('wss://your-backend.com/avatar')

ws.onmessage = (event) => {
  const cmd = JSON.parse(event.data)
  switch (cmd.type) {
    case 'speak':
      avatar.speak(decodeAudio(cmd.audio), cmd.options)
      break
    case 'emotion':
      avatar.setEmotion(cmd.emotion, cmd.options)
      break
    case 'gesture':
      avatar.playGesture(cmd.name)
      break
  }
}
```

## Built-in Emotions

`neutral`, `happy`, `sad`, `angry`, `surprised`, `thinking`, `disgusted`, `fearful`

Each emotion includes blendshape presets and affects idle behavior (blink rate, head tilt, breathing rate).

## Auto Quality

The SDK automatically selects a quality tier based on device capabilities and adapts at runtime:

| Tier | Features |
|---|---|
| **High** | Full blendshapes, all idle behaviors, high-res textures, MSAA |
| **Medium** | Full blendshapes, reduced idle, medium textures |
| **Low** | Core visemes only, minimal idle, low-res textures |

If FPS drops below thresholds for sustained periods, the SDK automatically downgrades — invisible to your code.

## Animation Systems

Five independent systems run simultaneously and are blended each frame:

1. **Lip-Sync** — Web Audio frequency analysis maps to 15 Oculus visemes in real-time
2. **Idle** — Procedural blinks (2-6s intervals), breathing, micro-saccades, head drift
3. **Emotions** — Blendshape presets with smooth crossfade transitions
4. **Gestures** — Skeletal animation clips with crossfade
5. **Direct** — Low-level blendshape/bone control for power users

The BlendshapeMixer combines them with priority weights (lip-sync wins for mouth, emotions win for eyes, idle fills the rest).

## Project Structure

```
low-cost-avatar/
  packages/
    core/          # Main SDK (npm: low-cost-avatar)
    react/         # React wrapper (npm: @low-cost-avatar/react)
  examples/
    vanilla/       # Plain HTML + JS demo
```

## Development

```bash
# Install
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Lint
pnpm lint

# Type check
pnpm typecheck

# Run vanilla example
cd examples/vanilla && pnpm dev
```

## Device Support

- Desktop + modern mobile (Chrome, Firefox, Safari — last 3 years)
- Requires WebGL 2.0 + Web Audio API

## License

MIT
