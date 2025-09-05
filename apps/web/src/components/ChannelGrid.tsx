import React from 'react';
import { Channel } from '../../../packages/shared-types/src';

interface ChannelGridProps {
  channels: Channel[];
  onChannelSelect: (channel: Channel) => void;
}

export const ChannelGrid: React.FC<ChannelGridProps> = ({ channels, onChannelSelect }) => {
  const formatViewerCount = (count?: number) => {
    if (!count) return 'Unknown';
    if (count < 1000) return count.toString();
    if (count < 1000000) return `${(count / 1000).toFixed(1)}K`;
    return `${(count / 1000000).toFixed(1)}M`;
  };

  const getTopicBadgeColor = (topic: string) => {
    const colors = {
      'news': 'bg-red-100 text-red-800',
      'sports': 'bg-green-100 text-green-800',
      'entertainment': 'bg-purple-100 text-purple-800',
      'tech': 'bg-blue-100 text-blue-800'
    };
    return colors[topic as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  if (channels.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500 text-lg mb-2">No channels found</div>
        <p className="text-gray-400">Try adjusting your filters or search terms</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      {channels.map((channel) => (
        <div
          key={channel.id}
          onClick={() => onChannelSelect(channel)}
          className="bg-white border rounded-lg overflow-hidden hover:shadow-md transition-shadow cursor-pointer group"
        >
          {/* Thumbnail */}
          <div className="aspect-video bg-gray-200 relative">
            {channel.thumbnailUrl ? (
              <img
                src={channel.thumbnailUrl}
                alt={channel.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                📺
              </div>
            )}
            
            {/* Live indicator */}
            {channel.isLive && (
              <div className="absolute top-2 left-2 bg-red-600 text-white px-2 py-1 rounded text-xs font-medium">
                🔴 LIVE
              </div>
            )}
            
            {/* Viewer count */}
            {channel.currentViewers && (
              <div className="absolute bottom-2 right-2 bg-black bg-opacity-75 text-white px-2 py-1 rounded text-xs">
                👥 {formatViewerCount(channel.currentViewers)}
              </div>
            )}
          </div>

          {/* Content */}
          <div className="p-4">
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2">
                {channel.name}
              </h3>
              
              <div className="flex items-center ml-2">
                <span className="text-2xl">{getCountryFlag(channel.country)}</span>
              </div>
            </div>

            {channel.description && (
              <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                {channel.description}
              </p>
            )}

            {/* Topics */}
            <div className="flex flex-wrap gap-1 mb-3">
              {channel.topics?.slice(0, 3).map((topic) => (
                <span
                  key={topic}
                  className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getTopicBadgeColor(topic)}`}
                >
                  {topic}
                </span>
              ))}
            </div>

            {/* Metadata */}
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span className="flex items-center">
                🗣️ {channel.language?.toUpperCase()}
              </span>
              
              <span className="flex items-center">
                ⭐ {channel.qualityScore}/100
              </span>
              
              {channel.avgSessionDuration && (
                <span className="flex items-center">
                  ⏱️ {Math.round(channel.avgSessionDuration / 60)}m avg
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

function getCountryFlag(country: string): string {
  const flags: Record<string, string> = {
    'US': '🇺🇸',
    'UK': '🇬🇧', 
    'DE': '🇩🇪',
    'FR': '🇫🇷',
    'ES': '🇪🇸',
    'JP': '🇯🇵',
    'IT': '🇮🇹',
    'PT': '🇵🇹',
    'RU': '🇷🇺',
    'KR': '🇰🇷',
    'CN': '🇨🇳'
  };
  return flags[country] || '🌍';
}