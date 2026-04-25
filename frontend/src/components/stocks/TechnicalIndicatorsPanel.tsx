import { useState } from 'react';
import { BarChart3, Loader2, FileSpreadsheet, Eye } from 'lucide-react';
import { computeTechnicalIndicators, TechnicalIndicatorResult } from '../../api/client';

const SAMPLE_CSV = `date,close
2024-01-02,100.0
2024-01-03,101.2
2024-01-04,99.8
...（請貼上你的歷史價格資料）`;

function fmt(n: number | null, digits = 2): string {
  return n === null ? '—' : n.toFixed(digits);
}

export function TechnicalIndicatorsPanel() {
  const [csv, setCsv] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TechnicalIndicatorResult | null>(null);

  const handleCompute = async () => {
    if (!csv.trim()) {
      setError('請貼上 CSV 資料');
      return;
    }
    setError(null);
    setLoading(true);
    setResult(null);
    try {
      const { result: r } = await computeTechnicalIndicators(csv);
      setResult(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : '計算失敗');
    } finally {
      setLoading(false);
    }
  };

  const tableRows = result
    ? Array.from({ length: Math.min(result.count, 20) }, (_, i) => {
        const idx = result.count - 1 - i;
        return {
          date: result.dates[idx],
          close: result.closes[idx],
          ma5: result.ma.ma5[idx],
          ma20: result.ma.ma20[idx],
          ma60: result.ma.ma60[idx],
          rsi: result.rsi14[idx],
          macd: result.macd.macd_line[idx],
          signal: result.macd.signal_line[idx],
          hist: result.macd.histogram[idx],
        };
      })
    : [];

  return (
    <div className="space-y-4">
      <div className="bg-cyan-900/10 border border-cyan-900 rounded-lg p-3 text-xs text-cyan-200">
        <strong className="font-semibold">📊 本地計算：</strong>
        所有指標皆在後端用純函式計算（MA、RSI、MACD），不呼叫外部 API、不送 AI。
        貼上「日期,收盤」格式的 CSV 即可。資料至少 30 筆，建議 100 筆以上。
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-gray-200 mb-3 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-cyan-400" />
          技術指標計算
        </h2>

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1 flex items-center gap-1.5">
              <FileSpreadsheet className="w-3.5 h-3.5" />
              CSV 資料（日期,收盤）
            </label>
            <textarea
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              placeholder={SAMPLE_CSV}
              rows={8}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-cyan-500 font-mono"
            />
          </div>

          <button
            onClick={handleCompute}
            disabled={loading}
            className="w-full px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm font-medium rounded flex items-center justify-center gap-2 transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
            計算指標
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
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-cyan-400">計算結果</h3>
              <span className="text-xs text-gray-500">
                {result.count} 筆 · {result.date_range.start} ~ {result.date_range.end}
              </span>
            </div>

            <h4 className="text-xs font-semibold text-amber-400 mb-2 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5" />
              當前狀態觀察
            </h4>
            <ul className="space-y-1">
              {result.observations.map((o, i) => (
                <li key={i} className="text-xs text-gray-300 flex gap-2">
                  <span className="text-amber-500 flex-shrink-0">▸</span>
                  <span>{o}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
            <div className="px-4 py-2 border-b border-gray-800 text-xs font-semibold text-gray-400">
              最近 {tableRows.length} 筆指標數值
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-800 text-gray-400">
                  <tr>
                    <th className="px-2 py-1.5 text-left font-medium">日期</th>
                    <th className="px-2 py-1.5 text-right font-medium">收盤</th>
                    <th className="px-2 py-1.5 text-right font-medium">MA5</th>
                    <th className="px-2 py-1.5 text-right font-medium">MA20</th>
                    <th className="px-2 py-1.5 text-right font-medium">MA60</th>
                    <th className="px-2 py-1.5 text-right font-medium">RSI14</th>
                    <th className="px-2 py-1.5 text-right font-medium">MACD</th>
                    <th className="px-2 py-1.5 text-right font-medium">Signal</th>
                    <th className="px-2 py-1.5 text-right font-medium">Hist</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((r, i) => (
                    <tr key={i} className="border-t border-gray-800 text-gray-300 hover:bg-gray-800/50">
                      <td className="px-2 py-1.5 font-mono text-gray-400">{r.date}</td>
                      <td className="px-2 py-1.5 text-right font-mono">{fmt(r.close)}</td>
                      <td className="px-2 py-1.5 text-right font-mono">{fmt(r.ma5)}</td>
                      <td className="px-2 py-1.5 text-right font-mono">{fmt(r.ma20)}</td>
                      <td className="px-2 py-1.5 text-right font-mono">{fmt(r.ma60)}</td>
                      <td className="px-2 py-1.5 text-right font-mono">{fmt(r.rsi, 1)}</td>
                      <td className="px-2 py-1.5 text-right font-mono">{fmt(r.macd, 3)}</td>
                      <td className="px-2 py-1.5 text-right font-mono">{fmt(r.signal, 3)}</td>
                      <td className={`px-2 py-1.5 text-right font-mono ${
                        r.hist === null ? '' : r.hist > 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}>{fmt(r.hist, 3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
