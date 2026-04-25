import { useState } from 'react';
import { Filter, Loader2, ListChecks, AlertOctagon } from 'lucide-react';
import { screenStocks, ScreenerResult } from '../../api/client';

type MarketCap = 'small' | 'mid' | 'large' | 'any';
type GrowthProfile = 'high_growth' | 'stable' | 'turnaround' | 'any';

const MARKET_CAP_OPTIONS: { value: MarketCap; label: string }[] = [
  { value: 'any', label: '不限' },
  { value: 'small', label: '小型股' },
  { value: 'mid', label: '中型股' },
  { value: 'large', label: '大型股' },
];

const GROWTH_OPTIONS: { value: GrowthProfile; label: string }[] = [
  { value: 'any', label: '不限' },
  { value: 'high_growth', label: '高成長' },
  { value: 'stable', label: '穩健' },
  { value: 'turnaround', label: '轉機' },
];

export function StockScreenerPanel() {
  const [industry, setIndustry] = useState('');
  const [region, setRegion] = useState('台股 / 美股');
  const [marketCap, setMarketCap] = useState<MarketCap>('any');
  const [growthProfile, setGrowthProfile] = useState<GrowthProfile>('any');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScreenerResult | null>(null);

  const handleScreen = async () => {
    setError(null);
    setLoading(true);
    setResult(null);
    try {
      const { result: r } = await screenStocks({
        industry: industry.trim() || undefined,
        region,
        market_cap: marketCap,
        growth_profile: growthProfile,
        notes: notes.trim() || undefined,
      });
      setResult(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : '篩選失敗');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-gray-200 mb-3 flex items-center gap-2">
          <Filter className="w-4 h-4 text-emerald-400" />
          研究候選名單框架
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">產業 / 主題</label>
            <input
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="留空 = 廣泛市場"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">市場地區</label>
            <input
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">市值偏好</label>
            <div className="flex gap-1">
              {MARKET_CAP_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  onClick={() => setMarketCap(o.value)}
                  className={`flex-1 px-2 py-1.5 text-xs rounded border transition-colors ${
                    marketCap === o.value
                      ? 'bg-emerald-700 text-white border-emerald-600'
                      : 'bg-gray-800 text-gray-400 border-gray-700 hover:bg-gray-700'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">成長型態</label>
            <div className="flex gap-1">
              {GROWTH_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  onClick={() => setGrowthProfile(o.value)}
                  className={`flex-1 px-2 py-1.5 text-xs rounded border transition-colors ${
                    growthProfile === o.value
                      ? 'bg-emerald-700 text-white border-emerald-600'
                      : 'bg-gray-800 text-gray-400 border-gray-700 hover:bg-gray-700'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-3">
          <label className="block text-xs text-gray-400 mb-1">額外備註（選填）</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="例：偏好現金流為正、避免本益比超過 50 倍..."
            rows={2}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <button
          onClick={handleScreen}
          disabled={loading}
          className="mt-3 w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm font-medium rounded flex items-center justify-center gap-2 transition-colors"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Filter className="w-4 h-4" />}
          產生研究候選名單
        </button>

        {error && (
          <div className="mt-3 px-3 py-2 bg-red-900/20 border border-red-800 rounded text-red-400 text-xs">
            {error}
          </div>
        )}
      </div>

      {result && (
        <div className="space-y-3">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <h3 className="text-xs font-semibold text-gray-400 mb-2">研究方向</h3>
            <p className="text-sm text-gray-300 leading-relaxed">{result.framework_summary}</p>
          </div>

          <div className="space-y-2">
            {result.candidates.map((c, i) => (
              <div key={i} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                <div className="flex items-baseline justify-between mb-1">
                  <h4 className="text-sm font-semibold text-emerald-400">{c.category}</h4>
                  <span className="text-xs text-gray-600">類別 {i + 1}</span>
                </div>
                <p className="text-xs text-gray-400 mb-3">{c.rationale}</p>

                {c.example_companies.length > 0 && (
                  <div className="mb-3">
                    <div className="text-xs text-gray-500 mb-1.5">商業模式範例（非推薦）：</div>
                    <div className="flex flex-wrap gap-1.5">
                      {c.example_companies.map((co, j) => (
                        <span key={j} className="px-2 py-0.5 text-xs text-gray-300 bg-gray-800 border border-gray-700 rounded">
                          {co}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {c.due_diligence_checklist.length > 0 && (
                  <div>
                    <div className="text-xs text-gray-500 mb-1.5 flex items-center gap-1.5">
                      <ListChecks className="w-3 h-3" />
                      盡職調查清單（請自行驗證）：
                    </div>
                    <ul className="space-y-1">
                      {c.due_diligence_checklist.map((item, j) => (
                        <li key={j} className="text-xs text-gray-300 flex gap-2">
                          <span className="text-gray-600">□</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>

          {result.red_flags.length > 0 && (
            <div className="bg-rose-900/10 border border-rose-900 rounded-lg p-4">
              <h4 className="text-xs font-semibold text-rose-400 mb-2 flex items-center gap-1.5">
                <AlertOctagon className="w-3.5 h-3.5" />
                常見警訊（看到這些要特別小心）
              </h4>
              <ul className="space-y-1.5">
                {result.red_flags.map((r, i) => (
                  <li key={i} className="text-xs text-rose-200 flex gap-2">
                    <span className="text-rose-500 flex-shrink-0">⚠</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
