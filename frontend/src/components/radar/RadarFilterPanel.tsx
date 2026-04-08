import { useState } from 'react';
import { Search, X, Clock, Users, Plus, TrendingUp } from 'lucide-react';
import clsx from 'clsx';

const TIME_RANGES = [
  { value: '1h', label: '1小時' },
  { value: '6h', label: '6小時' },
  { value: '24h', label: '24小時' },
  { value: '7d', label: '7天' },
] as const;

interface RadarFilterPanelProps {
  onSearch: (params: {
    keywords: string[];
    time_range: '1h' | '6h' | '24h' | '7d';
    min_followers?: number;
    max_followers?: number;
    min_engagement?: number;
  }) => Promise<void>;
  isSearching: boolean;
  activeWorkspaceId: string | null;
}

export function RadarFilterPanel({ onSearch, isSearching, activeWorkspaceId }: RadarFilterPanelProps) {
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState('');
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h' | '7d'>('24h');
  const [minFollowers, setMinFollowers] = useState('');
  const [maxFollowers, setMaxFollowers] = useState('');
  const [minEngagement, setMinEngagement] = useState('');
  const [error, setError] = useState('');

  const addKeyword = () => {
    const trimmed = keywordInput.trim().toLowerCase();
    if (trimmed && !keywords.includes(trimmed)) setKeywords(prev => [...prev, trimmed]);
    setKeywordInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addKeyword(); }
  };

  const handleSearch = async () => {
    if (!activeWorkspaceId) { setError('請先選擇工作區'); return; }
    setError('');
    await onSearch({
      keywords,                // 可以是空陣列
      time_range: timeRange,
      min_followers: minFollowers ? parseInt(minFollowers) : undefined,
      max_followers: maxFollowers ? parseInt(maxFollowers) : undefined,
      min_engagement: minEngagement ? parseInt(minEngagement) : undefined,
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">篩選條件</h2>

        {/* 關鍵字（選填） */}
        <div className="mb-3">
          <label className="flex items-center justify-between mb-1.5">
            <span className="flex items-center gap-1.5 text-xs text-gray-400">
              <Search className="w-3 h-3" /> 關鍵字
            </span>
            <span className="text-xs text-gray-600 italic">選填</span>
          </label>
          <div className="flex gap-1">
            <input
              type="text"
              placeholder="留空則從資料庫搜尋..."
              value={keywordInput}
              onChange={e => setKeywordInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 px-2.5 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded-l text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500"
            />
            <button
              onClick={addKeyword}
              className="px-2.5 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-r border border-gray-700 border-l-0 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {keywords.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {keywords.map(kw => (
                <span key={kw} className="flex items-center gap-1 px-2 py-0.5 bg-indigo-900/50 border border-indigo-700/50 text-indigo-300 rounded-full text-xs">
                  {kw}
                  <button onClick={() => setKeywords(prev => prev.filter(k => k !== kw))} className="text-indigo-400 hover:text-indigo-200">
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-600 mt-1.5">
              不填關鍵字 → 直接從已蒐集的貼文中篩選互追候選人
            </p>
          )}
        </div>

        {/* 時間範圍 */}
        <div className="mb-3">
          <label className="flex items-center gap-1.5 text-xs text-gray-400 mb-1.5">
            <Clock className="w-3 h-3" /> 時間範圍
          </label>
          <div className="grid grid-cols-4 gap-1">
            {TIME_RANGES.map(range => (
              <button
                key={range.value}
                onClick={() => setTimeRange(range.value)}
                className={clsx(
                  'py-1.5 text-xs font-medium rounded transition-colors',
                  timeRange === range.value
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700 border border-gray-700'
                )}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>

        {/* 粉絲數 */}
        <div className="mb-3">
          <label className="flex items-center gap-1.5 text-xs text-gray-400 mb-1.5">
            <Users className="w-3 h-3" /> 粉絲數範圍
          </label>
          <div className="grid grid-cols-2 gap-2">
            <input type="number" placeholder="最小（如 500）" value={minFollowers} onChange={e => setMinFollowers(e.target.value)}
              className="px-2.5 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500 w-full" />
            <input type="number" placeholder="最大（如 50000）" value={maxFollowers} onChange={e => setMaxFollowers(e.target.value)}
              className="px-2.5 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500 w-full" />
          </div>
        </div>

        {/* 最低互動數 */}
        <div className="mb-4">
          <label className="flex items-center gap-1.5 text-xs text-gray-400 mb-1.5">
            <TrendingUp className="w-3 h-3" /> 最低互動數（選填）
          </label>
          <input
            type="number"
            placeholder="例：10（按讚 + 留言）"
            value={minEngagement}
            onChange={e => setMinEngagement(e.target.value)}
            className="w-full px-2.5 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {error && (
          <div className="mb-3 px-3 py-2 bg-red-900/30 border border-red-800 rounded text-red-400 text-xs">{error}</div>
        )}

        <button
          onClick={handleSearch}
          disabled={isSearching || !activeWorkspaceId}
          className={clsx(
            'w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-colors',
            isSearching || !activeWorkspaceId
              ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
              : 'bg-indigo-600 hover:bg-indigo-700 text-white'
          )}
        >
          <Search className="w-4 h-4" />
          {isSearching ? '掃描中...' : keywords.length > 0 ? '關鍵字掃描' : '從資料庫掃描'}
        </button>

        {!activeWorkspaceId && (
          <p className="text-center text-xs text-gray-600 mt-2">請先選擇工作區</p>
        )}
      </div>
    </div>
  );
}
