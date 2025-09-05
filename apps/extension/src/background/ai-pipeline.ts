import { ModelManager } from './model-manager';

interface AudioChunk {
  data: Float32Array;
  timestamp: number;
  sampleRate: number;
}

interface TranscriptionResult {
  text: string;
  confidence: number;
  language: string;
  timestamp: number;
}

interface TranslationResult {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
  timestamp: number;
}

interface SynthesisResult {
  audioBuffer: ArrayBuffer;
  duration: number;
  timestamp: number;
}

export class AIPipeline {
  private modelManager: ModelManager;
  private audioContext?: AudioContext;
  private workletNode?: AudioWorkletNode;
  private isProcessing = false;

  constructor(modelManager: ModelManager) {
    this.modelManager = modelManager;
  }

  async initialize(): Promise<void> {
    try {
      this.audioContext = new AudioContext({ sampleRate: 16000 });
      
      await this.audioContext.audioWorklet.addModule('/workers/audio-processor.js');
      
      this.workletNode = new AudioWorkletNode(this.audioContext, 'audio-processor');
      this.workletNode.port.onmessage = (event) => {
        this.handleAudioChunk(event.data);
      };
      
      console.log('✅ AI Pipeline initialized');
    } catch (error) {
      console.error('❌ Failed to initialize AI Pipeline:', error);
      throw error;
    }
  }

  async startProcessing(
    audioStream: MediaStream,
    sourceLanguage: string,
    targetLanguage: string
  ): Promise<MediaStream> {
    if (this.isProcessing) {
      throw new Error('Pipeline already processing');
    }

    if (!this.audioContext || !this.workletNode) {
      await this.initialize();
    }

    try {
      const source = this.audioContext!.createMediaStreamSource(audioStream);
      source.connect(this.workletNode!);

      const outputStream = this.audioContext!.createMediaStreamDestination();
      this.workletNode!.connect(outputStream);

      this.isProcessing = true;
      
      this.workletNode!.port.postMessage({
        command: 'start',
        sourceLanguage,
        targetLanguage
      });

      console.log(`🎯 AI Pipeline started: ${sourceLanguage} → ${targetLanguage}`);
      
      return outputStream.stream;
    } catch (error) {
      console.error('❌ Failed to start AI processing:', error);
      throw error;
    }
  }

  async stopProcessing(): Promise<void> {
    if (!this.isProcessing) {
      return;
    }

    try {
      if (this.workletNode) {
        this.workletNode.port.postMessage({ command: 'stop' });
        this.workletNode.disconnect();
      }

      this.isProcessing = false;
      console.log('🛑 AI Pipeline stopped');
    } catch (error) {
      console.error('Error stopping AI pipeline:', error);
    }
  }

  private async handleAudioChunk(audioChunk: AudioChunk): Promise<void> {
    if (!this.isProcessing) {
      return;
    }

    try {
      const transcription = await this.transcribeAudio(audioChunk);
      
      if (transcription.text.trim().length === 0) {
        return;
      }

      const translation = await this.translateText(
        transcription.text,
        transcription.language,
        'en' // TODO: Get from session config
      );

      const synthesis = await this.synthesizeSpeech(
        translation.text,
        translation.targetLanguage
      );

      this.workletNode?.port.postMessage({
        type: 'synthesized-audio',
        data: synthesis.audioBuffer,
        timestamp: synthesis.timestamp
      });

    } catch (error) {
      console.error('Error in AI pipeline:', error);
    }
  }

  private async transcribeAudio(audioChunk: AudioChunk): Promise<TranscriptionResult> {
    try {
      if (!(await this.modelManager.isModelReady('distil-whisper'))) {
        throw new Error('Whisper model not ready');
      }

      const model = await this.modelManager.getModel('distil-whisper');
      
      const inputTensor = new Float32Array(audioChunk.data);
      const feeds = { audio: inputTensor };
      
      const results = await model.run(feeds);
      const transcription = this.decodeWhisperOutput(results);

      return {
        text: transcription,
        confidence: 0.85, // Placeholder
        language: 'auto', // Auto-detected
        timestamp: audioChunk.timestamp
      };
    } catch (error) {
      console.error('ASR error:', error);
      return {
        text: '',
        confidence: 0,
        language: 'unknown',
        timestamp: audioChunk.timestamp
      };
    }
  }

  private async translateText(
    text: string,
    sourceLanguage: string,
    targetLanguage: string
  ): Promise<TranslationResult> {
    try {
      if (sourceLanguage === targetLanguage) {
        return {
          text,
          sourceLanguage,
          targetLanguage,
          timestamp: Date.now()
        };
      }

      if (!(await this.modelManager.isModelReady('nllb-distilled'))) {
        throw new Error('NLLB model not ready');
      }

      const model = await this.modelManager.getModel('nllb-distilled');
      
      const tokenizedInput = this.tokenizeText(text);
      const feeds = { input_ids: tokenizedInput };
      
      const results = await model.run(feeds);
      const translatedText = this.decodeNLLBOutput(results);

      return {
        text: translatedText,
        sourceLanguage,
        targetLanguage,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Translation error:', error);
      return {
        text,
        sourceLanguage,
        targetLanguage,
        timestamp: Date.now()
      };
    }
  }

  private async synthesizeSpeech(text: string, language: string): Promise<SynthesisResult> {
    try {
      if (!(await this.modelManager.isModelReady('kokoro-82m'))) {
        throw new Error('Kokoro model not ready');
      }

      const model = await this.modelManager.getModel('kokoro-82m');
      
      const phoneticInput = this.textToPhonemes(text, language);
      const feeds = { text: phoneticInput };
      
      const results = await model.run(feeds);
      const audioBuffer = this.decodeKokoroOutput(results);

      return {
        audioBuffer,
        duration: audioBuffer.byteLength / (16000 * 2), // 16kHz 16-bit
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('TTS error:', error);
      
      return {
        audioBuffer: new ArrayBuffer(0),
        duration: 0,
        timestamp: Date.now()
      };
    }
  }

  private decodeWhisperOutput(results: any): string {
    try {
      const logits = results.logits;
      const tokenIds = this.argmax(logits);
      return this.decodeTokenIds(tokenIds);
    } catch (error) {
      console.error('Error decoding Whisper output:', error);
      return '';
    }
  }

  private decodeNLLBOutput(results: any): string {
    try {
      const logits = results.logits;
      const tokenIds = this.argmax(logits);
      return this.decodeTokenIds(tokenIds);
    } catch (error) {
      console.error('Error decoding NLLB output:', error);
      return '';
    }
  }

  private decodeKokoroOutput(results: any): ArrayBuffer {
    try {
      const audioTensor = results.audio;
      const float32Audio = new Float32Array(audioTensor.data);
      
      const int16Audio = new Int16Array(float32Audio.length);
      for (let i = 0; i < float32Audio.length; i++) {
        int16Audio[i] = Math.max(-32768, Math.min(32767, float32Audio[i] * 32767));
      }
      
      return int16Audio.buffer;
    } catch (error) {
      console.error('Error decoding Kokoro output:', error);
      return new ArrayBuffer(0);
    }
  }

  private tokenizeText(text: string): Int32Array {
    const tokens: number[] = [];
    const words = text.split(/\s+/);
    
    for (const word of words) {
      const wordTokens = this.wordToTokens(word);
      tokens.push(...wordTokens);
    }
    
    return new Int32Array(tokens);
  }

  private textToPhonemes(text: string, language: string): string {
    return text.toLowerCase().replace(/[^a-zA-Z\s]/g, '');
  }

  private wordToTokens(word: string): number[] {
    return word.split('').map(char => char.charCodeAt(0));
  }

  private decodeTokenIds(tokenIds: number[]): string {
    return String.fromCharCode(...tokenIds).trim();
  }

  private argmax(tensor: any): number[] {
    if (!tensor || !tensor.data) {
      return [];
    }
    
    const data = Array.from(tensor.data);
    const result: number[] = [];
    
    for (let i = 0; i < data.length; i += tensor.dims[1]) {
      const slice = data.slice(i, i + tensor.dims[1]);
      const maxIndex = slice.indexOf(Math.max(...slice));
      result.push(maxIndex);
    }
    
    return result;
  }

  getProcessingStatus(): boolean {
    return this.isProcessing;
  }

  async cleanup(): Promise<void> {
    await this.stopProcessing();
    
    if (this.audioContext && this.audioContext.state !== 'closed') {
      await this.audioContext.close();
      this.audioContext = undefined;
    }
  }
}