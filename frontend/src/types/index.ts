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
  created_at: string;
  updated_at: string;
}

export interface Keyword {
  id: string;
  workspace_id: string;
  keyword: string;
  weight: number;
  created_at: string;
}

export interface Post {
  id: string;
  workspace_id: string;
  external_id?: string;
  author_handle: string;
  author_followers: number;
  author_location?: string;
  post_text: string;
  post_url: string;
  posted_at: string;
  engagement_count: number;
  like_count: number;
  reply_count: number;
  repost_count: number;
  score?: number;
  status: PostStatus;
  region?: string;
  discovered_at: string;
  updated_at: string;
  drafts?: Draft[];
}

export interface Draft {
  id: string;
  post_id: string;
  workspace_id: string;
  draft_text: string;
  style: string;
  similarity_score: number;
  risk_warnings: string[];
  approved: boolean;
  created_at: string;
  updated_at: string;
}

export interface ScheduledJob {
  id: string;
  workspace_id: string;
  name: string;
  job_type: 'search' | 'score' | 'draft';
  cron_expression: string;
  enabled: boolean;
  config: Record<string, unknown>;
  last_run_at?: string;
  next_run_at?: string;
  created_at: string;
  updated_at: string;
  last_run?: {
    id: string;
    status: 'running' | 'completed' | 'failed';
    started_at: string;
    completed_at?: string;
    error?: string;
  };
}

export interface RankingResult {
  post: Post;
  score: number;
  keyword_matches: string[];
  engagement_score: number;
  follower_score: number;
}

export interface SearchParams {
  workspace_id: string;
  keywords: string[];
  time_range: '1h' | '6h' | '24h' | '7d';
  engagement_threshold?: number;
  min_followers?: number;
  max_followers?: number;
  search_mode?: 'fuzzy' | 'precise';
}

// 追互追雷達
export type RadarAction = 'follow' | 'comment' | 'both';

export interface RadarCandidate {
  post: Post;
  followScore: number;
  keywordMatches: string[];
  selectedAction?: RadarAction;
}

export interface RadarQueueItem {
  candidate: RadarCandidate;
  action: RadarAction;
  draftText?: string;
  draftId?: string;
}

export interface WorkspaceStats {
  total_posts: number;
  posts_in_queue: number;
  approved_drafts: number;
}
