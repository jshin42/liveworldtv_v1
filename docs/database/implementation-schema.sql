-- LiveWorldTV Database Implementation Schema
-- PostgreSQL 16+ with required extensions

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For text search and similarity
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements"; -- For query performance monitoring

-- Create custom types
CREATE TYPE channel_topic AS ENUM ('NEWS', 'SPORTS', 'MUSIC_DJS');
CREATE TYPE channel_source AS ENUM ('YOUTUBE_EMBED', 'LICENSED');
CREATE TYPE stream_status AS ENUM ('LIVE', 'OFF', 'UNKNOWN');
CREATE TYPE event_type AS ENUM (
  'PLAY_START', 
  'DUB_ENABLED', 
  'DUB_DISABLED', 
  'SEEK', 
  'STOP',
  'EXTENSION_INSTALLED', 
  'MODEL_LOADED', 
  'QUALITY_FEEDBACK',
  'MODEL_DOWNLOAD_START',
  'MODEL_DOWNLOAD_COMPLETE'
);

-- ============================================================================
-- CORE CONTENT TABLES
-- ============================================================================

-- Channels catalog with performance indexes
CREATE TABLE channels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  country CHAR(2) NOT NULL,
  topic channel_topic NOT NULL,
  source_type channel_source NOT NULL DEFAULT 'YOUTUBE_EMBED',
  source_url TEXT NOT NULL,
  youtube_channel_id VARCHAR(50), -- For YouTube API correlation
  owner VARCHAR(255),
  description TEXT,
  thumbnail_url TEXT,
  language_code CHAR(3) DEFAULT 'unk', -- ISO 639-3 for audio language
  first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  active BOOLEAN NOT NULL DEFAULT true,
  verified BOOLEAN NOT NULL DEFAULT false, -- Content quality verified
  metadata JSONB DEFAULT '{}',
  content_fingerprint CHAR(16) NOT NULL, -- For duplicate detection
  search_vector tsvector, -- For full-text search
  
  -- Constraints
  CONSTRAINT channels_country_check CHECK (country ~ '^[A-Z]{2}$'),
  CONSTRAINT channels_url_check CHECK (source_url ~ '^https://'),
  CONSTRAINT channels_name_length CHECK (char_length(name) BETWEEN 3 AND 255),
  
  -- Unique constraints
  UNIQUE (content_fingerprint),
  UNIQUE (source_url),
  
  -- Performance indexes
  INDEX idx_channels_country_topic_active (country, topic, active, last_seen DESC),
  INDEX idx_channels_active_last_seen (active, last_seen DESC) WHERE active = true,
  INDEX idx_channels_source_url_hash USING hash (source_url),
  INDEX idx_channels_youtube_id_hash USING hash (youtube_channel_id),
  INDEX idx_channels_search_vector USING gin (search_vector),
  INDEX idx_channels_fingerprint_hash USING hash (content_fingerprint)
);

-- Trigger for search vector updates
CREATE OR REPLACE FUNCTION update_channel_search_vector() RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', 
    COALESCE(NEW.name, '') || ' ' || 
    COALESCE(NEW.description, '') || ' ' || 
    COALESCE(NEW.owner, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_channel_search_vector 
  BEFORE INSERT OR UPDATE ON channels
  FOR EACH ROW EXECUTE FUNCTION update_channel_search_vector();

-- Live stream status tracking with automatic cleanup
CREATE TABLE live_streams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  status stream_status NOT NULL DEFAULT 'UNKNOWN',
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  delay_seconds INTEGER DEFAULT 30,
  dvr_window_sec INTEGER DEFAULT 10800, -- 3 hours (YouTube max)
  viewer_count INTEGER DEFAULT 0,
  peak_viewer_count INTEGER DEFAULT 0,
  last_checked TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  quality_metrics JSONB DEFAULT '{}', -- Audio quality, stability, etc.
  
  -- Constraints
  CONSTRAINT live_streams_delay_positive CHECK (delay_seconds >= 0),
  CONSTRAINT live_streams_dvr_window_positive CHECK (dvr_window_sec > 0),
  CONSTRAINT live_streams_viewer_count_positive CHECK (viewer_count >= 0),
  
  -- One stream per channel
  UNIQUE (channel_id),
  
  -- Performance indexes
  INDEX idx_live_streams_status_checked (status, last_checked),
  INDEX idx_live_streams_cleanup (last_checked) WHERE status = 'OFF',
  INDEX idx_live_streams_active_viewers (status, viewer_count DESC) WHERE status = 'LIVE'
);

-- ============================================================================
-- RANKING AND ANALYTICS TABLES  
-- ============================================================================

-- Materialized ranking statistics
CREATE TABLE ranking_stats (
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  -- User engagement metrics
  activation_ctr DECIMAL(5,4) DEFAULT 0.0, -- Enable-dub click-through rate
  avg_watch_time_sec INTEGER DEFAULT 0,
  bounce_rate DECIMAL(4,3) DEFAULT 0.0, -- Users leaving within 30s
  
  -- Technical quality metrics
  ttfmp_ms INTEGER, -- Time to first meaningful phrase (P50)
  ttfmp_p95_ms INTEGER, -- Time to first meaningful phrase (P95)
  dubbing_latency_p50_ms INTEGER, -- Dubbing latency (P50)
  dubbing_latency_p95_ms INTEGER, -- Dubbing latency (P95)
  
  -- Content quality proxies
  mos_proxy DECIMAL(3,2), -- Mean opinion score proxy (1-5)
  speech_ratio DECIMAL(3,2), -- Percentage of content that's speech
  wer_proxy DECIMAL(3,2), -- Word error rate proxy for ASR quality
  content_stability DECIMAL(3,2), -- Stream stability score
  
  -- Sample metadata
  sample_size INTEGER DEFAULT 0,
  last_play_event TIMESTAMPTZ,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT ranking_stats_ctr_range CHECK (activation_ctr BETWEEN 0 AND 1),
  CONSTRAINT ranking_stats_mos_range CHECK (mos_proxy IS NULL OR mos_proxy BETWEEN 1 AND 5),
  CONSTRAINT ranking_stats_ratio_range CHECK (speech_ratio IS NULL OR speech_ratio BETWEEN 0 AND 1),
  CONSTRAINT ranking_stats_sample_positive CHECK (sample_size >= 0),
  
  -- Primary key
  PRIMARY KEY (channel_id),
  
  -- Performance indexes for ranking queries
  INDEX idx_ranking_stats_quality_score (mos_proxy DESC, activation_ctr DESC) WHERE mos_proxy IS NOT NULL,
  INDEX idx_ranking_stats_engagement (avg_watch_time_sec DESC, bounce_rate ASC),
  INDEX idx_ranking_stats_updated (last_updated DESC)
);

-- ============================================================================
-- USER AND SESSION MANAGEMENT
-- ============================================================================

-- Anonymous user sessions (GDPR compliant)
CREATE TABLE user_sessions (
  session_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- User preferences (anonymized)
  preferences JSONB DEFAULT '{"country": null, "topic": null, "autoplay": true}',
  recent_autoplays UUID[] DEFAULT '{}', -- Last 10 autoplay channel IDs
  
  -- Technical context (hashed for privacy)
  extension_version VARCHAR(20),
  user_agent_hash CHAR(32), -- SHA256 hash of user agent
  browser_capabilities JSONB DEFAULT '{}', -- WebGPU support, etc.
  
  -- Session lifecycle
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  
  -- Constraints
  CONSTRAINT user_sessions_preferences_valid CHECK (jsonb_typeof(preferences) = 'object'),
  CONSTRAINT user_sessions_autoplays_limit CHECK (array_length(recent_autoplays, 1) <= 10),
  CONSTRAINT user_sessions_expires_future CHECK (expires_at > created_at),
  
  -- Indexes for cleanup and queries
  INDEX idx_user_sessions_expires_at (expires_at),
  INDEX idx_user_sessions_last_activity (last_activity DESC),
  INDEX idx_user_sessions_extension_version (extension_version) WHERE extension_version IS NOT NULL
);

-- ============================================================================
-- ANALYTICS AND EVENTS
-- ============================================================================

-- Play events with monthly partitioning for performance
CREATE TABLE play_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES user_sessions(session_id) ON DELETE SET NULL,
  channel_id UUID REFERENCES channels(id) ON DELETE SET NULL,
  event_type event_type NOT NULL,
  event_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Event-specific metadata
  metadata JSONB DEFAULT '{}',
  
  -- Performance tracking
  processing_time_ms INTEGER, -- Event processing time
  
  -- Constraints
  CONSTRAINT play_events_metadata_valid CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT play_events_processing_positive CHECK (processing_time_ms IS NULL OR processing_time_ms >= 0),
  
  -- Indexes for analytics queries
  INDEX idx_play_events_timestamp_type (event_timestamp DESC, event_type),
  INDEX idx_play_events_channel_type_time (channel_id, event_type, event_timestamp) WHERE channel_id IS NOT NULL,
  INDEX idx_play_events_session_time (session_id, event_timestamp) WHERE session_id IS NOT NULL,
  INDEX idx_play_events_metadata_gin USING gin (metadata)
) PARTITION BY RANGE (event_timestamp);

-- Create monthly partitions for current and next month
CREATE TABLE play_events_2025_09 PARTITION OF play_events
FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');

CREATE TABLE play_events_2025_10 PARTITION OF play_events
FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');

-- Function to auto-create monthly partitions
CREATE OR REPLACE FUNCTION create_monthly_partition(partition_date DATE) 
RETURNS VOID AS $$
DECLARE
  start_date DATE := date_trunc('month', partition_date);
  end_date DATE := start_date + INTERVAL '1 month';
  partition_name TEXT := 'play_events_' || to_char(start_date, 'YYYY_MM');
BEGIN
  EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF play_events 
                  FOR VALUES FROM (%L) TO (%L)', 
                  partition_name, start_date, end_date);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- CONTENT INGESTION TRACKING
-- ============================================================================

-- Scraping job tracking
CREATE TABLE scraping_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_name VARCHAR(50) NOT NULL, -- '7pm', 'youtube_api'
  job_type VARCHAR(30) NOT NULL, -- 'full_refresh', 'incremental', 'validation'
  target_config JSONB NOT NULL, -- Countries, topics, limits
  
  -- Execution tracking
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'RUNNING',
  
  -- Results tracking
  channels_discovered INTEGER DEFAULT 0,
  channels_added INTEGER DEFAULT 0,
  channels_updated INTEGER DEFAULT 0,
  channels_deactivated INTEGER DEFAULT 0,
  errors_encountered INTEGER DEFAULT 0,
  error_log JSONB DEFAULT '[]',
  
  -- Constraints
  CONSTRAINT scraping_jobs_status_valid CHECK (status IN ('RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED')),
  CONSTRAINT scraping_jobs_counts_positive CHECK (
    channels_discovered >= 0 AND 
    channels_added >= 0 AND 
    channels_updated >= 0 AND
    channels_deactivated >= 0 AND
    errors_encountered >= 0
  ),
  
  -- Indexes
  INDEX idx_scraping_jobs_status_started (status, started_at DESC),
  INDEX idx_scraping_jobs_source_completed (source_name, completed_at DESC) WHERE completed_at IS NOT NULL
);

-- Content quality tracking
CREATE TABLE content_quality_checks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  check_type VARCHAR(30) NOT NULL, -- 'duplicate', 'live_status', 'quality_assessment'
  check_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Check results
  passed BOOLEAN NOT NULL,
  quality_score DECIMAL(3,2), -- 0-1 quality score
  issues_found JSONB DEFAULT '[]',
  auto_resolved BOOLEAN DEFAULT false,
  
  -- Constraints
  CONSTRAINT content_quality_score_range CHECK (quality_score IS NULL OR quality_score BETWEEN 0 AND 1),
  
  -- Indexes
  INDEX idx_content_quality_channel_time (channel_id, check_timestamp DESC),
  INDEX idx_content_quality_type_passed (check_type, passed, check_timestamp),
  INDEX idx_content_quality_failed (passed, check_timestamp) WHERE passed = false
);

-- ============================================================================
-- MATERIALIZED VIEWS FOR PERFORMANCE
-- ============================================================================

-- Home page ranking view (refreshed every 5 minutes)
CREATE MATERIALIZED VIEW mv_home_rankings AS
SELECT 
  c.id,
  c.name,
  c.country,
  c.topic,
  c.source_url,
  c.thumbnail_url,
  c.owner,
  ls.status as live_status,
  ls.viewer_count,
  rs.activation_ctr,
  rs.avg_watch_time_sec,
  rs.mos_proxy,
  rs.ttfmp_ms,
  -- Composite ranking score
  (
    COALESCE(rs.activation_ctr, 0) * 0.3 +
    LEAST(COALESCE(rs.avg_watch_time_sec, 0) / 300.0, 1) * 0.25 + -- Normalize to 5min max
    COALESCE(rs.mos_proxy, 3) / 5.0 * 0.25 +
    LEAST(COALESCE(ls.viewer_count, 0) / 10000.0, 1) * 0.2 -- Normalize to 10k max
  ) as ranking_score
FROM channels c
LEFT JOIN live_streams ls ON c.id = ls.channel_id
LEFT JOIN ranking_stats rs ON c.id = rs.channel_id
WHERE c.active = true
  AND c.verified = true;

-- Indexes on materialized view
CREATE UNIQUE INDEX idx_mv_home_rankings_id ON mv_home_rankings (id);
CREATE INDEX idx_mv_home_rankings_country_topic_score ON mv_home_rankings (country, topic, ranking_score DESC);
CREATE INDEX idx_mv_home_rankings_live_score ON mv_home_rankings (live_status, ranking_score DESC) WHERE live_status = 'LIVE';

-- Auto-refresh materialized view
CREATE OR REPLACE FUNCTION refresh_home_rankings() RETURNS VOID AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_home_rankings;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PERFORMANCE OPTIMIZATION PROCEDURES
-- ============================================================================

-- Cleanup expired sessions (run daily)
CREATE OR REPLACE FUNCTION cleanup_expired_sessions() RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM user_sessions WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Also clean up orphaned events (optional, for performance)
  DELETE FROM play_events 
  WHERE session_id IS NOT NULL 
    AND NOT EXISTS (SELECT 1 FROM user_sessions WHERE session_id = play_events.session_id);
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Update ranking statistics (run every hour)
CREATE OR REPLACE FUNCTION update_ranking_stats() RETURNS VOID AS $$
BEGIN
  -- Calculate ranking metrics from recent events (last 7 days)
  WITH channel_metrics AS (
    SELECT 
      pe.channel_id,
      COUNT(*) as total_events,
      COUNT(*) FILTER (WHERE pe.event_type = 'DUB_ENABLED') as dub_activations,
      COUNT(*) FILTER (WHERE pe.event_type = 'PLAY_START') as play_starts,
      AVG((pe.metadata->>'watchTimeSeconds')::INTEGER) as avg_watch_time,
      AVG((pe.metadata->>'dubbingLatencyMs')::INTEGER) as avg_latency,
      AVG((pe.metadata->>'audioQualityScore')::DECIMAL) as avg_quality
    FROM play_events pe
    WHERE pe.event_timestamp > NOW() - INTERVAL '7 days'
      AND pe.channel_id IS NOT NULL
    GROUP BY pe.channel_id
  )
  INSERT INTO ranking_stats (
    channel_id, activation_ctr, avg_watch_time_sec, 
    dubbing_latency_p50_ms, mos_proxy, sample_size, last_updated
  )
  SELECT 
    cm.channel_id,
    CASE WHEN cm.play_starts > 0 THEN cm.dub_activations::DECIMAL / cm.play_starts ELSE 0 END,
    COALESCE(cm.avg_watch_time, 0)::INTEGER,
    COALESCE(cm.avg_latency, 0)::INTEGER,
    COALESCE(cm.avg_quality, 3.0),
    cm.total_events,
    NOW()
  FROM channel_metrics cm
  ON CONFLICT (channel_id) DO UPDATE SET
    activation_ctr = EXCLUDED.activation_ctr,
    avg_watch_time_sec = EXCLUDED.avg_watch_time_sec,
    dubbing_latency_p50_ms = EXCLUDED.dubbing_latency_p50_ms,
    mos_proxy = EXCLUDED.mos_proxy,
    sample_size = ranking_stats.sample_size + EXCLUDED.sample_size,
    last_updated = EXCLUDED.last_updated;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- MONITORING AND HEALTH CHECKS
-- ============================================================================

-- Database health monitoring
CREATE TABLE health_checks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  check_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  component VARCHAR(50) NOT NULL, -- 'database', 'redis', 'scraping'
  status VARCHAR(20) NOT NULL, -- 'healthy', 'degraded', 'unhealthy'
  metrics JSONB DEFAULT '{}',
  details TEXT,
  
  -- Constraints
  CONSTRAINT health_checks_status_valid CHECK (status IN ('healthy', 'degraded', 'unhealthy')),
  
  -- Indexes
  INDEX idx_health_checks_component_time (component, check_timestamp DESC),
  INDEX idx_health_checks_status_time (status, check_timestamp DESC) WHERE status != 'healthy'
);

-- Query performance monitoring view
CREATE VIEW query_performance AS
SELECT 
  query,
  calls,
  total_time,
  mean_time,
  min_time,
  max_time,
  stddev_time
FROM pg_stat_statements
WHERE calls > 100 -- Only frequently called queries
ORDER BY total_time DESC;

-- ============================================================================
-- DATA RETENTION POLICIES
-- ============================================================================

-- Automatic partition management for play_events
CREATE OR REPLACE FUNCTION manage_event_partitions() RETURNS VOID AS $$
DECLARE
  partition_date DATE;
  partition_name TEXT;
BEGIN
  -- Create next month's partition
  partition_date := date_trunc('month', NOW() + INTERVAL '1 month');
  PERFORM create_monthly_partition(partition_date);
  
  -- Drop partitions older than 90 days
  FOR partition_name IN 
    SELECT schemaname||'.'||tablename 
    FROM pg_tables 
    WHERE tablename LIKE 'play_events_20%' 
      AND tablename < 'play_events_' || to_char(NOW() - INTERVAL '90 days', 'YYYY_MM')
  LOOP
    EXECUTE 'DROP TABLE IF EXISTS ' || partition_name;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- INITIAL DATA SETUP
-- ============================================================================

-- Insert initial health check
INSERT INTO health_checks (component, status, details) 
VALUES ('database', 'healthy', 'Initial setup complete');

-- Sample countries for development
INSERT INTO channels (name, country, topic, source_url, content_fingerprint, verified) VALUES
('BBC News Live', 'UK', 'NEWS', 'https://www.youtube.com/embed/live_stream?channel=UCelk6aHijZq-GJBBB9YpReA', 'bbc_news_uk_01', true),
('CNN Live', 'US', 'NEWS', 'https://www.youtube.com/embed/live_stream?channel=UCoMdktPbSTixAyNGwb-UYkQ', 'cnn_news_us_01', true),
('ESPN SportsCenter', 'US', 'SPORTS', 'https://www.youtube.com/embed/live_stream?channel=UCiWLfSweyRNmLpgEHekhoAg', 'espn_sports_us_01', true);

-- Initialize live stream status for sample channels
INSERT INTO live_streams (channel_id, status, started_at, viewer_count)
SELECT id, 'LIVE', NOW() - INTERVAL '2 hours', (random() * 10000)::INTEGER
FROM channels 
WHERE verified = true;

-- ============================================================================
-- PERFORMANCE MONITORING FUNCTIONS
-- ============================================================================

-- Get database performance summary
CREATE OR REPLACE FUNCTION get_database_health() RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_channels', (SELECT COUNT(*) FROM channels WHERE active = true),
    'live_streams', (SELECT COUNT(*) FROM live_streams WHERE status = 'LIVE'),
    'sessions_active', (SELECT COUNT(*) FROM user_sessions WHERE expires_at > NOW()),
    'events_last_hour', (SELECT COUNT(*) FROM play_events WHERE event_timestamp > NOW() - INTERVAL '1 hour'),
    'avg_query_time_ms', (SELECT COALESCE(AVG(mean_time), 0) FROM query_performance),
    'database_size_mb', (SELECT pg_database_size(current_database()) / (1024*1024)),
    'last_ranking_update', (SELECT MAX(last_updated) FROM ranking_stats)
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SCHEDULED MAINTENANCE (via cron or application scheduler)
-- ============================================================================

-- Daily maintenance tasks
-- SCHEDULE: 0 2 * * * (2 AM daily)
-- 1. cleanup_expired_sessions()
-- 2. manage_event_partitions() 
-- 3. VACUUM ANALYZE ranking_stats
-- 4. REFRESH MATERIALIZED VIEW CONCURRENTLY mv_home_rankings

-- Hourly maintenance tasks  
-- SCHEDULE: 0 * * * * (every hour)
-- 1. update_ranking_stats()
-- 2. REFRESH MATERIALIZED VIEW CONCURRENTLY mv_home_rankings

-- Weekly maintenance tasks
-- SCHEDULE: 0 1 * * 0 (1 AM Sunday)
-- 1. REINDEX INDEX CONCURRENTLY idx_play_events_timestamp_type
-- 2. VACUUM ANALYZE play_events
-- 3. ANALYZE channels

COMMENT ON TABLE channels IS 'Core channel catalog with performance optimizations';
COMMENT ON TABLE live_streams IS 'Live stream status tracking with automatic cleanup';
COMMENT ON TABLE ranking_stats IS 'Materialized ranking data updated hourly';
COMMENT ON TABLE user_sessions IS 'Anonymous sessions with 7-day auto-expiry';
COMMENT ON TABLE play_events IS 'Analytics events partitioned monthly, 90-day retention';
COMMENT ON MATERIALIZED VIEW mv_home_rankings IS 'Pre-calculated rankings for home page performance';