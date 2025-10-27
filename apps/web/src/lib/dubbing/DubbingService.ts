/**
 * Real-time Live Dubbing Service
 * Inspired by KrillinAI architecture: Whisper ASR + Translation + TTS
 * Adapted for live streaming with Web APIs
 */

export interface DubbingConfig {
  sourceLanguage: string;
  targetLanguage: string;
  enabled: boolean;
  originalVolume: number;
  dubbedVolume: number;
}

export class DubbingService {
  private audioContext: AudioContext | null = null;
  private recognition: any = null;
  private synthesis: SpeechSynthesis;
  private config: DubbingConfig;
  private isActive: boolean = false;
  private translationCache: Map<string, string> = new Map();

  constructor(config: DubbingConfig) {
    this.config = config;
    this.synthesis = window.speechSynthesis;
  }

  async initialize(): Promise<void> {
    console.log('[Dubbing] Initializing service...');
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.initializeSpeechRecognition();
    this.isActive = true;
    console.log('[Dubbing] Service initialized');
  }

  private initializeSpeechRecognition(): void {
    const SpeechRecognition = (window as any).SpeechRecognition ||
                               (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn('[Dubbing] Web Speech API not available');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = this.getLanguageCode(this.config.sourceLanguage);

    this.recognition.onresult = async (event: any) => {
      const results = event.results;
      const lastResult = results[results.length - 1];

      if (lastResult.isFinal) {
        const transcript = lastResult[0].transcript;
        console.log('[Dubbing] Transcribed:', transcript);
        await this.processTranscription(transcript);
      }
    };

    this.recognition.onerror = (event: any) => {
      console.error('[Dubbing] Recognition error:', event.error);
    };
  }

  private async processTranscription(text: string): Promise<void> {
    if (!this.config.enabled) return;

    try {
      const translatedText = await this.translate(text);
      await this.speak(translatedText);
    } catch (error) {
      console.error('[Dubbing] Processing error:', error);
    }
  }

  private async translate(text: string): Promise<string> {
    if (this.translationCache.has(text)) {
      return this.translationCache.get(text)!;
    }

    try {
      const from = this.getLanguageCode(this.config.sourceLanguage).slice(0, 2);
      const to = this.getLanguageCode(this.config.targetLanguage).slice(0, 2);

      const url = 'https://api.mymemory.translated.net/get?q=' +
                  encodeURIComponent(text) + '&langpair=' + from + '|' + to;

      const response = await fetch(url);
      const data = await response.json();

      if (data.responseStatus === 200) {
        const translated = data.responseData.translatedText;
        this.translationCache.set(text, translated);
        return translated;
      }
    } catch (error) {
      console.warn('[Dubbing] Translation API failed:', error);
    }

    return '[' + this.config.targetLanguage + '] ' + text;
  }

  private async speak(text: string): Promise<void> {
    if (!this.synthesis) return;

    this.synthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = this.getLanguageCode(this.config.targetLanguage);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = this.config.dubbedVolume;

    const voices = this.synthesis.getVoices();
    const targetVoice = voices.find(voice =>
      voice.lang.startsWith(this.getLanguageCode(this.config.targetLanguage).slice(0, 2))
    );

    if (targetVoice) {
      utterance.voice = targetVoice;
    }

    return new Promise((resolve, reject) => {
      utterance.onend = () => resolve();
      utterance.onerror = (error) => reject(error);
      this.synthesis.speak(utterance);
    });
  }

  start(): void {
    if (!this.isActive) {
      console.warn('[Dubbing] Service not initialized');
      return;
    }

    if (this.recognition) {
      console.log('[Dubbing] Starting recognition...');
      this.recognition.start();
    }
  }

  stop(): void {
    if (this.recognition) {
      this.recognition.stop();
    }
    if (this.synthesis) {
      this.synthesis.cancel();
    }
  }

  updateConfig(config: Partial<DubbingConfig>): void {
    this.config = { ...this.config, ...config };
    if (this.recognition) {
      this.recognition.lang = this.getLanguageCode(this.config.sourceLanguage);
    }
  }

  private getLanguageCode(language: string): string {
    const codes: Record<string, string> = {
      'english': 'en-US',
      'spanish': 'es-ES',
      'french': 'fr-FR',
      'german': 'de-DE',
      'japanese': 'ja-JP',
      'korean': 'ko-KR',
      'chinese': 'zh-CN',
      'portuguese': 'pt-BR',
      'russian': 'ru-RU',
      'arabic': 'ar-SA',
      'hindi': 'hi-IN',
    };
    return codes[language.toLowerCase()] || 'en-US';
  }

  dispose(): void {
    this.stop();
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.isActive = false;
  }
}
