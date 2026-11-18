const LOSSLESS_NODES = [
  'https://triton.squid.wtf',
  'https://api.monochrome.tf',
  'https://hifi.pnp.workers.dev'
];

async function fetchFromLosslessNode(query) {
  for (const node of LOSSLESS_NODES) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4500);

      const searchRes = await fetch(
        `${node}/search/?s=${encodeURIComponent(query)}`,
        { signal: controller.signal }
      );
      clearTimeout(timeout);

      if (!searchRes.ok) continue;
      const searchJson = await searchRes.json();
      const items = searchJson?.data?.items || searchJson?.items || [];
      if (!items.length) continue;

      const trackId = items[0].id;
      const audioQuality = items[0].audioQuality || 'LOSSLESS';

      const trackRes = await fetch(
        `${node}/track/?id=${trackId}&quality=HI_RES_LOSSLESS`
      );
      if (!trackRes.ok) continue;
      const trackJson = await trackRes.json();

      // Ekstrak direct stream URL dari manifest base64 atau properti URL langsung
      let streamUrl = trackJson?.data?.url || trackJson?.url || null;

      if (!streamUrl && trackJson?.data?.manifest) {
        const decodedManifest = JSON.parse(
          Buffer.from(trackJson.data.manifest, 'base64').toString('utf8')
        );
        if (decodedManifest?.urls?.length) {
          streamUrl = decodedManifest.urls[0];
        }
      }

      if (streamUrl) {
        return {
          url: streamUrl,
          quality: audioQuality,
          source: new URL(node).hostname
        };
      }
    } catch (_) {
      // Lanjut ke node cadangan berikutnya jika node sedang sibuk
    }
  }
  return null;
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const url = req.url || '';
  const idMatch = url.match(/\/stream\/[^/]+\/([^.?]+)/);
  const rawId = idMatch ? decodeURIComponent(idMatch[1]) : '';

  let title = '';
  let artist = '';
  let dzId = null;

  try {
    if (rawId.startsWith('hires:')) {
      const payload = JSON.parse(
        Buffer.from(rawId.replace('hires:', ''), 'base64url').toString('utf8')
      );
      title = payload.t || '';
      artist = payload.a || '';
      dzId = payload.dz || null;
    } else {
      title = rawId;
    }
  } catch (_) {
    title = rawId;
  }

  const searchQuery = `${title} ${artist}`.trim();
  const streams = [];

  // 1. Coba ambil aliran Hi-Res Lossless FLAC (24-Bit / 16-Bit PCM)
  if (searchQuery) {
    const lossless = await fetchFromLosslessNode(searchQuery);
    if (lossless && lossless.url) {
      streams.push({
        name: 'Hi-Res Lossless (FLAC)',
        title: `${lossless.quality === 'HI_RES_LOSSLESS' ? '24-Bit / 96kHz+ FLAC' : '16-Bit / 44.1kHz CD FLAC'} • Master Lossless`,
        url: lossless.url,
        behaviorHints: {
          notWebReady: false
        }
      });
    }
  }

  // 2. Cadangan High-Quality Audio Preview/Fallback jika lagu tidak tersedia di katalog FLAC
  if (dzId) {
    try {
      const dzRes = await fetch(`https://api.deezer.com/track/${dzId}`);
      const dzData = await dzRes.json();
      if (dzData?.preview) {
        streams.push({
          name: 'Standard HQ Fallback',
          title: `${title} - ${artist} (Preview / Backup Stream)`,
          url: dzData.preview
        });
      }
    } catch (_) {}
  }

  return res.status(200).json({ streams });
}
