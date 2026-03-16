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

/* ────────────────────────────────────────
   FLOATING LINES — Three.js WebGL shader
   Ported from React Bits (exact GLSL).

   Canvas injected directly into <body> as
   position:fixed so backdrop-filter on glass
   elements blurs the WebGL output.
   body { background: transparent } is required.
   ──────────────────────────────────────── */
(function () {
  const GRADIENT     = ['#E945F5', '#2F4BC0', '#E945F5'];
  const ANIM_SPEED   = 1;
  const BEND_RADIUS  = 5.0;
  const BEND_STR     = -0.5;
  const DAMPING      = 0.05;
  const PARALLAX_STR = 0.2;

  const vert = `
    precision highp float;
    void main() {
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`;

  const frag = `
    precision highp float;
    uniform float iTime;
    uniform vec3  iResolution;
    uniform float animationSpeed;
    uniform vec2  iMouse;
    uniform bool  interactive;
    uniform float bendRadius;
    uniform float bendStrength;
    uniform float bendInfluence;
    uniform bool  parallax;
    uniform vec2  parallaxOffset;
    uniform vec3  lineGradient[8];
    uniform int   lineGradientCount;

    mat2 rot(float r) { return mat2(cos(r),sin(r),-sin(r),cos(r)); }

    vec3 grad(float t) {
      if (lineGradientCount <= 1) return lineGradient[0];
      float s = clamp(t,0.0,0.9999) * float(lineGradientCount-1);
      int i = int(floor(s));
      return mix(lineGradient[i], lineGradient[min(i+1,lineGradientCount-1)], fract(s)) * 0.5;
    }

    float wave(vec2 uv, float off, vec2 suv, vec2 muv) {
      float t = iTime * animationSpeed;
      float y = sin(uv.x + off + t*0.1) * (sin(off + t*0.2) * 0.3);
      if (interactive) {
        vec2 d = suv - muv;
        y += (muv.y - suv.y) * exp(-dot(d,d)*bendRadius) * bendStrength * bendInfluence;
      }
      return 0.0175 / max(abs(uv.y - y)+0.01, 1e-3) + 0.01;
    }

    void mainImage(out vec4 o, in vec2 fc) {
      vec2 uv = (2.0*fc - iResolution.xy) / iResolution.y;
      uv.y *= -1.0;
      if (parallax) uv += parallaxOffset;

      vec2 muv = vec2(0.0);
      if (interactive) { muv = (2.0*iMouse - iResolution.xy)/iResolution.y; muv.y *= -1.0; }

      vec3 col = vec3(0.0);
      for (int i=0;i<6;++i) {
        float fi=float(i);
        col += grad(fi/5.0) * wave(uv*rot(-1.0*log(length(uv)+1.0))+vec2(0.05*fi+2.0,-0.7), 1.5+0.2*fi, uv, muv) * 0.2;
      }
      for (int i=0;i<6;++i) {
        float fi=float(i);
        col += grad(fi/5.0) * wave(uv*rot(0.2*log(length(uv)+1.0))+vec2(0.05*fi+5.0,0.0), 2.0+0.15*fi, uv, muv);
      }
      for (int i=0;i<6;++i) {
        float fi=float(i);
        vec2 ruv = uv*rot(-0.4*log(length(uv)+1.0)); ruv.x *= -1.0;
        col += grad(fi/5.0) * wave(ruv+vec2(0.05*fi+10.0,0.5), 1.0+0.2*fi, uv, muv) * 0.1;
      }
      o = vec4(col, 1.0);
    }

    void main() { vec4 c=vec4(0.0); mainImage(c,gl_FragCoord.xy); gl_FragColor=c; }`;

  function hex3(h) {
    const v = h.replace('#','');
    return [parseInt(v.slice(0,2),16)/255, parseInt(v.slice(2,4),16)/255, parseInt(v.slice(4,6),16)/255];
  }

  function boot() {
    const T = window.THREE;
    const scene    = new T.Scene();
    const camera   = new T.OrthographicCamera(-1,1,1,-1,0,1);
    camera.position.z = 1;

    const renderer = new T.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    const canvas = renderer.domElement;
    canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:0;pointer-events:none;display:block;';
    document.body.prepend(canvas);

    const stops = GRADIENT.slice(0, 8);
    const gradArr = Array.from({ length: 8 }, (_, i) => new T.Vector3(...(i < stops.length ? hex3(stops[i]) : [1,1,1])));

    const uniforms = {
      iTime:            { value: 0 },
      iResolution:      { value: new T.Vector3(1,1,1) },
      animationSpeed:   { value: ANIM_SPEED },
      iMouse:           { value: new T.Vector2(-1000,-1000) },
      interactive:      { value: true },
      bendRadius:       { value: BEND_RADIUS },
      bendStrength:     { value: BEND_STR },
      bendInfluence:    { value: 0 },
      parallax:         { value: true },
      parallaxOffset:   { value: new T.Vector2(0,0) },
      lineGradient:     { value: gradArr },
      lineGradientCount:{ value: stops.length },
    };

    scene.add(new T.Mesh(new T.PlaneGeometry(2,2), new T.ShaderMaterial({ uniforms, vertexShader: vert, fragmentShader: frag })));

    const tMouse = new T.Vector2(-1000,-1000), cMouse = new T.Vector2(-1000,-1000);
    const tPx    = new T.Vector2(0,0),         cPx    = new T.Vector2(0,0);
    let tInf = 0, cInf = 0;

    const setSize = () => {
      renderer.setSize(innerWidth, innerHeight, false);
      uniforms.iResolution.value.set(canvas.width, canvas.height, 1);
    };
    setSize();
    window.addEventListener('resize', setSize);

    window.addEventListener('mousemove', e => {
      const dpr = renderer.getPixelRatio();
      tMouse.set(e.clientX * dpr, (innerHeight - e.clientY) * dpr);
      tInf = 1;
      tPx.set((e.clientX / innerWidth - 0.5) * PARALLAX_STR, -(e.clientY / innerHeight - 0.5) * PARALLAX_STR);
    });
    window.addEventListener('mouseleave', () => { tInf = 0; });

    let t0 = null;
    (function loop(ts) {
      if (t0 === null) t0 = ts;
      uniforms.iTime.value = (ts - t0) / 1000;
      cMouse.lerp(tMouse, DAMPING); uniforms.iMouse.value.copy(cMouse);
      cInf += (tInf - cInf) * DAMPING; uniforms.bendInfluence.value = cInf;
      cPx.lerp(tPx, DAMPING); uniforms.parallaxOffset.value.copy(cPx);
      renderer.render(scene, camera);
      requestAnimationFrame(loop);
    })(0);
  }

  const s = document.createElement('script');
  s.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
  s.onload = boot;
  document.head.appendChild(s);
})();
