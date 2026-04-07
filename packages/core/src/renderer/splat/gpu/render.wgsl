struct Uniforms {
  viewMatrix: mat4x4<f32>,
  projMatrix: mat4x4<f32>,
  viewport: vec2<f32>,
  focalX: f32,
  focalY: f32,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> gaussians_pos: array<f32>;
@group(0) @binding(2) var<storage, read> gaussians_color: array<f32>;
@group(0) @binding(3) var<storage, read> gaussians_opacity: array<f32>;
@group(0) @binding(4) var<storage, read> gaussians_scale: array<f32>;
@group(0) @binding(5) var<storage, read> gaussians_rot: array<f32>;
@group(0) @binding(6) var<storage, read> sortedIndices: array<u32>;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) color: vec3<f32>,
  @location(1) opacity: f32,
  @location(2) conic: vec3<f32>,
  @location(3) centerScreenPos: vec2<f32>,
}

fn quatToMat3(q: vec4<f32>) -> mat3x3<f32> {
  let x2 = q.x + q.x; let y2 = q.y + q.y; let z2 = q.z + q.z;
  let xx = q.x * x2; let xy = q.x * y2; let xz = q.x * z2;
  let yy = q.y * y2; let yz = q.y * z2; let zz = q.z * z2;
  let wx = q.w * x2; let wy = q.w * y2; let wz = q.w * z2;
  return mat3x3<f32>(
    vec3<f32>(1.0 - (yy + zz), xy + wz, xz - wy),
    vec3<f32>(xy - wz, 1.0 - (xx + zz), yz + wx),
    vec3<f32>(xz + wy, yz - wx, 1.0 - (xx + yy)),
  );
}

@vertex
fn vertexMain(
  @builtin(vertex_index) vertexIndex: u32,
  @builtin(instance_index) instanceIndex: u32,
) -> VertexOutput {
  let i = sortedIndices[instanceIndex];

  let pos = vec3<f32>(gaussians_pos[i*3u], gaussians_pos[i*3u+1u], gaussians_pos[i*3u+2u]);
  let col = vec3<f32>(gaussians_color[i*3u], gaussians_color[i*3u+1u], gaussians_color[i*3u+2u]);
  let opa = gaussians_opacity[i];
  let scl = vec3<f32>(gaussians_scale[i*3u], gaussians_scale[i*3u+1u], gaussians_scale[i*3u+2u]);
  let rot = vec4<f32>(gaussians_rot[i*4u], gaussians_rot[i*4u+1u], gaussians_rot[i*4u+2u], gaussians_rot[i*4u+3u]);

  let viewPos = uniforms.viewMatrix * vec4<f32>(pos, 1.0);
  if (viewPos.z > -0.1) {
    var out: VertexOutput;
    out.position = vec4<f32>(0.0, 0.0, 2.0, 1.0);
    return out;
  }

  let clipPos = uniforms.projMatrix * viewPos;
  let ndc = clipPos.xyz / clipPos.w;

  let R = quatToMat3(rot);
  let S = mat3x3<f32>(vec3<f32>(scl.x, 0.0, 0.0), vec3<f32>(0.0, scl.y, 0.0), vec3<f32>(0.0, 0.0, scl.z));
  let M = R * S;
  let viewRot = mat3x3<f32>(uniforms.viewMatrix[0].xyz, uniforms.viewMatrix[1].xyz, uniforms.viewMatrix[2].xyz);
  let T = viewRot * M;

  let z2 = viewPos.z * viewPos.z;
  let cov00 = dot(T[0].xy, T[0].xy) * uniforms.focalX * uniforms.focalX / z2 + 0.3;
  let cov01 = dot(T[0].xy, T[1].xy) * uniforms.focalX * uniforms.focalY / z2;
  let cov11 = dot(T[1].xy, T[1].xy) * uniforms.focalY * uniforms.focalY / z2 + 0.3;

  let det = cov00 * cov11 - cov01 * cov01;
  let invDet = 1.0 / max(det, 1e-6);
  let conic = vec3<f32>(cov11 * invDet, -cov01 * invDet, cov00 * invDet);

  let eigenMax = 0.5 * (cov00 + cov11 + sqrt(max((cov00 - cov11) * (cov00 - cov11) + 4.0 * cov01 * cov01, 0.0)));
  let radius = ceil(3.0 * sqrt(max(eigenMax, 0.0)));

  let corners = array<vec2<f32>, 4>(vec2(-1.0,-1.0), vec2(1.0,-1.0), vec2(-1.0,1.0), vec2(1.0,1.0));
  let tri = array<u32, 6>(0u, 1u, 2u, 1u, 3u, 2u);
  let corner = corners[tri[vertexIndex]];

  let screenCenter = vec2<f32>((ndc.x*0.5+0.5)*uniforms.viewport.x, (ndc.y*0.5+0.5)*uniforms.viewport.y);
  let screenPos = screenCenter + corner * radius;

  var out: VertexOutput;
  out.position = vec4<f32>(screenPos.x/uniforms.viewport.x*2.0-1.0, screenPos.y/uniforms.viewport.y*2.0-1.0, ndc.z, 1.0);
  out.color = col;
  out.opacity = opa;
  out.conic = conic;
  out.centerScreenPos = screenCenter;
  return out;
}

@fragment
fn fragmentMain(in: VertexOutput) -> @location(0) vec4<f32> {
  let d = in.position.xy - in.centerScreenPos;
  let power = -0.5 * (in.conic.x * d.x * d.x + 2.0 * in.conic.y * d.x * d.y + in.conic.z * d.y * d.y);
  if (power > 0.0) { discard; }
  let alpha = min(0.99, in.opacity * exp(power));
  if (alpha < 1.0 / 255.0) { discard; }
  return vec4<f32>(in.color * alpha, alpha);
}
