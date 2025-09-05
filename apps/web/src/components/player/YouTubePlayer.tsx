'use client';

import { useEffect, useRef, useState } from 'react';
import { Channel } from '@liveworldtv/shared-types';

interface YouTubePlayerProps {
  channel: Channel;
  dubbingEnabled: boolean;
  onDubbingToggle: () => void;
  className?: string;
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export function YouTubePlayer({ 
  channel, 
  dubbingEnabled, 
  onDubbingToggle, 
  className = '' 
}: YouTubePlayerProps) {
  const playerRef = useRef<HTMLDivElement>(null);
  const [player, setPlayer] = useState<any>(null);
  const [extensionAvailable, setExtensionAvailable] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if extension is available
    window.postMessage({ type: 'CHECK_EXTENSION' }, '*');
    
    const handleExtensionResponse = (event: MessageEvent) => {
      if (event.data?.type === 'EXTENSION_READY') {
        setExtensionAvailable(true);
      }
    };
    
    window.addEventListener('message', handleExtensionResponse);
    return () => window.removeEventListener('message', handleExtensionResponse);
  }, []);

  useEffect(() => {
    if (!channel?.sourceUrl) return;

    const videoId = extractVideoId(channel.sourceUrl);
    if (!videoId) return;

    // Load YouTube API
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.async = true;
      document.head.appendChild(tag);

      window.onYouTubeIframeAPIReady = () => {
        initializePlayer(videoId);
      };
    } else {
      initializePlayer(videoId);
    }

    function initializePlayer(videoId: string) {
      if (!playerRef.current) return;

      const newPlayer = new window.YT.Player(playerRef.current, {
        videoId,
        playerVars: {
          autoplay: 1,
          controls: 1,
          disablekb: 0,
          enablejsapi: 1,
          fs: 1,
          iv_load_policy: 3,
          modestbranding: 1,
          playsinline: 1,
          rel: 0,
          showinfo: 0
        },
        events: {
          onReady: (event: any) => {
            setPlayer(event.target);
            setIsLoading(false);
            
            // Notify extension about player ready
            if (extensionAvailable) {
              window.postMessage({
                type: 'PLAYER_READY',
                data: { channelId: channel.id, videoId }
              }, '*');
            }
          },
          onStateChange: (event: any) => {
            // Monitor for live stream status
            if (event.data === window.YT.PlayerState.PLAYING) {
              window.postMessage({
                type: 'PLAYBACK_STARTED',
                data: { channelId: channel.id }
              }, '*');
            }
          }
        }
      });
    }

    return () => {
      if (player) {
        player.destroy();
      }
    };
  }, [channel?.sourceUrl, extensionAvailable]);

  useEffect(() => {
    // Handle dubbing toggle
    if (player && extensionAvailable) {
      window.postMessage({
        type: dubbingEnabled ? 'ENABLE_DUBBING' : 'DISABLE_DUBBING',
        data: { channelId: channel.id }
      }, '*');
    }
  }, [dubbingEnabled, player, extensionAvailable, channel.id]);

  const extractVideoId = (url: string): string | null => {
    try {
      const urlObj = new URL(url);
      if (urlObj.hostname.includes('youtube.com')) {
        return urlObj.searchParams.get('v');
      }
      if (urlObj.pathname.includes('/embed/')) {
        return urlObj.pathname.split('/embed/')[1]?.split('?')[0];
      }
    } catch {
      return null;
    }
    return null;
  };

  return (
    <div className={`relative ${className}`}>
      {/* Player container */}
      <div 
        ref={playerRef}
        className="w-full aspect-video bg-black rounded-lg"
      />
      
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg">
          <div className="text-white text-lg">Loading live stream...</div>
        </div>
      )}
      
      {/* Dubbing controls */}
      <div className="absolute bottom-4 right-4 flex gap-2">
        {extensionAvailable && (
          <button
            onClick={onDubbingToggle}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              dubbingEnabled
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {dubbingEnabled ? '🎙️ Dubbing ON' : '🔇 Enable Dubbing'}
          </button>
        )}
        
        {!extensionAvailable && (
          <a
            href="chrome://extensions"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            📥 Install Extension
          </a>
        )}
      </div>
      
      {/* Channel info overlay */}
      <div className="absolute top-4 left-4 bg-black bg-opacity-70 text-white px-3 py-2 rounded-lg">
        <div className="text-sm font-medium">{channel.name}</div>
        <div className="text-xs opacity-75">{channel.country} • Live</div>
      </div>
    </div>
  );
}