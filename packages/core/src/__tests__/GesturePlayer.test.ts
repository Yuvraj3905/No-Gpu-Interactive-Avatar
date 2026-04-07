import { describe, it, expect } from 'vitest'
import { GesturePlayer } from '../animation/GesturePlayer.js'
import * as THREE from 'three'

describe('GesturePlayer', () => {
  function createMockMixer() {
    const mixer = new THREE.AnimationMixer(new THREE.Object3D())
    return mixer
  }

  it('creates without error', () => {
    const player = new GesturePlayer()
    expect(player).toBeDefined()
  })

  it('registers a clip by name', () => {
    const player = new GesturePlayer()
    const clip = new THREE.AnimationClip('nod', 1.0, [])
    player.registerClip('nod', clip)
    expect(player.hasClip('nod')).toBe(true)
  })

  it('hasClip returns false for unregistered names', () => {
    const player = new GesturePlayer()
    expect(player.hasClip('unknown')).toBe(false)
  })

  it('play returns false for unregistered clip', () => {
    const mixer = createMockMixer()
    const player = new GesturePlayer()
    player.setMixer(mixer)
    const result = player.play('unknown')
    expect(result).toBe(false)
  })

  it('play returns true for registered clip', () => {
    const mixer = createMockMixer()
    const player = new GesturePlayer()
    player.setMixer(mixer)
    const clip = new THREE.AnimationClip('wave', 1.5, [])
    player.registerClip('wave', clip)
    const result = player.play('wave')
    expect(result).toBe(true)
  })

  it('stop does not throw when nothing is playing', () => {
    const player = new GesturePlayer()
    expect(() => player.stop()).not.toThrow()
  })
})
