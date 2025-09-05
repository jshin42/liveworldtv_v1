import React from 'react';
import { TopicType } from '../../../packages/shared-types/src';

interface TopicFilterProps {
  value?: TopicType;
  onChange: (topic?: TopicType) => void;
}

export const TopicFilter: React.FC<TopicFilterProps> = ({ value, onChange }) => {
  const topics = [
    { value: undefined, label: '📺 All Topics', icon: '📺' },
    { value: 'news' as TopicType, label: '📰 News', icon: '📰' },
    { value: 'sports' as TopicType, label: '⚽ Sports', icon: '⚽' },
    { value: 'entertainment' as TopicType, label: '🎭 Entertainment', icon: '🎭' },
    { value: 'tech' as TopicType, label: '💻 Technology', icon: '💻' }
  ];

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Topic
      </label>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value as TopicType || undefined)}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      >
        {topics.map((topic) => (
          <option key={topic.value || 'all'} value={topic.value || ''}>
            {topic.label}
          </option>
        ))}
      </select>
    </div>
  );
};