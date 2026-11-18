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

  // ==========================================
  // 1. ENDPOINT STREAM (BITCHORD V2)
  // ==========================================
  if (rawRoute.includes('stream') || rawRoute.includes('play')) {
    const hiresMatch = rawRoute.match(/(hires:[A-Za-z0-9_-]+)/);
    const idParam = req.query?.id || (hiresMatch ? hiresMatch[1] : '');

    let title = '';
    let artist = '';
    let previewUrl = '';

    try {
      if (idParam.startsWith('hires:')) {
        const payload = JSON.parse(
          Buffer.from(idParam.replace('hires:', ''), 'base64url').toString('utf8')
        );
        title = payload.t || '';
        artist = payload.a || '';
        previewUrl = payload.u || '';
      }
    } catch (_) {}

    const streams = [];

    // Ambil aliran Hi-Res Lossless FLAC (24-Bit / 16-Bit) dari node lossless publik
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
                    quality: 'lossless',
                    format: 'flac',
                    bitDepth: 24,
                    sampleRate: 96000,
                    bitrate: 1411,
                    mimeType: 'audio/flac',
                    name: 'Hi-Res Lossless (FLAC)',
                    title: `${title} - ${artist} • Master Lossless`
                  });
                  break;
                }
              }
            }
          }
        } catch (_) {}
      }
    }

    // Stream cadangan langsung AAC/M4A agar selalu bisa diputar
    if (previewUrl) {
      streams.push({
        url: previewUrl,
        quality: 'high',
        format: 'm4a',
        bitDepth: 16,
        sampleRate: 44100,
        bitrate: 256,
        mimeType: 'audio/mp4',
        name: 'Direct Stream (AAC)',
        title: `${title} - ${artist} • Direct Audio`
      });
    }

    const best = streams[0] || {
      url: previewUrl,
      quality: 'high',
      format: 'm4a',
      mimeType: 'audio/mp4'
    };

    return res.status(200).json({
      url: best.url,
      streamUrl: best.url,
      quality: best.quality,
      format: best.format,
      bitDepth: best.bitDepth || 16,
      sampleRate: best.sampleRate || 44100,
      mimeType: best.mimeType,
      streams
    });
  }

  // ==========================================
  // 2. ENDPOINT SEARCH (SPESIFIKASI BITCHORD V2)
  // ==========================================
  let query =
    req.query?.q ||
    req.query?.query ||
    req.query?.search ||
    req.query?.term ||
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
      const album = track.collectionName || 'Single';
      const cover =
        (track.artworkUrl100 || '').replace('100x100bb', '600x600bb') ||
        'https://dummyimage.com/500x500/0b0d12/00e5ff.png&text=HI-RES';
      const durationSec = Math.round((track.trackTimeMillis || 0) / 1000);

      const encodedPayload = Buffer.from(
        JSON.stringify({
          t: title,
          a: artist,
          al: album,
          c: cover,
          u: track.previewUrl || ''
        })
      ).toString('base64url');

      const trackId = `hires:${encodedPayload}`;

      return {
        id: trackId,
        title: title,
        name: title,
        artist: artist,
        artistName: artist,
        artists: [
          {
            id: `hires:artist:${encodeURIComponent(artist)}`,
            name: artist
          }
        ],
        album: album,
        albumName: album,
        albumId: `hires:album:${track.collectionId || encodeURIComponent(album)}`,
        trackNumber: track.trackNumber || 1,
        discNumber: track.discNumber || 1,
        duration: durationSec,
        durationMs: track.trackTimeMillis || durationSec * 1000,
        cover: cover,
        coverUrl: cover,
        artwork: cover,
        artworkUrl: cover,
        thumbnail: cover,
        quality: 'lossless',
        isLossless: true,
        explicit: track.trackExplicitness === 'explicit'
      };
    });

    // Susun daftar album & artis unik dari hasil lagu untuk tab Albums / Artists di BitChord
    const albumMap = new Map();
    const artistMap = new Map();

    for (const tr of tracks) {
      if (!albumMap.has(tr.albumId)) {
        albumMap.set(tr.albumId, {
          id: tr.albumId,
          title: tr.album,
          name: tr.album,
          artist: tr.artist,
          artistName: tr.artist,
          cover: tr.cover,
          coverUrl: tr.cover,
          artwork: tr.cover,
          artworkUrl: tr.cover
        });
      }
      const artistId = `hires:artist:${encodeURIComponent(tr.artist)}`;
      if (!artistMap.has(artistId)) {
        artistMap.set(artistId, {
          id: artistId,
          name: tr.artist,
          title: tr.artist,
          cover: tr.cover,
          coverUrl: tr.cover,
          artwork: tr.cover,
          artworkUrl: tr.cover
        });
      }
    }

    return res.status(200).json({
      tracks,
      albums: Array.from(albumMap.values()),
      artists: Array.from(artistMap.values()),
      results: tracks,
      items: tracks
    });
  } catch (err) {
    return res.status(200).json({
      tracks: [],
      albums: [],
      artists: [],
      results: [],
      items: [],
      error: err.message
    });
  }
}

module.exports = handler;
        
