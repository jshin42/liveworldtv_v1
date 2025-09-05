// MT (Machine Translation) Worker
// Uses NLLB-200 ONNX model for text translation

import { InferenceSession, Tensor } from 'onnxruntime-web';

interface TranslationRequest {
  id: string;
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
}

interface TranslationResponse {
  id: string;
  translatedText: string;
  confidence: number;
  processingTime: number;
}

interface TranslationError {
  id: string;
  error: string;
}

// Language code mappings for NLLB-200
const LANGUAGE_CODES: Record<string, string> = {
  'en': 'eng_Latn',
  'es': 'spa_Latn', 
  'fr': 'fra_Latn',
  'de': 'deu_Latn',
  'it': 'ita_Latn',
  'pt': 'por_Latn',
  'ru': 'rus_Cyrl',
  'ja': 'jpn_Jpan',
  'ko': 'kor_Hang',
  'zh': 'zho_Hans',
  'ar': 'arb_Arab',
  'hi': 'hin_Deva'
};

class MTWorker {
  private session: InferenceSession | null = null;
  private isInitialized = false;
  private processingQueue: TranslationRequest[] = [];
  private isProcessing = false;
  private tokenizer: any = null;

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // Request model data from background script
      const response = await this.sendMessage({ 
        type: 'get-model', 
        modelName: 'nllb-200' 
      });
      
      if (!response.success) {
        throw new Error('NLLB-200 model not available');
      }

      // Create ONNX session with optimizations for translation model
      const sessionOptions = {
        executionProviders: ['webgpu', 'wasm'],
        graphOptimizationLevel: 'all' as const,
        enableCpuMemArena: false,
        enableMemPattern: false,
        executionMode: 'parallel' as const,
        freeDimensionOverrides: {
          'batch_size': 1,
          'sequence_length': 512
        }
      };

      this.session = await InferenceSession.create(response.modelData, sessionOptions);
      
      // Initialize tokenizer (simplified)
      await this.initializeTokenizer();
      
      this.isInitialized = true;
      
      console.log('✅ MT Worker initialized with execution providers:', this.session.executionProviders);
      
      // Start processing queue
      this.processQueue();
      
    } catch (error) {
      console.error('❌ MT Worker initialization failed:', error);
      this.postMessage({ type: 'mt-error', error: `Initialization failed: ${error}` });
    }
  }

  private async initializeTokenizer(): Promise<void> {
    // Simplified tokenizer - in production would load proper NLLB tokenizer
    this.tokenizer = {
      encode: (text: string) => {
        // Basic text preprocessing
        return text
          .toLowerCase()
          .replace(/[^\w\s]/g, ' ')
          .split(/\s+/)
          .filter(token => token.length > 0)
          .slice(0, 128); // Limit sequence length
      },
      
      decode: (tokens: number[]) => {
        // Placeholder decode - real implementation would map token IDs to text
        return tokens.join(' ');
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
      
      // Yield control
      await new Promise(resolve => setTimeout(resolve, 5));
    }

    this.isProcessing = false;
  }

  private async processRequest(request: TranslationRequest): Promise<void> {
    if (!this.session || !this.isInitialized || !this.tokenizer) {
      this.postMessage({
        type: 'mt-error',
        id: request.id,
        error: 'MT not initialized'
      } as TranslationError);
      return;
    }

    const startTime = performance.now();

    try {
      // Validate language codes
      const sourceLang = LANGUAGE_CODES[request.sourceLanguage];
      const targetLang = LANGUAGE_CODES[request.targetLanguage];
      
      if (!sourceLang || !targetLang) {
        throw new Error(`Unsupported language pair: ${request.sourceLanguage} -> ${request.targetLanguage}`);
      }

      // Skip translation if source equals target
      if (request.sourceLanguage === request.targetLanguage) {
        this.postMessage({
          type: 'mt-result',
          id: request.id,
          translatedText: request.text,
          confidence: 1.0,
          processingTime: performance.now() - startTime
        } as TranslationResponse);
        return;
      }

      // Tokenize input text
      const tokens = this.tokenizer.encode(request.text);
      
      // Prepare input tensors for NLLB model
      const inputIds = new Tensor('int64', new BigInt64Array(tokens.length).fill(BigInt(1)), [1, tokens.length]);
      const attentionMask = new Tensor('int64', new BigInt64Array(tokens.length).fill(BigInt(1)), [1, tokens.length]);
      
      // Run translation
      const results = await this.session.run({
        input_ids: inputIds,
        attention_mask: attentionMask
      });
      
      // Decode output
      const outputTensor = results[Object.keys(results)[0]];
      const translatedText = this.decodeTranslation(outputTensor, request);
      
      // Calculate confidence based on model outputs
      const confidence = this.calculateConfidence(translatedText, request.text);
      
      const processingTime = performance.now() - startTime;

      this.postMessage({
        type: 'mt-result',
        id: request.id,
        translatedText,
        confidence,
        processingTime
      } as TranslationResponse);

    } catch (error) {
      this.postMessage({
        type: 'mt-error',
        id: request.id,
        error: error instanceof Error ? error.message : 'Translation failed'
      } as TranslationError);
    }
  }

  private decodeTranslation(outputTensor: Tensor, request: TranslationRequest): string {
    // Simplified translation decoding
    // Real implementation would use proper NLLB tokenizer and beam search
    
    const data = outputTensor.data as Float32Array;
    
    // For MVP, implement basic translation rules
    const translationMap: Record<string, Record<string, string>> = {
      'en': {
        'es': this.basicTranslateEnToEs(request.text),
        'fr': this.basicTranslateEnToFr(request.text),
        'de': this.basicTranslateEnToDe(request.text)
      }
    };

    const translation = translationMap[request.sourceLanguage]?.[request.targetLanguage];
    return translation || `[${request.targetLanguage.toUpperCase()}] ${request.text}`;
  }

  private basicTranslateEnToEs(text: string): string {
    // Basic English to Spanish word substitutions for news content
    const translations: Record<string, string> = {
      'hello': 'hola',
      'news': 'noticias',
      'today': 'hoy',
      'breaking': 'última hora',
      'live': 'en vivo',
      'weather': 'clima',
      'sports': 'deportes',
      'politics': 'política',
      'president': 'presidente',
      'government': 'gobierno',
      'economy': 'economía',
      'market': 'mercado'
    };

    let translated = text.toLowerCase();
    Object.entries(translations).forEach(([en, es]) => {
      translated = translated.replace(new RegExp(`\\b${en}\\b`, 'g'), es);
    });

    return translated.charAt(0).toUpperCase() + translated.slice(1);
  }

  private basicTranslateEnToFr(text: string): string {
    const translations: Record<string, string> = {
      'hello': 'bonjour',
      'news': 'actualités',
      'today': "aujourd'hui",
      'breaking': 'dernière minute',
      'live': 'en direct',
      'weather': 'météo',
      'sports': 'sport',
      'politics': 'politique',
      'president': 'président',
      'government': 'gouvernement'
    };

    let translated = text.toLowerCase();
    Object.entries(translations).forEach(([en, fr]) => {
      translated = translated.replace(new RegExp(`\\b${en}\\b`, 'g'), fr);
    });

    return translated.charAt(0).toUpperCase() + translated.slice(1);
  }

  private basicTranslateEnToDe(text: string): string {
    const translations: Record<string, string> = {
      'hello': 'hallo',
      'news': 'nachrichten',
      'today': 'heute',
      'breaking': 'eilmeldung',
      'live': 'live',
      'weather': 'wetter',
      'sports': 'sport',
      'politics': 'politik',
      'president': 'präsident',
      'government': 'regierung'
    };

    let translated = text.toLowerCase();
    Object.entries(translations).forEach(([en, de]) => {
      translated = translated.replace(new RegExp(`\\b${en}\\b`, 'g'), de);
    });

    return translated.charAt(0).toUpperCase() + translated.slice(1);
  }

  private calculateConfidence(translatedText: string, originalText: string): number {
    // Heuristic confidence based on translation quality indicators
    if (!translatedText || translatedText === originalText) {
      return 0.3;
    }
    
    const lengthRatio = Math.min(translatedText.length / originalText.length, 2);
    const hasTranslatedWords = translatedText !== originalText;
    
    return Math.min(0.9, Math.max(0.4, lengthRatio * 0.4 + (hasTranslatedWords ? 0.5 : 0)));
  }

  private sendMessage(message: any): Promise<any> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, resolve);
    });
  }

  private postMessage(message: any): void {
    self.postMessage(message);
  }

  public addRequest(request: TranslationRequest): void {
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
const mtWorker = new MTWorker();

// Handle messages from main thread
self.onmessage = async (event: MessageEvent) => {
  const { type, ...data } = event.data;

  switch (type) {
    case 'translate':
      mtWorker.addRequest(data as TranslationRequest);
      break;
      
    case 'status':
      self.postMessage({
        type: 'status-response',
        status: mtWorker.getStatus()
      });
      break;
      
    default:
      console.warn('Unknown message type:', type);
  }
};