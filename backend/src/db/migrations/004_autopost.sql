-- Publisher accounts (Threads official API access tokens)
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

-- Brand / persona profiles
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

-- Trending topics cache
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

-- AI auto-generated drafts for publishing
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

-- Scheduled posts
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

-- Post history
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
