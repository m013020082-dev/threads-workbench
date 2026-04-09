import { useState, useEffect } from 'react';
import { Heart, MessageSquare, UserPlus, Users, Plus, ExternalLink, Clock, Check } from 'lucide-react';
import clsx from 'clsx';
import { RadarCandidate, RadarAction } from '../../types';

interface Props {
  candidate: RadarCandidate;
  inQueue: boolean;
  commentTemplate: string;
  onAssignAction: (postId: string, action: RadarAction) => void;
  onAddToQueue: (candidate: RadarCandidate, draftText?: string) => void;
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 70 ? 'text-green-400 bg-green-900/40 border-green-800/50'
    : score >= 40 ? 'text-yellow-400 bg-yellow-900/40 border-yellow-800/50'
    : 'text-gray-400 bg-gray-800 border-gray-700';
  return (
    <span className={clsx('px-1.5 py-0.5 rounded border text-xs font-bold', color)}>
      {score}
    </span>
  );
}

const ACTION_BUTTONS: { value: RadarAction; label: string; icon: React.ReactNode }[] = [
  { value: 'follow', label: '追蹤', icon: <UserPlus className="w-3 h-3" /> },
  { value: 'comment', label: '留言', icon: <MessageSquare className="w-3 h-3" /> },
  { value: 'both', label: '兩者', icon: <Plus className="w-3 h-3" /> },
];

function formatPostTime(date: string | Date): string {
  const d = new Date(date);
  const now = Date.now();
  const diffMs = now - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins} 分鐘前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小時前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} 天前`;
  return d.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function RadarCandidateCard({ candidate, inQueue, commentTemplate, onAssignAction, onAddToQueue }: Props) {
  const { post, followScore, keywordMatches, selectedAction } = candidate;
  const truncated = post.post_text.length > 120
    ? post.post_text.substring(0, 120) + '...'
    : post.post_text;

  const profileUrl = `https://www.threads.com/${post.author_handle.startsWith('@') ? post.author_handle : '@' + post.author_handle}`;

  const showComment = selectedAction === 'both' || selectedAction === 'comment';
  const [draftText, setDraftText] = useState(commentTemplate);

  // Sync when template changes externally (user edits settings)
  useEffect(() => {
    setDraftText(commentTemplate);
  }, [commentTemplate]);

  const handleActionClick = (action: RadarAction) => {
    onAssignAction(post.id, action);
    if (inQueue) {
      // 已在佇列中：只更新動作，不重複加入（透過 onAssignAction 已更新 selectedAction）
    } else {
      // 尚未加入：自動加入佇列
      onAddToQueue(
        { ...candidate, selectedAction: action },
        action === 'both' || action === 'comment' ? draftText : undefined
      );
    }
  };

  const handleQuickOpen = () => {
    window.open(profileUrl, '_blank', 'noopener,noreferrer');
    window.open(post.post_url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className={clsx(
      'bg-gray-800 border rounded-lg p-3 transition-all',
      inQueue ? 'border-indigo-600/60 ring-1 ring-indigo-600/30' : 'border-gray-700',
      selectedAction && !inQueue && 'border-indigo-700/50'
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0 text-xs text-gray-400 font-medium">
            {post.author_handle.replace('@', '').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-200 truncate">{post.author_handle}</p>
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Users className="w-2.5 h-2.5" />
              <span>{post.author_followers > 0 ? post.author_followers.toLocaleString() : '—'}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <ScoreBadge score={followScore} />
          <button
            onClick={handleQuickOpen}
            title="快速互追加發文（同時開啟個人頁 + 貼文）"
            className="flex items-center gap-1 px-2 py-0.5 bg-indigo-800/50 hover:bg-indigo-700/60 border border-indigo-700/50 text-indigo-300 rounded text-xs font-medium transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            快速開啟
          </button>
        </div>
      </div>

      {/* Post text */}
      <p className="text-xs text-gray-400 leading-relaxed mb-2">{truncated}</p>

      {/* Comment preview — shown when action involves leaving a comment and not yet in queue */}
      {showComment && !inQueue && (
        <div className="mb-2 rounded-lg border border-green-800/50 bg-green-900/10 overflow-hidden">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-green-800/40">
            <MessageSquare className="w-3 h-3 text-green-500" />
            <span className="text-xs font-medium text-green-400">回文內容</span>
            <span className="ml-auto text-xs text-green-700">{draftText.length} 字</span>
          </div>
          <textarea
            rows={3}
            value={draftText}
            onChange={e => setDraftText(e.target.value)}
            className="w-full px-2.5 py-2 text-xs bg-transparent text-gray-300 resize-none focus:outline-none leading-relaxed placeholder-gray-600"
            placeholder="（留言格式設定尚未填入）"
          />
        </div>
      )}

      {/* Engagement */}
      <div className="flex items-center gap-3 mb-2.5 text-xs text-gray-600">
        <span className="flex items-center gap-1"><Heart className="w-3 h-3" />{post.like_count}</span>
        <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />{post.reply_count}</span>
        <span className="flex items-center gap-1 text-gray-600">
          <Clock className="w-3 h-3" />
          {formatPostTime(post.posted_at)}
        </span>
        {keywordMatches?.length > 0 && (
          <div className="flex gap-1 ml-auto flex-wrap justify-end">
            {keywordMatches.slice(0, 2).map(kw => (
              <span key={kw} className="px-1.5 py-0.5 bg-indigo-900/40 text-indigo-400 rounded text-xs">{kw}</span>
            ))}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-1.5 items-center">
        {ACTION_BUTTONS.map(btn => (
          <button
            key={btn.value}
            onClick={() => handleActionClick(btn.value)}
            className={clsx(
              'flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-xs font-medium transition-colors border',
              selectedAction === btn.value
                ? 'bg-indigo-600 border-indigo-500 text-white'
                : 'bg-gray-700/50 border-gray-600 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
            )}
          >
            {btn.icon}
            {btn.label}
          </button>
        ))}
        {inQueue && (
          <span className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-900/40 border border-indigo-700/40 text-indigo-400 rounded text-xs flex-shrink-0">
            <Check className="w-3 h-3" />
            已加入佇列
          </span>
        )}
      </div>
    </div>
  );
}
