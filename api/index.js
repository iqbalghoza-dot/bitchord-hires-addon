module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const rawUrl = decodeURIComponent(
    req.headers['x-invoke-path'] ||
    req.headers['x-matched-path'] ||
    req.url ||
    ''
  );
  const cleanUrl = rawUrl.split('?')[0];

  // ==========================================
  // 1. ENDPOINT STREAM (PEMUTAR AUDIO)
  // ==========================================
  if (cleanUrl.startsWith('/stream/') || rawUrl.includes('/stream/')) {
    const hiresMatch = rawUrl.match(/(hires:[A-Za-z0-9_-]+)/);
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

    // Coba ambil FLAC Lossless 24-Bit/16-Bit dari server lossless
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

    // Stream cadangan langsung dari Apple/iTunes AAC
    if (previewUrl) {
      streams.push({
        name: 'Hi-Res Direct Stream',
        title: `${title} - ${artist} • Direct Audio`,
        url: previewUrl
      });
    }

    return res.status(200).json({ streams });
  }

  // ==========================================
  // 2. ENDPOINT META (DETAIL LAGU)
  // ==========================================
  if (cleanUrl.startsWith('/meta/') || rawUrl.includes('/meta/')) {
    const hiresMatch = rawUrl.match(/(hires:[A-Za-z0-9_-]+)/);
    const rawId = hiresMatch ? hiresMatch[1] : 'hires:track';

    let title = 'Hi-Res Lossless Track';
    let artist = 'Unknown Artist';
    let poster = 'https://dummyimage.com/500x500/0b0d12/00e5ff.png&text=HI-RES';

    try {
      if (rawId.startsWith('hires:')) {
        const payload = JSON.parse(
          Buffer.from(rawId.replace('hires:', ''), 'base64url').toString('utf8')
        );
        title = payload.t || title;
        artist = payload.a || artist;
        if (payload.c) poster = payload.c;
      }
    } catch (_) {}

    return res.status(200).json({
      meta: {
        id: rawId,
        type: 'track',
        name: `${title} - ${artist}`,
        title,
        artist,
        poster,
        cover: poster,
        posterShape: 'square',
        description: `Hi-Res Lossless Stream • ${title} oleh ${artist}`
      }
    });
  }

  // ==========================================
  // 3. ENDPOINT SEARCH & CATALOG (ITUNES API)
  // ==========================================
  let query = req.query?.q || req.query?.query || req.query?.search || '';

  if (!query) {
    const eqMatch = rawUrl.match(/search=([^&.?/]+)/i);
    if (eqMatch) {
      query = eqMatch[1];
    } else {
      const segments = cleanUrl.replace(/\.json$/i, '').split('/').filter(Boolean);
      const last = segments[segments.length - 1] || '';
      if (last && !['search', 'catalog', 'track', 'music', 'hires-track', 'index.js'].includes(last.toLowerCase())) {
        query = last;
      }
    }
  }

  const searchTerm = (query || 'Tulus').trim();
  const reqType = cleanUrl.includes('/music/') ? 'music' : 'track';

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
          c: cover,
          u: track.previewUrl || ''
        })
      ).toString('base64url');

      const itemId = `hires:${encodedPayload}`;

      return {
        id: itemId,
        type: reqType,
        name: `${title} - ${artist}`,
        title,
        artist,
        artists: [artist],
        album,
        duration: Math.round((track.trackTimeMillis || 0) / 1000),
        poster: cover,
        cover,
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
      items
    });
  } catch (err) {
    return res.status(200).json({
      metas: [],
      results: [],
      tracks: [],
      error: err.message
    });
  }
};
