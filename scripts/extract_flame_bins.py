#!/usr/bin/env python3
"""
Extract FLAME model (.pkl) into flat .bin files for JavaScript Float32Array loading.

SECURITY NOTE: This script uses Python pickle to load the FLAME model file.
Pickle can execute arbitrary code — ONLY load .pkl files downloaded directly
from the official FLAME website: https://flame.is.tue.mpg.de/
The FLAME model is distributed as pickle by the Max Planck Institute.
There is no alternative format available.

Usage:
    python extract_flame_bins.py flame2023.pkl flame_bins/
"""

import pickle  # nosec B403 — required for FLAME's official .pkl format
import numpy as np
import os
import sys


def extract(pkl_path, output_dir):
    os.makedirs(output_dir, exist_ok=True)

    # FLAME is officially distributed as pickle by Max Planck Institute
    with open(pkl_path, 'rb') as f:
        model = pickle.load(f, encoding='latin1')  # nosec B301

    v_template = np.array(model['v_template'], dtype=np.float32)
    v_template.flatten().tofile(os.path.join(output_dir, 'flame_template.bin'))

    shapedirs_full = np.array(model['shapedirs'], dtype=np.float32)
    shapedirs = shapedirs_full[:, :, :300].reshape(-1, 300)
    shapedirs.flatten().tofile(os.path.join(output_dir, 'flame_shapedirs.bin'))

    exprdirs = shapedirs_full[:, :, 300:400].reshape(-1, 100)
    exprdirs.flatten().tofile(os.path.join(output_dir, 'flame_exprdirs.bin'))

    posedirs = np.array(model['posedirs'], dtype=np.float32).reshape(-1, 36)
    posedirs.flatten().tofile(os.path.join(output_dir, 'flame_posedirs.bin'))

    lbs_weights = np.array(model['weights'], dtype=np.float32)
    lbs_weights.flatten().tofile(os.path.join(output_dir, 'flame_lbs_weights.bin'))

    J_regressor = np.array(model['J_regressor'].toarray(), dtype=np.float32)
    joints = (J_regressor @ v_template).astype(np.float32)
    joints.flatten().tofile(os.path.join(output_dir, 'flame_joints.bin'))

    kintree = np.array(model['kintree_table'], dtype=np.int32)
    num_joints = kintree.shape[1]
    parents = np.full(num_joints, -1, dtype=np.int32)
    for i in range(num_joints):
        parents[kintree[1, i]] = kintree[0, i]
    parents.tofile(os.path.join(output_dir, 'flame_joint_parents.bin'))

    faces = np.array(model['f'], dtype=np.uint32)
    faces.flatten().tofile(os.path.join(output_dir, 'flame_faces.bin'))

    total = sum(os.path.getsize(os.path.join(output_dir, f))
                for f in os.listdir(output_dir) if f.endswith('.bin'))
    print(f"Extracted to {output_dir}/: {total / 1024 / 1024:.1f} MB")
    print(f"  Vertices: {v_template.shape[0]}, Faces: {faces.shape[0]}")


if __name__ == '__main__':
    extract(
        sys.argv[1] if len(sys.argv) > 1 else 'flame2023.pkl',
        sys.argv[2] if len(sys.argv) > 2 else 'flame_bins'
    )
