import { useState } from 'react';
import { Trash2, Play, UserPlus, Zap, Hand, CheckCheck, AlertTriangle, Check, Loader2, CheckCircle, XCircle, ExternalLink, StepForward, Square } from 'lucide-react';
import clsx from 'clsx';
import { RadarQueueItem } from '../../types';
import { ExecutionSession } from '../../api/client';
import { ExecutionMode } from '../../hooks/useRadar';

interface Props {
  radarQueue: RadarQueueItem[];
  executionMode: ExecutionMode;
  onModeChange: (mode: ExecutionMode) => void;
  onRemove: (postId: string) => void;
  onBatchMarkFollow: () => void;
  onExecute: (item: RadarQueueItem) => Promise<void>;
  onConfirm: () => Promise<void>;
  onCancel: () => Promise<void>;
  session: ExecutionSession | null;
  isStarting: boolean;
  isConfirming: boolean;
  isRunningAll: boolean;
  onStartAll: () => Promise<void>;
  onStopAll: () => void;
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  follow: { label: '追蹤', color: 'text-blue-400 bg-blue-900/40 border-blue-800/50' },
  comment: { label: '留言', color: 'text-green-400 bg-green-900/40 border-green-800/50' },
  both: { label: '兩者', color: 'text-indigo-400 bg-indigo-900/40 border-indigo-700/50' },
};

function ExecutionStatus({ session, onConfirm, onCancel, isConfirming }: {
  session: ExecutionSession;
  onConfirm: () => Promise<void>;
  onCancel: () => Promise<void>;
  isConfirming: boolean;
}) {
  return (
    <div className="border-t border-gray-800 pt-3 mt-3 space-y-2">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">執行狀態</p>

      <div className={clsx(
        'flex items-start gap-2 px-3 py-2.5 rounded-lg border',
        session.status === 'opening' && 'bg-yellow-900/20 border-yellow-800/50',
        session.status === 'ready' && 'bg-green-900/20 border-green-800/50',
        session.status === 'error' && 'bg-red-900/20 border-red-800/50',
      )}>
        {session.status === 'opening' && (
          <><Loader2 className="w-4 h-4 text-yellow-400 animate-spin flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-yellow-400">開啟瀏覽器中...</p>
              <p className="text-xs text-yellow-600 mt-0.5">正在載入頁面</p>
            </div></>
        )}
        {session.status === 'ready' && (
          <><CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-green-400">
                {session.actionType === 'follow' ? '已定位追蹤按鈕' :
                 session.actionType === 'comment' ? '留言草稿已填入' :
                 '草稿已填入＋追蹤按鈕已定位'}
              </p>
              <p className="text-xs text-green-600 mt-0.5">
                請在瀏覽器視窗中
                {session.actionType === 'follow' ? '點擊追蹤按鈕' :
                 session.actionType === 'comment' ? '按下送出' :
                 '送出留言並點擊追蹤'}
                後，回來點擊確認。
              </p>
            </div></>
        )}
        {session.status === 'error' && (
          <><XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-red-400">執行失敗</p>
              <p className="text-xs text-red-600 mt-0.5">{session.error}</p>
            </div></>
        )}
      </div>

      {(session.status === 'ready' || session.status === 'opening') && (
        <div className="flex gap-2">
          <button
            onClick={onConfirm}
            disabled={isConfirming || session.status !== 'ready'}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-green-700 hover:bg-green-600 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
          >
            <Check className="w-3.5 h-3.5" />
            {isConfirming ? '記錄中...' : '確認已完成'}
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

      <div className="flex items-start gap-2 px-2.5 py-2 bg-amber-900/20 border border-amber-800/40 rounded-lg">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-600">所有送出/追蹤行為需您手動操作確認</p>
      </div>
    </div>
  );
}

export function RadarQueuePanel({ radarQueue, executionMode, onModeChange, onRemove, onBatchMarkFollow, onExecute, onConfirm, onCancel, session, isStarting, isConfirming, isRunningAll, onStartAll, onStopAll }: Props) {
  const [executing, setExecuting] = useState<string | null>(null);

  const handleExecute = async (item: RadarQueueItem) => {
    setExecuting(item.candidate.post.id);
    try { await onExecute(item); } finally { setExecuting(null); }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          待執行佇列
          {radarQueue.length > 0 && (
            <span className="ml-2 px-1.5 py-0.5 bg-indigo-900/50 text-indigo-400 rounded-full text-xs">
              {radarQueue.length}
            </span>
          )}
        </h2>
      </div>

      {/* 模式切換 */}
      <div className="flex gap-1 mb-3 p-1 bg-gray-800 rounded-lg">
        <button
          onClick={() => onModeChange('manual')}
          className={clsx(
            'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-medium transition-colors',
            executionMode === 'manual' ? 'bg-gray-700 text-gray-200' : 'text-gray-500 hover:text-gray-400'
          )}
        >
          <Hand className="w-3 h-3" /> 手動
        </button>
        <button
          onClick={() => onModeChange('semi-auto')}
          className={clsx(
            'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-medium transition-colors',
            executionMode === 'semi-auto' ? 'bg-indigo-700 text-white' : 'text-gray-500 hover:text-gray-400'
          )}
        >
          <Zap className="w-3 h-3" /> 半自動
        </button>
      </div>

      {/* 批次操作 */}
      {radarQueue.length > 0 && (
        <div className="mb-3 space-y-1.5">
          <button
            onClick={onBatchMarkFollow}
            className="w-full flex items-center justify-center gap-1.5 py-2 bg-blue-900/40 hover:bg-blue-800/40 border border-blue-800/50 text-blue-300 rounded-lg text-xs font-semibold transition-colors"
          >
            <UserPlus className="w-3.5 h-3.5" />
            批次升級為「兩者」
          </button>

          {/* 一鍵全部啟動 — 只在半自動模式且無執行中 session 時顯示 */}
          {executionMode === 'semi-auto' && !session && (
            isRunningAll ? (
              <button
                onClick={onStopAll}
                className="w-full flex items-center justify-center gap-1.5 py-2 bg-red-800/50 hover:bg-red-700/50 border border-red-700/50 text-red-300 rounded-lg text-xs font-semibold transition-colors"
              >
                <Square className="w-3.5 h-3.5" />
                停止全部執行
              </button>
            ) : (
              <button
                onClick={onStartAll}
                disabled={isStarting}
                className="w-full flex items-center justify-center gap-1.5 py-2 bg-green-700 hover:bg-green-600 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
              >
                <StepForward className="w-3.5 h-3.5" />
                一鍵全部啟動（{radarQueue.length} 項）
              </button>
            )
          )}
        </div>
      )}

      {/* Queue items */}
      {radarQueue.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center mb-2">
            <CheckCheck className="w-4 h-4 text-gray-600" />
          </div>
          <p className="text-gray-500 text-xs">佇列為空</p>
          <p className="text-gray-600 text-xs mt-1">選擇候選人動作後加入</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-2">
          {radarQueue.map(item => {
            const { label, color } = ACTION_LABELS[item.action] || ACTION_LABELS.follow;
            const isExecuting = executing === item.candidate.post.id;
            const currentlyRunning = session?.postId === item.candidate.post.id;

            return (
              <div
                key={item.candidate.post.id}
                className={clsx(
                  'bg-gray-800 border rounded-lg p-2.5',
                  currentlyRunning ? 'border-green-700/60 ring-1 ring-green-700/30' : 'border-gray-700'
                )}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs font-medium text-gray-300 truncate">
                      {item.candidate.post.author_handle}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span className={clsx('px-1.5 py-0.5 rounded border text-xs font-medium', color)}>{label}</span>
                    <button
                      onClick={() => onRemove(item.candidate.post.id)}
                      className="text-gray-600 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-gray-600 truncate mb-1.5">{item.candidate.post.post_text.substring(0, 60)}...</p>

                {/* 回文預覽 */}
                {item.draftText && (
                  <div className="mb-1.5 px-2 py-1.5 bg-green-900/20 border border-green-800/40 rounded text-xs text-green-300 whitespace-pre-wrap leading-relaxed max-h-16 overflow-hidden">
                    {item.draftText}
                  </div>
                )}

                {/* 按鈕區 */}
                <div className="flex gap-1.5">
                  {/* 快速互追加發文：同時開個人頁 + 貼文 */}
                  <button
                    onClick={() => {
                      const handle = item.candidate.post.author_handle;
                      const profileUrl = `https://www.threads.com/${handle.startsWith('@') ? handle : '@' + handle}`;
                      window.open(profileUrl, '_blank', 'noopener,noreferrer');
                      window.open(item.candidate.post.post_url, '_blank', 'noopener,noreferrer');
                    }}
                    title="快速互追加發文（同時開啟個人頁 + 貼文）"
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-indigo-800/50 hover:bg-indigo-700/60 border border-indigo-700/50 text-indigo-300 rounded text-xs font-medium transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    快速開啟
                  </button>

                  {executionMode === 'semi-auto' && !session && (
                    <button
                      onClick={() => handleExecute(item)}
                      disabled={isExecuting || isStarting}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-green-800/60 hover:bg-green-700/60 border border-green-700/50 text-green-300 rounded text-xs font-medium transition-colors disabled:opacity-50"
                    >
                      <Play className="w-3 h-3" />
                      {isExecuting ? '開啟中...' : '半自動'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 執行狀態 */}
      {session && (
        <ExecutionStatus
          session={session}
          onConfirm={onConfirm}
          onCancel={onCancel}
          isConfirming={isConfirming}
        />
      )}
    </div>
  );
}
