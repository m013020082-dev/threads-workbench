import { useState, useEffect, useRef } from 'react';
import { Bot, Send, Trash2, X, RefreshCw, Edit3, ChevronDown, ChevronUp, AlertTriangle, CheckCircle, CalendarClock } from 'lucide-react';
import { getAutoDrafts, publishAutoDraft, scheduleAutoDraft, rejectAutoDraft, deleteAllAutoDrafts, runAgent, AutoDraft } from '../../api/client';
import clsx from 'clsx';

interface Props { workspaceId: string; }

type TabFilter = 'pending' | 'published' | 'all';

const statusLabels: Record<string, { text: string; color: string }> = {
  pending_review: { text: '待審核', color: 'bg-yellow-900/40 text-yellow-300 border-yellow-800' },
  approved: { text: '已排程', color: 'bg-indigo-900/40 text-indigo-300 border-indigo-800' },
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
  const [pollingMsg, setPollingMsg] = useState('');
  const [publishedId, setPublishedId] = useState<string | null>(null);
  const [scheduledInfo, setScheduledInfo] = useState<{ id: string; time: string } | null>(null);
  const [activeTab, setActiveTab] = useState<TabFilter>('pending');
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollingStartRef = useRef<number>(0);
  const prevDraftCountRef = useRef<number>(0);

  const load = async (silent = false) => {
    if (!workspaceId) return 0;
    if (!silent) setLoading(true);
    try {
      const r = await getAutoDrafts(workspaceId);
      setDrafts(r.drafts);
      return r.drafts.length;
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => { load(); }, [workspaceId]);

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  const startPolling = (initialCount: number) => {
    stopPolling();
    pollingStartRef.current = Date.now();
    prevDraftCountRef.current = initialCount;
    setPollingMsg('AI 正在生成草稿，請稍候...');

    pollingRef.current = setInterval(async () => {
      const elapsed = Date.now() - pollingStartRef.current;
      const newCount = await load(true);

      if (newCount > prevDraftCountRef.current) {
        const added = newCount - prevDraftCountRef.current;
        setPollingMsg(`✓ 已生成 ${added} 則新草稿！`);
        stopPolling();
        setTimeout(() => setPollingMsg(''), 4000);
        return;
      }

      if (elapsed >= 30000) {
        setPollingMsg('');
        stopPolling();
      }
    }, 3000);
  };

  useEffect(() => () => stopPolling(), []);

  const handleRunAgent = async () => {
    setRunning(true);
    setAgentMsg('');
    setPollingMsg('');
    const currentCount = drafts.length;
    try {
      const res = await runAgent(workspaceId);
      setAgentMsg(res.message);
      setTimeout(() => setAgentMsg(''), 6000);
      startPolling(currentCount);
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
      setPublishedId(draft.id);
      // Update draft status locally for instant feedback
      setDrafts(prev => prev.map(d => d.id === draft.id ? { ...d, status: 'published' } : d));
      setTimeout(() => setPublishedId(null), 3000);
    } catch (e: any) {
      alert(`發布失敗: ${e.message}`);
    } finally {
      setPublishingId(null);
    }
  };

  const handleScheduleRandom = async (draft: AutoDraft) => {
    setPublishingId(draft.id);
    try {
      const content = editingId === draft.id ? editContent : draft.content;
      // Random time: between now+15min and 23:59 today
      const now = Date.now();
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 0, 0);
      const earliest = now + 15 * 60 * 1000;
      const latest = Math.max(endOfDay.getTime(), earliest + 60 * 1000);
      const scheduledAt = earliest + Math.floor(Math.random() * (latest - earliest));
      await scheduleAutoDraft(draft.id, scheduledAt, editingId === draft.id ? content : undefined);
      setEditingId(null);
      const timeStr = new Date(scheduledAt).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
      setScheduledInfo({ id: draft.id, time: timeStr });
      setDrafts(prev => prev.map(d => d.id === draft.id ? { ...d, status: 'approved' } : d));
      setTimeout(() => setScheduledInfo(null), 5000);
    } catch (e: any) {
      alert(`排程失敗: ${e.message}`);
    } finally {
      setPublishingId(null);
    }
  };

  const handleReject = async (id: string) => {
    if (!confirm('確定捨棄這則草稿？')) return;
    setRejectingId(id);
    try {
      await rejectAutoDraft(id);
      setDrafts(prev => prev.map(d => d.id === id ? { ...d, status: 'rejected' } : d));
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
  const scheduledCount = drafts.filter(d => d.status === 'approved').length;
  const publishedCount = drafts.filter(d => d.status === 'published' || d.status === 'auto_published').length;

  const filteredDrafts = drafts.filter(d => {
    if (activeTab === 'pending') return d.status === 'pending_review' || d.status === 'approved';
    if (activeTab === 'published') return d.status === 'published' || d.status === 'auto_published';
    return true;
  });

  const tabs: { id: TabFilter; label: string; count: number }[] = [
    { id: 'pending', label: '待審核 / 已排程', count: pendingCount + scheduledCount },
    { id: 'published', label: '已發布', count: publishedCount },
    { id: 'all', label: '全部', count: drafts.length },
  ];

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
          <RefreshCw className="w-4 h-4" /> {agentMsg}
        </div>
      )}

      {pollingMsg && (
        <div className={clsx(
          'mb-4 p-3 rounded-lg text-sm flex items-center gap-2',
          pollingMsg.startsWith('✓')
            ? 'bg-green-900/20 border border-green-800 text-green-300'
            : 'bg-indigo-900/20 border border-indigo-800 text-indigo-300'
        )}>
          {pollingMsg.startsWith('✓')
            ? <CheckCircle className="w-4 h-4 flex-shrink-0" />
            : <RefreshCw className="w-4 h-4 animate-spin flex-shrink-0" />
          }
          {pollingMsg}
        </div>
      )}

      {/* Status filter tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-800">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              'flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
              activeTab === tab.id
                ? 'border-indigo-500 text-indigo-300'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            )}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={clsx(
                'px-1.5 py-0.5 rounded-full text-xs font-bold',
                activeTab === tab.id
                  ? 'bg-indigo-600/40 text-indigo-300'
                  : 'bg-gray-700 text-gray-400'
              )}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500 text-sm">載入中...</div>
      ) : filteredDrafts.length === 0 ? (
        <div className="text-center py-16 text-gray-600">
          <Bot className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">
            {activeTab === 'pending' ? '目前無待審核草稿' : activeTab === 'published' ? '尚無已發布草稿' : '尚無草稿'}
          </p>
          {activeTab === 'pending' && (
            <p className="text-xs mt-1">點擊「立即執行 Agent」讓 AI 根據熱門話題生成草稿</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredDrafts.map(draft => {
            const statusInfo = statusLabels[draft.status] || statusLabels.pending_review;
            const isExpanded = expandedId === draft.id;
            const isEditing = editingId === draft.id;
            const isPending = draft.status === 'pending_review';
            const isJustPublished = publishedId === draft.id;
            const isJustScheduled = scheduledInfo?.id === draft.id;

            return (
              <div key={draft.id} className={clsx(
                'bg-gray-800 border rounded-xl overflow-hidden transition-colors',
                isPending ? 'border-gray-600' : 'border-gray-700 opacity-80'
              )}>
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        {isJustPublished ? (
                          <span className="text-xs px-2 py-0.5 rounded border bg-green-900/40 text-green-300 border-green-700 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> 已發布
                          </span>
                        ) : isJustScheduled ? (
                          <span className="text-xs px-2 py-0.5 rounded border bg-indigo-900/40 text-indigo-300 border-indigo-700 flex items-center gap-1">
                            <CalendarClock className="w-3 h-3" /> 已排程 {scheduledInfo!.time} 發布
                          </span>
                        ) : (
                          <span className={`text-xs px-2 py-0.5 rounded border ${statusInfo.color}`}>
                            {statusInfo.text}
                          </span>
                        )}
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
                            onClick={() => handleScheduleRandom(draft)}
                            disabled={publishingId === draft.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs transition-colors"
                          >
                            <CalendarClock className="w-3.5 h-3.5" />
                            {publishingId === draft.id ? '排程中...' : '編輯後排程'}
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
                            onClick={() => handleScheduleRandom(draft)}
                            disabled={publishingId === draft.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs transition-colors"
                          >
                            <CalendarClock className="w-3.5 h-3.5" />
                            {publishingId === draft.id ? '排程中...' : '今日隨機排程'}
                          </button>
                          <button
                            onClick={() => handlePublish(draft)}
                            disabled={publishingId === draft.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-300 rounded-lg text-xs transition-colors"
                          >
                            <Send className="w-3.5 h-3.5" /> 立即發布
                          </button>
                          <button
                            onClick={() => { setEditingId(draft.id); setEditContent(draft.content); setExpandedId(draft.id); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-xs"
                          >
                            <Edit3 className="w-3.5 h-3.5" /> 編輯
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

                  {(draft.status === 'published' || draft.status === 'auto_published') && draft.threads_post_id && (
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
