'use client';

import { useEffect, useState } from 'react';

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
            <h3 className="font-bold mb-2">📺 Real-time Streaming</h3>
            <p className="text-sm text-gray-400">
              Watch live news as it happens, powered by YouTube
            </p>
          </div>
        </div>

        {/* API Status */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Powered by LiveWorldTV API v0.1.0</p>
          <p className="mt-1">
            <a 
              href="http://localhost:3001/api/docs" 
              target="_blank"
              className="text-blue-400 hover:text-blue-300"
            >
              View API Documentation
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
