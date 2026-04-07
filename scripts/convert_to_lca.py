#!/usr/bin/env python3
"""
Convert trained Gaussian splat avatar to .lca format for the Low-Cost Avatar SDK.

Usage:
    pip install plyfile numpy
    python convert_to_lca.py \
        output/SUBJECT/point_cloud.ply \
        output/SUBJECT/flame_shape.npy \
        output/SUBJECT/binding.npz \
        examples/splat-demo/avatar.lca
"""

import numpy as np
import json
import struct
import os
import sys
from plyfile import PlyData


def convert(ply_path, flame_shape_path, binding_path, output_path):
    v = PlyData.read(ply_path)['vertex']
    n = len(v)

    positions = np.stack([v['x'], v['y'], v['z']], axis=-1).astype(np.float32)
    opacities = v['opacity'].astype(np.float32)
    scales = np.stack([v['scale_0'], v['scale_1'], v['scale_2']], axis=-1).astype(np.float32)
    rotations = np.stack([v['rot_0'], v['rot_1'], v['rot_2'], v['rot_3']], axis=-1).astype(np.float32)
    colors = np.stack([v['f_dc_0'], v['f_dc_1'], v['f_dc_2']], axis=-1).astype(np.float32)

    binding = np.load(binding_path)
    tri_indices = binding['triangle_indices'].astype(np.uint32)
    barycentrics = binding['barycentrics'].astype(np.float32)
    local_offsets = binding['local_offsets'].astype(np.float32)
    local_rotations = binding['local_rotations'].astype(np.float32)

    flame_shape = np.load(flame_shape_path).astype(np.float32)[:300]

    header = json.dumps({
        "version": "1.0.0",
        "gaussianCount": int(n),
        "shDegree": 0,
        "flameVersion": "FLAME2023"
    }).encode('utf-8')

    raw_offset = 4 + len(header)
    data_start = (raw_offset + 3) & ~3
    padding = data_start - raw_offset

    with open(output_path, 'wb') as f:
        f.write(struct.pack('<I', len(header)))
        f.write(header)
        f.write(b'\x00' * padding)
        for arr in [positions, colors, opacities, scales, rotations,
                    tri_indices, barycentrics, local_offsets, local_rotations,
                    flame_shape]:
            f.write(arr.flatten().tobytes())

    size_mb = os.path.getsize(output_path) / 1024 / 1024
    print(f"Created {output_path}: {n} Gaussians, {size_mb:.1f} MB")


if __name__ == '__main__':
    if len(sys.argv) != 5:
        print("Usage: python convert_to_lca.py <point_cloud.ply> <flame_shape.npy> <binding.npz> <output.lca>")
        sys.exit(1)
    convert(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4])
