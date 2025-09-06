import React from 'react'

interface Channel {
  id: string
  name: string
  country: string
  sourceUrl: string
  thumbnailUrl?: string
  description?: string
  isLive: boolean
}

interface NewsChannelSelectorProps {
  channels: Channel[]
  currentChannel: Channel | null
  onChannelSelect: (channel: Channel) => void
}

export const NewsChannelSelector: React.FC<NewsChannelSelectorProps> = ({
  channels,
  currentChannel,
  onChannelSelect
}) => {
  const getCountryFlag = (countryCode: string): string => {
    const flags: Record<string, string> = {
      'US': '🇺🇸',
      'UK': '🇬🇧',
      'GB': '🇬🇧',
      'DE': '🇩🇪',
      'FR': '🇫🇷',
      'ES': '🇪🇸',
      'JP': '🇯🇵',
      'IT': '🇮🇹',
      'PT': '🇵🇹',
      'RU': '🇷🇺',
      'KR': '🇰🇷',
      'CN': '🇨🇳'
    }
    return flags[countryCode] || '🌍'
  }

  return (
    <div className="bg-gray-800 rounded-lg">
      <div className="px-4 py-3 border-b border-gray-700">
        <h3 className="text-lg font-semibold text-white">Live News Channels</h3>
        <p className="text-gray-400 text-sm">Select a channel to watch</p>
      </div>
      
      <div className="p-4 space-y-2">
        {channels.map((channel) => (
          <button
            key={channel.id}
            onClick={() => onChannelSelect(channel)}
            className={`w-full text-left p-3 rounded-lg transition-all hover:bg-gray-700 ${
              currentChannel?.id === channel.id 
                ? 'bg-blue-600 border border-blue-500' 
                : 'bg-gray-700 border border-gray-600'
            }`}
          >
            <div className="flex items-center space-x-3">
              {/* Channel thumbnail or placeholder */}
              <div className="w-12 h-8 bg-gray-600 rounded flex items-center justify-center text-xs">
                {channel.thumbnailUrl ? (
                  <img 
                    src={channel.thumbnailUrl} 
                    alt={channel.name}
                    className="w-full h-full object-cover rounded"
                  />
                ) : (
                  <span className="text-gray-300">📺</span>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <span className="text-lg">{getCountryFlag(channel.country)}</span>
                  <h4 className="text-white font-medium truncate">
                    {channel.name}
                  </h4>
                  {channel.isLive && (
                    <span className="bg-red-600 text-white text-xs px-2 py-1 rounded font-bold">
                      LIVE
                    </span>
                  )}
                </div>
                
                {channel.description && (
                  <p className="text-gray-400 text-sm truncate mt-1">
                    {channel.description}
                  </p>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
      
      {/* Add Channel Button */}
      <div className="px-4 py-3 border-t border-gray-700">
        <button className="w-full text-left p-3 rounded-lg bg-gray-700 border border-dashed border-gray-500 hover:border-gray-400 transition-colors text-gray-400 hover:text-gray-300">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-8 bg-gray-600 rounded flex items-center justify-center">
              <span className="text-2xl">+</span>
            </div>
            <div>
              <h4 className="font-medium">Add Channel</h4>
              <p className="text-xs">Discover more news sources</p>
            </div>
          </div>
        </button>
      </div>
    </div>
  )
}