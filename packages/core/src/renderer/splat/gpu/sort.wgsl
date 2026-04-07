struct SortUniforms {
  count: u32,
  stage: u32,
  step: u32,
}

@group(0) @binding(0) var<storage, read_write> indices: array<u32>;
@group(0) @binding(1) var<storage, read> depths: array<f32>;
@group(0) @binding(2) var<uniform> uniforms: SortUniforms;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  if (idx >= uniforms.count) { return; }

  let pairDistance = 1u << uniforms.step;
  let blockSize = 1u << uniforms.stage;

  let leftIdx = idx;
  let rightIdx = idx ^ pairDistance;

  if (rightIdx <= leftIdx || rightIdx >= uniforms.count) { return; }

  let leftSortIdx = indices[leftIdx];
  let rightSortIdx = indices[rightIdx];
  let leftDepth = depths[leftSortIdx];
  let rightDepth = depths[rightSortIdx];

  let sameBlock = ((leftIdx >> uniforms.stage) & 1u) == 0u;
  let shouldSwap = select(leftDepth < rightDepth, leftDepth > rightDepth, sameBlock);

  if (shouldSwap) {
    indices[leftIdx] = rightSortIdx;
    indices[rightIdx] = leftSortIdx;
  }
}
