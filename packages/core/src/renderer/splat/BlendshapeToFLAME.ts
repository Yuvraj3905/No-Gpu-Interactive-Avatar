import type { BlendshapeMap, BlendshapeName } from '../../types/index.js'
import { ARKIT_BLENDSHAPES, OCULUS_VISEMES } from '../../types/index.js'
import type { BlendshapeToFLAMEMappings, FLAMEParams } from './types.js'

const ARKIT_INDEX = new Map<BlendshapeName, number>()
ARKIT_BLENDSHAPES.forEach((name, i) => ARKIT_INDEX.set(name, i))
OCULUS_VISEMES.forEach((name, i) => ARKIT_INDEX.set(name, ARKIT_BLENDSHAPES.length + i))

const EYE_BLENDSHAPE_NAMES: BlendshapeName[] = [
  'eyeBlinkLeft', 'eyeLookDownLeft', 'eyeLookInLeft', 'eyeLookOutLeft',
  'eyeLookUpLeft', 'eyeSquintLeft', 'eyeWideLeft',
  'eyeBlinkRight', 'eyeLookDownRight', 'eyeLookInRight', 'eyeLookOutRight',
  'eyeLookUpRight', 'eyeSquintRight', 'eyeWideRight',
]

export class BlendshapeToFLAME {
  private mappings: BlendshapeToFLAMEMappings
  private arkitVector = new Float32Array(67)
  private visemeVector = new Float32Array(15)
  private eyeVector = new Float32Array(14)
  private result: FLAMEParams = {
    expression: new Float32Array(100),
    jawPose: new Float32Array(3),
    neckPose: new Float32Array(3),
    eyePose: new Float32Array(6),
  }

  constructor(mappings: BlendshapeToFLAMEMappings) {
    this.mappings = mappings
  }

  convert(weights: BlendshapeMap): FLAMEParams {
    this.arkitVector.fill(0)
    this.visemeVector.fill(0)
    this.eyeVector.fill(0)
    this.result.expression.fill(0)
    this.result.jawPose.fill(0)
    this.result.neckPose.fill(0)
    this.result.eyePose.fill(0)

    for (const [name, value] of Object.entries(weights) as [BlendshapeName, number][]) {
      const arkitIdx = ARKIT_INDEX.get(name)
      if (arkitIdx !== undefined) {
        this.arkitVector[arkitIdx] = value
      }

      const visemeIdx = OCULUS_VISEMES.indexOf(name as typeof OCULUS_VISEMES[number])
      if (visemeIdx >= 0) {
        this.visemeVector[visemeIdx] = value
      }

      const eyeIdx = EYE_BLENDSHAPE_NAMES.indexOf(name)
      if (eyeIdx >= 0) {
        this.eyeVector[eyeIdx] = value
      }
    }

    matVecMul(this.mappings.arkitToExpr, this.arkitVector, this.result.expression, 67, 100)
    matVecMul(this.mappings.visemeToJaw, this.visemeVector, this.result.jawPose, 15, 3)
    matVecMul(this.mappings.eyeToPose, this.eyeVector, this.result.eyePose, 14, 6)

    // Clamp to real FLAME ranges (from training data analysis):
    // expressions: [-7, 7], jaw: [-0.15, 0.4], eye: [-0.3, 0.3]
    for (let i = 0; i < 100; i++) {
      this.result.expression[i] = Math.max(-7, Math.min(7, this.result.expression[i]))
    }
    for (let i = 0; i < 3; i++) {
      this.result.jawPose[i] = Math.max(-0.15, Math.min(0.4, this.result.jawPose[i]))
    }
    for (let i = 0; i < 6; i++) {
      this.result.eyePose[i] = Math.max(-0.3, Math.min(0.3, this.result.eyePose[i]))
    }

    return this.result
  }
}

function matVecMul(
  mat: Float32Array,
  vec: Float32Array,
  out: Float32Array,
  rows: number,
  cols: number,
): void {
  for (let i = 0; i < rows; i++) {
    const v = vec[i]
    if (Math.abs(v) < 1e-7) continue
    const rowOffset = i * cols
    for (let j = 0; j < cols; j++) {
      out[j] += mat[rowOffset + j] * v
    }
  }
}
