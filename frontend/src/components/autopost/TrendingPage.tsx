import { useState, useEffect } from 'react';
import { RefreshCw, TrendingUp, Sparkles, ExternalLink } from 'lucide-react';
import { getTrendingTopics, fetchTrendingTopics, TrendingTopic } from '../../api/client';

interface Props {
  workspaceId: string;
  onUseTopic?: (topic: string) => void;
}

export function TrendingPage({ workspaceId, onUseTopic }: Props) {
  const [topics, setTopics] = useState<TrendingTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState<number | null>(null);

  const loadTopics = () => {
    if (!workspaceId) return;
    setLoading(true);
    getTrendingTopics(workspaceId)
      .then(r => {
        setTopics(r.topics);
        if (r.topics.length > 0) setLastFetchTime(r.topics[0].fetched_at);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadTopics(); }, [workspaceId]);

  const handleFetch = async () => {
    setFetching(true);
    try {
      const r = await fetchTrendingTopics(workspaceId);
      setTopics(r.topics);
      if (r.topics.length > 0) setLastFetchTime(r.topics[0]?.fetched_at || Date.now());
    } catch (e: any) {
      alert(`抓取失敗: ${e.message}`);
    } finally {
      setFetching(false);
    }
  };

  const sourceLabel = (source: string) => {
    if (source === 'google_trends') return { text: 'Google Trends', color: 'bg-blue-900/50 text-blue-300 border-blue-800' };
    return { text: 'AI 生成', color: 'bg-purple-900/50 text-purple-300 border-purple-800' };
  };

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-100">熱門話題</h1>
          <p className="text-sm text-gray-500 mt-1">
            {lastFetchTime
              ? `上次更新：${new Date(lastFetchTime).toLocaleString('zh-TW')}`
              : '從 Google Trends 抓取台灣熱搜話題，用於 AI 產文'}
          </p>
        </div>
        <button
          onClick={handleFetch}
          disabled={fetching}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-sm transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${fetching ? 'animate-spin' : ''}`} />
          {fetching ? '抓取中...' : '刷新話題'}
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500 text-sm">載入中...</div>
      ) : topics.length === 0 ? (
        <div className="text-center py-16 text-gray-600">
          <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">尚無話題資料</p>
          <p className="text-xs mt-1">點擊「刷新話題」從 Google Trends 抓取最新熱搜</p>
        </div>
      ) : (
        <div className="space-y-3">
          {topics.map((topic, idx) => {
            const { text: srcText, color: srcColor } = sourceLabel(topic.source);
            return (
              <div key={topic.id} className="p-4 bg-gray-800 border border-gray-700 rounded-xl hover:border-gray-600 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-gray-700 rounded-lg flex items-center justify-center text-sm font-bold text-gray-400">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-medium text-gray-100">{topic.title}</h3>
                          <span className={`text-xs px-2 py-0.5 rounded border ${srcColor}`}>{srcText}</span>
                          {topic.trend_score > 0 && (
                            <span className="text-xs text-gray-500">熱度 {topic.trend_score}</span>
                          )}
                        </div>
                        {topic.description && (
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{topic.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {onUseTopic && (
                          <button
                            onClick={() => onUseTopic(topic.title)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600/30 hover:bg-indigo-600 border border-indigo-700 hover:border-indigo-500 text-indigo-300 hover:text-white rounded-lg text-xs transition-colors"
                          >
                            <Sparkles className="w-3 h-3" /> 用此話題產文
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
