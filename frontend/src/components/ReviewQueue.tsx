import { useState } from 'react';
import { User, SkipForward, Check, RefreshCw, ChevronDown, ChevronUp, CheckCheck, UserPlus, Play, Loader2, CheckCircle2, XCircle, Send, Trash2, Zap, Heart, ExternalLink } from 'lucide-react';
import clsx from 'clsx';
import { Post, Draft } from '../types';
import { DraftCard } from './DraftCard';
import { ExecutionMode } from '../hooks/useExecution';
import { directReply, FollowedRecord } from '../api/client';
import { SentTrackingSection } from './SentTrackingSection';

interface ReviewQueueProps {
  queue: Post[];
  isLoading: boolean;
  onSkip: (postId: string) => Promise<unknown>;
  onApprove: (draftId: string) => Promise<unknown>;
  onSelectPost: (post: Post, draft: Draft | undefined) => void;
  onApproveAll: () => Promise<unknown>;
  onBatchFollow: (postIds: string[]) => Promise<unknown>;
  onExecute: (postId: string, draftId: string) => Promise<void>;
  onClearQueue: () => Promise<unknown>;
  isSkipping: boolean;
  isApprovingAll: boolean;
  isClearing: boolean;
  sentPosts: Post[];
  sentCount: number;
  refetchSent: () => void;
  followedAccounts: FollowedRecord[];
  followedCount: number;
  refetchFollowed: () => void;
  executionMode: ExecutionMode;
  onModeChange: (mode: ExecutionMode) => void;
  workspaceId: string;
  refetch: () => void;
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return `${diffMins} 分鐘前`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} 小時前`;
  return `${Math.floor(diffHours / 24)} 天前`;
}

interface QueueItemProps {
  post: Post;
  onSkip: (postId: string) => Promise<unknown>;
  onApprove: (draftId: string) => Promise<unknown>;
  onSelect: (post: Post, draft: Draft | undefined) => void;
  onExecute: (postId: string, draftId: string) => Promise<void>;
  onSendSuccess: () => void;
  onFollowSuccess: () => void;
  isSkipping: boolean;
  executionMode: ExecutionMode;
}

type ReplyStatus = 'idle' | 'posting' | 'success' | 'error';

function QueueItem({ post, onSkip, onApprove, onSelect, onExecute, onSendSuccess, onFollowSuccess, isSkipping, executionMode }: QueueItemProps) {
  const [showDrafts, setShowDrafts] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [replyStatus, setReplyStatus] = useState<ReplyStatus>('idle');
  const [replyError, setReplyError] = useState('');
  const [editedText, setEditedText] = useState<string | null>(null);
  const [followStatus, setFollowStatus] = useState<'idle' | 'following' | 'success' | 'error'>('idle');
  const [sentAt, setSentAt] = useState<Date | null>(null);

  const approvedDraft = post.drafts?.find((d) => d.approved);
  const allDrafts = post.drafts || [];
  const truncatedText = post.post_text.length > 100
    ? post.post_text.substring(0, 100) + '...'
    : post.post_text;

  // 當草稿核准後同步 editedText
  const draftText = editedText ?? approvedDraft?.draft_text ?? '';

  const handleSkip = async () => {
    setSkipping(true);
    try { await onSkip(post.id); } finally { setSkipping(false); }
  };

  const handleExecute = async () => {
    if (!approvedDraft?.id) return;
    setExecuting(true);
    try { await onExecute(post.id, approvedDraft.id); } finally { setExecuting(false); }
  };

  const handleApproveAndSend = async (draftId: string, text: string) => {
    await onApprove(draftId);
    setEditedText(text);
    setReplyStatus('posting');
    setReplyError('');
    setShowDrafts(false);
    try {
      const res = await directReply(post.id, draftId, text);
      setReplyStatus(res.success ? 'success' : 'error');
      if (res.success) { setSentAt(new Date()); onSendSuccess(); }
      else setReplyError(res.error || '回覆失敗');
    } catch (err: any) {
      setReplyStatus('error');
      setReplyError(err.message || '回覆失敗');
    }
  };

  const handleSendApproved = async () => {
    if (!approvedDraft?.id) return;
    setReplyStatus('posting');
    setReplyError('');
    try {
      const res = await directReply(post.id, approvedDraft.id, draftText);
      setReplyStatus(res.success ? 'success' : 'error');
      if (res.success) { setSentAt(new Date()); onSendSuccess(); }
      else setReplyError(res.error || '回覆失敗');
    } catch (err: any) {
      setReplyStatus('error');
      setReplyError(err.message || '回覆失敗');
    }
  };

  const handleFollow = async () => {
    setFollowStatus('following');
    try {
      const res = await radarExecuteDirect(post.id, 'follow', post.author_handle);
      setFollowStatus(res.success ? 'success' : 'error');
      if (res.success) onFollowSuccess();
    } catch {
      setFollowStatus('error');
    }
  };

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
      <div className="p-3">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <User className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
            <span className="text-xs font-medium text-gray-300 truncate">{post.author_handle}</span>
          </div>
          <span className="text-xs text-gray-600 flex-shrink-0">{formatTimeAgo(post.posted_at)}</span>
        </div>
        <p className="text-xs text-gray-400 leading-relaxed">{truncatedText}</p>
      </div>

      {/* 已核准草稿 + 可編輯 + 發文按鈕 */}
      {approvedDraft && replyStatus === 'idle' && (
        <div className="px-3 pb-2 space-y-2">
          <textarea
            rows={3}
            value={draftText}
            onChange={e => setEditedText(e.target.value)}
            className="w-full px-2.5 py-2 bg-gray-900 border border-green-800/50 rounded text-xs text-gray-200 leading-relaxed resize-none focus:outline-none focus:border-green-500"
          />
          <button
            onClick={handleSendApproved}
            disabled={!draftText.trim()}
            className="w-full flex items-center justify-center gap-1.5 py-2 bg-green-700 hover:bg-green-600 text-white rounded text-xs font-semibold transition-colors disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            發文
          </button>
        </div>
      )}

      {/* 草稿列表（未核准時展開選擇） */}
      {!approvedDraft && allDrafts.length > 0 && (
        <div className="px-3 pb-2">
          <button
            onClick={() => setShowDrafts(!showDrafts)}
            className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            {showDrafts ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {allDrafts.length} 份草稿，選一份核准並發文
          </button>
          {showDrafts && (
            <div className="mt-2 space-y-2">
              {allDrafts.map((draft, i) => (
                <DraftCard
                  key={draft.id || i}
                  draft={draft}
                  onApprove={async () => {
                    if (!draft.id) return;
                    await handleApproveAndSend(draft.id, draft.draft_text);
                  }}
                  compact={false}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* 回覆狀態 */}
      {replyStatus === 'posting' && (
        <div className="px-3 pb-2 flex items-center gap-2 text-xs text-purple-300">
          <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
          送出中，請稍候...
        </div>
      )}
      {replyStatus === 'success' && (
        <div className="px-3 pb-2 space-y-1.5">
          <div className="flex items-center gap-2 text-xs text-green-400">
            <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
            <span>已成功回覆</span>
            {sentAt && <span className="text-gray-600 ml-auto">{sentAt.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}</span>}
          </div>
          {followStatus === 'idle' && (
            <button
              onClick={handleFollow}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-blue-900/40 hover:bg-blue-800/50 border border-blue-800/50 text-blue-300 rounded text-xs font-medium transition-colors"
            >
              <UserPlus className="w-3.5 h-3.5" />
              追蹤 {post.author_handle}
            </button>
          )}
          {followStatus === 'following' && (
            <div className="flex items-center gap-1.5 text-xs text-blue-300 py-1">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />追蹤中...
            </div>
          )}
          {followStatus === 'success' && (
            <div className="flex items-center gap-1.5 text-xs text-blue-400 py-1">
              <Heart className="w-3.5 h-3.5" />已追蹤 {post.author_handle}
            </div>
          )}
          {followStatus === 'error' && (
            <div className="flex items-center justify-between gap-1.5 text-xs text-red-400 py-1">
              <span>追蹤失敗</span>
              <button onClick={handleFollow} className="underline">重試</button>
            </div>
          )}
        </div>
      )}
      {replyStatus === 'error' && (
        <div className="px-3 pb-2 space-y-1.5">
          <div className="flex items-center gap-2 text-xs text-red-400">
            <XCircle className="w-3.5 h-3.5 flex-shrink-0" />
            {replyError || '回覆失敗'}
          </div>
          <button
            onClick={handleExecute}
            disabled={executing}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-yellow-900/40 hover:bg-yellow-800/40 border border-yellow-800/50 text-yellow-300 rounded text-xs font-medium transition-colors disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5" />
            {executing ? '開啟中...' : '改用瀏覽器視窗重試'}
          </button>
        </div>
      )}

      <div className="px-3 pb-3 flex gap-1.5">
        <button
          onClick={handleSkip}
          disabled={skipping || isSkipping}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-gray-700 hover:bg-red-900/50 text-gray-400 hover:text-red-400 rounded text-xs transition-colors disabled:opacity-50"
        >
          <SkipForward className="w-3.5 h-3.5" />
          略過
        </button>
      </div>
    </div>
  );
}


export function ReviewQueue({
  queue,
  isLoading,
  onSkip,
  onApprove,
  onSelectPost,
  onApproveAll,
  onBatchFollow,
  onExecute,
  onClearQueue,
  isSkipping,
  isApprovingAll,
  isClearing,
  sentPosts,
  sentCount,
  refetchSent,
  followedAccounts,
  followedCount,
  refetchFollowed,
  executionMode,
  onModeChange,
  refetch,
  workspaceId,
}: ReviewQueueProps) {
  const [isFollowing, setIsFollowing] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isSendingAll, setIsSendingAll] = useState(false);
  const [sendAllProgress, setSendAllProgress] = useState<{ done: number; total: number } | null>(null);
  const handleSendSuccess = () => {
    refetch();
    refetchSent();
  };

  const handleFollowSuccess = () => {
    refetchFollowed();
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleApproveAll = async () => {
    await onApproveAll();
  };

  const handleSendAll = async () => {
    const approved = queue.filter(p => p.drafts?.some(d => d.approved));
    if (approved.length === 0) return;
    setIsSendingAll(true);
    setSendAllProgress({ done: 0, total: approved.length });
    for (let i = 0; i < approved.length; i++) {
      const post = approved[i];
      const draft = post.drafts?.find(d => d.approved);
      if (!draft?.id) continue;
      try {
        await directReply(post.id, draft.id, draft.draft_text);
      } catch {}
      setSendAllProgress({ done: i + 1, total: approved.length });
    }
    setIsSendingAll(false);
    setSendAllProgress(null);
    refetch();
    refetchSent();
    setShowSent(true);
  };

  const handleClearQueue = async () => {
    if (!confirm(`確定要刪除佇列中全部 ${queue.length} 篇？`)) return;
    await onClearQueue();
  };

  const handleBatchFollow = async () => {
    const ids = selected.size > 0
      ? Array.from(selected)
      : queue.map(p => p.id);
    if (ids.length === 0) return;
    setIsFollowing(true);
    try {
      await onBatchFollow(ids);
      setSelected(new Set());
    } finally {
      setIsFollowing(false);
    }
  };

  const approvedCount = queue.filter(p => p.drafts?.some(d => d.approved)).length;
  const pendingApproval = queue.filter(p => !p.drafts?.some(d => d.approved)).length;

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          審核佇列
          {queue.length > 0 && (
            <span className="ml-2 px-1.5 py-0.5 bg-indigo-900/50 text-indigo-400 rounded-full text-xs">
              {queue.length}
            </span>
          )}
        </h2>
        <button
          onClick={refetch}
          className="p-1 text-gray-600 hover:text-gray-400 transition-colors"
          title="重新整理佇列"
        >
          <RefreshCw className={clsx('w-3.5 h-3.5', isLoading && 'animate-spin')} />
        </button>
      </div>

      {/* 批次操作按鈕 */}
      {queue.length > 0 && (
        <div className="space-y-1.5 mb-3">
          {pendingApproval > 0 && (
            <button
              onClick={handleApproveAll}
              disabled={isApprovingAll}
              className="w-full flex items-center justify-center gap-1.5 py-2 bg-green-800/60 hover:bg-green-700/60 border border-green-700/50 text-green-300 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              {isApprovingAll ? '核准中...' : `一鍵全部核准（${pendingApproval} 篇）`}
            </button>
          )}
          {approvedCount > 0 && (
            <button
              onClick={handleSendAll}
              disabled={isSendingAll}
              className="w-full flex items-center justify-center gap-1.5 py-2 bg-indigo-700 hover:bg-indigo-600 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
            >
              {isSendingAll ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" />發文中 {sendAllProgress?.done}/{sendAllProgress?.total}...</>
              ) : (
                <><Zap className="w-3.5 h-3.5" />一鍵全部發文（{approvedCount} 篇）</>
              )}
            </button>
          )}
          <div className="flex gap-1.5">
            <button
              onClick={handleBatchFollow}
              disabled={isFollowing}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-blue-900/40 hover:bg-blue-800/40 border border-blue-800/50 text-blue-300 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
            >
              <UserPlus className="w-3.5 h-3.5" />
              {isFollowing ? '標記中...' : `批次追蹤`}
            </button>
            <button
              onClick={handleClearQueue}
              disabled={isClearing}
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-red-900/40 hover:bg-red-800/40 border border-red-800/50 text-red-400 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
              title="刪除全部"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {isClearing ? '刪除中...' : '刪除全部'}
            </button>
          </div>
        </div>
      )}

      {/* Stats row */}
      {queue.length > 0 && (
        <div className="flex gap-2 mb-3 text-xs text-gray-600">
          <span className="text-green-500">{approvedCount} 已核准</span>
          <span>·</span>
          <span>{pendingApproval} 待核准</span>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="bg-gray-800 border border-gray-700 rounded-lg p-3 animate-pulse">
              <div className="h-3 bg-gray-700 rounded w-24 mb-2" />
              <div className="h-3 bg-gray-700 rounded w-full" />
            </div>
          ))}
        </div>
      ) : queue.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center mb-3">
            <Check className="w-5 h-5 text-gray-600" />
          </div>
          <p className="text-gray-500 text-sm">佇列為空</p>
          <p className="text-gray-600 text-xs mt-1">生成並核准草稿以加入佇列</p>
        </div>
      ) : (
        <div className="space-y-3">
          {queue.map((post) => (
            <QueueItem
              key={post.id}
              post={post}
              onSkip={onSkip}
              onApprove={onApprove}
              onSelect={onSelectPost}
              onExecute={onExecute}
              onSendSuccess={handleSendSuccess}
              onFollowSuccess={handleFollowSuccess}
              isSkipping={isSkipping}
              executionMode={executionMode}
            />
          ))}
        </div>
      )}

      {/* 發文追蹤區塊 — 永遠顯示 */}
      <SentTrackingSection
        sentPosts={sentPosts}
        followedAccounts={followedAccounts}
        workspaceId={workspaceId}
        onFollowSuccess={handleFollowSuccess}
        onRefresh={refetchSent}
      />
    </div>
  );
}
