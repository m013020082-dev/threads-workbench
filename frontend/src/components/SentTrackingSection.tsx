import { useState } from 'react';
import { History, ChevronUp, ChevronDown, RefreshCw, CheckCircle2, ExternalLink, Heart, Loader2, UserPlus, X } from 'lucide-react';
import clsx from 'clsx';
import { Post } from '../types';
import { FollowedRecord, radarExecuteDirect, clearSentPosts } from '../api/client';

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

interface Props {
  sentPosts: Post[];
  followedAccounts: FollowedRecord[];
  workspaceId: string;
  onFollowSuccess: () => void;
  onRefresh: () => void;
}

export function SentTrackingSection({ sentPosts, followedAccounts, workspaceId, onFollowSuccess, onRefresh }: Props) {
  const followedHandles = new Set(followedAccounts.map(f => f.author_handle));
  const [followingMap, setFollowingMap] = useState<Record<string, 'idle' | 'following' | 'success' | 'error'>>({});
  const [isClearing, setIsClearing] = useState(false);
  const [showSent, setShowSent] = useState(true);

  const handleClearSent = async () => {
    if (!confirm(`確定要清除全部 ${sentPosts.length} 筆發文記錄？`)) return;
    setIsClearing(true);
    try {
      await clearSentPosts(workspaceId);
      onRefresh();
    } finally {
      setIsClearing(false);
    }
  };

  const handleFollow = async (post: Post) => {
    setFollowingMap(prev => ({ ...prev, [post.id]: 'following' }));
    try {
      const res = await radarExecuteDirect(post.id, 'follow', post.author_handle);
      setFollowingMap(prev => ({ ...prev, [post.id]: res.success ? 'success' : 'error' }));
      if (res.success) onFollowSuccess();
    } catch {
      setFollowingMap(prev => ({ ...prev, [post.id]: 'error' }));
    }
  };

  const followed = sentPosts.filter(p => followedHandles.has(p.author_handle) || followingMap[p.id] === 'success').length;
  const notFollowed = sentPosts.length - followed;

  return (
    <div className="mt-4 border-t border-gray-800 pt-3">
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => setShowSent(!showSent)}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-300 transition-colors font-semibold"
        >
          <History className="w-3.5 h-3.5 text-green-500" />
          發文追蹤
          {sentPosts.length > 0 && (
            <span className="px-1.5 py-0.5 bg-green-900/40 text-green-400 rounded-full text-xs">{sentPosts.length} 篇</span>
          )}
          {notFollowed > 0 && (
            <span className="px-1.5 py-0.5 bg-blue-900/40 text-blue-400 rounded-full text-xs">{notFollowed} 未追蹤</span>
          )}
          {showSent ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
        <div className="flex items-center gap-1">
          {sentPosts.length > 0 && (
            <button
              onClick={handleClearSent}
              disabled={isClearing}
              className="p-1 text-gray-600 hover:text-red-400 transition-colors disabled:opacity-50"
              title="清除全部發文記錄"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => { onRefresh(); setShowSent(true); }}
            className="p-1 text-gray-600 hover:text-green-400 transition-colors"
            title="重新整理發文記錄"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {showSent && sentPosts.length === 0 && (
        <p className="text-xs text-gray-600 py-2 text-center">尚無發文記錄</p>
      )}

      {showSent && sentPosts.length > 0 && (
        <div className="space-y-2 max-h-64 overflow-y-auto pr-0.5">
          {sentPosts.map(post => {
            const sentDraft = post.drafts?.find(d => d.approved);
            const isFollowed = followedHandles.has(post.author_handle) || followingMap[post.id] === 'success';
            const followState = followingMap[post.id] || 'idle';
            const sentTime = (post as any).sent_at
              ? new Date((post as any).sent_at).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
              : formatTimeAgo(post.posted_at);

            return (
              <div key={post.id} className={clsx(
                'rounded-lg border p-2.5 space-y-1.5',
                isFollowed ? 'bg-gray-800/40 border-gray-700/40' : 'bg-gray-800/70 border-blue-900/40'
              )}>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-green-500 flex-shrink-0" />
                  <span className="text-xs font-medium text-gray-300 truncate flex-1">{post.author_handle}</span>
                  <span className="text-xs text-gray-600 flex-shrink-0">{sentTime}</span>
                  {post.post_url && (
                    <a
                      href={post.post_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 text-gray-600 hover:text-indigo-400 transition-colors"
                      title="開啟貼文"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                {sentDraft && (
                  <p className="text-xs text-green-600/80 leading-relaxed line-clamp-2 pl-4">
                    ↳ {sentDraft.draft_text.substring(0, 70)}{sentDraft.draft_text.length > 70 ? '...' : ''}
                  </p>
                )}

                <div className="pl-4">
                  {isFollowed ? (
                    <div className="flex items-center gap-1 text-xs text-blue-400">
                      <Heart className="w-3 h-3" />已追蹤
                    </div>
                  ) : followState === 'following' ? (
                    <div className="flex items-center gap-1 text-xs text-blue-300">
                      <Loader2 className="w-3 h-3 animate-spin" />追蹤中...
                    </div>
                  ) : (
                    <button
                      onClick={() => handleFollow(post)}
                      disabled={followState === 'following'}
                      className={clsx(
                        'flex items-center gap-1 text-xs transition-colors',
                        followState === 'error' ? 'text-red-400 hover:text-red-300' : 'text-blue-400 hover:text-blue-300'
                      )}
                    >
                      <UserPlus className="w-3 h-3" />
                      {followState === 'error' ? '追蹤失敗，重試' : '追蹤作者'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
