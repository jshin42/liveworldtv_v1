import { ModelManager } from './model-manager'
import { TabManager } from './tab-manager'

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
}

class ExtensionServiceWorker {
  private modelManager: ModelManager
  private tabManager: TabManager
  private activeSessions = new Set<number>()
  private youtubeProcessingQueues = new Map<number, any[]>()

  constructor() {
    this.modelManager = new ModelManager()
    this.tabManager = new TabManager(this.modelManager)
    
    this.setupMessageHandlers()
    this.setupInstallHandler()
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
          const status = await this.modelManager.getStatus()
          sendResponse({ success: true, data: status })
          break

        case 'DOWNLOAD_MODELS':
          await this.modelManager.downloadAllModels()
          sendResponse({ success: true })
          break

        case 'get-model':
          if (message.modelName) {
            const modelData = await this.modelManager.getModel(message.modelName);
            if (modelData) {
              sendResponse({ success: true, modelData });
            } else {
              // Start download if not available
              console.log(`🔄 Model ${message.modelName} not cached, starting download...`);
              await this.modelManager.downloadModel({
                name: message.modelName as any,
                filename: `${message.modelName}.onnx`,
                url: this.getModelUrl(message.modelName),
                size: this.getModelSize(message.modelName),
                sha256: 'placeholder_hash',
                version: '1.0.0'
              });
              const modelData = await this.modelManager.getModel(message.modelName);
              sendResponse({ success: !!modelData, modelData });
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

    // 1. Ensure models are ready
    const modelsReady = await this.modelManager.ensureModelsReady()
    if (!modelsReady) {
      throw new Error('AI models not available')
    }

    // 2. Request tab capture permission
    const stream = await chrome.tabCapture.capture({
      audio: true,
      video: false
    })

    if (!stream) {
      throw new Error('Failed to capture tab audio')
    }

    // 3. Start dubbing session
    const started = await this.tabManager.startDubbing(tabId, 'en')

    // 4. Track active session
    this.activeSessions.add(tabId)

    // 5. Notify content script
    try {
      await chrome.tabs.sendMessage(tabId, {
        type: 'DUBBING_ENABLED',
        data: { 
          stream: stream,
          modelStatus: await this.modelManager.getStatus()
        }
      })
    } catch (error) {
      // Clean up if content script notification fails
      this.activeSessions.delete(tabId)
      throw error
    }

    console.log(`✅ Dubbing enabled for tab ${tabId}`)
  }

  private async disableDubbing(tabId: number): Promise<void> {
    if (!this.activeSessions.has(tabId)) {
      return // Already disabled
    }

    // 1. Stop dubbing session
    await this.tabManager.stopDubbing(tabId)

    // 2. Remove from active sessions
    this.activeSessions.delete(tabId)

    // 3. Notify content script
    try {
      await chrome.tabs.sendMessage(tabId, {
        type: 'DUBBING_DISABLED',
        data: {}
      })
    } catch (error) {
      // Content script may not be available, that's OK
      console.warn(`Could not notify content script for tab ${tabId}:`, error)
    }

    console.log(`🔇 Dubbing disabled for tab ${tabId}`)
  }

  private setupInstallHandler(): void {
    chrome.runtime.onInstalled.addListener(async (details) => {
      if (details.reason === 'install') {
        console.log('🎉 LiveWorldTV extension installed')
        
        // Start downloading models in background
        this.modelManager.downloadAllModels().catch(error => {
          console.error('Background model download failed:', error)
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
      console.log(`🎥 Starting YouTube dubbing for tab ${tabId}: English → ${targetLanguage}`);
      
      // Ensure models are ready
      const modelsReady = await this.modelManager.ensureModelsReady();
      if (!modelsReady) {
        console.error('❌ AI models not ready');
        return false;
      }

      // Initialize processing queue for this tab
      this.youtubeProcessingQueues.set(tabId, []);
      
      // Mark session as active
      this.activeSessions.add(tabId);

      // Send message to YouTube content script to start dubbing
      await chrome.tabs.sendMessage(tabId, {
        type: 'START_YOUTUBE_DUBBING',
        data: { targetLanguage }
      });

      console.log(`✅ YouTube dubbing started for tab ${tabId}`);
      return true;

    } catch (error) {
      console.error('❌ Failed to start YouTube dubbing:', error);
      return false;
    }
  }

  private async stopYouTubeDubbing(tabId: number): Promise<void> {
    try {
      console.log(`🔇 Stopping YouTube dubbing for tab ${tabId}`);

      // Remove from active sessions
      this.activeSessions.delete(tabId);
      
      // Clear processing queue
      this.youtubeProcessingQueues.delete(tabId);

      // Send message to YouTube content script to stop dubbing
      await chrome.tabs.sendMessage(tabId, {
        type: 'STOP_YOUTUBE_DUBBING'
      });

      console.log(`✅ YouTube dubbing stopped for tab ${tabId}`);

    } catch (error) {
      console.error('❌ Failed to stop YouTube dubbing:', error);
    }
  }

  private async processYouTubeAudioChunk(message: ExtensionMessage, tabId: number): Promise<void> {
    if (!this.activeSessions.has(tabId)) {
      return; // Session not active
    }

    try {
      const { id, audioData, sampleRate, targetLanguage, timestamp } = message.data;
      
      console.log(`🎵 Processing YouTube audio chunk: ${id}`);

      // Convert audio data back to Float32Array
      const audioFloat32 = new Float32Array(audioData);

      // Process through AI pipeline:
      // 1. ASR: Convert speech to text
      const transcription = await this.processASR(audioFloat32, sampleRate);
      
      if (!transcription || transcription.confidence < 0.4) {
        console.log(`⏭️ Skipping low-confidence transcription: ${transcription?.text}`);
        return;
      }

      console.log(`📝 Transcribed: "${transcription.text}" (confidence: ${transcription.confidence})`);

      // 2. MT: Translate to target language  
      const translation = await this.processMT(transcription.text, 'en', targetLanguage);
      
      if (!translation || translation.confidence < 0.3) {
        console.log(`⏭️ Skipping low-confidence translation`);
        return;
      }

      console.log(`🌐 Translated: "${translation.translatedText}" (${targetLanguage})`);

      // 3. TTS: Generate speech in target language
      const synthesis = await this.processTTS(translation.translatedText, targetLanguage);
      
      if (!synthesis || !synthesis.audioData || synthesis.audioData.length === 0) {
        console.log(`⏭️ Skipping empty TTS synthesis`);
        return;
      }

      console.log(`🎙️ Synthesized audio: ${synthesis.audioData.length} samples at ${synthesis.sampleRate}Hz`);

      // 4. Send dubbed audio back to YouTube content script
      await chrome.tabs.sendMessage(tabId, {
        type: 'DUBBED_AUDIO_READY',
        data: {
          chunkId: id,
          audioData: Array.from(synthesis.audioData),
          sampleRate: synthesis.sampleRate,
          originalText: transcription.text,
          translatedText: translation.translatedText,
          processingLatency: Date.now() - timestamp
        }
      });

      console.log(`✅ Dubbed audio sent to tab ${tabId} for chunk ${id}`);

    } catch (error) {
      console.error('❌ YouTube audio processing error:', error);
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