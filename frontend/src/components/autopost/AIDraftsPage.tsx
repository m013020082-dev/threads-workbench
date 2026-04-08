import { useState, useEffect } from 'react';
import { Bot, Send, Trash2, X, RefreshCw, Edit3, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { getAutoDrafts, publishAutoDraft, rejectAutoDraft, deleteAllAutoDrafts, runAgent, AutoDraft } from '../../api/client';
import clsx from 'clsx';

interface Props { workspaceId: string; }

const statusLabels: Record<string, { text: string; color: string }> = {
  pending_review: { text: '待審核', color: 'bg-yellow-900/40 text-yellow-300 border-yellow-800' },
  approved: { text: '已核准', color: 'bg-green-900/40 text-green-300 border-green-800' },
  rejected: { text: '已捨棄', color: 'bg-gray-800 text-gray-500 border-gray-700' },
  published: { text: '已發布', color: 'bg-blue-900/40 text-blue-300 border-blue-800' },
  auto_published: { text: '自動發布', color: 'bg-purple-900/40 text-purple-300 border-purple-800' },
};

const riskColors: Record<string, string> = {
  low: 'text-green-400',
  medium: 'text-yellow-400',
  high: 'text-red-400',
};

export function AIDraftsPage({ workspaceId }: Props) {
  const [drafts, setDrafts] = useState<AutoDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [agentMsg, setAgentMsg] = useState('');

  const load = () => {
    if (!workspaceId) return;
    setLoading(true);
    getAutoDrafts(workspaceId)
      .then(r => setDrafts(r.drafts))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [workspaceId]);

  const handleRunAgent = async () => {
    setRunning(true);
    setAgentMsg('');
    try {
      const res = await runAgent(workspaceId);
      setAgentMsg(res.message);
      setTimeout(() => { load(); setAgentMsg(''); }, 8000);
    } catch (e: any) {
      setAgentMsg(`錯誤: ${e.message}`);
    } finally {
      setRunning(false);
    }
  };

  const handlePublish = async (draft: AutoDraft) => {
    setPublishingId(draft.id);
    try {
      const content = editingId === draft.id ? editContent : draft.content;
      await publishAutoDraft(draft.id, editingId === draft.id ? content : undefined);
      setEditingId(null);
      load();
    } catch (e: any) {
      alert(`發布失敗: ${e.message}`);
    } finally {
      setPublishingId(null);
    }
  };

  const handleReject = async (id: string) => {
    setRejectingId(id);
    try {
      await rejectAutoDraft(id);
      load();
    } finally {
      setRejectingId(null);
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm('確定刪除所有草稿？此操作無法恢復。')) return;
    setDeletingAll(true);
    try {
      await deleteAllAutoDrafts(workspaceId);
      setDrafts([]);
    } finally {
      setDeletingAll(false);
    }
  };

  const pendingCount = drafts.filter(d => d.status === 'pending_review').length;

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-100">AI 草稿管理</h1>
          <p className="text-sm text-gray-500 mt-1">
            {pendingCount > 0 ? `${pendingCount} 則草稿待審核` : '管理 AI Agent 自動生成的貼文草稿'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleDeleteAll}
            disabled={drafts.length === 0 || deletingAll}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-700 hover:bg-red-900/50 disabled:opacity-40 text-gray-400 hover:text-red-400 rounded-lg text-sm transition-colors border border-gray-700"
          >
            <Trash2 className="w-4 h-4" />
            {deletingAll ? '刪除中...' : '全部刪除'}
          </button>
          <button
            onClick={handleRunAgent}
            disabled={running}
            className="flex items-center gap-2 px-4 py-2 bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white rounded-lg text-sm transition-colors"
          >
            <Bot className={`w-4 h-4 ${running ? 'animate-pulse' : ''}`} />
            {running ? 'Agent 執行中...' : '立即執行 Agent'}
          </button>
        </div>
      </div>

      {agentMsg && (
        <div className="mb-4 p-3 bg-purple-900/20 border border-purple-800 rounded-lg text-purple-300 text-sm flex items-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" /> {agentMsg}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500 text-sm">載入中...</div>
      ) : drafts.length === 0 ? (
        <div className="text-center py-16 text-gray-600">
          <Bot className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">尚無草稿</p>
          <p className="text-xs mt-1">點擊「立即執行 Agent」讓 AI 根據熱門話題生成草稿</p>
        </div>
      ) : (
        <div className="space-y-3">
          {drafts.map(draft => {
            const statusInfo = statusLabels[draft.status] || statusLabels.pending_review;
            const isExpanded = expandedId === draft.id;
            const isEditing = editingId === draft.id;
            const isPending = draft.status === 'pending_review';

            return (
              <div key={draft.id} className={clsx(
                'bg-gray-800 border rounded-xl overflow-hidden transition-colors',
                isPending ? 'border-gray-600' : 'border-gray-700 opacity-80'
              )}>
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded border ${statusInfo.color}`}>
                          {statusInfo.text}
                        </span>
                        {draft.source_trend && (
                          <span className="text-xs text-gray-500">來源：{draft.source_trend}</span>
                        )}
                        {draft.relevance_score > 0 && (
                          <span className="text-xs text-gray-600">相關性 {draft.relevance_score}%</span>
                        )}
                        {draft.risk_level && (
                          <span className={`text-xs ${riskColors[draft.risk_level]}`}>
                            {draft.risk_level === 'low' ? '低風險' : draft.risk_level === 'medium' ? '中風險' : '高風險'}
                          </span>
                        )}
                      </div>
                      {draft.angle && (
                        <p className="text-xs text-gray-500 mb-2">角度：{draft.angle}</p>
                      )}

                      {isEditing ? (
                        <textarea
                          value={editContent}
                          onChange={e => setEditContent(e.target.value)}
                          rows={8}
                          className="w-full bg-gray-900 border border-indigo-600 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none resize-none"
                        />
                      ) : (
                        <div>
                          <p className={clsx('text-sm text-gray-200 whitespace-pre-line', !isExpanded && 'line-clamp-3')}>
                            {draft.content}
                          </p>
                          {draft.content.length > 150 && (
                            <button
                              onClick={() => setExpandedId(isExpanded ? null : draft.id)}
                              className="mt-1 text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1"
                            >
                              {isExpanded ? <><ChevronUp className="w-3 h-3" /> 收起</> : <><ChevronDown className="w-3 h-3" /> 展開</>}
                            </button>
                          )}
                        </div>
                      )}

                      {draft.audit_notes && (
                        <p className={`text-xs mt-2 ${riskColors[draft.risk_level]}`}>
                          審稿：{draft.audit_notes}
                        </p>
                      )}
                    </div>
                  </div>

                  {isPending && (
                    <div className="flex gap-2 mt-3 pt-3 border-t border-gray-700">
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => handlePublish(draft)}
                            disabled={publishingId === draft.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs transition-colors"
                          >
                            <Send className="w-3.5 h-3.5" />
                            {publishingId === draft.id ? '發布中...' : '編輯後發布'}
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-xs"
                          >
                            取消編輯
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handlePublish(draft)}
                            disabled={publishingId === draft.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs transition-colors"
                          >
                            <Send className="w-3.5 h-3.5" />
                            {publishingId === draft.id ? '發布中...' : '直接發布'}
                          </button>
                          <button
                            onClick={() => { setEditingId(draft.id); setEditContent(draft.content); setExpandedId(draft.id); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-xs"
                          >
                            <Edit3 className="w-3.5 h-3.5" /> 編輯後發布
                          </button>
                          <button
                            onClick={() => handleReject(draft.id)}
                            disabled={rejectingId === draft.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-400 hover:text-red-400 rounded-lg text-xs"
                          >
                            <X className="w-3.5 h-3.5" /> 捨棄
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  {draft.status === 'published' && draft.threads_post_id && (
                    <p className="mt-2 text-xs text-blue-400">已發布 Post ID: {draft.threads_post_id}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
