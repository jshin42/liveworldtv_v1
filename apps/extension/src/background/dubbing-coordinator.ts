// Dubbing Coordinator - Main orchestrator for live AI dubbing
// Manages the ASR→MT→TTS pipeline with audio mixing

import { AudioMixer } from './audio-mixer';
import { ModelManager } from './model-manager';

interface DubbingSession {
  tabId: number;
  targetLanguage: string;
  audioMixer: AudioMixer;
  inputStream: MediaStream | null;
  outputDestination: MediaStreamAudioDestinationNode | null;
  startTime: number;
  isActive: boolean;
}

interface DubbingMetrics {
  sessionId: string;
  averageLatency: number;
  processedChunks: number;
  errorCount: number;
  qualityScore: number;
}

export class DubbingCoordinator {
  private modelManager: ModelManager;
  private activeSessions = new Map<number, DubbingSession>();
  private sessionMetrics = new Map<string, DubbingMetrics>();

  constructor() {
    this.modelManager = new ModelManager();
  }

  async startDubbing(tabId: number, targetLanguage: string): Promise<{ success: boolean; sessionId: string }> {
    try {
      // Check if models are ready
      const modelsReady = await this.checkModelsReady();
      if (!modelsReady) {
        throw new Error('AI models not ready');
      }

      // Stop any existing session for this tab
      await this.stopDubbing(tabId);

      // Create audio mixer with optimized settings
      const audioMixer = new AudioMixer({
        targetLanguage,
        originalVolume: 0.15, // Duck original to -16dB
        dubbedVolume: 0.8,    // Dubbed audio at -2dB
        latencyTargetMs: 1500, // Target 1.5s latency
        chunkSizeMs: 1000     // 1s chunks for processing
      });

      await audioMixer.initialize();

      // Capture tab audio
      const inputStream = await chrome.tabCapture.capture({
        audio: true,
        video: false
      });

      if (!inputStream) {
        throw new Error('Failed to capture tab audio');
      }

      // Start dubbing pipeline
      const outputDestination = await audioMixer.startDubbing(inputStream);

      const session: DubbingSession = {
        tabId,
        targetLanguage,
        audioMixer,
        inputStream,
        outputDestination,
        startTime: Date.now(),
        isActive: true
      };

      this.activeSessions.set(tabId, session);

      const sessionId = `session_${tabId}_${Date.now()}`;
      this.initializeSessionMetrics(sessionId);

      // Notify content script that dubbing is active
      chrome.tabs.sendMessage(tabId, {
        type: 'dubbing-started',
        sessionId,
        targetLanguage
      }).catch(() => {});

      return { success: true, sessionId };

    } catch (error) {
      console.error('Failed to start dubbing:', error);
      return { success: false, sessionId: '' };
    }
  }

  async stopDubbing(tabId: number): Promise<{ success: boolean }> {
    try {
      const session = this.activeSessions.get(tabId);
      if (!session) {
        return { success: true }; // Nothing to stop
      }

      // Stop audio processing
      await session.audioMixer.stopDubbing();

      // Stop input stream
      if (session.inputStream) {
        session.inputStream.getTracks().forEach(track => track.stop());
      }

      // Clean up session
      this.activeSessions.delete(tabId);

      // Calculate final metrics
      const sessionDuration = Date.now() - session.startTime;
      console.log(`🔇 Dubbing session ended. Duration: ${sessionDuration}ms`);

      // Notify content script
      chrome.tabs.sendMessage(tabId, {
        type: 'dubbing-stopped'
      }).catch(() => {});

      return { success: true };

    } catch (error) {
      console.error('Failed to stop dubbing:', error);
      return { success: false };
    }
  }

  async updateLanguage(tabId: number, targetLanguage: string): Promise<{ success: boolean }> {
    const session = this.activeSessions.get(tabId);
    if (!session || !session.isActive) {
      return { success: false };
    }

    try {
      // Update mixer configuration
      await session.audioMixer.updateConfig({ targetLanguage });
      session.targetLanguage = targetLanguage;

      // Notify content script
      chrome.tabs.sendMessage(tabId, {
        type: 'language-updated',
        targetLanguage
      }).catch(() => {});

      return { success: true };

    } catch (error) {
      console.error('Failed to update language:', error);
      return { success: false };
    }
  }

  private async checkModelsReady(): Promise<boolean> {
    const models = ['distil-whisper', 'nllb-200', 'kokoro-82m'] as const;
    
    for (const model of models) {
      const isReady = await this.modelManager.isModelReady(model);
      if (!isReady) {
        console.warn(`Model not ready: ${model}`);
        return false;
      }
    }
    
    return true;
  }

  private initializeSessionMetrics(sessionId: string): void {
    this.sessionMetrics.set(sessionId, {
      sessionId,
      averageLatency: 0,
      processedChunks: 0,
      errorCount: 0,
      qualityScore: 0
    });
  }

  updateSessionMetrics(sessionId: string, latency: number, hasError: boolean = false): void {
    const metrics = this.sessionMetrics.get(sessionId);
    if (!metrics) return;

    metrics.processedChunks++;
    
    if (hasError) {
      metrics.errorCount++;
    } else {
      // Update rolling average latency
      const alpha = 0.1; // Smoothing factor
      metrics.averageLatency = metrics.averageLatency * (1 - alpha) + latency * alpha;
    }

    // Calculate quality score (lower latency + fewer errors = higher quality)
    const errorRate = metrics.errorCount / Math.max(1, metrics.processedChunks);
    const latencyScore = Math.max(0, 1 - (metrics.averageLatency / 3000)); // 3s max
    metrics.qualityScore = (1 - errorRate) * 0.6 + latencyScore * 0.4;

    this.sessionMetrics.set(sessionId, metrics);
  }

  getActiveSessions(): DubbingSession[] {
    return Array.from(this.activeSessions.values());
  }

  getSessionMetrics(sessionId: string): DubbingMetrics | null {
    return this.sessionMetrics.get(sessionId) || null;
  }

  getAllMetrics(): DubbingMetrics[] {
    return Array.from(this.sessionMetrics.values());
  }

  async downloadAllModels(): Promise<{ success: boolean; results: any[] }> {
    const models = ['distil-whisper', 'nllb-200', 'kokoro-82m'] as const;
    const results = [];

    for (const model of models) {
      try {
        await this.modelManager.downloadModel(model);
        results.push({ model, success: true });
      } catch (error) {
        results.push({ 
          model, 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    const allSuccessful = results.every(r => r.success);
    return { success: allSuccessful, results };
  }

  // Performance monitoring
  getSystemStatus() {
    const activeSessions = this.activeSessions.size;
    const totalMetrics = Array.from(this.sessionMetrics.values());
    
    const averageQuality = totalMetrics.length > 0
      ? totalMetrics.reduce((sum, m) => sum + m.qualityScore, 0) / totalMetrics.length
      : 0;

    const averageLatency = totalMetrics.length > 0
      ? totalMetrics.reduce((sum, m) => sum + m.averageLatency, 0) / totalMetrics.length
      : 0;

    return {
      activeSessions,
      averageQuality,
      averageLatency,
      totalProcessedChunks: totalMetrics.reduce((sum, m) => sum + m.processedChunks, 0),
      totalErrors: totalMetrics.reduce((sum, m) => sum + m.errorCount, 0),
      memoryUsage: this.estimateMemoryUsage()
    };
  }

  private estimateMemoryUsage(): number {
    // Rough memory estimation for monitoring
    const sessionCount = this.activeSessions.size;
    const metricsCount = this.sessionMetrics.size;
    
    // Each session: ~50KB, each metric: ~1KB
    return sessionCount * 50000 + metricsCount * 1000;
  }
}