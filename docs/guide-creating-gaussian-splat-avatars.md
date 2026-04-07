# Guide: Creating Photorealistic Gaussian Splat Avatars

This guide walks you through creating FLAME-rigged Gaussian splat avatars for the Low-Cost Avatar SDK's `renderer: 'splat'` mode.

**Security note:** Step 1 uses Python's pickle to load the FLAME model file. The FLAME .pkl file should only be downloaded directly from the official FLAME website (https://flame.is.tue.mpg.de/). Do not load .pkl files from untrusted sources as pickle can execute arbitrary code.

## Overview

You need 3 things:
1. **FLAME model assets** (~25MB uncompressed) — shared across all avatars
2. **ARKit-to-FLAME mapping matrices** (~28KB) — shared across all avatars
3. **A trained Gaussian splat avatar** (.lca file, ~3MB each)

Steps 1 and 2 are done once. Step 3 is repeated per avatar.

---

## Step 1: Get FLAME Model Assets (One-Time)

### 1.1 Register and Download

1. Go to **https://flame.is.tue.mpg.de/**
2. Register with your email
3. Accept the CC-BY-4.0 license (commercial use allowed)
4. Download **FLAME 2023** — you'll get `flame2023.pkl`

### 1.2 Extract Binary Files

Install dependencies:

```bash
pip install numpy scipy
```

Create `scripts/extract_flame_bins.py`:

```python
#!/usr/bin/env python3
"""
Extract FLAME model into flat .bin files for JavaScript Float32Array loading.
SECURITY: Only use .pkl files downloaded directly from https://flame.is.tue.mpg.de/
"""

import pickle  # Required for FLAME's official distribution format
import numpy as np
import os
import sys

def extract(pkl_path, output_dir):
    os.makedirs(output_dir, exist_ok=True)

    # FLAME is officially distributed as a pickle file from MPI
    with open(pkl_path, 'rb') as f:
        model = pickle.load(f, encoding='latin1')

    # Template vertices: (5023, 3)
    v_template = np.array(model['v_template'], dtype=np.float32)
    v_template.flatten().tofile(os.path.join(output_dir, 'flame_template.bin'))

    # Shape blendshape dirs: (5023, 3, 300)
    # Layout: (v * 3 + c) * 300 + i — matches FLAMEModel.addBlend()
    shapedirs_full = np.array(model['shapedirs'], dtype=np.float32)
    shapedirs = shapedirs_full[:, :, :300].reshape(-1, 300)
    shapedirs.flatten().tofile(os.path.join(output_dir, 'flame_shapedirs.bin'))

    # Expression blendshape dirs: (5023, 3, 100)
    exprdirs = shapedirs_full[:, :, 300:400].reshape(-1, 100)
    exprdirs.flatten().tofile(os.path.join(output_dir, 'flame_exprdirs.bin'))

    # Pose blendshape dirs: (5023, 3, 36)
    posedirs = np.array(model['posedirs'], dtype=np.float32).reshape(-1, 36)
    posedirs.flatten().tofile(os.path.join(output_dir, 'flame_posedirs.bin'))

    # LBS weights: (5023, 5)
    lbs_weights = np.array(model['weights'], dtype=np.float32)
    lbs_weights.flatten().tofile(os.path.join(output_dir, 'flame_lbs_weights.bin'))

    # Joints: computed from J_regressor x template
    J_regressor = np.array(model['J_regressor'].toarray(), dtype=np.float32)
    joints = (J_regressor @ v_template).astype(np.float32)
    joints.flatten().tofile(os.path.join(output_dir, 'flame_joints.bin'))

    # Joint parents from kintree_table
    kintree = np.array(model['kintree_table'], dtype=np.int32)
    num_joints = kintree.shape[1]
    parents = np.full(num_joints, -1, dtype=np.int32)
    for i in range(num_joints):
        parents[kintree[1, i]] = kintree[0, i]
    parents.tofile(os.path.join(output_dir, 'flame_joint_parents.bin'))

    # Faces: (9976, 3) as uint32
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
```

Run it:

```bash
python scripts/extract_flame_bins.py flame2023.pkl flame_bins/
```

Output (~25MB uncompressed, ~4MB gzipped):

```
flame_bins/
  flame_template.bin        59 KB
  flame_shapedirs.bin     17.2 MB
  flame_exprdirs.bin       5.7 MB
  flame_posedirs.bin       2.1 MB
  flame_lbs_weights.bin     98 KB
  flame_joints.bin          60 B
  flame_joint_parents.bin   20 B
  flame_faces.bin          117 KB
```

### 1.3 Deploy FLAME Assets

Copy to your example or CDN:

```bash
cp -r flame_bins/ examples/splat-demo/flame/
```

The SDK loads these from `assetsBaseUrl + 'flame/'`.

---

## Step 2: Create ARKit-to-FLAME Mapping (One-Time)

### 2.1 Get Pre-Computed Mapping

```bash
git clone https://github.com/PeizhiYan/mediapipe-blendshapes-to-flame.git
```

This provides pre-computed mapping matrices from MediaPipe's 52 blendshapes (same names as ARKit) to FLAME parameters.

### 2.2 Convert to SDK Format

Create `scripts/create_arkit_flame_mapping.py`:

```python
#!/usr/bin/env python3
"""Create ARKit-to-FLAME mapping matrices for BlendshapeToFLAME.ts"""

import numpy as np
import os
import sys

def create_mappings(mp_dir, output_dir):
    os.makedirs(output_dir, exist_ok=True)

    bs2exp = np.load(os.path.join(mp_dir, 'bs2exp.npy')).astype(np.float32)

    # arkitToExpr: (67, 100)
    n_mp, n_exp = bs2exp.shape
    arkit_to_expr = np.zeros((67, 100), dtype=np.float32)
    arkit_to_expr[:n_mp, :n_exp] = bs2exp
    arkit_to_expr.flatten().tofile(os.path.join(output_dir, 'arkit_to_flame_expr.bin'))

    # visemeToJaw: (15, 3) — jaw opening per Oculus viseme
    viseme_to_jaw = np.zeros((15, 3), dtype=np.float32)
    # sil, PP, FF, TH, DD, kk, CH, SS, nn, RR, aa, E, I, O, U
    jaw_open = [0.0, 0.02, 0.03, 0.04, 0.05, 0.03, 0.04, 0.02, 0.03,
                0.04, 0.12, 0.08, 0.05, 0.10, 0.07]
    for i, val in enumerate(jaw_open):
        viseme_to_jaw[i, 0] = val
    viseme_to_jaw.flatten().tofile(os.path.join(output_dir, 'viseme_to_jaw.bin'))

    # eyeToPose: (14, 6) — eye gaze mapping
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

if __name__ == '__main__':
    create_mappings(
        sys.argv[1] if len(sys.argv) > 1 else 'mediapipe-blendshapes-to-flame/mediapipe_to_flame',
        sys.argv[2] if len(sys.argv) > 2 else 'flame_bins'
    )
```

Run:

```bash
python scripts/create_arkit_flame_mapping.py \
  mediapipe-blendshapes-to-flame/mediapipe_to_flame \
  flame_bins/
```

---

## Step 3: Train a Gaussian Splat Avatar

### Option A: Quick Test with Pre-Trained Data (No GPU)

Download pre-trained checkpoints from GaussianAvatars:
1. Go to https://github.com/ShenhanQian/GaussianAvatars
2. Download pre-trained models from the OneDrive links in the README
3. Convert the .ply output to .lca using the script below

### Option B: FlashAvatar (Fastest — 15 min, ~$0.10)

```bash
# On a rented RTX 3090 ($0.30-0.40/hr on Vast.ai or RunPod):

git clone https://github.com/USTC3DV/FlashAvatar-code.git
cd FlashAvatar-code
conda create -n flashavatar python=3.10 -y && conda activate flashavatar
pip install torch==2.0.1 torchvision==0.15.2 --index-url https://download.pytorch.org/whl/cu118
pip install -r requirements.txt

# Place FLAME model
mkdir -p data/flame && cp /path/to/flame2023.pkl data/flame/

# Prepare video (see Recording Tips below)
python preprocess.py --video /path/to/selfie.mp4 --output data/my_avatar/

# Train (5-15 minutes!)
python train.py --config configs/default.yaml --data_dir data/my_avatar
```

### Option C: GaussianAvatars (Best Quality — 18 hrs, ~$10)

```bash
# On a rented A100 ($0.55/hr on Vast.ai):

git clone --recursive https://github.com/ShenhanQian/GaussianAvatars.git
cd GaussianAvatars
conda create -n gsa python=3.10 -y && conda activate gsa
pip install torch==2.0.1 torchvision==0.15.2 --index-url https://download.pytorch.org/whl/cu118
pip install submodules/diff-gaussian-rasterization submodules/simple-knn
pip install -r requirements.txt

mkdir -p assets/flame && cp /path/to/flame2023.pkl assets/flame/

# Train (~12-24 hours)
CUDA_VISIBLE_DEVICES=0 python train.py \
  --config configs/gaussian_avatars.yaml \
  --source_path gs_data/SUBJECT \
  --model_path output/SUBJECT \
  --iterations 600000
```

### GPU Rental Cost Comparison

| Provider | GPU | $/hr | FlashAvatar Cost | GaussianAvatars Cost |
|---|---|---|---|---|
| Vast.ai | RTX 3090 | ~$0.30 | ~$0.08 | N/A (needs A100) |
| Vast.ai | A100 40GB | ~$0.55 | ~$0.10 | ~$10 |
| RunPod | RTX 3090 | ~$0.40 | ~$0.10 | N/A |
| RunPod | A100 40GB | ~$0.75 | ~$0.15 | ~$14 |
| Colab Pro | A100 | ~$10/mo | Yes | Maybe |

### Convert to .lca Format

Create `scripts/convert_to_lca.py`:

```python
#!/usr/bin/env python3
"""Convert trained Gaussian splat avatar to .lca format."""

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
                    tri_indices, barycentrics, local_offsets, local_rotations, flame_shape]:
            f.write(arr.flatten().tobytes())

    print(f"Created {output_path}: {n} Gaussians, {os.path.getsize(output_path) / 1024 / 1024:.1f} MB")

if __name__ == '__main__':
    convert(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4])
```

```bash
pip install plyfile
python scripts/convert_to_lca.py \
  output/SUBJECT/point_cloud.ply \
  output/SUBJECT/flame_shape.npy \
  output/SUBJECT/binding.npz \
  examples/splat-demo/avatar.lca
```

---

## Step 4: Run the Demo

```
examples/splat-demo/
  flame/                     # From Step 1 + 2
    flame_template.bin
    flame_shapedirs.bin
    flame_exprdirs.bin
    flame_posedirs.bin
    flame_lbs_weights.bin
    flame_joints.bin
    flame_joint_parents.bin
    flame_faces.bin
    arkit_to_flame_expr.bin
    viseme_to_jaw.bin
    eye_to_flame_pose.bin
  avatar.lca                 # From Step 3
  index.html                 # Already exists
  package.json               # Already exists
```

```bash
cd /path/to/low-cost-avatar
pnpm build
cd examples/splat-demo
pnpm dev
```

Open http://localhost:5173

---

## Recording Tips for Best Results

When recording the selfie video for avatar training:

- **Lighting:** Even, diffuse light. Natural daylight near a window is ideal. Avoid harsh shadows.
- **Background:** Plain, solid color (white or green).
- **Camera:** Phone at arm's length, landscape, 1080p minimum.
- **Head movement:** Slowly turn left 45 degrees, right 45 degrees, up 30 degrees, down 30 degrees.
- **Expressions:** Hold each 2-3 seconds — neutral, smile, frown, surprise, angry, pucker lips.
- **Speaking:** Talk naturally for 30 seconds to capture mouth movements.
- **Duration:** 1-2 minutes total.
- **Hair:** Tie back loose hair if possible — hair is the hardest part for Gaussian splatting.

---

## Useful Resources

- **FLAME model:** https://flame.is.tue.mpg.de/
- **FLAME-Universe (resource index):** https://github.com/TimoBolkart/FLAME-Universe
- **GaussianAvatars (CVPR 2024):** https://github.com/ShenhanQian/GaussianAvatars
- **SplattingAvatar (CVPR 2024):** https://github.com/initialneil/SplattingAvatar
- **FlashAvatar (CVPR 2024):** https://github.com/USTC3DV/FlashAvatar-code
- **MediaPipe-to-FLAME mapping:** https://github.com/PeizhiYan/mediapipe-blendshapes-to-flame
- **FLAME head tracker:** https://github.com/PeizhiYan/flame-head-tracker
- **Microsoft GASP:** https://microsoft.github.io/GASP/

---

## Troubleshooting

**FLAME assets fail to load:** Check that all .bin files are in `flame/` under your `assetsBaseUrl`. Check browser console for 404s. Ensure your server serves `.bin` files.

**Avatar looks distorted:** Verify blendshape dirs layout matches `(v * 3 + c) * numWeights + i`. Check FLAME version consistency.

**WebGPU not available:** Chrome: `chrome://flags/#enable-unsafe-webgpu`. Firefox: `dom.webgpu.enabled` in `about:config`. SDK auto-falls back to WebGL.

**GPU out of memory:** FlashAvatar: reduce `--resolution` to 256. GaussianAvatars: reduce `--num_points` to 50000.
