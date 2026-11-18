export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const fullUrl = decodeURIComponent(req.url || '');
  const pathParam = decodeURIComponent(req.query?.path || '');
  let query = req.query?.q || req.query?.query || req.query?.search || '';

  // 1. Cek pola search=kata_kunci (format Stremio/BitChord catalog)
  if (!query) {
    const eqMatch = `${fullUrl} ${pathParam}`.match(/search=([^&./?]+)/i);
    if (eqMatch) query = eqMatch[1];
  }

  // 2. Cek pola /search/track/kata_kunci.json atau /search/music/kata_kunci.json
  if (!query && pathParam) {
    const cleanPath = pathParam.replace(/\.json$/i, '');
    const segments = cleanPath.split('/').filter(Boolean);
    const lastSegment = segments[segments.length - 1] || '';
    if (lastSegment && !['hires-top', 'hires-music', 'track', 'music'].includes(lastSegment.toLowerCase())) {
      query = lastSegment;
    }
  }

  query = (query || '').replace(/\.json$/i, '').trim();

  // Jika query kosong (misalnya baru membuka halaman katalog), tampilkan lagu populer sebagai tes
  const searchTerm = query || 'Daft Punk';

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
        type: 'track',
        name: `${title} - ${artist}`,
        title: title,
        artist: artist,
        album: album,
        duration: track.duration,
        poster: cover,
        cover: cover,
        thumbnail: cover,
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
