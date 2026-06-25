// /api/details — full detail for one TMDB title, fetched when its poster is opened.
//
// The /api/titles list is deliberately slim (no synopsis, no IMDb id, no streaming info),
// so the focus card calls this once per open to enrich itself. A single TMDB request with
// append_to_response pulls the overview, the IMDb id (for the "View on IMDb" button) and the
// JustWatch "where to watch" providers together. Only TMDB-sourced items have a tmdb id;
// other sources degrade gracefully (the card just shows what the list already had).

const TMDB = 'https://api.themoviedb.org/3'
const LOGO = 'https://image.tmdb.org/t/p/w92' // CORS-enabled provider logos, load directly

function mapProviders(buckets) {
  // Prefer streaming (subscription / free / ad-supported) over rent/buy, dedupe, keep TMDB's order.
  const seen = new Set()
  const out = []
  for (const key of ['flatrate', 'free', 'ads', 'rent', 'buy']) {
    for (const p of buckets?.[key] || []) {
      if (seen.has(p.provider_id)) continue
      seen.add(p.provider_id)
      out.push({ id: p.provider_id, name: p.provider_name, logo: p.logo_path ? `${LOGO}${p.logo_path}` : null, priority: p.display_priority ?? 99 })
    }
  }
  return out.sort((a, b) => a.priority - b.priority).slice(0, 8)
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800')

  const id = String(req.query?.id || '').replace(/\D/g, '')
  const type = String(req.query?.type || 'movie') === 'tv' ? 'tv' : 'movie'
  const region = /^[A-Za-z]{2}$/.test(req.query?.region || '') ? String(req.query.region).toUpperCase() : 'US'
  const key = process.env.TMDB_KEY || ''
  const empty = { imdb: null, overview: '', providers: [], providerLink: null, region }
  if (!id || !key) { res.status(200).json(empty); return }

  try {
    const url = new URL(`${TMDB}/${type}/${id}`)
    url.searchParams.set('append_to_response', 'external_ids,watch/providers')
    const headers = { accept: 'application/json' }
    if (key.includes('.')) headers.Authorization = `Bearer ${key}`
    else url.searchParams.set('api_key', key)

    // Retry transient throttling/slowness (429, 5xx, aborted timeouts). TMDB rate-limits bursts of
    // detail opens; without a retry a throttled request returns an empty card — the synopsis and
    // "where to watch" silently vanish even for titles TMDB clearly has data for.
    let d, lastErr = 'tmdb error'
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt) await new Promise((wait) => setTimeout(wait, 300 * attempt))
      let r
      try { r = await fetch(url, { headers, signal: AbortSignal.timeout(4000) }) }
      catch (e) { lastErr = String(e.message || e); continue } // timeout/network → retry
      if (r.ok) { d = await r.json(); break }
      lastErr = `tmdb ${r.status}`
      if (r.status !== 429 && r.status < 500) break // non-throttle 4xx won't change on retry
    }
    if (!d) throw new Error(lastErr)

    const wp = d['watch/providers']?.results?.[region] || d['watch/providers']?.results?.US || null
    res.status(200).json({
      imdb: d.external_ids?.imdb_id || null,
      overview: d.overview || '',
      providers: wp ? mapProviders(wp) : [],
      providerLink: wp?.link || null,
      region,
    })
  } catch {
    res.setHeader('Cache-Control', 'no-store') // a transient failure must not be cached as a 24h-empty card
    res.status(200).json(empty)
  }
}
