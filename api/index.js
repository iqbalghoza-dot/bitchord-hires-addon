async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  let body = {};
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  } catch (_) {}

  const rawRoute = decodeURIComponent(req.query?.route || req.url || '');
  console.log('BITCHORD_CALL:', req.method, rawRoute, JSON.stringify(req.query), JSON.stringify(body));

  // ==========================================
  // 1. ENDPOINT STREAM (BITCHORD V2)
  // ==========================================
  if (rawRoute.includes('stream') || rawRoute.includes('play')) {
    const hiresMatch = rawRoute.match(/(hires_[A-Za-z0-9_-]+)/);
    const idParam = req.query?.id || body?.id || (hiresMatch ? hiresMatch[1] : '');

    let title = '';
    let artist = '';
    let previewUrl = '';

    try {
      if (idParam.startsWith('hires_')) {
        const payload = JSON.parse(
          Buffer.from(idParam.replace('hires_', ''), 'base64url').toString('utf8')
        );
        title = payload.t || '';
        artist = payload.a || '';
        previewUrl = payload.u || '';
      }
    } catch (_) {}

    const streams = [];

    if (title && artist) {
      const nodes = [
        'https://triton.squid.wtf',
        'https://api.monochrome.tf',
        'https://hifi.pnp.workers.dev'
      ];

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
                    url: flacUrl,
                    format: 'flac',
                    audioQuality: 'LOSSLESS',
                    bitDepth: 24,
                    sampleRate: 96000,
                    mimeType: 'audio/flac'
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
        url: previewUrl,
        format: 'm4a',
        audioQuality: 'HIGH',
        bitDepth: 16,
        sampleRate: 44100,
        mimeType: 'audio/mp4'
      });
    }

    const best = streams[0] || {
      url: previewUrl,
      format: 'm4a',
      audioQuality: 'HIGH',
      mimeType: 'audio/mp4'
    };

    return res.status(200).json({
      url: best.url,
      format: best.format,
      audioQuality: best.audioQuality,
      bitDepth: best.bitDepth || 16,
      sampleRate: best.sampleRate || 44100,
      mimeType: best.mimeType,
      streams
    });
  }

  // ==========================================
  // 2. ENDPOINT SEARCH (GET & POST BITCHORD V2)
  // ==========================================
  let query =
    req.query?.q ||
    req.query?.query ||
    req.query?.search ||
    req.query?.term ||
    body?.q ||
    body?.query ||
    body?.search ||
    body?.term ||
    '';

  if (!query && rawRoute) {
    const eqMatch = rawRoute.match(/(?:q|query|search)=([^&.?/]+)/i);
    if (eqMatch) {
      query = eqMatch[1];
    } else {
      const cleanRoute = rawRoute.split('?')[0].replace(/\.json$/i, '');
      const segments = cleanRoute.split('/').filter(Boolean);
      const last = segments[segments.length - 1] || '';
      const ignored = [
        'v1', 'v2', 'search', 'catalog', 'track', 'tracks',
        'music', 'album', 'albums', 'artist', 'artists', 'api', 'index.js'
      ];
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

    const tracks = (data.results || []).map((track) => {
      const artist = track.artistName || 'Unknown Artist';
      const title = track.trackName || 'Unknown Title';
      const album = track.collectionName || '';
      const cover =
        (track.artworkUrl100 || '').replace('100x100bb', '600x600bb') ||
        'https://dummyimage.com/500x500/0b0d12/00e5ff.png&text=HI-RES';
      const duration = Math.round(((track.trackTimeMillis || 0) / 1000) * 10) / 10;

      const encodedPayload = Buffer.from(
        JSON.stringify({
          t: title,
          a: artist,
          al: album,
          c: cover,
          u: track.previewUrl || ''
        })
      ).toString('base64url');

      return {
        id: `hires_${encodedPayload}`,
        title,
        artist,
        album,
        duration,
        artworkURL: cover,
        format: 'flac',
        audioQuality: 'LOSSLESS',
        source: 'hires-lossless'
      };
    });

    return res.status(200).json({ tracks });
  } catch (err) {
    return res.status(200).json({ tracks: [] });
  }
}

module.exports = handler;
