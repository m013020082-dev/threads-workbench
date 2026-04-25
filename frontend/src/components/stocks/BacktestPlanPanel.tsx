import { useState } from 'react';
import { LineChart, Loader2, ArrowDownToLine, ArrowUpFromLine, Scale, Target, AlertTriangle, Database } from 'lucide-react';
import { getBacktestPlan, BacktestPlanResult } from '../../api/client';

const PRESET_STRATEGIES = [
  '營收月增率連續 3 個月 > 20% 且本益比 < 歷史 30 分位 → 進場',
  '黃金交叉（MA20 > MA60）+ RSI < 70 → 進場；死亡交叉 → 出場',
  '財報公佈後 EPS 超預期 5% 以上 → 隔日進場，持有 60 天',
  '產業 Capex 年增率轉正 + 庫存月數下降 → 進場',
];

export function BacktestPlanPanel() {
  const [strategy, setStrategy] = useState('');
  const [market, setMarket] = useState('台股 / 美股');
  const [period, setPeriod] = useState('近 10 年');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BacktestPlanResult | null>(null);

  const handleAnalyze = async (preset?: string) => {
    const target = (preset || strategy).trim();
    if (!target) {
      setError('請輸入策略描述');
      return;
    }
    setError(null);
    setLoading(true);
    setResult(null);
    try {
      const { result: r } = await getBacktestPlan({
        strategy: target,
        market,
        period,
      });
      setResult(r);
      if (preset) setStrategy(preset);
    } catch (err) {
      setError(err instanceof Error ? err.message : '失敗');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-blue-900/10 border border-blue-900 rounded-lg p-3 text-xs text-blue-200">
        <strong className="font-semibold">💡 說明：</strong>
        本工具<strong>不執行</strong>實際回測，僅幫你把自然語言策略轉成可程式化的回測計畫。實際回測需要歷史資料 + Python/R 等工具自行執行。
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-gray-200 mb-3 flex items-center gap-2">
          <LineChart className="w-4 h-4 text-blue-400" />
          策略回測框架
        </h2>

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">策略描述</label>
            <textarea
              value={strategy}
              onChange={(e) => setStrategy(e.target.value)}
              placeholder="用自然語言描述你的策略邏輯..."
              rows={3}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">市場</label>
              <input
                value={market}
                onChange={(e) => setMarket(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">回測期間</label>
              <input
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <div className="text-xs text-gray-500 mb-2">範例策略：</div>
            <div className="space-y-1">
              {PRESET_STRATEGIES.map((p) => (
                <button
                  key={p}
                  onClick={() => handleAnalyze(p)}
                  disabled={loading}
                  className="block w-full text-left px-2.5 py-1.5 text-xs text-gray-400 bg-gray-800 hover:bg-gray-700 hover:text-gray-200 disabled:opacity-50 rounded border border-gray-700 transition-colors"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => handleAnalyze()}
            disabled={loading}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm font-medium rounded flex items-center justify-center gap-2 transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LineChart className="w-4 h-4" />}
            產生回測計畫
          </button>
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
            <h4 className="text-xs font-semibold text-blue-400 mb-2">訊號定義</h4>
            <p className="text-sm text-gray-300 leading-relaxed">{result.signal_definition}</p>
            <div className="mt-2 text-xs text-gray-500">
              市場：{result.market} · 期間：{result.period}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
              <h4 className="text-xs font-semibold text-emerald-400 mb-2 flex items-center gap-1.5">
                <ArrowDownToLine className="w-3.5 h-3.5" />
                進場規則
              </h4>
              <ul className="space-y-1">
                {result.entry_rules.map((r, i) => (
                  <li key={i} className="text-xs text-gray-300 flex gap-2">
                    <span className="text-emerald-500 flex-shrink-0">{i + 1}.</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
              <h4 className="text-xs font-semibold text-rose-400 mb-2 flex items-center gap-1.5">
                <ArrowUpFromLine className="w-3.5 h-3.5" />
                出場規則
              </h4>
              <ul className="space-y-1">
                {result.exit_rules.map((r, i) => (
                  <li key={i} className="text-xs text-gray-300 flex gap-2">
                    <span className="text-rose-500 flex-shrink-0">{i + 1}.</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <h4 className="text-xs font-semibold text-amber-400 mb-2 flex items-center gap-1.5">
              <Scale className="w-3.5 h-3.5" />
              部位規模
            </h4>
            <p className="text-sm text-gray-300">{result.position_sizing}</p>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <h4 className="text-xs font-semibold text-sky-400 mb-3 flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5" />
              評估指標
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {result.metrics_to_track.map((m, i) => (
                <div key={i} className="bg-gray-800 rounded p-2 border border-gray-700 flex items-baseline gap-2">
                  <span className="font-mono text-xs text-sky-300 flex-shrink-0">{m.metric}</span>
                  <span className="text-xs text-gray-400">{m.meaning}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-amber-900/10 border border-amber-900 rounded-lg p-4">
            <h4 className="text-xs font-semibold text-amber-400 mb-2 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              常見偏誤與避免方式
            </h4>
            <div className="space-y-2">
              {result.common_biases.map((b, i) => (
                <div key={i} className="text-xs">
                  <div className="font-semibold text-amber-300">{b.bias}</div>
                  <div className="text-amber-100 mt-0.5">{b.mitigation}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <h4 className="text-xs font-semibold text-gray-400 mb-2 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5" />
              資料需求
            </h4>
            <ul className="space-y-1">
              {result.data_requirements.map((d, i) => (
                <li key={i} className="text-xs text-gray-300 flex gap-2">
                  <span className="text-gray-600 flex-shrink-0">▸</span>
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
