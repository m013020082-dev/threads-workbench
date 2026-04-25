import { useState } from 'react';
import { Search, Loader2, TrendingUp, AlertCircle, Eye, Layers } from 'lucide-react';
import { analyzeIndustry, IndustryAnalysisResult } from '../../api/client';

const PRESET_INDUSTRIES = [
  'AI 基礎設施',
  '電力與電網',
  '人形機器人',
  '半導體先進製程',
  'GLP-1 與肥胖藥',
  '小型模組化核反應爐',
  '光通訊 / CPO',
  '國防與再工業化',
];

export function IndustryAnalysisPanel() {
  const [industry, setIndustry] = useState('');
  const [region, setRegion] = useState('台股 / 美股');
  const [horizon, setHorizon] = useState(3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<IndustryAnalysisResult | null>(null);

  const handleAnalyze = async (preset?: string) => {
    const target = (preset || industry).trim();
    if (!target) {
      setError('請輸入產業名稱');
      return;
    }
    setError(null);
    setLoading(true);
    setResult(null);
    try {
      const { result: r } = await analyzeIndustry({
        industry: target,
        region,
        horizon_years: horizon,
      });
      setResult(r);
      if (preset) setIndustry(preset);
    } catch (err) {
      setError(err instanceof Error ? err.message : '分析失敗');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-gray-200 mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-indigo-400" />
          產業趨勢分析
        </h2>

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">產業名稱</label>
            <div className="flex gap-2">
              <input
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                placeholder="例如：AI 基礎設施、人形機器人、GLP-1"
                className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={() => handleAnalyze()}
                disabled={loading}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm font-medium rounded flex items-center gap-2 transition-colors"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                分析
              </button>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs text-gray-400 mb-1">市場地區</label>
              <input
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="w-32">
              <label className="block text-xs text-gray-400 mb-1">觀察年數</label>
              <select
                value={horizon}
                onChange={(e) => setHorizon(Number(e.target.value))}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
              >
                {[1, 2, 3, 5, 7, 10].map((y) => (
                  <option key={y} value={y}>
                    {y} 年
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="text-xs text-gray-500 mb-2">快速範例：</div>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_INDUSTRIES.map((p) => (
                <button
                  key={p}
                  onClick={() => handleAnalyze(p)}
                  disabled={loading}
                  className="px-2.5 py-1 text-xs text-gray-400 bg-gray-800 hover:bg-gray-700 hover:text-gray-200 disabled:opacity-50 rounded border border-gray-700 transition-colors"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-3 px-3 py-2 bg-red-900/20 border border-red-800 rounded text-red-400 text-xs">
            {error}
          </div>
        )}
      </div>

      {result && (
        <div className="space-y-3">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-indigo-400">{result.industry}</h3>
              <div className="text-xs text-gray-500">
                {result.region} · 未來 {result.horizon_years} 年
              </div>
            </div>
            <p className="text-sm text-gray-300 leading-relaxed">{result.thesis}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
              <h4 className="text-xs font-semibold text-emerald-400 mb-2 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" />
                成長驅動因子
              </h4>
              <ul className="space-y-1.5">
                {result.growth_drivers.map((d, i) => (
                  <li key={i} className="text-xs text-gray-300 flex gap-2">
                    <span className="text-emerald-500 flex-shrink-0">▸</span>
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
              <h4 className="text-xs font-semibold text-rose-400 mb-2 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" />
                關鍵風險
              </h4>
              <ul className="space-y-1.5">
                {result.key_risks.map((r, i) => (
                  <li key={i} className="text-xs text-gray-300 flex gap-2">
                    <span className="text-rose-500 flex-shrink-0">▸</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <h4 className="text-xs font-semibold text-sky-400 mb-3 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" />
              產業價值鏈
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {result.value_chain.map((v, i) => (
                <div key={i} className="bg-gray-800 rounded p-3 border border-gray-700">
                  <div className="text-xs font-semibold text-sky-300 mb-1">{v.stage}</div>
                  <div className="text-xs text-gray-400">{v.description}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <h4 className="text-xs font-semibold text-amber-400 mb-3 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5" />
              監控指標（用來觀察產業狀態，不是買賣訊號）
            </h4>
            <div className="space-y-2">
              {result.monitoring_indicators.map((m, i) => (
                <div key={i} className="flex gap-3 text-xs">
                  <div className="font-mono text-amber-300 flex-shrink-0 w-40">{m.indicator}</div>
                  <div className="text-gray-400">{m.meaning}</div>
                </div>
              ))}
            </div>
          </div>

          {result.example_themes.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
              <h4 className="text-xs font-semibold text-gray-400 mb-2">可進一步研究的子題</h4>
              <div className="flex flex-wrap gap-1.5">
                {result.example_themes.map((t, i) => (
                  <span key={i} className="px-2 py-1 text-xs text-gray-300 bg-gray-800 border border-gray-700 rounded">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
