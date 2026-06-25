// /api/poster — CORS image proxy for IMDb / Amazon poster art.
//
// IMDb posters live on m.media-amazon.com, which doesn't send CORS headers, so the
// browser refuses to upload them as WebGL textures (tainted canvas). We fetch the
// image server-side and re-serve it with Access-Control-Allow-Origin + a long cache.
// Locked to Amazon image hosts so this can't be used as an open proxy.

const ALLOWED_HOSTS = new Set([
  'm.media-amazon.com',
  'images-na.ssl-images-amazon.com',
  'ia.media-imdb.com',
  'image.tmdb.org',
  'artworks.thetvdb.com',
])

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')

  const raw = req.query?.u
  if (!raw) {
    res.status(400).json({ error: 'missing ?u' })
    return
  }

  let url
  try {
    url = new URL(String(raw))
  } catch {
    res.status(400).json({ error: 'bad url' })
    return
  }
  if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname)) {
    res.status(400).json({ error: 'host not allowed' })
    return
  }

  try {
    const upstream = await fetch(url, {
      // Some art CDNs (notably artworks.thetvdb.com) stall requests without a browser
      // User-Agent, so send one to keep poster fetches fast and reliable.
      headers: {
        accept: 'image/avif,image/webp,image/*,*/*',
        'user-agent': 'Mozilla/5.0 (compatible; Movorb/1.0; +https://felixjoy.me)',
      },
      signal: AbortSignal.timeout(9000),
    })
    if (!upstream.ok) {
      res.status(502).json({ error: `upstream ${upstream.status}` })
      return
    }
    const buf = Buffer.from(await upstream.arrayBuffer())
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'image/jpeg')
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    res.status(200).send(buf)
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) })
  }
}
