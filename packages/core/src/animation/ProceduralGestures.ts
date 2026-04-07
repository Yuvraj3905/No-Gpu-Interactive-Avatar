import * as THREE from 'three'

/**
 * Creates procedural animation clips for common gestures.
 * Works with any Mixamo-compatible humanoid skeleton (RPM, Avaturn, etc.)
 *
 * Standard Mixamo bone names:
 *   Head, Neck, Spine, Spine1, Spine2,
 *   RightShoulder, RightArm, RightForeArm, RightHand,
 *   LeftShoulder, LeftArm, LeftForeArm, LeftHand
 */

interface BoneMap {
  [name: string]: THREE.Bone
}

export function findBones(root: THREE.Object3D): BoneMap {
  const bones: BoneMap = {}
  root.traverse((obj) => {
    if (obj instanceof THREE.Bone) {
      bones[obj.name] = obj
    }
  })
  return bones
}

function findBoneByHint(bones: BoneMap, hints: string[]): string | null {
  for (const hint of hints) {
    for (const name of Object.keys(bones)) {
      if (name.toLowerCase().includes(hint.toLowerCase())) {
        return name
      }
    }
  }
  return null
}

export function createNodClip(bones: BoneMap): THREE.AnimationClip | null {
  const headName = findBoneByHint(bones, ['Head'])
  if (!headName) return null

  const times = [0, 0.3, 0.6, 0.9, 1.2]
  const values = [
    0, 0, 0, 1,        // neutral
    0.15, 0, 0, 0.99,  // nod down
    0, 0, 0, 1,        // back up
    0.12, 0, 0, 0.99,  // smaller nod
    0, 0, 0, 1,        // neutral
  ]

  const track = new THREE.QuaternionKeyframeTrack(
    `${headName}.quaternion`,
    times,
    values,
  )

  return new THREE.AnimationClip('nod', 1.2, [track])
}

export function createWaveClip(bones: BoneMap): THREE.AnimationClip | null {
  const rightArmName = findBoneByHint(bones, ['RightArm', 'Right_Arm', 'rightArm'])
  const rightForeArmName = findBoneByHint(bones, ['RightForeArm', 'Right_ForeArm', 'rightForeArm'])
  const rightHandName = findBoneByHint(bones, ['RightHand', 'Right_Hand', 'rightHand'])

  if (!rightArmName) return null

  const tracks: THREE.KeyframeTrack[] = []

  // Raise arm
  const armTimes = [0, 0.4, 1.6, 2.0]
  const armValues = [
    0, 0, 0, 1,                    // rest
    0, 0, -0.7, 0.71,              // arm raised (Z rotation)
    0, 0, -0.7, 0.71,              // hold
    0, 0, 0, 1,                    // back to rest
  ]
  tracks.push(new THREE.QuaternionKeyframeTrack(
    `${rightArmName}.quaternion`, armTimes, armValues,
  ))

  // Wave forearm
  if (rightForeArmName) {
    const forearmTimes = [0, 0.4, 0.6, 0.8, 1.0, 1.2, 1.4, 1.6, 2.0]
    const forearmValues = [
      0, 0, 0, 1,
      -0.3, 0, 0, 0.95,
      -0.3, 0.2, 0, 0.93,     // wave right
      -0.3, -0.2, 0, 0.93,    // wave left
      -0.3, 0.2, 0, 0.93,     // wave right
      -0.3, -0.2, 0, 0.93,    // wave left
      -0.3, 0.15, 0, 0.94,    // wave right (smaller)
      -0.3, 0, 0, 0.95,
      0, 0, 0, 1,
    ]
    tracks.push(new THREE.QuaternionKeyframeTrack(
      `${rightForeArmName}.quaternion`, forearmTimes, forearmValues,
    ))
  }

  // Spread hand
  if (rightHandName) {
    const handTimes = [0, 0.4, 1.6, 2.0]
    const handValues = [
      0, 0, 0, 1,
      0.2, 0, 0, 0.98,
      0.2, 0, 0, 0.98,
      0, 0, 0, 1,
    ]
    tracks.push(new THREE.QuaternionKeyframeTrack(
      `${rightHandName}.quaternion`, handTimes, handValues,
    ))
  }

  return new THREE.AnimationClip('wave', 2.0, tracks)
}

export function createShrugClip(bones: BoneMap): THREE.AnimationClip | null {
  const rightShoulderName = findBoneByHint(bones, ['RightShoulder', 'Right_Shoulder', 'rightShoulder'])
  const leftShoulderName = findBoneByHint(bones, ['LeftShoulder', 'Left_Shoulder', 'leftShoulder'])
  const headName = findBoneByHint(bones, ['Head'])

  if (!rightShoulderName && !leftShoulderName) return null

  const tracks: THREE.KeyframeTrack[] = []
  const times = [0, 0.3, 0.8, 1.2]

  // Raise both shoulders
  if (rightShoulderName) {
    tracks.push(new THREE.QuaternionKeyframeTrack(
      `${rightShoulderName}.quaternion`, times,
      [
        0, 0, 0, 1,
        0, 0, -0.1, 0.995,     // up
        0, 0, -0.1, 0.995,     // hold
        0, 0, 0, 1,            // down
      ],
    ))
  }

  if (leftShoulderName) {
    tracks.push(new THREE.QuaternionKeyframeTrack(
      `${leftShoulderName}.quaternion`, times,
      [
        0, 0, 0, 1,
        0, 0, 0.1, 0.995,      // up
        0, 0, 0.1, 0.995,      // hold
        0, 0, 0, 1,            // down
      ],
    ))
  }

  // Slight head tilt
  if (headName) {
    tracks.push(new THREE.QuaternionKeyframeTrack(
      `${headName}.quaternion`, times,
      [
        0, 0, 0, 1,
        0, 0, 0.05, 0.999,     // slight tilt
        0, 0, 0.05, 0.999,
        0, 0, 0, 1,
      ],
    ))
  }

  return new THREE.AnimationClip('shrug', 1.2, tracks)
}

export function registerProceduralGestures(
  root: THREE.Object3D,
  registerFn: (name: string, clip: THREE.AnimationClip) => void,
): void {
  const bones = findBones(root)

  const nod = createNodClip(bones)
  if (nod) registerFn('nod', nod)

  const wave = createWaveClip(bones)
  if (wave) registerFn('wave', wave)

  const shrug = createShrugClip(bones)
  if (shrug) registerFn('shrug', shrug)
}
