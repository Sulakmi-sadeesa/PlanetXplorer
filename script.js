// PlanetXplorer – interactive 3D solar system explorer
// Three.js is loaded globally via the CDN script in the HTML.

const $ = s => document.querySelector(s);
const rm = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- state ----------
let S = {
  sel: '',
  ex: [],
  fav: [],
  best: 0,
  done: 0,
  seen: 0,
  spd: 5,
  axes: 0,
  orb: 1,
  lb: 1,
  real: 0,
  pause: rm ? 1 : 0
};
try {
  Object.assign(S, JSON.parse(localStorage.getItem('cosmic:v1') || '{}'));
} catch (e) {}
const save = () => {
  try {
    localStorage.setItem('cosmic:v1', JSON.stringify(S));
  } catch (e) {}
};

// ---------- data ----------
// n, type, class, diam km, mass 1e24kg, gravity m/s2, temp C, AU, orbit days,
// rotation h (neg=retrograde), moons, atmosphere, fact, color, tex
const D = [
  ['Sun', 'Star', 'Star', 1391400, 1988500, 274, 5500, 0, 0, 609, 0, 'Hydrogen and helium plasma', 'Light from the Sun takes about 8 minutes to reach Earth.', '#ffcf5a', 'sun'],
  ['Mercury', 'Planet', 'Rocky', 4879, .33, 3.7, 167, .387, 88, 1407.6, 0, 'Almost none (thin exosphere)', 'A day on Mercury (sunrise to sunrise) lasts about 176 Earth days.', '#9a8f86', 'rock'],
  ['Venus', 'Planet', 'Rocky', 12104, 4.87, 8.9, 464, .723, 224.7, -5832.5, 0, 'Thick carbon dioxide with sulfuric-acid clouds', 'Venus rotates backwards compared with most planets, and is hotter than Mercury.', '#d9b26f', 'rock'],
  ['Earth', 'Planet', 'Rocky', 12756, 5.97, 9.8, 15, 1, 365.2, 23.9, 1, 'Nitrogen and oxygen', 'Earth is the only known world with liquid surface water and life.', '#4a86d8', 'earth'],
  ['Mars', 'Planet', 'Rocky', 6792, .642, 3.7, -65, 1.524, 687, 24.6, 2, 'Thin carbon dioxide', 'Olympus Mons on Mars is the tallest volcano known in the Solar System.', '#c1583a', 'rock'],
  ['Jupiter', 'Planet', 'Gas giant', 142984, 1898, 23.1, -110, 5.204, 4333, 9.9, 95, 'Hydrogen and helium', 'Jupiter is the largest planet; about 11 times Earth\'s diameter.', '#d2a77b', 'gas'],
  ['Saturn', 'Planet', 'Gas giant', 120536, 568, 9, -140, 9.58, 10759, 10.7, 274, 'Hydrogen and helium', 'Saturn\'s rings are made mostly of water ice and rocky particles.', '#e3cf98', 'gas'],
  ['Uranus', 'Planet', 'Ice giant', 51118, 86.8, 8.7, -195, 19.2, 30687, -17.2, 29, 'Hydrogen, helium and methane', 'Uranus spins tilted about 98 degrees, so it rolls around the Sun on its side.', '#8fd8dc', 'ice'],
  ['Neptune', 'Planet', 'Ice giant', 49528, 102, 11, -200, 30.05, 60190, 16.1, 16, 'Hydrogen, helium and methane', 'Neptune has the fastest winds of any planet, over 2,000 km/h.', '#4a63d8', 'ice'],
  ['Pluto', 'Dwarf planet', 'Dwarf planet', 2376, .013, .7, -225, 39.5, 90560, -153.3, 5, 'Thin nitrogen and methane', 'Pluto\'s heart-shaped plain, Sputnik Planitia, is a giant nitrogen-ice glacier.', '#c9b39c', 'rock'],
  ['Moon', 'Moon of Earth', 'Moon', 3475, .0735, 1.6, -20, 0, 27.3, 655.7, 0, 'None (trace exosphere)', 'The Moon is slowly drifting away from Earth, about 3.8 cm each year.', '#bdbdbd', 'rock']
];

const B = D.map(a => ({
  n: a[0], t: a[1], c: a[2], d: a[3], m: a[4], g: a[5], T: a[6],
  au: a[7], p: a[8], r: a[9], mo: a[10], a: a[11], f: a[12], col: a[13], tx: a[14]
}));

const by = n => B.find(b => b.n === n);

/* ===== SIMULATION DATA (NASA/JPL Planetary Fact Sheets) =====
 1. AXIAL ROTATION: a body spinning about its own axis. rotationPeriod is the SIDEREAL period (one full turn against the distant stars, in hours). It sets the length of a day.
 2. ORBITAL REVOLUTION: travel around the Sun (Moon: around Earth). orbitalPeriod (Earth days) sets the length of a year. Rotation and revolution are separate systems.
 3. AXIAL TILT (obliquity): angle between the spin axis and the normal of the orbital plane. Above 90 degrees means retrograde spin (Venus, Uranus, Pluto), so rotationDirection is derived from it. The axis keeps a fixed direction in space while the body orbits, which is what makes seasons.
 4. SIMULATION TIME SCALING: one clock, simT (simulated seconds), advances by dt x speed each frame. Every angle is computed as 2*PI*simT/period, so relative rates stay exact at any speed and nothing accumulates frame-by-frame error. Speed 1x = real time.
 Simplification: real spin axes also point toward different compass directions; here every axis leans toward the same side. Moon's tilt is relative to the ecliptic; its 5.1 degree orbital inclination is not modelled. */

const DAY = 86400, TAU = Math.PI * 2;

const ax = (rotationPeriod, orbitalPeriod, axialTilt, orbitalDirection = 1) => ({
  rotationPeriod,
  orbitalPeriod,
  axialTilt,
  rotationDirection: axialTilt > 90 ? -1 : 1,
  orbitalDirection
});

const ASTRO = {
  Sun: ax(609.12, 0, 7.25),
  Mercury: ax(1407.5, 87.969, .034),
  Venus: ax(5832.5, 224.701, 177.36),
  Earth: ax(23.9345, 365.256, 23.44),
  Mars: ax(24.6229, 686.98, 25.19),
  Jupiter: ax(9.925, 4332.59, 3.13),
  Saturn: ax(10.656, 10759.22, 26.73),
  Uranus: ax(17.24, 30688.5, 97.77),
  Neptune: ax(16.11, 60182, 28.32),
  Pluto: ax(153.29, 90560, 122.53),
  Moon: ax(27.3217 * 24, 27.3217, 1.54) // Moon: rotation period = orbital period (synchronous rotation)
};

B.forEach(b => {
  const A = ASTRO[b.n];
  b.A = A;
  b.p = A.orbitalPeriod;
  b.r = A.rotationPeriod * A.rotationDirection;
});

const shape = c => c === 'Dwarf planet' ? 'dw' : c === 'Moon' ? 'mn' : '';

// ---------- scene ----------
const cv = $('#c');
const R = new THREE.WebGLRenderer({ canvas: cv, antialias: true });
R.setPixelRatio(Math.min(devicePixelRatio, 2));

const sc = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(50, 1, .1, 3000);
sc.add(new THREE.AmbientLight(0x334066, .7));
const sun = new THREE.PointLight(0xffffff, 1.6, 0, 0);
sc.add(sun);

const rnd = (() => {
  let s = 7;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
})();

function tex(b) {
  const k = document.createElement('canvas');
  k.width = 256;
  k.height = 128;
  const x = k.getContext('2d');
  x.fillStyle = b.col;
  x.fillRect(0, 0, 256, 128);

  if (b.tx === 'gas' || b.tx === 'ice') {
    for (let y = 0; y < 128; y += 4) {
      x.fillStyle = `rgba(${rnd() > .5 ? 255 : 40},${rnd() > .5 ? 230 : 60},${rnd() > .5 ? 200 : 40},${.10 + rnd() * .18})`;
      x.fillRect(0, y, 256, 3 + rnd() * 5);
    }
  } else {
    for (let i = 0; i < (b.tx === 'earth' ? 60 : 120); i++) {
      x.fillStyle = b.tx === 'earth'
        ? (rnd() > .4 ? 'rgba(60,140,70,.85)' : 'rgba(255,255,255,.7)')
        : `rgba(0,0,0,${rnd() * .25})`;
      x.beginPath();
      x.arc(rnd() * 256, rnd() * 128, 3 + rnd() * (b.tx === 'earth' ? 14 : 9), 0, 7);
      x.fill();
    }
  }

  if (b.tx === 'sun') {
    x.fillStyle = 'rgba(255,140,0,.35)';
    for (let i = 0; i < 80; i++) x.fillRect(rnd() * 256, rnd() * 128, 10, 6);
  }

  return new THREE.CanvasTexture(k);
}

const sz = {
  edu: {
    Sun: 6, Mercury: .7, Venus: 1.1, Earth: 1.2, Mars: .9,
    Jupiter: 3.4, Saturn: 2.9, Uranus: 1.9, Neptune: 1.9,
    Pluto: .55, Moon: .35
  }
};

const orbitR = (b, i) => S.real ? 10 + b.au * 7.5 : (b.au ? 14 + (i - 1) * 8.5 : 0);

const P = [];

B.forEach((b, i) => {
  const g = new THREE.Group();
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(1, 48, 32),
    b.tx === 'sun'
      ? new THREE.MeshBasicMaterial({ map: tex(b) })
      : new THREE.MeshStandardMaterial({ map: tex(b), roughness: 1 })
  );

  const tl = new THREE.Group();
  tl.rotation.z = b.A.axialTilt * Math.PI / 180;
  tl.add(m);
  g.add(tl);
  b.tl = tl;

  const al = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, -1.7, 0),
      new THREE.Vector3(0, 1.7, 0)
    ]),
    new THREE.LineBasicMaterial({ color: 0xf2c078 })
  );
  al.visible = false;
  tl.add(al);
  b.al = al;

  b.g = g;
  b.m = m;
  b.i = i;
  b.ph = i * 1.7;

  b.el = document.createElement('div');
  b.el.className = 'lb';
  b.el.textContent = b.n;
  b.el.setAttribute('aria-hidden', 'true');
  document.body.appendChild(b.el);

  if (b.n === 'Saturn') {
    const rg = new THREE.Mesh(
      new THREE.RingGeometry(1.35, 2.3, 64),
      new THREE.MeshBasicMaterial({
        color: 0xd8c48f,
        side: 2,
        transparent: true,
        opacity: .75
      })
    );
    rg.rotation.x = -Math.PI / 2;
    tl.add(rg);
    b.rg = rg;
  }

  if (b.au || b.n === 'Moon') {
    b.ring = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: 0x8fa2ff, transparent: true, opacity: .35 })
    );
    if (b.au) sc.add(b.ring);
  }

  sc.add(b.n === 'Moon' ? new THREE.Group() : g);
});

const earth = by('Earth');
const moon = by('Moon');

earth.g.add(moon.g);
moon.g.parent !== earth.g && earth.g.add(moon.g);

function layout() {
  B.forEach((b, i) => {
    const s = S.real && b.au
      ? Math.max(.3, .55 * Math.pow(b.d / 12756, .55))
      : sz.edu[b.n];
    b.rad = b.n === 'Sun' && S.real ? 5 : s;
    b.m.scale.setScalar(b.rad);

    if (b.rg) b.rg.scale.setScalar(b.rad);
    b.al.scale.setScalar(b.rad);

    b.R = b.n === 'Moon' ? earth.rad * 2.4 : orbitR(b, i);

    if (b.ring && b.au) {
      const pts = [];
      for (let k = 0; k <= 128; k++) {
        const a = k / 128 * 6.2832;
        pts.push(new THREE.Vector3(Math.cos(a) * b.R, 0, Math.sin(a) * b.R));
      }
      b.ring.geometry.setFromPoints(pts);
    }
  });
}
layout();

// starfield
const st = new THREE.BufferGeometry();
const sp = [];
for (let i = 0; i < 1800; i++) {
  const v = new THREE.Vector3(rnd() - .5, rnd() - .5, rnd() - .5)
    .normalize()
    .multiplyScalar(900 + rnd() * 300);
  sp.push(v.x, v.y, v.z);
}
st.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
sc.add(new THREE.Points(st, new THREE.PointsMaterial({
  color: 0xffffff,
  size: 1.6,
  sizeAttenuation: false
})));

// ---------- camera ----------
let yaw = .6, pit = .55, dist = 95, tDist = 95;
let tgt = new THREE.Vector3();
let foc = null;

function focus(n, move = true) {
  const b = by(n);
  S.sel = n;
  foc = b.n === 'Sun' && !move ? null : b;
  tDist = b.n === 'Sun' ? 26 : b.rad * 4.5 + 3;
  if (!S.ex.includes(n)) S.ex.push(n);
  save();
  panel();
  listUI();
}

function overview() {
  foc = null;
  tDist = S.real ? 260 : 110;
  S.sel = '';
  panel();
  listUI();
}

function resize() {
  R.setSize(innerWidth, innerHeight, false);
  cam.aspect = innerWidth / innerHeight;
  cam.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

let drag = null, moved = 0;

cv.addEventListener('pointerdown', e => {
  drag = { x: e.clientX, y: e.clientY };
  moved = 0;
  cv.setPointerCapture(e.pointerId);
});

cv.addEventListener('pointermove', e => {
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  moved += Math.abs(dx) + Math.abs(dy);
  yaw -= dx * .006;
  pit = Math.max(-1.4, Math.min(1.4, pit + dy * .006));
  drag = { x: e.clientX, y: e.clientY };
});

cv.addEventListener('pointerup', e => {
  drag = null;
  if (moved < 6) {
    const r = new THREE.Raycaster();
    const v = new THREE.Vector2(
      e.clientX / innerWidth * 2 - 1,
      -e.clientY / innerHeight * 2 + 1
    );
    r.setFromCamera(v, cam);
    const h = r.intersectObjects(B.map(b => b.m))[0];
    if (h) focus(B.find(b => b.m === h.object).n);
  }
});

cv.addEventListener('wheel', e => {
  e.preventDefault();
  tDist = Math.max(2, Math.min(500, tDist * (1 + e.deltaY * .001)));
}, { passive: false });

cv.addEventListener('keydown', e => {
  const k = e.key;
  if (k === 'ArrowLeft') yaw -= .1;
  else if (k === 'ArrowRight') yaw += .1;
  else if (k === 'ArrowUp') pit = Math.min(1.4, pit + .08);
  else if (k === 'ArrowDown') pit = Math.max(-1.4, pit - .08);
  else if (k === '+' || k === '=') tDist *= .85;
  else if (k === '-') tDist *= 1.18;
  else if (k === ' ') {
    e.preventDefault();
    $('#pp').click();
  } else return;
  e.preventDefault();
});

// ---------- animation loop ----------
let last = performance.now();
let tv = new THREE.Vector3();
let simT = 0;

function frame(now) {
  const dt = Math.min(.05, (now - last) / 1e3);
  last = now;

  if (!S.pause) simT += dt * 10 ** S.spd; // only the clock uses dt; angles below are absolute

  B.forEach(b => {
    const A = b.A;

    // revolution: counterclockwise seen from the ecliptic north pole (x toward -z), independent of spin
    const th = A.orbitalPeriod
      ? b.ph + A.orbitalDirection * TAU * (simT / (A.orbitalPeriod * DAY))
      : 0;

    if (b.n !== 'Sun') {
      b.g.position.set(Math.cos(th) * b.R, 0, -Math.sin(th) * b.R);
    }

    // rotation about the tilted axis; Moon starts with its spin phase equal to its orbit phase so one face always points at Earth
    b.m.rotation.y = (b.n === 'Moon' ? b.ph : 0) +
      TAU * ((simT / (A.rotationPeriod * 3600)) % 1);
  });

  if (foc) {
    foc.g.getWorldPosition(tv);
  } else {
    tv.set(0, 0, 0);
  }

  const e = rm ? 1 : .07;
  tgt.lerp(tv, e);
  dist += (tDist - dist) * e;

  cam.position.set(
    tgt.x + dist * Math.cos(pit) * Math.sin(yaw),
    tgt.y + dist * Math.sin(pit),
    tgt.z + dist * Math.cos(pit) * Math.cos(yaw)
  );
  cam.lookAt(tgt);

  B.forEach(b => {
    b.al.visible = !!S.axes || b.n === S.sel;
    if (b.ring && b.au) b.ring.visible = !!S.orb;

    const p = new THREE.Vector3();
    b.g.getWorldPosition(p);
    p.y += b.rad * 1.3;
    p.project(cam);

    b.el.style.display = S.lb && p.z < 1 ? 'block' : 'none';
    b.el.style.transform = `translate(${(p.x * .5 + .5) * innerWidth - 14}px,${(-p.y * .5 + .5) * innerHeight}px)`;
  });

  R.render(sc, cam);
  requestAnimationFrame(frame);
}

// ---------- UI helpers ----------
const fmt = (v, u = '') => (v >= 1e3 ? v.toLocaleString('en') : v) + u;

const stats = b => [
  ['Type', b.c],
  ['Diameter', fmt(b.d, ' km')],
  ['Mass', b.m + ' × 10²⁴ kg'],
  ['Gravity', b.g + ' m/s²'],
  ['Temperature', (b.n === 'Sun' ? '~5,500 °C (surface)' : 'about ' + b.T + ' °C')],
  ['Distance from Sun', b.au ? b.au + ' AU' : b.n === 'Moon' ? '1 AU (orbits Earth)' : '—'],
  ['Orbital period', b.p ? fmt(b.p, ' Earth days') : '—'],
  ['Rotation (sidereal)', (Math.abs(b.r) > 72 ? (Math.abs(b.r) / 24).toFixed(2) + ' days' : Math.abs(b.r) + ' h') + (b.r < 0 ? ', retrograde' : '')],
  ['Axial tilt', b.A.axialTilt + '°'],
  ['Moons', b.mo]
];

function panel() {
  const b = by(S.sel);
  const el = $('#info');

  if (!b) {
    el.innerHTML = `
      <h2>Solar System</h2>
      <p>Select an object from the list or click it in the scene to fly there and see its statistics.</p>
      <p class="note">Sizes and distances are visually simplified so every world fits on screen. Rotation and orbital periods use real NASA values; raise the Time slider to speed them up (1× is real time).</p>
      <p>Explored: ${S.ex.length} of ${B.length}</p>
    `;
    return;
  }

  const f = S.fav.includes(b.n);

  el.innerHTML = `
    <button class="fav" aria-pressed="${f}" id="fv">${f ? '★ Saved' : '☆ Save'}</button>
    <h2>${b.n}</h2>
    <span class="badge">
      <span class="dot ${shape(b.c)}" style="display:inline-block;width:8px;height:8px;background:${b.col}"></span>
      ${b.c}
    </span>
    <dl>${stats(b).map(r => `<dt>${r[0]}</dt><dd>${r[1]}</dd>`).join('')}</dl>
    <p><b>Atmosphere:</b> ${b.a}.</p>
    <p>${b.f}</p>
    <p class="note" id="rate"></p>
    <button class="fav" style="float:none" id="ov">Back to overview</button>
  `;

  $('#fv').onclick = () => {
    S.fav = f ? S.fav.filter(x => x !== b.n) : [...S.fav, b.n];
    save();
    panel();
  };
  $('#ov').onclick = overview;
  rate();
  $('#prog').textContent = 'Explored ' + S.ex.length + '/' + B.length;
}

function listUI() {
  const q = $('#q').value.toLowerCase();
  $('#list').innerHTML = '';

  B.filter(b =>
    b.n.toLowerCase().includes(q) || b.c.toLowerCase().includes(q)
  ).forEach(b => {
    const x = document.createElement('button');
    x.innerHTML = `
      <span class="dot ${shape(b.c)}" style="background:${b.col}"></span>
      <span>${b.n}${S.fav.includes(b.n) ? ' ★' : ''}<br><small class="note">${b.c}</small></span>
    `;
    if (b.n === S.sel) x.setAttribute('aria-current', 'true');
    x.onclick = () => focus(b.n);
    $('#list').appendChild(x);
  });
}

$('#q').oninput = listUI;

$('#pp').onclick = e => {
  S.pause = S.pause ? 0 : 1;
  e.target.textContent = S.pause ? 'Play' : 'Pause';
  e.target.setAttribute('aria-pressed', !!S.pause);
  save();
};

const dur = s => s < 60 ? s.toFixed(0) + ' s' :
  s < 3600 ? (s / 60).toFixed(1) + ' min' :
  s < DAY ? (s / 3600).toFixed(1) + ' h' :
  s < 31557600 ? (s / DAY).toFixed(1) + ' days' :
  (s / 31557600).toFixed(1) + ' years';

function rate() {
  const b = by(S.sel), e = $('#rate');
  if (!e || !b) return;
  const t = b.A.rotationPeriod * 3600 / 10 ** S.spd;
  e.textContent = 'One rotation takes ' +
    (t >= 1 ? t.toFixed(1) + ' s' : (t * 1e3).toFixed(0) + ' ms') +
    ' of screen time at this speed.' +
    (t < .1 ? ' Too fast to follow, so it may look jittery. Slow down to see the true rotation.' : '');
}

function spd() {
  const x = 10 ** S.spd;
  $('#spv').textContent = (x < 10 ? x.toFixed(1) : Math.round(x).toLocaleString('en')) +
    '×' + (S.spd == 0 ? ' real time' : ' · 1 s = ' + dur(x));
  $('#sp').value = S.spd;
  rate();
}

$('#sp').oninput = e => {
  S.spd = +e.target.value;
  spd();
  save();
};
$('#x1').onclick = () => {
  S.spd = 0;
  spd();
  save();
};
$('#rt').onclick = () => {
  simT = 0;
};

const tg = (id, k, fn) => {
  const b = $(id);
  b.onclick = () => {
    S[k] = S[k] ? 0 : 1;
    b.setAttribute('aria-pressed', !!S[k]);
    fn && fn(b);
    save();
  };
};

tg('#ob', 'orb');
tg('#ax', 'axes');
tg('#lbt', 'lb');
tg('#sc', 'real', b => {
  b.textContent = 'Distance scale: ' + (S.real ? 'wider, closer to real' : 'teaching');
  layout();
  foc ? focus(foc.n) : overview();
});

$('#rs').onclick = () => {
  yaw = .6;
  pit = .55;
  overview();
};

// ---------- tabs ----------
const T = [['Explorer', 'x'], ['Compare', 'v-compare'], ['Quiz', 'v-quiz']];

T.forEach((t, i) => {
  const b = document.createElement('button');
  b.textContent = t[0];
  b.setAttribute('role', 'tab');
  b.setAttribute('aria-selected', i === 0);
  b.onclick = () => {
    document.querySelectorAll('.tabs button')
      .forEach((x, j) => x.setAttribute('aria-selected', j === i));
    document.querySelectorAll('.view')
      .forEach(v => v.hidden = v.id !== t[1]);
    ['#side', '#info', '#bar'].forEach(s => $(s).style.visibility = i ? 'hidden' : 'visible');
    if (i === 1) cmp();
    if (i === 2) quiz(0);
  };
  $('.tabs').appendChild(b);
});

// ---------- compare view ----------
let ca = 'Earth', cb = 'Jupiter';

const ROWS = [
  ['Diameter', 'd', 'km'],
  ['Mass', 'm', '× 10²⁴ kg'],
  ['Gravity', 'g', 'm/s²'],
  ['Temperature', 'T', '°C'],
  ['Distance from Sun', 'au', 'AU'],
  ['Orbital period', 'p', 'days'],
  ['Rotation', 'r', 'h'],
  ['Moons', 'mo', '']
];

function cmp() {
  const bs = B.filter(b => b.c !== 'Moon');
  const o = s => bs.map(b => `<option ${b.n === s ? 'selected' : ''}>${b.n}</option>`).join('');
  const A = by(ca), Bb = by(cb);

  $('#v-compare').innerHTML = `
    <h2>Compare worlds</h2>
    <p>
      <label>First <select id="ca">${o(ca)}</select></label>
      <label>Second <select id="cb">${o(cb)}</select></label>
    </p>
    <div style="display:flex;gap:24px;align-items:flex-end;justify-content:center;margin:12px 0"
         role="img"
         aria-label="Relative sizes: ${A.n} is ${(A.d / Bb.d).toFixed(2)} times the diameter of ${Bb.n}">
      ${[A, Bb].map(b => `
        <div style="text-align:center">
          <div style="width:${Math.max(6, b.d / Math.max(A.d, Bb.d) * 130)}px;
                      height:${Math.max(6, b.d / Math.max(A.d, Bb.d) * 130)}px;
                      border-radius:50%;
                      background:${b.col};
                      margin:auto">
          </div>
          ${b.n}
        </div>
      `).join('')}
    </div>
    <p class="note">Circles are drawn to the same scale as each other. ${Bb.n} is ${(Bb.d / A.d).toFixed(1)} times ${A.n}'s diameter.</p>
    ${ROWS.map(r => {
      const va = Math.abs(A[r[1]]);
      const vb = Math.abs(Bb[r[1]]);
      const mx = Math.max(va, vb, 1e-9);
      const w = v => Math.max(3, v / mx * 100);
      return `
        <div class="row">
          <b>${r[0]}</b>
          <div class="bw"><i style="width:${w(va)}%"></i><span>${A[r[1]]} ${r[2]}</span></div>
          <div class="bw b"><i style="width:${w(vb)}%"></i><span>${Bb[r[1]]} ${r[2]}</span></div>
        </div>
      `;
    }).join('')}
    <p>
      <b>${A.n}:</b> ${A.c}. ${A.a}.<br>
      <b>${Bb.n}:</b> ${Bb.c}. ${Bb.a}.
    </p>
  `;

  $('#ca').onchange = e => { ca = e.target.value; cmp(); };
  $('#cb').onchange = e => { cb = e.target.value; cmp(); };
}

// ---------- quiz view ----------
const Q = [
  ['Which planet is closest to the Sun?', ['Mercury', 'Venus', 'Mars'], 0, 'Mercury orbits at about 0.39 AU.'],
  ['Venus rotates in the opposite direction to most planets.', ['True', 'False'], 0, 'Venus spins retrograde, taking about 243 Earth days per rotation.'],
  ['Which is an ice giant?', ['Jupiter', 'Neptune', 'Saturn'], 1, 'Uranus and Neptune are ice giants rich in water, ammonia and methane.'],
  ['Which moon is thought to hide a subsurface ocean?', ['Io', 'Europa', 'Callisto'], 1, 'Europa\'s icy shell covers a salty ocean beneath.'],
  ['Which mission first flew past Pluto?', ['Cassini', 'Juno', 'New Horizons'], 2, 'New Horizons flew by Pluto in July 2015.'],
  ['Seasons happen mainly because…', ['Earth\'s distance from the Sun changes', 'Earth\'s axis is tilted', 'the Sun gets dimmer'], 1, 'Earth\'s 23.4° axial tilt changes how directly sunlight hits each hemisphere.'],
  ['The Sun is a planet.', ['True', 'False'], 1, 'The Sun is a star, holding 99.8% of the Solar System\'s mass.'],
  ['Which planet has the most confirmed moons?', ['Jupiter', 'Saturn', 'Uranus'], 1, 'Saturn has 274 confirmed moons, more than Jupiter\'s 95.']
];

let qi = 0, qs = 0;

function quiz(i) {
  qi = i;
  if (i === 0) qs = 0;

  const v = $('#v-quiz');

  if (i >= Q.length) {
    S.done++;
    S.best = Math.max(S.best, qs);
    save();
    v.innerHTML = `
      <h2>Finished</h2>
      <p>You scored ${qs} of ${Q.length}. ${qs >= 7 ? 'Stellar work!' : qs >= 4 ? 'Solid orbit. Try again to improve.' : 'Keep exploring, then try again.'}</p>
      <p>Best: ${S.best}/${Q.length} · Quizzes completed: ${S.done}</p>
      <button class="fav" style="float:none" id="qr">Play again</button>
    `;
    $('#qr').onclick = () => quiz(0);
    return;
  }

  const q = Q[i];
  v.innerHTML = `
    <h2>Solar System quiz</h2>
    <p class="note">Question ${i + 1} of ${Q.length} · Best ${S.best}/${Q.length}</p>
    <p><b>${q[0]}</b></p>
    <div id="ops">
      ${q[1].map((o, j) => `<button class="opt" data-j="${j}">${o}</button>`).join('')}
    </div>
    <p id="fb" aria-live="polite"></p>
  `;

  v.querySelectorAll('.opt').forEach(b => {
    b.onclick = () => {
      const j = +b.dataset.j;
      const ok = j === q[2];
      if (ok) qs++;

      v.querySelectorAll('.opt').forEach((x, k) => {
        x.disabled = true;
        if (k === q[2]) x.classList.add('ok');
        else if (k === j) x.classList.add('no');
      });

      $('#fb').innerHTML = `
        <b>${ok ? '✔ Correct.' : '✘ Not quite.'}</b> ${q[3]}<br>
        <button class="fav" style="float:none;margin-top:8px" id="nx">
          ${i + 1 < Q.length ? 'Next question' : 'See results'}
        </button>
      `;

      $('#nx').focus();
      $('#nx').onclick = () => quiz(i + 1);
    };
  });
}

// ---------- init ----------
$('#pp').textContent = S.pause ? 'Play' : 'Pause';
$('#pp').setAttribute('aria-pressed', !!S.pause);
spd();

[['#ax', 'axes'], ['#ob', 'orb'], ['#lbt', 'lb'], ['#sc', 'real']].forEach(([i, k]) =>
  $(i).setAttribute('aria-pressed', !!S[k])
);

if (S.real) $('#sc').textContent = 'Distance scale: wider, closer to real';

layout();
listUI();

if (S.sel && by(S.sel)) focus(S.sel);
else overview();

if (!S.seen) {
  $('#tour').hidden = false;
  $('#tk').focus();
  $('#tk').onclick = () => {
    S.seen = 1;
    save();
    $('#tour').hidden = true;
  };
}

requestAnimationFrame(frame);