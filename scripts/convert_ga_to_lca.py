#!/usr/bin/env python3
"""
Convert GaussianAvatars pre-trained output to .lca format.

SECURITY NOTE: Uses pickle to load FLAME .pkl — only use files from
the official FLAME website (https://flame.is.tue.mpg.de/).

Usage:
    python convert_ga_to_lca.py /tmp/ga-pretrained/ /path/to/flame2023_Open.pkl output.lca
"""

import numpy as np
import json
import struct
import os
import sys
import pickle  # nosec B403 — required for official FLAME .pkl format
from plyfile import PlyData


def load_flame_template(pkl_path):
    with open(pkl_path, 'rb') as f:
        model = pickle.load(f, encoding='latin1')  # nosec B301
    v_template = np.array(model['v_template'], dtype=np.float32)
    faces = np.array(model['f'], dtype=np.int32)
    return v_template, faces


def compute_barycentric(p, v0, v1, v2):
    e0 = v1 - v0
    e1 = v2 - v0
    e2 = p - v0
    d00 = np.dot(e0, e0)
    d01 = np.dot(e0, e1)
    d11 = np.dot(e1, e1)
    d20 = np.dot(e2, e0)
    d21 = np.dot(e2, e1)
    denom = d00 * d11 - d01 * d01
    if abs(denom) < 1e-10:
        return np.array([1.0, 0.0, 0.0], dtype=np.float32)
    b1 = (d11 * d20 - d01 * d21) / denom
    b2 = (d00 * d21 - d01 * d20) / denom
    b0 = 1.0 - b1 - b2
    return np.array([b0, b1, b2], dtype=np.float32)


def compute_triangle_frame(v0, v1, v2):
    e1 = v1 - v0
    e2 = v2 - v0
    normal = np.cross(e1, e2)
    n_len = np.linalg.norm(normal)
    if n_len > 1e-8:
        normal /= n_len
    tangent = e1.copy()
    t_len = np.linalg.norm(tangent)
    if t_len > 1e-8:
        tangent /= t_len
    bitangent = np.cross(normal, tangent)
    return tangent, bitangent, normal


def convert(data_dir, flame_pkl_path, output_path):
    ply_path = os.path.join(data_dir, 'point_cloud.ply')
    plydata = PlyData.read(ply_path)
    v = plydata['vertex']
    n = len(v)
    print(f"Loaded {n} Gaussians from {ply_path}")

    positions = np.stack([v['x'], v['y'], v['z']], axis=-1).astype(np.float32)
    opacities = np.array(v['opacity'], dtype=np.float32)
    scales = np.stack([v['scale_0'], v['scale_1'], v['scale_2']], axis=-1).astype(np.float32)
    rotations = np.stack([v['rot_0'], v['rot_1'], v['rot_2'], v['rot_3']], axis=-1).astype(np.float32)

    SH_C0 = 0.28209479177387814
    colors = np.stack([v['f_dc_0'], v['f_dc_1'], v['f_dc_2']], axis=-1).astype(np.float32)
    colors = np.clip(SH_C0 * colors + 0.5, 0.0, 1.0).astype(np.float32)

    binding_indices = np.array(v['binding_0'], dtype=np.int32)

    flame_template, flame_faces = load_flame_template(flame_pkl_path)
    flame_faces_u32 = flame_faces.astype(np.uint32)

    npz_path = os.path.join(data_dir, 'flame_param.npz')
    flame_data = np.load(npz_path, allow_pickle=True)
    shape_params = flame_data['shape'].astype(np.float32)

    template_verts = flame_template.copy()
    if 'static_offset' in flame_data:
        static_offset = flame_data['static_offset'][0]
        if static_offset.shape[0] >= template_verts.shape[0]:
            template_verts += static_offset[:template_verts.shape[0]]

    print("Computing binding data...")
    triangle_indices = np.zeros(n, dtype=np.uint32)
    barycentrics = np.zeros((n, 3), dtype=np.float32)
    local_offsets = np.zeros((n, 3), dtype=np.float32)
    local_rotations = np.zeros((n, 4), dtype=np.float32)
    local_rotations[:, 3] = 1.0

    max_face_idx = len(flame_faces) - 1
    valid_bindings = np.clip(binding_indices, 0, max_face_idx)
    nv = len(template_verts)

    for g in range(n):
        tri_idx = valid_bindings[g]
        triangle_indices[g] = tri_idx
        i0, i1, i2 = flame_faces[tri_idx]
        i0, i1, i2 = min(i0, nv-1), min(i1, nv-1), min(i2, nv-1)
        v0, v1, v2 = template_verts[i0], template_verts[i1], template_verts[i2]

        bary = compute_barycentric(positions[g], v0, v1, v2)
        barycentrics[g] = bary

        surface_point = v0 * bary[0] + v1 * bary[1] + v2 * bary[2]
        tangent, bitangent, normal = compute_triangle_frame(v0, v1, v2)
        diff = positions[g] - surface_point
        local_offsets[g, 0] = np.dot(diff, tangent)
        local_offsets[g, 1] = np.dot(diff, bitangent)
        local_offsets[g, 2] = np.dot(diff, normal)

        if g % 10000 == 0:
            print(f"  {g}/{n}...")

    print("Building .lca file...")
    header = json.dumps({
        "version": "1.0.0",
        "gaussianCount": int(n),
        "shDegree": 0,
        "flameVersion": "FLAME2023"
    }).encode('utf-8')

    raw_offset = 4 + len(header)
    data_start = (raw_offset + 3) & ~3
    padding = data_start - raw_offset

    shape_300 = np.zeros(300, dtype=np.float32)
    shape_300[:min(len(shape_params), 300)] = shape_params[:300]

    with open(output_path, 'wb') as f:
        f.write(struct.pack('<I', len(header)))
        f.write(header)
        f.write(b'\x00' * padding)
        f.write(positions.flatten().astype(np.float32).tobytes())
        f.write(colors.flatten().astype(np.float32).tobytes())
        f.write(opacities.flatten().astype(np.float32).tobytes())
        f.write(scales.flatten().astype(np.float32).tobytes())
        f.write(rotations.flatten().astype(np.float32).tobytes())
        f.write(triangle_indices.flatten().tobytes())
        f.write(barycentrics.flatten().astype(np.float32).tobytes())
        f.write(local_offsets.flatten().astype(np.float32).tobytes())
        f.write(local_rotations.flatten().astype(np.float32).tobytes())
        f.write(shape_300.tobytes())

    size_mb = os.path.getsize(output_path) / 1024 / 1024
    print(f"\nCreated {output_path}: {n} Gaussians, {size_mb:.1f} MB")


if __name__ == '__main__':
    if len(sys.argv) != 4:
        print("Usage: python convert_ga_to_lca.py <data_dir> <flame.pkl> <output.lca>")
        sys.exit(1)
    convert(sys.argv[1], sys.argv[2], sys.argv[3])
