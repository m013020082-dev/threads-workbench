import { useState, useEffect } from 'react';
import { Clock, Trash2, CheckCircle, AlertTriangle, CalendarRange, Loader2, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { getScheduledPosts, cancelScheduledPost, batchSchedulePosts, ScheduledPost } from '../../api/client';

interface Props { workspaceId: string; }

const statusInfo: Record<string, { text: string; color: string }> = {
  pending: { text: '待發布', color: 'bg-yellow-900/40 text-yellow-300 border-yellow-800' },
  published: { text: '已發布', color: 'bg-green-900/40 text-green-300 border-green-800' },
  failed: { text: '失敗', color: 'bg-red-900/40 text-red-300 border-red-800' },
  cancelled: { text: '已取消', color: 'bg-gray-800 text-gray-500 border-gray-700' },
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function dateAfterDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 產生每天的預覽時間（用固定種子均勻分佈，非真正隨機） */
function generatePreviewSlots(postsPerDay: number, hourStart: number, hourEnd: number): string[] {
  const minuteRange = (hourEnd - hourStart) * 60;
  if (minuteRange <= 0 || postsPerDay <= 0) return [];
  const interval = Math.floor(minuteRange / postsPerDay);
  return Array.from({ length: postsPerDay }, (_, i) => {
    const offsetMin = Math.floor(interval * i + interval * 0.3); // 稍微錯開整點
    const h = hourStart + Math.floor(offsetMin / 60);
    const m = offsetMin % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  });
}

function BatchSchedulePanel({ workspaceId, onScheduled }: { workspaceId: string; onScheduled: () => void }) {
  const [open, setOpen] = useState(false);
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState(dateAfterDays(29));
  const [postsPerDay, setPostsPerDay] = useState(3);
  const [hourStart, setHourStart] = useState(9);
  const [hourEnd, setHourEnd] = useState(21);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffDays = Math.max(0, Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1);
  const total = diffDays * postsPerDay;
  const previewSlots = generatePreviewSlots(postsPerDay, hourStart, hourEnd);

  // 產生預覽日期列表（最多顯示 7 天）
  const previewDays = Array.from({ length: Math.min(diffDays, 7) }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric', weekday: 'short' });
  });

  const handleSubmit = async () => {
    setError(null);
    setResult(null);
    if (!startDate || !endDate) return setError('請選擇日期範圍');
    if (new Date(startDate) > new Date(endDate)) return setError('結束日期需晚於開始日期');
    if (diffDays > 31) return setError('最多排程 31 天');
    if (total > 1500) return setError(`總篇數 ${total} 超過上限 1500`);
    if (hourStart >= hourEnd) return setError('開始時間需早於結束時間');

    setLoading(true);
    try {
      const res = await batchSchedulePosts({
        workspace_id: workspaceId,
        start_date: startDate,
        end_date: endDate,
        posts_per_day: postsPerDay,
        hour_start: hourStart,
        hour_end: hourEnd,
      });
      setResult(res.message);
      setTimeout(() => { onScheduled(); }, 3000);
    } catch (err: any) {
      setError(err?.response?.data?.error || '批次排程失敗');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mb-6 bg-gray-800 border border-indigo-700/40 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-gray-750 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <CalendarRange className="w-4 h-4 text-indigo-400" />
          <span className="text-sm font-semibold text-indigo-300">批次建立排程</span>
          <span className="text-xs text-gray-500">AI 自動生成內容並依日期排程</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-gray-700/50 pt-4 space-y-4">
          {/* 日期範圍 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">開始日期</label>
              <input
                type="date"
                value={startDate}
                min={today()}
                onChange={e => setStartDate(e.target.value)}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">結束日期</label>
              <input
                type="date"
                value={endDate}
                min={startDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* 每天篇數 + 時間區間 */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">每天篇數</label>
              <select
                value={postsPerDay}
                onChange={e => setPostsPerDay(Number(e.target.value))}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
              >
                {Array.from({length: 50}, (_, i) => i + 1).map(n => (
                  <option key={n} value={n}>{n} 篇</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">發文起始時間</label>
              <select
                value={hourStart}
                onChange={e => setHourStart(Number(e.target.value))}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
              >
                {Array.from({length: 24}, (_, i) => (
                  <option key={i} value={i}>{String(i).padStart(2,'0')}:00</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">發文結束時間</label>
              <select
                value={hourEnd}
                onChange={e => setHourEnd(Number(e.target.value))}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
              >
                {Array.from({length: 24}, (_, i) => (
                  <option key={i} value={i}>{String(i).padStart(2,'0')}:00</option>
                ))}
              </select>
            </div>
          </div>

          {/* 摘要 + 時間預覽 */}
          {diffDays > 0 && (
            <div className="space-y-2">
              <div className="px-3 py-2.5 bg-indigo-900/20 border border-indigo-700/30 rounded-lg text-xs text-indigo-300">
                共 <span className="font-bold text-indigo-200">{diffDays} 天</span>，每天 <span className="font-bold text-indigo-200">{postsPerDay} 篇</span>，時間分佈在 {String(hourStart).padStart(2,'0')}:00–{String(hourEnd).padStart(2,'0')}:00 之間
                {' → '}總計 <span className="font-bold text-white">{total} 篇</span>
                {total > 1500 && <span className="text-red-400 ml-2">⚠ 超過上限 1500</span>}
              </div>

              {/* 時間預覽表 */}
              {previewSlots.length > 0 && hourStart < hourEnd && (
                <div className="border border-gray-700 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setShowPreview(!showPreview)}
                    className="w-full flex items-center justify-between px-3 py-2 bg-gray-900 text-xs text-gray-400 hover:text-gray-200 transition-colors"
                  >
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-indigo-400" />
                      每天發布時間預覽
                    </span>
                    {showPreview ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                  {showPreview && (
                    <div className="px-3 pb-3 pt-2 bg-gray-900 space-y-1.5">
                      {/* 時間點列表 */}
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {previewSlots.map((t, i) => (
                          <span key={i} className="px-2 py-0.5 bg-indigo-900/40 border border-indigo-700/40 text-indigo-300 rounded text-xs font-mono">
                            {t}
                          </span>
                        ))}
                      </div>
                      {/* 前幾天的完整預覽 */}
                      <p className="text-xs text-gray-600 mb-1.5">前 {previewDays.length} 天排程（實際時間略有隨機偏移）</p>
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {previewDays.map((day, di) => (
                          <div key={di} className="flex items-center gap-2 text-xs">
                            <span className="w-20 text-gray-500 flex-shrink-0">{day}</span>
                            <div className="flex flex-wrap gap-1">
                              {previewSlots.map((t, ti) => (
                                <span key={ti} className="text-gray-400 font-mono">{t}</span>
                              ))}
                            </div>
                          </div>
                        ))}
                        {diffDays > 7 && (
                          <p className="text-xs text-gray-600 pt-1">...以及後續 {diffDays - 7} 天，每天相同時間點</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {error && (
            <p className="text-xs text-red-400 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />{error}
            </p>
          )}
          {result && (
            <p className="text-xs text-green-400 flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5" />{result}
            </p>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading || total === 0 || total > 250}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors"
          >
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" />AI 生成中，請稍候...</>
              : <><Sparkles className="w-4 h-4" />開始批次排程（{total} 篇）</>
            }
          </button>
          <p className="text-xs text-gray-600 text-center">後台 AI 自動依品牌設定生成內容，完成後可在排程列表查看</p>
        </div>
      )}
    </div>
  );
}

export function ScheduledPage({ workspaceId }: Props) {
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const load = () => {
    if (!workspaceId) return;
    setLoading(true);
    getScheduledPosts(workspaceId)
      .then(r => setPosts(r.posts))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [workspaceId]);

  const handleCancel = async (id: string) => {
    if (!confirm('確定取消此排程？')) return;
    setCancellingId(id);
    try {
      await cancelScheduledPost(id);
      load();
    } finally {
      setCancellingId(null);
    }
  };

  const handleCancelAll = async () => {
    const pending = posts.filter(p => p.status === 'pending');
    if (!confirm(`確定取消全部 ${pending.length} 筆待發布排程？`)) return;
    for (const p of pending) {
      await cancelScheduledPost(p.id).catch(() => {});
    }
    load();
  };

  const formatTime = (ts: number) => {
    if (!ts) return '—';
    return new Date(ts).toLocaleString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const pendingCount = posts.filter(p => p.status === 'pending').length;

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-100">排程發文</h1>
        <p className="text-sm text-gray-500 mt-1">管理所有已排程的貼文，後端每分鐘自動執行到期的排程</p>
      </div>

      <BatchSchedulePanel workspaceId={workspaceId} onScheduled={load} />

      {loading ? (
        <div className="text-center py-12 text-gray-500 text-sm">載入中...</div>
      ) : posts.length === 0 ? (
        <div className="text-center py-16 text-gray-600">
          <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">尚無排程貼文</p>
          <p className="text-xs mt-1">使用上方批次排程或在「撰寫發文」設定單篇排程</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-gray-500">{posts.length} 筆排程，{pendingCount} 筆待發布</p>
            {pendingCount > 0 && (
              <button
                onClick={handleCancelAll}
                className="text-xs text-red-400 hover:text-red-300 transition-colors"
              >
                取消全部待發布
              </button>
            )}
          </div>
          <div className="space-y-3">
            {posts.map(post => {
              const info = statusInfo[post.status] || statusInfo.pending;
              const isPast = post.scheduled_at < Date.now() && post.status === 'pending';

              return (
                <div key={post.id} className="p-4 bg-gray-800 border border-gray-700 rounded-xl">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span className={`text-xs px-2 py-0.5 rounded border ${info.color}`}>{info.text}</span>
                        {post.account_name && (
                          <span className="text-xs text-gray-500">@{post.account_name}</span>
                        )}
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Clock className="w-3 h-3" />
                          {formatTime(post.scheduled_at)}
                          {isPast && <span className="text-red-400 ml-1">（已到期）</span>}
                        </div>
                      </div>
                      <p className="text-sm text-gray-200 line-clamp-3 whitespace-pre-line">
                        {post.content}
                      </p>
                      {post.error_message && (
                        <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> {post.error_message}
                        </p>
                      )}
                      {post.threads_post_id && (
                        <p className="text-xs text-blue-400 mt-1 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Post ID: {post.threads_post_id}
                        </p>
                      )}
                    </div>
                    {post.status === 'pending' && (
                      <button
                        onClick={() => handleCancel(post.id)}
                        disabled={cancellingId === post.id}
                        title="取消排程"
                        className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded transition-colors flex-shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
