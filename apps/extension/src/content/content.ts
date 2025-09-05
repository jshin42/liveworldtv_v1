interface DubbingMessage {
  type: 'DUBBING_ENABLED' | 'DUBBING_DISABLED' | 'AUDIO_CHUNK_PROCESSED' | 'ERROR'
  data: any
}

class LiveWorldTVContentScript {
  private isDubbingEnabled = false
  private dubbingButton: HTMLElement | null = null
  private statusDisplay: HTMLElement | null = null

  constructor() {
    this.setupMessageListener()
    this.injectDubbingControls()
  }

  private setupMessageListener(): void {
    chrome.runtime.onMessage.addListener((message: DubbingMessage, sender, sendResponse) => {
      this.handleMessage(message)
      sendResponse({ success: true })
      return true
    })
  }

  private handleMessage(message: DubbingMessage): void {
    switch (message.type) {
      case 'DUBBING_ENABLED':
        this.onDubbingEnabled(message.data)
        break
      
      case 'DUBBING_DISABLED':
        this.onDubbingDisabled()
        break
      
      case 'AUDIO_CHUNK_PROCESSED':
        this.onAudioProcessed(message.data)
        break
      
      case 'ERROR':
        this.onError(message.data)
        break
    }
  }

  private injectDubbingControls(): void {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.createControls())
    } else {
      this.createControls()
    }
  }

  private createControls(): void {
    // Create floating control panel
    const controlPanel = document.createElement('div')
    controlPanel.id = 'liveworldtv-controls'
    controlPanel.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 12px;
      border-radius: 8px;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      min-width: 200px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    `

    // Toggle button
    this.dubbingButton = document.createElement('button')
    this.dubbingButton.textContent = 'Enable AI Dubbing'
    this.dubbingButton.style.cssText = `
      background: #4CAF50;
      border: none;
      color: white;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      width: 100%;
      margin-bottom: 8px;
      font-size: 13px;
    `

    this.dubbingButton.addEventListener('click', () => this.toggleDubbing())

    // Status display
    this.statusDisplay = document.createElement('div')
    this.statusDisplay.style.cssText = `
      font-size: 11px;
      color: #ccc;
      line-height: 1.4;
    `
    this.statusDisplay.textContent = 'Ready to enable dubbing'

    controlPanel.appendChild(this.dubbingButton)
    controlPanel.appendChild(this.statusDisplay)
    document.body.appendChild(controlPanel)
  }

  private async toggleDubbing(): Promise<void> {
    if (!this.dubbingButton) return

    this.dubbingButton.disabled = true
    
    try {
      if (this.isDubbingEnabled) {
        await this.disableDubbing()
      } else {
        await this.enableDubbing()
      }
    } catch (error) {
      this.updateStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`, '#ff6b6b')
    } finally {
      this.dubbingButton.disabled = false
    }
  }

  private async enableDubbing(): Promise<void> {
    this.updateStatus('Initializing AI models...', '#ffd93d')
    
    const response = await chrome.runtime.sendMessage({
      type: 'ENABLE_DUBBING',
      timestamp: Date.now()
    })

    if (!response.success) {
      throw new Error(response.error || 'Failed to enable dubbing')
    }
  }

  private async disableDubbing(): Promise<void> {
    const response = await chrome.runtime.sendMessage({
      type: 'DISABLE_DUBBING',
      timestamp: Date.now()
    })

    if (!response.success) {
      throw new Error(response.error || 'Failed to disable dubbing')
    }
  }

  private onDubbingEnabled(data: any): void {
    this.isDubbingEnabled = true
    this.updateButtonState()
    this.updateStatus('AI dubbing active', '#4CAF50')
  }

  private onDubbingDisabled(): void {
    this.isDubbingEnabled = false
    this.updateButtonState()
    this.updateStatus('AI dubbing disabled', '#ccc')
  }

  private onAudioProcessed(data: any): void {
    // Handle processed audio chunks - will be implemented in Sprint 2
    console.log('Audio processed:', data)
  }

  private onError(data: any): void {
    this.updateStatus(`Error: ${data.message || 'Unknown error'}`, '#ff6b6b')
  }

  private updateButtonState(): void {
    if (!this.dubbingButton) return

    if (this.isDubbingEnabled) {
      this.dubbingButton.textContent = 'Disable Dubbing'
      this.dubbingButton.style.background = '#f44336'
    } else {
      this.dubbingButton.textContent = 'Enable AI Dubbing'
      this.dubbingButton.style.background = '#4CAF50'
    }
  }

  private updateStatus(text: string, color = '#ccc'): void {
    if (this.statusDisplay) {
      this.statusDisplay.textContent = text
      this.statusDisplay.style.color = color
    }
  }
}

// Initialize content script
new LiveWorldTVContentScript()