// panel.js — Movorb's control panel: a right-anchored vertical glass panel (React + motion/react)
// that replaces the old bottom controls bar. Type tabs with a sliding indicator that glides under
// the labels, glass dropdowns for genre/language, and fader-style sliders for rating + poster
// count. State + data loading stay in movorb.js; this island reads window.movorb and calls its
// setters. The old bar is preserved (commented out in index.html / dropdowns.js / movorb.js).
//
/* ─────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD
 *
 *    0ms   panel mounts: slides in from the right (x 18 → 0, fade)
 *   ~0ms   rows stagger up (y 10 → 0, 50ms apart, top → bottom)
 *  on tap  type indicator springs from the old tab to the new, under the labels
 *  on open dropdown menu oozes open (scaleY 0.6 → 1) from its top edge
 *  on drag fader fill + handle track the pointer 1:1 (no transition while dragging)
 * ───────────────────────────────────────────────────────── */

import React, { useState, useRef, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence, LayoutGroup } from 'motion/react'
import htm from 'htm'

const html = htm.bind(React.createElement)
const M = window.movorb

/* ─────────────────────────────  Motion config  ───────────────────────────── */
const PANEL = { offsetX: 18, spring: { type: 'spring', visualDuration: 0.42, bounce: 0.18 } }
const ROWS = { stagger: 0.05, offsetY: 10, spring: { type: 'spring', visualDuration: 0.4, bounce: 0.2 } }
const TAB = { spring: { type: 'spring', visualDuration: 0.34, bounce: 0.28 } }   // indicator glide
const MENU = { spring: { type: 'spring', visualDuration: 0.3, bounce: 0.24 } }   // dropdown ooze

const TYPES = [
  { label: 'All', value: 'all' },
  { label: 'Movies', value: 'movie' },
  { label: 'TV', value: 'tv' },
]

const Chevron = () => html`<svg className="pnl-chev" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6" /></svg>`
const Check = () => html`<svg className="dd-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>`

/* ─────────────────────────────  Type tabs  ───────────────────────────── */
// The active pill is a layoutId element: when the active tab changes it re-parents into the new
// button and motion animates it across — sliding under the labels (it sits below them in z).
function Tabs({ value, onChange }) {
  return html`
    <div className="pnl-tabs" role="tablist" aria-label="Title type">
      ${TYPES.map((t) => html`
        <button
          key=${t.value}
          type="button"
          role="tab"
          aria-selected=${t.value === value}
          className=${'pnl-tab' + (t.value === value ? ' is-active' : '')}
          onClick=${() => onChange(t.value)}
        >
          ${t.value === value && html`<${motion.span} layoutId="pnl-tab-ind" className="pnl-tab-ind" transition=${TAB.spring} />`}
          <span className="pnl-tab-label">${t.label}</span>
        </button>`)}
    </div>`
}

/* ─────────────────────────────  Fader slider  ───────────────────────────── */
// The whole row is the track: a filled portion + a thin handle line, label left, value right.
// Pointer-captured drag updates 1:1 (transition disabled while dragging for zero lag).
function Fader({ label, value, min, max, step, format, onChange }) {
  const ref = useRef(null)
  const [dragging, setDragging] = useState(false)
  const pct = Math.max(0, Math.min(1, (value - min) / (max - min)))

  const commit = (clientX) => {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    const t = Math.max(0, Math.min(1, (clientX - r.left) / r.width))
    let v = min + t * (max - min)
    v = Math.round(v / step) * step
    v = Math.max(min, Math.min(max, v))
    if (v !== value) onChange(v)
  }

  const onDown = (e) => { setDragging(true); e.currentTarget.setPointerCapture?.(e.pointerId); commit(e.clientX) }
  const onMove = (e) => { if (dragging) commit(e.clientX) }
  const end = (e) => { setDragging(false); try { e.currentTarget.releasePointerCapture?.(e.pointerId) } catch { /* already released */ } }
  const onKey = (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); onChange(Math.max(min, value - step)) }
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); onChange(Math.min(max, value + step)) }
  }

  return html`
    <div
      ref=${ref}
      className=${'pnl-fader' + (dragging ? ' is-dragging' : '')}
      role="slider"
      tabIndex=${0}
      aria-label=${label}
      aria-valuemin=${min}
      aria-valuemax=${max}
      aria-valuenow=${value}
      onPointerDown=${onDown}
      onPointerMove=${onMove}
      onPointerUp=${end}
      onPointerCancel=${end}
      onKeyDown=${onKey}
    >
      <div className="pnl-fader-fill" style=${{ width: pct * 100 + '%' }}></div>
      <div className="pnl-fader-handle" style=${{ left: pct * 100 + '%' }}></div>
      <span className="pnl-fader-label">${label}</span>
      <span className="pnl-fader-value">${format(value)}</span>
    </div>`
}

/* ─────────────────────────────  Dropdown row  ───────────────────────────── */
// The whole row is the trigger (label left, value + chevron right); the menu portals to <body>
// (reusing .dd-panel so glass.js gives it the same OpenGlass treatment) and springs open.
function DropdownRow({ label, items, value, onChange }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ left: 0, top: 0, width: 0 })
  const triggerRef = useRef(null)
  const panelRef = useRef(null)
  const current = items.find((i) => i.value === value)
  const text = current ? current.label : items[0]?.label

  const place = () => {
    const r = triggerRef.current?.getBoundingClientRect()
    if (!r) return
    const width = Math.max(r.width, 180)
    const left = Math.max(8, Math.min(r.right - width, innerWidth - width - 8))
    // Open downward, but flip above if it would overflow the viewport bottom.
    const below = r.bottom + 8
    const top = below + 300 > innerHeight ? Math.max(8, r.top - 8 - Math.min(300, innerHeight - 16)) : below
    setPos({ left, top, width })
  }
  const toggle = () => { if (!open) place(); setOpen((o) => !o) }

  useEffect(() => {
    if (!open) return
    const onDocDown = (e) => {
      if (triggerRef.current?.contains(e.target) || panelRef.current?.contains(e.target)) return
      setOpen(false)
    }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    const onReflow = () => setOpen(false)
    window.addEventListener('pointerdown', onDocDown)
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', onReflow)
    return () => {
      window.removeEventListener('pointerdown', onDocDown)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onReflow)
    }
  }, [open])

  const menu = html`
    <${AnimatePresence}>
      ${open && html`
        <${motion.div}
          key="menu"
          ref=${panelRef}
          className="dd-panel"
          role="listbox"
          style=${{ position: 'fixed', left: pos.left + 'px', top: pos.top + 'px', minWidth: pos.width + 'px', transformOrigin: 'top right' }}
          initial=${{ opacity: 0, scaleY: 0.6, y: -6 }}
          animate=${{ opacity: 1, scaleY: 1, y: 0 }}
          exit=${{ opacity: 0, scaleY: 0.6, y: -6 }}
          transition=${MENU.spring}
        >
          ${items.map((it) => html`
            <button
              key=${it.value || 'all'}
              type="button"
              role="option"
              aria-selected=${it.value === value}
              className=${'dd-option' + (it.value === value ? ' is-active' : '')}
              onClick=${() => { onChange(it.value); setOpen(false) }}
            >
              <span>${it.label}</span>
              ${it.value === value && html`<${Check} />`}
            </button>`)}
        <//>`}
    <//>`

  return html`
    <button
      ref=${triggerRef}
      type="button"
      className=${'pnl-row pnl-row--dd' + (open ? ' open' : '')}
      aria-haspopup="listbox"
      aria-expanded=${open}
      onClick=${toggle}
    >
      <span className="pnl-row-label">${label}</span>
      <span className="pnl-row-value">${text}<${Chevron} /></span>
      ${createPortal(menu, document.body)}
    </button>`
}

/* ─────────────────────────────  Panel  ───────────────────────────── */
function Panel() {
  const init = M.state
  const [type, setType] = useState(init.type)
  const [genre, setGenre] = useState(init.genre)
  const [language, setLanguage] = useState(init.language)
  const [rating, setRating] = useState(init.minRating)
  const [count, setCount] = useState(init.limit)
  const [ratingHidden, setRatingHidden] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => { M.onSource((src) => setRatingHidden(src === 'tvdb')) }, [])

  // Register the panel as an OpenGlass surface (and clean up on unmount).
  useEffect(() => {
    const el = rootRef.current
    const glass = window.movorbGlass
    if (!el || !glass) return
    // chroma 0 → single displacement pass: the panel is always on screen over the spinning globe.
    glass.register(el, { width: 300, height: 520, borderRadius: 30, scale: 18, depth: 30, curvature: 2.6, splay: -1, chroma: 0, blur: 0, glow: 0.3, edgeHighlight: 0.5, specularAngle: 325 }, { margin: 44, tintVar: '--glass-panel' })
    return () => glass.unregister(el)
  }, [])

  const genreItems = M.GENRES.map((g) => ({ label: g === 'All' ? 'All genres' : g, value: g === 'All' ? '' : g }))
  const ratingFmt = (v) => (v === 0 ? 'Any' : v.toFixed(1) + '+')

  // Staggered entrance: each child slides up, ROWS.stagger apart, top → bottom.
  let i = 0
  const item = (child) => html`
    <${motion.div}
      key=${i}
      initial=${{ opacity: 0, y: ROWS.offsetY }}
      animate=${{ opacity: 1, y: 0 }}
      transition=${{ ...ROWS.spring, delay: i++ * ROWS.stagger }}
    >${child}<//>`

  return html`
    <${motion.div}
      ref=${rootRef}
      className="pnl"
      initial=${{ opacity: 0, x: PANEL.offsetX }}
      animate=${{ opacity: 1, x: 0 }}
      transition=${PANEL.spring}
    >
      <${LayoutGroup}>
        ${item(html`<${Tabs} value=${type} onChange=${(v) => { setType(v); M.setType(v) }} />`)}

        ${item(html`<div className="pnl-section">Catalogue</div>`)}
        ${item(html`<${DropdownRow} label="Genre" items=${genreItems} value=${genre} onChange=${(v) => { setGenre(v); M.setGenre(v) }} />`)}
        ${item(html`<${DropdownRow} label="Language" items=${M.LANGUAGES} value=${language} onChange=${(v) => { setLanguage(v); M.setLanguage(v) }} />`)}

        ${item(html`<div className="pnl-section">Filters</div>`)}
        ${!ratingHidden && item(html`<${Fader} label="Rating" value=${rating} min=${M.ranges.rating.min} max=${M.ranges.rating.max} step=${M.ranges.rating.step} format=${ratingFmt} onChange=${(v) => { setRating(v); M.setRating(v) }} />`)}
        ${item(html`<${Fader} label="Posters" value=${count} min=${M.ranges.count.min} max=${M.ranges.count.max} step=${M.ranges.count.step} format=${String} onChange=${(v) => { setCount(v); M.setCount(v) }} />`)}
      <//>
    <//>`
}

const mount = document.getElementById('panel-mount')
if (mount && M) createRoot(mount).render(html`<${Panel} />`)
