import { useState, useEffect } from 'react';
import { Clock, Trash2, CheckCircle, AlertTriangle } from 'lucide-react';
import { getScheduledPosts, cancelScheduledPost, ScheduledPost } from '../../api/client';

interface Props { workspaceId: string; }

const statusInfo: Record<string, { text: string; color: string }> = {
  pending: { text: '待發布', color: 'bg-yellow-900/40 text-yellow-300 border-yellow-800' },
  published: { text: '已發布', color: 'bg-green-900/40 text-green-300 border-green-800' },
  failed: { text: '失敗', color: 'bg-red-900/40 text-red-300 border-red-800' },
  cancelled: { text: '已取消', color: 'bg-gray-800 text-gray-500 border-gray-700' },
};

export function ScheduledPage({ workspaceId }: Props) {
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const load = () => {
    if (!workspaceId) return;
    setLoading(true);
    getScheduledPosts(workspaceId)
      .then(r => setPosts(r.posts))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [workspaceId]);

  const handleCancel = async (id: string) => {
    if (!confirm('確定取消此排程？')) return;
    setCancellingId(id);
    try {
      await cancelScheduledPost(id);
      load();
    } finally {
      setCancellingId(null);
    }
  };

  const formatTime = (ts: number) => {
    if (!ts) return '—';
    return new Date(ts).toLocaleString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-100">排程發文</h1>
        <p className="text-sm text-gray-500 mt-1">管理所有已排程的貼文，後端每分鐘自動執行到期的排程</p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500 text-sm">載入中...</div>
      ) : posts.length === 0 ? (
        <div className="text-center py-16 text-gray-600">
          <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">尚無排程貼文</p>
          <p className="text-xs mt-1">在「撰寫發文」頁面設定排程時間</p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map(post => {
            const info = statusInfo[post.status] || statusInfo.pending;
            const isPast = post.scheduled_at < Date.now() && post.status === 'pending';

            return (
              <div key={post.id} className="p-4 bg-gray-800 border border-gray-700 rounded-xl">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className={`text-xs px-2 py-0.5 rounded border ${info.color}`}>{info.text}</span>
                      {post.account_name && (
                        <span className="text-xs text-gray-500">@{post.account_name}</span>
                      )}
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Clock className="w-3 h-3" />
                        {formatTime(post.scheduled_at)}
                        {isPast && <span className="text-red-400 ml-1">（已到期）</span>}
                      </div>
                    </div>
                    <p className="text-sm text-gray-200 line-clamp-3 whitespace-pre-line">
                      {post.content}
                    </p>
                    {post.error_message && (
                      <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> {post.error_message}
                      </p>
                    )}
                    {post.threads_post_id && (
                      <p className="text-xs text-blue-400 mt-1 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Post ID: {post.threads_post_id}
                      </p>
                    )}
                  </div>
                  {post.status === 'pending' && (
                    <button
                      onClick={() => handleCancel(post.id)}
                      disabled={cancellingId === post.id}
                      title="取消排程"
                      className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded transition-colors flex-shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
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
