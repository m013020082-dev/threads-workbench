import axios from 'axios';
import { Post, Draft, Workspace, ScheduledJob, SearchParams, RankingResult } from '../types';

const api = axios.create({
  baseURL: '/api',
  timeout: 180000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    }
    const message = error.response?.data?.error || error.message || 'An unexpected error occurred';
    console.error('API Error:', message, error.response?.status);
    return Promise.reject(new Error(message));
  }
);

// Search
export async function searchPosts(params: SearchParams): Promise<{ results: RankingResult[]; total: number }> {
  const response = await api.post<{ results: RankingResult[]; total: number; success: boolean }>('/search', params);
  return response.data;
}

export async function updatePost(postId: string, postText: string): Promise<{ post: Post }> {
  const response = await api.patch<{ post: Post; success: boolean }>(`/posts/${postId}`, { post_text: postText });
  return response.data;
}

// Drafts
export async function generateDrafts(
  postId: string,
  postText: string,
  style: string,
  brandVoice: string,
  workspaceId: string,
  length: string = 'medium',
  emojiEnabled: boolean = false,
  postingLogic: string = '擬人幽默',
  replyNote: string = ''
): Promise<{ drafts: Array<{ draft_text: string; style: string; similarity_score: number; risk_warnings: string[] }>; count: number }> {
  const response = await api.post('/generate-drafts', {
    post_id: postId,
    post_text: postText,
    style,
    brand_voice: brandVoice,
    length,
    emoji_enabled: emojiEnabled,
    workspace_id: workspaceId,
    posting_logic: postingLogic,
    reply_note: replyNote,
  });
  return response.data;
}

export async function approveDraft(draftId: string): Promise<{ draft: Draft }> {
  const response = await api.post<{ draft: Draft; success: boolean }>('/approve-draft', { draft_id: draftId });
  return response.data;
}

export async function getDraftsForPost(postId: string): Promise<{ drafts: Draft[] }> {
  const response = await api.get<{ drafts: Draft[]; success: boolean }>(`/drafts/${postId}`);
  return response.data;
}

// Queue
export async function getQueue(workspaceId: string): Promise<{ queue: Post[]; count: number }> {
  const response = await api.get<{ queue: Post[]; count: number; success: boolean }>('/queue', {
    params: { workspace_id: workspaceId },
  });
  return response.data;
}

export async function addToQueue(postId: string): Promise<{ post: Post }> {
  const response = await api.post<{ post: Post; success: boolean }>('/queue/add', { post_id: postId });
  return response.data;
}

export async function skipPost(postId: string): Promise<{ post: Post }> {
  const response = await api.post<{ post: Post; success: boolean }>(`/queue/skip/${postId}`);
  return response.data;
}

export async function approveAll(workspaceId: string): Promise<{ approved: number }> {
  const response = await api.post<{ approved: number; success: boolean }>('/queue/approve-all', { workspace_id: workspaceId });
  return response.data;
}

export async function clearQueue(workspaceId: string): Promise<{ cleared: number }> {
  const response = await api.post<{ cleared: number; success: boolean }>('/queue/clear', { workspace_id: workspaceId });
  return response.data;
}

export async function getSentPosts(workspaceId: string): Promise<{ sent: Post[]; count: number }> {
  const response = await api.get<{ sent: Post[]; count: number; success: boolean }>(`/queue/sent?workspace_id=${workspaceId}`);
  return response.data;
}

export interface FollowedRecord {
  id: string;
  post_id: string;
  executed_at: string;
  author_handle: string;
  post_url: string;
  post_text: string;
}

export async function getFollowedAccounts(workspaceId: string): Promise<{ followed: FollowedRecord[]; count: number }> {
  const response = await api.get<{ followed: FollowedRecord[]; count: number; success: boolean }>(`/queue/followed?workspace_id=${workspaceId}`);
  return response.data;
}

export async function clearSentPosts(workspaceId: string): Promise<{ cleared: number }> {
  const response = await api.post<{ cleared: number; success: boolean }>('/queue/sent/clear', { workspace_id: workspaceId });
  return response.data;
}

export async function batchFollow(postIds: string[]): Promise<{ updated: number }> {
  const response = await api.post<{ updated: number; success: boolean }>('/queue/batch-follow', { post_ids: postIds });
  return response.data;
}

// Execute (Computer Use)
export interface ExecutionSession {
  status: 'idle' | 'opening' | 'ready' | 'confirmed' | 'cancelled' | 'error';
  postId: string;
  draftId: string | null;
  postUrl: string;
  draftText: string;
  startedAt: string;
  error?: string;
  followLocated?: boolean;
  actionType?: 'follow' | 'comment' | 'both';
  authorHandle?: string;
}

export async function getExecutionStatus(): Promise<{ session: ExecutionSession | null }> {
  const response = await api.get<{ session: ExecutionSession | null; success: boolean }>('/execute/status');
  return response.data;
}

export async function startExecution(postId: string, draftId: string): Promise<{ session: ExecutionSession }> {
  const response = await api.post<{ session: ExecutionSession; success: boolean }>('/execute/start', {
    post_id: postId,
    draft_id: draftId,
  });
  return response.data;
}

export async function confirmExecution(): Promise<{ post_id: string; status: string }> {
  const response = await api.post<{ post_id: string; status: string; success: boolean }>('/execute/confirm');
  return response.data;
}

export async function cancelExecution(): Promise<void> {
  await api.post('/execute/cancel');
}

export async function directReply(postId: string, draftId: string, draftText?: string): Promise<{ success: boolean; error?: string; post_id: string }> {
  const response = await api.post('/execute/reply-direct', { post_id: postId, draft_id: draftId, draft_text: draftText });
  return response.data;
}

// Radar (追互追雷達)
export type RadarActionType = 'follow' | 'comment' | 'both';

export async function startRadarExecution(
  postId: string,
  draftId: string | null,
  actionType: RadarActionType,
  authorHandle: string,
  draftText?: string
): Promise<{ session: ExecutionSession }> {
  const response = await api.post<{ session: ExecutionSession; success: boolean }>('/radar/execute/start', {
    post_id: postId,
    draft_id: draftId,
    action_type: actionType,
    author_handle: authorHandle,
    draft_text: draftText || '',
  });
  return response.data;
}

export async function confirmRadarExecution(): Promise<{ post_id: string; action_type: string }> {
  const response = await api.post<{ post_id: string; action_type: string; success: boolean }>('/radar/execute/confirm');
  return response.data;
}

export async function cancelRadarExecution(): Promise<void> {
  await api.post('/radar/execute/cancel');
}

export async function getRadarExecutionStatus(): Promise<{ session: ExecutionSession | null }> {
  const response = await api.get<{ session: ExecutionSession | null; success: boolean }>('/radar/execute/status');
  return response.data;
}

export async function radarExecuteDirect(
  postId: string,
  actionType: RadarActionType,
  authorHandle: string,
  draftText?: string
): Promise<{ success: boolean; error?: string; post_id: string; action_type: string }> {
  const response = await api.post('/radar/execute-direct', {
    post_id: postId,
    action_type: actionType,
    author_handle: authorHandle,
    draft_text: draftText || '',
  });
  return response.data;
}

// Workspaces
export async function createWorkspace(
  name: string,
  brandVoice: string,
  keywords?: string[]
): Promise<{ workspace: Workspace }> {
  const response = await api.post<{ workspace: Workspace; success: boolean }>('/workspace/create', {
    name,
    brand_voice: brandVoice,
    keywords,
  });
  return response.data;
}

export async function listWorkspaces(): Promise<{ workspaces: Workspace[] }> {
  const response = await api.get<{ workspaces: Workspace[]; success: boolean }>('/workspace/list');
  return response.data;
}

export async function switchWorkspace(id: string): Promise<{
  workspace: Workspace;
  keywords: Array<{ id: string; keyword: string; weight: number }>;
  stats: { total_posts: string; posts_in_queue: string; approved_drafts: string };
}> {
  const response = await api.post('/workspace/switch', { id });
  return response.data;
}

export async function getWorkspaceKeywords(workspaceId: string) {
  const response = await api.get(`/workspace/${workspaceId}/keywords`);
  return response.data;
}

export async function addKeyword(workspaceId: string, keyword: string, weight?: number) {
  const response = await api.post(`/workspace/${workspaceId}/keywords`, { keyword, weight });
  return response.data;
}

export async function removeKeyword(workspaceId: string, keywordId: string) {
  const response = await api.delete(`/workspace/${workspaceId}/keywords/${keywordId}`);
  return response.data;
}

// Scheduler
export async function createScheduledJob(job: {
  workspace_id: string;
  name: string;
  job_type: 'search' | 'score' | 'draft';
  cron_expression: string;
  config?: Record<string, unknown>;
}): Promise<{ job: ScheduledJob }> {
  const response = await api.post<{ job: ScheduledJob; success: boolean }>('/scheduler/create', job);
  return response.data;
}

export async function listScheduledJobs(workspaceId?: string): Promise<{ jobs: ScheduledJob[] }> {
  const response = await api.get<{ jobs: ScheduledJob[]; success: boolean }>('/scheduler/list', {
    params: workspaceId ? { workspace_id: workspaceId } : {},
  });
  return response.data;
}

export async function toggleScheduledJob(jobId: string, enabled: boolean): Promise<{ job: ScheduledJob }> {
  const response = await api.post<{ job: ScheduledJob; success: boolean }>(`/scheduler/toggle/${jobId}`, { enabled });
  return response.data;
}

export async function checkHealth(): Promise<{ status: string }> {
  const response = await api.get<{ status: string }>('/health');
  return response.data;
}

// Auth — Threads 多帳號管理
export interface AccountInfo {
  id: string;
  name: string;
  username: string;
  is_active: boolean;
  created_at: string;
}

export async function getAuthStatus(): Promise<{ logged_in: boolean; active_account: Pick<AccountInfo, 'id' | 'name' | 'username'> | null }> {
  const response = await api.get('/auth/status');
  return response.data;
}

export async function getAccounts(): Promise<{ accounts: AccountInfo[] }> {
  const response = await api.get('/auth/accounts');
  return response.data;
}

export async function addAccount(name: string, cookies: string): Promise<{ success: boolean; account: AccountInfo }> {
  const response = await api.post('/auth/accounts', { name, cookies });
  return response.data;
}

export async function updateAccountCookies(id: string, cookies: string): Promise<{ success: boolean; account: AccountInfo }> {
  const response = await api.patch(`/auth/accounts/${id}`, { cookies });
  return response.data;
}

export async function deleteAccount(id: string): Promise<{ success: boolean }> {
  const response = await api.delete(`/auth/accounts/${id}`);
  return response.data;
}

export async function switchAccount(id: string): Promise<{ success: boolean; account: AccountInfo }> {
  const response = await api.post(`/auth/accounts/${id}/switch`);
  return response.data;
}

export async function logoutThreads(): Promise<{ success: boolean; message: string }> {
  const response = await api.post<{ success: boolean; message: string }>('/auth/logout');
  return response.data;
}

// Legacy compat
export async function saveCookies(cookies: string): Promise<{ success: boolean; message: string }> {
  return { success: false, message: '請使用新的帳號管理功能' };
}

// ═══════════════════════════════════════════
// Auto-Post (Publisher) API
// ═══════════════════════════════════════════

export interface PublisherAccount {
  id: string;
  workspace_id: string;
  threads_user_id: string;
  threads_username: string;
  access_token: string;
  token_expires_at: number;
  profile_picture_url: string;
  is_active: boolean;
  created_at: string;
}

export interface BrandProfile {
  id: string;
  workspace_id: string;
  publisher_account_id?: string;
  profile_mode: 'brand' | 'persona';
  brand_name: string;
  industry: string;
  tone_description: string;
  keywords: string;
  avoid_topics: string;
  target_audience: string;
  writing_directions: string;
  example_post: string;
  posting_notes: string;
  auto_post_mode: 'manual' | 'auto';
  posts_per_day: number;
  agent_enabled: boolean;
  persona_name: string;
  occupation: string;
  personality: string;
  catchphrase: string;
  lifestyle: string;
  personal_background: string;
}

export interface TrendingTopic {
  id: string;
  workspace_id: string;
  source: 'google_trends' | 'ai_generated';
  title: string;
  description: string;
  trend_score: number;
  fetched_at: number;
  created_at: string;
}

export interface AutoDraft {
  id: string;
  workspace_id: string;
  publisher_account_id?: string;
  account_name?: string;
  source_trend: string;
  relevance_score: number;
  angle: string;
  content: string;
  risk_level: 'low' | 'medium' | 'high';
  audit_notes: string;
  status: 'pending_review' | 'approved' | 'rejected' | 'published' | 'auto_published';
  threads_post_id: string;
  published_at: number;
  created_at: string;
}

export interface ScheduledPost {
  id: string;
  workspace_id: string;
  publisher_account_id?: string;
  account_name?: string;
  content: string;
  scheduled_at: number;
  status: 'pending' | 'published' | 'failed' | 'cancelled';
  threads_post_id: string;
  published_at: number;
  error_message: string;
  created_at: string;
}

export interface PostHistoryItem {
  id: string;
  workspace_id: string;
  publisher_account_id?: string;
  account_name?: string;
  content: string;
  threads_post_id: string;
  status: 'success' | 'failed';
  error_message: string;
  published_at: number;
  created_at: string;
}

// Publisher Accounts
export async function getPubAccounts(workspaceId: string): Promise<{ accounts: PublisherAccount[] }> {
  const response = await api.get('/pub/accounts', { params: { workspace_id: workspaceId } });
  return response.data;
}

export async function addPubAccount(workspaceId: string, accessToken: string): Promise<{ account: PublisherAccount }> {
  const response = await api.post('/pub/accounts', { workspace_id: workspaceId, access_token: accessToken });
  return response.data;
}

export async function deletePubAccount(id: string): Promise<{ success: boolean }> {
  const response = await api.delete(`/pub/accounts/${id}`);
  return response.data;
}

export async function refreshPubAccountToken(id: string): Promise<{ account: PublisherAccount }> {
  const response = await api.post(`/pub/accounts/${id}/refresh`);
  return response.data;
}

// Brand Profile
export async function suggestBrandProfile(description: string, profileMode: 'brand' | 'persona'): Promise<{ suggestion: Partial<BrandProfile> }> {
  const response = await api.post('/pub/brand-profile/suggest', { description, profile_mode: profileMode });
  return response.data;
}

export async function getBrandProfile(workspaceId: string): Promise<{ profile: BrandProfile | null }> {
  const response = await api.get('/pub/brand-profile', { params: { workspace_id: workspaceId } });
  return response.data;
}

export async function saveBrandProfile(data: Partial<BrandProfile> & { workspace_id: string }): Promise<{ profile: BrandProfile }> {
  const response = await api.post('/pub/brand-profile', data);
  return response.data;
}

// Trending Topics
export async function getTrendingTopics(workspaceId: string): Promise<{ topics: TrendingTopic[] }> {
  const response = await api.get('/pub/trending', { params: { workspace_id: workspaceId } });
  return response.data;
}

export async function fetchTrendingTopics(workspaceId: string): Promise<{ topics: TrendingTopic[]; count: number }> {
  const response = await api.post('/pub/trending/fetch', { workspace_id: workspaceId });
  return response.data;
}

// Compose & Publish
export async function composeWithAI(workspaceId: string, topic: string): Promise<{ content: string; angle: string; risk_level: string; audit_notes: string }> {
  const response = await api.post('/pub/compose', { workspace_id: workspaceId, topic });
  return response.data;
}

export async function publishPost(workspaceId: string, content: string, draftId?: string): Promise<{ success: boolean }> {
  const response = await api.post('/pub/publish', { workspace_id: workspaceId, content, draft_id: draftId });
  return response.data;
}

export async function scheduleAutoDraft(draftId: string, scheduledAt: number, content?: string): Promise<{ success: boolean; scheduled_at: number }> {
  const response = await api.post(`/pub/drafts/${draftId}/schedule`, { scheduled_at: scheduledAt, content });
  return response.data;
}

export async function schedulePost(workspaceId: string, content: string, scheduledAt: number): Promise<{ post: ScheduledPost }> {
  const response = await api.post('/pub/schedule', { workspace_id: workspaceId, content, scheduled_at: scheduledAt });
  return response.data;
}

// Scheduled Posts
export async function getScheduledPosts(workspaceId: string): Promise<{ posts: ScheduledPost[] }> {
  const response = await api.get('/pub/scheduled', { params: { workspace_id: workspaceId } });
  return response.data;
}

export async function cancelScheduledPost(id: string): Promise<{ success: boolean }> {
  const response = await api.delete(`/pub/scheduled/${id}`);
  return response.data;
}

export async function batchSchedulePosts(params: {
  workspace_id: string;
  start_date: string;
  end_date: string;
  posts_per_day: number;
  hour_start: number;
  hour_end: number;
}): Promise<{ message: string; total: number; success: boolean }> {
  const response = await api.post('/pub/schedule/batch', params);
  return response.data;
}

// Post History
export async function getPostHistory(workspaceId: string): Promise<{ history: PostHistoryItem[] }> {
  const response = await api.get('/pub/history', { params: { workspace_id: workspaceId } });
  return response.data;
}

// AI Drafts
export async function getAutoDrafts(workspaceId: string, status?: string): Promise<{ drafts: AutoDraft[] }> {
  const response = await api.get('/pub/drafts', { params: { workspace_id: workspaceId, status } });
  return response.data;
}

export async function publishAutoDraft(draftId: string, content?: string): Promise<{ threads_post_id: string }> {
  const response = await api.post(`/pub/drafts/${draftId}/publish`, { content });
  return response.data;
}

export async function rejectAutoDraft(draftId: string): Promise<{ success: boolean }> {
  const response = await api.post(`/pub/drafts/${draftId}/reject`);
  return response.data;
}

export async function deleteAllAutoDrafts(workspaceId: string): Promise<{ success: boolean }> {
  const response = await api.delete('/pub/drafts', { params: { workspace_id: workspaceId } });
  return response.data;
}

// Agent
export async function runAgent(workspaceId: string, publisherAccountId?: string): Promise<{ message: string }> {
  const response = await api.post('/pub/agent/run', { workspace_id: workspaceId, publisher_account_id: publisherAccountId });
  return response.data;
}

// Dashboard
export async function getPubDashboard(workspaceId: string): Promise<{
  stats: { account_count: number; scheduled_count: number; recent_post_count: number; pending_draft_count: number; active_account: string | null };
  recent_history: PostHistoryItem[];
  accounts: { id: string; name: string; username: string; is_active: boolean }[];
}> {
  const response = await api.get('/pub/dashboard', { params: { workspace_id: workspaceId } });
  return response.data;
}

export { api };
export default api;
