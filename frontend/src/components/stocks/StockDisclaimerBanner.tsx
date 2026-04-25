import { AlertTriangle } from 'lucide-react';

export function StockDisclaimerBanner() {
  return (
    <div className="flex items-start gap-2 px-4 py-3 bg-amber-900/20 border border-amber-800 rounded-lg text-amber-200">
      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
      <div className="text-xs leading-relaxed">
        <strong className="font-semibold">免責聲明：</strong>
        本工具產出之內容為公開資訊整理與研究框架，僅供學術與教育參考。
        不構成任何投資建議、股票推薦、買賣訊號或報酬保證。
        所有投資決策請自行評估、自負盈虧，必要時諮詢合格之財務顧問。
      </div>
    </div>
  );
}
