// /api/titles — Movorb data proxy with a resilient source cascade. The primary source
// is whichever key is configured; if it fails, a curated static set keeps the globe full:
//
//   1. TheTVDB     — when THETVDB_KEY is set (+ optional THETVDB_PIN). Genre + type;
//                    no 0-10 rating (TheTVDB only has an internal popularity "score").
//   2. TMDB        — when TMDB_KEY is set. Genre + type + rating, fast CDN posters.
//   3. imdbapi.dev — keyless fallback (genre + type + rating), can be slow/rate-limited.
//   4. static set  — curated offline list, so the globe is never empty.
//
// All sources map to one slim item shape:
//   { id, imdb, tmdb:{id,type}|null, tvdbUrl?, title, year, type, genres[], rating, score?, poster, posterLarge }

import { FALLBACK } from './_fallback.js'

/* ─────────────────────────────  TheTVDB (primary when keyed)  ───────────────────────────── */
const TVDB = 'https://api4.thetvdb.com/v4'
const TVDB_GENRE_ALIAS = { 'Sci-Fi': 'science fiction' } // chip name -> TheTVDB genre name

// Token (~1mo TTL) and the genre map are cached on globalThis so they survive both warm
// lambdas and the dev server's per-request module reloads.
async function tvdbToken() {
  const c = globalThis.__tvdbAuth
  if (c && c.exp > Date.now()) return c.token
  const res = await fetch(`${TVDB}/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ apikey: process.env.THETVDB_KEY, ...(process.env.THETVDB_PIN ? { pin: process.env.THETVDB_PIN } : {}) }),
    signal: AbortSignal.timeout(6000),
  })
  if (!res.ok) throw new Error(`tvdb login ${res.status}`)
  const token = (await res.json())?.data?.token
  if (!token) throw new Error('tvdb: no token')
  globalThis.__tvdbAuth = { token, exp: Date.now() + 6 * 24 * 3600 * 1000 }
  return token
}

async function tvdbGenreId(name, token) {
  if (!name) return null
  let map = globalThis.__tvdbGenres
  if (!map) {
    const res = await fetch(`${TVDB}/genres`, { headers: { Authorization: `Bearer ${token}`, accept: 'application/json' }, signal: AbortSignal.timeout(6000) })
    if (!res.ok) return null
    map = {}
    for (const g of (await res.json()).data || []) map[String(g.name).toLowerCase()] = g.id
    globalThis.__tvdbGenres = map
  }
  return map[(TVDB_GENRE_ALIAS[name] || name).toLowerCase()] ?? null
}

function tvdbImage(img) {
  if (!img) return null
  if (/^https?:/i.test(img)) return img
  return `https://artworks.thetvdb.com${img.startsWith('/') ? '' : '/'}${img}`
}
function slimTvdb(r, kind) {
  const img = tvdbImage(r.image)
  if (!img) return null
  const ep = kind === 'movie' ? 'movies' : 'series'
  return {
    id: `tvdb:${kind}:${r.id}`,
    imdb: null, tmdb: null,
    tvdbUrl: `https://www.thetvdb.com/${ep}/${r.slug || r.id}`,
    title: r.name || 'Untitled',
    year: r.year ? Number(r.year) || null : null,
    type: kind === 'movie' ? 'movie' : 'tv',
    genres: [], // the filter endpoint doesn't return per-title genre names
    rating: null, // TheTVDB has no 0-10 user rating
    score: r.score || 0,
    poster: `/api/poster?u=${encodeURIComponent(img)}`,
    posterLarge: `/api/poster?u=${encodeURIComponent(img)}`,
  }
}
async function filterTvdb(ep, genreId, page, token) {
  const url = new URL(`${TVDB}/${ep}/filter`)
  url.searchParams.set('country', 'usa')
  url.searchParams.set('lang', 'eng')
  url.searchParams.set('sort', 'score')
  url.searchParams.set('sortType', 'desc')
  if (genreId) url.searchParams.set('genre', String(genreId))
  url.searchParams.set('page', String(page))
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, accept: 'application/json' }, signal: AbortSignal.timeout(6000) })
  if (!res.ok) throw new Error(`tvdb ${ep} ${res.status}`)
  return res.json()
}
async function fromTvdb(kinds, genre, target) {
  const token = await tvdbToken()
  const genreId = await tvdbGenreId(genre, token)
  const eps = kinds.map((k) => (k === 'movie' ? 'movies' : 'series'))
  const calls = []
  for (const ep of eps) for (let p = 0; p < 3; p++) calls.push(filterTvdb(ep, genreId, p, token).then((d) => ({ ep, d })).catch(() => null))
  const ok = (await Promise.all(calls)).filter(Boolean)
  if (!ok.length) throw new Error('all TVDB requests failed')
  const items = []
  const seen = new Set()
  for (const { ep, d } of ok) {
    for (const r of d.data || []) {
      const s = slimTvdb(r, ep === 'movies' ? 'movie' : 'tv')
      if (s && !seen.has(s.id)) { seen.add(s.id); items.push(s) }
    }
  }
  items.sort((a, b) => (b.score || 0) - (a.score || 0)) // most popular first
  return items.slice(0, target)
}

/* ─────────────────────────────  TMDB (used if TMDB_KEY set)  ───────────────────────────── */
const TMDB = 'https://api.themoviedb.org/3'
const IMG = 'https://image.tmdb.org/t/p' // CORS-enabled → posters load directly
const MOVIE_GENRES = { Action: 28, Adventure: 12, Animation: 16, Comedy: 35, Crime: 80, Documentary: 99, Drama: 18, Family: 10751, Fantasy: 14, Horror: 27, Mystery: 9648, Romance: 10749, 'Sci-Fi': 878, Thriller: 53, War: 10752, Western: 37 }
const TV_GENRES = { Action: 10759, Adventure: 10759, Animation: 16, Comedy: 35, Crime: 80, Documentary: 99, Drama: 18, Family: 10751, Fantasy: 10765, Mystery: 9648, 'Sci-Fi': 10765, War: 10768, Western: 37 }
const MOVIE_ID_NAME = { 28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime', 99: 'Documentary', 18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History', 27: 'Horror', 10402: 'Music', 9648: 'Mystery', 10749: 'Romance', 878: 'Sci-Fi', 10770: 'TV Movie', 53: 'Thriller', 10752: 'War', 37: 'Western' }
const TV_ID_NAME = { 10759: 'Action', 16: 'Animation', 35: 'Comedy', 80: 'Crime', 99: 'Documentary', 18: 'Drama', 10751: 'Family', 10762: 'Kids', 9648: 'Mystery', 10763: 'News', 10764: 'Reality', 10765: 'Sci-Fi', 10766: 'Soap', 10767: 'Talk', 10768: 'War', 37: 'Western' }

function tmdbFetch(url) {
  const key = process.env.TMDB_KEY || ''
  const headers = { accept: 'application/json' }
  if (key.includes('.')) headers.Authorization = `Bearer ${key}`
  else url.searchParams.set('api_key', key)
  return fetch(url, { headers, signal: AbortSignal.timeout(4000) })
}
// Fetch a TMDB endpoint as JSON, retrying transient failures (429 throttling, 5xx, aborted
// timeouts). Without this a single dropped page silently shrinks the globe below the requested
// count — and the more pages a request needs, the likelier at least one drops. 3 attempts × 4s +
// backoff stays under the client's 14s budget.
async function tmdbJson(url) {
  let lastErr = 'tmdb error'
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 300 * attempt))
    let res
    try { res = await tmdbFetch(url) } catch (e) { lastErr = String(e.message || e); continue } // timeout/network → retry
    if (res.ok) return res.json()
    lastErr = `tmdb ${res.status}`
    if (res.status !== 429 && res.status < 500) break // non-throttle 4xx won't change on retry
  }
  throw new Error(lastErr)
}
function slimTmdb(r, kind) {
  if (!r.poster_path) return null
  const names = kind === 'tv' ? TV_ID_NAME : MOVIE_ID_NAME
  const date = kind === 'tv' ? r.first_air_date : r.release_date
  return {
    id: `tmdb:${kind}:${r.id}`,
    tmdb: { id: r.id, type: kind }, imdb: null,
    title: r.title || r.name || r.original_title || r.original_name || 'Untitled',
    year: date ? Number(date.slice(0, 4)) || null : null,
    type: kind,
    genres: [...new Set((r.genre_ids || []).map((g) => names[g]).filter(Boolean))],
    rating: r.vote_average ? Math.round(r.vote_average * 10) / 10 : null,
    votes: r.vote_count ?? null,
    poster: `${IMG}/w185${r.poster_path}`,
    posterLarge: `${IMG}/w500${r.poster_path}`,
  }
}
async function discoverTmdb(kind, genre, minRating, language, page) {
  const url = new URL(`${TMDB}/discover/${kind}`)
  url.searchParams.set('include_adult', 'false')
  url.searchParams.set('language', 'en-US') // display language for titles/metadata
  url.searchParams.set('sort_by', 'vote_count.desc')
  // High vote floor for the default view (keeps it to recognizable mainstream titles), but
  // relax it when a language is selected — regional cinema has far fewer TMDB votes, so the
  // high floor would otherwise return almost nothing (e.g. Tamil/Kannada → 0).
  const floor = language ? (kind === 'tv' ? 15 : 30) : (kind === 'tv' ? 150 : 300)
  url.searchParams.set('vote_count.gte', String(floor))
  url.searchParams.set('page', String(page))
  const genreId = (kind === 'tv' ? TV_GENRES : MOVIE_GENRES)[genre]
  if (genreId) url.searchParams.set('with_genres', String(genreId))
  if (minRating > 0) url.searchParams.set('vote_average.gte', String(minRating))
  if (language) url.searchParams.set('with_original_language', language) // filter by original language
  return tmdbJson(url)
}
async function fromTmdb(kinds, genre, minRating, language, target) {
  // Pages per kind to cover `target` with a ~30% buffer (absorbs no-poster dropouts + dedupe),
  // split across the requested kinds (~20 results/page). The old `Math.min(6, …)` cap silently
  // limited single-kind globes to ~120 posters, so higher counts were simply unreachable.
  const pages = Math.min(12, Math.max(2, Math.ceil((target * 1.3) / kinds.length / 20)))
  const calls = []
  for (const kind of kinds) for (let p = 1; p <= pages; p++) calls.push(discoverTmdb(kind, genre, minRating, language, p).then((d) => ({ kind, d })).catch(() => null))
  const ok = (await Promise.all(calls)).filter(Boolean)
  if (!ok.length) throw new Error('all TMDB requests failed')
  const items = []
  const seen = new Set()
  for (const { kind, d } of ok) for (const r of d.results || []) { const s = slimTmdb(r, kind); if (s && !seen.has(s.id)) { seen.add(s.id); items.push(s) } }
  items.sort((a, b) => (b.votes || 0) - (a.votes || 0))
  return items.slice(0, target)
}

/* ── Surprise: a fresh, randomized set of niche-but-good "gems", re-rolled on every press ── */
// TMDB has no "obscure gem" flag, so we emulate one: a high rating floor (so it's good), a real
// vote floor (so the rating is trustworthy, not a 9.0 from five people), and a randomized recipe
// (genre / language / sort / a soft vote ceiling + a random page) so every call surfaces a
// different slice. A loosening cascade guarantees the globe still fills for thin combos.
const SURPRISE_LANGS = ['en', 'hi', 'ml', 'ta', 'te', 'kn', 'ja', 'ko', 'es', 'fr', 'it', 'de', 'zh', 'pt', 'sv', 'da', 'fa', 'pl', 'tr']
const rnd = (min, max) => min + Math.random() * (max - min)
const rndInt = (min, max) => Math.floor(rnd(min, max + 1))
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]] } return a }

async function discoverSurprise(kind, base, genre, language, page) {
  const url = new URL(`${TMDB}/discover/${kind}`)
  url.searchParams.set('include_adult', 'false')
  url.searchParams.set('language', 'en-US')
  for (const [k, v] of Object.entries(base)) if (v) url.searchParams.set(k, String(v))
  if (genre) url.searchParams.set('with_genres', String(genre))
  if (language) url.searchParams.set('with_original_language', language)
  url.searchParams.set('page', String(page))
  const res = await tmdbFetch(url)
  if (!res.ok) throw new Error(`tmdb ${res.status}`)
  return res.json()
}

async function gatherSurprise(kind, want) {
  const genres = Object.values(kind === 'tv' ? TV_GENRES : MOVIE_GENRES)
  const base = {
    'vote_average.gte': Math.round(rnd(6.8, 7.6) * 10) / 10,                            // "good" on TMDB's scale
    'vote_count.gte': pick([30, 50, 80]),                                               // enough votes that the rating means something
    sort_by: pick(['vote_average.desc', 'vote_average.desc', 'popularity.desc', 'vote_count.desc']),
  }
  if (Math.random() < 0.5) base['vote_count.lte'] = rndInt(800, 4000)                   // bias off the blockbusters
  let genre = Math.random() < 0.55 ? pick(genres) : null
  let language = Math.random() < 0.45 ? pick(SURPRISE_LANGS) : null

  // Loosen, in order, until the pool is deep enough to randomize over (thin combos → broaden).
  const relax = [() => { language = null }, () => { delete base['vote_count.lte'] }, () => { genre = null }, () => { base['vote_average.gte'] = 6.5 }]
  let totalPages = 1, first = []
  for (let step = 0; ; step++) {
    const probe = await discoverSurprise(kind, base, genre, language, 1).catch(() => null)
    if (probe) { totalPages = Math.min(probe.total_pages || 1, 500); first = probe.results || [] }
    if ((probe?.total_results || 0) >= want * 2 || step >= relax.length) break
    relax[step]()
  }

  // Pull a few random pages (plus the probe's page 1), then shuffle them together.
  const need = Math.min(Math.ceil(want / 20) + 1, totalPages)
  const pages = new Set()
  for (let g = 0; pages.size < need - 1 && g < 40; g++) { const p = rndInt(2, totalPages); if (p > 1) pages.add(p) }
  const rest = (await Promise.all([...pages].map((p) => discoverSurprise(kind, base, genre, language, p).then((d) => d.results || []).catch(() => [])))).flat()

  const items = []
  const seen = new Set()
  for (const r of shuffle([...first, ...rest])) { const s = slimTmdb(r, kind); if (s && !seen.has(s.id)) { seen.add(s.id); items.push(s) } }
  return items
}

async function fromTmdbSurprise(kinds, target) {
  if (kinds.length === 1) {
    const out = []
    const seen = new Set()
    for (const r of shuffle(await gatherSurprise(kinds[0], target))) if (!seen.has(r.id)) { seen.add(r.id); out.push(r) }
    return out.slice(0, target)
  }
  // Mixed: lean toward film, then top up from TV (and back-fill from film) so the globe still
  // fills even when one side is thin. A final shuffle interleaves them across the globe.
  const movieWant = Math.round(target * 0.65)
  const [movies, tv] = await Promise.all([gatherSurprise('movie', movieWant), gatherSurprise('tv', target - movieWant)])
  const out = []
  const seen = new Set()
  const take = (list, n) => { for (const r of list) { if (out.length >= target || n <= 0) break; if (!seen.has(r.id)) { seen.add(r.id); out.push(r); n-- } } }
  take(shuffle(movies), movieWant)
  take(shuffle(tv), target - out.length)
  take(shuffle(movies), target - out.length) // leftover film if TV came back thin
  return shuffle(out).slice(0, target)
}

/* ─────────────────────────────  imdbapi.dev (keyless fallback)  ───────────────────────────── */
const IMDBAPI = 'https://api.imdbapi.dev/titles'
const IMDB_TYPES = { all: ['MOVIE', 'TV_SERIES', 'TV_MINI_SERIES'], movie: ['MOVIE'], tv: ['TV_SERIES', 'TV_MINI_SERIES'] }
function amazonSized(url, w) { return url.replace(/\._V1_.*?(\.\w+)$/i, `._V1_QL80_UX${w}_$1`) }
function proxied(url, w) { return `/api/poster?w=${w}&u=${encodeURIComponent(amazonSized(url, w))}` }
function slimImdb(t) {
  const img = t.primaryImage
  if (!img || !img.url) return null
  return {
    id: t.id, imdb: t.id, tmdb: null,
    title: t.primaryTitle || t.originalTitle || 'Untitled',
    year: t.startYear || null, type: t.type || null,
    genres: Array.isArray(t.genres) ? t.genres : [],
    rating: t.rating?.aggregateRating ?? null, votes: t.rating?.voteCount ?? null,
    poster: proxied(img.url, 240), posterLarge: proxied(img.url, 680),
  }
}
async function imdbFetchPage(params, pageToken) {
  const u = new URL(IMDBAPI)
  for (const [k, val] of Object.entries(params)) for (const v of [].concat(val)) if (v !== undefined && v !== null && v !== '') u.searchParams.append(k, v)
  if (pageToken) u.searchParams.set('pageToken', pageToken)
  let lastErr = 'upstream error'
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 500))
    let res
    try { res = await fetch(u, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(5000) }) } catch (e) { lastErr = String(e.message || e); continue }
    if (res.ok) return res.json()
    lastErr = `upstream ${res.status}`
    if (res.status !== 429 && res.status < 500) break
  }
  throw new Error(lastErr)
}
async function fromImdbApi(type, genre, minRating, language, target) {
  const params = { types: IMDB_TYPES[type] ?? [], genres: genre || undefined, languageCodes: language || undefined, minAggregateRating: minRating > 0 ? minRating : undefined, minVoteCount: type === 'tv' ? 4000 : 10000, sortBy: 'SORT_BY_USER_RATING_COUNT', sortOrder: 'DESC' }
  const items = []
  const seen = new Set()
  let pageToken
  for (let page = 0; page < 3 && items.length < target; page++) {
    const data = await imdbFetchPage(params, pageToken)
    for (const t of data.titles || []) { const s = slimImdb(t); if (s && !seen.has(s.id)) { seen.add(s.id); items.push(s) } }
    pageToken = data.nextPageToken
    if (!pageToken) break
  }
  return items.slice(0, target)
}

/* ─────────────────────────────  static fallback  ───────────────────────────── */
function fromFallback(target) {
  return FALLBACK.slice(0, target).map((t) => ({
    id: t.id, imdb: t.id, tmdb: null,
    title: t.title, year: t.year, type: t.type, genres: t.genres, rating: t.rating, votes: t.votes,
    poster: proxied(t.image, 240), posterLarge: proxied(t.image, 680),
  }))
}

/* ─────────────────────────────  handler  ───────────────────────────── */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')

  const q = req.query || {}
  const type = String(q.type || 'all').toLowerCase()
  const genre = q.genre ? String(q.genre) : ''
  const language = q.language ? String(q.language) : ''
  const minRating = Number(q.minRating) || 0
  const target = Math.min(Math.max(Number(q.limit) || 96, 12), 150)
  const kinds = type === 'movie' ? ['movie'] : type === 'tv' ? ['tv'] : ['movie', 'tv']
  const surprise = q.surprise === '1' || q.surprise === 'true' // re-roll a random gem set (TMDB only)

  // Prefer TMDB (genre + type + rating + IMDb links, fast CDN posters); TheTVDB and
  // keyless imdbapi.dev remain as fallbacks behind it.
  const source = process.env.TMDB_KEY ? 'tmdb' : process.env.THETVDB_KEY ? 'tvdb' : 'imdbapi'

  try {
    let items
    if (surprise && source === 'tmdb') items = await fromTmdbSurprise(kinds, target)
    else if (source === 'tvdb') items = await fromTvdb(kinds, genre, target)
    else if (source === 'tmdb') items = await fromTmdb(kinds, genre, minRating, language, target)
    else items = await fromImdbApi(type, genre, minRating, language, target)

    if (!items.length) {
      res.setHeader('Cache-Control', surprise ? 'no-store' : 'public, s-maxage=600')
      res.status(200).json({ count: 0, titles: [], source })
      return
    }
    // A surprise set must never be cached, or the CDN would replay the same "random" globe.
    res.setHeader('Cache-Control', surprise ? 'no-store' : 'public, s-maxage=21600, stale-while-revalidate=86400')
    res.status(200).json({ count: items.length, titles: items, source, surprise: surprise || undefined })
  } catch (err) {
    const out = fromFallback(target)
    res.setHeader('Cache-Control', 'public, s-maxage=30')
    res.status(200).json({ count: out.length, titles: out, source: 'fallback', fallback: true, error: String(err.message || err) })
  }
}
