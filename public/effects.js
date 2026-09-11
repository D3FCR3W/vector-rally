import { key } from './engine.js';
import { getTheme } from './themes.js';

export const EFFECT_LIMITS = Object.freeze({ events: 96, particles: 384, marks: 1536 });
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const noise = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const mix = (a, b, t) => a + (b - a) * t;
const NEON = {
  green: { rgb: [.4, 1, .38], hex: '#66ff61' },
  purple: { rgb: [.8, .4, 1], hex: '#cc66ff' },
  yellow: { rgb: [1, .92, .3], hex: '#ffeb4d' }
};
export function neonColor(mark, style = 'mixed') {
  const names = ['green', 'purple', 'yellow'];
  return NEON[style] || NEON[names[((Math.floor((mark.x + mark.y) / 4) % 3) + 3) % 3]];
}

// Generate once per move. Sampling is analytic: pausing, seeking and FPS do not change an effect.
export function moveEffects(track, from, to, move = {}, start = 0, duration = 1, ease = false) {
  const crash = move.crash || move.type === 'crash', end = crash ? move.contact || to : to;
  const dx = end.x - from.x, dy = end.y - from.y, length = Math.hypot(dx, dy);
  const speed = Math.hypot(move.vx ?? to.vx, move.vy ?? to.vy), oldSpeed = Math.hypot(from.vx, from.vy);
  const turn = length && oldSpeed ? Math.acos(clamp((from.vx * dx + from.vy * dy) / (oldSpeed * length), -1, 1)) : 0;
  const skid = speed > oldSpeed + .2 || (oldSpeed >= 1.5 && turn >= Math.PI / 6);
  const marks = [], count = Math.min(96, Math.ceil(length * 4)), angle = Math.atan2(dy, dx);
  for (let i = 0; i < count; i++) {
    const t = (i + .5) / count, x = mix(from.x, end.x, t), y = mix(from.y, end.y, t);
    const dirt = track.hidden?.has(key(Math.round(x), Math.round(y)));
    // Airborne tires do not leave tracks or smoke on the surface below.
    if ((!skid && !dirt) || move.jumps) continue;
    const progress = crash ? t * .75 : ease ? 1 - Math.sqrt(1 - t) : t;
    marks.push({ x, y, angle, dirt: !!dirt, size: length / count, at: start + progress * duration });
  }
  return { start, duration, marks, crash, contact: end, impactAt: start + duration * .75, color: from.color,
    seed: from.id * 71 + from.x * 13 + from.y * 37 + (from.turns || 0) * 11 + to.x * 17 + to.y * 19, speed };
}

export function sampleEffects(events, time, theme = 'forest', reduced = false, trailStyle = 'mixed') {
  const profile = getTheme(theme).effects;
  const marks = [], particles = [];
  const add = p => { if (particles.length < EFFECT_LIMITS.particles) particles.push(p); };
  // Newest events get the particle budget; older tire marks remain underneath.
  for (let e = events.length - 1; e >= Math.max(0, events.length - EFFECT_LIMITS.events); e--) {
    const event = events[e]; if (time < event.start) continue;
    for (const mark of event.marks) {
      if (mark.at > time) continue;
      if (marks.length < EFFECT_LIMITS.marks) marks.push(mark);
      const age = time - mark.at;
      if (reduced || age > .9) continue;
      for (let i = 0; i < 2; i++) {
        const n = noise(event.seed + mark.x * 17 + mark.y * 5 + i * 31), side = i ? 1 : -1;
        const neon = mark.dirt && ['neon','plasma'].includes(profile.style), water = mark.dirt && profile.style === 'water';
        add({ x: mark.x - Math.sin(mark.angle) * side * .23 + (n - .5) * age,
          y: mark.y + Math.cos(mark.angle) * side * .23 - age * (neon ? .08 : .65),
          size: neon ? 9 + age * 10 : water ? 6 + age * 12 : 10 + age * 24, alpha: (1 - age / .9) * (neon ? .65 : .36), kind: neon ? 1 : water ? 3 : 0,
          color: mark.dirt ? profile.style === 'neon' ? neonColor(mark, trailStyle).rgb : profile.dust : [ .8, .84, .85 ], seed: n });
        if (mark.dirt && profile.style === 'dirt' && age < .5) add({ x: mark.x + (n - .5) * age * 3, y: mark.y - age + age * age * 3,
          size: theme === 'jungle' ? 6 : 3, alpha: 1 - age * 2, kind: theme === 'jungle' ? 4 : 2, color: profile.chips, seed: n });
      }
    }
    const age = time - event.impactAt;
    if (!event.crash || reduced || age < 0 || age > 1.2) continue;
    for (let i = 0; i < 64; i++) {
      const n = noise(event.seed + i), a = noise(i + event.seed * 3) * Math.PI * 2;
      const smoke = i >= 44, life = smoke ? 1.2 : .35 + n * .5;
      if (age > life) continue;
      const travel = smoke ? age * .6 : age * (1.1 + n * Math.min(4, event.speed + 1));
      const kind = smoke ? 0 : profile.style === 'water' ? 3 : profile.style === 'cloud' ? 2 : theme === 'jungle' && i % 3 === 0 ? 4 : i % 4 ? 1 : 2;
      add({ x: event.contact.x + Math.cos(a) * travel, y: event.contact.y + Math.sin(a) * travel + (smoke ? -age : age * age * profile.gravity),
        size: smoke ? 14 + age * 29 : kind >= 3 ? 7 : i % 4 ? 5 : 4, alpha: (1 - age / life) * (smoke ? .42 : 1), kind,
        color: smoke ? profile.smoke : kind === 4 || kind === 2 ? profile.chips : profile.impact, seed: n });
    }
  }
  return { marks, particles };
}

// One transparent WebGL draw call. Procedural point sprites avoid texture uploads
// and a full-screen postprocessing copy of the much larger terrain canvas.
export function createEffectLayer(canvas) {
  let gl, program, buffer, position, appearance, tint, resolution, lost = false, painted = false;
  const data = new Float32Array(EFFECT_LIMITS.particles * 9);
  function initialize() {
    try {
      gl = canvas.getContext('webgl', { alpha: true, antialias: false, depth: false, stencil: false, premultipliedAlpha: true, powerPreference: 'low-power' });
      if (!gl) return false;
      const shader = (type, source) => {
        const s = gl.createShader(type); gl.shaderSource(s, source); gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { gl.deleteShader(s); throw new Error('Effect shader could not compile'); } return s;
      };
      const vertex = shader(gl.VERTEX_SHADER, `
        attribute vec2 a_position; attribute vec4 a_appearance; attribute vec3 a_tint;
        uniform vec2 u_resolution; varying vec4 v_appearance; varying vec3 v_tint;
        void main() { vec2 p=a_position/u_resolution*2.0-1.0; gl_Position=vec4(p.x,-p.y,0.0,1.0);
          gl_PointSize=a_appearance.x; v_appearance=a_appearance; v_tint=a_tint; }`);
      const fragment = shader(gl.FRAGMENT_SHADER, `
        precision mediump float; varying vec4 v_appearance; varying vec3 v_tint;
        void main() { vec2 p=floor(gl_PointCoord*12.0)/12.0*2.0-1.0;
          float d=length(p); float kind=v_appearance.z; float alpha=v_appearance.y;
          vec3 color=v_tint;
          if(kind<0.5) { float cloud=0.84+0.16*sin(p.x*9.0+v_appearance.w*20.0)*cos(p.y*8.0);
            alpha*= (1.0-smoothstep(0.35,1.0,d))*cloud; color*=1.0+p.y*0.15; }
          else if(kind<1.5) { alpha*=1.0-smoothstep(0.1,1.0,d); color+=vec3(0.25)*(1.0-d); }
          else if(kind<2.5) { alpha*=step(max(abs(p.x),abs(p.y)),0.7); }
          else if(kind<3.5) { alpha*=smoothstep(0.35,0.55,d)*(1.0-smoothstep(0.7,1.0,d)); }
          else { alpha*=1.0-smoothstep(0.55,0.9,length(vec2(p.x+p.y,(p.x-p.y)*0.5))); }
          gl_FragColor=vec4(color,alpha); }`);
      program = gl.createProgram(); gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
      gl.deleteShader(vertex); gl.deleteShader(fragment);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Effect shader could not link');
      buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, data.byteLength, gl.DYNAMIC_DRAW);
      position = gl.getAttribLocation(program, 'a_position'); appearance = gl.getAttribLocation(program, 'a_appearance'); tint = gl.getAttribLocation(program, 'a_tint'); resolution = gl.getUniformLocation(program, 'u_resolution');
      gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      canvas.dataset.renderer = 'webgl'; return true;
    } catch { if (gl && program) gl.deleteProgram(program); canvas.dataset.renderer = 'canvas'; return false; }
  }
  let ready = initialize(); if (!ready) canvas.dataset.renderer = 'canvas';
  const onLost = event => { event.preventDefault(); lost = true; canvas.hidden = true; canvas.dataset.renderer = 'canvas'; };
  const onRestored = () => { lost = false; ready = initialize(); canvas.hidden = !ready; };
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', onRestored);
  function draw(particles, ctx, camera, width, height) {
    const useGL = ready && !lost;
    canvas.dataset.particles = particles.length;
    if (useGL) {
      if (!particles.length && !painted) return;
      gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      painted = particles.length > 0;
      if (!particles.length) return;
      let count = 0;
      const scale = canvas.width / width;
      for (const p of particles) {
        const x = ((p.x + .5) * 32 - camera.x) * camera.zoom + width / 2, y = ((p.y + .5) * 32 - camera.y) * camera.zoom + height / 2;
        if (x < -80 || y < -80 || x > width + 80 || y > height + 80) continue;
        data.set([x * scale, y * scale, p.size * camera.zoom * scale, p.alpha, p.kind, p.seed, ...p.color], count * 9); count++;
      }
      gl.useProgram(program); gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferSubData(gl.ARRAY_BUFFER, 0, data.subarray(0, count * 9));
      for (const [attr, size, offset] of [[position,2,0],[appearance,4,8],[tint,3,24]]) { gl.enableVertexAttribArray(attr); gl.vertexAttribPointer(attr,size,gl.FLOAT,false,36,offset); }
      gl.uniform2f(resolution, canvas.width, canvas.height); gl.drawArrays(gl.POINTS, 0, count);
    } else {
      for (const p of particles) {
        ctx.globalAlpha = p.alpha; ctx.fillStyle = `rgb(${p.color.map(c => Math.round(c * 255)).join(',')})`;
        ctx.fillRect((p.x + .5) * 32 - p.size / 2, (p.y + .5) * 32 - p.size / 2, p.size, p.size);
      }
      ctx.globalAlpha = 1;
    }
  }
  function dispose() {
    canvas.removeEventListener('webglcontextlost', onLost);
    canvas.removeEventListener('webglcontextrestored', onRestored);
    if (gl) { gl.deleteBuffer(buffer); gl.deleteProgram(program); gl.getExtension('WEBGL_lose_context')?.loseContext(); }
    ready = false;
  }
  return { draw, dispose };
}
