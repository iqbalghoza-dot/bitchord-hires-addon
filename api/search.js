export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const rawUrl = decodeURIComponent(req.url || '');
  const queryParam = req.query?.q || req.query?.query || req.query?.search || '';

  let query = queryParam;

  if (!query) {
    // Ekstrak dari pola seperti /search/music/judullagu.json atau search=judullagu
    const searchEqMatch = rawUrl.match(/search=([^&./]+)/i);
    const pathMatch = rawUrl.match(/\/(?:search|catalog)\/(?:[^/]+\/)?([^/?]+?)(?:\.json)?(?:\?|$)/i);

    if (searchEqMatch) {
      query = searchEqMatch[1];
    } else if (pathMatch && pathMatch[1] !== 'hires-search') {
      query = pathMatch[1];
    }
  }

  query = (query || '').replace(/\.json$/i, '').trim();

  if (!query) {
    return res.status(200).json({ metas: [], results: [], tracks: [] });
  }

  try {
    const apiRes = await fetch(
      `https://api.deezer.com/search/track?q=${encodeURIComponent(query)}&limit=20`
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
        type: 'music',
        name: `${title} - ${artist}`,
        title: title,
        artist: artist,
        album: album,
        duration: track.duration,
        poster: cover,
        posterShape: 'square',
        description: `${title} • ${artist}${album ? ` (${album})` : ''}`
      };
    });

    return res.status(200).json({
      metas: items,
      results: items,
      tracks: items
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
