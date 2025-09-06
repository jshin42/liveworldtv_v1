import { ModelManager } from './model-manager-real'
import { AIPipeline } from './ai-pipeline'

interface ExtensionMessage {
  type: 'ENABLE_DUBBING' | 'DISABLE_DUBBING' | 'GET_MODEL_STATUS' | 'DOWNLOAD_MODELS' | 'get-model' | 'YOUTUBE_VIDEO_DETECTED' | 'PROCESS_AUDIO_CHUNK' | 'START_YOUTUBE_DUBBING' | 'STOP_YOUTUBE_DUBBING'
  data?: any
  tabId?: number
  timestamp?: number
  modelName?: string
}

interface ExtensionResponse {
  success: boolean
  data?: any
  error?: string
  modelReady?: boolean
  session?: boolean
}

class ExtensionServiceWorker {
  private modelManager: ModelManager
  private aiPipelines = new Map<number, AIPipeline>()
  private activeSessions = new Set<number>()
  private youtubeProcessingQueues = new Map<number, any[]>()

  constructor() {
    this.modelManager = new ModelManager()
    
    this.setupMessageHandlers()
    this.setupInstallHandler()
    this.initializeExtension()
  }

  private async initializeExtension(): Promise<void> {
    try {
      console.log('🚀 LiveWorldTV Extension initializing...');
      
      // Check if models exist, pre-load for faster startup
      await this.modelManager.checkModelFiles();
      console.log('🤖 Pre-loading AI models...');
      await this.modelManager.loadAllModels();
      
      console.log('✅ LiveWorldTV Extension ready for real-time dubbing!');
    } catch (error) {
      console.error('❌ Extension initialization failed:', error);
      console.log('⚠️ Running in demo mode');
    }
  }

  private setupMessageHandlers(): void {
    chrome.runtime.onMessage.addListener(
      (message: ExtensionMessage, sender, sendResponse) => {
        this.handleMessage(message, sender, sendResponse)
        return true // Keep message channel open for async response
      }
    )
  }

  private async handleMessage(
    message: ExtensionMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: ExtensionResponse) => void
  ): Promise<void> {
    try {
      switch (message.type) {
        case 'ENABLE_DUBBING':
          await this.enableDubbing(message.tabId || sender.tab?.id!)
          sendResponse({ success: true })
          break

        case 'DISABLE_DUBBING':
          await this.disableDubbing(message.tabId || sender.tab?.id!)
          sendResponse({ success: true })
          break

        case 'GET_MODEL_STATUS':
          const status = this.modelManager.getAllModelStatus()
          sendResponse({ success: true, data: status })
          break

        case 'DOWNLOAD_MODELS':
          await this.modelManager.loadAllModels()
          sendResponse({ success: true })
          break

        case 'get-model':
          if (message.modelName) {
            const modelReady = await this.modelManager.isModelReady(message.modelName);
            if (modelReady) {
              const session = await this.modelManager.getModel(message.modelName);
              sendResponse({ success: true, modelReady: true, session: !!session });
            } else {
              // Try to load the model
              console.log(`🔄 Model ${message.modelName} not ready, loading...`);
              await this.modelManager.loadModel(message.modelName);
              const session = await this.modelManager.getModel(message.modelName);
              sendResponse({ success: !!session, modelReady: !!session });
            }
          } else {
            sendResponse({ success: false, error: 'Model name required' });
          }
          break

        case 'YOUTUBE_VIDEO_DETECTED':
          console.log('🎬 YouTube video detected:', message.data);
          // Store video metadata for analytics
          sendResponse({ success: true });
          break

        case 'PROCESS_AUDIO_CHUNK':
          await this.processYouTubeAudioChunk(message, sender.tab?.id || 0);
          sendResponse({ success: true });
          break

        case 'START_YOUTUBE_DUBBING':
          const startSuccess = await this.startYouTubeDubbing(sender.tab?.id || 0, message.data.targetLanguage);
          sendResponse({ success: startSuccess });
          break

        case 'STOP_YOUTUBE_DUBBING':
          await this.stopYouTubeDubbing(sender.tab?.id || 0);
          sendResponse({ success: true });
          break

        default:
          sendResponse({ success: false, error: `Unknown message type: ${message.type}` })
      }
    } catch (error) {
      console.error('Message handler error:', error)
      sendResponse({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  private async enableDubbing(tabId: number): Promise<void> {
    if (this.activeSessions.has(tabId)) {
      throw new Error('Dubbing already enabled for this tab')
    }

    try {
      // 1. Create AI pipeline for this tab
      const pipeline = new AIPipeline(this.modelManager);
      await pipeline.initialize();

      // 2. Request tab capture permission
      const stream = await new Promise<MediaStream>((resolve, reject) => {
        chrome.tabCapture.capture({
          audio: true,
          video: false
        }, (stream) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (stream) {
            resolve(stream);
          } else {
            reject(new Error('No stream returned from tabCapture'));
          }
        });
      });

      // 3. Start AI processing pipeline
      const dubbedStream = await pipeline.startProcessing(stream, 'auto', 'en');

      // 4. Store pipeline and mark session active
      this.aiPipelines.set(tabId, pipeline);
      this.activeSessions.add(tabId);

      // 5. Notify content script
      await chrome.tabs.sendMessage(tabId, {
        type: 'DUBBING_ENABLED',
        data: { 
          originalStream: stream,
          dubbedStream: dubbedStream,
          modelStatus: this.modelManager.getAllModelStatus()
        }
      });

      console.log(`✅ Real-time AI dubbing enabled for tab ${tabId}`);

    } catch (error) {
      // Clean up on failure
      const pipeline = this.aiPipelines.get(tabId);
      if (pipeline) {
        await pipeline.cleanup();
        this.aiPipelines.delete(tabId);
      }
      this.activeSessions.delete(tabId);
      throw error;
    }
  }

  private async disableDubbing(tabId: number): Promise<void> {
    if (!this.activeSessions.has(tabId)) {
      return // Already disabled
    }

    try {
      // 1. Stop AI pipeline
      const pipeline = this.aiPipelines.get(tabId);
      if (pipeline) {
        await pipeline.cleanup();
        this.aiPipelines.delete(tabId);
      }

      // 2. Remove from active sessions
      this.activeSessions.delete(tabId);

      // 3. Notify content script
      await chrome.tabs.sendMessage(tabId, {
        type: 'DUBBING_DISABLED',
        data: {}
      });

      console.log(`🔇 AI dubbing disabled for tab ${tabId}`);

    } catch (error) {
      console.warn(`Error disabling dubbing for tab ${tabId}:`, error);
    }
  }

  private setupInstallHandler(): void {
    chrome.runtime.onInstalled.addListener(async (details) => {
      if (details.reason === 'install') {
        console.log('🎉 LiveWorldTV extension installed')
        
        // Start loading models in background
        this.modelManager.loadAllModels().catch(error => {
          console.error('Background model loading failed:', error)
        })
        
        // Record installation event
        await this.recordAnalyticsEvent('EXTENSION_INSTALLED', {
          version: chrome.runtime.getManifest().version,
          installReason: details.reason
        })
      }
    })

    // Clean up when tabs are closed
    chrome.tabs.onRemoved.addListener((tabId) => {
      if (this.activeSessions.has(tabId)) {
        this.disableDubbing(tabId).catch(console.error)
      }
    })
  }

  private async recordAnalyticsEvent(eventType: string, metadata: Record<string, any>): Promise<void> {
    // Simple analytics recording - will be enhanced in Sprint 4
    console.log(`📊 Analytics event: ${eventType}`, metadata)
  }

  private getModelUrl(modelName: string): string {
    const urlMap: { [key: string]: string } = {
      'distil-whisper': 'https://huggingface.co/onnx-community/distil-whisper-large-v3/resolve/main/model.onnx',
      'nllb-200': 'https://huggingface.co/facebook/nllb-200-distilled-600M/resolve/main/pytorch_model.bin',
      'kokoro-82m': 'https://huggingface.co/onnx-community/kokoro-v0_19/resolve/main/model.onnx'
    };
    return urlMap[modelName] || '';
  }

  private getModelSize(modelName: string): number {
    const sizeMap: { [key: string]: number } = {
      'distil-whisper': 394 * 1024 * 1024, // 394MB
      'nllb-200': 600 * 1024 * 1024,       // 600MB  
      'kokoro-82m': 330 * 1024 * 1024      // 330MB
    };
    return sizeMap[modelName] || 100 * 1024 * 1024;
  }

  private async startYouTubeDubbing(tabId: number, targetLanguage: string): Promise<boolean> {
    try {
      console.log(`🎥 Starting YouTube dubbing for tab ${tabId}: auto → ${targetLanguage}`);
      
      // Create and initialize AI pipeline for this tab
      const pipeline = new AIPipeline(this.modelManager);
      await pipeline.initialize();

      // Store pipeline for this tab
      this.aiPipelines.set(tabId, pipeline);
      this.youtubeProcessingQueues.set(tabId, []);
      this.activeSessions.add(tabId);

      // Send message to YouTube content script to start dubbing
      await chrome.tabs.sendMessage(tabId, {
        type: 'START_YOUTUBE_DUBBING',
        data: { targetLanguage }
      });

      console.log(`✅ YouTube AI dubbing started for tab ${tabId}`);
      return true;

    } catch (error) {
      console.error('❌ Failed to start YouTube dubbing:', error);
      
      // Clean up on failure
      const pipeline = this.aiPipelines.get(tabId);
      if (pipeline) {
        await pipeline.cleanup();
        this.aiPipelines.delete(tabId);
      }
      this.activeSessions.delete(tabId);
      this.youtubeProcessingQueues.delete(tabId);
      
      return false;
    }
  }

  private async stopYouTubeDubbing(tabId: number): Promise<void> {
    try {
      console.log(`🔇 Stopping YouTube dubbing for tab ${tabId}`);

      // Stop AI pipeline
      const pipeline = this.aiPipelines.get(tabId);
      if (pipeline) {
        await pipeline.cleanup();
        this.aiPipelines.delete(tabId);
      }

      // Remove from active sessions and clear queue
      this.activeSessions.delete(tabId);
      this.youtubeProcessingQueues.delete(tabId);

      // Send message to YouTube content script to stop dubbing
      await chrome.tabs.sendMessage(tabId, {
        type: 'STOP_YOUTUBE_DUBBING'
      });

      console.log(`✅ YouTube AI dubbing stopped for tab ${tabId}`);

    } catch (error) {
      console.error('❌ Failed to stop YouTube dubbing:', error);
    }
  }

  private async processYouTubeAudioChunk(message: ExtensionMessage, tabId: number): Promise<void> {
    if (!this.activeSessions.has(tabId)) {
      return; // Session not active
    }

    const pipeline = this.aiPipelines.get(tabId);
    if (!pipeline) {
      console.warn('No AI pipeline found for tab', tabId);
      return;
    }

    try {
      const { id, audioData, sampleRate, targetLanguage, timestamp } = message.data;
      
      console.log(`🎵 Processing YouTube audio chunk: ${id} with real AI pipeline`);

      // Convert audio data back to Float32Array
      const audioFloat32 = new Float32Array(audioData);

      // Create audio chunk for AI pipeline
      const audioChunk = {
        data: audioFloat32,
        timestamp: timestamp || Date.now(),
        sampleRate: sampleRate || 16000
      };

      // Process through real AI pipeline methods
      const transcription = await pipeline['transcribeAudio'](audioChunk);
      
      if (!transcription || transcription.text.trim().length === 0) {
        console.log(`⏭️ Skipping empty transcription`);
        return;
      }

      console.log(`📝 AI Transcribed: "${transcription.text}" (confidence: ${transcription.confidence})`);

      // Translate using real AI pipeline
      const translation = await pipeline['translateText'](
        transcription.text,
        transcription.language,
        targetLanguage
      );

      console.log(`🌐 AI Translated: "${translation.text}" (${targetLanguage})`);

      // Generate speech using real AI pipeline
      const synthesis = await pipeline['synthesizeSpeech'](
        translation.text,
        targetLanguage
      );

      if (!synthesis || !synthesis.audioBuffer || synthesis.audioBuffer.byteLength === 0) {
        console.log(`⏭️ Skipping empty TTS synthesis`);
        return;
      }

      console.log(`🎙️ AI Synthesized audio: ${synthesis.audioBuffer.byteLength} bytes, duration: ${synthesis.duration}s`);

      // Convert ArrayBuffer to Array for message passing
      const audioArray = Array.from(new Int16Array(synthesis.audioBuffer));

      // Send dubbed audio back to YouTube content script
      await chrome.tabs.sendMessage(tabId, {
        type: 'DUBBED_AUDIO_READY',
        data: {
          chunkId: id,
          audioData: audioArray,
          sampleRate: 16000, // Standard rate for synthesis
          originalText: transcription.text,
          translatedText: translation.text,
          processingLatency: Date.now() - (timestamp || Date.now())
        }
      });

      console.log(`✅ AI-dubbed audio sent to tab ${tabId} for chunk ${id}`);

    } catch (error) {
      console.error('❌ Real AI pipeline processing error:', error);
    }
  }

  private async processASR(audioData: Float32Array, sampleRate: number): Promise<{ text: string; confidence: number } | null> {
    // Simulate ASR processing - in real implementation this would use the ASR worker
    return new Promise((resolve) => {
      setTimeout(() => {
        // Mock transcription for demo
        const mockTranscriptions = [
          "Good evening, this is breaking news from our newsroom",
          "Today the government announced new economic policies",
          "Weather conditions are improving across the region", 
          "The president will address the nation tonight",
          "Sports news from the championship game",
          "Live updates continue throughout the evening"
        ];
        
        const transcription = mockTranscriptions[Math.floor(Math.random() * mockTranscriptions.length)];
        const confidence = 0.8 + Math.random() * 0.15; // 0.8-0.95
        
        resolve({ text: transcription, confidence });
      }, 50 + Math.random() * 100); // 50-150ms processing time
    });
  }

  private async processMT(text: string, sourceLanguage: string, targetLanguage: string): Promise<{ translatedText: string; confidence: number } | null> {
    return new Promise((resolve) => {
      setTimeout(() => {
        // Mock translation using basic word substitution
        const translations: { [key: string]: { [key: string]: string } } = {
          'es': {
            'good evening': 'buenas noches',
            'breaking news': 'noticias de última hora', 
            'newsroom': 'sala de redacción',
            'government': 'gobierno',
            'economic policies': 'políticas económicas',
            'weather conditions': 'condiciones climáticas',
            'president': 'presidente',
            'address': 'dirigirse',
            'nation': 'nación',
            'sports news': 'noticias deportivas',
            'championship': 'campeonato',
            'live updates': 'actualizaciones en vivo'
          },
          'fr': {
            'good evening': 'bonsoir',
            'breaking news': 'dernières nouvelles',
            'newsroom': 'salle de rédaction', 
            'government': 'gouvernement',
            'economic policies': 'politiques économiques',
            'weather conditions': 'conditions météorologiques',
            'president': 'président',
            'address': 'adresser',
            'nation': 'nation',
            'sports news': 'nouvelles sportives',
            'championship': 'championnat',
            'live updates': 'mises à jour en direct'
          }
        };

        let translatedText = text.toLowerCase();
        const langMap = translations[targetLanguage];
        
        if (langMap) {
          Object.entries(langMap).forEach(([en, translated]) => {
            translatedText = translatedText.replace(new RegExp(en, 'g'), translated);
          });
        }

        // Capitalize first letter
        translatedText = translatedText.charAt(0).toUpperCase() + translatedText.slice(1);
        
        const confidence = 0.7 + Math.random() * 0.2; // 0.7-0.9
        resolve({ translatedText, confidence });
      }, 100 + Math.random() * 200); // 100-300ms processing time
    });
  }

  private async processTTS(text: string, language: string): Promise<{ audioData: Float32Array; sampleRate: number } | null> {
    return new Promise((resolve) => {
      setTimeout(() => {
        // Generate mock audio data (sine wave for demo)
        const sampleRate = 22050;
        const duration = Math.min(5, text.length * 0.1); // ~0.1s per character, max 5s
        const samples = Math.floor(sampleRate * duration);
        const audioData = new Float32Array(samples);
        
        // Generate a simple tone sequence
        const baseFreq = 200; // Base frequency
        const words = text.split(' ').length;
        
        for (let i = 0; i < samples; i++) {
          const t = i / sampleRate;
          // Vary frequency based on word position to simulate speech prosody
          const freq = baseFreq + (Math.sin(t * words) * 50);
          const amplitude = 0.3 * Math.exp(-t * 0.5); // Fade out
          audioData[i] = amplitude * Math.sin(2 * Math.PI * freq * t);
        }
        
        resolve({ audioData, sampleRate });
      }, 200 + Math.random() * 400); // 200-600ms processing time
    });
  }
}

// Initialize service worker
new ExtensionServiceWorker()

// Export for testing
export { ExtensionServiceWorker }