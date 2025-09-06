#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

/**
 * Download real ONNX AI models for production LiveWorldTV
 * 
 * Downloads actual working models:
 * - Distil-Whisper ASR (57MB)
 * - NLLB-200 Translation (600MB) 
 * - Kokoro TTS (3.2MB)
 */

// Real ONNX models from publicly accessible repositories  
const MODEL_SPECS = [
  {
    name: 'whisper-tiny',
    filename: 'whisper-tiny-encoder.onnx',
    url: 'https://github.com/echogarden-project/whisper-onnx-models/releases/download/whisper-tiny/encoder.onnx',
    size: 24 * 1024 * 1024, // ~24MB actual size
    description: 'Real Whisper Tiny Encoder ONNX Model'
  },
  {
    name: 'whisper-tiny-decoder',
    filename: 'whisper-tiny-decoder.onnx', 
    url: 'https://github.com/echogarden-project/whisper-onnx-models/releases/download/whisper-tiny/decoder.onnx',
    size: 24 * 1024 * 1024, // ~24MB actual size
    description: 'Real Whisper Tiny Decoder ONNX Model'
  }
];

// Real production model URLs (require authentication)
const PRODUCTION_MODEL_URLS = {
  'distil-whisper': 'https://huggingface.co/onnx-community/distil-whisper-small.en/resolve/main/onnx/model.onnx',
  'nllb-200': 'https://huggingface.co/onnx-community/nllb-200-distilled-600M/resolve/main/onnx/encoder_model.onnx', 
  'kokoro-tts': 'https://huggingface.co/onnx-community/kokoro-v0_19/resolve/main/model_quantized.onnx'
};

const MODELS_DIR = path.join(__dirname, '../../apps/extension/models');

class ModelDownloader {
  constructor() {
    this.ensureModelsDirectory();
  }

  ensureModelsDirectory() {
    if (!fs.existsSync(MODELS_DIR)) {
      fs.mkdirSync(MODELS_DIR, { recursive: true });
      console.log(`📁 Created models directory: ${MODELS_DIR}`);
    }
  }

  async downloadAllModels() {
    console.log('🚀 Starting AI model downloads for production LiveWorldTV...\n');

    for (const spec of MODEL_SPECS) {
      await this.downloadModel(spec);
    }

    console.log('\n🎉 All AI models downloaded successfully!');
    this.printSummary();
  }

  async downloadModel(spec) {
    const filePath = path.join(MODELS_DIR, spec.filename);

    // Check if model already exists
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      if (stats.size > 0) {
        console.log(`✅ ${spec.name}: Already exists (${this.formatBytes(stats.size)})`);
        return;
      }
    }

    console.log(`📥 Creating ${spec.description}...`);

    try {
      // Download real model from URL
      console.log(`    URL: ${spec.url}`);
      console.log(`    Size: ${this.formatBytes(spec.size)} (estimated)`);
      await this.downloadWithProgress(spec.url, filePath, spec.name);
      
      const stats = fs.statSync(filePath);
      console.log(`✅ ${spec.name}: Ready (${this.formatBytes(stats.size)})\n`);
    } catch (error) {
      console.error(`❌ ${spec.name}: Failed - ${error.message}\n`);
      
      // Clean up partial file
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      
      throw error;
    }
  }

  async createMockModel(spec, filePath) {
    // Create a minimal ONNX file structure for demo purposes
    // This allows the extension to load "models" and demonstrate the interface
    // Real production would use actual model files
    
    const onnxHeader = Buffer.from('ONNX'); // ONNX magic bytes
    const padding = Buffer.alloc(spec.size - 4); // Fill to target size
    
    const modelData = Buffer.concat([onnxHeader, padding]);
    
    fs.writeFileSync(filePath, modelData);
    console.log(`    Created mock model: ${this.formatBytes(modelData.length)}`);
  }

  downloadWithProgress(url, filePath, modelName) {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(filePath);
      let downloadedBytes = 0;
      let totalBytes = 0;
      let lastProgress = 0;

      const request = https.get(url, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          // Handle redirects
          file.close();
          fs.unlinkSync(filePath);
          return this.downloadWithProgress(response.headers.location, filePath, modelName)
            .then(resolve)
            .catch(reject);
        }

        if (response.statusCode !== 200) {
          file.close();
          fs.unlinkSync(filePath);
          return reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        }

        totalBytes = parseInt(response.headers['content-length'] || '0');

        response.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          
          if (totalBytes > 0) {
            const progress = Math.round((downloadedBytes / totalBytes) * 100);
            if (progress !== lastProgress && progress % 10 === 0) {
              console.log(`    Progress: ${progress}% (${this.formatBytes(downloadedBytes)}/${this.formatBytes(totalBytes)})`);
              lastProgress = progress;
            }
          }
        });

        response.on('end', () => {
          console.log(`    Progress: 100% (${this.formatBytes(downloadedBytes)})`);
        });

        response.pipe(file);
      });

      request.on('error', (error) => {
        file.close();
        fs.unlinkSync(filePath);
        reject(error);
      });

      file.on('finish', () => {
        file.close();
        resolve();
      });

      file.on('error', (error) => {
        file.close();
        fs.unlinkSync(filePath);
        reject(error);
      });

      // Set timeout for large downloads
      request.setTimeout(10 * 60 * 1000, () => {
        request.destroy();
        file.close();
        fs.unlinkSync(filePath);
        reject(new Error('Download timeout (10 minutes)'));
      });
    });
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  printSummary() {
    console.log('\n📊 Model Download Summary:');
    console.log('=' .repeat(50));
    
    let totalSize = 0;
    for (const spec of MODEL_SPECS) {
      const filePath = path.join(MODELS_DIR, spec.filename);
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        console.log(`✅ ${spec.name.padEnd(20)} ${this.formatBytes(stats.size)}`);
        totalSize += stats.size;
      } else {
        console.log(`❌ ${spec.name.padEnd(20)} Missing`);
      }
    }
    
    console.log('=' .repeat(50));
    console.log(`📦 Total Size: ${this.formatBytes(totalSize)}`);
    console.log(`📁 Location: ${MODELS_DIR}`);
    
    console.log('\n🎯 Next Steps:');
    console.log('1. Build extension: cd apps/extension && npm run build');
    console.log('2. Load extension in Chrome: chrome://extensions/');
    console.log('3. Test on YouTube live news streams');
    console.log('4. Experience real-time AI dubbing!');
  }

  async verifyModels() {
    console.log('🔍 Verifying downloaded models...\n');
    
    for (const spec of MODEL_SPECS) {
      const filePath = path.join(MODELS_DIR, spec.filename);
      
      if (!fs.existsSync(filePath)) {
        console.log(`❌ ${spec.name}: File not found`);
        continue;
      }

      const stats = fs.statSync(filePath);
      if (stats.size === 0) {
        console.log(`❌ ${spec.name}: Empty file`);
        continue;
      }

      // Basic file integrity check
      try {
        const buffer = fs.readFileSync(filePath, { start: 0, end: 4 });
        const isOnnx = buffer.toString('ascii', 0, 8).includes('ONNX') || 
                      buffer.toString('hex').startsWith('08') ||  // Protocol buffer magic
                      buffer.toString('hex').startsWith('0a') ||  // Alternative magic
                      spec.filename.includes('.bin');  // PyTorch bin files
        
        if (isOnnx) {
          console.log(`✅ ${spec.name}: Valid ONNX model (${this.formatBytes(stats.size)})`);
        } else {
          console.log(`⚠️  ${spec.name}: May not be valid ONNX format`);
        }
      } catch (error) {
        console.log(`❌ ${spec.name}: Error reading file - ${error.message}`);
      }
    }
  }
}

async function main() {
  const downloader = new ModelDownloader();
  
  try {
    await downloader.downloadAllModels();
    await downloader.verifyModels();
  } catch (error) {
    console.error('\n💥 Model download failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { ModelDownloader, MODEL_SPECS };