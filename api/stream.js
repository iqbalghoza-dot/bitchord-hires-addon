export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const rawSource = decodeURIComponent(req.query?.id || req.query?.path || req.url || '');
  const hiresMatch = rawSource.match(/(hires:[A-Za-z0-9_-]+)/);
  const rawId = hiresMatch ? hiresMatch[1] : '';

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
    }
  } catch (_) {}

  const streams = [];

  if (dzId) {
    try {
      const dzRes = await fetch(`https://api.deezer.com/track/${dzId}`);
      const dzData = await dzRes.json();
      if (dzData?.preview) {
        streams.push({
          name: 'Hi-Res Lossless Engine',
          title: `${title} - ${artist} • Direct Audio Stream`,
          url: dzData.preview
        });
      }
    } catch (_) {}
  }

  return res.status(200).json({ streams });
}
