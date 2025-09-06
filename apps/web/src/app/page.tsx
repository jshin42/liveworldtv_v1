'use client'

import React, { useState, useEffect } from 'react'
import { LiveNewsPlayer } from '../components/LiveNewsPlayer'
import { NewsChannelSelector } from '../components/NewsChannelSelector'
import { NewsHeadlines } from '../components/NewsHeadlines'

interface Channel {
  id: string
  name: string
  country: string
  sourceUrl: string
  thumbnailUrl?: string
  description?: string
  isLive: boolean
}

export default function Home() {
  const [currentChannel, setCurrentChannel] = useState<Channel | null>(null)
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadNewsChannels()
  }, [])

  const loadNewsChannels = async () => {
    try {
      // For now, use mock data that matches NBC News quality
      // TODO: Replace with real API call once backend is fully working
      const mockChannels: Channel[] = [
        {
          id: '1',
          name: 'NBC News Now',
          country: 'US',
          sourceUrl: 'https://www.youtube.com/embed/live_stream?channel=UCeY0bbntWzzVIaj2z3QigXg',
          description: 'Breaking news and top stories from NBC News',
          thumbnailUrl: '/images/nbc-news-logo.png',
          isLive: true
        },
        {
          id: '2', 
          name: 'CNN',
          country: 'US',
          sourceUrl: 'https://www.youtube.com/embed/live_stream?channel=UCupvZG-5ko_eiXAupbDfxWw',
          description: 'CNN live breaking news coverage',
          thumbnailUrl: '/images/cnn-logo.png', 
          isLive: true
        },
        {
          id: '3',
          name: 'BBC News',
          country: 'UK',
          sourceUrl: 'https://www.youtube.com/embed/live_stream?channel=UC16niRr50-MSBwiO3YDb3RA',
          description: 'BBC News live coverage from around the world',
          thumbnailUrl: '/images/bbc-logo.png',
          isLive: true
        }
      ]

      setChannels(mockChannels)
      setCurrentChannel(mockChannels[0]) // Start with NBC News to match screenshot
      setLoading(false)
    } catch (error) {
      console.error('Failed to load channels:', error)
      setLoading(false)
    }
  }

  const handleChannelSelect = (channel: Channel) => {
    setCurrentChannel(channel)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-lg">Loading LiveWorldTV...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header matching NBC News style */}
      <header className="bg-black border-b border-gray-800 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold text-white">LIVEWORLDTV</h1>
            <span className="text-red-500 text-sm font-medium">🔴 LIVE</span>
          </div>
          
          <div className="flex items-center space-x-2 text-sm text-gray-300">
            <span>{new Date().toLocaleTimeString()}</span>
            <span className="text-red-500">LIVE</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* Main Video Player - spans 3 columns on large screens */}
          <div className="lg:col-span-3">
            <div className="bg-black rounded-lg overflow-hidden">
              <LiveNewsPlayer 
                channel={currentChannel}
                onChannelChange={handleChannelSelect}
              />
            </div>
            
            {/* Channel Info Bar */}
            {currentChannel && (
              <div className="bg-gray-800 px-6 py-4 rounded-b-lg border-t border-gray-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                      {currentChannel.country}
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-white">
                        {currentChannel.name}
                      </h2>
                      <p className="text-gray-400 text-sm">
                        {currentChannel.description}
                      </p>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-white font-medium text-lg">2:25</div>
                    <div className="text-red-500 text-sm">LIVE</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Channel Selector */}
            <NewsChannelSelector 
              channels={channels}
              currentChannel={currentChannel}
              onChannelSelect={handleChannelSelect}
            />
            
            {/* Headlines */}
            <NewsHeadlines />
          </div>
        </div>
      </div>

      {/* Call to Action Bar matching screenshot */}
      <div className="fixed bottom-0 left-0 right-0 bg-blue-800 text-white py-3 px-4">
        <div className="max-w-7xl mx-auto flex items-center justify-center space-x-4">
          <span className="font-semibold">WATCH AND READ: DOWNLOAD THE LIVEWORLDTV EXTENSION</span>
          <button className="bg-white text-blue-800 px-4 py-2 rounded font-medium hover:bg-gray-100 transition-colors">
            Get Extension
          </button>
        </div>
      </div>
    </div>
  )
}
