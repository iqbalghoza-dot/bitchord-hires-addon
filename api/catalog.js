export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const url = req.url || '';
  const match = url.match(/search=([^&.]+)/);
  const query = match ? decodeURIComponent(match[1]) : 'Hi-Res Lossless Demo';

  res.status(200).json({
    metas: [
      {
        id: `hires:${encodeURIComponent(query)}`,
        type: "music",
        name: `${query} (24-Bit / 96kHz FLAC)`,
        poster: "https://dummyimage.com/500x500/0b0d12/00e5ff.png&text=HI-RES+LOSSLESS",
        posterShape: "square",
        description: `Master Lossless Audio untuk pencarian: ${query}`
      }
    ]
  });
}
