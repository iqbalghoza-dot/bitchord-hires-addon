export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');

  res.status(200).json({
    streams: [
      {
        name: "Hi-Res Lossless",
        title: "FLAC / WAV 24-Bit Lossless Audio",
        url: "https://www2.cs.uic.edu/~i101/SoundFiles/BabyElephantWalk60.wav"
      }
    ]
  });
}
