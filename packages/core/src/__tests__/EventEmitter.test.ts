import { describe, it, expect, vi } from 'vitest'
import { EventEmitter } from '../EventEmitter.js'
import type { AvatarEventMap } from '../types/index.js'

describe('EventEmitter', () => {
  it('calls registered listener when event is emitted', () => {
    const emitter = new EventEmitter<AvatarEventMap>()
    const listener = vi.fn()
    emitter.on('loaded', listener)
    emitter.emit('loaded')
    expect(listener).toHaveBeenCalledOnce()
  })

  it('passes arguments to listeners', () => {
    const emitter = new EventEmitter<AvatarEventMap>()
    const listener = vi.fn()
    emitter.on('gestureComplete', listener)
    emitter.emit('gestureComplete', 'wave')
    expect(listener).toHaveBeenCalledWith('wave')
  })

  it('removes listener with off()', () => {
    const emitter = new EventEmitter<AvatarEventMap>()
    const listener = vi.fn()
    emitter.on('loaded', listener)
    emitter.off('loaded', listener)
    emitter.emit('loaded')
    expect(listener).not.toHaveBeenCalled()
  })

  it('supports multiple listeners per event', () => {
    const emitter = new EventEmitter<AvatarEventMap>()
    const a = vi.fn()
    const b = vi.fn()
    emitter.on('speakStart', a)
    emitter.on('speakStart', b)
    emitter.emit('speakStart')
    expect(a).toHaveBeenCalledOnce()
    expect(b).toHaveBeenCalledOnce()
  })

  it('removeAllListeners clears everything', () => {
    const emitter = new EventEmitter<AvatarEventMap>()
    const listener = vi.fn()
    emitter.on('loaded', listener)
    emitter.on('speakEnd', listener)
    emitter.removeAllListeners()
    emitter.emit('loaded')
    emitter.emit('speakEnd')
    expect(listener).not.toHaveBeenCalled()
  })
})
