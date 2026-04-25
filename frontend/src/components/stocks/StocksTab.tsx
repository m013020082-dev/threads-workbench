import { useState } from 'react';
import { TrendingUp, Filter, Brain, LineChart, BarChart3, Sparkles } from 'lucide-react';
import clsx from 'clsx';
import { StockDisclaimerBanner } from './StockDisclaimerBanner';
import { IndustryAnalysisPanel } from './IndustryAnalysisPanel';
import { StockScreenerPanel } from './StockScreenerPanel';
import { StockOpinionPanel } from './StockOpinionPanel';
import { BacktestPlanPanel } from './BacktestPlanPanel';
import { TechnicalIndicatorsPanel } from './TechnicalIndicatorsPanel';

type SubTab = 'industry' | 'screener' | 'opinion' | 'backtest' | 'indicators';

const BASIC_TABS: { id: SubTab; label: string; icon: React.ComponentType<{ className?: string }>; color: string }[] = [
  { id: 'industry', label: '產業趨勢', icon: TrendingUp, color: 'bg-indigo-700' },
  { id: 'screener', label: '研究候選名單', icon: Filter, color: 'bg-emerald-700' },
];

const ADVANCED_TABS: { id: SubTab; label: string; icon: React.ComponentType<{ className?: string }>; color: string }[] = [
  { id: 'opinion', label: '個股觀點', icon: Brain, color: 'bg-purple-700' },
  { id: 'backtest', label: '策略回測框架', icon: LineChart, color: 'bg-blue-700' },
  { id: 'indicators', label: '技術指標', icon: BarChart3, color: 'bg-cyan-700' },
];

export function StocksTab() {
  const [subTab, setSubTab] = useState<SubTab>('industry');
  const [advancedMode, setAdvancedMode] = useState(false);

  const activeTabs = advancedMode ? [...BASIC_TABS, ...ADVANCED_TABS] : BASIC_TABS;
  const activeTabConfig = activeTabs.find((t) => t.id === subTab) || BASIC_TABS[0];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-shrink-0 px-4 pt-4">
        <StockDisclaimerBanner />

        <div className="mt-4 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 p-1 bg-gray-800 rounded-lg overflow-x-auto max-w-full">
            {activeTabs.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setSubTab(t.id)}
                  className={clsx(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap flex-shrink-0',
                    subTab === t.id ? `${t.color} text-white` : 'text-gray-400 hover:text-gray-200'
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {t.label}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => {
              const next = !advancedMode;
              setAdvancedMode(next);
              if (!next && (subTab === 'opinion' || subTab === 'backtest' || subTab === 'indicators')) {
                setSubTab('industry');
              }
            }}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border transition-colors whitespace-nowrap flex-shrink-0 ml-auto',
              advancedMode
                ? 'bg-purple-900/40 text-purple-200 border-purple-700 hover:bg-purple-900/60'
                : 'bg-gray-800 text-gray-400 border-gray-700 hover:text-gray-200'
            )}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">進階模式</span>
            {advancedMode ? '開' : '關'}
          </button>
        </div>

        {advancedMode && (
          <div className="mt-3 px-3 py-2 bg-purple-900/10 border border-purple-900 rounded text-xs text-purple-200">
            進階模式提供更深入的分析工具（個股觀點 / 回測框架 / 技術指標）。
            這些功能不改變免責原則 — 仍為研究輔助，<strong>不構成投資建議</strong>。
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-5xl mx-auto">
          {subTab === 'industry' && <IndustryAnalysisPanel />}
          {subTab === 'screener' && <StockScreenerPanel />}
          {subTab === 'opinion' && <StockOpinionPanel />}
          {subTab === 'backtest' && <BacktestPlanPanel />}
          {subTab === 'indicators' && <TechnicalIndicatorsPanel />}
        </div>
      </div>

      {/* Active tab indicator (suppress unused warning) */}
      <div className="hidden">{activeTabConfig.label}</div>
    </div>
  );
}
