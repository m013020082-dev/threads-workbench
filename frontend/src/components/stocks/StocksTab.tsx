import { useState } from 'react';
import { TrendingUp, Filter } from 'lucide-react';
import clsx from 'clsx';
import { StockDisclaimerBanner } from './StockDisclaimerBanner';
import { IndustryAnalysisPanel } from './IndustryAnalysisPanel';
import { StockScreenerPanel } from './StockScreenerPanel';

type SubTab = 'industry' | 'screener';

export function StocksTab() {
  const [subTab, setSubTab] = useState<SubTab>('industry');

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-shrink-0 px-4 pt-4">
        <StockDisclaimerBanner />

        <div className="mt-4 flex items-center gap-1 p-1 bg-gray-800 rounded-lg w-fit">
          <button
            onClick={() => setSubTab('industry')}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors',
              subTab === 'industry' ? 'bg-indigo-700 text-white' : 'text-gray-400 hover:text-gray-200'
            )}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            產業趨勢分析
          </button>
          <button
            onClick={() => setSubTab('screener')}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors',
              subTab === 'screener' ? 'bg-emerald-700 text-white' : 'text-gray-400 hover:text-gray-200'
            )}
          >
            <Filter className="w-3.5 h-3.5" />
            研究候選名單
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-5xl mx-auto">
          {subTab === 'industry' && <IndustryAnalysisPanel />}
          {subTab === 'screener' && <StockScreenerPanel />}
        </div>
      </div>
    </div>
  );
}
