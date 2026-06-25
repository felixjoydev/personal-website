// Movorb genre + language dropdowns — a React + motion/react island mounted into the
// (otherwise vanilla Three.js) page, over an ESM import map; htm gives JSX-like syntax with
// no build step. The panel is proper liquid glass (same tint/blur/refraction as the bar) and
// springs open from the trigger via motion/react.
//
// The panel is PORTALED to <body>: nested inside the bar (which itself has backdrop-filter),
// a child's backdrop-filter can't sample the page behind it, so it'd look flat/opaque. As a
// top-level element it gets the identical glass to the bar.

import React, { useState, useEffect, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'motion/react'
import htm from 'htm'

const html = htm.bind(React.createElement)
const SPRING = { type: 'spring', visualDuration: 0.3, bounce: 0.28 }
const GAP = 20   // clearance above the trigger so the open menu doesn't touch the controls bar
const PANEL_W = 190

const Chevron = () => html`
  <svg className="dd-chev" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 15l6-6 6 6" /></svg>`

const Check = () => html`
  <svg className="dd-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>`

function Dropdown({ placeholder, items, value, onSelect }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ left: 0, bottom: 0 })
  const btnRef = useRef(null)
  const panelRef = useRef(null)

  const place = () => {
    const r = btnRef.current?.getBoundingClientRect()
    if (!r) return
    const left = Math.max(8, Math.min(r.left, innerWidth - PANEL_W - 8))
    setPos({ left, bottom: innerHeight - r.top + GAP })
  }

  const toggle = () => { if (!open) place(); setOpen((o) => !o) }

  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      const t = e.target
      if (btnRef.current?.contains(t) || panelRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    const onResize = () => setOpen(false)
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onResize)
    }
  }, [open])

  const current = items.find((i) => i.value === value)
  const label = value && current ? current.label : placeholder

  const panel = html`
    <${AnimatePresence}>
      ${open && html`
        <${motion.div}
          key="panel"
          ref=${panelRef}
          className="dd-panel"
          role="listbox"
          style=${{ position: 'fixed', left: pos.left + 'px', bottom: pos.bottom + 'px', transformOrigin: 'bottom left' }}
          initial=${{ opacity: 0, scaleY: 0.5, y: 8 }}
          animate=${{ opacity: 1, scaleY: 1, y: 0 }}
          exit=${{ opacity: 0, scaleY: 0.55, y: 8 }}
          transition=${SPRING}
        >
          ${items.map((it) => html`
            <button
              key=${it.value || 'all'}
              type="button"
              role="option"
              aria-selected=${it.value === value}
              className=${'dd-option' + (it.value === value ? ' is-active' : '')}
              onClick=${() => { onSelect(it.value); setOpen(false) }}
            >
              <span>${it.label}</span>
              ${it.value === value && html`<${Check} />`}
            </button>`)}
        <//>`}
    <//>`

  return html`
    <div className=${'dropdown' + (open ? ' open' : '')}>
      <button
        ref=${btnRef}
        className="dd-btn"
        type="button"
        aria-haspopup="listbox"
        aria-expanded=${open}
        onClick=${toggle}
      >
        <span className="dd-label">${label}</span>
        <${Chevron} />
      </button>
      ${createPortal(panel, document.body)}
    </div>`
}

// Surprise clears the filters in movorb.js; re-sync each dropdown's displayed value back to its
// placeholder via the onReset hook. (Islands live for the page's lifetime, so no unsubscribe.)
function useFilterReset(setValue) {
  useEffect(() => { window.movorb?.onReset?.(() => setValue('')) }, [])
}

function GenreIsland() {
  const [value, setValue] = useState('')
  useFilterReset(setValue)
  const genres = (window.movorb?.GENRES) || []
  const items = genres.map((g) => ({ label: g === 'All' ? 'All genres' : g, value: g === 'All' ? '' : g }))
  return html`<${Dropdown} placeholder="Genre" items=${items} value=${value}
    onSelect=${(v) => { setValue(v); window.movorb?.setGenre(v) }} />`
}

function LanguageIsland() {
  const [value, setValue] = useState('')
  useFilterReset(setValue)
  const items = (window.movorb?.LANGUAGES) || []
  return html`<${Dropdown} placeholder="Language" items=${items} value=${value}
    onSelect=${(v) => { setValue(v); window.movorb?.setLanguage(v) }} />`
}

const genreEl = document.getElementById('genre-mount')
const langEl = document.getElementById('lang-mount')
if (genreEl) createRoot(genreEl).render(html`<${GenreIsland} />`)
if (langEl) createRoot(langEl).render(html`<${LanguageIsland} />`)
