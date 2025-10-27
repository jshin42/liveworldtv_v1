'use client';

import { useEffect, useState, useRef } from 'react';
import { DubbingService, DubbingConfig, DubbingStatus } from '../lib/dubbing/DubbingService';

interface Channel {
  id: string;
  name: string;
  country: string;
  topic: string;
  description?: string;
  sourceUrl: string;
  languageCode: string;
}

// Extract YouTube video ID from URL
function getYouTubeVideoId(url: string): string | null {
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname.includes('youtube.com')) {
      return urlObj.searchParams.get('v');
    }
    if (urlObj.hostname.includes('youtu.be')) {
      return urlObj.pathname.slice(1);
    }
    return null;
  } catch {
    return null;
  }
}

// Declare YouTube IFrame API types
declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export default function HomePage() {
  const [channel, setChannel] = useState<Channel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dubbing state
  const [dubbingEnabled, setDubbingEnabled] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState('english');
  const [dubbingStatus, setDubbingStatus] = useState<DubbingStatus>({
    state: 'idle',
    message: 'Not started',
    captionsAvailable: false
  });
  const dubbingServiceRef = useRef<DubbingService | null>(null);

  useEffect(() => {
    // Load YouTube IFrame API
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

    // Fetch random channel
    fetch('http://localhost:3001/api/v1/channels/random')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch channel');
        return res.json();
      })
      .then(data => {
        setChannel(data);
        setLoading(false);
        
        // Initialize YouTube player when API is ready
        if (window.YT && window.YT.Player) {
          initPlayer(data);
        } else {
          window.onYouTubeIframeAPIReady = () => initPlayer(data);
        }
      })
      .catch(err => {
        console.error('Error fetching channel:', err);
        setError(err.message);
        setLoading(false);
      });

    return () => {
      if (dubbingServiceRef.current) {
        dubbingServiceRef.current.dispose();
      }
    };
  }, []);

  function initPlayer(channelData: Channel) {
    const videoId = getYouTubeVideoId(channelData.sourceUrl);
    if (!videoId) {
      setError('Invalid YouTube URL');
      return;
    }

    new window.YT.Player('youtube-player', {
      height: '480',
      width: '854',
      videoId: videoId,
      playerVars: {
        autoplay: 1,
        mute: 0,
        controls: 1,
      },
      events: {
        onReady: (event: any) => {
          console.log('Player ready, starting playback');
          event.target.playVideo();
        },
        onError: (event: any) => {
          console.error('Player error:', event.data);
          setError('YouTube player error. This video may not be embeddable.');
        }
      }
    });
  }

  async function toggleDubbing() {
    if (!channel) return;

    if (!dubbingEnabled) {
      setDubbingStatus({
        state: 'initializing',
        message: 'Initializing dubbing service...',
        captionsAvailable: false
      });

      const config: DubbingConfig = {
        sourceLanguage: channel.languageCode || 'english',
        targetLanguage: targetLanguage,
        enabled: true,
        originalVolume: 0.3,
        dubbedVolume: 1.0,
      };

      try {
        const service = new DubbingService(config);

        // Set status callback for real-time updates
        service.setStatusCallback((status) => {
          setDubbingStatus(status);
        });

        await service.initialize();
        service.start();

        dubbingServiceRef.current = service;
        setDubbingEnabled(true);
      } catch (error) {
        console.error('Failed to start dubbing:', error);
        setDubbingStatus({
          state: 'error',
          message: (error as Error).message,
          captionsAvailable: false
        });
        setDubbingEnabled(false);
      }
    } else {
      if (dubbingServiceRef.current) {
        dubbingServiceRef.current.stop();
        dubbingServiceRef.current.dispose();
        dubbingServiceRef.current = null;
      }
      setDubbingEnabled(false);
      setDubbingStatus({
        state: 'idle',
        message: 'Dubbing stopped',
        captionsAvailable: false
      });
    }
  }

  function handleLanguageChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newLanguage = e.target.value;
    setTargetLanguage(newLanguage);

    if (dubbingServiceRef.current && dubbingEnabled) {
      dubbingServiceRef.current.updateConfig({ targetLanguage: newLanguage });
      setDubbingStatus({
        ...dubbingStatus,
        message: `Dubbing to ${newLanguage}`
      });
    }
  }

  // Test dubbing with sample text (for demonstration)
  async function testDubbing() {
    if (!dubbingServiceRef.current) return;

    const sampleTexts = [
      "Hello and welcome to our live news broadcast",
      "Breaking news from around the world",
      "Thank you for watching"
    ];

    const randomText = sampleTexts[Math.floor(Math.random() * sampleTexts.length)];
    await dubbingServiceRef.current.processCaptionText(randomText);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-2xl">Loading LiveWorldTV...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-red-500 text-2xl">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-5xl font-bold mb-2">🌍 LiveWorldTV</h1>
          <p className="text-gray-400 text-lg">
            Global live news streams from around the world
          </p>
        </div>

        {/* Channel Info */}
        {channel && (
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-3xl font-semibold">{channel.name}</h2>
              <span className="px-3 py-1 bg-red-600 text-sm font-bold rounded">
                LIVE
              </span>
              <span className="px-3 py-1 bg-gray-700 text-sm rounded">
                {channel.country}
              </span>
              <span className="px-3 py-1 bg-blue-600 text-sm rounded">
                {channel.topic}
              </span>
            </div>
            {channel.description && (
              <p className="text-gray-300">{channel.description}</p>
            )}
            <p className="text-sm text-gray-500 mt-1">
              Language: {channel.languageCode}
            </p>
          </div>
        )}

        {/* Real-Time Dubbing Controls */}
        <div className="bg-gradient-to-r from-purple-900 to-blue-900 p-6 rounded-lg mb-6 border-2 border-purple-500">
          <div className="flex items-center gap-3 mb-4">
            <h3 className="text-2xl font-bold">
              🎙️ REAL-TIME Live Dubbing
            </h3>
            <span className="px-3 py-1 bg-green-600 text-xs font-bold rounded animate-pulse">
              BETA
            </span>
          </div>

          <p className="text-sm text-gray-300 mb-4">
            Instant speech recognition → translation → voice synthesis. <strong>Zero latency buffering.</strong>
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={toggleDubbing}
              className={`px-8 py-4 rounded-lg font-bold text-lg transition-all transform hover:scale-105 ${
                dubbingEnabled
                  ? 'bg-red-600 hover:bg-red-700 shadow-red-500/50 shadow-lg'
                  : 'bg-green-600 hover:bg-green-700 shadow-green-500/50 shadow-lg'
              }`}
            >
              {dubbingEnabled ? '⏹ Stop Dubbing' : '▶️ Start Real-Time Dubbing'}
            </button>

            <div>
              <label className="text-sm text-gray-300 block mb-2 font-semibold">
                Translate to:
              </label>
              <select
                value={targetLanguage}
                onChange={handleLanguageChange}
                className="bg-gray-800 text-white px-4 py-3 rounded-lg border-2 border-gray-600 hover:border-purple-500 transition"
              >
                <option value="english">🇺🇸 English</option>
                <option value="spanish">🇪🇸 Spanish</option>
                <option value="french">🇫🇷 French</option>
                <option value="german">🇩🇪 German</option>
                <option value="japanese">🇯🇵 Japanese</option>
                <option value="korean">🇰🇷 Korean</option>
                <option value="chinese">🇨🇳 Chinese</option>
                <option value="portuguese">🇧🇷 Portuguese</option>
                <option value="russian">🇷🇺 Russian</option>
                <option value="arabic">🇸🇦 Arabic</option>
                <option value="hindi">🇮🇳 Hindi</option>
              </select>
            </div>

            {dubbingEnabled && (
              <button
                onClick={testDubbing}
                className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold transition-all"
              >
                🧪 Test Dubbing
              </button>
            )}

            <div className="flex-1 bg-gray-800 px-4 py-3 rounded-lg">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  dubbingStatus.state === 'active' ? 'bg-green-500 animate-pulse' :
                  dubbingStatus.state === 'initializing' ? 'bg-yellow-500 animate-pulse' :
                  dubbingStatus.state === 'error' ? 'bg-red-500' :
                  dubbingStatus.state === 'unsupported' ? 'bg-orange-500' :
                  'bg-gray-500'
                }`}></div>
                <p className={`text-sm font-semibold ${
                  dubbingStatus.state === 'active' ? 'text-green-400' :
                  dubbingStatus.state === 'initializing' ? 'text-yellow-400' :
                  dubbingStatus.state === 'error' ? 'text-red-400' :
                  dubbingStatus.state === 'unsupported' ? 'text-orange-400' :
                  'text-gray-400'
                }`}>
                  Status: {dubbingStatus.message}
                </p>
              </div>
              {dubbingStatus.lastTranscript && (
                <div className="mt-2 text-xs text-gray-400 border-t border-gray-700 pt-2">
                  <p><strong>Original:</strong> {dubbingStatus.lastTranscript}</p>
                  {dubbingStatus.lastTranslation && (
                    <p className="mt-1"><strong>Translated:</strong> {dubbingStatus.lastTranslation}</p>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 p-4 bg-gray-800/50 rounded border border-gray-700">
            <p className="text-xs text-gray-400 mb-2">
              <strong>How it works (Demo Mode):</strong>
            </p>
            <ol className="text-xs text-gray-400 list-decimal ml-4 space-y-1">
              <li>Uses YouTube caption tracks when available (browser API)</li>
              <li>Translates caption text to target language (MyMemory API)</li>
              <li>Synthesizes translated speech (Web Speech Synthesis API)</li>
              <li><strong>Translation + TTS latency: ~1-2 seconds</strong></li>
            </ol>
            <p className="text-xs text-yellow-300 mt-3 bg-yellow-900/20 p-2 rounded border border-yellow-700">
              <strong>⚠️ Demo Limitation:</strong> This demo uses YouTube captions (when available).
              For production real-time audio dubbing, the project requires a browser extension with
              local Whisper model (see CLAUDE.md for full architecture).
            </p>
            <p className="text-xs text-blue-300 mt-2">
              Click "Test Dubbing" to hear sample translations!
            </p>
          </div>
        </div>

        {/* YouTube Player */}
        <div className="bg-black rounded-lg overflow-hidden shadow-2xl mb-8">
          <div id="youtube-player"></div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-3 gap-4 mt-8">
          <div className="bg-gray-800 p-4 rounded-lg">
            <h3 className="font-bold mb-2">🎯 Random Discovery</h3>
            <p className="text-sm text-gray-400">
              Auto-loads a random live channel from around the world
            </p>
          </div>
          <div className="bg-gray-800 p-4 rounded-lg">
            <h3 className="font-bold mb-2">🌐 20+ Countries</h3>
            <p className="text-sm text-gray-400">
              US, UK, Japan, France, Germany, India, Korea, and more
            </p>
          </div>
          <div className="bg-gray-800 p-4 rounded-lg">
            <h3 className="font-bold mb-2">🎙️ Real-Time Dubbing</h3>
            <p className="text-sm text-gray-400">
              Instant translation to 11+ languages with {'<'}1-2s latency
            </p>
          </div>
        </div>

        {/* API Status */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Powered by LiveWorldTV API v0.2.0 with Real-Time Dubbing</p>
          <p className="mt-1">
            <a href="/browse" className="text-blue-400 hover:text-blue-300">
              Browse Channels
            </a>
            {' | '}
            <a
              href="http://localhost:3001/api/docs"
              target="_blank"
              className="text-blue-400 hover:text-blue-300"
            >
              API Docs
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
