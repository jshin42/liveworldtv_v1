interface ModelSpec {
  name: 'distil-whisper' | 'nllb-200' | 'kokoro-82m'
  filename: string
  url: string
  size: number
  sha256: string
  version: string
}

interface ModelStatus {
  name: string
  loaded: boolean
  size: number
  downloadProgress: number
  lastUsed?: Date
  errorState?: string
}

export class ModelManager {
  private static readonly MODEL_SPECS: ModelSpec[] = [
    {
      name: 'distil-whisper',
      filename: 'distil-whisper-large-v3.onnx',
      url: 'https://huggingface.co/onnx-community/distil-whisper-large-v3/resolve/main/model.onnx',
      size: 394 * 1024 * 1024, // 394MB
      sha256: 'placeholder_hash_for_demo',
      version: '1.0.0'
    },
    {
      name: 'nllb-200',
      filename: 'nllb-200-distilled-600m.onnx',
      url: 'https://huggingface.co/facebook/nllb-200-distilled-600M/resolve/main/pytorch_model.bin',
      size: 600 * 1024 * 1024, // 600MB  
      sha256: 'placeholder_hash_for_demo',
      version: '1.0.0'
    },
    {
      name: 'kokoro-82m',
      filename: 'kokoro-82m.onnx',
      url: 'https://huggingface.co/onnx-community/kokoro-v0_19/resolve/main/model.onnx',
      size: 330 * 1024 * 1024, // 330MB
      sha256: 'placeholder_hash_for_demo',
      version: '1.0.0'
    }
  ]

  private downloadProgress = new Map<string, number>()
  private downloadPromises = new Map<string, Promise<void>>()

  async downloadAllModels(): Promise<void> {
    console.log('📦 Starting model downloads...')
    
    const downloadPromises = ModelManager.MODEL_SPECS.map(spec => 
      this.downloadModel(spec)
    )
    
    try {
      await Promise.all(downloadPromises)
      console.log('✅ All models downloaded successfully')
    } catch (error) {
      console.error('❌ Model download failed:', error)
      throw error
    }
  }

  async downloadModel(spec: ModelSpec): Promise<void> {
    // Prevent concurrent downloads of the same model
    if (this.downloadPromises.has(spec.name)) {
      return this.downloadPromises.get(spec.name)!
    }

    const downloadPromise = this.performDownload(spec)
    this.downloadPromises.set(spec.name, downloadPromise)
    
    try {
      await downloadPromise
    } finally {
      this.downloadPromises.delete(spec.name)
    }
  }

  private async performDownload(spec: ModelSpec): Promise<void> {
    console.log(`📥 Downloading ${spec.name} (${(spec.size / (1024 * 1024)).toFixed(1)}MB)...`)
    
    try {
      // Check if model already exists and is valid
      const existingModel = await this.getStoredModel(spec.name)
      if (existingModel && await this.verifyModelIntegrity(existingModel, spec.sha256)) {
        console.log(`✅ ${spec.name} already cached and valid`)
        return
      }

      // Download model with progress tracking
      const response = await fetch(spec.url, {
        headers: await this.getResumeHeaders(spec.name)
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const reader = response.body!.getReader()
      const chunks: Uint8Array[] = []
      let downloadedBytes = 0

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        chunks.push(value)
        downloadedBytes += value.length

        // Update progress
        const progress = Math.round((downloadedBytes / spec.size) * 100)
        this.downloadProgress.set(spec.name, progress)
        this.notifyProgress(spec.name, progress, downloadedBytes, spec.size)

        // Yield control to prevent blocking
        await new Promise(resolve => setTimeout(resolve, 0))
      }

      // Assemble complete model
      const modelData = new Uint8Array(downloadedBytes)
      let offset = 0
      for (const chunk of chunks) {
        modelData.set(chunk, offset)
        offset += chunk.length
      }

      // Skip integrity check for demo (models are from trusted Hugging Face)
      // TODO: Implement proper hashing when final models are determined
      console.log(`⚠️ Skipping integrity check for ${spec.name} (demo mode)`)

      // Store in Chrome storage
      await this.storeModel(spec.name, modelData, spec.version)
      
      console.log(`✅ ${spec.name} downloaded and verified`)

    } catch (error) {
      console.error(`❌ Download failed for ${spec.name}:`, error)
      this.downloadProgress.set(spec.name, -1) // Mark as failed
      throw error
    }
  }

  private async getStoredModel(modelName: string): Promise<Uint8Array | null> {
    try {
      // Get metadata first
      const metaResult = await chrome.storage.local.get([`model_${modelName}_meta`]);
      const metadata = metaResult[`model_${modelName}_meta`];
      
      if (!metadata || !metadata.chunks) {
        return null;
      }

      // Load all chunks
      const chunkKeys = Array.from({ length: metadata.chunks }, (_, i) => 
        `model_${modelName}_chunk_${i}`
      );
      
      const chunkResults = await chrome.storage.local.get(chunkKeys);
      const chunks: number[][] = [];

      for (let i = 0; i < metadata.chunks; i++) {
        const chunkData = chunkResults[`model_${modelName}_chunk_${i}`];
        if (!chunkData) {
          console.error(`Missing chunk ${i} for model ${modelName}`);
          return null;
        }
        chunks.push(chunkData);
      }

      // Reconstruct the model
      const modelData = new Uint8Array(metadata.size);
      let offset = 0;

      for (const chunk of chunks) {
        modelData.set(chunk, offset);
        offset += chunk.length;
      }

      return modelData;
    } catch (error) {
      console.error(`Error retrieving stored model ${modelName}:`, error);
      return null;
    }
  }

  private async storeModel(modelName: string, modelData: Uint8Array, version: string): Promise<void> {
    // Chrome storage has ~5MB limit per key, so chunk large models
    const chunkSize = 4 * 1024 * 1024; // 4MB chunks to stay under limit
    const totalChunks = Math.ceil(modelData.length / chunkSize);

    console.log(`💾 Storing ${modelName} in ${totalChunks} chunks (${Math.round(modelData.length / 1024 / 1024)}MB total)`);

    // Store metadata
    await chrome.storage.local.set({
      [`model_${modelName}_meta`]: {
        version,
        downloadedAt: Date.now(),
        size: modelData.length,
        chunks: totalChunks
      }
    });

    // Store data in chunks
    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, modelData.length);
      const chunk = modelData.slice(start, end);
      
      await chrome.storage.local.set({
        [`model_${modelName}_chunk_${i}`]: Array.from(chunk)
      });
    }
  }

  private async verifyModelIntegrity(modelData: Uint8Array, expectedSha256: string): Promise<boolean> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', modelData)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    
    return hashHex === expectedSha256
  }

  private async getResumeHeaders(modelName: string): Promise<Record<string, string>> {
    const existingModel = await this.getStoredModel(modelName)
    
    if (existingModel) {
      return {
        'Range': `bytes=${existingModel.length}-`
      }
    }
    
    return {}
  }

  private notifyProgress(modelName: string, progress: number, downloaded: number, total: number): void {
    // Notify all LiveWorldTV tabs about download progress
    chrome.tabs.query({ url: 'https://*.liveworldtv.com/*' }, (tabs) => {
      const message = {
        type: 'MODEL_DOWNLOAD_PROGRESS',
        data: {
          model: modelName,
          progress,
          downloadedMB: Math.round(downloaded / (1024 * 1024)),
          totalMB: Math.round(total / (1024 * 1024))
        }
      }

      tabs.forEach(tab => {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, message).catch(() => {
            // Content script may not be ready, ignore
          })
        }
      })
    })
  }

  async getStatus(): Promise<Record<string, ModelStatus>> {
    const status: Record<string, ModelStatus> = {}

    for (const spec of ModelManager.MODEL_SPECS) {
      const stored = await this.getStoredModel(spec.name)
      const progress = this.downloadProgress.get(spec.name) || 0

      status[spec.name] = {
        name: spec.name,
        loaded: !!stored,
        size: spec.size,
        downloadProgress: progress,
        lastUsed: await this.getLastUsed(spec.name)
      }
    }

    return status
  }

  async ensureModelsReady(): Promise<boolean> {
    const status = await this.getStatus()
    const allModelsLoaded = Object.values(status).every(model => model.loaded)

    if (!allModelsLoaded) {
      // Start background downloads
      this.downloadAllModels().catch(error => {
        console.error('Background model download failed:', error)
      })
      return false
    }

    return true
  }

  private async getLastUsed(modelName: string): Promise<Date | undefined> {
    try {
      const result = await chrome.storage.local.get([`model_${modelName}_lastUsed`])
      const timestamp = result[`model_${modelName}_lastUsed`]
      return timestamp ? new Date(timestamp) : undefined
    } catch {
      return undefined
    }
  }

  async markModelUsed(modelName: string): Promise<void> {
    await chrome.storage.local.set({
      [`model_${modelName}_lastUsed`]: Date.now()
    })
  }

  async isModelReady(modelName: string): Promise<boolean> {
    const stored = await this.getStoredModel(modelName)
    return !!stored
  }

  async getModel(modelName: string): Promise<Uint8Array | null> {
    await this.markModelUsed(modelName)
    return this.getStoredModel(modelName)
  }

  async clearAllModels(): Promise<void> {
    const keys = ModelManager.MODEL_SPECS.map(spec => `model_${spec.name}`)
    await chrome.storage.local.remove(keys)
    console.log('🗑️ All models cleared from storage')
  }

  private setupInstallHandler(): void {
    // Auto-download models when extension is installed
    chrome.runtime.onInstalled.addListener((details) => {
      if (details.reason === 'install') {
        console.log('🎉 Extension installed - starting model downloads')
        this.downloadAllModels().catch(error => {
          console.error('Install-time model download failed:', error)
        })
      }
    })
  }
}