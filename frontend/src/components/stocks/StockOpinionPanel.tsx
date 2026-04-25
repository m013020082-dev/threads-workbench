import { useState } from 'react';
import { Brain, Loader2, Shield, TrendingUp, TrendingDown, Calculator, Eye } from 'lucide-react';
import clsx from 'clsx';
import { getStockOpinion, StockOpinionResult } from '../../api/client';

const STRENGTH_LABEL: Record<string, { text: string; color: string }> = {
  strong: { text: '強', color: 'bg-emerald-700/30 text-emerald-300 border-emerald-700' },
  medium: { text: '中', color: 'bg-amber-700/30 text-amber-300 border-amber-700' },
  weak: { text: '弱', color: 'bg-rose-700/30 text-rose-300 border-rose-700' },
};

export function StockOpinionPanel() {
  const [company, setCompany] = useState('');
  const [ticker, setTicker] = useState('');
  const [region, setRegion] = useState('台股 / 美股');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<StockOpinionResult | null>(null);

  const handleAnalyze = async () => {
    if (!company.trim()) {
      setError('請輸入公司名稱');
      return;
    }
    setError(null);
    setLoading(true);
    setResult(null);
    try {
      const { result: r } = await getStockOpinion({
        company: company.trim(),
        ticker: ticker.trim() || undefined,
        region,
      });
      setResult(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : '分析失敗');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-purple-900/10 border border-purple-900 rounded-lg p-3 text-xs text-purple-200">
        <strong className="font-semibold">⚠️ 進階模式：</strong>
        以下為 AI 對個股的<strong>主觀分析觀點</strong>，僅供研究參考。AI 不掌握即時財務資料、不具預測能力，內容可能有誤、過時或不完整。請務必自行查證財報與公開資訊後再做決策。
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-gray-200 mb-3 flex items-center gap-2">
          <Brain className="w-4 h-4 text-purple-400" />
          個股分析觀點
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">公司名稱 *</label>
            <input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
              placeholder="例：台積電"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">代碼（選填）</label>
            <input
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              placeholder="例：2330"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">市場</label>
            <input
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200 focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>

        <button
          onClick={handleAnalyze}
          disabled={loading}
          className="mt-3 w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm font-medium rounded flex items-center justify-center gap-2 transition-colors"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
          產生分析觀點
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
            <div className="flex items-baseline justify-between mb-2">
              <h3 className="text-base font-semibold text-purple-400">{result.company}</h3>
              {result.ticker && <span className="text-xs text-gray-500 font-mono">{result.ticker}</span>}
            </div>
            <h4 className="text-xs font-semibold text-gray-400 mb-1">商業模式</h4>
            <p className="text-sm text-gray-300 leading-relaxed">{result.business_model}</p>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <h4 className="text-xs font-semibold text-sky-400 mb-2 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" />
              護城河分析
            </h4>
            <div className="space-y-1.5">
              {result.moat.map((m, i) => {
                const tag = STRENGTH_LABEL[m.strength] || STRENGTH_LABEL.medium;
                return (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className={clsx('px-1.5 py-0.5 rounded border flex-shrink-0', tag.color)}>{tag.text}</span>
                    <span className="text-gray-300 font-medium">{m.factor}</span>
                    <span className="text-gray-500">— {m.note}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-emerald-900/10 border border-emerald-900 rounded-lg p-4">
              <h4 className="text-xs font-semibold text-emerald-400 mb-2 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" />
                看多論述（Bull Case）
              </h4>
              <p className="text-xs text-emerald-100 leading-relaxed">{result.bull_case}</p>
            </div>
            <div className="bg-rose-900/10 border border-rose-900 rounded-lg p-4">
              <h4 className="text-xs font-semibold text-rose-400 mb-2 flex items-center gap-1.5">
                <TrendingDown className="w-3.5 h-3.5" />
                看空論述（Bear Case）
              </h4>
              <p className="text-xs text-rose-100 leading-relaxed">{result.bear_case}</p>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <h4 className="text-xs font-semibold text-amber-400 mb-2 flex items-center gap-1.5">
              <Calculator className="w-3.5 h-3.5" />
              估值方法論（不含具體目標數字）
            </h4>
            <p className="text-sm text-gray-300 leading-relaxed">{result.valuation_framework}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
              <h4 className="text-xs font-semibold text-gray-400 mb-2">財報重點檢視</h4>
              <ul className="space-y-1">
                {result.financial_focus.map((f, i) => (
                  <li key={i} className="text-xs text-gray-300 flex gap-2">
                    <span className="text-gray-600 flex-shrink-0">▸</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
              <h4 className="text-xs font-semibold text-gray-400 mb-2 flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5" />
                追蹤指標
              </h4>
              <ul className="space-y-1">
                {result.watch_indicators.map((w, i) => (
                  <li key={i} className="text-xs text-gray-300 flex gap-2">
                    <span className="text-gray-600 flex-shrink-0">▸</span>
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
