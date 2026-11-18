async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const rawRoute = decodeURIComponent(req.query?.route || req.url || '');
  console.log('BITCHORD_CALL:', req.method, rawRoute, JSON.stringify(req.query));

  // 1. STREAM / PLAY
  if (rawRoute.includes('stream') || rawRoute.includes('play') || rawRoute.includes('track/')) {
    const hiresMatch = rawRoute.match(/(hires:[A-Za-z0-9_-]+)/);
    const rawId = hiresMatch ? hiresMatch[1] : '';

    let title = '';
    let artist = '';
    let previewUrl = '';

    try {
      if (rawId.startsWith('hires:')) {
        const payload = JSON.parse(
          Buffer.from(rawId.replace('hires:', ''), 'base64url').toString('utf8')
        );
        title = payload.t || '';
        artist = payload.a || '';
        previewUrl = payload.u || '';
      }
    } catch (_) {}

    const streams = [];

    if (title && artist) {
      const nodes = ['https://triton.squid.wtf', 'https://api.monochrome.tf'];
      for (const node of nodes) {
        try {
          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), 3500);
          const sRes = await fetch(
            `${node}/search/?s=${encodeURIComponent(`${title} ${artist}`)}`,
            { signal: ctrl.signal }
          );
          clearTimeout(timer);

          if (sRes.ok) {
            const sJson = await sRes.json();
            const items = sJson?.data?.items || sJson?.items || [];
            if (items.length > 0) {
              const tRes = await fetch(
                `${node}/track/?id=${items[0].id}&quality=HI_RES_LOSSLESS`
              );
              if (tRes.ok) {
                const tJson = await tRes.json();
                let flacUrl = tJson?.data?.url || tJson?.url || null;
                if (!flacUrl && tJson?.data?.manifest) {
                  const man = JSON.parse(
                    Buffer.from(tJson.data.manifest, 'base64').toString('utf8')
                  );
                  flacUrl = man?.urls?.[0] || null;
                }
                if (flacUrl) {
                  streams.push({
                    name: 'Hi-Res Lossless (FLAC)',
                    title: `${title} - ${artist} • Master Lossless`,
                    quality: 'HI_RES_LOSSLESS',
                    format: 'FLAC',
                    url: flacUrl
                  });
                  break;
                }
              }
            }
          }
        } catch (_) {}
      }
    }

    if (previewUrl) {
      streams.push({
        name: 'Hi-Res Direct Stream',
        title: `${title} - ${artist} • Direct Audio`,
        quality: 'HIGH',
        format: 'M4A',
        url: previewUrl
      });
    }

    const primaryUrl = streams[0]?.url || previewUrl || '';

    return res.status(200).json({
      url: primaryUrl,
      streamUrl: primaryUrl,
      streams
    });
  }

  // 2. SEARCH / CATALOG / FALLBACK DEFAULT
  let query = req.query?.q || req.query?.query || req.query?.search || req.query?.term || '';

  if (!query && rawRoute) {
    const eqMatch = rawRoute.match(/search=([^&.?/]+)/i);
    if (eqMatch) {
      query = eqMatch[1];
    } else {
      const cleanRoute = rawRoute.split('?')[0].replace(/\.json$/i, '');
      const segments = cleanRoute.split('/').filter(Boolean);
      const last = segments[segments.length - 1] || '';
      const ignored = ['search', 'catalog', 'track', 'tracks', 'music', 'album', 'artist', 'hires-top', 'api', 'index.js'];
      if (last && !ignored.includes(last.toLowerCase())) {
        query = last;
      }
    }
  }

  const searchTerm = (query || 'Tulus').trim();

  try {
    const apiRes = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(searchTerm)}&media=music&entity=song&limit=25`
    );
    const data = await apiRes.json();

    const items = (data.results || []).map((track) => {
      const artist = track.artistName || 'Unknown Artist';
      const title = track.trackName || 'Unknown Title';
      const album = track.collectionName || '';
      const cover = (track.artworkUrl100 || '')
        .replace('100x100bb', '600x600bb') ||
        'https://dummyimage.com/500x500/0b0d12/00e5ff.png&text=HI-RES';

      const encodedPayload = Buffer.from(
        JSON.stringify({
          t: title,
          a: artist,
          al: album,
          c: cover,
          u: track.previewUrl || ''
        })
      ).toString('base64url');

      const itemId = `hires:${encodedPayload}`;

      return {
        id: itemId,
        type: 'track',
        name: title,
        title,
        artist,
        artists: [artist],
        album,
        duration: Math.round((track.trackTimeMillis || 0) / 1000),
        poster: cover,
        cover,
        artwork: cover,
        thumbnail: cover,
        image: cover,
        streamUrl: track.previewUrl || '',
        url: track.previewUrl || '',
        posterShape: 'square',
        description: `${artist}${album ? ` • ${album}` : ''}`
      };
    });

    return res.status(200).json({
      tracks: items,
      results: items,
      metas: items,
      data: items,
      items
    });
  } catch (err) {
    return res.status(200).json({
      tracks: [],
      results: [],
      metas: [],
      data: [],
      error: err.message
    });
  }
}

module.exports = handler;
