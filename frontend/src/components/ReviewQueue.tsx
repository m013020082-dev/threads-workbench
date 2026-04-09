import { useState } from 'react';
import { User, SkipForward, Check, RefreshCw, ChevronDown, ChevronUp, CheckCheck, UserPlus, Play, Loader2, CheckCircle2, XCircle, Send } from 'lucide-react';
import clsx from 'clsx';
import { Post, Draft } from '../types';
import { DraftCard } from './DraftCard';
import { ExecutionMode } from '../hooks/useExecution';
import { directReply } from '../api/client';

interface ReviewQueueProps {
  queue: Post[];
  isLoading: boolean;
  onSkip: (postId: string) => Promise<unknown>;
  onApprove: (draftId: string) => Promise<unknown>;
  onSelectPost: (post: Post, draft: Draft | undefined) => void;
  onApproveAll: () => Promise<unknown>;
  onBatchFollow: (postIds: string[]) => Promise<unknown>;
  onExecute: (postId: string, draftId: string) => Promise<void>;
  isSkipping: boolean;
  isApprovingAll: boolean;
  executionMode: ExecutionMode;
  onModeChange: (mode: ExecutionMode) => void;
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
  isSkipping: boolean;
  executionMode: ExecutionMode;
}

type ReplyStatus = 'idle' | 'posting' | 'success' | 'error';

function QueueItem({ post, onSkip, onApprove, onSelect, onExecute, isSkipping, executionMode }: QueueItemProps) {
  const [showDrafts, setShowDrafts] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [replyStatus, setReplyStatus] = useState<ReplyStatus>('idle');
  const [replyError, setReplyError] = useState('');

  const approvedDraft = post.drafts?.find((d) => d.approved);
  const allDrafts = post.drafts || [];
  const truncatedText = post.post_text.length > 100
    ? post.post_text.substring(0, 100) + '...'
    : post.post_text;

  const handleSkip = async () => {
    setSkipping(true);
    try { await onSkip(post.id); } finally { setSkipping(false); }
  };

  const handleExecute = async () => {
    if (!approvedDraft?.id) return;
    setExecuting(true);
    try { await onExecute(post.id, approvedDraft.id); } finally { setExecuting(false); }
  };

  const handleApproveAndSend = async (draftId: string) => {
    await onApprove(draftId);
    setReplyStatus('posting');
    setReplyError('');
    setShowDrafts(false);
    try {
      const res = await directReply(post.id, draftId);
      setReplyStatus(res.success ? 'success' : 'error');
      if (!res.success) setReplyError(res.error || '回覆失敗');
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
      const res = await directReply(post.id, approvedDraft.id);
      setReplyStatus(res.success ? 'success' : 'error');
      if (!res.success) setReplyError(res.error || '回覆失敗');
    } catch (err: any) {
      setReplyStatus('error');
      setReplyError(err.message || '回覆失敗');
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

      {/* 已核准草稿 + 發文按鈕 */}
      {approvedDraft && replyStatus === 'idle' && (
        <div className="px-3 pb-2 space-y-2">
          <div className="bg-gray-900 rounded px-2.5 py-2 border border-green-900/40">
            <p className="text-xs text-gray-300 leading-relaxed line-clamp-3">{approvedDraft.draft_text}</p>
          </div>
          <button
            onClick={handleSendApproved}
            className="w-full flex items-center justify-center gap-1.5 py-2 bg-green-700 hover:bg-green-600 text-white rounded text-xs font-semibold transition-colors"
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
                    await handleApproveAndSend(draft.id);
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
        <div className="px-3 pb-2 flex items-center gap-2 text-xs text-green-400">
          <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
          已成功回覆
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
  isSkipping,
  isApprovingAll,
  executionMode,
  onModeChange,
  refetch,
}: ReviewQueueProps) {
  const [isFollowing, setIsFollowing] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

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
    <div className="flex flex-col h-full">
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
          <button
            onClick={handleBatchFollow}
            disabled={isFollowing}
            className="w-full flex items-center justify-center gap-1.5 py-2 bg-blue-900/40 hover:bg-blue-800/40 border border-blue-800/50 text-blue-300 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
          >
            <UserPlus className="w-3.5 h-3.5" />
            {isFollowing ? '標記中...' : `批次標記建議追蹤${selected.size > 0 ? `（${selected.size} 篇）` : ''}`}
          </button>
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
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center mb-3">
            <Check className="w-5 h-5 text-gray-600" />
          </div>
          <p className="text-gray-500 text-sm">佇列為空</p>
          <p className="text-gray-600 text-xs mt-1">生成並核准草稿以加入佇列</p>
        </div>
      ) : (
        <div className="space-y-3 overflow-y-auto flex-1">
          {queue.map((post) => (
            <QueueItem
              key={post.id}
              post={post}
              onSkip={onSkip}
              onApprove={onApprove}
              onSelect={onSelectPost}
              onExecute={onExecute}
              isSkipping={isSkipping}
              executionMode={executionMode}
            />
          ))}
        </div>
      )}
    </div>
  );
}
