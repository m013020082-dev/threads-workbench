"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runMigrations = runMigrations;
const client_1 = require("./client");
const MIGRATIONS = [
    {
        name: '001_initial',
        sql: `
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
    `,
    },
    {
        name: '002_add_region',
        sql: `
ALTER TABLE posts ADD COLUMN IF NOT EXISTS region TEXT DEFAULT 'TW';
ALTER TABLE posts ADD COLUMN IF NOT EXISTS author_location TEXT DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_posts_region ON posts(region);
    `,
    },
    {
        name: '003_add_accounts',
        sql: `
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  username TEXT DEFAULT '',
  session_data JSONB,
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
    `,
    },
    {
        name: '004_autopost',
        sql: `
CREATE TABLE IF NOT EXISTS publisher_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  threads_user_id TEXT DEFAULT '',
  threads_username TEXT DEFAULT '',
  access_token TEXT NOT NULL,
  token_expires_at BIGINT DEFAULT 0,
  profile_picture_url TEXT DEFAULT '',
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS brand_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  publisher_account_id UUID REFERENCES publisher_accounts(id) ON DELETE SET NULL,
  profile_mode TEXT DEFAULT 'brand',
  brand_name TEXT DEFAULT '',
  industry TEXT DEFAULT '',
  tone_description TEXT DEFAULT '',
  keywords TEXT DEFAULT '',
  avoid_topics TEXT DEFAULT '',
  target_audience TEXT DEFAULT '',
  writing_directions TEXT DEFAULT '',
  example_post TEXT DEFAULT '',
  posting_notes TEXT DEFAULT '',
  auto_post_mode TEXT DEFAULT 'manual',
  posts_per_day INT DEFAULT 1,
  agent_enabled BOOLEAN DEFAULT FALSE,
  persona_name TEXT DEFAULT '',
  occupation TEXT DEFAULT '',
  personality TEXT DEFAULT '',
  catchphrase TEXT DEFAULT '',
  lifestyle TEXT DEFAULT '',
  personal_background TEXT DEFAULT '',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trending_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  source TEXT DEFAULT 'google_trends',
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  related_keywords TEXT DEFAULT '',
  trend_score INT DEFAULT 0,
  region TEXT DEFAULT 'TW',
  fetched_at BIGINT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auto_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  publisher_account_id UUID REFERENCES publisher_accounts(id) ON DELETE SET NULL,
  brand_profile_id UUID REFERENCES brand_profiles(id) ON DELETE SET NULL,
  trend_topic_id UUID REFERENCES trending_topics(id) ON DELETE SET NULL,
  source_trend TEXT DEFAULT '',
  relevance_score INT DEFAULT 0,
  angle TEXT DEFAULT '',
  content TEXT NOT NULL,
  risk_level TEXT DEFAULT 'low',
  audit_notes TEXT DEFAULT '',
  status TEXT DEFAULT 'pending_review',
  threads_post_id TEXT DEFAULT '',
  published_at BIGINT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auto_scheduled_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  publisher_account_id UUID REFERENCES publisher_accounts(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  scheduled_at BIGINT NOT NULL,
  status TEXT DEFAULT 'pending',
  threads_post_id TEXT DEFAULT '',
  published_at BIGINT DEFAULT 0,
  error_message TEXT DEFAULT '',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auto_post_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  publisher_account_id UUID REFERENCES publisher_accounts(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  threads_post_id TEXT DEFAULT '',
  status TEXT DEFAULT 'success',
  error_message TEXT DEFAULT '',
  published_at BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
    `,
    },
    {
        name: '005_users',
        sql: `
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_id TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  name TEXT DEFAULT '',
  picture TEXT DEFAULT '',
  created_at TIMESTAMP DEFAULT NOW(),
  last_login TIMESTAMP DEFAULT NOW()
);

ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_workspaces_user_id ON workspaces(user_id);
    `,
    },
];
async function runMigrations() {
    for (const migration of MIGRATIONS) {
        try {
            await client_1.pool.query(migration.sql);
            console.log(`[DB] Migration ${migration.name} applied`);
        }
        catch (err) {
            console.error(`[DB] Migration ${migration.name} error: ${err.message}`);
            throw err;
        }
    }
}
