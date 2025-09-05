import React, { useState, useEffect } from 'react';
import { ChannelGrid } from '../components/ChannelGrid';
import { CountrySelector } from '../components/CountrySelector';
import { TopicFilter } from '../components/TopicFilter';
import { SearchBar } from '../components/SearchBar';
import { SystemStatus } from '../components/SystemStatus';
import { RankingChart } from '../components/RankingChart';
import { useApi } from '../hooks/useApi';
import { Channel, CountryCode, TopicType, RankingResponse } from '../../../packages/shared-types/src';

interface DashboardState {
  selectedCountry: CountryCode;
  selectedTopic?: TopicType;
  searchQuery: string;
  channels: Channel[];
  rankings: RankingResponse | null;
  loading: boolean;
  error: string | null;
}

export const Dashboard: React.FC = () => {
  const { get } = useApi();
  
  const [state, setState] = useState<DashboardState>({
    selectedCountry: 'US',
    selectedTopic: undefined,
    searchQuery: '',
    channels: [],
    rankings: null,
    loading: false,
    error: null
  });

  useEffect(() => {
    loadChannels();
    loadRankings();
  }, [state.selectedCountry, state.selectedTopic]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (state.searchQuery.trim()) {
        searchChannels();
      } else {
        loadChannels();
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [state.searchQuery]);

  const loadChannels = async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const params = new URLSearchParams({
        country: state.selectedCountry,
        page: '1',
        limit: '24'
      });
      
      if (state.selectedTopic) {
        params.set('topic', state.selectedTopic);
      }

      const response = await get(`/api/v1/channels?${params}`);
      setState(prev => ({ 
        ...prev, 
        channels: response.data.data,
        loading: false 
      }));
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: 'Failed to load channels',
        loading: false 
      }));
    }
  };

  const loadRankings = async () => {
    try {
      const params = new URLSearchParams({
        timeWindow: '24h'
      });
      
      if (state.selectedCountry) {
        params.set('country', state.selectedCountry);
      }
      
      if (state.selectedTopic) {
        params.set('topic', state.selectedTopic);
      }

      const response = await get(`/api/v1/rankings/trending?${params}`);
      setState(prev => ({ 
        ...prev, 
        rankings: response.data 
      }));
    } catch (error) {
      console.error('Failed to load rankings:', error);
    }
  };

  const searchChannels = async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const params = new URLSearchParams({
        q: state.searchQuery,
        limit: '24'
      });
      
      if (state.selectedCountry) {
        params.set('country', state.selectedCountry);
      }

      const response = await get(`/api/v1/channels/search?${params}`);
      setState(prev => ({ 
        ...prev, 
        channels: response.data,
        loading: false 
      }));
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: 'Search failed',
        loading: false 
      }));
    }
  };

  const handleCountryChange = (country: CountryCode) => {
    setState(prev => ({ ...prev, selectedCountry: country }));
  };

  const handleTopicChange = (topic?: TopicType) => {
    setState(prev => ({ ...prev, selectedTopic: topic }));
  };

  const handleSearchChange = (query: string) => {
    setState(prev => ({ ...prev, searchQuery: query }));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            LiveWorldTV Dashboard
          </h1>
          <p className="text-gray-600">
            Discover and manage global live TV channels with real-time AI dubbing
          </p>
        </div>

        {/* System Status */}
        <div className="mb-6">
          <SystemStatus />
        </div>

        {/* Controls */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <CountrySelector 
              value={state.selectedCountry}
              onChange={handleCountryChange}
            />
            
            <TopicFilter
              value={state.selectedTopic}
              onChange={handleTopicChange}
            />
            
            <div className="md:col-span-2">
              <SearchBar
                value={state.searchQuery}
                onChange={handleSearchChange}
                placeholder="Search channels..."
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Content */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="p-6 border-b">
                <h2 className="text-xl font-semibold text-gray-900">
                  {state.searchQuery ? 'Search Results' : 'Live Channels'}
                </h2>
                <p className="text-gray-600 mt-1">
                  {state.channels.length} channels found
                </p>
              </div>
              
              <div className="p-6">
                {state.loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <span className="ml-2 text-gray-600">Loading channels...</span>
                  </div>
                ) : state.error ? (
                  <div className="text-center py-12">
                    <div className="text-red-600 mb-2">⚠️ {state.error}</div>
                    <button 
                      onClick={loadChannels}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Retry
                    </button>
                  </div>
                ) : (
                  <ChannelGrid 
                    channels={state.channels}
                    onChannelSelect={(channel) => console.log('Selected:', channel)}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            
            {/* Trending Rankings */}
            {state.rankings && (
              <div className="bg-white rounded-lg shadow-sm border">
                <div className="p-6 border-b">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Trending Now
                  </h3>
                  <p className="text-gray-600 text-sm mt-1">
                    Most popular in last 24h
                  </p>
                </div>
                
                <div className="p-6">
                  <RankingChart rankings={state.rankings} />
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="p-6 border-b">
                <h3 className="text-lg font-semibold text-gray-900">
                  Quick Actions
                </h3>
              </div>
              
              <div className="p-6 space-y-3">
                <button 
                  onClick={() => window.open('chrome-extension://[extension-id]/popup.html', '_blank')}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  🎯 Open Extension
                </button>
                
                <button 
                  onClick={loadRankings}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                >
                  📊 Refresh Rankings
                </button>
                
                <button 
                  onClick={() => get('/api/v1/ingestion/schedule-all')}
                  className="w-full px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
                >
                  🔍 Discover Channels
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};