import React, { useEffect, useRef, useState } from 'react'

interface Channel {
  id: string
  name: string
  country: string
  sourceUrl: string
  thumbnailUrl?: string
  description?: string
  isLive: boolean
}

interface LiveNewsPlayerProps {
  channel: Channel | null
  onChannelChange: (channel: Channel) => void
}

export const LiveNewsPlayer: React.FC<LiveNewsPlayerProps> = ({ 
  channel, 
  onChannelChange 
}) => {
  const [showOverlay, setShowOverlay] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)

  // Auto-hide overlay after 3 seconds
  useEffect(() => {
    if (showOverlay) {
      const timer = setTimeout(() => {
        setShowOverlay(false)
      }, 3000)
      
      return () => clearTimeout(timer)
    }
  }, [showOverlay])

  const handlePlayerClick = () => {
    setShowOverlay(true)
    setIsPlaying(!isPlaying)
  }

  if (!channel) {
    return (
      <div className="aspect-video bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400 text-lg">No channel selected</div>
      </div>
    )
  }

  return (
    <div className="relative aspect-video bg-black group" onClick={handlePlayerClick}>
      {/* YouTube Embed */}
      <iframe
        src={`${channel.sourceUrl}&autoplay=1&mute=0&controls=1`}
        className="w-full h-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        title={`${channel.name} Live Stream`}
      />

      {/* News Overlay matching NBC News style */}
      {showOverlay && (
        <div className="absolute inset-0 pointer-events-none">
          {/* Top Left - Channel branding */}
          <div className="absolute top-4 left-4 bg-black bg-opacity-75 px-3 py-2 rounded">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center text-white text-xs font-bold">
                {channel.country}
              </div>
              <span className="text-white text-sm font-semibold">{channel.name}</span>
            </div>
          </div>

          {/* Top Right - Live indicator */}
          <div className="absolute top-4 right-4 bg-red-600 px-3 py-1 rounded">
            <span className="text-white text-sm font-bold">🔴 LIVE</span>
          </div>

          {/* Bottom overlay with news headline style */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/80 to-transparent p-6">
            <div className="text-white">
              {/* Breaking news banner */}
              <div className="flex items-center space-x-3 mb-2">
                <div className="bg-red-600 px-2 py-1 rounded text-xs font-bold">
                  BREAKING
                </div>
                <div className="text-blue-400 text-sm font-medium">
                  {new Date().toLocaleTimeString()} ET
                </div>
              </div>
              
              {/* Headline matching screenshot style */}
              <h2 className="text-2xl font-bold mb-2 leading-tight">
                Minnesota man leaves prison after serving 27 years for a murder he didn't commit
              </h2>
              
              {/* Subtitle */}
              <p className="text-gray-300 text-lg">
                DNA evidence and new witnesses led to the conviction being overturned
              </p>
            </div>
          </div>

          {/* Play/Pause overlay control */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto">
            <button 
              className="bg-black bg-opacity-50 rounded-full p-4 text-white hover:bg-opacity-75 transition-colors"
              onClick={handlePlayerClick}
            >
              {isPlaying ? (
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M6 4h2v12H6V4zm6 0h2v12h-2V4z" />
                </svg>
              ) : (
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M6.8 4.7l7.6 4.8c.4.3.4.9 0 1.2L6.8 15.3c-.5.3-1.2-.1-1.2-.7V5.4c0-.6.7-1 1.2-.7z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}