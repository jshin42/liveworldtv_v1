// YouTube Content Script - Captures and dubs live YouTube videos
// Integrates with YouTube's audio stream and injects dubbed audio

interface YouTubePlayerState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  videoId: string;
}

interface DubbingSession {
  active: boolean;
  targetLanguage: string;
  audioContext: AudioContext | null;
  originalAudioNode: MediaElementAudioSourceNode | null;
  dubbedAudioNode: AudioBufferSourceNode | null;
  gainNode: GainNode | null;
  outputNode: MediaStreamAudioDestinationNode | null;
}

class YouTubeContentScript {
  private playerState: YouTubePlayerState = {
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 1,
    videoId: ''
  };

  private dubbingSession: DubbingSession = {
    active: false,
    targetLanguage: 'es',
    audioContext: null,
    originalAudioNode: null,
    dubbedAudioNode: null,
    gainNode: null,
    outputNode: null
  };

  private videoElement: HTMLVideoElement | null = null;
  private observer: MutationObserver | null = null;
  private audioChunkBuffer: Float32Array[] = [];
  private processingQueue: { id: string; audioData: Float32Array; timestamp: number }[] = [];

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    console.log('🎥 YouTube Content Script initializing...');
    
    // Wait for YouTube to load
    await this.waitForYouTube();
    
    // Find video element
    this.findVideoElement();
    
    // Set up mutation observer for dynamic content
    this.setupMutationObserver();
    
    // Listen for messages from extension
    this.setupMessageHandlers();
    
    console.log('✅ YouTube Content Script ready');
  }

  private async waitForYouTube(): Promise<void> {
    return new Promise((resolve) => {
      const checkYouTube = () => {
        if (window.location.hostname.includes('youtube.com') && 
            (document.querySelector('video') || document.querySelector('#player'))) {
          resolve();
        } else {
          setTimeout(checkYouTube, 100);
        }
      };
      checkYouTube();
    });
  }

  private findVideoElement(): void {
    // YouTube video selectors
    const selectors = [
      'video.html5-main-video',
      'video.video-stream',
      '.html5-video-player video',
      '#player video',
      'video'
    ];

    for (const selector of selectors) {
      const video = document.querySelector(selector) as HTMLVideoElement;
      if (video && video.tagName === 'VIDEO') {
        this.videoElement = video;
        this.setupVideoEventListeners();
        this.extractVideoInfo();
        console.log('📺 Found YouTube video element:', video);
        break;
      }
    }

    if (!this.videoElement) {
      console.warn('⚠️ No YouTube video element found, retrying...');
      setTimeout(() => this.findVideoElement(), 1000);
    }
  }

  private setupVideoEventListeners(): void {
    if (!this.videoElement) return;

    this.videoElement.addEventListener('play', () => {
      this.playerState.isPlaying = true;
      console.log('▶️ YouTube video playing');
    });

    this.videoElement.addEventListener('pause', () => {
      this.playerState.isPlaying = false;
      console.log('⏸️ YouTube video paused');
    });

    this.videoElement.addEventListener('timeupdate', () => {
      this.playerState.currentTime = this.videoElement!.currentTime;
    });

    this.videoElement.addEventListener('volumechange', () => {
      this.playerState.volume = this.videoElement!.volume;
    });

    this.videoElement.addEventListener('loadedmetadata', () => {
      this.playerState.duration = this.videoElement!.duration;
      this.extractVideoInfo();
    });
  }

  private extractVideoInfo(): void {
    // Extract YouTube video ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const videoId = urlParams.get('v') || this.extractVideoIdFromUrl();
    
    if (videoId !== this.playerState.videoId) {
      this.playerState.videoId = videoId;
      console.log('🎬 New YouTube video detected:', videoId);
      
      // Notify extension about new video
      this.sendMessageToBackground({
        type: 'YOUTUBE_VIDEO_DETECTED',
        data: {
          videoId,
          title: this.getVideoTitle(),
          channel: this.getChannelName(),
          duration: this.playerState.duration
        }
      });
    }
  }

  private extractVideoIdFromUrl(): string {
    const match = window.location.href.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
    return match ? match[1] : '';
  }

  private getVideoTitle(): string {
    const titleSelectors = [
      'h1.title.style-scope.ytd-video-primary-info-renderer',
      '.ytd-video-primary-info-renderer h1',
      '#container h1',
      'h1'
    ];

    for (const selector of titleSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        return element.textContent?.trim() || 'Unknown Title';
      }
    }
    return 'Unknown Title';
  }

  private getChannelName(): string {
    const channelSelectors = [
      '#upload-info #channel-name a',
      '.ytd-channel-name a',
      '#owner-text a'
    ];

    for (const selector of channelSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        return element.textContent?.trim() || 'Unknown Channel';
      }
    }
    return 'Unknown Channel';
  }

  private setupMutationObserver(): void {
    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        // Check for new video elements
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element;
              if (element.tagName === 'VIDEO' || element.querySelector('video')) {
                this.findVideoElement();
              }
            }
          });
        }
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  private setupMessageHandlers(): void {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep message channel open
    });
  }

  private async handleMessage(message: any, sender: chrome.runtime.MessageSender, sendResponse: Function): Promise<void> {
    console.log('📨 YouTube content script received message:', message.type);

    try {
      switch (message.type) {
        case 'START_YOUTUBE_DUBBING':
          const success = await this.startDubbing(message.data.targetLanguage);
          sendResponse({ success });
          break;

        case 'STOP_YOUTUBE_DUBBING':
          await this.stopDubbing();
          sendResponse({ success: true });
          break;

        case 'GET_PLAYER_STATE':
          sendResponse({ success: true, data: this.playerState });
          break;

        case 'UPDATE_DUBBING_LANGUAGE':
          if (this.dubbingSession.active) {
            this.dubbingSession.targetLanguage = message.data.targetLanguage;
            sendResponse({ success: true });
          } else {
            sendResponse({ success: false, error: 'Dubbing not active' });
          }
          break;

        default:
          sendResponse({ success: false, error: `Unknown message type: ${message.type}` });
      }
    } catch (error) {
      console.error('❌ Message handler error:', error);
      sendResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  private async startDubbing(targetLanguage: string): Promise<boolean> {
    if (!this.videoElement) {
      console.error('❌ No video element found for dubbing');
      return false;
    }

    if (this.dubbingSession.active) {
      console.warn('⚠️ Dubbing already active');
      return true;
    }

    try {
      console.log(`🎙️ Starting YouTube dubbing: English → ${targetLanguage}`);

      // Initialize Web Audio API
      this.dubbingSession.audioContext = new AudioContext({
        sampleRate: 22050,
        latencyHint: 'interactive'
      });

      // Create audio nodes
      this.dubbingSession.originalAudioNode = this.dubbingSession.audioContext
        .createMediaElementSource(this.videoElement);

      this.dubbingSession.gainNode = this.dubbingSession.audioContext.createGain();
      
      this.dubbingSession.outputNode = this.dubbingSession.audioContext
        .createMediaStreamDestination();

      // Connect original audio with reduced volume (ducking)
      this.dubbingSession.originalAudioNode
        .connect(this.dubbingSession.gainNode)
        .connect(this.dubbingSession.outputNode);

      // Reduce original audio volume for dubbing
      this.dubbingSession.gainNode.gain.value = 0.2; // -14dB ducking

      // Set up audio processing
      this.setupAudioProcessing();

      // Update session state
      this.dubbingSession.active = true;
      this.dubbingSession.targetLanguage = targetLanguage;

      // Replace video audio with our mixed output
      this.redirectAudioOutput();

      console.log('✅ YouTube dubbing started successfully');
      return true;

    } catch (error) {
      console.error('❌ Failed to start YouTube dubbing:', error);
      await this.stopDubbing();
      return false;
    }
  }

  private setupAudioProcessing(): void {
    if (!this.dubbingSession.audioContext) return;

    // Create audio worklet for real-time processing
    const processorNode = this.dubbingSession.audioContext.createScriptProcessor(
      4096, // Buffer size
      1,    // Input channels
      1     // Output channels
    );

    processorNode.onaudioprocess = (event) => {
      if (!this.dubbingSession.active) return;

      const inputBuffer = event.inputBuffer.getChannelData(0);
      const timestamp = performance.now();
      
      // Buffer audio chunks for processing
      this.bufferAudioChunk(new Float32Array(inputBuffer), timestamp);
    };

    // Connect to audio graph
    this.dubbingSession.originalAudioNode!.connect(processorNode);
    processorNode.connect(this.dubbingSession.audioContext.destination);
  }

  private bufferAudioChunk(audioData: Float32Array, timestamp: number): void {
    const chunkId = `youtube_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Add to processing queue
    this.processingQueue.push({
      id: chunkId,
      audioData,
      timestamp
    });

    // Send to AI pipeline via background script
    this.sendMessageToBackground({
      type: 'PROCESS_AUDIO_CHUNK',
      data: {
        id: chunkId,
        audioData: Array.from(audioData), // Convert for message passing
        sampleRate: 22050,
        targetLanguage: this.dubbingSession.targetLanguage,
        timestamp
      }
    });
  }

  private redirectAudioOutput(): void {
    if (!this.videoElement || !this.dubbingSession.outputNode) return;

    try {
      // Create new audio element for dubbed output
      const dubbedAudio = document.createElement('audio');
      dubbedAudio.srcObject = this.dubbingSession.outputNode.stream;
      dubbedAudio.play();

      // Mute original video element
      this.videoElement.muted = true;

      // Sync dubbed audio with video
      this.syncDubbedAudio(dubbedAudio);

      console.log('🔊 Audio output redirected to dubbed stream');
    } catch (error) {
      console.error('❌ Failed to redirect audio output:', error);
    }
  }

  private syncDubbedAudio(dubbedAudio: HTMLAudioElement): void {
    const syncInterval = setInterval(() => {
      if (!this.dubbingSession.active || !this.videoElement) {
        clearInterval(syncInterval);
        return;
      }

      // Sync volume
      dubbedAudio.volume = this.videoElement.volume;

      // Sync play/pause state
      if (this.videoElement.paused && !dubbedAudio.paused) {
        dubbedAudio.pause();
      } else if (!this.videoElement.paused && dubbedAudio.paused) {
        dubbedAudio.play();
      }
    }, 100);
  }

  private async stopDubbing(): Promise<void> {
    console.log('🔇 Stopping YouTube dubbing...');

    if (this.dubbingSession.audioContext) {
      await this.dubbingSession.audioContext.close();
    }

    // Restore original video audio
    if (this.videoElement) {
      this.videoElement.muted = false;
    }

    // Reset session
    this.dubbingSession = {
      active: false,
      targetLanguage: 'es',
      audioContext: null,
      originalAudioNode: null,
      dubbedAudioNode: null,
      gainNode: null,
      outputNode: null
    };

    // Clear processing queue
    this.processingQueue = [];
    this.audioChunkBuffer = [];

    console.log('✅ YouTube dubbing stopped');
  }

  private sendMessageToBackground(message: any): void {
    chrome.runtime.sendMessage(message).catch((error) => {
      console.warn('⚠️ Failed to send message to background:', error);
    });
  }

  // Handle dubbed audio from AI pipeline
  public receiveDubbedAudio(chunkId: string, audioData: Float32Array, sampleRate: number): void {
    if (!this.dubbingSession.active || !this.dubbingSession.audioContext) return;

    try {
      // Create audio buffer for dubbed speech
      const audioBuffer = this.dubbingSession.audioContext.createBuffer(1, audioData.length, sampleRate);
      audioBuffer.getChannelData(0).set(audioData);

      // Create buffer source
      const bufferSource = this.dubbingSession.audioContext.createBufferSource();
      bufferSource.buffer = audioBuffer;

      // Connect to output with higher volume
      const dubbedGain = this.dubbingSession.audioContext.createGain();
      dubbedGain.gain.value = 0.8; // -2dB for dubbed audio

      bufferSource.connect(dubbedGain).connect(this.dubbingSession.outputNode!);

      // Play dubbed audio
      bufferSource.start();

      console.log(`🎵 Playing dubbed audio chunk: ${chunkId}`);
    } catch (error) {
      console.error('❌ Failed to play dubbed audio:', error);
    }
  }

  public getPlayerState(): YouTubePlayerState {
    return { ...this.playerState };
  }

  public getDubbingState(): { active: boolean; targetLanguage: string } {
    return {
      active: this.dubbingSession.active,
      targetLanguage: this.dubbingSession.targetLanguage
    };
  }
}

// Initialize YouTube content script
const youtubeScript = new YouTubeContentScript();

// Export for background script communication
(window as any).youtubeScript = youtubeScript;

// Handle dubbed audio messages from background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'DUBBED_AUDIO_READY') {
    const { chunkId, audioData, sampleRate } = message.data;
    youtubeScript.receiveDubbedAudio(chunkId, new Float32Array(audioData), sampleRate);
    sendResponse({ success: true });
  }
});

console.log('🎥 YouTube Content Script loaded and ready!');