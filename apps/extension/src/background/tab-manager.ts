import { ChannelConfig, DubbingSession, TabInfo } from '@shared';
import { ModelManager } from './model-manager';
import { AIPipeline } from './ai-pipeline';

interface ActiveTab {
  tabId: number;
  url: string;
  channelConfig?: ChannelConfig;
  dubbingSession?: DubbingSession;
  audioStream?: MediaStream;
  outputStream?: MediaStream;
  aiPipeline?: AIPipeline;
  lastActivity: number;
}

export class TabManager {
  private activeTabs = new Map<number, ActiveTab>();
  private readonly INACTIVE_TIMEOUT = 5 * 60 * 1000; // 5 minutes
  private modelManager: ModelManager;

  constructor(modelManager: ModelManager) {
    this.modelManager = modelManager;
    this.setupTabListeners();
    this.startCleanupTimer();
  }

  private setupTabListeners(): void {
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tab.url) {
        this.handleTabUpdate(tabId, tab.url);
      }
    });

    chrome.tabs.onRemoved.addListener((tabId) => {
      this.removeTab(tabId);
    });

    chrome.tabs.onActivated.addListener((activeInfo) => {
      this.updateTabActivity(activeInfo.tabId);
    });
  }

  private async handleTabUpdate(tabId: number, url: string): Promise<void> {
    if (this.isSupportedVideoSite(url)) {
      const existing = this.activeTabs.get(tabId);
      if (!existing || existing.url !== url) {
        this.activeTabs.set(tabId, {
          tabId,
          url,
          lastActivity: Date.now()
        });
        
        await this.checkChannelMatch(tabId, url);
      }
    } else {
      this.removeTab(tabId);
    }
  }

  private isSupportedVideoSite(url: string): boolean {
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

  private async checkChannelMatch(tabId: number, url: string): Promise<void> {
    try {
      const response = await fetch(`http://localhost:3001/api/v1/channels/match-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      if (response.ok) {
        const channelConfig: ChannelConfig = await response.json();
        const tab = this.activeTabs.get(tabId);
        if (tab) {
          tab.channelConfig = channelConfig;
          this.activeTabs.set(tabId, tab);
          
          await this.notifyContentScript(tabId, 'channel-detected', channelConfig);
        }
      }
    } catch (error) {
      console.warn('Failed to match channel:', error);
    }
  }

  async startDubbing(tabId: number, targetLanguage: string): Promise<boolean> {
    const tab = this.activeTabs.get(tabId);
    if (!tab?.channelConfig) {
      return false;
    }

    try {
      const stream = await chrome.tabCapture.capture({
        audio: true,
        video: false
      });

      if (!stream) {
        throw new Error('Failed to capture audio');
      }

      const session: DubbingSession = {
        id: `${tabId}-${Date.now()}`,
        tabId,
        channelId: tab.channelConfig.id,
        sourceLanguage: tab.channelConfig.language,
        targetLanguage,
        status: 'active',
        startTime: Date.now()
      };

      const aiPipeline = new AIPipeline(this.modelManager);
      await aiPipeline.initialize();
      
      const outputStream = await aiPipeline.startProcessing(
        stream,
        tab.channelConfig.language,
        targetLanguage
      );

      tab.dubbingSession = session;
      tab.audioStream = stream;
      tab.outputStream = outputStream;
      tab.aiPipeline = aiPipeline;
      this.activeTabs.set(tabId, tab);

      await this.notifyContentScript(tabId, 'dubbing-started', {
        session,
        outputStream
      });
      return true;
    } catch (error) {
      console.error('Failed to start dubbing:', error);
      return false;
    }
  }

  async stopDubbing(tabId: number): Promise<void> {
    const tab = this.activeTabs.get(tabId);
    if (!tab?.dubbingSession) {
      return;
    }

    if (tab.aiPipeline) {
      await tab.aiPipeline.cleanup();
      tab.aiPipeline = undefined as any;
    }

    if (tab.audioStream) {
      tab.audioStream.getTracks().forEach(track => track.stop());
      tab.audioStream = undefined as any;
    }

    if (tab.outputStream) {
      tab.outputStream.getTracks().forEach(track => track.stop());
      tab.outputStream = undefined as any;
    }

    tab.dubbingSession = undefined;
    this.activeTabs.set(tabId, tab);

    await this.notifyContentScript(tabId, 'dubbing-stopped', null);
  }

  getActiveTab(tabId: number): ActiveTab | undefined {
    return this.activeTabs.get(tabId);
  }

  getActiveDubbingSessions(): DubbingSession[] {
    const sessions: DubbingSession[] = [];
    for (const tab of this.activeTabs.values()) {
      if (tab.dubbingSession) {
        sessions.push(tab.dubbingSession);
      }
    }
    return sessions;
  }

  private updateTabActivity(tabId: number): void {
    const tab = this.activeTabs.get(tabId);
    if (tab) {
      tab.lastActivity = Date.now();
      this.activeTabs.set(tabId, tab);
    }
  }

  private async removeTab(tabId: number): Promise<void> {
    const tab = this.activeTabs.get(tabId);
    if (tab) {
      if (tab.aiPipeline) {
        await tab.aiPipeline.cleanup();
      }
      if (tab.audioStream) {
        tab.audioStream.getTracks().forEach(track => track.stop());
      }
      if (tab.outputStream) {
        tab.outputStream.getTracks().forEach(track => track.stop());
      }
      this.activeTabs.delete(tabId);
    }
  }

  private startCleanupTimer(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [tabId, tab] of this.activeTabs.entries()) {
        if (now - tab.lastActivity > this.INACTIVE_TIMEOUT) {
          await this.removeTab(tabId);
        }
      }
    }, 60000); // Check every minute
  }

  private async notifyContentScript(tabId: number, type: string, data: any): Promise<void> {
    try {
      await chrome.tabs.sendMessage(tabId, { type, data });
    } catch (error) {
      console.warn(`Failed to notify content script for tab ${tabId}:`, error);
    }
  }
}