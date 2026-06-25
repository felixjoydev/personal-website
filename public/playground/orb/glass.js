// glass.js — OpenGlass, ported verbatim. https://github.com/naturaldesignapp/openglass
//
// OpenGlass describes glass with one plain material object and derives three pieces from it:
//   1. makeOpenGlassDisplacementMap() — an R/G-encoded displacement map (data URL) whose rim
//      bends light along the rounded-rect edge normal, ramping in over `depth` with a
//      `curvature` profile; 4-fold symmetric, super-sampled to devicePixelRatio.
//   2. openGlassOverlayStyle() — the unfiltered CSS rim ring + directional specular glare.
//   3. The filter: feImage(map) → feDisplacementMap at scale = material.scale * 2 (one pass,
//      or three screen-blended passes when chroma > 0).
//
// Upstream's host refracts a CLONE of the backdrop DOM (its demo renders a second backdrop;
// its editor clones the live canvas). Movorb's backdrop is a live WebGL globe — not DOM-
// clonable — so we drive the SAME map through `backdrop-filter` instead, which OpenGlass calls
// the portable part ("the same map drives SVG filters and WebGL alike"). Everything below the
// host wiring is a faithful port of src/material.ts and src/OpenGlassFilter.tsx.

const NS = 'http://www.w3.org/2000/svg'
const XLINK = 'http://www.w3.org/1999/xlink'

/* ───────────────────────────  src/material.ts (ported)  ─────────────────────────── */

function isWebKitEngine() {
  return typeof navigator !== 'undefined' &&
    /AppleWebKit/i.test(navigator.userAgent) &&
    !/Chrome|Chromium|CriOS|Edg/i.test(navigator.userAgent)
}

// Effective corner radius (clamped so corners never overlap).
function openGlassRadius(m) {
  return Math.max(0, Math.min(m.borderRadius, Math.min(m.width, m.height) / 2))
}

function clampByte(value) { return Math.max(0, Math.min(255, Math.round(value))) }
function round2(value) { return Math.round(value * 100) / 100 }

function writeMapPixel(data, rowWidth, x, y, r, g) {
  const i = (y * rowWidth + x) * 4
  data[i] = r
  data[i + 1] = g
  data[i + 2] = 128
  data[i + 3] = 255
}

// Builds the displacement map: a neutral (128) field with a centred rounded-rect pane whose
// R/G channels encode a bend along the edge normal, ramping in over `depth` px with a
// `curvature` profile. Covers the pane plus `margin` px on every side.
function makeOpenGlassDisplacementMap(material, margin) {
  const boxW = Math.round(material.width + margin * 2)
  const boxH = Math.round(material.height + margin * 2)
  // Super-sample for a smooth ramp, then downscale to the intrinsic box size.
  const ss = Math.min(Math.max(Math.round((typeof window !== 'undefined' && window.devicePixelRatio) || 1), 1), 3)
  const resW = boxW * ss
  const resH = boxH * ss

  const hi = document.createElement('canvas')
  hi.width = resW
  hi.height = resH
  const ctx = hi.getContext('2d')
  if (!ctx) return ''
  const image = ctx.createImageData(resW, resH)

  const cx = resW / 2
  const cy = resH / 2
  const bx = (material.width / 2) * ss
  const by = (material.height / 2) * ss
  const radius = openGlassRadius(material) * ss
  const depth = Math.max(material.depth, 0.001) * ss
  const { splay, curvature } = material

  // 4-fold symmetric: compute the top-left quadrant and mirror with sign flips (Aave opt.).
  const halfW = Math.ceil(resW / 2)
  const halfH = Math.ceil(resH / 2)
  for (let y = 0; y < halfH; y++) {
    const my = resH - 1 - y
    for (let x = 0; x < halfW; x++) {
      const mx = resW - 1 - x
      const px = Math.abs(x + 0.5 - cx)
      const py = Math.abs(y + 0.5 - cy)
      const qx = px - (bx - radius)
      const qy = py - (by - radius)

      let offsetX = 0
      let offsetY = 0
      if (qx > 0 && qy > 0) {
        // Rounded-corner arc: bend radially out of the arc centre.
        const len = Math.hypot(qx, qy)
        const inward = radius - len
        if (len < radius && inward < depth) {
          const magnitude = splay * Math.pow(1 - inward / depth, curvature)
          const dirX = len > 0 ? qx / len : Math.SQRT1_2
          const dirY = len > 0 ? qy / len : Math.SQRT1_2
          offsetX = -dirX * magnitude
          offsetY = -dirY * magnitude
        }
      } else {
        // Flat edges + interior: bend each axis by its own distance to the nearest edge,
        // staying continuous across the diagonal medial axis (no hard corner seam).
        const inX = bx - px
        const inY = by - py
        if (inX > 0 && inX < depth) offsetX = -splay * Math.pow(1 - inX / depth, curvature)
        if (inY > 0 && inY < depth) offsetY = -splay * Math.pow(1 - inY / depth, curvature)
      }

      const rPos = clampByte(128 + offsetX * 127)
      const rNeg = clampByte(128 - offsetX * 127)
      const gPos = clampByte(128 + offsetY * 127)
      const gNeg = clampByte(128 - offsetY * 127)
      writeMapPixel(image.data, resW, x, y, rPos, gPos)
      writeMapPixel(image.data, resW, mx, y, rNeg, gPos)
      writeMapPixel(image.data, resW, x, my, rPos, gNeg)
      writeMapPixel(image.data, resW, mx, my, rNeg, gNeg)
    }
  }
  ctx.putImageData(image, 0, 0)
  if (ss === 1) return hi.toDataURL()

  const out = document.createElement('canvas')
  out.width = boxW
  out.height = boxH
  const octx = out.getContext('2d')
  if (!octx) return hi.toDataURL()
  octx.imageSmoothingEnabled = true
  octx.imageSmoothingQuality = 'high'
  octx.drawImage(hi, 0, 0, boxW, boxH)
  return out.toDataURL()
}

// The unfiltered glass overlay: a concentric rim ring (edgeHighlight) + a directional specular
// glare (glow at specularAngle). Returned as {background, boxShadow} CSS strings.
function openGlassOverlayStyle(material) {
  const eh = material.edgeHighlight
  const rad = (material.specularAngle * Math.PI) / 180
  const gx = 50 + Math.sin(rad) * 30
  const gy = 50 - Math.cos(rad) * 30
  return {
    background: [
      `radial-gradient(100% 100% at 50% 50%, rgba(255,255,255,0) 70%, rgba(255,255,255,${round2(eh)}) 85%, rgba(255,255,255,${round2(eh * 0.15)}) 93%, rgba(255,255,255,0) 100%)`,
      `radial-gradient(120% 120% at ${round2(gx)}% ${round2(gy)}%, rgba(255,255,255,${round2(material.glow)}), rgba(255,255,255,0) 40%)`,
    ].join(', '),
    boxShadow: [
      `inset 0 1px 1px rgba(255,255,255,${round2(eh)})`,
      `inset 0 0 0 1px rgba(255,255,255,${round2(eh * 0.4)})`,
      'inset 0 -10px 20px rgba(0,0,0,0.06)',
      '0 10px 30px rgba(0,0,0,0.18)',
    ].join(', '),
  }
}

/* ───────────────────────────  src/OpenGlassFilter.tsx (ported)  ─────────────────────────── */
// One displacement pass, or three screen-blended passes when chroma > 0. Adapted for
// backdrop-filter: the filter region is offset by -margin so the rim samples real backdrop
// beyond the element (upstream gets this margin from the cloned content window instead).

function svgEl(tag, attrs) {
  const e = document.createElementNS(NS, tag)
  for (const k in attrs) e.setAttribute(k, attrs[k])
  return e
}

function buildFilter(id, material, margin) {
  const boxW = Math.round(material.width + margin * 2)
  const boxH = Math.round(material.height + margin * 2)
  const baseScale = material.scale * 2
  const chroma = material.chroma

  const f = svgEl('filter', {
    id, x: -margin, y: -margin, width: boxW, height: boxH,
    filterUnits: 'userSpaceOnUse', primitiveUnits: 'userSpaceOnUse', 'color-interpolation-filters': 'sRGB',
  })
  const feImage = svgEl('feImage', { x: -margin, y: -margin, width: boxW, height: boxH, preserveAspectRatio: 'none', result: 'map' })
  f.appendChild(feImage)

  if (chroma > 0) {
    const passes = [
      ['R', baseScale * (1 + chroma), '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0'],
      ['G', baseScale, '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0'],
      ['B', baseScale * (1 - chroma), '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0'],
    ]
    for (const [ch, sc, mat] of passes) {
      f.appendChild(svgEl('feDisplacementMap', { in: 'SourceGraphic', in2: 'map', scale: sc, xChannelSelector: 'R', yChannelSelector: 'G', result: 'd' + ch }))
      f.appendChild(svgEl('feColorMatrix', { in: 'd' + ch, type: 'matrix', values: mat, result: 'c' + ch }))
    }
    f.appendChild(svgEl('feBlend', { in: 'cR', in2: 'cG', mode: 'screen', result: 'cRG' }))
    f.appendChild(svgEl('feBlend', { in: 'cRG', in2: 'cB', mode: 'screen' }))
  } else {
    f.appendChild(svgEl('feDisplacementMap', { in: 'SourceGraphic', in2: 'map', scale: baseScale, xChannelSelector: 'R', yChannelSelector: 'G' }))
  }
  return { filter: f, feImage }
}

/* ───────────────────────────  host wiring (backdrop-filter)  ─────────────────────────── */

let defs = document.querySelector('svg.lg-defs')
if (!defs) {
  defs = document.createElementNS(NS, 'svg')
  defs.setAttribute('class', 'lg-defs')
  defs.setAttribute('aria-hidden', 'true')
  document.body.appendChild(defs)
}

let uid = 0
const registry = new Map() // element → { material, margin, tintVar, feImage, filter, id, raf }

function applyMap(eln) {
  const reg = registry.get(eln)
  if (!reg) return
  // offsetWidth/Height = the untransformed LAYOUT box. getBoundingClientRect would include the
  // dropdown's open scaleY (and the card's entrance scale), sizing the filter region to a
  // mid-animation half-height — then the filter produces no output below it, so the lower part
  // gets no blur/refraction. The SVG filter runs in untransformed userSpace, so layout size is
  // what the region must match; the transform scales the already-filtered result uniformly.
  const w = eln.offsetWidth, h = eln.offsetHeight
  if (w < 4 || h < 4) return // hidden / not laid out yet
  const { material, margin, feImage, filter } = reg
  material.width = w
  material.height = h
  const boxW = Math.round(w + margin * 2)
  const boxH = Math.round(h + margin * 2)
  filter.setAttribute('width', boxW)
  filter.setAttribute('height', boxH)
  feImage.setAttribute('width', boxW)
  feImage.setAttribute('height', boxH)
  const url = makeOpenGlassDisplacementMap(material, margin)
  feImage.setAttributeNS(XLINK, 'href', url)
  feImage.setAttribute('href', url)
}

function applyOverlay(eln) {
  const reg = registry.get(eln)
  if (!reg) return
  const { material, tintVar, id } = reg
  const o = openGlassOverlayStyle(material)
  const tint = (tintVar && getComputedStyle(eln).getPropertyValue(tintVar).trim()) || 'transparent'
  // Rim + glare on top, the glass body tint underneath, the refracted globe showing through.
  eln.style.background = `${o.background}, ${tint}`
  eln.style.boxShadow = o.boxShadow
  eln.style.setProperty('--lg-filter', `url(#${id})`)
}

function schedule(eln) {
  const reg = registry.get(eln)
  if (!reg) return
  if (reg.raf) cancelAnimationFrame(reg.raf)
  reg.raf = requestAnimationFrame(() => { reg.raf = 0; applyMap(eln) })
}

const ro = new ResizeObserver((entries) => { for (const e of entries) schedule(e.target) })

function register(eln, material, opts = {}) {
  if (!eln || registry.has(eln)) return
  const m = { ...material }
  const margin = opts.margin ?? 32
  const id = `og-${++uid}`
  const { filter, feImage } = buildFilter(id, m, margin)
  defs.appendChild(filter)
  registry.set(eln, { material: m, margin, tintVar: opts.tintVar, feImage, filter, id, raf: 0 })
  ro.observe(eln)
  applyMap(eln)
  applyOverlay(eln)
}

function unregister(eln) {
  const reg = registry.get(eln)
  if (!reg) return
  ro.unobserve(eln)
  if (reg.raf) cancelAnimationFrame(reg.raf)
  reg.filter.remove()
  eln.style.removeProperty('--lg-filter')
  registry.delete(eln)
}

window.movorbGlass = { register, unregister, refresh: schedule, isWebKitEngine }

// Re-tint overlays when the theme flips (the map is shape-only and doesn't change).
new MutationObserver(() => { for (const eln of registry.keys()) applyOverlay(eln) })
  .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

// Per-surface materials (OpenGlass defaults, sized to wide UI panes; width/height are set live).
// The controls bar is currently a solid dark bar (see styles.css) — its OpenGlass registration is
// disabled. To restore the glass bar: uncomment this and the glass block in `.controls`.
// const controls = document.getElementById('controls')
// if (controls) register(controls, { width: 360, height: 48, borderRadius: 22, scale: 16, depth: 24, curvature: 2.8, splay: -1, chroma: 0.06, blur: 0, glow: 0.3, edgeHighlight: 0.55, specularAngle: 325 }, { margin: 36, tintVar: '--glass' })

// The focus card is no longer a single glass slab: it's a transparent stage whose glass surface is
// the rounded, clip-path-revealed `.focus__bg` (styled in CSS). OpenGlass must NOT register the
// (unrounded) `.focus__card`, or it writes inline background + box-shadow + --lg-filter that render
// as a SQUARE glass rectangle with a drop shadow behind the rounded card — and those inline styles
// linger on close. Leaving it unregistered is the fix.
// const card = document.querySelector('.focus__card')
// if (card) register(card, { width: 660, height: 430, borderRadius: 28, scale: 20, depth: 34, curvature: 2.6, splay: -1, chroma: 0.08, blur: 0, glow: 0.32, edgeHighlight: 0.55, specularAngle: 325 }, { margin: 48, tintVar: '--glass-panel' })

// Dropdown panels are currently solid dark menus (styles.css), so OpenGlass is disabled for them.
// To restore the glass menus: uncomment this and the glass block in `.dd-panel`.
// new MutationObserver((muts) => {
//   for (const m of muts) {
//     for (const n of m.addedNodes) if (n.nodeType === 1 && n.classList?.contains('dd-panel')) register(n, { width: 190, height: 260, borderRadius: 18, scale: 14, depth: 20, curvature: 2.8, splay: -1, chroma: 0.06, blur: 0, glow: 0.3, edgeHighlight: 0.5, specularAngle: 325 }, { margin: 30, tintVar: '--glass' })
//     for (const n of m.removedNodes) if (n.nodeType === 1 && n.classList?.contains('dd-panel')) unregister(n)
//   }
// }).observe(document.body, { childList: true })
