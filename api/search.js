export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const url = req.url || '';
  const queryMatch = url.match(/[?&](?:q|query|search)=([^&]+)/i) || url.match(/search=([^&.]+)/i);
  const query = queryMatch ? decodeURIComponent(queryMatch[1]) : 'Hi-Res Lossless Demo';

  const item = {
    id: `hires:${encodeURIComponent(query)}`,
    type: "music",
    name: `${query} (24-Bit / 96kHz FLAC)`,
    title: `${query} (24-Bit / 96kHz FLAC)`,
    artist: "Hi-Res Lossless Engine",
    poster: "https://dummyimage.com/500x500/0b0d12/00e5ff.png&text=HI-RES+LOSSLESS",
    posterShape: "square",
    description: `Master Lossless Audio untuk pencarian: ${query}`
  };

  res.status(200).json({
    metas: [item],
    results: [item],
    tracks: [item]
  });
}
