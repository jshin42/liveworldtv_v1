class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    
    this.bufferSize = 4096;
    this.sampleRate = 16000;
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
    this.sourceLanguage = 'auto';
    this.targetLanguage = 'en';
    this.isActive = false;
    
    this.port.onmessage = (event) => {
      this.handleMessage(event.data);
    };
  }

  handleMessage(message) {
    switch (message.command) {
      case 'start':
        this.sourceLanguage = message.sourceLanguage;
        this.targetLanguage = message.targetLanguage;
        this.isActive = true;
        break;
        
      case 'stop':
        this.isActive = false;
        this.bufferIndex = 0;
        break;
        
      case 'synthesized-audio':
        this.injectSynthesizedAudio(message.data);
        break;
    }
  }

  process(inputs, outputs, parameters) {
    if (!this.isActive) {
      return true;
    }

    const input = inputs[0];
    const output = outputs[0];

    if (input.length > 0 && input[0].length > 0) {
      const inputChannel = input[0];
      
      for (let i = 0; i < inputChannel.length; i++) {
        this.buffer[this.bufferIndex] = inputChannel[i];
        this.bufferIndex++;

        if (this.bufferIndex >= this.bufferSize) {
          this.processAudioBuffer();
          this.bufferIndex = 0;
        }
      }

      for (let channel = 0; channel < output.length; channel++) {
        for (let i = 0; i < output[channel].length; i++) {
          output[channel][i] = inputChannel[i] * 0.1;
        }
      }
    }

    return true;
  }

  processAudioBuffer() {
    if (!this.isActive) {
      return;
    }

    const audioChunk = {
      data: new Float32Array(this.buffer),
      timestamp: currentTime * 1000,
      sampleRate: this.sampleRate
    };

    this.port.postMessage({
      type: 'audio-chunk',
      data: audioChunk
    });
  }

  injectSynthesizedAudio(audioBuffer) {
    console.log('Injecting synthesized audio:', audioBuffer.byteLength, 'bytes');
  }
}

registerProcessor('audio-processor', AudioProcessor);