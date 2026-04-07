#!/usr/bin/env python3
"""
Create ARKit-to-FLAME mapping matrices for BlendshapeToFLAME.ts

Requires: mediapipe-blendshapes-to-flame repo cloned locally
    git clone https://github.com/PeizhiYan/mediapipe-blendshapes-to-flame.git

Usage:
    python create_arkit_flame_mapping.py \
        mediapipe-blendshapes-to-flame/mediapipe_to_flame \
        flame_bins/
"""

import numpy as np
import os
import sys


def create_mappings(mp_dir, output_dir):
    os.makedirs(output_dir, exist_ok=True)

    bs2exp = np.load(os.path.join(mp_dir, 'bs2exp.npy')).astype(np.float32)

    # arkitToExpr: (67, 100) — 52 ARKit + 15 visemes -> 100 FLAME expressions
    n_mp, n_exp = bs2exp.shape
    arkit_to_expr = np.zeros((67, 100), dtype=np.float32)
    arkit_to_expr[:n_mp, :n_exp] = bs2exp
    arkit_to_expr.flatten().tofile(os.path.join(output_dir, 'arkit_to_flame_expr.bin'))

    # visemeToJaw: (15, 3) — Oculus visemes -> jaw axis-angle
    # Order: sil, PP, FF, TH, DD, kk, CH, SS, nn, RR, aa, E, I, O, U
    viseme_to_jaw = np.zeros((15, 3), dtype=np.float32)
    jaw_open = [0.0, 0.02, 0.03, 0.04, 0.05, 0.03, 0.04, 0.02, 0.03,
                0.04, 0.12, 0.08, 0.05, 0.10, 0.07]
    for i, val in enumerate(jaw_open):
        viseme_to_jaw[i, 0] = val
    viseme_to_jaw.flatten().tofile(os.path.join(output_dir, 'viseme_to_jaw.bin'))

    # eyeToPose: (14, 6) — 14 eye blendshapes -> left/right eye axis-angle
    eye_to_pose = np.zeros((14, 6), dtype=np.float32)
    eye_to_pose[1, 0] = 0.15    # eyeLookDownLeft -> left pitch
    eye_to_pose[4, 0] = -0.15   # eyeLookUpLeft
    eye_to_pose[2, 1] = 0.12    # eyeLookInLeft -> left yaw
    eye_to_pose[3, 1] = -0.12   # eyeLookOutLeft
    eye_to_pose[8, 3] = 0.15    # eyeLookDownRight -> right pitch
    eye_to_pose[11, 3] = -0.15  # eyeLookUpRight
    eye_to_pose[9, 4] = -0.12   # eyeLookInRight -> right yaw
    eye_to_pose[10, 4] = 0.12   # eyeLookOutRight
    eye_to_pose.flatten().tofile(os.path.join(output_dir, 'eye_to_flame_pose.bin'))

    print(f"Mapping matrices written to {output_dir}/")
    print(f"  arkit_to_flame_expr.bin: {67 * 100 * 4} bytes")
    print(f"  viseme_to_jaw.bin: {15 * 3 * 4} bytes")
    print(f"  eye_to_flame_pose.bin: {14 * 6 * 4} bytes")


if __name__ == '__main__':
    create_mappings(
        sys.argv[1] if len(sys.argv) > 1 else 'mediapipe-blendshapes-to-flame/mediapipe_to_flame',
        sys.argv[2] if len(sys.argv) > 2 else 'flame_bins'
    )
