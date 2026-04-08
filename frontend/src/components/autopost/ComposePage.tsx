import { useState, useEffect } from 'react';
import { Sparkles, Send, Clock, AlertTriangle, CheckCircle, User } from 'lucide-react';
import { composeWithAI, publishPost, schedulePost, getAuthStatus } from '../../api/client';

interface Props { workspaceId: string; initialTopic?: string; }

export function ComposePage({ workspaceId, initialTopic = '' }: Props) {
  const [activeAccountName, setActiveAccountName] = useState<string | null>(null);
  const [topic, setTopic] = useState(initialTopic);
  const [content, setContent] = useState('');
  const [angle, setAngle] = useState('');
  const [riskLevel, setRiskLevel] = useState('low');
  const [auditNotes, setAuditNotes] = useState('');
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [showSchedule, setShowSchedule] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  useEffect(() => {
    getAuthStatus().then(r => {
      setActiveAccountName(r.active_account?.name || null);
    }).catch(() => {});
  }, []);

  useEffect(() => { if (initialTopic) setTopic(initialTopic); }, [initialTopic]);

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setGenerating(true);
    setResult(null);
    try {
      const res = await composeWithAI(workspaceId, topic);
      setContent(res.content);
      setAngle(res.angle || '');
      setRiskLevel(res.risk_level || 'low');
      setAuditNotes(res.audit_notes || '');
    } catch (e: any) {
      setResult({ type: 'error', msg: e.message });
    } finally {
      setGenerating(false);
    }
  };

  const handlePublish = async () => {
    if (!content.trim()) return;
    setPublishing(true);
    setResult(null);
    try {
      await publishPost(workspaceId, content);
      setResult({ type: 'success', msg: '發布成功！' });
      setContent('');
      setTopic('');
      setAngle('');
    } catch (e: any) {
      setResult({ type: 'error', msg: e.message });
    } finally {
      setPublishing(false);
    }
  };

  const handleSchedule = async () => {
    if (!content.trim() || !scheduleDate) return;
    setScheduling(true);
    setResult(null);
    try {
      const scheduledAt = new Date(scheduleDate).getTime();
      await schedulePost(workspaceId, content, scheduledAt);
      setResult({ type: 'success', msg: `已排程至 ${new Date(scheduledAt).toLocaleString('zh-TW')}` });
      setContent('');
      setShowSchedule(false);
      setScheduleDate('');
    } catch (e: any) {
      setResult({ type: 'error', msg: e.message });
    } finally {
      setScheduling(false);
    }
  };

  const charCount = content.length;
  const isOverLimit = charCount > 500;

  const riskColors: Record<string, string> = {
    low: 'text-green-400',
    medium: 'text-yellow-400',
    high: 'text-red-400',
  };

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-100">撰寫發文</h1>
        <p className="text-sm text-gray-500 mt-1">手動撰寫或 AI 輔助生成貼文，立即發布或排程</p>
      </div>

      {/* Active account indicator */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-gray-400 mb-1">發布帳號</label>
        {activeAccountName ? (
          <div className="flex items-center gap-2 px-3 py-2 bg-indigo-900/20 border border-indigo-800/50 rounded-lg text-xs text-indigo-300">
            <User className="w-3.5 h-3.5" />
            {activeAccountName}（目前使用中）
          </div>
        ) : (
          <div className="px-3 py-2 bg-yellow-900/20 border border-yellow-800 rounded-lg text-yellow-400 text-xs">
            尚未設定帳號，請先至「Threads 帳號」頁面新增 Cookie 帳號
          </div>
        )}
      </div>

      {/* Topic + AI Generate */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-gray-400 mb-1">話題關鍵字</label>
        <div className="flex gap-2">
          <input
            value={topic}
            onChange={e => setTopic(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleGenerate()}
            placeholder="輸入話題關鍵字，讓 AI 幫你產文..."
            className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-indigo-500"
          />
          <button
            onClick={handleGenerate}
            disabled={generating || !topic.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white rounded-lg text-sm transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            {generating ? '生成中...' : 'AI 生成'}
          </button>
        </div>
      </div>

      {/* AI result info */}
      {(angle || auditNotes) && (
        <div className="mb-4 p-3 bg-gray-800 border border-gray-700 rounded-lg space-y-1">
          {angle && <p className="text-xs text-gray-400"><span className="text-gray-500">切入角度：</span>{angle}</p>}
          {auditNotes && (
            <p className={`text-xs ${riskColors[riskLevel]}`}>
              <span className="text-gray-500">審稿：</span>{auditNotes}
            </p>
          )}
        </div>
      )}

      {/* Content editor */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-medium text-gray-400">貼文內容</label>
          <span className={`text-xs ${isOverLimit ? 'text-red-400' : 'text-gray-600'}`}>
            {charCount} / 500
          </span>
        </div>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="在此輸入貼文內容，或使用 AI 生成..."
          rows={10}
          className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-indigo-500 resize-none"
        />
      </div>

      {/* Result message */}
      {result && (
        <div className={`mb-4 p-3 rounded-lg border flex items-center gap-2 text-sm ${
          result.type === 'success'
            ? 'bg-green-900/20 border-green-800 text-green-400'
            : 'bg-red-900/20 border-red-800 text-red-400'
        }`}>
          {result.type === 'success' ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
          {result.msg}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handlePublish}
          disabled={!content.trim() || !activeAccountName || isOverLimit || publishing}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Send className="w-4 h-4" />
          {publishing ? '發布中...' : '立即發布'}
        </button>
        <button
          onClick={() => setShowSchedule(!showSchedule)}
          disabled={!content.trim() || !activeAccountName || isOverLimit}
          className="flex items-center gap-2 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-gray-300 rounded-lg text-sm transition-colors"
        >
          <Clock className="w-4 h-4" />
          排程發布
        </button>
      </div>

      {showSchedule && (
        <div className="mt-3 p-4 bg-gray-800 border border-gray-700 rounded-xl">
          <label className="block text-xs font-medium text-gray-400 mb-2">預定發布時間</label>
          <div className="flex gap-2">
            <input
              type="datetime-local"
              value={scheduleDate}
              onChange={e => setScheduleDate(e.target.value)}
              min={new Date().toISOString().slice(0, 16)}
              className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
            />
            <button
              onClick={handleSchedule}
              disabled={!scheduleDate || !activeAccountName || scheduling}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-sm transition-colors"
            >
              {scheduling ? '排程中...' : '確認排程'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
