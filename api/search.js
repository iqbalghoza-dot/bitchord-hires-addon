export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const reqType = (req.query?.type || 'track').replace(/\.json$/i, '');
  let query = req.query?.q || req.query?.query || req.query?.search || '';

  if (!query && req.query?.extra) {
    const m = decodeURIComponent(req.query.extra).match(/search=([^&]+)/i);
    if (m) query = m[1];
  }

  if (!query && req.url) {
    const urlDecoded = decodeURIComponent(req.url);
    const m1 = urlDecoded.match(/search=([^&.?/]+)/i);
    const m2 = urlDecoded.match(/\/search\/[^/]+\/([^/?]+?)(?:\.json)?(?:\?|$)/i);
    if (m1) query = m1[1];
    else if (m2) query = m2[1];
  }

  query = (query || '').replace(/\.json$/i, '').trim();
  const searchTerm = query || 'Tulus';

  try {
    const apiRes = await fetch(
      `https://api.deezer.com/search/track?q=${encodeURIComponent(searchTerm)}&limit=25`
    );
    const data = await apiRes.json();

    const items = (data.data || []).map((track) => {
      const artist = track.artist?.name || 'Unknown Artist';
      const title = track.title || 'Unknown Title';
      const album = track.album?.title || '';
      const cover =
        track.album?.cover_xl ||
        track.album?.cover_big ||
        track.album?.cover_medium ||
        'https://dummyimage.com/500x500/0b0d12/00e5ff.png&text=HI-RES';

      const encodedPayload = Buffer.from(
        JSON.stringify({ t: title, a: artist, dz: track.id })
      ).toString('base64url');

      const itemId = `hires:${encodedPayload}`;

      return {
        id: itemId,
        type: reqType === 'music' ? 'music' : 'track',
        name: `${title} - ${artist}`,
        title: title,
        artist: artist,
        artists: [artist],
        album: album,
        duration: track.duration,
        poster: cover,
        cover: cover,
        artwork: cover,
        thumbnail: cover,
        posterShape: 'square',
        description: `${title} • ${artist}${album ? ` (${album})` : ''}`
      };
    });

    return res.status(200).json({
      metas: items,
      results: items,
      tracks: items,
      items: items
    });
  } catch (err) {
    return res.status(200).json({
      metas: [],
      results: [],
      tracks: [],
      error: err.message
    });
  }
}
