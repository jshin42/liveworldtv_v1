import { useState, useCallback } from 'react';

interface ApiConfig {
  baseUrl: string;
  timeout: number;
}

interface ApiResponse<T = any> {
  data: T;
  meta?: {
    timestamp: string;
    version: string;
    requestId: string;
  };
}

export const useApi = (config: ApiConfig = { baseUrl: 'http://localhost:3001', timeout: 10000 }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const makeRequest = useCallback(async <T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> => {
    setLoading(true);
    setError(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeout);

    try {
      const response = await fetch(`${config.baseUrl}${endpoint}`, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (err) {
      clearTimeout(timeoutId);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [config.baseUrl, config.timeout]);

  const get = useCallback(<T = any>(endpoint: string): Promise<ApiResponse<T>> => {
    return makeRequest<T>(endpoint, { method: 'GET' });
  }, [makeRequest]);

  const post = useCallback(<T = any>(endpoint: string, data?: any): Promise<ApiResponse<T>> => {
    return makeRequest<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }, [makeRequest]);

  const put = useCallback(<T = any>(endpoint: string, data?: any): Promise<ApiResponse<T>> => {
    return makeRequest<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }, [makeRequest]);

  const del = useCallback(<T = any>(endpoint: string): Promise<ApiResponse<T>> => {
    return makeRequest<T>(endpoint, { method: 'DELETE' });
  }, [makeRequest]);

  return {
    get,
    post,
    put,
    delete: del,
    loading,
    error,
  };
};