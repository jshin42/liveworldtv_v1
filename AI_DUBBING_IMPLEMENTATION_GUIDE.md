# AI Dubbing Implementation Guide

## ✅ **Completed: Auto-Play Implementation**

The auto-play feature is now fully functional:

### What Works
- ✅ API backend serving channel data from `/v1/channels`
- ✅ Frontend fetching channels from API on page load
- ✅ Automatic selection and playback of first US channel (NBC News)
- ✅ No user interaction required - immediate playback
- ✅ 5 channels available: NBC News, CNN, ABC News (US), BBC News, Sky News (UK)

### Test It
```bash
# Start servers (if not already running)
cd apps/api && npm start &
cd apps/web && npm run dev &

# Run auto-play test
node test-autoplay.js

# Open in browser
open http://localhost:3000
```

---

## 🚧 **Remaining: AI Dubbing Implementation**

### Current State
- ✅ Model manager infrastructure complete (`model-manager-real.ts`)
- ✅ AI pipeline architecture designed (`ai-pipeline.ts`)
- ✅ Extension manifest configured for audio permissions
- ✅ Worker structure for ASR/MT/TTS
- ❌ ONNX models not downloaded (1.3GB)
- ❌ Real inference not implemented (using demo fallbacks)
- ❌ Audio capture from YouTube not working
- ❌ Dubbed audio injection not implemented

### Implementation Steps

#### **Step 1: Download ONNX Models (30-60 minutes)**

```bash
# Download all models (~1.3GB)
chmod +x tools/scripts/download-models.js
node tools/scripts/download-models.js

# Or download individually
node tools/scripts/download-models.js whisper  # 756MB
node tools/scripts/download-models.js nllb     # 600MB
node tools/scripts/download-models.js kokoro   # 3.2MB

# Verify downloads
ls -lh apps/extension/models/
```

**Expected files:**
```
distil-whisper-large-v3.onnx          (756MB)
distil-whisper-large-v3_tokenizer.json (2MB)
nllb-200-distilled-600M.onnx          (600MB)
nllb-200-tokenizer.json               (5MB)
kokoro-82M.onnx                       (3.2MB)
kokoro-voices.json                    (100KB)
```

#### **Step 2: Implement Real ASR Inference**

Update `/apps/extension/src/background/ai-pipeline.ts:147-181`:

```typescript
private async transcribeAudio(audioChunk: AudioChunk): Promise<TranscriptionResult> {
  try {
    if (!(await this.modelManager.isModelReady('distil-whisper'))) {
      throw new Error('Whisper model not ready');
    }

    // Preprocess audio for Whisper
    const processedAudio = this.preprocessAudioForWhisper(audioChunk.data);

    // Create input tensor [1, 80, 3000] for mel spectrogram
    const inputTensor = new ort.Tensor('float32', processedAudio, [1, 80, 3000]);

    // Run inference
    const feeds = { input_features: inputTensor };
    const results = await this.modelManager.runInference('distil-whisper', feeds);

    // Decode output tokens to text
    const transcription = await this.decodeWhisperTokens(results.logits);

    return {
      text: transcription,
      confidence: this.calculateConfidence(results),
      language: 'en', // Detect from Whisper language token
      timestamp: audioChunk.timestamp
    };
  } catch (error) {
    console.error('❌ ASR error:', error);
    throw error; // Don't fallback to demo - fail fast
  }
}

// Add helper methods
private preprocessAudioForWhisper(audio: Float32Array): Float32Array {
  // 1. Resample to 16kHz if needed
  // 2. Convert to mel spectrogram (80 bands, 3000 frames = 30 seconds)
  // 3. Normalize to [-1, 1]
  // 4. Return float32 array of shape [80 * 3000]

  // TODO: Implement mel spectrogram conversion
  // Use: https://github.com/microsoft/onnxruntime-web/blob/main/examples/whisper/preprocessing.js

  return new Float32Array(80 * 3000); // Stub
}

private async decodeWhisperTokens(logits: ort.Tensor): Promise<string> {
  // Load tokenizer (from distil-whisper-large-v3_tokenizer.json)
  // Decode token IDs to text using tokenizer vocab
  // Handle special tokens (<|startoftranscript|>, <|notimestamps|>, etc.)

  // TODO: Implement tokenizer decoding
  // Reference: https://github.com/openai/whisper/blob/main/whisper/tokenizer.py

  return ""; // Stub
}
```

#### **Step 3: Implement Real NLLB Translation**

Update `/apps/extension/src/background/ai-pipeline.ts:183-230`:

```typescript
private async translateText(
  text: string,
  sourceLanguage: string,
  targetLanguage: string
): Promise<TranslationResult> {
  try {
    if (sourceLanguage === targetLanguage) {
      return { text, sourceLanguage, targetLanguage, timestamp: Date.now() };
    }

    if (!(await this.modelManager.isModelReady('nllb-200'))) {
      throw new Error('NLLB model not ready');
    }

    // Load tokenizer and encode text
    const tokenizer = await this.loadNLLBTokenizer();
    const inputIds = tokenizer.encode(text, {
      addSpecialTokens: true,
      sourceLanguage: this.mapLanguageToNLLB(sourceLanguage)
    });

    // Create input tensors
    const inputTensor = new ort.Tensor('int64', new BigInt64Array(inputIds), [1, inputIds.length]);
    const attentionMask = new ort.Tensor('int64', new BigInt64Array(inputIds.length).fill(1n), [1, inputIds.length]);

    // Run inference
    const feeds = {
      input_ids: inputTensor,
      attention_mask: attentionMask,
      forced_bos_token_id: new ort.Tensor('int64', [tokenizer.langToId(targetLanguage)], [1])
    };
    const results = await this.modelManager.runInference('nllb-200', feeds);

    // Decode output tokens
    const translatedText = tokenizer.decode(results.sequences);

    return {
      text: translatedText,
      sourceLanguage,
      targetLanguage,
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('❌ Translation error:', error);
    throw error;
  }
}

private mapLanguageToNLLB(lang: string): string {
  // NLLB uses language codes like "eng_Latn", "spa_Latn", "fra_Latn"
  const mapping: Record<string, string> = {
    'en': 'eng_Latn',
    'es': 'spa_Latn',
    'fr': 'fra_Latn',
    'de': 'deu_Latn',
    'ja': 'jpn_Jpan',
    'zh': 'zho_Hans',
    // Add more as needed
  };
  return mapping[lang] || 'eng_Latn';
}
```

#### **Step 4: Implement Real Kokoro TTS**

Update `/apps/extension/src/background/ai-pipeline.ts:232-280`:

```typescript
private async synthesizeSpeech(
  text: string,
  language: string
): Promise<SynthesisResult> {
  try {
    if (!(await this.modelManager.isModelReady('kokoro-tts'))) {
      throw new Error('Kokoro TTS model not ready');
    }

    // Load phonemizer and convert text to phonemes
    const phonemes = await this.textToPhonemes(text, language);

    // Encode phonemes to IDs
    const phonemeIds = this.encodePhonemes(phonemes);

    // Create input tensor
    const inputTensor = new ort.Tensor('int64', new BigInt64Array(phonemeIds), [1, phonemeIds.length]);

    // Run TTS inference
    const feeds = { phoneme_ids: inputTensor };
    const results = await this.modelManager.runInference('kokoro-tts', feeds);

    // Convert model output to audio buffer
    const audioArray = results.audio.data as Float32Array;
    const audioBuffer = this.float32ToInt16PCM(audioArray);

    return {
      audioBuffer: audioBuffer.buffer,
      duration: audioArray.length / 22050, // Kokoro outputs 22.05kHz
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('❌ TTS error:', error);
    throw error;
  }
}

private async textToPhonemes(text: string, language: string): Promise<string[]> {
  // Use phonemizer library or implement G2P (grapheme-to-phoneme)
  // Kokoro expects IPA phonemes or language-specific phoneme set

  // TODO: Implement phonemization
  // Reference: https://github.com/bootphon/phonemizer

  return []; // Stub
}

private float32ToInt16PCM(float32Array: Float32Array): Int16Array {
  const int16Array = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return int16Array;
}
```

#### **Step 5: Implement YouTube Audio Capture**

Update `/apps/extension/src/content/youtube-content-script.ts:82-120`:

```typescript
function captureYouTubeAudio(): MediaStream | null {
  // Strategy 1: Capture from <video> element
  const videoElement = document.querySelector('video');
  if (!videoElement) {
    console.error('❌ No video element found');
    return null;
  }

  try {
    // Create audio context
    const audioContext = new AudioContext({ sampleRate: 16000 });

    // Create media element source
    const source = audioContext.createMediaElementSource(videoElement);

    // Create destination for captured audio
    const destination = audioContext.createMediaStreamDestination();

    // Connect source to destination (and back to speakers)
    source.connect(destination);
    source.connect(audioContext.destination); // Still play original audio

    console.log('✅ Audio capture initialized');
    return destination.stream;
  } catch (error) {
    console.error('❌ Audio capture failed:', error);
    return null;
  }
}

// Listen for video playback
document.addEventListener('play', (event) => {
  const video = event.target as HTMLVideoElement;
  if (video && video.src) {
    console.log('🎬 Video started playing:', video.src);

    const audioStream = captureYouTubeAudio();
    if (audioStream) {
      // Send to background script for processing
      chrome.runtime.sendMessage({
        type: 'AUDIO_STREAM_AVAILABLE',
        tabId: chrome.runtime.id
      });
    }
  }
}, true);
```

#### **Step 6: Implement Dubbed Audio Injection**

Update `/apps/extension/src/content/youtube-content-script.ts`:

```typescript
class DubbedAudioInjector {
  private audioContext: AudioContext;
  private gainNode: GainNode;
  private dubbedAudioSource?: AudioBufferSourceNode;

  constructor() {
    this.audioContext = new AudioContext({ sampleRate: 22050 });
    this.gainNode = this.audioContext.createGain();
    this.gainNode.connect(this.audioContext.destination);
  }

  async injectDubbedAudio(audioBuffer: ArrayBuffer) {
    try {
      // Decode audio buffer
      const decodedBuffer = await this.audioContext.decodeAudioData(audioBuffer);

      // Create source
      const source = this.audioContext.createBufferSource();
      source.buffer = decodedBuffer;
      source.connect(this.gainNode);

      // Stop previous audio if playing
      if (this.dubbedAudioSource) {
        this.dubbedAudioSource.stop();
      }

      // Play dubbed audio
      source.start();
      this.dubbedAudioSource = source;

      console.log('🎤 Dubbed audio injected and playing');
    } catch (error) {
      console.error('❌ Failed to inject dubbed audio:', error);
    }
  }

  setVolume(volume: number) {
    this.gainNode.gain.value = volume;
  }

  muteOriginal() {
    const video = document.querySelector('video');
    if (video) {
      video.volume = 0;
      video.muted = true;
    }
  }

  unmuteOriginal() {
    const video = document.querySelector('video');
    if (video) {
      video.volume = 1;
      video.muted = false;
    }
  }
}

// Usage
const injector = new DubbedAudioInjector();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'DUBBED_AUDIO') {
    injector.muteOriginal(); // Mute original audio
    injector.injectDubbedAudio(message.audioBuffer);
    sendResponse({ success: true });
  }
});
```

#### **Step 7: Wire End-to-End Pipeline**

Update `/apps/extension/src/background/background.ts`:

```typescript
import { AIPipeline } from './ai-pipeline';
import { ModelManager } from './model-manager-real';

const modelManager = new ModelManager();
const aiPipeline = new AIPipeline(modelManager);

// Initialize on extension startup
chrome.runtime.onInstalled.addListener(async () => {
  console.log('🚀 LiveWorldTV Extension installed');

  try {
    // Load models in background
    await modelManager.loadAllModels();
    await aiPipeline.initialize();
    console.log('✅ AI Pipeline ready');
  } catch (error) {
    console.error('❌ Initialization failed:', error);
  }
});

// Handle audio stream from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'AUDIO_STREAM_AVAILABLE') {
    handleAudioStream(sender.tab!.id!);
  }
});

async function handleAudioStream(tabId: number) {
  try {
    // Get audio stream from tab
    const stream = await chrome.tabCapture.capture({
      audio: true,
      video: false
    });

    // Process through AI pipeline
    const dubbedStream = await aiPipeline.startProcessing(
      stream,
      'es', // Source language (detect or config)
      'en'  // Target language (English)
    );

    // Send dubbed audio back to content script
    const reader = dubbedStream.getAudioTracks()[0].getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      chrome.tabs.sendMessage(tabId, {
        type: 'DUBBED_AUDIO',
        audioBuffer: value
      });
    }
  } catch (error) {
    console.error('❌ Audio stream processing failed:', error);
  }
}
```

### Testing Strategy

#### Unit Tests
```bash
# Test model loading
npm run test:extension -- model-manager-real.test.ts

# Test AI pipeline components
npm run test:extension -- ai-pipeline.test.ts
```

#### Integration Tests
```bash
# Test with sample audio file
node tools/scripts/test-ai-pipeline.js --audio sample.wav --lang es

# Expected output: English dubbed audio file
```

#### E2E Tests
```bash
# 1. Build extension
npm run build:extension

# 2. Install in Chrome
npm run ext:install

# 3. Open test page
open https://www.youtube.com/watch?v=YOUTUBE_LIVE_ID

# 4. Verify:
#    - Extension icon shows "Processing"
#    - Console shows inference timings
#    - Dubbed audio plays with <1s latency
#    - Original audio is muted
```

### Performance Targets

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| ASR Latency | <200ms | N/A | ⏳ Not implemented |
| MT Latency | <100ms | N/A | ⏳ Not implemented |
| TTS Latency | <300ms | N/A | ⏳ Not implemented |
| **End-to-End** | **<650ms** | **N/A** | **⏳ Not implemented** |
| Model Load Time | <5s | N/A | ⏳ Not implemented |
| Memory Usage | <500MB | N/A | ⏳ Not implemented |

### Troubleshooting

#### Models Not Loading
```bash
# Check model files exist
ls -lh apps/extension/models/

# Check file sizes match expected
# If files are incomplete, re-download with --force
node tools/scripts/download-models.js --force
```

#### CORS Errors
- Ensure models are served from extension's web_accessible_resources
- Check manifest.json includes `/models/*` in web_accessible_resources

#### WebGPU Not Available
- The pipeline falls back to WebAssembly (WASM)
- Performance will be slower (~2-3x)
- Check browser support: chrome://gpu

#### Audio Capture Fails
- Check extension has `tabCapture` permission
- Verify YouTube video is actually playing
- Check Chrome://media-internals for audio device info

### Estimated Implementation Time

| Task | Time | Complexity |
|------|------|------------|
| Download models | 30-60 min | Low |
| Implement ASR | 2-3 days | High |
| Implement MT | 2-3 days | High |
| Implement TTS | 1-2 days | Medium |
| Audio capture | 1 day | Medium |
| Audio injection | 1 day | Medium |
| Testing & debugging | 3-5 days | High |
| **Total** | **2-3 weeks** | **High** |

---

## 📚 References

- **Distil-Whisper**: https://huggingface.co/distil-whisper/distil-large-v3
- **NLLB-200**: https://huggingface.co/facebook/nllb-200-distilled-600M
- **Kokoro TTS**: https://huggingface.co/hexgrad/Kokoro-82M
- **ONNX Runtime Web**: https://onnxruntime.ai/docs/tutorials/web/
- **Chrome Extension Audio**: https://developer.chrome.com/docs/extensions/reference/tabCapture/

---

## 🎯 Next Steps

1. ✅ **Auto-play is working** - Test at http://localhost:3000
2. 🔄 **Download models** - Run `node tools/scripts/download-models.js`
3. 🔨 **Implement real inference** - Follow steps 2-4 above
4. 🔧 **Wire audio capture/injection** - Follow steps 5-6
5. 🧪 **Test end-to-end** - Follow testing strategy
6. 🚀 **Deploy to production** - Package extension for Chrome Web Store
