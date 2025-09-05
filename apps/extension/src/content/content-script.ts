import { ChannelConfig, DubbingSession } from '@shared';

interface ContentScriptMessage {
  type: string;
  data: any;
}

class LiveWorldTVContentScript {
  private channelConfig?: ChannelConfig;
  private dubbingSession?: DubbingSession;
  private dubbingButton?: HTMLElement;
  private audioContext?: AudioContext;
  private gainNode?: GainNode;

  constructor() {
    this.setupMessageListener();
    this.injectUI();
  }

  private setupMessageListener(): void {
    chrome.runtime.onMessage.addListener((message: ContentScriptMessage, sender, sendResponse) => {
      switch (message.type) {
        case 'channel-detected':
          this.handleChannelDetected(message.data);
          break;
        case 'dubbing-started':
          this.handleDubbingStarted(message.data);
          break;
        case 'dubbing-stopped':
          this.handleDubbingStopped();
          break;
      }
    });
  }

  private injectUI(): void {
    if (document.getElementById('liveworldtv-controls')) {
      return;
    }

    const container = document.createElement('div');
    container.id = 'liveworldtv-controls';
    container.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      z-index: 9999;
      background: rgba(0, 0, 0, 0.8);
      padding: 10px;
      border-radius: 8px;
      font-family: system-ui, -apple-system, sans-serif;
      color: white;
      font-size: 14px;
      display: none;
      min-width: 200px;
    `;

    const title = document.createElement('div');
    title.textContent = 'LiveWorldTV';
    title.style.cssText = `
      font-weight: bold;
      margin-bottom: 8px;
      font-size: 16px;
    `;
    container.appendChild(title);

    const status = document.createElement('div');
    status.id = 'liveworldtv-status';
    status.textContent = 'No channel detected';
    status.style.cssText = `
      margin-bottom: 8px;
      color: #ccc;
    `;
    container.appendChild(status);

    const languageSelect = document.createElement('select');
    languageSelect.id = 'liveworldtv-language';
    languageSelect.style.cssText = `
      width: 100%;
      padding: 4px;
      margin-bottom: 8px;
      background: #333;
      color: white;
      border: 1px solid #555;
      border-radius: 4px;
    `;
    
    const languages = [
      { code: 'en', name: 'English' },
      { code: 'es', name: 'Spanish' },
      { code: 'fr', name: 'French' },
      { code: 'de', name: 'German' },
      { code: 'it', name: 'Italian' },
      { code: 'pt', name: 'Portuguese' },
      { code: 'ru', name: 'Russian' },
      { code: 'ja', name: 'Japanese' },
      { code: 'ko', name: 'Korean' },
      { code: 'zh', name: 'Chinese' }
    ];

    languages.forEach(lang => {
      const option = document.createElement('option');
      option.value = lang.code;
      option.textContent = lang.name;
      languageSelect.appendChild(option);
    });
    container.appendChild(languageSelect);

    this.dubbingButton = document.createElement('button');
    this.dubbingButton.id = 'liveworldtv-toggle';
    this.dubbingButton.textContent = 'Start Dubbing';
    this.dubbingButton.style.cssText = `
      width: 100%;
      padding: 8px;
      background: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    `;
    this.dubbingButton.disabled = true;
    this.dubbingButton.addEventListener('click', () => this.toggleDubbing());
    container.appendChild(this.dubbingButton);

    document.body.appendChild(container);
  }

  private handleChannelDetected(channelConfig: ChannelConfig): void {
    this.channelConfig = channelConfig;
    
    const container = document.getElementById('liveworldtv-controls');
    const status = document.getElementById('liveworldtv-status');
    
    if (container && status && this.dubbingButton) {
      container.style.display = 'block';
      status.textContent = `Channel: ${channelConfig.name} (${channelConfig.language})`;
      this.dubbingButton.disabled = false;
    }
  }

  private handleDubbingStarted(data: { session: DubbingSession; outputStream: MediaStream }): void {
    this.dubbingSession = data.session;
    
    if (this.dubbingButton) {
      this.dubbingButton.textContent = 'Stop Dubbing';
      this.dubbingButton.style.background = '#dc3545';
    }

    this.setupAudioProcessing(data.outputStream);
  }

  private handleDubbingStopped(): void {
    this.dubbingSession = undefined;
    
    if (this.dubbingButton) {
      this.dubbingButton.textContent = 'Start Dubbing';
      this.dubbingButton.style.background = '#007bff';
    }

    this.cleanupAudioProcessing();
  }

  private async toggleDubbing(): Promise<void> {
    if (!this.channelConfig) {
      return;
    }

    const languageSelect = document.getElementById('liveworldtv-language') as HTMLSelectElement;
    const targetLanguage = languageSelect?.value || 'en';

    if (this.dubbingSession) {
      await chrome.runtime.sendMessage({
        type: 'stop-dubbing',
        tabId: await this.getCurrentTabId()
      });
    } else {
      await chrome.runtime.sendMessage({
        type: 'start-dubbing',
        tabId: await this.getCurrentTabId(),
        targetLanguage
      });
    }
  }

  private setupAudioProcessing(outputStream: MediaStream): void {
    try {
      this.audioContext = new AudioContext();
      this.gainNode = this.audioContext.createGain();
      
      const outputSource = this.audioContext.createMediaStreamSource(outputStream);
      outputSource.connect(this.gainNode);
      this.gainNode.connect(this.audioContext.destination);
      
      this.muteOriginalAudio();
      
      console.log('🎵 Dubbed audio stream connected');
    } catch (error) {
      console.error('Failed to setup audio processing:', error);
    }
  }

  private cleanupAudioProcessing(): void {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = undefined;
      this.gainNode = undefined;
    }
    
    this.restoreOriginalAudio();
  }

  private muteOriginalAudio(): void {
    const videos = document.querySelectorAll('video, audio');
    videos.forEach((element: HTMLMediaElement) => {
      element.muted = true;
    });
  }

  private restoreOriginalAudio(): void {
    const videos = document.querySelectorAll('video, audio');
    videos.forEach((element: HTMLMediaElement) => {
      element.muted = false;
    });
  }

  private async getCurrentTabId(): Promise<number> {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs[0]?.id || 0;
  }
}

new LiveWorldTVContentScript();