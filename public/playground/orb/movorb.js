import * as THREE from 'three'

/* ════════════════════════════  Config  ════════════════════════════ */
const GENRES = ['All', 'Action', 'Adventure', 'Animation', 'Comedy', 'Crime',
  'Documentary', 'Drama', 'Family', 'Fantasy', 'Horror', 'Mystery',
  'Romance', 'Sci-Fi', 'Thriller', 'War', 'Western']

const LANGUAGES = [
  { label: 'Any language', value: '' },
  { label: 'English', value: 'en' },
  { label: 'Hindi', value: 'hi' },
  { label: 'Malayalam', value: 'ml' },
  { label: 'Tamil', value: 'ta' },
  { label: 'Telugu', value: 'te' },
  { label: 'Kannada', value: 'kn' },
  { label: 'Japanese', value: 'ja' },
  { label: 'Korean', value: 'ko' },
  { label: 'Spanish', value: 'es' },
  { label: 'French', value: 'fr' },
  { label: 'Italian', value: 'it' },
  { label: 'German', value: 'de' },
  { label: 'Chinese', value: 'zh' },
  { label: 'Portuguese', value: 'pt' },
]

const MOBILE = matchMedia('(max-width: 720px)').matches
const TARGET = MOBILE ? 56 : 96
const radius = 8                    // sphere radius
const CARD_SCALE = 1.2              // world size of a card (multiplies the unit card geometry)

// Each poster sits in a white border (Instax/Polaroid style) that floats off the globe with a soft
// drop shadow. The texture canvas = the white card plus a transparent margin that holds the shadow.
const TEX = { pw: 300, ph: 450, border: 22, shadow: 40 } // poster px, white frame, transparent shadow margin

const state = { type: 'all', genre: '', minRating: 0, language: '', limit: TARGET }
const queryCache = new Map()
let surpriseNext = false        // one-shot: the next load() rolls a fresh "gem" set instead of the filters
let surpriseNonce = 1           // cache-buster so every press fetches anew (never a replayed globe)
let recentSurprise = new Set()  // ids from the last surprise, skipped next press so titles turn over

/* ─── Views: three presets, switched from the right-hand rail ─── */
// mode 'orbit'  — camera outside looking at the globe. zoom multiplies the fitted distance (smaller
//   ⇒ closer); backFade is the opacity of the far hemisphere.
// mode 'inside' — camera sits inside (z; can be negative to push toward the back wall) looking out at
//   the back of the globe.
// band (either mode) — keep only the equatorial ring solid; rings above/below fade out.
const VIEWS = {
  globe: { mode: 'orbit',  zoom: 1.00, backFade: 0.10, band: false }, // whole globe from outside
  near:  { mode: 'inside', z: 2.0,  band: false },                    // inside the globe, looking at the back
  row:   { mode: 'inside', z: -1.0, band: true },                     // inside + zoomed to a single ring
  warp:  { mode: 'warp' },                                            // fly down a tunnel of streaming posters
  helix: { mode: 'helix', zoom: 1.20, backFade: 0.06 },              // posters spiral up a rotating column
  spot:  { mode: 'spotlight', zoom: 0.95, backFade: 0.05 },          // only screen-centre cards stay sharp (lens)
  tour:  { mode: 'tour', zoom: 1.00, backFade: 0.10 },               // camera drifts/breathes on its own (ambient)
  neb:   { mode: 'nebula', zoom: 1.18, backFade: 0.16 },             // cards loosen into a churning cloud
}
const BAND_INNER = 1.4 // |worldY| kept fully solid in row view (the focused ring)
const BAND_FADE = 1.6  // …then fading to near-nothing over this much more (the rings above/below)

// Warp tunnel: cards wrap a cylinder (axis = Z), facing inward, and stream toward the camera,
// wrapping at the ends — flying down a hyperspace pipe of posters.
const TUN_AROUND = 8     // cards per ring around the tube
const TUN_R = 5          // tube radius (world units)
const TUN_DZ = 2.6       // depth between rings (≈ card height + a little gap)
const WARP_SPEED = 0.06  // how fast cards fly toward the camera (world units / frame)
let tunnelDepth = 30     // total tube length — set from the card count in buildGlobe
let warp = 0             // 0 = sphere layout, 1 = full tunnel; eased toward the active view
let warpZ = 0            // streaming offset along the tube; advances while warping

// Helix: cards spiral up a column (axis = Y) facing outward, viewed from the side as it rotates.
const HELIX_TURNS = 5    // how many times the strand winds from bottom to top
const HELIX_R = 5        // strand radius (distance from the axis)
const HELIX_H = 18       // column height

let tourZoom = 1         // cinematic-tour camera distance factor (animated each frame)

// Only these three are exposed in the view tab; the rest stay in the code (their buttons are
// commented out in index.html). Fall back to globe if a hidden view was saved, so the tab matches.
const RAIL_VIEWS = ['globe', 'near', 'row']
let view = (() => { try { return localStorage.getItem('movorb-view') } catch { return null } })() || 'globe'
if (!VIEWS[view] || !RAIL_VIEWS.includes(view)) view = 'globe'

/* ════════════════════════════  DOM  ════════════════════════════ */
const canvas = document.getElementById('scene')
const tooltipEl = document.getElementById('tooltip')
const statusEl = document.getElementById('status')
const focusEl = document.getElementById('focus')
const focusPosterWrap = document.getElementById('focus-poster-wrap')
const focusPoster = document.getElementById('focus-poster')
const focusImg = document.getElementById('focus-img')
const focusName = document.getElementById('focus-title')
const focusSub = document.getElementById('focus-sub')
const focusSynopsis = document.getElementById('focus-synopsis')
const focusWatch = document.getElementById('focus-watch')
const focusProviders = document.getElementById('focus-providers')
const focusImdb = document.getElementById('focus-imdb')
const focusLinkLabel = document.getElementById('focus-link-label')

/* ════════════════════════════  Theme  ════════════════════════════ */
function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme
  try { localStorage.setItem('movorb-theme', theme) } catch { /* private mode */ }
  if (renderer) syncSceneColors()
  // The glass card tint is baked into each texture, so re-composite from the cached poster
  // images (no re-download) whenever the theme flips.
  for (const m of meshes) applyPosterTexture(m)
}
function syncSceneColors() {
  const bg = new THREE.Color(cssVar('--bg'))
  renderer.setClearColor(bg, 1)
}
// Apply the saved theme to the DOM immediately — CSS only, the renderer isn't built
// yet. Scene colours get synced from these CSS vars during setup below. (Calling
// applyTheme() here would hit `renderer` in its temporal dead zone and kill the script.)
document.documentElement.dataset.theme =
  (() => { try { return localStorage.getItem('movorb-theme') } catch { return null } })() || 'light'
// The Light/Dark vertical tab is wired up in the Controls section below (alongside the view tab).

/* ════════════════════════════  Three.js scene  ════════════════════════════ */
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
renderer.outputColorSpace = THREE.SRGBColorSpace

const scene = new THREE.Scene()

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
const group = new THREE.Group()
scene.add(group)

// Geometry matches the texture canvas (card + shadow margin). 1 world unit = the poster width, so
// CARD_SCALE then sets the on-globe size; the transparent margin keeps the drop shadow off the card.
const CARD_W = TEX.pw + (TEX.border + TEX.shadow) * 2
const CARD_H = TEX.ph + (TEX.border + TEX.shadow) * 2
const GEO = new THREE.PlaneGeometry(CARD_W / TEX.pw, CARD_H / TEX.pw)
const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2()
const maxAniso = renderer.capabilities.getMaxAnisotropy()
syncSceneColors()

// The controls bar is pinned to the bottom edge. We want the globe centred in the open space
// *above* it (top of page → top of the bar), not in the raw viewport, so the bar's footprint
// doesn't shove the globe optically low. Measured live so it tracks the bar's real height (it
// grows as the React dropdowns mount and wraps to extra rows on mobile).
const controlsEl = document.getElementById('controls')
function visibleHeight(h) {
  const top = controlsEl?.getBoundingClientRect().top
  return (top > 0 && top <= h) ? top : h // fall back to full height until the bar is laid out
}

let baseZ = 0 // fitted camera distance for the current viewport, before the per-view zoom
// Camera distance for the active view: a fraction of the fitted distance (orbit), or a fixed spot
// near the centre (inside, where the camera looks out at the back of the globe).
function viewTargetZ() {
  const cfg = VIEWS[view]
  if (cfg.mode === 'warp') return tunnelDepth / 2 + 1 // just outside the near end, looking down −Z
  if (cfg.mode === 'inside') return cfg.z
  if (cfg.mode === 'tour') return baseZ * tourZoom    // breathing dolly, animated in the render loop
  return baseZ * cfg.zoom                              // orbit, helix, spotlight, nebula
}
function fitCamera() {
  const w = innerWidth, h = innerHeight
  renderer.setSize(w, h)
  camera.aspect = w / h
  // Pull back further in portrait so the globe never clips the sides. The base term also leaves a
  // little vertical breathing room in landscape so the globe doesn't kiss the top & bottom edges.
  const portrait = Math.max(1, h / w)
  baseZ = radius * 3 * (1.0 + 0.34 * (portrait - 1) + (camera.aspect < 1 ? 0.4 : 0))
  // The render loop eases camera.z toward the view target so switching views glides; on the very
  // first paint there's nothing to ease from, so seat it at the target immediately.
  if (camera.position.z === 0) camera.position.z = viewTargetZ()

  // Raise the rendered scene so the globe's centre sits at the middle of [0, barTop] rather than
  // [0, h]. setViewOffset is a pure pixel shift of the frustum (no zoom → the globe keeps its
  // size); offsetY = (h − visibleHeight) / 2 lifts it by exactly half the bar's footprint.
  const offsetY = (h - visibleHeight(h)) / 2
  if (offsetY > 0.5) camera.setViewOffset(w, h, 0, offsetY, w, h)
  else camera.clearViewOffset()
  camera.updateProjectionMatrix()
}
fitCamera()
addEventListener('resize', fitCamera)
// Re-centre when the bar's height changes (dropdowns mounting, fonts loading, mobile row wrap).
if (window.ResizeObserver && controlsEl) new ResizeObserver(fitCamera).observe(controlsEl)

/* ════════════════════════════  Texture loader (throttled)  ════════════════════════════ */
const texLoader = new THREE.TextureLoader()
texLoader.setCrossOrigin('anonymous')
const texQueue = []
let texActive = 0
function enqueueTexture(url, onLoad) {
  texQueue.push({ url, onLoad })
  pumpTextures()
}
function pumpTextures() {
  while (texActive < 6 && texQueue.length) {
    const { url, onLoad } = texQueue.shift()
    texActive++
    texLoader.load(
      url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace
        tex.anisotropy = maxAniso
        texActive--; onLoad(tex); pumpTextures()
      },
      undefined,
      () => { texActive--; pumpTextures() }, // swallow failures — that poster stays a placeholder
    )
  }
}

/* ════════════════════════════  Card texture (white-border Polaroid)  ════════════════════════════ */
// Composite a poster into a white border that floats off the globe with a soft drop shadow, handed
// back as a CanvasTexture. The canvas = the white card plus a transparent margin holding the shadow.
function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

function drawCover(ctx, img, dx, dy, dw, dh) {
  const iw = img.naturalWidth || img.width
  const ih = img.naturalHeight || img.height
  if (!iw || !ih) return
  const s = Math.max(dw / iw, dh / ih)
  const sw = dw / s, sh = dh / s
  ctx.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, dx, dy, dw, dh)
}

function composeCard(img) {
  const { pw, ph, border, shadow } = TEX
  const cardW = pw + border * 2, cardH = ph + border * 2
  const W = cardW + shadow * 2, H = cardH + shadow * 2
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const ctx = c.getContext('2d')
  const dark = document.documentElement.dataset.theme === 'dark'
  const x = shadow, y = shadow // the card's top-left inside the transparent shadow margin
  const frame = dark ? '#202024' : '#ffffff'
  const photoLine = dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.12)'

  // Soft drop shadow, then the white card body on top → it reads as lifted off the globe.
  ctx.save()
  ctx.shadowColor = dark ? 'rgba(0,0,0,0.62)' : 'rgba(18,18,28,0.30)'
  ctx.shadowBlur = shadow * 0.6
  ctx.shadowOffsetY = shadow * 0.3
  roundRectPath(ctx, x, y, cardW, cardH, 10)
  ctx.fillStyle = frame
  ctx.fill()
  ctx.restore()

  // Poster, cover-cropped into the opening (poster is 2:3 and so is the opening → no real crop).
  ctx.save()
  roundRectPath(ctx, x + border, y + border, pw, ph, 6)
  ctx.clip()
  drawCover(ctx, img, x + border, y + border, pw, ph)
  ctx.restore()

  // Thin seam where the poster meets the white frame.
  roundRectPath(ctx, x + border, y + border, pw, ph, 6)
  ctx.lineWidth = 1
  ctx.strokeStyle = photoLine
  ctx.stroke()

  return c
}

// Inside the globe we look at the *back* faces of outward-facing cards, which the GPU samples
// mirrored. Flip the texture horizontally for that view so posters read the right way round.
// center+repeat.x=-1 mirrors around the middle and keeps UVs in [0,1] (no wrap artefacts).
function orientTexture(tex) {
  if (!tex) return
  tex.center.set(0.5, 0.5)
  tex.repeat.x = VIEWS[view].mode === 'inside' ? -1 : 1
}

function applyPosterTexture(mesh) {
  const img = mesh.userData.posterImg
  if (!img) return
  const tex = new THREE.CanvasTexture(composeCard(img))
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = maxAniso
  orientTexture(tex)
  const old = mesh.material.map
  mesh.material.map = tex
  mesh.material.needsUpdate = true
  old?.dispose()
}

/* ════════════════════════════  Globe  ════════════════════════════ */
let meshes = []
let hovered = null

function clearGlobe() {
  texQueue.length = 0
  for (const m of meshes) {
    group.remove(m)
    m.material.map?.dispose()
    m.material.dispose()
  }
  meshes = []
  hovered = null
  hideTooltip()
}

// Latitude-ring layout → cards line up in rows (one ring = one "row"). Ring count grows smoothly with
// √n and is monotonic (never decreases), so raising the count slider always reads as *more* posters:
// each step either packs an existing ring denser or adds one new row. (We used to force an odd ring
// count — `rings++` — for a single crisp centre row in row view, but that made the count jump by 2,
// e.g. 90→7 rings vs 96→9, which thinned the dense equatorial band so a higher count looked emptier.
// Row view now just shows the equatorial band, which the worldY fade handles regardless of parity.)
// Cards per ring scale with the ring's circumference (sin θ), so spacing stays even and poles don't clump.
function ringLayout(n) {
  const rings = Math.max(3, Math.round(Math.sqrt(n * 0.62)))
  const thetas = []
  let wSum = 0
  for (let r = 0; r < rings; r++) {
    const theta = Math.PI * (r + 0.5) / rings // polar angle, never exactly a pole
    thetas.push(theta); wSum += Math.sin(theta)
  }
  // Allocate exactly n cards across the rings (largest-remainder rounding so the total is exact).
  const exact = thetas.map((t) => n * Math.sin(t) / wSum)
  const counts = exact.map(Math.floor)
  let used = counts.reduce((a, b) => a + b, 0)
  const byFrac = exact.map((v, i) => ({ i, frac: v - Math.floor(v) })).sort((a, b) => b.frac - a.frac)
  for (let k = 0; used < n; k++, used++) counts[byFrac[k % byFrac.length].i]++
  const out = []
  thetas.forEach((theta, r) => {
    const cnt = counts[r]
    const sin = Math.sin(theta), cy = Math.cos(theta)
    for (let cI = 0; cI < cnt; cI++) {
      const phi = 2 * Math.PI * cI / cnt
      out.push({ x: sin * Math.cos(phi), y: cy, z: sin * Math.sin(phi), ring: r })
    }
  })
  return out
}

// Orientation a card should hold to face `target` from `pos` (matches mesh.lookAt), as a quaternion.
const _poseDummy = new THREE.Object3D()
function quatToward(pos, target) {
  _poseDummy.position.copy(pos)
  _poseDummy.lookAt(target)
  return _poseDummy.quaternion.clone()
}

function buildGlobe(items) {
  clearGlobe()
  const layout = ringLayout(items.length)
  const tunRings = Math.ceil(items.length / TUN_AROUND)
  tunnelDepth = tunRings * TUN_DZ
  items.forEach((item, i) => {
    // Latitude-ring grid → cards line up in rows/columns; a whole ring is one "row" for row view.
    const p = layout[i]
    const basePos = new THREE.Vector3(p.x, p.y, p.z).multiplyScalar(radius)
    // Warp slot: this card's spot on the cylinder (ring along the axis, place around it, slight twist).
    const tunRing = Math.floor(i / TUN_AROUND)
    const tunnelPhi = (2 * Math.PI * (i % TUN_AROUND) / TUN_AROUND) + tunRing * 0.5
    const tunnelZ0 = (tunRing - (tunRings - 1) / 2) * TUN_DZ
    // Helix slot: wind up a column along Y, facing outward (so the side-on camera reads the front).
    const hf = items.length > 1 ? i / (items.length - 1) : 0.5
    const ha = hf * HELIX_TURNS * 2 * Math.PI
    const hy = (hf - 0.5) * HELIX_H
    const hx = HELIX_R * Math.cos(ha), hz = HELIX_R * Math.sin(ha)
    const helixPos = new THREE.Vector3(hx, hy, hz)

    // See-through sphere: double-sided + transparent so the far side of the globe shows
    // faintly through the gaps. depthWrite:false → clean back-to-front blending, so a
    // full-opacity front poster covers what's directly behind it while gaps reveal the back.
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
    const mesh = new THREE.Mesh(GEO, mat)
    mesh.position.copy(basePos)
    mesh.scale.setScalar(0)
    mesh.lookAt(basePos.clone().multiplyScalar(2)) // lie tangent on the sphere, facing outward
    mesh.userData = {
      item, basePos, baseScale: CARD_SCALE, ring: p.ring, appeared: false, hover: false,
      smoothPos: basePos.clone(),              // smoothed sphere position (keeps hover push gliding)
      sphereQuat: mesh.quaternion.clone(),     // facing-outward orientation, for the sphere views
      tunnelPhi, tunnelZ0, tunnelR: TUN_R,     // warp slot on the cylinder
      tunnelQuat: quatToward(                   // facing inward toward the axis (so the camera sees the front)
        new THREE.Vector3(TUN_R * Math.cos(tunnelPhi), TUN_R * Math.sin(tunnelPhi), 0),
        new THREE.Vector3(0, 0, 0),
      ),
      helixPos,                                 // spot on the spiral column
      helixQuat: quatToward(helixPos, new THREE.Vector3(hx * 2, hy, hz * 2)), // face outward, horizontally
      // Nebula: push out by a random amount and drift along a random axis at a slow per-card rate.
      nebRadial: 1 + Math.random() * 0.4,
      nebDir: new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize(),
      nebFreq: 0.15 + Math.random() * 0.25,
      nebPhase: Math.random() * Math.PI * 2,
      nebAmp: 0.4 + Math.random() * 0.7,
    }
    group.add(mesh)
    meshes.push(mesh)

    // Each poster scales + fades in once its image has loaded — a progressive assemble.
    // Keep the decoded image so theme flips can re-composite the glass card without re-downloading.
    enqueueTexture(item.poster, (tex) => {
      mesh.userData.posterImg = tex.image
      tex.dispose() // only the decoded image is needed; the rendered map is the composited card
      applyPosterTexture(mesh)
      mesh.userData.appeared = true
    })
  })
}

/* ════════════════════════════  Pointer: drag, inertia, hover  ════════════════════════════ */
let rotY = 0, rotX = 0, targetRotY = 0, targetRotX = 0, velY = 0, velX = 0
let down = false, moved = 0, lastX = 0, lastY = 0, lastInteract = 0
let overUI = false // pointer is over the controls bar / a dropdown, not the globe → suppress hover
let hoverSuppressed = false // after closing the card, hold off the title/rating tooltip until the pointer actually moves
const CLAMP_X = Math.PI / 2 // tilt up/down to a full 90° so the top & bottom posters come into view
const DRAG_PX = 6 // travel (px) that turns a tap into a drag — below this it opens a poster and never pauses the auto-spin

function onDown(e) {
  down = true; moved = 0
  lastX = e.clientX; lastY = e.clientY
  velY = velX = 0
  // Don't touch `lastInteract` here: merely pressing down (or a plain click) must not pause the
  // auto-spin. `down` already suppresses the spin while held; only a real drag should start the
  // grace timer, which onMove does once travel passes DRAG_PX.
  canvas.classList.add('is-grabbing')
}
function onMove(e) {
  pointer.x = (e.clientX / innerWidth) * 2 - 1
  pointer.y = -(e.clientY / innerHeight) * 2 + 1
  hoverSuppressed = false // a real move re-enables the tooltip after a close
  // The move listener is on window, so it fires over the UI too. Anything that isn't the
  // canvas (controls bar, dropdowns, top bar) means the pointer is on a control, not a poster.
  overUI = e.target !== canvas
  if (down) {
    const dx = e.clientX - lastX, dy = e.clientY - lastY
    lastX = e.clientX; lastY = e.clientY
    moved += Math.abs(dx) + Math.abs(dy)
    velY = dx * 0.005; velX = dy * 0.005
    targetRotY += velY
    targetRotX = clamp(targetRotX + velX, -CLAMP_X, CLAMP_X)
    // Only an actual drag (not a jittery tap) holds off the idle auto-spin.
    if (moved >= DRAG_PX) lastInteract = performance.now()
  }
}
function onUp(e) {
  // A tap (negligible movement) opens the poster under the pointer. Raycast fresh
  // rather than relying on `hovered` — touch devices have no hover phase.
  const wasGlobe = down // onDown only fires on the canvas, so `down` ⇒ this was a globe drag/tap
  if (wasGlobe && moved < DRAG_PX) {
    pointer.x = (e.clientX / innerWidth) * 2 - 1
    pointer.y = -(e.clientY / innerHeight) * 2 + 1
    raycaster.setFromCamera(pointer, camera)
    // Skip faded-out posters (hidden backs / off-band rows) so a tap through a gap can't open one.
    const hit = raycaster.intersectObjects(meshes, false).find((h) => h.object.material.opacity > 0.12)
    if (hit) openFocus(hit.object.userData.item, hit.object)
  }
  down = false
  canvas.classList.remove('is-grabbing')
  // Only an actual drag of the globe pauses the idle auto-spin. A plain click/tap — on a poster,
  // on empty space between posters, off the globe, or anywhere on the UI (this listener is on
  // `window`) — must not reset the grace timer, or the spin would stutter after every click.
  if (wasGlobe && moved >= DRAG_PX) lastInteract = performance.now()
}
canvas.addEventListener('pointerdown', onDown)
addEventListener('pointermove', onMove)
addEventListener('pointerup', onUp)
addEventListener('pointercancel', () => { down = false; canvas.classList.remove('is-grabbing') })

function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)) }
function smooth01(x, a, b) { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t) }

function clearHover() {
  if (hovered) hovered.userData.hover = false
  hovered = null
  hideTooltip()
  canvas.classList.remove('is-hovering')
}

function updateHover() {
  if (down || !focusEl.hidden) return
  // Just closed the card → don't pop the tooltip for whatever the (stationary) pointer is over;
  // wait for a real move. Otherwise the just-closed title's name/rating flashes back as it returns.
  if (hoverSuppressed) { if (hovered) clearHover(); return }
  // Over the controls/dropdowns → no poster hover (drop any hover already showing).
  if (overUI) { if (hovered) clearHover(); return }
  raycaster.setFromCamera(pointer, camera)
  // Only hover posters that are actually visible (hidden backs / off-band rows aren't hoverable).
  const hit = raycaster.intersectObjects(meshes, false).find((h) => h.object.material.opacity > 0.12)
  const next = hit ? hit.object : null
  // Title/rating tooltip only in the full-globe view; the zoomed-in inside views (near/row) skip it.
  // Hover still lifts the poster and stays click-through — only the name/rating popup is suppressed.
  const tips = view === 'globe'
  if (next === hovered) { if (hovered && tips) positionTooltip(hovered); return }
  if (hovered) hovered.userData.hover = false
  hovered = next
  if (hovered) {
    hovered.userData.hover = true
    canvas.classList.add('is-hovering')
    if (tips) { showTooltip(hovered.userData.item); positionTooltip(hovered) }
    else hideTooltip()
  } else {
    hideTooltip()
    canvas.classList.remove('is-hovering')
  }
}

/* ════════════════════════════  Tooltip  ════════════════════════════ */
const _v = new THREE.Vector3()
function showTooltip(item) {
  const rating = item.rating != null ? ` &nbsp;<span class="t-star">★</span> ${item.rating.toFixed(1)}` : ''
  const year = item.year ? ` · ${item.year}` : ''
  tooltipEl.innerHTML = `${escapeHtml(item.title)}${year}${rating}`
  tooltipEl.hidden = false
  requestAnimationFrame(() => tooltipEl.classList.add('is-on'))
}
function positionTooltip(mesh) {
  mesh.getWorldPosition(_v).project(camera)
  tooltipEl.style.left = `${(_v.x * 0.5 + 0.5) * innerWidth}px`
  tooltipEl.style.top = `${(-_v.y * 0.5 + 0.5) * innerHeight}px`
}
function hideTooltip() {
  tooltipEl.classList.remove('is-on')
  tooltipEl.hidden = true
}

/* ════════════════════════════  Focus card  ════════════════════════════ */
/* ─────────────────────────────────────────────────────────
 * FOCUS CARD — OPEN / CLOSE STORYBOARD  (ms after the trigger)
 * OPEN
 *     0   poster lifts from the clicked globe spot and enlarges into its slot   (JS FLIP, posterIn)
 *   220   glass background wipes open left→right                                (CSS .focus__bg)
 *   300   title → 370 meta line fade/rise in                                    (CSS stagger)
 *     ·   synopsis + providers fade in when their fetch lands                   (CSS .is-in, JS)
 *   500   IMDb button + "Esc to close" hint fade in                            (CSS)
 * CLOSE  (reverse — softer + faster)
 *     0   text fades back down + background wipes shut                          (CSS, no delay)
 *   150   poster shrinks back into the globe spot it came from                  (JS FLIP, posterOut)
 *   620   teardown — overlay hidden, poster reset                              (JS)
 * Timing values for the JS-driven bits live in FOCUS_TIMING; the CSS delays above mirror them. */
const FOCUS_TIMING = {
  posterIn: 600,       // poster FLIP up + enlarge
  posterOutDelay: 180, // panel retracts toward the poster a touch before the poster itself leaves
  posterOut: 500,      // poster glides back to its globe slot (opaque)
  crossfade: 220,      // ONLY after it lands: card poster fades out as the globe mesh fades in (same spot → never two side by side)
  teardown: 940,       // overlay hidden + poster reset (after the crossfade)
}
// `focusOpen` flips synchronously so the render loop can react instantly; `focusEl.hidden` lags the
// close by the exit transition, so gating the auto-spin on it would stall the globe.
let focusOpen = false
let focusClosing = false // true through the whole close → keep the globe FROZEN so the mesh stays put and the poster lands exactly on it
let originRect = null   // screen rect of the clicked globe poster → FLIP fly-from / return-to target
let focusedMesh = null  // the clicked globe mesh — hidden while the card is open so its slot reads empty

// Project a globe poster mesh to a screen rect (centre + on-screen image height) AND its exact 3D
// orientation relative to the camera, as a CSS matrix3d (captures tilt AND in-plane roll). Two fixes
// over the earlier attempt: (1) use the WORLD quaternion — the local one ignores the globe's current
// spin, which made angles look random; (2) use the full orientation matrix, not a normal-derived
// rotateX/rotateY guess. camera space → CSS space is a Y-flip (CSS Y points down), done by negating
// the off-diagonal Y terms of the rotation matrix (e1,e4,e6,e9).
const _wp = new THREE.Vector3(), _up = new THREE.Vector3(), _wq = new THREE.Quaternion(), _camInv = new THREE.Quaternion(), _rel = new THREE.Quaternion(), _m = new THREE.Matrix4()
function meshScreenRect(mesh) {
  const c = mesh.getWorldPosition(_wp).clone()
  mesh.getWorldQuaternion(_wq)
  _up.set(0, (TEX.ph / TEX.pw) * 0.5 * (mesh.scale.y || 1), 0).applyQuaternion(_wq)
  const yPx = (v) => (-v.y * 0.5 + 0.5) * innerHeight
  const top = yPx(c.clone().add(_up).project(camera))
  const bot = yPx(c.clone().sub(_up).project(camera))
  const cc = c.project(camera)
  _camInv.copy(camera.quaternion).invert()
  _rel.copy(_camInv).multiply(_wq)                        // poster orientation in camera space
  const e = _m.makeRotationFromQuaternion(_rel).elements  // column-major rotation
  const m3d = `matrix3d(${e[0]},${-e[1]},${e[2]},0,${-e[4]},${e[5]},${-e[6]},0,${e[8]},${-e[9]},${e[10]},0,0,0,0,1)`
  return { cx: (cc.x * 0.5 + 0.5) * innerWidth, cy: (-cc.y * 0.5 + 0.5) * innerHeight, h: Math.abs(bot - top), m3d }
}

// One transform string (fixed function list) so CSS interpolates smoothly. perspective() gives the
// matrix3d real depth; matrix3d carries the poster's exact globe orientation.
function posterTransform(dx, dy, s, m3d) {
  return `perspective(1100px) translate(${dx}px, ${dy}px) ${m3d} scale(${s})`
}
const IDENTITY_M3D = 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)'
const POSTER_FLAT = posterTransform(0, 0, 1, IDENTITY_M3D) // resting state: flat, centred, full size

// FLIP: paint the poster at the clicked globe spot/size/ANGLE, then transition it flat into the slot.
function flipPosterIn() {
  const w = focusPosterWrap
  w.style.transition = 'none'
  w.style.transform = POSTER_FLAT
  w.style.opacity = '1'
  if (!originRect) return
  const to = w.getBoundingClientRect()
  if (!to.height) return
  const s = originRect.h / to.height
  const dx = originRect.cx - (to.left + to.width / 2)
  const dy = originRect.cy - (to.top + to.height / 2)
  w.style.transform = posterTransform(dx, dy, s, originRect.m3d) // at the globe spot, size + exact orientation
  void w.offsetWidth // commit the start frame before transitioning to the flat resting position
  w.style.transition = `transform ${FOCUS_TIMING.posterIn}ms cubic-bezier(0.16, 1, 0.3, 1)`
  w.style.transform = POSTER_FLAT
}

function openFocus(item, mesh) {
  // Capture where the clicked poster is on screen, then HIDE that globe mesh so its slot reads empty
  // — the poster has "come out of the globe" into the card. (Restore on close.)
  if (focusedMesh && focusedMesh !== mesh) focusedMesh.userData.hiddenForFocus = false
  focusClosing = false // a fresh open cancels any in-progress close freeze
  focusedMesh = mesh || null
  originRect = mesh ? meshScreenRect(mesh) : null
  if (mesh) mesh.userData.hiddenForFocus = true
  clearHover() // drop the hover tooltip now, or it lingers behind the card and shows again on close
  focusImg.classList.remove('is-loaded')
  focusImg.alt = item.title
  focusImg.onload = () => focusImg.classList.add('is-loaded')
  // Show the small poster first — it's already cached from the globe, so the fly-up reads as the
  // same poster lifting off — then quietly upgrade to the hi-res art once it arrives.
  focusImg.src = item.poster || item.posterLarge
  if (item.posterLarge && item.posterLarge !== item.poster) {
    const hi = new Image()
    hi.onload = () => { if (focusOpen) focusImg.src = item.posterLarge }
    hi.src = item.posterLarge
  }
  focusName.textContent = item.title
  const bits = []
  if (item.year) bits.push(item.year)
  if (item.genres?.length) bits.push(item.genres.slice(0, 2).join(', '))
  const star = item.rating != null ? ` &nbsp; <span class="s-star">★</span> ${item.rating.toFixed(1)}` : ''
  focusSub.innerHTML = escapeHtml(bits.join(' · ')) + star

  // Reset the enrichable bits and the holographic tilt before this open's data arrives.
  focusSynopsis.hidden = true
  focusSynopsis.textContent = ''
  focusSynopsis.classList.remove('is-in')
  focusWatch.hidden = true
  focusWatch.classList.remove('is-in')
  focusProviders.replaceChildren()
  resetTilt()

  setImdbHref(item)
  loadDetails(item)
  focusOpen = true
  focusEl.hidden = false
  flipPosterIn()                                                // poster lifts from the clicked spot + enlarges
  requestAnimationFrame(() => focusEl.classList.add('is-open')) // then the bg wipes right + text reveals
  capture('movorb_focus', { id: item.id, title: item.title })
}

// The IMDb button gets an immediate best-guess link; loadDetails() upgrades it once TMDB
// resolves the real IMDb id. TheTVDB items have no IMDb id → link to TheTVDB instead.
function setImdbHref(item) {
  if (item.tvdbUrl && !item.imdb && !item.tmdb) {
    focusImdb.href = item.tvdbUrl
    focusLinkLabel.textContent = 'View on TheTVDB'
    return
  }
  focusLinkLabel.textContent = 'View on IMDb'
  if (item.imdb) { focusImdb.href = `https://www.imdb.com/title/${item.imdb}/`; return }
  if (item.tmdb) { focusImdb.href = `https://www.themoviedb.org/${item.tmdb.type}/${item.tmdb.id}`; return }
  focusImdb.href = '#'
}

// Enrich the open card with the synopsis, IMDb id and "where to watch". Cached per title id, so:
//   • reopening a card is instant (no refetch);
//   • a slow first response is never lost — we apply by the *currently open* id (not a global
//     counter), so it still lands if it resolves after a quick close/reopen of the same title;
//   • failed/empty payloads are dropped from the cache, so a reopen retries instead of sticking blank
//     (this is why a title used to show nothing on first open but appear on the second).
// Only TMDB-sourced items have a tmdb id; others keep just what the list already provided.
const detailsCache = new Map() // item.id -> Promise<details>
let openItemId = null
// Fade a lazily-populated section in (synopsis / providers) once its data lands — JS-driven because
// the open-time CSS stagger has already elapsed by the time the fetch resolves.
function revealEl(el) {
  el.hidden = false
  el.classList.remove('is-in')
  requestAnimationFrame(() => el.classList.add('is-in'))
}
function applyDetails(d) {
  if (d.imdb) { focusImdb.href = `https://www.imdb.com/title/${d.imdb}/`; focusLinkLabel.textContent = 'View on IMDb' }
  if (d.overview) { focusSynopsis.textContent = d.overview; revealEl(focusSynopsis) }
  renderProviders(d.providers, d.providerLink)
}
function loadDetails(item) {
  openItemId = item.id
  if (!item.tmdb) return
  let p = detailsCache.get(item.id)
  if (!p) {
    const region = (navigator.language?.split('-')[1] || 'US').toUpperCase()
    p = fetch(`/api/details?type=${item.tmdb.type}&id=${item.tmdb.id}&region=${region}`).then((r) => r.json())
    detailsCache.set(item.id, p)
    p.then((d) => { if (!d || !d.overview) detailsCache.delete(item.id) }, () => detailsCache.delete(item.id))
  }
  p.then((d) => { if (openItemId === item.id && d) applyDetails(d) }).catch(() => {})
}

function renderProviders(list, link) {
  focusProviders.replaceChildren()
  if (!list?.length) { focusWatch.hidden = true; focusWatch.classList.remove('is-in'); return }
  for (const p of list) {
    if (!p.logo) continue
    const a = document.createElement('a')
    a.className = 'provider'
    a.href = link || '#'
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    a.title = p.name
    a.setAttribute('aria-label', `Watch on ${p.name}`)
    const img = document.createElement('img')
    img.src = p.logo
    img.alt = p.name
    img.loading = 'lazy'
    a.appendChild(img)
    focusProviders.appendChild(a)
  }
  if (focusProviders.childElementCount) revealEl(focusWatch)
  else { focusWatch.hidden = true; focusWatch.classList.remove('is-in') }
}

/* Holographic tilt — the poster leans toward the pointer and the iridescence/glare track it. */
function resetTilt() {
  for (const [k, v] of [['--rx', '0deg'], ['--ry', '0deg'], ['--mx', '50%'], ['--my', '50%'], ['--hx', '30%'], ['--hy', '30%']]) {
    focusPoster.style.setProperty(k, v)
  }
}
focusPoster.addEventListener('pointermove', (e) => {
  const r = focusPoster.getBoundingClientRect()
  const px = (e.clientX - r.left) / r.width
  const py = (e.clientY - r.top) / r.height
  focusPoster.style.setProperty('--rx', `${((px - 0.5) * 16).toFixed(2)}deg`)  // rotateY
  focusPoster.style.setProperty('--ry', `${((0.5 - py) * 16).toFixed(2)}deg`)  // rotateX
  focusPoster.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`)
  focusPoster.style.setProperty('--my', `${(py * 100).toFixed(1)}%`)
  focusPoster.style.setProperty('--hx', `${(px * 100).toFixed(1)}%`)
  focusPoster.style.setProperty('--hy', `${(py * 100).toFixed(1)}%`)
})
focusPoster.addEventListener('pointerleave', resetTilt)

function closeFocus() {
  focusOpen = false
  openItemId = null // a late /api/details response must not write into the now-closed card
  hoverSuppressed = true // don't flash the just-closed title's name/rating as the poster returns
  focusClosing = true    // freeze the globe for the WHOLE close so the slot can't drift from the landing spot
  lastInteract = -Infinity // auto-spin only resumes once focusClosing clears (at teardown)
  // Reverse, as one continuous motion: the panel retracts toward the poster (CSS clip wipe shut),
  // then the poster glides back into its globe slot while the globe mesh fades in beneath it — a
  // seamless handoff, so it reads as the poster sliding back inside the globe (not "vanish + reappear").
  focusEl.classList.remove('is-open')
  const w = focusPosterWrap
  // 1) Poster glides back to its globe slot — OPAQUE the whole way. Re-measure the mesh's CURRENT
  //    screen position now (the globe is frozen, so it stays there through the glide) → exact land.
  setTimeout(() => {
    if (focusOpen) return // reopened mid-close → the new open's FLIP owns the poster
    const dest = (focusedMesh && meshScreenRect(focusedMesh)) || originRect
    const to = w.getBoundingClientRect()
    if (dest && to.height) {
      const s = dest.h / to.height
      const dx = dest.cx - (to.left + to.width / 2)
      const dy = dest.cy - (to.top + to.height / 2)
      w.style.transition = `transform ${FOCUS_TIMING.posterOut}ms cubic-bezier(0.4, 0, 0.2, 1)`
      w.style.transform = posterTransform(dx, dy, s, dest.m3d || IDENTITY_M3D) // back to its exact globe orientation
    }
  }, FOCUS_TIMING.posterOutDelay)
  // 2) Only ONCE it has landed on the slot: crossfade in place — the card poster fades out exactly
  //    as the globe mesh fades back in, both at the same spot, so there's never two posters at once.
  setTimeout(() => {
    if (focusOpen) return
    w.style.transition = `opacity ${FOCUS_TIMING.crossfade}ms ease`
    w.style.opacity = '0'
    if (focusedMesh) { focusedMesh.userData.hiddenForFocus = false; focusedMesh = null }
  }, FOCUS_TIMING.posterOutDelay + FOCUS_TIMING.posterOut)
  // 3) Teardown once the crossfade is done.
  setTimeout(() => {
    if (focusOpen) return // reopened → don't tear down
    focusClosing = false // close finished → the globe may spin again
    focusEl.hidden = true
    w.style.transition = 'none'; w.style.transform = 'none'; w.style.opacity = '0'
  }, FOCUS_TIMING.teardown)
}
document.getElementById('focus-scrim').addEventListener('click', closeFocus)
document.getElementById('focus-close').addEventListener('click', closeFocus) // mobile-only button (hidden on desktop via CSS)
addEventListener('keydown', (e) => { if (e.key === 'Escape' && !focusEl.hidden) closeFocus() })

/* ════════════════════════════  Render loop  ════════════════════════════ */
const _p = new THREE.Vector3()
const _tmp = new THREE.Vector3()
const _q = new THREE.Quaternion()

function animate() {
  requestAnimationFrame(animate)
  const cfg = VIEWS[view]
  const nowS = performance.now() * 0.001

  // Cinematic tour: drift the camera distance on a slow breathing dolly.
  if (cfg.mode === 'tour') tourZoom = 0.9 + 0.08 * Math.sin(nowS * 0.045) + 0.04 * Math.sin(nowS * 0.11)

  // Ease the camera distance toward the active view's target so switching views glides (and flying
  // into the centre for the inside view reads as a dive through the front of the globe).
  camera.position.z += (viewTargetZ() - camera.position.z) * 0.10

  // Warp morph: ease toward 1 while the tunnel view is active, and stream cards down the tube.
  warp += ((cfg.mode === 'warp' ? 1 : 0) - warp) * 0.06
  if (warp > 0.001) warpZ += WARP_SPEED

  const free = !down && !focusOpen && !focusClosing // frozen while the card is open AND closing
  if (cfg.mode === 'tour' && free) {
    // Drive the globe autonomously: steady pan + slow roaming tilt (an ambient screensaver).
    targetRotY += 0.0026
    targetRotX += (0.42 * Math.sin(nowS * 0.08) - targetRotX) * 0.02
  } else if (free && performance.now() - lastInteract > 800) {
    targetRotY += 0.0016 // gentle idle auto-spin (grace lets a drag's inertia settle first)
  }
  if (free) { // inertia glide after release — also frozen during open/close so the slot can't drift
    targetRotY += velY; targetRotX = clamp(targetRotX + velX, -CLAMP_X, CLAMP_X)
    velY *= 0.94; velX *= 0.94
    if (Math.abs(velY) < 1e-4) velY = 0
    if (Math.abs(velX) < 1e-4) velX = 0
  }
  rotY += (targetRotY - rotY) * 0.1
  rotX += (targetRotX - rotX) * 0.1
  group.rotation.y = rotY * (1 - warp) // fade the globe spin out as the tunnel takes over
  group.rotation.x = rotX * (1 - warp)

  const D = tunnelDepth
  const helixView = cfg.mode === 'helix'
  const nebulaView = cfg.mode === 'nebula'
  for (const m of meshes) {
    const u = m.userData
    const s = (u.appeared ? u.baseScale : 0) * (u.hover ? 1.16 : 1)
    m.scale.setScalar(m.scale.x + (s - m.scale.x) * 0.18)

    // Smoothed position toward the active non-warp layout (sphere / helix / drifting nebula), with
    // the hover push; then blended toward the streaming tunnel slot by `warp` (z wraps at the ends).
    if (nebulaView) {
      _tmp.copy(u.basePos).multiplyScalar(u.nebRadial)
        .addScaledVector(u.nebDir, Math.sin(nowS * u.nebFreq + u.nebPhase) * u.nebAmp)
    } else {
      _tmp.copy(helixView ? u.helixPos : u.basePos)
    }
    u.smoothPos.lerp(_tmp.multiplyScalar(u.hover ? 1.06 : 1), 0.18)
    let tz = u.tunnelZ0 + warpZ
    tz = ((tz + D / 2) % D + D) % D - D / 2
    if (warp > 0.001) {
      _tmp.set(u.tunnelR * Math.cos(u.tunnelPhi), u.tunnelR * Math.sin(u.tunnelPhi), tz)
      m.position.copy(u.smoothPos).lerp(_tmp, warp)
    } else {
      m.position.copy(u.smoothPos)
    }
    // Orientation eases toward the active facing: outward (sphere/helix), inward when warping.
    _q.copy(helixView ? u.helixQuat : u.sphereQuat).slerp(u.tunnelQuat, warp)
    m.quaternion.slerp(_q, 0.18)

    // Opacity = blend of the sphere-view rule and the tunnel fade, by `warp`.
    let targetOp = 0
    if (u.appeared) {
      // Tunnel: fade in from the far end, out as a card reaches the camera (hides the wrap).
      const t = (tz + D / 2) / D
      const warpOp = smooth01(t, 0, 0.2) * (1 - smooth01(t, 0.82, 1))
      let sphereOp = warpOp
      if (cfg.mode === 'inside') {
        // Inside: show what's in front of us. Row view keeps only the equatorial ring (rest fades).
        let band = 1
        if (cfg.band) {
          m.getWorldPosition(_p)
          band = clamp(1 - (Math.abs(_p.y) - BAND_INNER) / BAND_FADE, 0, 1)
        }
        sphereOp = u.hover ? 1 : band
      } else if (cfg.mode === 'spotlight') {
        // Lens: front cards sharp, but only near screen-centre — fade toward the edges (vignette).
        m.getWorldPosition(_p)
        const depthN = clamp((_p.z + radius) / (2 * radius), 0, 1)
        const front = clamp((depthN - 0.35) / 0.2, 0, 1)
        const lit = cfg.backFade + (1 - cfg.backFade) * front
        _p.project(camera) // → normalised device coords; distance from (0,0) = screen-centre offset
        const lens = 1 - smooth01(Math.hypot(_p.x, _p.y), 0.22, 0.85)
        sphereOp = u.hover ? 1 : lit * lens
      } else if (cfg.mode === 'orbit' || cfg.mode === 'helix' || cfg.mode === 'tour' || cfg.mode === 'nebula') {
        // Front of the globe/column/cloud solid; the far side fades to cfg.backFade.
        m.getWorldPosition(_p)
        const depth = clamp((_p.z + radius) / (2 * radius), 0, 1) // 0 = back, 0.5 = equator, 1 = front
        const front = clamp((depth - 0.35) / 0.2, 0, 1) // 0 = behind the equator, 1 = on/ahead of it
        const band = cfg.band ? clamp(1 - (Math.abs(_p.y) - BAND_INNER) / BAND_FADE, 0, 1) : 1
        const lit = cfg.backFade + (1 - cfg.backFade) * front // back → backFade, front → 1
        sphereOp = u.hover ? band : lit * band
      }
      targetOp = sphereOp + (warpOp - sphereOp) * warp
    }
    if (u.hiddenForFocus) targetOp = 0 // this poster is "out" in the focus card → leave its slot empty
    m.material.opacity += (targetOp - m.material.opacity) * 0.15
  }

  updateHover()
  renderer.render(scene, camera)
}
animate()

/* ════════════════════════════  Controls bridge  ════════════════════════════ */
// movorb.js owns the filter state + data loading; the controls (the bottom bar below, or the
// right-side panel.js when that's enabled instead) call these setters. `onSource` lets a control
// hide the rating input when the data source has no 0-10 ratings (TheTVDB). The bridge is a
// superset so either UI can drive it. (Genre/Language dropdowns live in dropdowns.js.)
const sourceListeners = []
const resetListeners = []
window.movorb = {
  GENRES,
  LANGUAGES,
  state,
  ranges: {
    rating: { min: 0, max: 8.5, step: 0.5 },
    count: { min: 24, max: 150, step: 6 },
  },
  setType(v) { state.type = v; scheduleLoad() },
  setGenre(v) { state.genre = v; scheduleLoad() },
  setLanguage(v) { state.language = v; scheduleLoad() },
  setRating(v) { state.minRating = v; scheduleLoad() },
  setCount(v) { state.limit = v; scheduleLoad() },
  // Refill the globe with a fresh, randomized set of niche-but-good gems. Surprise ignores the
  // genre/language/rating filters (it honours only the type tab + poster count), so clear those
  // filters — state *and* their controls (via emitReset) — first. Otherwise the bar would still read
  // e.g. "Tamil" while the globe shows random global gems. Returns the load promise (button busy state).
  surprise() {
    state.genre = ''
    state.language = ''
    state.minRating = 0
    emitReset()
    surpriseNext = true
    return load()
  },
  onSource(cb) { sourceListeners.push(cb) },
  onReset(cb) { resetListeners.push(cb) }, // controls re-sync their UI to the (now-cleared) filters
}
function emitSource(src) { for (const cb of sourceListeners) cb(src) }
function emitReset() { for (const cb of resetListeners) cb() }

/* ── Right rail: theme + view, as vertical segmented tabs ── */
// Slide a vertical segment's pill over the active button (height + translateY, like placeSegIndicator).
function placeVSeg(seg, btn, animate = true) {
  const ind = seg?.querySelector('.vseg-ind')
  if (!ind || !btn) return
  if (!animate) ind.style.transition = 'none'
  ind.style.height = `${btn.offsetHeight}px`
  ind.style.transform = `translateY(${btn.offsetTop - 3}px)` // 3px = the seg's top padding
  if (!animate) requestAnimationFrame(() => { ind.style.transition = '' })
}

// Light / Dark
const themeSeg = document.getElementById('theme-seg')
const themeBtns = themeSeg ? [...themeSeg.querySelectorAll('.vseg-btn')] : []
function syncThemeButtons(animate = true) {
  const cur = document.documentElement.dataset.theme
  let active
  for (const b of themeBtns) {
    const on = b.dataset.theme === cur
    b.classList.toggle('is-active', on)
    b.setAttribute('aria-checked', on ? 'true' : 'false')
    if (on) active = b
  }
  placeVSeg(themeSeg, active, animate)
}
themeBtns.forEach((b) => b.addEventListener('click', () => { applyTheme(b.dataset.theme); syncThemeButtons() }))
syncThemeButtons(false)

// Globe view
const viewSeg = document.getElementById('view-seg')
const viewBtns = viewSeg ? [...viewSeg.querySelectorAll('.vseg-btn')] : []
function syncViewButtons(animate = true) {
  let active
  for (const b of viewBtns) {
    const on = b.dataset.view === view
    b.classList.toggle('is-active', on)
    b.setAttribute('aria-checked', on ? 'true' : 'false')
    if (on) active = b
  }
  placeVSeg(viewSeg, active, animate)
}
function setView(v) {
  if (!VIEWS[v] || v === view) return
  view = v
  hideTooltip() // clear any tooltip from the previous view (near/row don't show one)
  try { localStorage.setItem('movorb-view', v) } catch { /* private mode */ }
  syncViewButtons()
  for (const m of meshes) orientTexture(m.material.map) // mirror posters for the inside view (and back)
  fitCamera()                 // refresh the zoom target + vertical centring; the loop eases camera.z there
  capture('movorb_view', { view: v })
}
viewBtns.forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)))
syncViewButtons(false)        // reflect the restored view + seat the pill without animating in
addEventListener('resize', () => { syncThemeButtons(false); syncViewButtons(false) })

/* ── Bottom controls bar wiring (the right-side panel.js is commented out in index.html). ── */

// Type segmented control with a sliding indicator pill that glides behind the labels.
const typeSeg = document.getElementById('type-seg')
const segInd = typeSeg?.querySelector('.seg-ind')
function placeSegIndicator(btn, animate = true) {
  if (!segInd || !btn) return
  if (!animate) segInd.style.transition = 'none'
  segInd.style.width = `${btn.offsetWidth}px`
  segInd.style.transform = `translateX(${btn.offsetLeft}px)`
  if (!animate) requestAnimationFrame(() => { segInd.style.transition = '' })
}
if (typeSeg) {
  // Place under the initially-active tab without animating in from 0, then re-place once the
  // webfont loads (it changes the label widths) and on resize.
  const reseat = () => placeSegIndicator(typeSeg.querySelector('.seg-btn.is-active'), false)
  reseat()
  document.fonts?.ready.then(reseat)
  typeSeg.addEventListener('click', (e) => {
    const btn = e.target.closest('.seg-btn')
    if (!btn) return
    typeSeg.querySelectorAll('.seg-btn').forEach((b) => b.classList.remove('is-active'))
    btn.classList.add('is-active')
    placeSegIndicator(btn)
    window.movorb.setType(btn.dataset.type)
  })
  addEventListener('resize', reseat)
}

// Rating slider
const ratingControl = document.querySelector('.rating')
const ratingInput = document.getElementById('rating')
const ratingVal = document.getElementById('rating-val')
if (ratingInput) {
  ratingInput.addEventListener('input', () => {
    const v = Number(ratingInput.value)
    ratingVal.textContent = v === 0 ? 'Any' : `${v.toFixed(1)}+`
    window.movorb.setRating(v)
  })
  // Surprise clears the rating filter → snap the slider back to "Any".
  window.movorb.onReset(() => { ratingInput.value = '0'; ratingVal.textContent = 'Any' })
}
if (ratingControl) window.movorb.onSource((src) => { ratingControl.hidden = src === 'tvdb' })

// Count slider — how many posters fill the globe
const countInput = document.getElementById('count')
const countVal = document.getElementById('count-val')
if (countInput) {
  countInput.value = String(state.limit)
  countVal.textContent = String(state.limit)
  countInput.addEventListener('input', () => {
    countVal.textContent = countInput.value
    window.movorb.setCount(Number(countInput.value))
  })
}

// Surprise me — refill the globe with a fresh, randomized set of niche-but-good gems each press.
const surpriseBtn = document.getElementById('surprise')
if (surpriseBtn) {
  surpriseBtn.addEventListener('click', async () => {
    surpriseBtn.classList.add('is-busy')
    try { await window.movorb.surprise() } finally { surpriseBtn.classList.remove('is-busy') }
  })
}

/* ════════════════════════════  Data  ════════════════════════════ */
let loadTimer = null
let loadToken = 0
function scheduleLoad() {
  clearTimeout(loadTimer)
  loadTimer = setTimeout(load, 150)
}

function setStatus(html, { spinner = false, mini = false } = {}) {
  statusEl.classList.toggle('status--mini', !!mini)
  if (!html) { statusEl.hidden = true; return }
  statusEl.innerHTML = (spinner ? '<span class="spin"></span>' : '') + html
  statusEl.hidden = false
}

// Prefer titles we didn't just show, so back-to-back Surprise presses generally turn over. Falls
// back to the full set if too few are fresh (keeps the globe full rather than starving it).
function freshenSurprise(titles) {
  const fresh = titles.filter((t) => !recentSurprise.has(t.id))
  const out = fresh.length >= Math.min(titles.length, 12) ? fresh : titles
  recentSurprise = new Set(out.map((t) => t.id))
  return out
}

async function load() {
  const surprise = surpriseNext // consume the one-shot flag for this run
  surpriseNext = false

  const params = new URLSearchParams({ type: state.type, limit: String(state.limit) })
  if (surprise) {
    params.set('surprise', '1')
    params.set('n', String(surpriseNonce++)) // unique each press → never a cached/replayed globe
  } else {
    if (state.genre) params.set('genre', state.genre)
    if (state.minRating > 0) params.set('minRating', String(state.minRating))
    if (state.language) params.set('language', state.language)
  }
  const key = params.toString()
  const token = ++loadToken

  // Keep the current globe spinning while fetching; only the first load blanks the screen.
  const refiltering = meshes.length > 0
  setStatus(surprise ? 'Surfacing hidden gems…' : (refiltering ? 'Updating…' : 'Spinning up the universe…'), { spinner: true, mini: refiltering })
  if (surprise) capture('movorb_surprise', { type: state.type })
  else capture('movorb_filter', { type: state.type, genre: state.genre, minRating: state.minRating })

  try {
    // Surprise sets are never cached (we want a different roll every press).
    let data = surprise ? null : queryCache.get(key)
    if (!data) {
      const res = await fetch(`/api/titles?${key}`, { signal: AbortSignal.timeout(14000) })
      data = await res.json()
      // Don't cache the offline fallback — we want real results once upstream recovers.
      if (data.titles?.length && !data.fallback && !surprise) queryCache.set(key, data)
    }
    if (token !== loadToken) return // a newer request superseded this one

    // TheTVDB has no 0-10 ratings, so hide the rating fader when it's the source.
    if (data.source) emitSource(data.source)

    let titles = data.titles
    if (surprise && titles?.length) titles = freshenSurprise(titles)

    if (!titles?.length) {
      clearGlobe()
      setStatus(data.error ? 'The film archive is busy — retrying…' : 'No titles match. Try loosening the filters.')
      if (data.error) setTimeout(() => { if (token === loadToken) load() }, 3500)
      return
    }
    setStatus(null)
    buildGlobe(titles)
  } catch (err) {
    if (token !== loadToken) return
    setStatus('Couldn’t reach the archive — retrying…')
    setTimeout(() => { if (token === loadToken) load() }, 3500)
  }
}

/* ════════════════════════════  Utils  ════════════════════════════ */
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ))
}
function capture(event, props) {
  try { window.posthog?.capture(event, props) } catch { /* analytics is best-effort */ }
}

document.addEventListener('visibilitychange', () => { if (!document.hidden) lastInteract = performance.now() })

load()
