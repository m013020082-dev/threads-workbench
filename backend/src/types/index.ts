export enum PostStatus {
  DISCOVERED = 'DISCOVERED',
  SCORED = 'SCORED',
  DRAFTED = 'DRAFTED',
  APPROVED = 'APPROVED',
  READY_FOR_REVIEW = 'READY_FOR_REVIEW',
  POSTED = 'POSTED',
  SKIPPED = 'SKIPPED',
  FOLLOW_SUGGESTED = 'FOLLOW_SUGGESTED',
}

export interface Workspace {
  id: string;
  name: string;
  brand_voice: string;
  default_comment_style: string;
  created_at: Date;
}

export interface Keyword {
  id: string;
  workspace_id: string;
  keyword: string;
  enabled: boolean;
}

export interface Post {
  id: string;
  workspace_id: string;
  author_handle: string;
  author_followers: number;
  author_location: string;
  post_url: string;
  post_text: string;
  created_at: Date;
  like_count: number;
  comment_count: number;
  score: number;
  status: PostStatus;
  region: string;
}

export interface Draft {
  id: string;
  post_id: string;
  style: string;
  text: string;
  similarity_score: number;
  risk_notes: string;
  approved: boolean;
  created_at: Date;
}

export interface Interaction {
  id: string;
  post_id: string;
  draft_id: string | null;
  action_type: string;
  action_time: Date;
  result_status: string;
  notes: string;
}

export interface Blacklist {
  id: string;
  workspace_id: string;
  type: string;
  value: string;
}

export interface Whitelist {
  id: string;
  workspace_id: string;
  type: string;
  value: string;
}

export interface ScheduledJob {
  id: string;
  workspace_id: string;
  name: string;
  job_type: 'search' | 'score' | 'draft';
  cron_expression: string;
  config: Record<string, any> | null;
  enabled: boolean;
  last_run: Date | null;
  created_at: Date;
}

export interface ScheduledJobRun {
  id: string;
  job_id: string;
  run_time: Date;
  status: string;
  discovered_count: number;
  drafted_count: number;
  review_required_count: number;
}

export interface SearchParams {
  workspace_id: string;
  keywords: string[];
  time_range: '1h' | '6h' | '24h' | '7d';
  engagement_threshold: number;
  follower_min: number;
  follower_max: number;
  region?: string;
  search_mode?: 'fuzzy' | 'precise';
}

export interface RankingResult {
  post: Post;
  score: number;
  tags: string[];
}

export interface DraftRequest {
  post_id: string;
  post_text: string;
  style: string;
  brand_voice: string;
  length: 'short' | 'medium' | 'long';
  emoji_enabled: boolean;
  posting_logic?: string;
  reply_note?: string;
}

export interface DraftResult {
  text: string;
  style: string;
  similarity_score: number;
  risk_notes: string;
}

export interface AntiSpamResult {
  similarity_score: number;
  warnings: string[];
  passed: boolean;
}
