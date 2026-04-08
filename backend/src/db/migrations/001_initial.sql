CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  brand_voice TEXT DEFAULT '',
  default_comment_style TEXT DEFAULT 'professional',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS keywords (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  enabled BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  author_handle TEXT NOT NULL,
  author_followers INT DEFAULT 0,
  post_url TEXT NOT NULL,
  post_text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  like_count INT DEFAULT 0,
  comment_count INT DEFAULT 0,
  score FLOAT DEFAULT 0,
  status TEXT DEFAULT 'DISCOVERED'
);

CREATE TABLE IF NOT EXISTS drafts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  style TEXT DEFAULT 'professional',
  text TEXT NOT NULL,
  similarity_score FLOAT DEFAULT 0,
  risk_notes TEXT DEFAULT '',
  approved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS interactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  draft_id UUID REFERENCES drafts(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  action_time TIMESTAMP DEFAULT NOW(),
  result_status TEXT DEFAULT 'pending',
  notes TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS blacklist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS whitelist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS scheduled_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  job_name TEXT NOT NULL,
  job_type TEXT NOT NULL,
  cron_expr TEXT NOT NULL,
  enabled BOOLEAN DEFAULT FALSE,
  max_posts INT DEFAULT 20,
  max_drafts INT DEFAULT 5,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scheduled_job_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES scheduled_jobs(id) ON DELETE CASCADE,
  run_time TIMESTAMP DEFAULT NOW(),
  status TEXT DEFAULT 'running',
  discovered_count INT DEFAULT 0,
  drafted_count INT DEFAULT 0,
  review_required_count INT DEFAULT 0
);
