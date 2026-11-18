export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const url = req.url || '';
  const queryMatch =
    url.match(/[?&](?:q|query|search)=([^&]+)/i) ||
    url.match(/search=([^&.]+)/i);
  const query = queryMatch ? decodeURIComponent(queryMatch[1]).trim() : '';

  if (!query) {
    return res.status(200).json({ metas: [], results: [], tracks: [] });
  }

  try {
    // Mengambil katalog lagu asli via Deezer Public Search API (tanpa API key, cepat & akurat)
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

      // Encode artist & title ke dalam ID agar stream.js bisa mencocokkan file FLAC-nya
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
        description: `${title} • ${artist}${album ? ` (${album})` : ''} • Hi-Res Lossless Ready`
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
