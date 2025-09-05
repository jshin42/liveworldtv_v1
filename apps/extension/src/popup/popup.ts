interface ModelStatus {
  name: string;
  ready: boolean;
  downloading: boolean;
  progress: number;
  size: number;
}

interface PopupState {
  isChannelSupported: boolean;
  channelName?: string;
  isDubbingActive: boolean;
  modelStatuses: ModelStatus[];
}

class PopupController {
  private state: PopupState = {
    isChannelSupported: false,
    isDubbingActive: false,
    modelStatuses: []
  };

  constructor() {
    this.initializePopup();
  }

  private async initializePopup(): Promise<void> {
    await this.loadCurrentTabInfo();
    await this.loadModelStatuses();
    this.setupEventListeners();
    this.updateUI();
    this.startStatusPolling();
  }

  private async loadCurrentTabInfo(): Promise<void> {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentTab = tabs[0];
      
      if (!currentTab?.id || !currentTab.url) {
        return;
      }

      const response = await chrome.runtime.sendMessage({
        type: 'get-active-sessions'
      });

      if (response.success) {
        const activeSession = response.sessions.find(
          (session: any) => session.tabId === currentTab.id
        );
        this.state.isDubbingActive = !!activeSession;
      }

      this.state.isChannelSupported = this.isSupportedSite(currentTab.url);
      
      if (this.state.isChannelSupported) {
        await this.checkChannelInfo(currentTab.url);
      }
    } catch (error) {
      console.error('Failed to load tab info:', error);
    }
  }

  private async checkChannelInfo(url: string): Promise<void> {
    try {
      const response = await fetch('http://localhost:3001/api/v1/channels/match-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      if (response.ok) {
        const channelConfig = await response.json();
        this.state.channelName = channelConfig.name;
      }
    } catch (error) {
      console.warn('Failed to get channel info:', error);
    }
  }

  private async loadModelStatuses(): Promise<void> {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'get-model-status'
      });

      if (response.success && response.status) {
        this.state.modelStatuses = response.status;
      }
    } catch (error) {
      console.error('Failed to load model statuses:', error);
    }
  }

  private setupEventListeners(): void {
    const dubbingToggle = document.getElementById('dubbing-toggle') as HTMLButtonElement;
    
    dubbingToggle?.addEventListener('click', async () => {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentTab = tabs[0];
      
      if (!currentTab?.id) {
        return;
      }

      const languageSelect = document.getElementById('language-select') as HTMLSelectElement;
      const targetLanguage = languageSelect.value;

      if (this.state.isDubbingActive) {
        await this.stopDubbing(currentTab.id);
      } else {
        await this.startDubbing(currentTab.id, targetLanguage);
      }
    });
  }

  private async startDubbing(tabId: number, targetLanguage: string): Promise<void> {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'start-dubbing',
        tabId,
        targetLanguage
      });

      if (response.success) {
        this.state.isDubbingActive = true;
        this.updateUI();
      } else {
        this.showError('Failed to start dubbing');
      }
    } catch (error) {
      console.error('Failed to start dubbing:', error);
      this.showError('Error starting dubbing');
    }
  }

  private async stopDubbing(tabId: number): Promise<void> {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'stop-dubbing',
        tabId
      });

      if (response.success) {
        this.state.isDubbingActive = false;
        this.updateUI();
      }
    } catch (error) {
      console.error('Failed to stop dubbing:', error);
    }
  }

  private updateUI(): void {
    this.updatePageStatus();
    this.updateDubbingControls();
    this.updateModelStatuses();
  }

  private updatePageStatus(): void {
    const pageStatus = document.getElementById('page-status');
    const channelInfo = document.getElementById('channel-info');
    const channelName = document.getElementById('channel-name');

    if (!pageStatus) return;

    const indicator = pageStatus.querySelector('.status-indicator');
    
    if (this.state.isChannelSupported) {
      indicator?.classList.remove('inactive');
      indicator?.classList.add('active');
      pageStatus.innerHTML = `
        <span class="status-indicator active"></span>
        Supported video site
      `;
      
      if (this.state.channelName && channelInfo && channelName) {
        channelName.textContent = this.state.channelName;
        channelInfo.style.display = 'block';
      }
    } else {
      indicator?.classList.remove('active');
      indicator?.classList.add('inactive');
      pageStatus.innerHTML = `
        <span class="status-indicator inactive"></span>
        Unsupported site
      `;
      
      if (channelInfo) {
        channelInfo.style.display = 'none';
      }
    }
  }

  private updateDubbingControls(): void {
    const dubbingToggle = document.getElementById('dubbing-toggle') as HTMLButtonElement;
    const dubbingStatus = document.getElementById('dubbing-status');

    if (!dubbingToggle) return;

    const modelsReady = this.state.modelStatuses.every(model => model.ready);
    
    dubbingToggle.disabled = !this.state.isChannelSupported || !modelsReady;
    
    if (this.state.isDubbingActive) {
      dubbingToggle.textContent = 'Stop Dubbing';
      dubbingToggle.className = 'button button-danger';
      
      if (dubbingStatus) {
        dubbingStatus.style.display = 'flex';
      }
    } else {
      dubbingToggle.textContent = modelsReady ? 'Start Dubbing' : 'Models Loading...';
      dubbingToggle.className = 'button button-primary';
      
      if (dubbingStatus) {
        dubbingStatus.style.display = 'none';
      }
    }
  }

  private updateModelStatuses(): void {
    const modelElements = {
      'distil-whisper': document.getElementById('model-whisper'),
      'nllb-distilled': document.getElementById('model-nllb'),
      'kokoro-82m': document.getElementById('model-kokoro')
    };

    this.state.modelStatuses.forEach(model => {
      const element = modelElements[model.name as keyof typeof modelElements];
      if (!element) return;

      const indicator = element.querySelector('.status-indicator');
      const progressFill = element.querySelector('.progress-fill') as HTMLElement;

      if (model.ready) {
        indicator?.classList.remove('loading');
        indicator?.classList.add('active');
        element.innerHTML = element.innerHTML.replace(/: .*$/, ': Ready');
        if (progressFill) {
          progressFill.style.width = '100%';
        }
      } else if (model.downloading) {
        indicator?.classList.remove('inactive');
        indicator?.classList.add('loading');
        const progressText = `Downloading... ${Math.round(model.progress)}%`;
        element.innerHTML = element.innerHTML.replace(/: .*$/, `: ${progressText}`);
        if (progressFill) {
          progressFill.style.width = `${model.progress}%`;
        }
      } else {
        indicator?.classList.remove('active', 'loading');
        indicator?.classList.add('inactive');
        element.innerHTML = element.innerHTML.replace(/: .*$/, ': Not downloaded');
        if (progressFill) {
          progressFill.style.width = '0%';
        }
      }
    });
  }

  private isSupportedSite(url: string): boolean {
    const supportedDomains = [
      'youtube.com',
      'twitch.tv',
      'dailymotion.com', 
      'vimeo.com'
    ];
    
    try {
      const domain = new URL(url).hostname.replace('www.', '');
      return supportedDomains.some(supported => domain.includes(supported));
    } catch {
      return false;
    }
  }

  private startStatusPolling(): void {
    setInterval(async () => {
      await this.loadCurrentTabInfo();
      await this.loadModelStatuses();
      this.updateUI();
    }, 2000);
  }

  private showError(message: string): void {
    console.error(message);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});