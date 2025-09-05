interface OffscreenMessage {
  type: 'SETUP_AUDIO_PROCESSOR' | 'STOP_AUDIO_PROCESSOR'
  data: {
    tabId: number
    offscreenId: string
    stream?: MediaStream
  }
}

class OffscreenAudioProcessor {
  private audioContext: AudioContext | null = null
  private audioWorklet: AudioWorkletNode | null = null
  private mediaStreamSource: MediaStreamAudioSourceNode | null = null
  private processingActive = false
  private tabId: number | null = null

  constructor() {
    this.setupMessageListener()
    this.updateStatus('Audio processor initialized')
  }

  private setupMessageListener(): void {
    chrome.runtime.onMessage.addListener(
      (message: OffscreenMessage, sender, sendResponse) => {
        this.handleMessage(message)
        sendResponse({ success: true })
        return true
      }
    )
  }

  private async handleMessage(message: OffscreenMessage): Promise<void> {
    switch (message.type) {
      case 'SETUP_AUDIO_PROCESSOR':
        await this.setupProcessor(message.data)
        break
      
      case 'STOP_AUDIO_PROCESSOR':
        await this.stopProcessor()
        break
    }
  }

  private async setupProcessor(data: { tabId: number; offscreenId: string; stream?: MediaStream }): Promise<void> {
    try {
      this.tabId = data.tabId
      this.updateStatus(`Setting up audio processor for tab ${data.tabId}`)

      // Initialize audio context
      this.audioContext = new AudioContext({ sampleRate: 16000 })

      // For Sprint 1, we'll just setup the infrastructure
      // The actual audio processing worklet will be implemented in Sprint 2
      this.updateStatus(`Audio context ready (${this.audioContext.sampleRate}Hz)`)
      
      // Placeholder for audio worklet processor
      // TODO: Load audio-processor-worklet.js in Sprint 2
      
      this.processingActive = true
      this.updateStatus('Audio processor active - ready for AI pipeline')

    } catch (error) {
      this.updateStatus(`Setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      throw error
    }
  }

  private async stopProcessor(): Promise<void> {
    this.processingActive = false
    this.updateStatus('Stopping audio processor...')

    if (this.audioWorklet) {
      this.audioWorklet.disconnect()
      this.audioWorklet = null
    }

    if (this.mediaStreamSource) {
      this.mediaStreamSource.disconnect()
      this.mediaStreamSource = null
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      await this.audioContext.close()
      this.audioContext = null
    }

    this.tabId = null
    this.updateStatus('Audio processor stopped')
  }

  private updateStatus(message: string): void {
    const statusElement = document.getElementById('status')
    if (statusElement) {
      statusElement.textContent = `[${new Date().toLocaleTimeString()}] ${message}`
    }
    console.log(`[OffscreenProcessor] ${message}`)
  }
}

// Initialize offscreen processor
new OffscreenAudioProcessor()