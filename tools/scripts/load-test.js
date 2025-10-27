/**
 * LiveWorldTV Load Testing Script
 *
 * This script tests the API under realistic load conditions
 * Run with: k6 run tools/scripts/load-test.js
 *
 * Install k6:
 * - macOS: brew install k6
 * - Linux: sudo apt-get install k6
 * - Windows: choco install k6
 *
 * Or via Docker:
 * docker run --rm -i grafana/k6 run - <tools/scripts/load-test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Configuration
const API_URL = __ENV.API_URL || 'http://localhost:3001';

// Custom metrics
const errorRate = new Rate('errors');
const channelLoadTime = new Trend('channel_load_duration');
const streamLoadTime = new Trend('stream_load_duration');

// Test configuration
export const options = {
  stages: [
    // Ramp up
    { duration: '30s', target: 10 },  // Ramp to 10 users
    { duration: '1m', target: 50 },   // Ramp to 50 users
    { duration: '2m', target: 100 },  // Ramp to 100 users

    // Steady state
    { duration: '3m', target: 100 },  // Stay at 100 users

    // Peak load
    { duration: '1m', target: 200 },  // Spike to 200 users
    { duration: '2m', target: 200 },  // Stay at peak

    // Ramp down
    { duration: '1m', target: 0 },    // Ramp down to 0
  ],
  thresholds: {
    // HTTP errors should be less than 1%
    errors: ['rate<0.01'],

    // 95% of requests should complete under 500ms
    http_req_duration: ['p(95)<500'],

    // 99% of requests should complete under 1000ms
    'http_req_duration{name:health}': ['p(99)<100'],
    'http_req_duration{name:channels}': ['p(99)<500'],
    'http_req_duration{name:stream}': ['p(99)<600'],
    'http_req_duration{name:search}': ['p(99)<400'],

    // Success rate should be above 99%
    http_req_failed: ['rate<0.01'],
  },
};

// Countries to test
const countries = ['US', 'UK', 'DE', 'FR', 'ES', 'JP'];
const topics = ['NEWS', 'SPORTS', 'MUSIC_DJS'];

/**
 * Main test scenario
 */
export default function () {
  // Scenario 1: Health check
  testHealthCheck();

  // Scenario 2: Load channel list (most common operation)
  const channelId = testChannelList();

  // Scenario 3: Get channel details
  if (channelId) {
    testChannelDetails(channelId);

    // Scenario 4: Get stream status
    testStreamStatus(channelId);
  }

  // Scenario 5: Search channels (15% of users)
  if (Math.random() < 0.15) {
    testChannelSearch();
  }

  // Scenario 6: Get channel count (10% of users)
  if (Math.random() < 0.10) {
    testChannelCount();
  }

  // Simulate user think time (1-3 seconds)
  sleep(Math.random() * 2 + 1);
}

/**
 * Test health check endpoint
 */
function testHealthCheck() {
  const res = http.get(`${API_URL}/health`, {
    tags: { name: 'health' },
  });

  check(res, {
    'health: status 200': (r) => r.status === 200,
    'health: response time < 100ms': (r) => r.timings.duration < 100,
  });

  errorRate.add(res.status !== 200);
}

/**
 * Test channel list endpoint
 */
function testChannelList() {
  const country = countries[Math.floor(Math.random() * countries.length)];
  const topic = Math.random() < 0.5 ? topics[Math.floor(Math.random() * topics.length)] : '';

  const url = topic
    ? `${API_URL}/v1/channels?country=${country}&topic=${topic}`
    : `${API_URL}/v1/channels?country=${country}`;

  const res = http.get(url, {
    tags: { name: 'channels' },
  });

  const success = check(res, {
    'channels: status 200': (r) => r.status === 200,
    'channels: has data': (r) => r.json('data') !== undefined,
    'channels: has channels array': (r) => Array.isArray(r.json('data.channels')),
    'channels: has pagination': (r) => r.json('data.pagination') !== undefined,
    'channels: response time < 500ms': (r) => r.timings.duration < 500,
  });

  errorRate.add(!success);
  channelLoadTime.add(res.timings.duration);

  // Extract a channel ID for subsequent tests
  try {
    const body = JSON.parse(res.body);
    if (body.data && body.data.channels && body.data.channels.length > 0) {
      return body.data.channels[0].id;
    }
  } catch (e) {
    // Ignore parsing errors
  }

  return null;
}

/**
 * Test channel details endpoint
 */
function testChannelDetails(channelId) {
  const res = http.get(`${API_URL}/v1/channels/${channelId}`, {
    tags: { name: 'channel-details' },
  });

  const success = check(res, {
    'channel details: status 200': (r) => r.status === 200,
    'channel details: has data': (r) => r.json('data') !== undefined,
    'channel details: has channel ID': (r) => r.json('data.id') === channelId,
    'channel details: response time < 300ms': (r) => r.timings.duration < 300,
  });

  errorRate.add(!success);
}

/**
 * Test stream status endpoint
 */
function testStreamStatus(channelId) {
  const res = http.get(`${API_URL}/v1/channels/${channelId}/stream`, {
    tags: { name: 'stream' },
  });

  const success = check(res, {
    'stream: status 200': (r) => r.status === 200,
    'stream: has data': (r) => r.json('data') !== undefined,
    'stream: has status': (r) => r.json('data.status') !== undefined,
    'stream: response time < 600ms': (r) => r.timings.duration < 600,
  });

  errorRate.add(!success);
  streamLoadTime.add(res.timings.duration);
}

/**
 * Test channel search endpoint
 */
function testChannelSearch() {
  const queries = ['news', 'live', 'bbc', 'cnn', 'nbc', 'sports'];
  const query = queries[Math.floor(Math.random() * queries.length)];

  const res = http.get(`${API_URL}/v1/channels/search?q=${query}`, {
    tags: { name: 'search' },
  });

  const success = check(res, {
    'search: status 200': (r) => r.status === 200,
    'search: has data': (r) => r.json('data') !== undefined,
    'search: is array': (r) => Array.isArray(r.json('data')),
    'search: response time < 400ms': (r) => r.timings.duration < 400,
  });

  errorRate.add(!success);
}

/**
 * Test channel count endpoint
 */
function testChannelCount() {
  const country = Math.random() < 0.5 ? countries[Math.floor(Math.random() * countries.length)] : '';
  const topic = Math.random() < 0.5 ? topics[Math.floor(Math.random() * topics.length)] : '';

  let url = `${API_URL}/v1/channels/stats/count`;
  const params = [];
  if (country) params.push(`country=${country}`);
  if (topic) params.push(`topic=${topic}`);
  if (params.length > 0) url += '?' + params.join('&');

  const res = http.get(url, {
    tags: { name: 'count' },
  });

  const success = check(res, {
    'count: status 200': (r) => r.status === 200,
    'count: has data': (r) => r.json('data') !== undefined,
    'count: has count': (r) => typeof r.json('data.count') === 'number',
    'count: response time < 200ms': (r) => r.timings.duration < 200,
  });

  errorRate.add(!success);
}

/**
 * Setup function - runs once before all tests
 */
export function setup() {
  console.log('Starting load test...');
  console.log(`API URL: ${API_URL}`);
  console.log('Test stages:');
  console.log('  1. Ramp up to 10 users (30s)');
  console.log('  2. Ramp up to 50 users (1m)');
  console.log('  3. Ramp up to 100 users (2m)');
  console.log('  4. Steady state at 100 users (3m)');
  console.log('  5. Peak load at 200 users (3m)');
  console.log('  6. Ramp down to 0 users (1m)');
  console.log('  Total duration: ~11 minutes');
  console.log('');

  // Verify API is accessible
  const healthCheck = http.get(`${API_URL}/health`);
  if (healthCheck.status !== 200) {
    throw new Error(`API health check failed: ${healthCheck.status}`);
  }

  console.log('✅ API health check passed');
  console.log('');

  return { startTime: new Date() };
}

/**
 * Teardown function - runs once after all tests
 */
export function teardown(data) {
  const endTime = new Date();
  const duration = (endTime - data.startTime) / 1000;

  console.log('');
  console.log('Load test completed!');
  console.log(`Duration: ${duration.toFixed(2)}s`);
  console.log('');
  console.log('Check the summary above for detailed results.');
}
