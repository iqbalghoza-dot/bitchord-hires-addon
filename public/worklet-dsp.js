class HiResLosslessProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bitPerfect = true;
    this.gain = 1.0;

    this.port.onmessage = (event) => {
      if (event.data.type === 'SET_BIT_PERFECT') {
        this.bitPerfect = event.data.value;
      }
      if (event.data.type === 'SET_GAIN') {
        this.gain = event.data.value;
      }
    };
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];

    if (!input || !input.length) return true;

    for (let channel = 0; channel < input.length; channel++) {
      const inputChannel = input[channel];
      const outputChannel = output[channel];

      if (this.bitPerfect) {
        // Bit-perfect direct memory copy (tanpa modifikasi sinyal)
        outputChannel.set(inputChannel);
      } else {
        // 32-bit floating point gain staging
        for (let i = 0; i < inputChannel.length; i++) {
          outputChannel[i] = inputChannel[i] * this.gain;
        }
      }
    }

    return true;
  }
}

registerProcessor('hires-lossless-processor', HiResLosslessProcessor);
