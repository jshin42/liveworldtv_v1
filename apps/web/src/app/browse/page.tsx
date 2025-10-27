'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

// API Configuration from environment variables
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Channel {
  id: string;
  name: string;
  country: string;
  topic: string;
  description?: string;
  thumbnailUrl?: string;
  languageCode: string;
}

interface PaginatedResponse {
  data: Channel[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasNext: boolean;
  };
}

export default function BrowsePage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [selectedTopic, setSelectedTopic] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch countries and topics
    Promise.all([
      fetch(`${API_URL}/api/v1/channels/countries`).then(r => r.json()),
      fetch(`${API_URL}/api/v1/channels/topics`).then(r => r.json()),
    ]).then(([countriesData, topicsData]) => {
      setCountries(countriesData.countries);
      setTopics(topicsData.topics);
    });
  }, []);

  useEffect(() => {
    // Fetch channels with filters
    setLoading(true);
    let url = `${API_URL}/api/v1/channels?limit=20`;
    if (selectedCountry) url += `&country=${selectedCountry}`;
    if (selectedTopic) url += `&topic=${selectedTopic}`;

    fetch(url)
      .then(r => r.json())
      .then((data: PaginatedResponse) => {
        setChannels(data.data);
        setLoading(false);
      });
  }, [selectedCountry, selectedTopic]);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Browse Channels</h1>
          <Link href="/" className="text-blue-400 hover:text-blue-300">
            ← Back to Random Stream
          </Link>
        </div>

        {/* Filters */}
        <div className="mb-8 flex gap-4">
          <div>
            <label className="block text-sm mb-2">Filter by Country</label>
            <select
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
              className="bg-gray-800 text-white px-4 py-2 rounded border border-gray-700"
            >
              <option value="">All Countries</option>
              {countries.map(country => (
                <option key={country} value={country}>{country}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm mb-2">Filter by Topic</label>
            <select
              value={selectedTopic}
              onChange={(e) => setSelectedTopic(e.target.value)}
              className="bg-gray-800 text-white px-4 py-2 rounded border border-gray-700"
            >
              <option value="">All Topics</option>
              {topics.map(topic => (
                <option key={topic} value={topic}>{topic}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Channel Grid */}
        {loading ? (
          <div className="text-center text-gray-400">Loading channels...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {channels.map(channel => (
              <div
                key={channel.id}
                className="bg-gray-800 rounded-lg p-6 hover:bg-gray-750 transition cursor-pointer"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-xl font-semibold">{channel.name}</h3>
                  <span className="px-2 py-1 bg-red-600 text-xs font-bold rounded">
                    LIVE
                  </span>
                </div>
                
                <p className="text-gray-400 text-sm mb-3">
                  {channel.description || 'Live news coverage'}
                </p>
                
                <div className="flex gap-2">
                  <span className="px-2 py-1 bg-gray-700 text-xs rounded">
                    {channel.country}
                  </span>
                  <span className="px-2 py-1 bg-blue-600 text-xs rounded">
                    {channel.topic}
                  </span>
                  <span className="px-2 py-1 bg-gray-700 text-xs rounded">
                    {channel.languageCode}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {channels.length === 0 && !loading && (
          <div className="text-center text-gray-400 mt-8">
            No channels found with selected filters
          </div>
        )}
      </div>
    </div>
  );
}
