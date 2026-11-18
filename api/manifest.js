export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');

  res.status(200).json({
    id: "com.bitchord.addon.hires-lossless",
    name: "Bitchord Hi-Res Lossless Engine",
    version: "1.0.0",
    description: "24-bit / 192kHz Lossless Audio Decoder & Bit-Perfect DSP Addon",
    capabilities: [
      "audio/flac",
      "audio/wav",
      "audio/alac",
      "dsp:bit-perfect",
      "dsp:32bit-float"
    ],
    endpoints: {
      ui: "/",
      dspWorklet: "/worklet-dsp.js"
    }
  });
}
