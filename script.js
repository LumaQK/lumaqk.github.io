/* ════════════════════════════════════════
   SOMMEIL — Sleep cycle calculator
   ════════════════════════════════════════ */

const CYCLE   = 90;   // minutes per sleep cycle
const WINDOW  = 120;  // ±2h window around desired wake
const IDEAL_N = 5;    // recommended cycles (7h30)

/* ────────────────────────────────────────
   DRUM PICKER

   Uses a single float `floatIdx` as the
   continuous scroll position (in item units).
   y = -floatIdx * ROW + ROW
   No copies-teleport, no setTimeout, no flash.

   COPIES = 21 → ±10 full lists of headroom,
   user can never scroll to an edge.
   ──────────────────────────────────────── */

const ROW    = 48;
const COPIES = 21;
const MID    = Math.floor(COPIES / 2);

class Drum {
  constructor(el) {
    this.el       = el;
    this.max      = parseInt(el.dataset.max, 10);
    this.count    = this.max + 1;
    this.val      = parseInt(el.dataset.val, 10);
    this.floatIdx = MID * this.count + this.val;
    this.vy       = 0;
    this.drag     = false;
    this.raf      = null;
    this._build();
    this._render(false);
    this._highlight();
    this._events();
  }

  /* ── Geometry ── */
  _y(fi)   { return -fi * ROW + ROW; }
  _wrap(v) { return ((Math.round(v) % this.count) + this.count) % this.count; }

  /* Apply floatIdx to DOM */
  _render(animated) {
    this.list.style.transition = animated ? 'transform .18s cubic-bezier(.25,.1,.25,1)' : 'none';
    this.list.style.transform  = `translateY(${this._y(this.floatIdx)}px)`;
    const v = this._wrap(this.floatIdx);
    if (v !== this.val) {
      this.val = v;
      this._highlight();
      this.onChange?.(v);
    }
  }

  /* Snap to nearest integer */
  _snap(animated) {
    cancelAnimationFrame(this.raf);
    this.vy = 0;
    this.floatIdx = Math.round(this.floatIdx);
    this.val = this._wrap(this.floatIdx);
    this._render(animated);
    this._highlight();
    this.onChange?.(this.val);
  }

  /* Step ±1 */
  step(d) {
    cancelAnimationFrame(this.raf);
    this.vy = 0;
    this.floatIdx = Math.round(this.floatIdx) + d;
    this.val = this._wrap(this.floatIdx);
    this._render(true);
    this._highlight();
    this.onChange?.(this.val);
  }

  /* Physics fling with adaptive friction */
  _fling() {
    const tick = () => {
      const s = Math.abs(this.vy);
      this.vy *= s > 1.5 ? 0.94 : s > 0.5 ? 0.88 : 0.80;
      this.floatIdx += this.vy;
      this._render(false);
      if (Math.abs(this.vy) < 0.02) { this._snap(true); return; }
      this.raf = requestAnimationFrame(tick);
    };
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(tick);
  }

  _highlight() {
    this.list.querySelectorAll('.drum-item').forEach(el => {
      const d = Math.min(
        Math.abs(parseInt(el.dataset.v, 10) - this.val),
        this.count - Math.abs(parseInt(el.dataset.v, 10) - this.val)
      );
      el.classList.toggle('sel',  d === 0);
      el.classList.toggle('near', d === 1);
    });
  }

  _cy(e) { return e.touches ? e.touches[0].clientY : e.clientY; }

  _build() {
    // Arrow up
    const up = document.createElement('button');
    up.type = 'button'; up.className = 'drum-arrow up';
    up.setAttribute('aria-label', 'précédent');
    up.addEventListener('mousedown', e => e.preventDefault());
    up.addEventListener('click', () => this.step(-1));

    // Arrow down
    const dn = document.createElement('button');
    dn.type = 'button'; dn.className = 'drum-arrow dn';
    dn.setAttribute('aria-label', 'suivant');
    dn.addEventListener('mousedown', e => e.preventDefault());
    dn.addEventListener('click', () => this.step(+1));

    // Viewport
    this.vp = document.createElement('div');
    this.vp.className = 'drum-viewport';
    this.vp.setAttribute('tabindex', '0');

    // List — COPIES copies of 0..max
    this.list = document.createElement('div');
    this.list.className = 'drum-list';
    for (let c = 0; c < COPIES; c++) {
      for (let i = 0; i <= this.max; i++) {
        const item = document.createElement('div');
        item.className = 'drum-item';
        item.dataset.v = i;
        item.textContent = String(i).padStart(2, '0');
        this.list.appendChild(item);
      }
    }

    this.vp.appendChild(this.list);
    this.el.appendChild(up);
    this.el.appendChild(this.vp);
    this.el.appendChild(dn);
  }

  _events() {
    const vp = this.vp;
    let startCY, startFI, prevCY, prevT;

    const onStart = e => {
      cancelAnimationFrame(this.raf);
      this.drag = true;
      startCY = prevCY = this._cy(e);
      startFI = this.floatIdx;
      prevT   = performance.now();
      this.vy = 0;
      this.list.style.transition = 'none';
      vp.style.cursor = 'grabbing';
    };

    const onMove = e => {
      if (!this.drag) return;
      e.preventDefault();
      const cy  = this._cy(e);
      const now = performance.now();
      const dt  = Math.max(now - prevT, 1);
      this.vy       = ((cy - prevCY) / dt / ROW) * 16;
      this.floatIdx = startFI - (cy - startCY) / ROW;
      this._render(false);
      prevCY = cy; prevT = now;
    };

    const onEnd = () => {
      if (!this.drag) return;
      this.drag = false;
      vp.style.cursor = '';
      Math.abs(this.vy) < 0.1 ? this._snap(true) : this._fling();
    };

    vp.addEventListener('mousedown',  onStart, { passive: true });
    vp.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('mousemove',  onMove, { passive: false });
    window.addEventListener('touchmove',  onMove, { passive: false });
    window.addEventListener('mouseup',  onEnd);
    window.addEventListener('touchend', onEnd);

    // Wheel
    let acc = 0;
    vp.addEventListener('wheel', e => {
      e.preventDefault();
      cancelAnimationFrame(this.raf); this.vy = 0;
      acc += e.deltaY / ROW;
      const steps = Math.trunc(acc);
      if (steps) { acc -= steps; this.floatIdx = Math.round(this.floatIdx) + steps; this._render(true); }
    }, { passive: false });

    // Keyboard
    vp.addEventListener('keydown', e => {
      if (e.key === 'ArrowUp')   { e.preventDefault(); this.step(-1); }
      if (e.key === 'ArrowDown') { e.preventDefault(); this.step(+1); }
    });
  }
}

/* ────────────────────────────────────────
   INIT
   ──────────────────────────────────────── */
const D = {
  bedH:  new Drum(document.getElementById('bed-h')),
  bedM:  new Drum(document.getElementById('bed-m')),
  wakeH: new Drum(document.getElementById('wake-h')),
  wakeM: new Drum(document.getElementById('wake-m')),
};

/* ────────────────────────────────────────
   SLIDER
   ──────────────────────────────────────── */
const slEl  = document.getElementById('latency');
const slLbl = document.getElementById('latency-display');

function syncSlider() {
  const v = +slEl.value;
  slEl.style.setProperty('--p', (v / 30 * 100).toFixed(1) + '%');
  slLbl.textContent = v === 0 ? '0 min' : `${v} min`;
}
slEl.addEventListener('input', syncSlider);
syncSlider();

/* ────────────────────────────────────────
   UTILS
   ──────────────────────────────────────── */
const wrap1440 = m => ((m % 1440) + 1440) % 1440;

const fmt = m => {
  m = wrap1440(m);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

const dur = m => {
  const h = Math.floor(m / 60), r = m % 60;
  return h && r ? `${h}h${String(r).padStart(2, '0')}` : h ? `${h}h` : `${r}min`;
};

/* ────────────────────────────────────────
   CALCULATE
   ──────────────────────────────────────── */
document.getElementById('calc-btn').addEventListener('click', () => {
  const bed     = D.bedH.val * 60 + D.bedM.val;
  const wake    = D.wakeH.val * 60 + D.wakeM.val;
  const latency = +slEl.value;
  const start   = bed + latency;

  // Build list of wake times within ±WINDOW of desired
  const cards = [];
  for (let n = 1; n <= 8; n++) {
    const wm = start + n * CYCLE;
    let diff = wrap1440(wm) - wrap1440(wake);
    if (diff >  720) diff -= 1440;
    if (diff < -720) diff += 1440;
    if (Math.abs(diff) <= WINDOW) cards.push({ wm, sleep: n * CYCLE, n, diff });
  }

  // Find closest wake time to desired
  let bestIdx = 0, bestD = Infinity;
  cards.forEach(({ diff }, i) => { if (Math.abs(diff) < bestD) { bestD = Math.abs(diff); bestIdx = i; } });

  const main   = document.querySelector('main');
  const isDesk = innerWidth >= 860;
  if (isDesk && !main.classList.contains('revealed')) {
    main.classList.add('revealed');
  }
  render(cards, bestIdx, bed, wake - IDEAL_N * CYCLE - latency, latency);
});

/* ────────────────────────────────────────
   RENDER
   ──────────────────────────────────────── */
function render(cards, bestIdx, bed, idealBed, lat) {
  const inner = document.getElementById('results-inner');
  const sec   = document.getElementById('results');
  inner.innerHTML = '';

  // Ideal bedtime
  inner.insertAdjacentHTML('beforeend', `
    <div class="ideal-box">
      <span class="ideal-moon">🌙</span>
      <div>
        <div class="ideal-eyebrow">couchez-vous à</div>
        <div class="ideal-time">${fmt(idealBed)}</div>
        <div class="ideal-note">${IDEAL_N} cycles · ${dur(IDEAL_N * CYCLE)} de sommeil</div>
      </div>
    </div>
    <div class="sec-label">heures de réveil</div>`);

  // Wake-up cards
  if (!cards.length) {
    inner.insertAdjacentHTML('beforeend',
      '<p style="font-family:var(--mono);font-size:.65rem;color:rgba(255,255,255,.35);text-align:center;padding:.5rem 0">aucun cycle dans cette fenêtre de ±2h</p>');
  } else {
    const grid = document.createElement('div');
    grid.className = 'cards';
    cards.forEach(({ wm, sleep, n }, i) => {
      const best  = i === bestIdx;
      const short = sleep < 270;
      const card  = document.createElement('div');
      card.className = `card${best ? ' best' : short ? ' short' : ''}`;
      card.style.animationDelay = `${i * 50}ms`;
      card.innerHTML = `
        <div class="card-time">${fmt(wm)}</div>
        <div class="card-right">
          ${best  ? '<span class="badge">idéal</span>' : ''}
          ${short && !best ? '<span class="badge">court</span>' : ''}
          <div class="card-n">${n} cycle${n > 1 ? 's' : ''}</div>
          <div class="card-dur">${dur(sleep + lat)}</div>
        </div>`;
      grid.appendChild(card);
    });
    inner.appendChild(grid);
  }

  // Footer
  inner.insertAdjacentHTML('beforeend',
    `<div class="foot">coucher à ${fmt(bed)} · endormissement ${lat === 0 ? 'immédiat' : `~${lat} min`} · cycles de 90 min</div>`);

  sec.classList.remove('hidden');
  sec.classList.add('show');
  document.getElementById('results-empty').style.display = 'none';
}

/* ── FloatingLines background — native WebGL, no dependencies ── */
(function () {
  const canvas = document.createElement('canvas');
  canvas.style.position = 'fixed';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.zIndex = '0';
  canvas.style.pointerEvents = 'none';
  canvas.style.width  = window.innerWidth  + 'px';
  canvas.style.height = window.innerHeight + 'px';
  document.body.prepend(canvas);
  // Body must be transparent so backdrop-filter on glass elements
  // can blur the WebGL canvas that sits behind (z-index:0)
  // Body color was just a loading fallback — canvas replaces it
  document.body.style.background = 'transparent';

  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  if (!gl) { canvas.style.background='#08070f'; return; }

  /* ── Shaders ── */
  const VS = `attribute vec2 p; void main(){gl_Position=vec4(p,0,1);}`;

  const FS = `
precision mediump float;
uniform float T;
uniform vec2  R;
uniform vec2  M;
uniform float BI;
uniform vec2  PO;

mat2 rot(float a){return mat2(cos(a),sin(a),-sin(a),cos(a));}

vec3 palette(float t){
  vec3 a=vec3(0.914,0.278,0.961);
  vec3 b=vec3(0.184,0.294,0.635);
  return mix(a,b,clamp(t*2.0,0.0,1.0))*0.5 + mix(b,a,clamp(t*2.0-1.0,0.0,1.0))*0.5;
}

float line(vec2 uv, float off){
  float amp = sin(off + T*0.2)*0.3;
  float y   = sin(uv.x + off + T*0.1)*amp;
  vec2  d   = uv - M;
  y += (M.y - uv.y)*exp(-dot(d,d)*5.0)*(-0.5)*BI;
  return 0.018/max(abs(uv.y-y)+0.008,0.001);
}

void main(){
  vec2 uv = (2.0*gl_FragCoord.xy - R)/R.y;
  uv.y *= -1.0;
  uv += PO;

  vec2 mu = (2.0*M - R)/R.y; mu.y *= -1.0;

  vec3 col = vec3(0.0);
  float L = length(uv)+0.001;

  /* bottom layer */
  col += palette(0.0/5.0)*line(uv*rot(-log(L))+vec2(2.0,-0.7), 1.5)*0.2;
  col += palette(1.0/5.0)*line(uv*rot(-log(L))+vec2(2.05,-0.7),1.7)*0.2;
  col += palette(2.0/5.0)*line(uv*rot(-log(L))+vec2(2.10,-0.7),1.9)*0.2;
  col += palette(3.0/5.0)*line(uv*rot(-log(L))+vec2(2.15,-0.7),2.1)*0.2;
  col += palette(4.0/5.0)*line(uv*rot(-log(L))+vec2(2.20,-0.7),2.3)*0.2;
  col += palette(5.0/5.0)*line(uv*rot(-log(L))+vec2(2.25,-0.7),2.5)*0.2;

  /* middle layer */
  col += palette(0.0/5.0)*line(uv*rot(0.2*log(L))+vec2(5.0, 0.0),2.00);
  col += palette(1.0/5.0)*line(uv*rot(0.2*log(L))+vec2(5.05,0.0),2.15);
  col += palette(2.0/5.0)*line(uv*rot(0.2*log(L))+vec2(5.10,0.0),2.30);
  col += palette(3.0/5.0)*line(uv*rot(0.2*log(L))+vec2(5.15,0.0),2.45);
  col += palette(4.0/5.0)*line(uv*rot(0.2*log(L))+vec2(5.20,0.0),2.60);
  col += palette(5.0/5.0)*line(uv*rot(0.2*log(L))+vec2(5.25,0.0),2.75);

  /* top layer */
  vec2 ruv;
  ruv=uv*rot(-0.4*log(L)); ruv.x*=-1.0; col+=palette(0.0/5.0)*line(ruv+vec2(10.0, 0.5),1.0)*0.1;
  ruv=uv*rot(-0.4*log(L)); ruv.x*=-1.0; col+=palette(1.0/5.0)*line(ruv+vec2(10.05,0.5),1.2)*0.1;
  ruv=uv*rot(-0.4*log(L)); ruv.x*=-1.0; col+=palette(2.0/5.0)*line(ruv+vec2(10.10,0.5),1.4)*0.1;
  ruv=uv*rot(-0.4*log(L)); ruv.x*=-1.0; col+=palette(3.0/5.0)*line(ruv+vec2(10.15,0.5),1.6)*0.1;
  ruv=uv*rot(-0.4*log(L)); ruv.x*=-1.0; col+=palette(4.0/5.0)*line(ruv+vec2(10.20,0.5),1.8)*0.1;
  ruv=uv*rot(-0.4*log(L)); ruv.x*=-1.0; col+=palette(5.0/5.0)*line(ruv+vec2(10.25,0.5),2.0)*0.1;

  gl_FragColor = vec4(col, 1.0);
}`;

  function mkShader(type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.error('Shader error:', gl.getShaderInfoLog(sh));
      return null;
    }
    return sh;
  }

  const vs = mkShader(gl.VERTEX_SHADER,   VS);
  const fs = mkShader(gl.FRAGMENT_SHADER, FS);
  if (!vs || !fs) return;

  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error('Link error:', gl.getProgramInfoLog(prog));
    return;
  }
  gl.useProgram(prog);

  /* Quad */
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
  const aP = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(aP);
  gl.vertexAttribPointer(aP, 2, gl.FLOAT, false, 0, 0);

  /* Uniform locations */
  const uT  = gl.getUniformLocation(prog, 'T');
  const uR  = gl.getUniformLocation(prog, 'R');
  const uM  = gl.getUniformLocation(prog, 'M');
  const uBI = gl.getUniformLocation(prog, 'BI');
  const uPO = gl.getUniformLocation(prog, 'PO');

  /* Resize */
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth, h = window.innerHeight;
    canvas.width  = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width  = w + 'px';
    canvas.style.height = h + 'px';
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  resize();
  window.addEventListener('resize', resize);

  /* Mouse */
  let tMx = -1000, tMy = -1000, cMx = -1000, cMy = -1000;
  let tBI = 0, cBI = 0;
  let tPx = 0, tPy = 0, cPx = 0, cPy = 0;
  const D = 0.05, PS = 0.2;

  window.addEventListener('mousemove', e => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    tMx = e.clientX * dpr;
    tMy = (window.innerHeight - e.clientY) * dpr;
    tBI = 1;
    tPx = (e.clientX / window.innerWidth  - 0.5) *  PS;
    tPy = (e.clientY / window.innerHeight - 0.5) * -PS;
  });
  window.addEventListener('mouseleave', () => { tBI = 0; });

  /* Render loop */
  let t0 = null;
  function loop(ts) {
    if (!t0) t0 = ts;
    const t = (ts - t0) / 1000;

    cMx += (tMx - cMx) * D; cMy += (tMy - cMy) * D;
    cBI += (tBI - cBI) * D;
    cPx += (tPx - cPx) * D; cPy += (tPy - cPy) * D;

    gl.uniform1f(uT,  t);
    gl.uniform2f(uR,  canvas.width, canvas.height);
    gl.uniform2f(uM,  cMx, cMy);
    gl.uniform1f(uBI, cBI);
    gl.uniform2f(uPO, cPx, cPy);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
