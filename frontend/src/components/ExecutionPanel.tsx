import { ExternalLink, Copy, Check, AlertTriangle, MousePointerClick, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { useState } from 'react';
import clsx from 'clsx';
import { Post, Draft } from '../types';
import { ExecutionSession } from '../api/client';
import { ExecutionMode } from '../hooks/useExecution';

interface ExecutionPanelProps {
  selectedPost: Post | null;
  selectedDraft: Draft | null;
  executionMode: ExecutionMode;
  session: ExecutionSession | null;
  isStarting: boolean;
  isConfirming: boolean;
  onConfirm: () => Promise<void>;
  onCancel: () => Promise<void>;
}

export function ExecutionPanel({
  selectedPost,
  selectedDraft,
  executionMode,
  session,
  isStarting,
  isConfirming,
  onConfirm,
  onCancel,
}: ExecutionPanelProps) {
  const [urlCopied, setUrlCopied] = useState(false);
  const [draftCopied, setDraftCopied] = useState(false);

  const handleOpenUrl = () => {
    if (selectedPost?.post_url) {
      window.open(selectedPost.post_url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleCopyUrl = async () => {
    if (selectedPost?.post_url) {
      await navigator.clipboard.writeText(selectedPost.post_url);
      setUrlCopied(true);
      setTimeout(() => setUrlCopied(false), 2000);
    }
  };

  const handleCopyDraft = async () => {
    if (selectedDraft?.draft_text) {
      await navigator.clipboard.writeText(selectedDraft.draft_text);
      setDraftCopied(true);
      setTimeout(() => setDraftCopied(false), 2000);
    }
  };

  // 半自動模式下顯示執行狀態
  if (executionMode === 'semi-auto' && session) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-3">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">執行面板</h3>

        {/* 執行狀態 */}
        <div className={clsx(
          'flex items-start gap-2 px-3 py-3 rounded-lg border',
          session.status === 'opening' && 'bg-yellow-900/20 border-yellow-800/50',
          session.status === 'ready' && 'bg-green-900/20 border-green-800/50',
          session.status === 'error' && 'bg-red-900/20 border-red-800/50',
        )}>
          {session.status === 'opening' && (
            <>
              <Loader2 className="w-4 h-4 text-yellow-400 animate-spin flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-yellow-400">開啟瀏覽器中...</p>
                <p className="text-xs text-yellow-600 mt-0.5">正在載入貼文頁面並定位留言框</p>
              </div>
            </>
          )}
          {session.status === 'ready' && (
            <>
              <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-green-400">留言草稿已填入</p>
                <p className="text-xs text-green-600 mt-0.5">
                  瀏覽器已開啟，草稿已貼入留言框。
                  {session.followLocated ? '已定位追蹤按鈕。' : ''}
                  請在瀏覽器視窗中按下送出。
                </p>
              </div>
            </>
          )}
          {session.status === 'error' && (
            <>
              <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-red-400">執行失敗</p>
                <p className="text-xs text-red-600 mt-0.5">{session.error}</p>
              </div>
            </>
          )}
        </div>

        {/* 確認 / 取消 按鈕 */}
        {(session.status === 'ready' || session.status === 'opening') && (
          <div className="flex gap-2">
            <button
              onClick={onConfirm}
              disabled={isConfirming || session.status !== 'ready'}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-green-700 hover:bg-green-600 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              {isConfirming ? '記錄中...' : '確認已送出'}
            </button>
            <button
              onClick={onCancel}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-xs font-semibold transition-colors"
            >
              <XCircle className="w-3.5 h-3.5" />
              取消
            </button>
          </div>
        )}

        {/* 必要警示 */}
        <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-900/20 border border-amber-800/50 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-600 leading-relaxed">
            系統已填入草稿，但<strong className="text-amber-400">需由您手動點擊瀏覽器中的送出按鈕</strong>，確認後請點擊「確認已送出」。
          </p>
        </div>
      </div>
    );
  }

  // 手動模式 或 無選中貼文
  if (!selectedPost) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">執行面板</h3>
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <MousePointerClick className="w-8 h-8 text-gray-700 mb-2" />
          <p className="text-gray-600 text-xs">從佇列選擇一篇貼文以開始</p>
        </div>
        <div className="mt-3 flex items-start gap-2 px-3 py-2.5 bg-amber-900/20 border border-amber-800/40 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-600 mt-0.5">
            所有送出行為需人工最終確認。本工具不會自動發文。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-3">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">執行面板</h3>

      {/* Post URL */}
      <div>
        <p className="text-xs text-gray-500 mb-1.5">貼文網址</p>
        <div className="flex gap-1.5">
          <div className="flex-1 px-2.5 py-1.5 bg-gray-800 border border-gray-700 rounded text-xs text-gray-400 truncate font-mono">
            {selectedPost.post_url}
          </div>
          <button
            onClick={handleCopyUrl}
            className="px-2.5 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded text-xs transition-colors"
            title="複製網址"
          >
            {urlCopied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      <button
        onClick={handleOpenUrl}
        className="w-full flex items-center justify-center gap-2 py-2 bg-indigo-700 hover:bg-indigo-600 text-white rounded-lg text-sm font-medium transition-colors"
      >
        <ExternalLink className="w-4 h-4" />
        在瀏覽器中開啟貼文
      </button>

      {selectedDraft ? (
        <div>
          <p className="text-xs text-gray-500 mb-1.5">已核准草稿</p>
          <div className="bg-gray-800 border border-gray-700 rounded px-3 py-2.5 text-sm text-gray-200 leading-relaxed">
            {selectedDraft.draft_text}
          </div>
          <button
            onClick={handleCopyDraft}
            className="w-full mt-2 flex items-center justify-center gap-2 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg text-sm font-medium transition-colors"
          >
            {draftCopied ? (
              <><Check className="w-4 h-4 text-green-400" /> 已複製！</>
            ) : (
              <><Copy className="w-4 h-4" /> 複製草稿</>
            )}
          </button>
        </div>
      ) : (
        <div className="px-3 py-2.5 bg-gray-800 border border-gray-700 rounded text-xs text-gray-500 text-center">
          尚無已核准草稿，請先從佇列中核准一份
        </div>
      )}

      {/* 警示 */}
      <div className="flex items-start gap-2 px-3 py-3 bg-amber-900/20 border border-amber-800/50 rounded-lg">
        <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-bold text-amber-400 uppercase tracking-wide">請手動點擊送出</p>
          <p className="text-xs text-amber-600 mt-1 leading-relaxed">
            開啟貼文網址，將草稿貼入回覆框，並自行按下送出。本工具不會自動發文。
          </p>
        </div>
      </div>

      <div className="pt-1 border-t border-gray-800 flex items-center justify-between text-xs text-gray-600">
        <span>{selectedPost.author_handle}</span>
        <span>評分：{selectedPost.score?.toFixed(0) ?? 'N/A'}</span>
      </div>
    </div>
  );
}
