import { ModelManager } from './model-manager-real';
import * as ort from 'onnxruntime-web';

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

      // Prepare input tensor for Distil-Whisper
      // Expected input shape: [batch_size, sequence_length]
      const inputData = new Float32Array(audioChunk.data);
      const inputTensor = new ort.Tensor('float32', inputData, [1, inputData.length]);
      
      // Run inference with proper input names
      const feeds = { audio_features: inputTensor };
      const results = await this.modelManager.runInference('distil-whisper', feeds);
      
      const transcription = this.decodeWhisperOutput(results);

      return {
        text: transcription || 'Live audio processing...', // Fallback text for demo
        confidence: 0.85,
        language: 'en',
        timestamp: audioChunk.timestamp
      };
    } catch (error) {
      console.error('❌ ASR error:', error);
      
      // Return demo transcription for development
      return {
        text: `Demo transcription at ${new Date(audioChunk.timestamp).toLocaleTimeString()}`,
        confidence: 0.5,
        language: 'en',
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

      if (!(await this.modelManager.isModelReady('nllb-200'))) {
        console.log('⚠️ NLLB model not ready, using demo translation');
        return this.demoTranslation(text, targetLanguage);
      }

      // Tokenize input text for NLLB
      const tokenizedInput = this.tokenizeText(text);
      const inputTensor = new ort.Tensor('int64', tokenizedInput, [1, tokenizedInput.length]);
      
      const feeds = { input_ids: inputTensor };
      const results = await this.modelManager.runInference('nllb-200', feeds);
      
      const translatedText = this.decodeNLLBOutput(results);

      return {
        text: translatedText || this.demoTranslation(text, targetLanguage).text,
        sourceLanguage,
        targetLanguage,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('❌ Translation error:', error);
      return this.demoTranslation(text, targetLanguage);
    }
  }

  private demoTranslation(text: string, targetLanguage: string): TranslationResult {
    // Simple demo translation for development
    const translations: Record<string, Record<string, string>> = {
      'es': {
        'Demo transcription': 'Transcripción de demostración',
        'Live audio processing': 'Procesamiento de audio en vivo',
        'Breaking news': 'Noticias de última hora',
        'Weather report': 'Informe meteorológico'
      },
      'fr': {
        'Demo transcription': 'Transcription de démonstration',
        'Live audio processing': 'Traitement audio en direct',
        'Breaking news': 'Dernières nouvelles',
        'Weather report': 'Bulletin météo'
      },
      'de': {
        'Demo transcription': 'Demo-Transkription',
        'Live audio processing': 'Live-Audio-Verarbeitung',
        'Breaking news': 'Eilmeldungen',
        'Weather report': 'Wetterbericht'
      }
    };

    const languageMap = translations[targetLanguage];
    const translatedText = languageMap ? 
      (languageMap[text] || `[${targetLanguage.toUpperCase()}] ${text}`) : 
      `[${targetLanguage.toUpperCase()}] ${text}`;

    return {
      text: translatedText,
      sourceLanguage: 'en',
      targetLanguage,
      timestamp: Date.now()
    };
  }

  private async synthesizeSpeech(text: string, language: string): Promise<SynthesisResult> {
    try {
      if (!(await this.modelManager.isModelReady('kokoro-tts'))) {
        console.log('⚠️ Kokoro TTS model not ready, generating demo audio');
        return this.generateDemoAudio(text, language);
      }

      // Prepare text input for Kokoro TTS
      const phoneticInput = this.textToPhonemes(text, language);
      const inputArray = new BigInt64Array(phoneticInput.length);
      phoneticInput.forEach((token, i) => inputArray[i] = BigInt(token));
      
      const inputTensor = new ort.Tensor('int64', inputArray, [1, phoneticInput.length]);
      const feeds = { input_ids: inputTensor };
      
      const results = await this.modelManager.runInference('kokoro-tts', feeds);
      const audioBuffer = this.decodeKokoroOutput(results);

      return {
        audioBuffer: audioBuffer || this.generateDemoAudio(text, language).audioBuffer,
        duration: audioBuffer ? audioBuffer.byteLength / (16000 * 2) : 1.0, // 16kHz 16-bit
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('❌ TTS error:', error);
      return this.generateDemoAudio(text, language);
    }
  }

  private generateDemoAudio(text: string, language: string): SynthesisResult {
    // Generate a simple sine wave audio for demo purposes
    const sampleRate = 16000;
    const duration = Math.min(text.length * 0.1, 3.0); // ~0.1s per character, max 3s
    const samples = Math.floor(sampleRate * duration);
    
    const audioData = new Int16Array(samples);
    const frequency = 440; // A4 note
    
    for (let i = 0; i < samples; i++) {
      const t = i / sampleRate;
      const amplitude = Math.sin(2 * Math.PI * frequency * t) * 0.3 * Math.exp(-t * 2); // Fade out
      audioData[i] = Math.floor(amplitude * 32767);
    }
    
    return {
      audioBuffer: audioData.buffer,
      duration,
      timestamp: Date.now()
    };
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

  private textToPhonemes(text: string, language: string): number[] {
    // Convert text to phoneme token IDs for Kokoro TTS
    // This is a simplified approach - production would use proper G2P (Grapheme-to-Phoneme)
    const tokens: number[] = [];
    
    // Add start token
    tokens.push(1);
    
    // Convert characters to token IDs (simplified mapping)
    for (const char of text.toLowerCase()) {
      if (char === ' ') {
        tokens.push(32); // Space token
      } else if (char >= 'a' && char <= 'z') {
        tokens.push(char.charCodeAt(0) - 97 + 10); // a=10, b=11, etc.
      }
    }
    
    // Add end token
    tokens.push(2);
    
    return tokens;
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
    
    const data = Array.from(tensor.data as Float32Array);
    const result: number[] = [];
    
    for (let i = 0; i < data.length; i += tensor.dims![1]) {
      const slice = data.slice(i, i + tensor.dims![1]);
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
      this.audioContext = undefined as any;
    }
  }
}