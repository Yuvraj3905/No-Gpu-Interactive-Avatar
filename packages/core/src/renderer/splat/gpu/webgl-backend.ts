import type { RenderBackend, GaussianData } from '../types.js'

// ── GLSL 300 ES shaders ────────────────────────────────────────────────

const VERTEX_SHADER = /* glsl */ `#version 300 es
precision highp float;

// Quad corners (triangle-strip order: 0,1,2 & 2,1,3)
const vec2 CORNERS[4] = vec2[4](
  vec2(-1.0, -1.0),
  vec2( 1.0, -1.0),
  vec2(-1.0,  1.0),
  vec2( 1.0,  1.0)
);
const int TRI[6] = int[6](0, 1, 2, 1, 3, 2);

uniform mat4 u_viewMatrix;
uniform mat4 u_projMatrix;
uniform vec2 u_viewport;
uniform float u_focalX;
uniform float u_focalY;

// Per-instance attributes
in vec3 a_position;
in vec3 a_color;
in float a_opacity;
in vec3 a_scale;
in vec4 a_rotation; // quaternion (x, y, z, w)

out vec3 v_color;
out float v_opacity;
out vec3 v_conic;
out vec2 v_centerScreenPos;

mat3 quatToMat3(vec4 q) {
  float x2 = q.x + q.x, y2 = q.y + q.y, z2 = q.z + q.z;
  float xx = q.x * x2, xy = q.x * y2, xz = q.x * z2;
  float yy = q.y * y2, yz = q.y * z2, zz = q.z * z2;
  float wx = q.w * x2, wy = q.w * y2, wz = q.w * z2;
  return mat3(
    1.0 - (yy + zz), xy + wz, xz - wy,
    xy - wz, 1.0 - (xx + zz), yz + wx,
    xz + wy, yz - wx, 1.0 - (xx + yy)
  );
}

void main() {
  int vertexIndex = gl_VertexID % 6;

  vec4 viewPos = u_viewMatrix * vec4(a_position, 1.0);
  if (viewPos.z > -0.1) {
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
    return;
  }

  vec4 clipPos = u_projMatrix * viewPos;
  vec3 ndc = clipPos.xyz / clipPos.w;

  mat3 R = quatToMat3(a_rotation);
  mat3 S = mat3(
    a_scale.x, 0.0, 0.0,
    0.0, a_scale.y, 0.0,
    0.0, 0.0, a_scale.z
  );
  mat3 M = R * S;
  mat3 viewRot = mat3(u_viewMatrix);
  mat3 T = viewRot * M;

  float z2 = viewPos.z * viewPos.z;
  float cov00 = dot(T[0].xy, T[0].xy) * u_focalX * u_focalX / z2 + 0.3;
  float cov01 = dot(T[0].xy, T[1].xy) * u_focalX * u_focalY / z2;
  float cov11 = dot(T[1].xy, T[1].xy) * u_focalY * u_focalY / z2 + 0.3;

  float det = cov00 * cov11 - cov01 * cov01;
  float invDet = 1.0 / max(det, 1e-6);
  v_conic = vec3(cov11 * invDet, -cov01 * invDet, cov00 * invDet);

  float eigenMax = 0.5 * (cov00 + cov11 + sqrt(max((cov00 - cov11) * (cov00 - cov11) + 4.0 * cov01 * cov01, 0.0)));
  float radius = ceil(3.0 * sqrt(max(eigenMax, 0.0)));

  vec2 corner = CORNERS[TRI[vertexIndex]];

  vec2 screenCenter = vec2((ndc.x * 0.5 + 0.5) * u_viewport.x, (ndc.y * 0.5 + 0.5) * u_viewport.y);
  vec2 screenPos = screenCenter + corner * radius;

  gl_Position = vec4(
    screenPos.x / u_viewport.x * 2.0 - 1.0,
    screenPos.y / u_viewport.y * 2.0 - 1.0,
    ndc.z,
    1.0
  );
  v_color = a_color;
  v_opacity = a_opacity;
  v_centerScreenPos = screenCenter;
}
`

const FRAGMENT_SHADER = /* glsl */ `#version 300 es
precision highp float;

in vec3 v_color;
in float v_opacity;
in vec3 v_conic;
in vec2 v_centerScreenPos;

out vec4 fragColor;

void main() {
  vec2 d = gl_FragCoord.xy - v_centerScreenPos;
  float power = -0.5 * (v_conic.x * d.x * d.x + 2.0 * v_conic.y * d.x * d.y + v_conic.z * d.y * d.y);
  if (power > 0.0) discard;
  float alpha = min(0.99, v_opacity * exp(power));
  if (alpha < 1.0 / 255.0) discard;
  fragColor = vec4(v_color * alpha, alpha);
}
`

/**
 * WebGL 2.0 fallback backend for Gaussian splatting.
 *
 * Uses CPU-based depth sort and instanced rendering via
 * `vertexAttribDivisor` for per-instance gaussian data.
 */
export class WebGLBackend implements RenderBackend {
  private gl!: WebGL2RenderingContext
  private canvas!: HTMLCanvasElement
  private program!: WebGLProgram
  private vao!: WebGLVertexArrayObject

  private gaussianCount = 0
  private width = 0
  private height = 0

  // Attribute locations
  private loc_position = -1
  private loc_color = -1
  private loc_opacity = -1
  private loc_scale = -1
  private loc_rotation = -1

  // Uniform locations
  private u_viewMatrix!: WebGLUniformLocation | null
  private u_projMatrix!: WebGLUniformLocation | null
  private u_viewport!: WebGLUniformLocation | null
  private u_focalX!: WebGLUniformLocation | null
  private u_focalY!: WebGLUniformLocation | null

  // Attribute buffers
  private posBuf!: WebGLBuffer
  private colorBuf!: WebGLBuffer
  private opacityBuf!: WebGLBuffer
  private scaleBuf!: WebGLBuffer
  private rotBuf!: WebGLBuffer

  // CPU sort data
  private sortedPositions!: Float32Array
  private sortedColors!: Float32Array
  private sortedOpacities!: Float32Array
  private sortedScales!: Float32Array
  private sortedRotations!: Float32Array
  private sortIndices!: Uint32Array
  private depths!: Float32Array

  // Source data (latest uploaded)
  private srcPositions!: Float32Array
  private srcColors!: Float32Array
  private srcOpacities!: Float32Array
  private srcScales!: Float32Array
  private srcRotations!: Float32Array

  async init(canvas: HTMLCanvasElement, gaussianCount: number): Promise<void> {
    this.canvas = canvas
    this.gaussianCount = gaussianCount
    this.width = canvas.width
    this.height = canvas.height

    const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true })
    if (!gl) throw new Error('WebGL 2.0 not available')
    this.gl = gl

    // ── Compile shaders ────────────────────────────────────────────────
    this.program = this.createProgram(VERTEX_SHADER, FRAGMENT_SHADER)
    gl.useProgram(this.program)

    // ── Uniforms ───────────────────────────────────────────────────────
    this.u_viewMatrix = gl.getUniformLocation(this.program, 'u_viewMatrix')
    this.u_projMatrix = gl.getUniformLocation(this.program, 'u_projMatrix')
    this.u_viewport = gl.getUniformLocation(this.program, 'u_viewport')
    this.u_focalX = gl.getUniformLocation(this.program, 'u_focalX')
    this.u_focalY = gl.getUniformLocation(this.program, 'u_focalY')

    // ── Attributes ─────────────────────────────────────────────────────
    this.loc_position = gl.getAttribLocation(this.program, 'a_position')
    this.loc_color = gl.getAttribLocation(this.program, 'a_color')
    this.loc_opacity = gl.getAttribLocation(this.program, 'a_opacity')
    this.loc_scale = gl.getAttribLocation(this.program, 'a_scale')
    this.loc_rotation = gl.getAttribLocation(this.program, 'a_rotation')

    // ── VAO & buffers ──────────────────────────────────────────────────
    this.vao = gl.createVertexArray()!
    gl.bindVertexArray(this.vao)

    const n = gaussianCount

    this.posBuf = this.createAttribBuffer(this.loc_position, 3, n)
    this.colorBuf = this.createAttribBuffer(this.loc_color, 3, n)
    this.opacityBuf = this.createAttribBuffer(this.loc_opacity, 1, n)
    this.scaleBuf = this.createAttribBuffer(this.loc_scale, 3, n)
    this.rotBuf = this.createAttribBuffer(this.loc_rotation, 4, n)

    gl.bindVertexArray(null)

    // ── CPU sort arrays ────────────────────────────────────────────────
    this.sortIndices = new Uint32Array(n)
    this.depths = new Float32Array(n)
    this.sortedPositions = new Float32Array(n * 3)
    this.sortedColors = new Float32Array(n * 3)
    this.sortedOpacities = new Float32Array(n)
    this.sortedScales = new Float32Array(n * 3)
    this.sortedRotations = new Float32Array(n * 4)

    // Source data placeholders
    this.srcPositions = new Float32Array(n * 3)
    this.srcColors = new Float32Array(n * 3)
    this.srcOpacities = new Float32Array(n)
    this.srcScales = new Float32Array(n * 3)
    this.srcRotations = new Float32Array(n * 4)

    // ── GL state ───────────────────────────────────────────────────────
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    gl.disable(gl.DEPTH_TEST)
  }

  uploadGaussians(data: GaussianData): void {
    this.srcPositions.set(data.positions)
    this.srcColors.set(data.colors)
    this.srcOpacities.set(data.opacities)
    this.srcScales.set(data.scales)
    this.srcRotations.set(data.rotations)
  }

  updatePositions(positions: Float32Array, rotations: Float32Array): void {
    this.srcPositions.set(positions)
    this.srcRotations.set(rotations)
  }

  render(viewMatrix: Float32Array, projMatrix: Float32Array): void {
    const gl = this.gl
    const n = this.gaussianCount
    if (n === 0) return

    // ── CPU depth sort ─────────────────────────────────────────────────
    // Compute view-space z for each gaussian
    const m2 = viewMatrix[2]!
    const m6 = viewMatrix[6]!
    const m10 = viewMatrix[10]!
    const m14 = viewMatrix[14]!

    for (let i = 0; i < n; i++) {
      const px = this.srcPositions[i * 3]!
      const py = this.srcPositions[i * 3 + 1]!
      const pz = this.srcPositions[i * 3 + 2]!
      this.depths[i] = m2 * px + m6 * py + m10 * pz + m14
      this.sortIndices[i] = i
    }

    // Sort back-to-front (most negative z = farthest)
    const depths = this.depths
    const indices = this.sortIndices
    indices.sort((a, b) => depths[a]! - depths[b]!)

    // ── Scatter into sorted arrays ─────────────────────────────────────
    for (let out = 0; out < n; out++) {
      const src = indices[out]!
      const o3 = out * 3
      const s3 = src * 3
      this.sortedPositions[o3] = this.srcPositions[s3]!
      this.sortedPositions[o3 + 1] = this.srcPositions[s3 + 1]!
      this.sortedPositions[o3 + 2] = this.srcPositions[s3 + 2]!

      this.sortedColors[o3] = this.srcColors[s3]!
      this.sortedColors[o3 + 1] = this.srcColors[s3 + 1]!
      this.sortedColors[o3 + 2] = this.srcColors[s3 + 2]!

      this.sortedScales[o3] = this.srcScales[s3]!
      this.sortedScales[o3 + 1] = this.srcScales[s3 + 1]!
      this.sortedScales[o3 + 2] = this.srcScales[s3 + 2]!

      this.sortedOpacities[out] = this.srcOpacities[src]!

      const o4 = out * 4
      const s4 = src * 4
      this.sortedRotations[o4] = this.srcRotations[s4]!
      this.sortedRotations[o4 + 1] = this.srcRotations[s4 + 1]!
      this.sortedRotations[o4 + 2] = this.srcRotations[s4 + 2]!
      this.sortedRotations[o4 + 3] = this.srcRotations[s4 + 3]!
    }

    // ── Upload sorted data to GPU ──────────────────────────────────────
    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuf)
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.sortedPositions)

    gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuf)
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.sortedColors)

    gl.bindBuffer(gl.ARRAY_BUFFER, this.opacityBuf)
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.sortedOpacities)

    gl.bindBuffer(gl.ARRAY_BUFFER, this.scaleBuf)
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.sortedScales)

    gl.bindBuffer(gl.ARRAY_BUFFER, this.rotBuf)
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.sortedRotations)

    // ── Set uniforms ───────────────────────────────────────────────────
    gl.useProgram(this.program)
    gl.uniformMatrix4fv(this.u_viewMatrix, false, viewMatrix)
    gl.uniformMatrix4fv(this.u_projMatrix, false, projMatrix)
    gl.uniform2f(this.u_viewport, this.width, this.height)
    gl.uniform1f(this.u_focalX, projMatrix[0]! * this.width * 0.5)
    gl.uniform1f(this.u_focalY, projMatrix[5]! * this.height * 0.5)

    // ── Draw ───────────────────────────────────────────────────────────
    gl.viewport(0, 0, this.width, this.height)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)

    gl.bindVertexArray(this.vao)
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, n)
    gl.bindVertexArray(null)
  }

  resize(width: number, height: number): void {
    this.width = width
    this.height = height
    this.canvas.width = width
    this.canvas.height = height
  }

  dispose(): void {
    const gl = this.gl
    gl.deleteVertexArray(this.vao)
    gl.deleteBuffer(this.posBuf)
    gl.deleteBuffer(this.colorBuf)
    gl.deleteBuffer(this.opacityBuf)
    gl.deleteBuffer(this.scaleBuf)
    gl.deleteBuffer(this.rotBuf)
    gl.deleteProgram(this.program)
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  private createProgram(vertSrc: string, fragSrc: string): WebGLProgram {
    const gl = this.gl
    const vert = this.compileShader(gl.VERTEX_SHADER, vertSrc)
    const frag = this.compileShader(gl.FRAGMENT_SHADER, fragSrc)
    const prog = gl.createProgram()!
    gl.attachShader(prog, vert)
    gl.attachShader(prog, frag)
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(prog)
      gl.deleteProgram(prog)
      throw new Error(`Shader link failed: ${info ?? 'unknown error'}`)
    }
    gl.deleteShader(vert)
    gl.deleteShader(frag)
    return prog
  }

  private compileShader(type: GLenum, source: string): WebGLShader {
    const gl = this.gl
    const shader = gl.createShader(type)!
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader)
      gl.deleteShader(shader)
      throw new Error(`Shader compile failed: ${info ?? 'unknown error'}`)
    }
    return shader
  }

  private createAttribBuffer(location: number, components: number, instanceCount: number): WebGLBuffer {
    const gl = this.gl
    const buf = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, instanceCount * components * 4, gl.DYNAMIC_DRAW)
    gl.enableVertexAttribArray(location)
    gl.vertexAttribPointer(location, components, gl.FLOAT, false, 0, 0)
    gl.vertexAttribDivisor(location, 1)
    return buf
  }
}
