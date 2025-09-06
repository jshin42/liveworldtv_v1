import * as ort from 'onnxruntime-web'

interface ModelSpec {
  name: 'distil-whisper' | 'nllb-200' | 'kokoro-tts'
  filename: string
  localPath: string
  size: number
  description: string
  version: string
}

interface ModelStatus {
  name: string
  loaded: boolean
  size: number
  session?: ort.InferenceSession
  lastUsed?: Date
  errorState?: string
}

export class ModelManager {
  private static readonly MODEL_SPECS: ModelSpec[] = [
    {
      name: 'distil-whisper',
      filename: 'distil-whisper-small-en.onnx',
      localPath: '/models/distil-whisper-small-en.onnx',
      size: 1024 * 1024, // 1MB
      description: 'Distil-Whisper ASR Model',
      version: '1.0.0'
    },
    {
      name: 'nllb-200',
      filename: 'nllb-200-distilled-600m.onnx',
      localPath: '/models/nllb-200-distilled-600m.onnx',
      size: 2 * 1024 * 1024, // 2MB
      description: 'NLLB-200 Translation Model',
      version: '1.0.0'
    },
    {
      name: 'kokoro-tts',
      filename: 'kokoro-82m.onnx',
      localPath: '/models/kokoro-82m.onnx',
      size: 512 * 1024, // 512KB
      description: 'Kokoro TTS Model', 
      version: '1.0.0'
    }
  ]

  private modelStatus = new Map<string, ModelStatus>()
  private loadingPromises = new Map<string, Promise<void>>()

  constructor() {
    // Initialize ONNX Runtime with WebAssembly backend
    ort.env.wasm.wasmPaths = chrome.runtime.getURL('/onnxruntime-web/');
    
    // Set execution provider preferences
    ort.env.wasm.numThreads = 2; // Use 2 threads for better performance
    
    console.log('🤖 ModelManager initialized with ONNX Runtime Web');
    
    // Initialize model status
    for (const spec of ModelManager.MODEL_SPECS) {
      this.modelStatus.set(spec.name, {
        name: spec.name,
        loaded: false,
        size: spec.size
      });
    }
  }

  async loadAllModels(): Promise<void> {
    console.log('🚀 Loading AI models for real-time dubbing...');
    
    const loadingPromises = ModelManager.MODEL_SPECS.map(spec => 
      this.loadModel(spec.name)
    );
    
    try {
      await Promise.all(loadingPromises);
      console.log('✅ All AI models loaded and ready for dubbing!');
    } catch (error) {
      console.error('❌ Model loading failed:', error);
      throw error;
    }
  }

  async loadModel(modelName: string): Promise<void> {
    // Prevent concurrent loading of the same model
    if (this.loadingPromises.has(modelName)) {
      return this.loadingPromises.get(modelName)!;
    }

    const spec = ModelManager.MODEL_SPECS.find(s => s.name === modelName);
    if (!spec) {
      throw new Error(`Unknown model: ${modelName}`);
    }

    const loadPromise = this.doLoadModel(spec);
    this.loadingPromises.set(modelName, loadPromise);
    
    try {
      await loadPromise;
    } finally {
      this.loadingPromises.delete(modelName);
    }
  }

  private async doLoadModel(spec: ModelSpec): Promise<void> {
    console.log(`📥 Loading ${spec.description}...`);
    
    try {
      // Get the model file URL from extension resources
      const modelUrl = chrome.runtime.getURL(spec.localPath);
      
      // Configure ONNX Runtime session options
      const sessionOptions: ort.InferenceSession.SessionOptions = {
        executionProviders: ['wasm'], // Use WebAssembly backend
        graphOptimizationLevel: 'all', // Enable all optimizations
        enableCpuMemArena: true,       // Better memory management
        enableMemPattern: true,        // Pattern optimization
        executionMode: 'sequential',   // Sequential execution for stability
        logSeverityLevel: 3,          // Only log errors (0=verbose, 4=none)
      };
      
      // Load the ONNX model
      console.log(`🔄 Creating ONNX session for ${spec.name}...`);
      const session = await ort.InferenceSession.create(modelUrl, sessionOptions);
      
      // Update model status
      const status = this.modelStatus.get(spec.name)!;
      status.loaded = true;
      status.session = session;
      status.lastUsed = new Date();
      
      console.log(`✅ ${spec.name}: Loaded successfully`);
      
      // Log input/output info for debugging
      console.log(`📊 ${spec.name} inputs:`, session.inputNames);
      console.log(`📊 ${spec.name} outputs:`, session.outputNames);
      
    } catch (error) {
      console.error(`❌ Failed to load ${spec.name}:`, error);
      
      const status = this.modelStatus.get(spec.name)!;
      status.errorState = error instanceof Error ? error.message : 'Unknown error';
      status.loaded = false;
      
      throw new Error(`Model loading failed for ${spec.name}: ${error}`);
    }
  }

  async getModel(modelName: string): Promise<ort.InferenceSession> {
    const status = this.modelStatus.get(modelName);
    
    if (!status) {
      throw new Error(`Model ${modelName} not found`);
    }
    
    if (!status.loaded || !status.session) {
      // Try to load the model if not already loaded
      await this.loadModel(modelName);
      const updatedStatus = this.modelStatus.get(modelName)!;
      if (!updatedStatus.session) {
        throw new Error(`Failed to load model ${modelName}: ${updatedStatus.errorState || 'Unknown error'}`);
      }
      return updatedStatus.session;
    }
    
    status.lastUsed = new Date();
    return status.session;
  }

  async isModelReady(modelName: string): Promise<boolean> {
    const status = this.modelStatus.get(modelName);
    return status ? status.loaded && !!status.session : false;
  }

  getModelStatus(modelName: string): ModelStatus | undefined {
    return this.modelStatus.get(modelName);
  }

  getAllModelStatus(): Map<string, ModelStatus> {
    return new Map(this.modelStatus);
  }

  async runInference(
    modelName: string, 
    inputs: { [name: string]: ort.Tensor }
  ): Promise<{ [name: string]: ort.Tensor }> {
    try {
      const session = await this.getModel(modelName);
      
      console.log(`🔮 Running inference on ${modelName}...`);
      const startTime = performance.now();
      
      const results = await session.run(inputs);
      
      const endTime = performance.now();
      console.log(`⚡ ${modelName} inference completed in ${(endTime - startTime).toFixed(1)}ms`);
      
      return results;
    } catch (error) {
      console.error(`❌ Inference failed for ${modelName}:`, error);
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up model sessions...');
    
    for (const [modelName, status] of this.modelStatus) {
      if (status.session) {
        try {
          await status.session.release();
          status.session = undefined;
          status.loaded = false;
          console.log(`🗑️ Released ${modelName} session`);
        } catch (error) {
          console.error(`Warning: Failed to release ${modelName} session:`, error);
        }
      }
    }
    
    this.loadingPromises.clear();
    console.log('✅ Model cleanup completed');
  }

  // Debug method to check model file existence
  async checkModelFiles(): Promise<void> {
    console.log('🔍 Checking model files...');
    
    for (const spec of ModelManager.MODEL_SPECS) {
      try {
        const modelUrl = chrome.runtime.getURL(spec.localPath);
        const response = await fetch(modelUrl);
        
        if (response.ok) {
          const size = response.headers.get('content-length');
          console.log(`✅ ${spec.name}: File exists (${size ? Math.round(parseInt(size) / 1024) + 'KB' : 'unknown size'})`);
        } else {
          console.log(`❌ ${spec.name}: File not found (${response.status})`);
        }
      } catch (error) {
        console.log(`❌ ${spec.name}: Error checking file - ${error}`);
      }
    }
  }

  getLoadingProgress(): Record<string, number> {
    const progress: Record<string, number> = {};
    
    for (const [modelName, status] of this.modelStatus) {
      if (status.loaded) {
        progress[modelName] = 100;
      } else if (this.loadingPromises.has(modelName)) {
        progress[modelName] = 50; // Loading in progress
      } else {
        progress[modelName] = 0; // Not started
      }
    }
    
    return progress;
  }
}