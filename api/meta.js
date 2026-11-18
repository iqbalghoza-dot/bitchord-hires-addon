export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const url = req.url || '';
  const idMatch = url.match(/\/meta\/[^/]+\/([^.?]+)/);
  const rawId = idMatch ? decodeURIComponent(idMatch[1]) : '';

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

      if (payload.dz) {
        const dzRes = await fetch(`https://api.deezer.com/track/${payload.dz}`);
        const dzData = await dzRes.json();
        if (dzData?.album?.cover_xl) poster = dzData.album.cover_xl;
      }
    }
  } catch (_) {}

  return res.status(200).json({
    meta: {
      id: rawId,
      type: 'music',
      name: `${title} - ${artist}`,
      title: title,
      artist: artist,
      poster: poster,
      posterShape: 'square',
      description: `Hi-Res Lossless Stream • ${title} oleh ${artist}`
    }
  });
}
