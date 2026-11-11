// Makes her ears and her tail move. Her pictures are flat drawings in which the ears are one fur with the hair of her head, so they cannot be cut out and turned like
// separate pieces; instead the picture is drawn by a small shader that pulls the pixels of the three parts about: each part bends a little round a point at its root (the
// further from the root, the more it turns, so an ear sways like hair and the tail like a tail), and a mask (assets/train/dog-masks.png, made by tools/pup_masks.py) says
// which pixels belong to which part. The rest of the picture is not touched. All her pictures are of one size and place, so the same masks fit every face.
//
//   const warp = createWarp(canvas, maskImage)    null when the browser has no WebGL (the rig then keeps showing the plain pictures)
//   warp.texture("happy", image)                  hand over a picture of her
//   warp.draw("happy", [leftEar, rightEar, tail]) draw it, the three angles in radians (positive = clockwise: the end of the part swings to the left)

// the roots and lengths of the parts, in the units of her 1024 px picture
const EAR_L = { x: 262, y: 262, len: 473 }, EAR_R = { x: 770, y: 250, len: 450 }, TAIL = { x: 742, y: 838, len: 190 };

const VERT = `attribute vec2 p; varying vec2 uv;
void main() { uv = vec2(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5); gl_Position = vec4(p, 0.0, 1.0); }`;
const FRAG = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 uv; uniform sampler2D tex; uniform sampler2D mask; uniform vec3 ang;
// where the pixel that is drawn at P comes from, when the part is turned clockwise by a round (x, y) (the inverse of the turn)
vec2 back(vec2 P, vec2 pivot, float a) { float c = cos(a), s = sin(a); vec2 v = P - pivot; return pivot + vec2(c * v.x + s * v.y, -s * v.x + c * v.y); }
void main() {
  vec3 m = texture2D(mask, uv).rgb;
  vec2 P = uv * 1024.0, q = P;
  if (m.r > 0.003) { float b = pow(clamp((P.y - ${EAR_L.y.toFixed(1)}) / ${EAR_L.len.toFixed(1)}, 0.0, 1.0), 1.25); q += back(P, vec2(${EAR_L.x.toFixed(1)}, ${EAR_L.y.toFixed(1)}), ang.x * b * m.r) - P; }
  if (m.g > 0.003) { float b = pow(clamp((P.y - ${EAR_R.y.toFixed(1)}) / ${EAR_R.len.toFixed(1)}, 0.0, 1.0), 1.25); q += back(P, vec2(${EAR_R.x.toFixed(1)}, ${EAR_R.y.toFixed(1)}), ang.y * b * m.g) - P; }
  if (m.b > 0.003) { float b = clamp(length(P - vec2(${TAIL.x.toFixed(1)}, ${TAIL.y.toFixed(1)})) / ${TAIL.len.toFixed(1)}, 0.0, 1.0); q += back(P, vec2(${TAIL.x.toFixed(1)}, ${TAIL.y.toFixed(1)}), ang.z * b * m.b) - P; }
  gl_FragColor = texture2D(tex, clamp(q / 1024.0, 0.0, 1.0));
}`;

export function createWarp(canvas, maskImage) {
  const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false });
  if (!gl) return null;
  const shader = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  let prog;
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  } catch (e) { console.warn("no warp:", e.message); return null; }
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const uAng = gl.getUniformLocation(prog, "ang");
  gl.uniform1i(gl.getUniformLocation(prog, "tex"), 0);
  gl.uniform1i(gl.getUniformLocation(prog, "mask"), 1);
  const make = (img, premultiply) => {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, premultiply);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    return t;
  };
  gl.activeTexture(gl.TEXTURE1);
  make(maskImage, false);
  gl.activeTexture(gl.TEXTURE0);
  const textures = {};
  return {
    texture(key, img) { textures[key] = make(img, true); },
    dispose() { gl.getExtension("WEBGL_lose_context")?.loseContext(); }, // (a browser only keeps a few WebGL contexts: let go of this one when her page is gone)
    draw(key, angles) {
      const t = textures[key];
      if (!t) return;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.uniform3f(uAng, angles[0], angles[1], angles[2]);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
  };
}
