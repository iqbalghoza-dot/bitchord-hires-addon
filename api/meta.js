export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const url = req.url || '';
  const idMatch = url.match(/\/meta\/music\/([^.]+)\.json/);
  const rawId = idMatch ? decodeURIComponent(idMatch[1]) : 'hires:Lossless';
  const title = rawId.replace(/^hires:/, '');

  res.status(200).json({
    meta: {
      id: rawId,
      type: "music",
      name: `${title} (24-Bit Lossless)`,
      poster: "https://dummyimage.com/500x500/0b0d12/00e5ff.png&text=HI-RES+LOSSLESS",
      posterShape: "square",
      description: "Bit-Perfect PCM / FLAC Lossless Stream"
    }
  });
}
