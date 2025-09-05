// TTS (Text-to-Speech) Worker  
// Uses Kokoro-82M ONNX model for neural voice synthesis

import { InferenceSession, Tensor } from 'onnxruntime-web';

interface TTSRequest {
  id: string;
  text: string;
  language: string;
  voiceId?: string;
  speed?: number;
}

interface TTSResponse {
  id: string;
  audioData: Float32Array;
  sampleRate: number;
  duration: number;
  processingTime: number;
}

interface TTSError {
  id: string;
  error: string;
}

class TTSWorker {
  private session: InferenceSession | null = null;
  private isInitialized = false;
  private processingQueue: TTSRequest[] = [];
  private isProcessing = false;
  private phonemizer: any = null;

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // Request model data from background script
      const response = await this.sendMessage({ 
        type: 'get-model', 
        modelName: 'kokoro-82m' 
      });
      
      if (!response.success) {
        throw new Error('Kokoro-82M model not available');
      }

      // Create ONNX session optimized for audio generation
      const sessionOptions = {
        executionProviders: ['webgpu', 'wasm'],
        graphOptimizationLevel: 'all' as const,
        enableCpuMemArena: false,
        enableMemPattern: false,
        executionMode: 'sequential' as const, // Sequential for audio generation
        freeDimensionOverrides: {
          'batch_size': 1,
          'max_length': 1024
        }
      };

      this.session = await InferenceSession.create(response.modelData, sessionOptions);
      
      // Initialize phonemizer for text preprocessing
      await this.initializePhonemizer();
      
      this.isInitialized = true;
      
      console.log('✅ TTS Worker initialized with execution providers:', this.session.executionProviders);
      
      // Start processing queue
      this.processQueue();
      
    } catch (error) {
      console.error('❌ TTS Worker initialization failed:', error);
      this.postMessage({ type: 'tts-error', error: `Initialization failed: ${error}` });
    }
  }

  private async initializePhonemizer(): Promise<void> {
    // Simplified phonemizer for text-to-phoneme conversion
    this.phonemizer = {
      // Basic English phoneme mapping
      phonemeMap: {
        'a': 'AH0', 'e': 'EH1', 'i': 'IH0', 'o': 'OW1', 'u': 'UW1',
        'th': 'TH', 'sh': 'SH', 'ch': 'CH', 'ng': 'NG',
        's': 'S', 't': 'T', 'n': 'N', 'r': 'R', 'l': 'L'
      },
      
      textToPhonemes: (text: string, language: string) => {
        // Improved phonemization for better TTS quality
        const words = text.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(w => w.length > 0);
        const phonemes: string[] = ['SIL0']; // Start with silence
        
        words.forEach((word, index) => {
          // Use dictionary lookup for common words, fallback to character mapping
          const wordPhonemes = this.wordToPhonemes(word, language);
          phonemes.push(...wordPhonemes);
          
          // Add pause between words
          if (index < words.length - 1) {
            phonemes.push('SIL1');
          }
        });
        
        phonemes.push('SIL0'); // End with silence
        return phonemes;
      },

      // Enhanced word-to-phoneme mapping for news content
      wordToPhonemes: (word: string, language: string): string[] => {
        // Dictionary of common news words with phonetic representations
        const phonemeDict: { [key: string]: { [lang: string]: string[] } } = {
          'hello': { en: ['HH', 'AH0', 'L', 'OW1'], es: ['OH', 'L', 'AH'], fr: ['B', 'OH', 'N', 'ZH', 'UU', 'R'] },
          'news': { en: ['N', 'UW1', 'Z'], es: ['N', 'OH', 'T', 'IH', 'S', 'IH', 'AH', 'S'], fr: ['AH', 'K', 'T', 'UU', 'AH', 'L', 'IH', 'T', 'EH'] },
          'today': { en: ['T', 'AH0', 'D', 'EY1'], es: ['OH', 'IH'], fr: ['OH', 'ZH', 'UU', 'R', 'D', 'UU', 'IH'] },
          'live': { en: ['L', 'AY1', 'V'], es: ['EH', 'N', 'V', 'IH', 'V', 'OH'], fr: ['AH', 'N', 'D', 'IH', 'R', 'EH', 'K', 'T'] },
          'breaking': { en: ['B', 'R', 'EY1', 'K', 'IH0', 'NG'], es: ['UU', 'L', 'T', 'IH', 'M', 'AH', 'OH', 'R', 'AH'], fr: ['D', 'EH', 'R', 'N', 'IH', 'EH', 'R', 'M', 'IH', 'N', 'UU', 'T'] },
          'weather': { en: ['W', 'EH1', 'DH', 'ER0'], es: ['K', 'L', 'IH', 'M', 'AH'], fr: ['M', 'EH', 'T', 'EH', 'OH'] },
          'sports': { en: ['S', 'P', 'AO1', 'R', 'T', 'S'], es: ['D', 'EH', 'P', 'OH', 'R', 'T', 'EH', 'S'], fr: ['S', 'P', 'OH', 'R'] },
          'president': { en: ['P', 'R', 'EH1', 'Z', 'IH0', 'D', 'AH0', 'N', 'T'], es: ['P', 'R', 'EH', 'S', 'IH', 'D', 'EH', 'N', 'T', 'EH'], fr: ['P', 'R', 'EH', 'Z', 'IH', 'D', 'AH', 'N'] },
          'government': { en: ['G', 'AH1', 'V', 'ER0', 'N', 'M', 'AH0', 'N', 'T'], es: ['G', 'OH', 'B', 'IH', 'EH', 'R', 'N', 'OH'], fr: ['G', 'UU', 'V', 'EH', 'R', 'N', 'AH', 'M', 'AH', 'N'] },
          'the': { en: ['DH', 'AH0'], es: ['EH', 'L'], fr: ['L', 'AH'] },
          'and': { en: ['AH0', 'N', 'D'], es: ['IH'], fr: ['EH'] },
          'is': { en: ['IH1', 'Z'], es: ['EH', 'S'], fr: ['EH'] },
          'for': { en: ['F', 'AO1', 'R'], es: ['P', 'AH', 'R', 'AH'], fr: ['P', 'UU', 'R'] },
          'with': { en: ['W', 'IH1', 'DH'], es: ['K', 'OH', 'N'], fr: ['AH', 'V', 'EH', 'K'] }
        };

        // Try dictionary lookup first
        if (phonemeDict[word] && phonemeDict[word][language]) {
          return phonemeDict[word][language];
        }

        // Fallback to basic character mapping
        return word.split('').map(char => this.phonemizer.phonemeMap[char] || char.toUpperCase());
      }
    };
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.processingQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.processingQueue.length > 0) {
      const request = this.processingQueue.shift()!;
      await this.processRequest(request);
      
      // Longer yield for TTS as it's computationally expensive
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    this.isProcessing = false;
  }

  private async processRequest(request: TTSRequest): Promise<void> {
    if (!this.session || !this.isInitialized || !this.phonemizer) {
      this.postMessage({
        type: 'tts-error',
        id: request.id,
        error: 'TTS not initialized'
      } as TTSError);
      return;
    }

    const startTime = performance.now();

    try {
      // Preprocess text to phonemes
      const phonemes = this.phonemizer.textToPhonemes(request.text, request.language);
      
      // Create phoneme tensor (simplified)
      const phonemeIds = phonemes.map((p, i) => i + 1); // Simple ID mapping
      const inputTensor = new Tensor('int64', 
        new BigInt64Array(phonemeIds.map(id => BigInt(id))), 
        [1, phonemeIds.length]
      );
      
      // Speed control (0.5 to 2.0)
      const speed = Math.max(0.5, Math.min(2.0, request.speed || 1.0));
      const speedTensor = new Tensor('float32', new Float32Array([speed]), [1]);
      
      // Run TTS inference
      const results = await this.session.run({
        phoneme_ids: inputTensor,
        speaker_id: new Tensor('int64', new BigInt64Array([BigInt(0)]), [1]), // Default speaker
        speed: speedTensor
      });
      
      // Extract audio data
      const audioTensor = results[Object.keys(results)[0]];
      const audioData = this.processAudioOutput(audioTensor);
      
      const processingTime = performance.now() - startTime;
      const sampleRate = 22050; // Kokoro model sample rate
      const duration = audioData.length / sampleRate;

      this.postMessage({
        type: 'tts-result',
        id: request.id,
        audioData,
        sampleRate,
        duration,
        processingTime
      } as TTSResponse);

    } catch (error) {
      this.postMessage({
        type: 'tts-error',
        id: request.id,
        error: error instanceof Error ? error.message : 'TTS processing failed'
      } as TTSError);
    }
  }

  private processAudioOutput(audioTensor: Tensor): Float32Array {
    const rawAudio = audioTensor.data as Float32Array;
    
    // Apply post-processing
    const processed = new Float32Array(rawAudio.length);
    
    // Simple amplitude normalization
    let maxAmp = 0;
    for (let i = 0; i < rawAudio.length; i++) {
      maxAmp = Math.max(maxAmp, Math.abs(rawAudio[i]));
    }
    
    const normalizer = maxAmp > 0 ? 0.8 / maxAmp : 1.0; // Target -2.5dB peak
    
    for (let i = 0; i < rawAudio.length; i++) {
      processed[i] = rawAudio[i] * normalizer;
    }
    
    // Simple high-pass filter to remove DC offset
    for (let i = 1; i < processed.length; i++) {
      processed[i] = processed[i] - processed[i-1] * 0.95;
    }
    
    return processed;
  }

  private calculateConfidence(audioData: Float32Array): number {
    // Audio quality confidence based on signal characteristics
    const rms = Math.sqrt(audioData.reduce((sum, sample) => sum + sample * sample, 0) / audioData.length);
    const energy = Math.min(1.0, rms * 10); // Normalize energy
    
    // Check for clipping (reduced quality)
    const clippedSamples = audioData.filter(sample => Math.abs(sample) > 0.95).length;
    const clippingPenalty = Math.min(0.3, clippedSamples / audioData.length);
    
    return Math.max(0.2, Math.min(0.95, energy * 0.7 + (1 - clippingPenalty) * 0.3));
  }

  private sendMessage(message: any): Promise<any> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, resolve);
    });
  }

  private postMessage(message: any): void {
    self.postMessage(message);
  }

  public addRequest(request: TTSRequest): void {
    this.processingQueue.push(request);
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  public getStatus() {
    return {
      initialized: this.isInitialized,
      queueLength: this.processingQueue.length,
      processing: this.isProcessing,
      sessionReady: !!this.session,
      supportedLanguages: Object.keys(LANGUAGE_CODES)
    };
  }
}

// Initialize worker
const ttsWorker = new TTSWorker();

// Handle messages from main thread
self.onmessage = async (event: MessageEvent) => {
  const { type, ...data } = event.data;

  switch (type) {
    case 'synthesize':
      ttsWorker.addRequest(data as TTSRequest);
      break;
      
    case 'status':
      self.postMessage({
        type: 'status-response',
        status: ttsWorker.getStatus()
      });
      break;
      
    default:
      console.warn('Unknown message type:', type);
  }
};