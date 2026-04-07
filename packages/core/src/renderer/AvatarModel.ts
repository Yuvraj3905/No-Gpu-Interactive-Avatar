import * as THREE from 'three'
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { BlendshapeMap } from '../types/index.js'

export class AvatarModel {
  private gltf: GLTF | null = null
  private meshesWithMorphs: THREE.Mesh[] = []
  private blendshapeIndices = new Map<string, Map<string, number>>()
  private headBone: THREE.Bone | null = null
  private skeleton: THREE.Skeleton | null = null

  async loadFromArrayBuffer(buffer: ArrayBuffer): Promise<THREE.Group> {
    const loader = new GLTFLoader()
    return new Promise((resolve, reject) => {
      loader.parse(buffer, '', (gltf) => {
        this.gltf = gltf
        this.indexBlendshapes(gltf.scene)
        this.findBones(gltf.scene)
        resolve(gltf.scene)
      }, (error) => {
        reject(new Error(`Failed to parse GLB: ${error}`))
      })
    })
  }

  applyBlendshapes(weights: BlendshapeMap): void {
    for (const mesh of this.meshesWithMorphs) {
      const indices = this.blendshapeIndices.get(mesh.uuid)
      if (!indices || !mesh.morphTargetInfluences) continue

      for (const [name, value] of Object.entries(weights)) {
        const index = indices.get(name)
        if (index !== undefined) {
          mesh.morphTargetInfluences[index] = value as number
        }
      }
    }
  }

  resetBlendshapes(): void {
    for (const mesh of this.meshesWithMorphs) {
      if (mesh.morphTargetInfluences) {
        mesh.morphTargetInfluences.fill(0)
      }
    }
  }

  setHeadRotation(pitch: number, yaw: number, roll: number): void {
    if (!this.headBone) return
    this.headBone.rotation.set(
      THREE.MathUtils.degToRad(pitch),
      THREE.MathUtils.degToRad(yaw),
      THREE.MathUtils.degToRad(roll),
    )
  }

  getHeadBone(): THREE.Bone | null {
    return this.headBone
  }

  getSkeleton(): THREE.Skeleton | null {
    return this.skeleton
  }

  getAnimationClips(): THREE.AnimationClip[] {
    return this.gltf?.animations ?? []
  }

  getAvailableBlendshapes(): string[] {
    const names = new Set<string>()
    for (const indices of this.blendshapeIndices.values()) {
      for (const name of indices.keys()) {
        names.add(name)
      }
    }
    return [...names]
  }

  dispose(): void {
    if (this.gltf) {
      this.gltf.scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose()
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose())
          } else {
            obj.material.dispose()
          }
        }
      })
    }
    this.meshesWithMorphs = []
    this.blendshapeIndices.clear()
    this.gltf = null
  }

  private indexBlendshapes(root: THREE.Object3D): void {
    root.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.morphTargetDictionary && obj.morphTargetInfluences) {
        this.meshesWithMorphs.push(obj)
        const indices = new Map<string, number>()
        for (const [name, index] of Object.entries(obj.morphTargetDictionary)) {
          indices.set(name, index)
        }
        this.blendshapeIndices.set(obj.uuid, indices)
      }
    })
  }

  private findBones(root: THREE.Object3D): void {
    root.traverse((obj) => {
      if (obj instanceof THREE.SkinnedMesh && obj.skeleton) {
        this.skeleton = obj.skeleton
      }
      if (obj instanceof THREE.Bone) {
        const name = obj.name.toLowerCase()
        if (name === 'head' || name.includes('head')) {
          if (!this.headBone) this.headBone = obj
        }
      }
    })
  }
}
