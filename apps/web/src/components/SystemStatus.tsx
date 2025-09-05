import React, { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  components: {
    database: ComponentHealth;
    memory: ComponentHealth;
    disk: ComponentHealth;
    channels: ComponentHealth;
    analytics: ComponentHealth;
  };
  metadata: {
    uptime: number;
    version: string;
    environment: string;
  };
}

interface ComponentHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message: string;
  metrics?: Record<string, any>;
}

export const SystemStatus: React.FC = () => {
  const { get } = useApi();
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    loadSystemHealth();
    const interval = setInterval(loadSystemHealth, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadSystemHealth = async () => {
    try {
      const response = await get('/api/v1/health');
      setHealth(response.data);
    } catch (error) {
      console.error('Failed to load system health:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-50 border-green-200';
      case 'degraded': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'unhealthy': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return '✅';
      case 'degraded': return '⚠️';
      case 'unhealthy': return '❌';
      default: return '⚪';
    }
  };

  const formatUptime = (uptimeMs: number) => {
    const hours = Math.floor(uptimeMs / (1000 * 60 * 60));
    const minutes = Math.floor((uptimeMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border p-4">
        <div className="animate-pulse flex items-center">
          <div className="h-4 bg-gray-200 rounded w-24 mr-4"></div>
          <div className="h-3 bg-gray-200 rounded w-32"></div>
        </div>
      </div>
    );
  }

  if (!health) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center text-red-600">
          <span className="mr-2">❌</span>
          <span className="font-medium">System Status Unavailable</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border p-4 transition-all ${getStatusColor(health.status)}`}>
      <div 
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center">
          <span className="mr-3 text-lg">
            {getStatusIcon(health.status)}
          </span>
          <div>
            <div className="font-medium capitalize">
              System Status: {health.status}
            </div>
            <div className="text-sm opacity-75">
              Uptime: {formatUptime(health.metadata.uptime)} | v{health.metadata.version}
            </div>
          </div>
        </div>
        
        <div className="text-sm">
          {expanded ? '▼' : '▶'}
        </div>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-current border-opacity-20">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {Object.entries(health.components).map(([name, component]) => (
              <div key={name} className="text-center">
                <div className="text-lg mb-1">
                  {getStatusIcon(component.status)}
                </div>
                <div className="text-xs font-medium capitalize mb-1">
                  {name}
                </div>
                <div className="text-xs opacity-75">
                  {component.message}
                </div>
                {component.metrics && (
                  <div className="text-xs opacity-60 mt-1">
                    {Object.entries(component.metrics).slice(0, 2).map(([key, value]) => (
                      <div key={key}>
                        {key}: {typeof value === 'number' ? value.toLocaleString() : value}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          
          <div className="text-xs opacity-60 text-center mt-3">
            Last updated: {new Date(health.timestamp).toLocaleTimeString()}
          </div>
        </div>
      )}
    </div>
  );
};