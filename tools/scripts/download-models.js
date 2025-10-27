#!/usr/bin/env node

/**
 * Model Download Script for LiveWorldTV Extension
 *
 * Downloads ONNX models for the AI dubbing pipeline:
 * - Distil-Whisper (ASR): ~756MB
 * - NLLB-200-Distilled (MT): ~600MB
 * - Kokoro-82M (TTS): ~3.2MB
 *
 * Total: ~1.36GB
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { createWriteStream } = require('fs');

const MODELS_DIR = path.join(__dirname, '../../apps/extension/models');

// Model configurations
const MODELS = {
  whisper: {
    name: 'Distil-Whisper (ASR)',
    files: [
      {
        name: 'distil-whisper-large-v3.onnx',
        url: 'https://huggingface.co/distil-whisper/distil-large-v3/resolve/main/model.onnx',
        size: '756MB',
        description: 'Automatic Speech Recognition model'
      },
      {
        name: 'distil-whisper-large-v3_tokenizer.json',
        url: 'https://huggingface.co/distil-whisper/distil-large-v3/resolve/main/tokenizer.json',
        size: '2MB',
        description: 'Whisper tokenizer config'
      }
    ]
  },
  nllb: {
    name: 'NLLB-200-Distilled (MT)',
    files: [
      {
        name: 'nllb-200-distilled-600M.onnx',
        url: 'https://huggingface.co/facebook/nllb-200-distilled-600M/resolve/main/onnx/model.onnx',
        size: '600MB',
        description: 'Neural Machine Translation model'
      },
      {
        name: 'nllb-200-tokenizer.json',
        url: 'https://huggingface.co/facebook/nllb-200-distilled-600M/resolve/main/tokenizer.json',
        size: '5MB',
        description: 'NLLB tokenizer config'
      }
    ]
  },
  kokoro: {
    name: 'Kokoro-82M (TTS)',
    files: [
      {
        name: 'kokoro-82M.onnx',
        url: 'https://huggingface.co/hexgrad/Kokoro-82M/resolve/main/kokoro-v0_19.onnx',
        size: '3.2MB',
        description: 'Text-to-Speech synthesis model'
      },
      {
        name: 'kokoro-voices.json',
        url: 'https://huggingface.co/hexgrad/Kokoro-82M/resolve/main/voices.json',
        size: '100KB',
        description: 'Voice configuration'
      }
    ]
  }
};

// Ensure models directory exists
function ensureModelsDir() {
  if (!fs.existsSync(MODELS_DIR)) {
    fs.mkdirSync(MODELS_DIR, { recursive: true });
    console.log(`Created models directory: ${MODELS_DIR}`);
  }
}

// Download file with progress
async function downloadFile(url, destPath, description) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(destPath);
    const protocol = url.startsWith('https') ? https : http;

    console.log(`  Downloading ${description}...`);
    console.log(`  URL: ${url}`);

    const request = protocol.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        console.log(`  Redirecting to: ${redirectUrl}`);
        downloadFile(redirectUrl, destPath, description)
          .then(resolve)
          .catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
        return;
      }

      const totalSize = parseInt(response.headers['content-length'], 10);
      let downloadedSize = 0;
      let lastProgress = 0;

      response.on('data', (chunk) => {
        downloadedSize += chunk.length;
        const progress = Math.floor((downloadedSize / totalSize) * 100);

        // Update progress every 5%
        if (progress >= lastProgress + 5) {
          process.stdout.write(`\r  Progress: ${progress}% (${(downloadedSize / 1024 / 1024).toFixed(1)}MB / ${(totalSize / 1024 / 1024).toFixed(1)}MB)`);
          lastProgress = progress;
        }
      });

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        process.stdout.write('\r  ✅ Download complete!                        \n');
        resolve();
      });
    });

    request.on('error', (err) => {
      fs.unlink(destPath, () => {}); // Delete partial file
      reject(err);
    });

    file.on('error', (err) => {
      fs.unlink(destPath, () => {}); // Delete partial file
      reject(err);
    });
  });
}

// Check if model file already exists
function isModelDownloaded(filePath) {
  return fs.existsSync(filePath) && fs.statSync(filePath).size > 0;
}

// Main download function
async function downloadModels(options = {}) {
  console.log('🤖 LiveWorldTV AI Model Downloader');
  console.log('═══════════════════════════════════════════════════\n');

  ensureModelsDir();

  const modelsToDownload = options.models || ['whisper', 'nllb', 'kokoro'];
  const skipExisting = options.skipExisting !== false;

  let totalDownloaded = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  for (const modelKey of modelsToDownload) {
    const model = MODELS[modelKey];
    if (!model) {
      console.log(`⚠️  Unknown model: ${modelKey}`);
      continue;
    }

    console.log(`\n📦 ${model.name}`);
    console.log('─'.repeat(50));

    for (const file of model.files) {
      const destPath = path.join(MODELS_DIR, file.name);

      // Check if already downloaded
      if (skipExisting && isModelDownloaded(destPath)) {
        console.log(`  ⏭️  Skipping ${file.name} (already exists)`);
        totalSkipped++;
        continue;
      }

      try {
        await downloadFile(file.url, destPath, file.description);
        totalDownloaded++;
      } catch (error) {
        console.log(`  ❌ Failed to download ${file.name}:`, error.message);
        totalFailed++;
      }
    }
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════════');
  console.log('📊 Download Summary');
  console.log('═══════════════════════════════════════════════════');
  console.log(`✅ Downloaded: ${totalDownloaded} files`);
  console.log(`⏭️  Skipped: ${totalSkipped} files`);
  if (totalFailed > 0) {
    console.log(`❌ Failed: ${totalFailed} files`);
  }
  console.log('');

  // List downloaded models
  const downloadedFiles = fs.readdirSync(MODELS_DIR);
  if (downloadedFiles.length > 0) {
    console.log('📂 Models directory contents:');
    downloadedFiles.forEach(file => {
      const filePath = path.join(MODELS_DIR, file);
      const stats = fs.statSync(filePath);
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
      console.log(`   ${file} (${sizeMB}MB)`);
    });
  }

  console.log('\n🎉 Model download complete!');
  console.log(`Models are stored in: ${MODELS_DIR}`);
}

// CLI handling
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {
    models: args.length > 0 ? args : undefined,
    skipExisting: !args.includes('--force')
  };

  downloadModels(options)
    .then(() => process.exit(0))
    .catch(error => {
      console.error('\n❌ Download failed:', error.message);
      process.exit(1);
    });
}

module.exports = { downloadModels };
