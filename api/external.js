// /api/external — resolve a TMDB id to its IMDb id, on demand.
//
// TMDB's discover results don't include IMDb ids, so the focus card calls this when a
// poster is opened to point its "View on IMDb" button at the right title. One small
// request per click (cached a day), rather than N requests up front.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 'public, max-age=86400')

  const id = String(req.query?.id || '').replace(/\D/g, '')
  const type = String(req.query?.type || 'movie') === 'tv' ? 'tv' : 'movie'
  const key = process.env.TMDB_KEY || ''
  if (!id || !key) { res.status(200).json({ imdb: null }); return }

  try {
    const url = new URL(`https://api.themoviedb.org/3/${type}/${id}/external_ids`)
    const headers = { accept: 'application/json' }
    if (key.includes('.')) headers.Authorization = `Bearer ${key}`
    else url.searchParams.set('api_key', key)
    const r = await fetch(url, { headers, signal: AbortSignal.timeout(4500) })
    const d = await r.json()
    res.status(200).json({ imdb: d.imdb_id || null })
  } catch {
    res.status(200).json({ imdb: null })
  }
}
