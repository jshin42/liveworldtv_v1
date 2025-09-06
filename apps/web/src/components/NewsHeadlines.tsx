import React, { useState, useEffect } from 'react'

interface NewsHeadline {
  id: string
  title: string
  summary: string
  source: string
  publishedAt: Date
  category: 'BREAKING' | 'POLITICS' | 'WORLD' | 'BUSINESS' | 'SPORTS' | 'TECH'
  readTime: string
}

export const NewsHeadlines: React.FC = () => {
  const [headlines, setHeadlines] = useState<NewsHeadline[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL')

  useEffect(() => {
    // Mock headlines data that would typically come from news API
    const mockHeadlines: NewsHeadline[] = [
      {
        id: '1',
        title: 'Minnesota man freed after 27 years for wrongful murder conviction',
        summary: 'DNA evidence and witness testimonies lead to conviction being overturned after nearly three decades in prison.',
        source: 'NBC News',
        publishedAt: new Date(Date.now() - 1000 * 60 * 15), // 15 minutes ago
        category: 'BREAKING',
        readTime: '3 min read'
      },
      {
        id: '2', 
        title: 'Global climate summit reaches historic agreement',
        summary: 'World leaders commit to unprecedented carbon reduction targets in landmark international accord.',
        source: 'CNN International',
        publishedAt: new Date(Date.now() - 1000 * 60 * 45), // 45 minutes ago
        category: 'WORLD',
        readTime: '5 min read'
      },
      {
        id: '3',
        title: 'Tech giants report mixed quarterly earnings',
        summary: 'Major technology companies show varying performance amid economic uncertainty and market volatility.',
        source: 'BBC Business',
        publishedAt: new Date(Date.now() - 1000 * 60 * 120), // 2 hours ago
        category: 'BUSINESS',
        readTime: '4 min read'
      },
      {
        id: '4',
        title: 'New AI breakthrough in medical diagnosis announced',
        summary: 'Researchers develop artificial intelligence system that can detect rare diseases with 95% accuracy.',
        source: 'Reuters',
        publishedAt: new Date(Date.now() - 1000 * 60 * 180), // 3 hours ago
        category: 'TECH',
        readTime: '6 min read'
      }
    ]
    
    setHeadlines(mockHeadlines)
  }, [])

  const categories = ['ALL', 'BREAKING', 'POLITICS', 'WORLD', 'BUSINESS', 'SPORTS', 'TECH']

  const filteredHeadlines = selectedCategory === 'ALL' 
    ? headlines 
    : headlines.filter(h => h.category === selectedCategory)

  const getCategoryColor = (category: string): string => {
    const colors: Record<string, string> = {
      'BREAKING': 'bg-red-600',
      'POLITICS': 'bg-blue-600',
      'WORLD': 'bg-green-600',
      'BUSINESS': 'bg-purple-600',
      'SPORTS': 'bg-orange-600',
      'TECH': 'bg-indigo-600'
    }
    return colors[category] || 'bg-gray-600'
  }

  const getTimeAgo = (date: Date): string => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMins / 60)
    
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    
    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays}d ago`
  }

  return (
    <div className="bg-gray-800 rounded-lg">
      <div className="px-4 py-3 border-b border-gray-700">
        <h3 className="text-lg font-semibold text-white">Latest Headlines</h3>
        <p className="text-gray-400 text-sm">Breaking news and top stories</p>
      </div>

      {/* Category Filter */}
      <div className="px-4 py-3 border-b border-gray-700">
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                selectedCategory === category
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Headlines List */}
      <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
        {filteredHeadlines.map((headline) => (
          <article 
            key={headline.id}
            className="border-b border-gray-700 pb-4 last:border-b-0 hover:bg-gray-750 p-2 rounded transition-colors cursor-pointer"
          >
            <div className="flex items-start space-x-3">
              {/* Category Badge */}
              <div className={`${getCategoryColor(headline.category)} px-2 py-1 rounded text-xs font-bold text-white flex-shrink-0`}>
                {headline.category}
              </div>
              
              <div className="flex-1 min-w-0">
                <h4 className="text-white font-medium text-sm leading-tight mb-2 line-clamp-2">
                  {headline.title}
                </h4>
                
                <p className="text-gray-400 text-xs mb-2 line-clamp-2">
                  {headline.summary}
                </p>
                
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <div className="flex items-center space-x-2">
                    <span>{headline.source}</span>
                    <span>•</span>
                    <span>{headline.readTime}</span>
                  </div>
                  <span>{getTimeAgo(headline.publishedAt)}</span>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>

      {/* View More Button */}
      <div className="px-4 py-3 border-t border-gray-700">
        <button className="w-full text-center py-2 text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors">
          View All Headlines →
        </button>
      </div>
    </div>
  )
}