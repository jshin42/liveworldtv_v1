// ASR (Automatic Speech Recognition) Worker
// Uses Distil-Whisper ONNX model for live audio transcription

import { InferenceSession, Tensor } from 'onnxruntime-web';

interface ASRRequest {
  id: string;
  audioData: Float32Array;
  sampleRate: number;
  language?: string;
}

interface ASRResponse {
  id: string;
  text: string;
  confidence: number;
  processingTime: number;
}

interface ASRError {
  id: string;
  error: string;
}

class ASRWorker {
  private session: InferenceSession | null = null;
  private isInitialized = false;
  private processingQueue: ASRRequest[] = [];
  private isProcessing = false;

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // Request model data from background script
      const response = await this.sendMessage({ 
        type: 'get-model', 
        modelName: 'distil-whisper' 
      });
      
      if (!response.success) {
        throw new Error('Distil-Whisper model not available');
      }

      // Create ONNX session with WebGPU backend (fallback to WASM)
      const sessionOptions = {
        executionProviders: ['webgpu', 'wasm'],
        graphOptimizationLevel: 'all' as const,
        enableCpuMemArena: false,
        enableMemPattern: false,
        executionMode: 'parallel' as const
      };

      this.session = await InferenceSession.create(response.modelData, sessionOptions);
      this.isInitialized = true;
      
      console.log('✅ ASR Worker initialized with execution providers:', this.session.executionProviders);
      
      // Start processing queue
      this.processQueue();
      
    } catch (error) {
      console.error('❌ ASR Worker initialization failed:', error);
      this.postMessage({ type: 'asr-error', error: `Initialization failed: ${error}` });
    }
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.processingQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.processingQueue.length > 0) {
      const request = this.processingQueue.shift()!;
      await this.processRequest(request);
      
      // Yield control to prevent blocking
      await new Promise(resolve => setTimeout(resolve, 1));
    }

    this.isProcessing = false;
  }

  private async processRequest(request: ASRRequest): Promise<void> {
    if (!this.session || !this.isInitialized) {
      this.postMessage({
        type: 'asr-error',
        id: request.id,
        error: 'ASR not initialized'
      } as ASRError);
      return;
    }

    const startTime = performance.now();

    try {
      // Preprocess audio data
      const processedAudio = this.preprocessAudio(request.audioData, request.sampleRate);
      
      // Create input tensor
      const inputTensor = new Tensor('float32', processedAudio, [1, processedAudio.length]);
      
      // Run inference
      const results = await this.session.run({ audio: inputTensor });
      
      // Extract text from model output
      const outputTensor = results[Object.keys(results)[0]];
      const text = this.decodeOutput(outputTensor);
      
      // Calculate confidence (simplified)
      const confidence = this.calculateConfidence(text, processedAudio);
      
      const processingTime = performance.now() - startTime;

      this.postMessage({
        type: 'asr-result',
        id: request.id,
        text,
        confidence,
        processingTime
      } as ASRResponse);

    } catch (error) {
      this.postMessage({
        type: 'asr-error',
        id: request.id,
        error: error instanceof Error ? error.message : 'Processing failed'
      } as ASRError);
    }
  }

  private preprocessAudio(audioData: Float32Array, sampleRate: number): Float32Array {
    // Resample to 16kHz if needed (Whisper requirement)
    const targetSampleRate = 16000;
    
    if (sampleRate === targetSampleRate) {
      return audioData;
    }

    // Simple linear interpolation resampling
    const ratio = sampleRate / targetSampleRate;
    const outputLength = Math.floor(audioData.length / ratio);
    const resampled = new Float32Array(outputLength);

    for (let i = 0; i < outputLength; i++) {
      const srcIndex = i * ratio;
      const index = Math.floor(srcIndex);
      const fraction = srcIndex - index;
      
      if (index + 1 < audioData.length) {
        resampled[i] = audioData[index] * (1 - fraction) + audioData[index + 1] * fraction;
      } else {
        resampled[i] = audioData[index];
      }
    }

    // Normalize audio to [-1, 1] range
    const max = Math.max(...Array.from(resampled).map(Math.abs));
    if (max > 0) {
      for (let i = 0; i < resampled.length; i++) {
        resampled[i] /= max;
      }
    }

    return resampled;
  }

  private decodeOutput(outputTensor: Tensor): string {
    // Extract token IDs from Whisper model output
    const logits = outputTensor.data as Float32Array;
    const vocab = this.getWhisperVocab();
    
    // Find the most likely tokens (argmax over vocabulary dimension)
    const dims = outputTensor.dims;
    const seqLength = dims[1]; // [batch_size, seq_length, vocab_size]
    const vocabSize = dims[2] || 51865; // Whisper vocab size
    
    const tokens: number[] = [];
    
    for (let i = 0; i < seqLength; i++) {
      let maxLogit = -Infinity;
      let bestToken = 0;
      
      const startIdx = i * vocabSize;
      for (let j = 0; j < vocabSize; j++) {
        const logit = logits[startIdx + j];
        if (logit > maxLogit) {
          maxLogit = logit;
          bestToken = j;
        }
      }
      
      // Skip special tokens and padding
      if (bestToken > 50256 && bestToken !== 50257) { // Not <|endoftext|> or <|startoftranscript|>
        tokens.push(bestToken);
      }
    }
    
    // Decode tokens to text
    return this.decodeTokens(tokens, vocab);
  }

  private getWhisperVocab(): { [tokenId: number]: string } {
    // Simplified Whisper vocabulary for demo
    // In production, this would be loaded from the actual model tokenizer
    const commonTokens: { [key: number]: string } = {
      220: ' ',
      50257: '<|startoftranscript|>',
      50258: '<|en|>',
      50259: '<|transcribe|>',
      50363: '<|endoftext|>',
      
      // Common English words (partial vocab for demo)
      262: 'the',
      290: 'and',
      318: 'to',
      286: 'a',
      286: 'of',
      340: 'in',
      329: 'is',
      345: 'it',
      356: 'you',
      326: 'that',
      339: 'he',
      373: 'was',
      329: 'for',
      319: 'on',
      389: 'are',
      355: 'as',
      351: 'with',
      465: 'his',
      484: 'they',
      299: 'I',
      379: 'at',
      307: 'be',
      428: 'this',
      423: 'have',
      422: 'from',
      393: 'or',
      530: 'one',
      465: 'had',
      416: 'by',
      1239: 'word',
      475: 'but',
      407: 'not',
      644: 'what',
      477: 'all',
      547: 'were',
      484: 'they',
      588: 'we',
      460: 'when',
      534: 'your',
      460: 'can',
      788: 'said',
      612: 'there',
      1123: 'each',
      644: 'which',
      466: 'she',
      466: 'do',
      466: 'how',
      591: 'their',
      820: 'if',
      466: 'will',
      466: 'up',
      466: 'other',
      466: 'about',
      466: 'out',
      466: 'many',
      466: 'then',
      466: 'them',
      466: 'these',
      466: 'so',
      466: 'some',
      466: 'her',
      466: 'would',
      466: 'make',
      466: 'like',
      466: 'into',
      466: 'him',
      466: 'time',
      466: 'has',
      466: 'two',
      466: 'more',
      466: 'very',
      466: 'after',
      466: 'words',
      466: 'first',
      466: 'where',
      466: 'much',
      466: 'way',
      466: 'been',
      466: 'call',
      466: 'who',
      466: 'its',
      466: 'now',
      466: 'find',
      466: 'long',
      466: 'down',
      466: 'day',
      466: 'did',
      466: 'get',
      466: 'come',
      466: 'made',
      466: 'may',
      466: 'part'
    };
    
    return commonTokens;
  }

  private decodeTokens(tokens: number[], vocab: { [tokenId: number]: string }): string {
    const words: string[] = [];
    
    for (const token of tokens) {
      const word = vocab[token];
      if (word && word !== '<|endoftext|>' && word !== '<|startoftranscript|>') {
        words.push(word);
      }
    }
    
    return words.join('').trim();
  }

  private calculateConfidence(text: string, audioData: Float32Array): number {
    // Simple confidence heuristic based on audio energy and text length
    const averageEnergy = audioData.reduce((sum, sample) => sum + Math.abs(sample), 0) / audioData.length;
    const textComplexity = Math.min(text.length / 50, 1); // Normalize by expected length
    
    return Math.min(0.95, Math.max(0.1, averageEnergy * 0.7 + textComplexity * 0.3));
  }

  private sendMessage(message: any): Promise<any> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, resolve);
    });
  }

  private postMessage(message: any): void {
    self.postMessage(message);
  }

  // Public API
  public addRequest(request: ASRRequest): void {
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
      sessionReady: !!this.session
    };
  }
}

// Initialize worker
const asrWorker = new ASRWorker();

// Handle messages from main thread
self.onmessage = async (event: MessageEvent) => {
  const { type, ...data } = event.data;

  switch (type) {
    case 'transcribe':
      asrWorker.addRequest(data as ASRRequest);
      break;
      
    case 'status':
      self.postMessage({
        type: 'status-response',
        status: asrWorker.getStatus()
      });
      break;
      
    default:
      console.warn('Unknown message type:', type);
  }
};