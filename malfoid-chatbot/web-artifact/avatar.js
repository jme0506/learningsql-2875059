// Malfoid's animated portrait: the painted image brought to life in a WebGL
// shader (blinks, lid poses, eye movement, talking mouth, smile/frown,
// blush, brow shifts, breathing and hair sway). The image is inlined at build
// time by build.mjs. Exposes window.MalfoidAvatar.mount(el).
(function () {
  const IMG_SRC = "__AVATAR_IMG__";
  const IMG_W = 736, IMG_H = 1304;
  const FOCUS = { x: 398, y: 370 }; // between the eyes and mouth, in image px

  // Feature geometry in image pixels (measured on the source painting).
  const GEO = {
    eyeL: { a: [298, 328], b: [368, 327], up: 13, low: 9.5 },   // viewer's left: outer -> inner
    eyeR: { a: [428, 305], b: [488, 287], up: 12, low: 10 },    // viewer's right: inner -> outer
    mouth: { l: [386, 427], r: [454, 411] },
    browL: [338, 299], browR: [458, 270],
    cheekL: [326, 374], cheekR: [480, 362],
  };

  // Target pose per expression.
  const EXPRESSIONS = {
    smug:      { lid: 0.24, look: [0, 0],    smileL: 0.1,  smileR: 0.9,  blush: 0,    brow: 0.5 },
    annoyed:   { lid: 0.28, look: [0, 0],    smileL: -0.5, smileR: -0.5, blush: 0,    brow: -2 },
    flustered: { lid: 0,    look: [-2.4, 0.6], smileL: 0.2, smileR: 0.2, blush: 0.9,  brow: 1.8 },
    sulking:   { lid: 0.36, look: [2, 1.4],  smileL: -0.6, smileR: -0.6, blush: 0.35, brow: -1 },
    soft:      { lid: 0.1,  look: [0, 0],    smileL: 0.7,  smileR: 0.7,  blush: 0.4,  brow: 1 },
  };
  const MOUTHS = { small: 2.2, mid: 4.2, wide: 6.2, ee: 3 };

  const VERT = `attribute vec2 aPos; void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

  const FRAG = `
precision highp float;
uniform sampler2D uTex;
uniform vec2 uImg, uCanvas, uOffset;
uniform float uScale, uTime, uLid, uMouth, uSmileL, uSmileR, uBlush, uBrow;
uniform vec2 uLook;
uniform vec2 uEyeLA, uEyeLB, uEyeRA, uEyeRB, uMouthL, uMouthR, uBrowL, uBrowR, uCheekL, uCheekR;
uniform vec4 uEyeH; // upL, lowL, upR, lowR

vec4 tex(vec2 p) { return texture2D(uTex, clamp(p, vec2(0.5), uImg - 0.5) / uImg); }

// Eye local frame: t along the corner axis (0..1), s perpendicular (+ = down).
void eyeFrame(vec2 p, vec2 a, vec2 b, out float t, out float s, out vec2 d, out vec2 n, out float len) {
  vec2 ab = b - a; len = length(ab); d = ab / len;
  n = vec2(-d.y, d.x); if (n.y < 0.0) n = -n;
  t = dot(p - a, d) / len; s = dot(p - a, n);
}

// Moves the iris (look) inside the eye opening.
vec2 eyeLook(vec2 p, vec2 q, vec2 a, vec2 b, float up, float low) {
  float t, s, len; vec2 d, n; eyeFrame(p, a, b, t, s, d, n, len);
  float arc = 4.0 * t * (1.0 - t);
  float inside = step(0.0, t) * step(t, 1.0) * smoothstep(-up * arc - 1.0, -up * arc + 2.0, s) * (1.0 - smoothstep(low * arc - 2.0, low * arc + 1.0, s));
  return q - uLook * inside;
}

// Paints the upper eyelid down to fraction uLid of the opening, with a lash line.
vec3 eyeLid(vec2 p, vec3 col, vec2 a, vec2 b, float up, float low, float lid) {
  if (lid < 0.01) return col;
  float t, s, len; vec2 d, n; eyeFrame(p, a, b, t, s, d, n, len);
  if (t < -0.06 || t > 1.06) return col;
  float tc = clamp(t, 0.0, 1.0);
  float arc = 4.0 * tc * (1.0 - tc);
  float yu = -up * arc, yl = low * arc;
  float edge = yu + lid * (yl - yu + 1.5);
  float top = yu - 4.5 * smoothstep(0.0, 0.12, lid);
  float cover = smoothstep(top - 1.5, top + 1.0, s) * (1.0 - smoothstep(edge - 0.6, edge + 0.6, s));
  float ends = smoothstep(-0.06, 0.04, t) * (1.0 - smoothstep(0.96, 1.06, t));
  // Skin for the lid comes from just under the eye on the same column.
  // Lid skin: a blurred patch from under the eye, blended with the cheek tone.
  vec2 under = a + d * (tc * len) + n * (yl + 9.0);
  vec3 skin = vec3(0.0);
  for (int i = -2; i <= 2; i++) {
    for (int j = 0; j < 3; j++) {
      skin += tex(under + d * float(i) * 3.0 + n * float(j) * 3.0).rgb;
    }
  }
  skin /= 15.0;
  vec3 cheek = 0.5 * (tex(uCheekL).rgb + tex(uCheekR).rgb);
  skin = mix(skin, cheek, 0.45);
  skin *= mix(0.98, 0.84, smoothstep(top, edge, s));
  skin *= 1.0 - 0.06 * (1.0 - smoothstep(top, top + 3.0, s));
  vec3 outc = mix(col, skin, cover * ends);
  // Lash along the moving lid edge.
  float lash = (1.0 - smoothstep(0.0, 2.0, abs(s - edge + 0.6))) * smoothstep(0.03, 0.2, lid) * ends;
  float flick = smoothstep(0.75, 1.0, abs(tc - 0.5) * 2.0);
  return mix(outc, vec3(0.16, 0.11, 0.09), clamp(lash * (0.85 + flick * 0.15), 0.0, 1.0));
}

void main() {
  vec2 frag = vec2(gl_FragCoord.x, uCanvas.y - gl_FragCoord.y);
  vec2 p = (frag - uOffset) / uScale;
  vec2 q = p;
  vec4 orig = tex(p);

  // Breathing: torso rises slightly.
  q.y += sin(uTime * 1.35) * 1.6 * smoothstep(430.0, 620.0, p.y);

  // Hair sway on the long side locks (bright pixels away from the face).
  float lum = dot(orig.rgb, vec3(0.299, 0.587, 0.114));
  float side = smoothstep(95.0, 175.0, abs(p.x - 398.0));
  float down = clamp((p.y - 250.0) / 650.0, 0.0, 1.0);
  float hair = side * down * smoothstep(0.36, 0.55, lum);
  q.x += hair * 3.2 * sin(uTime * 0.85 + p.y * 0.006) + hair * 1.2 * sin(uTime * 2.1 + p.y * 0.02);

  // Brows lift/lower.
  vec2 bl = (p - uBrowL) / vec2(42.0, 12.0), br = (p - uBrowR) / vec2(42.0, 12.0);
  float brow = exp(-dot(bl, bl)) + exp(-dot(br, br));
  q.y += uBrow * brow;

  // Eyes look around.
  q = eyeLook(p, q, uEyeLA, uEyeLB, uEyeH.x, uEyeH.y);
  q = eyeLook(p, q, uEyeRA, uEyeRB, uEyeH.z, uEyeH.w);

  // Mouth frame.
  vec2 mc = 0.5 * (uMouthL + uMouthR);
  vec2 md = normalize(uMouthR - uMouthL);
  vec2 mn = vec2(-md.y, md.x); if (mn.y < 0.0) mn = -mn;
  float halfW = 0.5 * length(uMouthR - uMouthL);
  float u = dot(p - mc, md) / halfW;
  float v = dot(p - mc, mn);
  float prof = pow(max(0.0, 1.0 - u * u), 0.7);
  float h = uMouth * prof;
  float near = 1.0 - smoothstep(1.1, 1.5, abs(u));

  // Smile / frown at the corners.
  float wL = exp(-pow((u + 0.95) / 0.28, 2.0)) * exp(-v * v / 70.0);
  float wR = exp(-pow((u - 0.95) / 0.28, 2.0)) * exp(-v * v / 70.0);
  q += mn * (uSmileL * 2.6 * wL + uSmileR * 2.6 * wR);

  float interior = 0.0;
  if (uMouth > 0.05 && near > 0.0 && v > -18.0 && v < 70.0) {
    if (v < 0.0) {
      q += mn * (0.3 * h * (1.0 - smoothstep(0.0, 14.0, -v)));
    } else if (v < h) {
      interior = smoothstep(0.0, 0.9, v) * smoothstep(0.0, 0.9, h - v);
    } else {
      float fall = 1.0 - smoothstep(16.0, 52.0, v - h);
      q -= mn * (h * fall);
    }
  }

  vec3 col = tex(q).rgb;

  if (interior > 0.0) {
    float depth = clamp(v / max(h, 0.001), 0.0, 1.0);
    vec3 inside = mix(vec3(0.42, 0.18, 0.17), vec3(0.24, 0.08, 0.08), 1.0 - abs(depth - 0.5) * 2.0);
    float teeth = (1.0 - smoothstep(0.18, 0.34, depth)) * (1.0 - smoothstep(0.3, 0.5, abs(u))) * smoothstep(3.5, 5.5, uMouth);
    inside = mix(inside, vec3(0.86, 0.8, 0.76), teeth * 0.7);
    col = mix(col, inside, interior);
  }

  col = eyeLid(p, col, uEyeLA, uEyeLB, uEyeH.x, uEyeH.y, uLid);
  col = eyeLid(p, col, uEyeRA, uEyeRB, uEyeH.z, uEyeH.w, uLid);

  // Blush.
  vec2 cl = (p - uCheekL) / vec2(40.0, 26.0), cr = (p - uCheekR) / vec2(34.0, 24.0);
  float blush = uBlush * (exp(-dot(cl, cl) * 1.4) + exp(-dot(cr, cr) * 1.4));
  col = mix(col, col * vec3(1.0, 0.8, 0.8) + vec3(0.05, 0.0, 0.01), clamp(blush * 0.75, 0.0, 0.8));

  gl_FragColor = vec4(col, 1.0);
}`;

  function mount(el) {
    el.classList.add("mav");
    el.innerHTML = "";
    const img = new Image();
    img.alt = "";
    img.src = IMG_SRC;
    const canvas = document.createElement("canvas");
    canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block";
    el.append(canvas);

    const state = { lid: 0.24, look: [0, 0], smileL: 0.1, smileR: 0.9, blush: 0, brow: 0.5, mouth: 0 };
    let target = { ...EXPRESSIONS.smug };
    let mouthTarget = 0, exprName = "smug", blinkUntil = 0, glance = [0, 0];

    const gl = canvas.getContext("webgl", { antialias: false, premultipliedAlpha: false });
    if (!gl) {
      // No WebGL: show the still painting.
      img.style.cssText = "position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:54% 22%";
      canvas.replaceWith(img);
      return { setExpression() {}, setMouth() {}, blink() {}, get expression() { return exprName; } };
    }

    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    const U = {};
    for (const n of ["uImg", "uCanvas", "uOffset", "uScale", "uTime", "uLid", "uMouth", "uSmileL", "uSmileR", "uBlush", "uBrow", "uLook",
      "uEyeLA", "uEyeLB", "uEyeRA", "uEyeRB", "uMouthL", "uMouthR", "uBrowL", "uBrowR", "uCheekL", "uCheekR", "uEyeH"]) U[n] = gl.getUniformLocation(prog, n);
    gl.uniform2f(U.uImg, IMG_W, IMG_H);
    gl.uniform2fv(U.uEyeLA, GEO.eyeL.a); gl.uniform2fv(U.uEyeLB, GEO.eyeL.b);
    gl.uniform2fv(U.uEyeRA, GEO.eyeR.a); gl.uniform2fv(U.uEyeRB, GEO.eyeR.b);
    gl.uniform4f(U.uEyeH, GEO.eyeL.up, GEO.eyeL.low, GEO.eyeR.up, GEO.eyeR.low);
    gl.uniform2fv(U.uMouthL, GEO.mouth.l); gl.uniform2fv(U.uMouthR, GEO.mouth.r);
    gl.uniform2fv(U.uBrowL, GEO.browL); gl.uniform2fv(U.uBrowR, GEO.browR);
    gl.uniform2fv(U.uCheekL, GEO.cheekL); gl.uniform2fv(U.uCheekR, GEO.cheekR);

    const texture = gl.createTexture();
    let ready = false;
    img.onload = () => {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
      ready = true;
    };

    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    let last = start;

    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const w = Math.max(1, Math.round(canvas.clientWidth * Math.min(devicePixelRatio || 1, 2)));
      const h = Math.max(1, Math.round(canvas.clientHeight * Math.min(devicePixelRatio || 1, 2)));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }

      // Ease towards the target pose; blinks override the lid.
      const k = 1 - Math.exp(-dt * 7);
      const blinking = now < blinkUntil;
      state.lid += ((blinking ? 1 : target.lid) - state.lid) * (blinking ? 1 - Math.exp(-dt * 40) : k);
      state.look[0] += (target.look[0] + glance[0] - state.look[0]) * k;
      state.look[1] += (target.look[1] + glance[1] - state.look[1]) * k;
      for (const key of ["smileL", "smileR", "blush", "brow"]) state[key] += (target[key] - state[key]) * k;
      state.mouth += (mouthTarget - state.mouth) * (1 - Math.exp(-dt * 22));

      if (ready) {
        // Cover the stage, keeping the face in the upper-middle.
        const t = reduced ? 0 : (now - start) / 1000;
        const scale = Math.max(w / IMG_W, h / IMG_H) * 1.1;
        let ox = w / 2 - FOCUS.x * scale;
        let oy = h * 0.36 - FOCUS.y * scale;
        ox = Math.min(0, Math.max(w - IMG_W * scale, ox));
        oy = Math.min(0, Math.max(h - IMG_H * scale, oy));
        oy += Math.sin(t * 1.35) * 0.9 * scale;
        gl.viewport(0, 0, w, h);
        gl.uniform2f(U.uCanvas, w, h);
        gl.uniform2f(U.uOffset, ox, oy);
        gl.uniform1f(U.uScale, scale);
        gl.uniform1f(U.uTime, t);
        gl.uniform1f(U.uLid, state.lid);
        gl.uniform1f(U.uMouth, state.mouth);
        gl.uniform1f(U.uSmileL, state.smileL);
        gl.uniform1f(U.uSmileR, state.smileR);
        gl.uniform1f(U.uBlush, state.blush);
        gl.uniform1f(U.uBrow, state.brow);
        gl.uniform2f(U.uLook, state.look[0], state.look[1]);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    function blink() { blinkUntil = performance.now() + 110; }
    (function blinkLoop() {
      setTimeout(() => { blink(); if (Math.random() < 0.2) setTimeout(blink, 280); blinkLoop(); }, 2400 + Math.random() * 3600);
    })();
    (function glanceLoop() {
      setTimeout(() => {
        glance = Math.random() < 0.55 ? [0, 0] : [(Math.random() - 0.5) * 2.6, (Math.random() - 0.5) * 1.2];
        glanceLoop();
      }, 1800 + Math.random() * 3000);
    })();

    function setExpression(name) {
      const e = EXPRESSIONS[String(name).toLowerCase()];
      if (!e) return;
      target = { ...e };
      exprName = String(name).toLowerCase();
    }
    function setMouth(shape) { mouthTarget = MOUTHS[shape] || 0; }

    // Test hook: pin a pose without easing.
    function pose(p) { Object.assign(state, p); Object.assign(target, p); if (p.mouth != null) mouthTarget = p.mouth; }

    return { setExpression, setMouth, blink, pose, get expression() { return exprName; } };
  }

  window.MalfoidAvatar = { mount, expressions: Object.keys(EXPRESSIONS) };
})();
