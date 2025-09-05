import React from 'react';
import { RankingResponse } from '../../../packages/shared-types/src';

interface RankingChartProps {
  rankings: RankingResponse;
}

export const RankingChart: React.FC<RankingChartProps> = ({ rankings }) => {
  const topRankings = rankings.rankings.slice(0, 10);
  
  const maxTrendScore = Math.max(...topRankings.map(r => r.metrics.trendScore));

  return (
    <div className="space-y-3">
      {topRankings.map((ranking, index) => (
        <div key={ranking.channel.id} className="flex items-center space-x-3">
          <div className="flex-shrink-0 w-6 text-center">
            <span className={`font-bold text-sm ${
              index < 3 ? 'text-yellow-600' : 'text-gray-500'
            }`}>
              #{ranking.rank}
            </span>
          </div>
          
          <div className="flex-grow min-w-0">
            <div className="flex items-center justify-between mb-1">
              <div className="text-sm font-medium text-gray-900 truncate">
                {ranking.channel.name}
              </div>
              <div className="text-xs text-gray-500 flex-shrink-0 ml-2">
                {getCountryFlag(ranking.channel.country)}
              </div>
            </div>
            
            <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
              <div
                className={`h-2 rounded-full transition-all ${
                  index < 3 ? 'bg-yellow-400' : 'bg-blue-400'
                }`}
                style={{
                  width: `${(ranking.metrics.trendScore / maxTrendScore) * 100}%`
                }}
              />
            </div>
            
            <div className="flex justify-between text-xs text-gray-500">
              <span>👥 {ranking.metrics.viewCount.toLocaleString()}</span>
              <span>⏱️ {Math.round(ranking.metrics.avgSessionDuration / 60)}m</span>
              <span>🔥 {ranking.metrics.trendScore}</span>
            </div>
          </div>
        </div>
      ))}
      
      {rankings.rankings.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <div className="text-lg mb-2">📊</div>
          <div className="text-sm">No ranking data available</div>
        </div>
      )}
      
      <div className="text-xs text-gray-400 text-center pt-3 border-t">
        Updated {new Date(rankings.metadata.lastUpdated).toLocaleTimeString()}
      </div>
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