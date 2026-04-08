import { useState } from 'react';
import { Check, RefreshCw, AlertTriangle, Copy } from 'lucide-react';
import clsx from 'clsx';
import { Draft } from '../types';

interface DraftCardProps {
  draft: Draft | {
    id?: string;
    draft_text: string;
    style: string;
    similarity_score: number;
    risk_warnings: string[];
    approved: boolean;
  };
  onApprove: () => Promise<void>;
  onRegenerate?: () => void;
  isRegenerating?: boolean;
  compact?: boolean;
}

function getStyleColor(style: string): string {
  switch (style) {
    case 'professional': return 'bg-blue-900/40 text-blue-300 border-blue-800/50';
    case 'casual': return 'bg-green-900/40 text-green-300 border-green-800/50';
    case 'witty': return 'bg-yellow-900/40 text-yellow-300 border-yellow-800/50';
    case 'empathetic': return 'bg-pink-900/40 text-pink-300 border-pink-800/50';
    case 'educational': return 'bg-purple-900/40 text-purple-300 border-purple-800/50';
    default: return 'bg-gray-800 text-gray-400';
  }
}

function getSimilarityColor(score: number): string {
  if (score < 0.3) return 'text-green-400';
  if (score < 0.6) return 'text-yellow-400';
  return 'text-red-400';
}

export function DraftCard({ draft, onApprove, onRegenerate, isRegenerating, compact = false }: DraftCardProps) {
  const [isApproving, setIsApproving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [approved, setApproved] = useState(draft.approved || false);

  const handleApprove = async () => {
    if (approved) return;
    setIsApproving(true);
    try {
      await onApprove();
      setApproved(true);
    } catch (err) {
      console.error('Failed to approve draft:', err);
    } finally {
      setIsApproving(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(draft.draft_text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const hasWarnings = draft.risk_warnings && draft.risk_warnings.length > 0;

  return (
    <div
      className={clsx(
        'rounded-lg border transition-colors',
        approved
          ? 'bg-green-900/10 border-green-800/50'
          : 'bg-gray-900 border-gray-700'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <span className={clsx('text-xs px-2 py-0.5 rounded border', getStyleColor(draft.style))}>
            {draft.style}
          </span>
          <span className={clsx('text-xs', getSimilarityColor(draft.similarity_score))}>
            sim: {(draft.similarity_score * 100).toFixed(0)}%
          </span>
          {approved && (
            <span className="flex items-center gap-1 text-xs text-green-400">
              <Check className="w-3 h-3" /> 已核准
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
            title="複製草稿"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          {onRegenerate && !compact && (
            <button
              onClick={onRegenerate}
              disabled={isRegenerating}
              className="p-1 text-gray-500 hover:text-indigo-400 transition-colors disabled:opacity-50"
              title="重新生成所有草稿"
            >
              <RefreshCw className={clsx('w-3.5 h-3.5', isRegenerating && 'animate-spin')} />
            </button>
          )}
        </div>
      </div>

      {/* Draft Text */}
      <div className="px-3 py-2">
        <p className="text-sm text-gray-200 leading-relaxed">{draft.draft_text}</p>
      </div>

      {/* Warnings */}
      {hasWarnings && !compact && (
        <div className="px-3 pb-2">
          {draft.risk_warnings.map((warning, i) => (
            <div key={i} className="flex items-start gap-1.5 text-xs text-yellow-500 mt-1">
              <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
              <span>{warning}</span>
            </div>
          ))}
        </div>
      )}

      {/* Approve Button */}
      {!compact && (
        <div className="px-3 pb-3">
          <button
            onClick={handleApprove}
            disabled={isApproving || approved}
            className={clsx(
              'w-full py-1.5 rounded text-xs font-semibold transition-colors',
              approved
                ? 'bg-green-900/30 text-green-500 cursor-default'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            )}
          >
            {isApproving ? '核准中...' : approved ? '已核准' : '核准草稿'}
          </button>
        </div>
      )}
    </div>
  );
}
