import { useState, useEffect } from 'react';
import { History, CheckCircle, XCircle, ExternalLink } from 'lucide-react';
import { getPostHistory, PostHistoryItem } from '../../api/client';

interface Props { workspaceId: string; }

export function HistoryPage({ workspaceId }: Props) {
  const [history, setHistory] = useState<PostHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) return;
    setLoading(true);
    getPostHistory(workspaceId)
      .then(r => setHistory(r.history))
      .finally(() => setLoading(false));
  }, [workspaceId]);

  const formatTime = (ts: number) => {
    if (!ts) return '—';
    return new Date(ts).toLocaleString('zh-TW');
  };

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-100">發文歷史</h1>
        <p className="text-sm text-gray-500 mt-1">所有透過本系統發布的貼文記錄</p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500 text-sm">載入中...</div>
      ) : history.length === 0 ? (
        <div className="text-center py-16 text-gray-600">
          <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">尚無發文記錄</p>
        </div>
      ) : (
        <div className="space-y-3">
          {history.map(item => (
            <div key={item.id} className="p-4 bg-gray-800 border border-gray-700 rounded-xl">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  {item.status === 'success'
                    ? <CheckCircle className="w-5 h-5 text-green-400" />
                    : <XCircle className="w-5 h-5 text-red-400" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {item.account_name && (
                      <span className="text-xs text-gray-500">@{item.account_name}</span>
                    )}
                    <span className="text-xs text-gray-600">{formatTime(item.published_at)}</span>
                  </div>
                  <p className="text-sm text-gray-200 line-clamp-4 whitespace-pre-line">{item.content}</p>
                  {item.threads_post_id && (
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-xs text-blue-400">Post ID: {item.threads_post_id}</span>
                      <a
                        href={`https://www.threads.net/t/${item.threads_post_id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-400 hover:text-blue-300"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                  {item.error_message && (
                    <p className="text-xs text-red-400 mt-1">{item.error_message}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
