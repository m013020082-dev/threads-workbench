import { useState } from 'react';
import { Search, X, Clock, Users, TrendingUp, Plus, MapPin, MessageSquare, Crosshair, Waves } from 'lucide-react';
import clsx from 'clsx';

const REPLY_LOGICS = [
  { value: '擬人幽默', desc: '用空白鍵代替標點符號/擬人回答' },
  { value: '專業分析', desc: '提供見解與數據' },
  { value: '好奇提問', desc: '問題引發討論' },
  { value: '情感共鳴', desc: '溫暖同理的回應' },
  { value: '簡短有力', desc: '一句話直接到位' },
];

interface SearchPanelProps {
  onSearch: (params: {
    keywords: string[];
    time_range: '1h' | '6h' | '24h' | '7d';
    engagement_threshold?: number;
    min_followers?: number;
    max_followers?: number;
    search_mode?: 'fuzzy' | 'precise';
  }) => Promise<void>;
  isSearching: boolean;
  activeWorkspaceId: string | null;
  initialKeywords?: string[];
  postingLogic: string;
  onPostingLogicChange: (logic: string) => void;
  replyNote: string;
  onReplyNoteChange: (note: string) => void;
}

const TIME_RANGES = [
  { value: '1h', label: '1小時' },
  { value: '6h', label: '6小時' },
  { value: '24h', label: '24小時' },
  { value: '7d', label: '7天' },
] as const;

export function SearchPanel({ onSearch, isSearching, activeWorkspaceId, initialKeywords = [], postingLogic, onPostingLogicChange, replyNote, onReplyNoteChange }: SearchPanelProps) {
  const [keywords, setKeywords] = useState<string[]>(initialKeywords);
  const [keywordInput, setKeywordInput] = useState('');
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h' | '7d'>('24h');
  const [engagementThreshold, setEngagementThreshold] = useState(0);
  const [minFollowers, setMinFollowers] = useState('');
  const [maxFollowers, setMaxFollowers] = useState('');
  const [searchMode, setSearchMode] = useState<'fuzzy' | 'precise'>('fuzzy');
  const [error, setError] = useState('');

  const addKeyword = () => {
    const trimmed = keywordInput.trim().toLowerCase();
    if (trimmed && !keywords.includes(trimmed)) {
      setKeywords((prev) => [...prev, trimmed]);
    }
    setKeywordInput('');
  };

  const removeKeyword = (kw: string) => {
    setKeywords((prev) => prev.filter((k) => k !== kw));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addKeyword();
    }
  };

  const handleSearch = async () => {
    if (!activeWorkspaceId) {
      setError('請先選擇或建立工作區');
      return;
    }
    if (keywords.length === 0) {
      setError('請至少新增一個關鍵字');
      return;
    }
    setError('');
    await onSearch({
      keywords,
      time_range: timeRange,
      engagement_threshold: engagementThreshold > 0 ? engagementThreshold : undefined,
      min_followers: minFollowers ? parseInt(minFollowers) : undefined,
      max_followers: maxFollowers ? parseInt(maxFollowers) : undefined,
      search_mode: searchMode,
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">搜尋與篩選</h2>
          <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-900/40 border border-blue-700/50 text-blue-300 rounded-full text-xs">
            <MapPin className="w-2.5 h-2.5" />
            台灣地區
          </span>
        </div>

        {/* 關鍵字輸入 */}
        <div className="mb-3">
          <label className="flex items-center gap-1.5 text-xs text-gray-400 mb-1.5">
            <Search className="w-3 h-3" />
            關鍵字
          </label>
          <div className="flex gap-1">
            <input
              type="text"
              placeholder="新增關鍵字..."
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
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

          {keywords.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {keywords.map((kw) => (
                <span
                  key={kw}
                  className="flex items-center gap-1 px-2 py-0.5 bg-indigo-900/50 border border-indigo-700/50 text-indigo-300 rounded-full text-xs"
                >
                  {kw}
                  <button
                    onClick={() => removeKeyword(kw)}
                    className="text-indigo-400 hover:text-indigo-200 transition-colors"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 搜尋模式 */}
        <div className="mb-3">
          <label className="flex items-center gap-1.5 text-xs text-gray-400 mb-1.5">
            <Search className="w-3 h-3" />
            搜尋模式
          </label>
          <div className="grid grid-cols-2 gap-1">
            <button
              onClick={() => setSearchMode('fuzzy')}
              className={clsx(
                'flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded transition-colors border',
                searchMode === 'fuzzy'
                  ? 'bg-indigo-600 border-indigo-500 text-white'
                  : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'
              )}
            >
              <Waves className="w-3 h-3" />
              模糊
            </button>
            <button
              onClick={() => setSearchMode('precise')}
              className={clsx(
                'flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded transition-colors border',
                searchMode === 'precise'
                  ? 'bg-indigo-600 border-indigo-500 text-white'
                  : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'
              )}
            >
              <Crosshair className="w-3 h-3" />
              精準
            </button>
          </div>
          <p className="text-xs text-gray-600 mt-1">
            {searchMode === 'fuzzy'
              ? '模糊：AI 擴展同義詞、相關話題'
              : '精準：只找包含關鍵字的貼文'}
          </p>
        </div>

        {/* 時間範圍 */}
        <div className="mb-3">
          <label className="flex items-center gap-1.5 text-xs text-gray-400 mb-1.5">
            <Clock className="w-3 h-3" />
            時間範圍
          </label>
          <div className="grid grid-cols-4 gap-1">
            {TIME_RANGES.map((range) => (
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

        {/* 最低互動數 */}
        <div className="mb-3">
          <label className="flex items-center gap-1.5 text-xs text-gray-400 mb-1.5">
            <TrendingUp className="w-3 h-3" />
            最低互動數：<span className="text-gray-300 ml-1">{engagementThreshold}</span>
          </label>
          <input
            type="range"
            min={0}
            max={500}
            step={10}
            value={engagementThreshold}
            onChange={(e) => setEngagementThreshold(parseInt(e.target.value))}
            className="w-full accent-indigo-500"
          />
          <div className="flex justify-between text-xs text-gray-600 mt-0.5">
            <span>0</span>
            <span>500+</span>
          </div>
        </div>

        {/* 粉絲數範圍 */}
        <div className="mb-4">
          <label className="flex items-center gap-1.5 text-xs text-gray-400 mb-1.5">
            <Users className="w-3 h-3" />
            粉絲數範圍
          </label>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              placeholder="最小（如 1000）"
              value={minFollowers}
              onChange={(e) => setMinFollowers(e.target.value)}
              className="px-2.5 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500 w-full"
            />
            <input
              type="number"
              placeholder="最大（如 50000）"
              value={maxFollowers}
              onChange={(e) => setMaxFollowers(e.target.value)}
              className="px-2.5 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500 w-full"
            />
          </div>
        </div>

        {/* 發文邏輯 */}
        <div className="mb-4">
          <label className="flex items-center gap-1.5 text-xs text-gray-400 mb-1.5">
            <MessageSquare className="w-3 h-3" />
            回文邏輯
          </label>
          <div className="space-y-1">
            {REPLY_LOGICS.map((logic) => (
              <button
                key={logic.value}
                onClick={() => onPostingLogicChange(logic.value)}
                className={clsx(
                  'w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs transition-colors text-left',
                  postingLogic === logic.value
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700 border border-gray-700'
                )}
              >
                <span className="font-medium">{logic.value}</span>
                <span className={clsx('text-xs', postingLogic === logic.value ? 'text-indigo-200' : 'text-gray-600')}>
                  {logic.desc}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* 回文備註 */}
        <div className="mb-4">
          <label className="flex items-center gap-1.5 text-xs text-gray-400 mb-1.5">
            <MessageSquare className="w-3 h-3" />
            回文備註
          </label>
          <textarea
            value={replyNote}
            onChange={(e) => onReplyNoteChange(e.target.value)}
            placeholder="額外指示，例如：請帶入品牌名稱「OO」、結尾要問問題、不要提競品..."
            rows={3}
            className="w-full px-2.5 py-2 text-xs bg-gray-800 border border-gray-700 rounded text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500 resize-none leading-relaxed"
          />
        </div>

        {error && (
          <div className="mb-3 px-3 py-2 bg-red-900/30 border border-red-800 rounded text-red-400 text-xs">
            {error}
          </div>
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
          {isSearching ? '搜尋中...' : '搜尋並排名'}
        </button>

        {!activeWorkspaceId && (
          <p className="text-center text-xs text-gray-600 mt-2">請先選擇工作區</p>
        )}
      </div>
    </div>
  );
}
