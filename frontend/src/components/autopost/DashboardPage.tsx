import { useState, useEffect } from 'react';
import { Users, Clock, FileText, CheckCircle, AlertTriangle, TrendingUp, PenSquare } from 'lucide-react';
import { getPubDashboard, PostHistoryItem } from '../../api/client';

interface Props {
  workspaceId: string;
  onNavigate: (page: string) => void;
}

export function DashboardPage({ workspaceId, onNavigate }: Props) {
  const [stats, setStats] = useState<{
    account_count: number;
    scheduled_count: number;
    recent_post_count: number;
    pending_draft_count: number;
    active_account: string | null;
  } | null>(null);
  const [recentHistory, setRecentHistory] = useState<PostHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) return;
    setLoading(true);
    getPubDashboard(workspaceId)
      .then(r => {
        setStats(r.stats);
        setRecentHistory(r.recent_history || []);
      })
      .finally(() => setLoading(false));
  }, [workspaceId]);

  const formatTime = (ts: number) =>
    ts ? new Date(ts).toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

  const hasAccount = (stats?.account_count ?? 0) > 0;

  if (loading) return <div className="p-6 text-center text-gray-500 text-sm">載入中...</div>;

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-100">自動發文總覽</h1>
        <p className="text-sm text-gray-500 mt-1">查看帳號狀態與近期發文活動</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: '已設定帳號', value: stats?.account_count ?? 0, icon: Users, color: 'text-indigo-400', onClick: () => onNavigate('accounts') },
          { label: '待發排程', value: stats?.scheduled_count ?? 0, icon: Clock, color: 'text-yellow-400', onClick: () => onNavigate('scheduled') },
          { label: '待審草稿', value: stats?.pending_draft_count ?? 0, icon: FileText, color: 'text-purple-400', onClick: () => onNavigate('ai-drafts') },
          { label: '帳號狀態', value: hasAccount ? (stats?.active_account || '已設定') : '未設定', icon: hasAccount ? CheckCircle : AlertTriangle, color: hasAccount ? 'text-green-400' : 'text-red-400', onClick: () => onNavigate('accounts') },
        ].map(card => (
          <button
            key={card.label}
            onClick={card.onClick}
            className="p-4 bg-gray-800 border border-gray-700 rounded-xl text-left hover:border-gray-600 transition-colors"
          >
            <card.icon className={`w-5 h-5 ${card.color} mb-2`} />
            <div className={`text-2xl font-bold ${card.color}`}>{card.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{card.label}</div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Posts */}
        <div>
          <h2 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-gray-500" /> 最近發文記錄
          </h2>
          {recentHistory.length === 0 ? (
            <div className="p-4 bg-gray-800 border border-gray-700 rounded-xl text-center text-gray-600 text-sm">
              尚無發文記錄
            </div>
          ) : (
            <div className="space-y-2">
              {recentHistory.map(item => (
                <div key={item.id} className="p-3 bg-gray-800 border border-gray-700 rounded-xl">
                  <div className="flex items-start gap-2">
                    {item.status === 'success'
                      ? <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                      : <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    }
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-200 line-clamp-2">{item.content}</p>
                      <p className="text-xs text-gray-600 mt-1">{formatTime(item.published_at)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={() => onNavigate('history')}
            className="mt-2 text-xs text-indigo-400 hover:text-indigo-300"
          >
            查看全部發文歷史 →
          </button>
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
            <PenSquare className="w-4 h-4 text-gray-500" /> 快速入口
          </h2>
          <div className="space-y-2">
            {[
              { label: '撰寫新貼文', desc: '手動撰寫或 AI 輔助產文', page: 'compose', color: 'border-indigo-800 hover:border-indigo-600' },
              { label: '查看熱門話題', desc: '從 Google Trends 抓取最新話題', page: 'trending', color: 'border-gray-700 hover:border-gray-600' },
              { label: '執行 AI Agent', desc: '自動生成草稿供審核或直接發布', page: 'ai-drafts', color: 'border-purple-800 hover:border-purple-600' },
              { label: '管理帳號', desc: '新增或切換 Threads Cookie 帳號', page: 'accounts', color: 'border-gray-700 hover:border-gray-600' },
            ].map(action => (
              <button
                key={action.page}
                onClick={() => onNavigate(action.page)}
                className={`w-full p-3 bg-gray-800 border ${action.color} rounded-xl text-left transition-colors`}
              >
                <p className="text-sm font-medium text-gray-200">{action.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{action.desc}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
