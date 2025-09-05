-- Migration: 001_initial_schema.sql
-- Description: Create core tables and indexes for LiveWorldTV
-- Applied: Phase 4 Sprint 1

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

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

-- Core channels table
CREATE TABLE channels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  country CHAR(2) NOT NULL,
  topic channel_topic NOT NULL,
  source_type channel_source NOT NULL DEFAULT 'YOUTUBE_EMBED',
  source_url TEXT NOT NULL,
  youtube_channel_id VARCHAR(50),
  owner VARCHAR(255),
  description TEXT,
  thumbnail_url TEXT,
  language_code CHAR(3) DEFAULT 'unk',
  first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  active BOOLEAN NOT NULL DEFAULT true,
  verified BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}',
  content_fingerprint CHAR(16) NOT NULL,
  search_vector tsvector,
  
  -- Constraints
  CONSTRAINT channels_country_check CHECK (country ~ '^[A-Z]{2}$'),
  CONSTRAINT channels_url_check CHECK (source_url ~ '^https://'),
  CONSTRAINT channels_name_length CHECK (char_length(name) BETWEEN 3 AND 255),
  
  -- Unique constraints
  UNIQUE (content_fingerprint),
  UNIQUE (source_url)
);

-- Indexes for channels
CREATE INDEX idx_channels_country_topic_active ON channels (country, topic, active, last_seen DESC);
CREATE INDEX idx_channels_active_last_seen ON channels (active, last_seen DESC) WHERE active = true;
CREATE INDEX idx_channels_source_url_hash ON channels USING hash (source_url);
CREATE INDEX idx_channels_youtube_id_hash ON channels USING hash (youtube_channel_id);
CREATE INDEX idx_channels_search_vector ON channels USING gin (search_vector);
CREATE INDEX idx_channels_fingerprint_hash ON channels USING hash (content_fingerprint);

-- Live streams table
CREATE TABLE live_streams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  status stream_status NOT NULL DEFAULT 'UNKNOWN',
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  delay_seconds INTEGER DEFAULT 30,
  dvr_window_sec INTEGER DEFAULT 10800,
  viewer_count INTEGER DEFAULT 0,
  peak_viewer_count INTEGER DEFAULT 0,
  last_checked TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  quality_metrics JSONB DEFAULT '{}',
  
  -- Constraints
  CONSTRAINT live_streams_delay_positive CHECK (delay_seconds >= 0),
  CONSTRAINT live_streams_dvr_window_positive CHECK (dvr_window_sec > 0),
  CONSTRAINT live_streams_viewer_count_positive CHECK (viewer_count >= 0),
  
  -- One stream per channel
  UNIQUE (channel_id)
);

-- Indexes for live_streams
CREATE INDEX idx_live_streams_status_checked ON live_streams (status, last_checked);
CREATE INDEX idx_live_streams_cleanup ON live_streams (last_checked) WHERE status = 'OFF';
CREATE INDEX idx_live_streams_active_viewers ON live_streams (status, viewer_count DESC) WHERE status = 'LIVE';

-- Ranking statistics table
CREATE TABLE ranking_stats (
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  activation_ctr DECIMAL(5,4) DEFAULT 0.0,
  avg_watch_time_sec INTEGER DEFAULT 0,
  bounce_rate DECIMAL(4,3) DEFAULT 0.0,
  ttfmp_ms INTEGER,
  ttfmp_p95_ms INTEGER,
  dubbing_latency_p50_ms INTEGER,
  dubbing_latency_p95_ms INTEGER,
  mos_proxy DECIMAL(3,2),
  speech_ratio DECIMAL(3,2),
  wer_proxy DECIMAL(3,2),
  content_stability DECIMAL(3,2),
  sample_size INTEGER DEFAULT 0,
  last_play_event TIMESTAMPTZ,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT ranking_stats_ctr_range CHECK (activation_ctr BETWEEN 0 AND 1),
  CONSTRAINT ranking_stats_mos_range CHECK (mos_proxy IS NULL OR mos_proxy BETWEEN 1 AND 5),
  CONSTRAINT ranking_stats_ratio_range CHECK (speech_ratio IS NULL OR speech_ratio BETWEEN 0 AND 1),
  CONSTRAINT ranking_stats_sample_positive CHECK (sample_size >= 0),
  
  PRIMARY KEY (channel_id)
);

-- Indexes for ranking_stats
CREATE INDEX idx_ranking_stats_quality_score ON ranking_stats (mos_proxy DESC, activation_ctr DESC) WHERE mos_proxy IS NOT NULL;
CREATE INDEX idx_ranking_stats_engagement ON ranking_stats (avg_watch_time_sec DESC, bounce_rate ASC);
CREATE INDEX idx_ranking_stats_updated ON ranking_stats (last_updated DESC);

-- User sessions table
CREATE TABLE user_sessions (
  session_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  preferences JSONB DEFAULT '{"country": null, "topic": null, "autoplay": true}',
  recent_autoplays UUID[] DEFAULT '{}',
  extension_version VARCHAR(20),
  user_agent_hash CHAR(32),
  browser_capabilities JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  
  -- Constraints
  CONSTRAINT user_sessions_preferences_valid CHECK (jsonb_typeof(preferences) = 'object'),
  CONSTRAINT user_sessions_autoplays_limit CHECK (array_length(recent_autoplays, 1) <= 10),
  CONSTRAINT user_sessions_expires_future CHECK (expires_at > created_at)
);

-- Indexes for user_sessions
CREATE INDEX idx_user_sessions_expires_at ON user_sessions (expires_at);
CREATE INDEX idx_user_sessions_last_activity ON user_sessions (last_activity DESC);
CREATE INDEX idx_user_sessions_extension_version ON user_sessions (extension_version) WHERE extension_version IS NOT NULL;

-- Play events table (partitioned)
CREATE TABLE play_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES user_sessions(session_id) ON DELETE SET NULL,
  channel_id UUID REFERENCES channels(id) ON DELETE SET NULL,
  event_type event_type NOT NULL,
  event_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  processing_time_ms INTEGER,
  
  -- Constraints
  CONSTRAINT play_events_metadata_valid CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT play_events_processing_positive CHECK (processing_time_ms IS NULL OR processing_time_ms >= 0)
) PARTITION BY RANGE (event_timestamp);

-- Create current and next month partitions
CREATE TABLE play_events_2025_09 PARTITION OF play_events
FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');

CREATE TABLE play_events_2025_10 PARTITION OF play_events
FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');

-- Indexes on partitioned table
CREATE INDEX idx_play_events_timestamp_type ON play_events (event_timestamp DESC, event_type);
CREATE INDEX idx_play_events_channel_type_time ON play_events (channel_id, event_type, event_timestamp) WHERE channel_id IS NOT NULL;
CREATE INDEX idx_play_events_session_time ON play_events (session_id, event_timestamp) WHERE session_id IS NOT NULL;
CREATE INDEX idx_play_events_metadata_gin ON play_events USING gin (metadata);

-- Search vector trigger for channels
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

-- Helper functions
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

-- Insert initial health check
CREATE TABLE health_checks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  check_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  component VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL,
  metrics JSONB DEFAULT '{}',
  details TEXT,
  
  CONSTRAINT health_checks_status_valid CHECK (status IN ('healthy', 'degraded', 'unhealthy'))
);

CREATE INDEX idx_health_checks_component_time ON health_checks (component, check_timestamp DESC);
CREATE INDEX idx_health_checks_status_time ON health_checks (status, check_timestamp DESC) WHERE status != 'healthy';

INSERT INTO health_checks (component, status, details) 
VALUES ('database', 'healthy', 'Initial schema setup complete');