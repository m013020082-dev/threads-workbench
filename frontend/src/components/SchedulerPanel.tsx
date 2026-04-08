import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Clock, Plus, Power, PowerOff, X, CheckCircle, XCircle, Loader, Calendar } from 'lucide-react';
import clsx from 'clsx';
import { ScheduledJob } from '../types';
import { listScheduledJobs, createScheduledJob, toggleScheduledJob } from '../api/client';

interface SchedulerPanelProps {
  workspaceId: string | null;
  onClose: () => void;
}

const CRON_PRESETS = [
  { label: '每小時', value: '0 * * * *' },
  { label: '每 6 小時', value: '0 */6 * * *' },
  { label: '每天兩次', value: '0 9,18 * * *' },
  { label: '每天早上 9 點', value: '0 9 * * *' },
  { label: '平日早上 9 點', value: '0 9 * * 1-5' },
];

function StatusBadge({ status }: { status: string }) {
  if (status === 'completed') return (
    <span className="flex items-center gap-1 text-xs text-green-400">
      <CheckCircle className="w-3 h-3" /> 已完成
    </span>
  );
  if (status === 'failed') return (
    <span className="flex items-center gap-1 text-xs text-red-400">
      <XCircle className="w-3 h-3" /> 失敗
    </span>
  );
  if (status === 'running') return (
    <span className="flex items-center gap-1 text-xs text-blue-400">
      <Loader className="w-3 h-3 animate-spin" /> 執行中
    </span>
  );
  return null;
}

function JobCard({ job, onToggle }: { job: ScheduledJob; onToggle: (id: string, enabled: boolean) => void }) {
  const [toggling, setToggling] = useState(false);

  const handleToggle = async () => {
    setToggling(true);
    try {
      await onToggle(job.id, !job.enabled);
    } finally {
      setToggling(false);
    }
  };

  return (
    <div className={clsx(
      'bg-gray-800 border rounded-lg p-3 transition-colors',
      job.enabled ? 'border-gray-700' : 'border-gray-800 opacity-60'
    )}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-200 truncate">{job.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={clsx(
              'text-xs px-1.5 py-0.5 rounded',
              job.job_type === 'search' ? 'bg-blue-900/40 text-blue-300' :
              job.job_type === 'score' ? 'bg-yellow-900/40 text-yellow-300' :
              'bg-purple-900/40 text-purple-300'
            )}>
              {job.job_type}
            </span>
            <span className="text-xs text-gray-600 font-mono">{job.cron_expression}</span>
          </div>
        </div>
        <button
          onClick={handleToggle}
          disabled={toggling}
          className={clsx(
            'p-1.5 rounded transition-colors disabled:opacity-50',
            job.enabled
              ? 'text-green-400 hover:bg-green-900/30'
              : 'text-gray-600 hover:bg-gray-700'
          )}
          title={job.enabled ? '停用任務' : '啟用任務'}
        >
          {job.enabled ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
        </button>
      </div>

      <div className="flex items-center justify-between text-xs text-gray-600">
        <span>
          {job.last_run_at
            ? `上次執行：${new Date(job.last_run_at).toLocaleString()}`
            : '從未執行'}
        </span>
        {job.last_run && <StatusBadge status={job.last_run.status} />}
      </div>
    </div>
  );
}

export function SchedulerPanel({ workspaceId, onClose }: SchedulerPanelProps) {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newJob, setNewJob] = useState({
    name: '',
    job_type: 'search' as 'search' | 'score' | 'draft',
    cron_expression: '0 9 * * *',
    keywords: '',
  });
  const [createError, setCreateError] = useState('');

  const jobsQuery = useQuery({
    queryKey: ['scheduler-jobs', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return { jobs: [] };
      return listScheduledJobs(workspaceId);
    },
    enabled: !!workspaceId,
    refetchInterval: 30000,
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      return toggleScheduledJob(id, enabled);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduler-jobs', workspaceId] });
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!workspaceId) throw new Error('請先選擇工作區');
      const keywords = newJob.keywords.split(',').map((k) => k.trim()).filter(Boolean);
      return createScheduledJob({
        workspace_id: workspaceId,
        name: newJob.name,
        job_type: newJob.job_type,
        cron_expression: newJob.cron_expression,
        config: { keywords },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduler-jobs', workspaceId] });
      setShowCreate(false);
      setNewJob({ name: '', job_type: 'search', cron_expression: '0 9 * * *', keywords: '' });
      setCreateError('');
    },
    onError: (err) => {
      setCreateError(err instanceof Error ? err.message : '建立任務失敗');
    },
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newJob.name.trim()) {
      setCreateError('請輸入任務名稱');
      return;
    }
    setCreateError('');
    await createMutation.mutateAsync();
  };

  const jobs = jobsQuery.data?.jobs || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-semibold text-gray-200">排程器</h2>
            <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded">
              搜尋 / 評分 / 草稿
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 max-h-[70vh] overflow-y-auto">
          {/* Jobs list */}
          <div className="space-y-2 mb-4">
            {jobsQuery.isLoading ? (
              <div className="animate-pulse space-y-2">
                {[1, 2].map((i) => (
                  <div key={i} className="h-16 bg-gray-800 rounded-lg" />
                ))}
              </div>
            ) : jobs.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">尚無排程任務</p>
                <p className="text-gray-600 text-xs mt-1">建立任務以自動化搜尋、評分與草稿生成</p>
              </div>
            ) : (
              jobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  onToggle={(id, enabled) => toggleMutation.mutate({ id, enabled })}
                />
              ))
            )}
          </div>

          {/* Create Form */}
          {showCreate ? (
            <form onSubmit={handleCreate} className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-medium text-gray-300">新增排程任務</h3>

              <div>
                <label className="text-xs text-gray-500 block mb-1">任務名稱</label>
                <input
                  type="text"
                  placeholder="例：每日搜尋 AI 關鍵字"
                  value={newJob.name}
                  onChange={(e) => setNewJob({ ...newJob, name: e.target.value })}
                  className="w-full px-2.5 py-2 text-sm bg-gray-900 border border-gray-700 rounded text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs text-gray-500 block mb-1">任務類型</label>
                <select
                  value={newJob.job_type}
                  onChange={(e) => setNewJob({ ...newJob, job_type: e.target.value as 'search' | 'score' | 'draft' })}
                  className="w-full px-2.5 py-2 text-sm bg-gray-900 border border-gray-700 rounded text-gray-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="search">搜尋 — 發現新貼文</option>
                  <option value="score">評分 — 對貼文排名</option>
                  <option value="draft">草稿 — 生成留言草稿</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-gray-500 block mb-1">排程</label>
                <div className="flex flex-wrap gap-1 mb-2">
                  {CRON_PRESETS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setNewJob({ ...newJob, cron_expression: p.value })}
                      className={clsx(
                        'text-xs px-2 py-1 rounded transition-colors',
                        newJob.cron_expression === p.value
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="自訂 cron（例：0 9 * * *）"
                  value={newJob.cron_expression}
                  onChange={(e) => setNewJob({ ...newJob, cron_expression: e.target.value })}
                  className="w-full px-2.5 py-2 text-sm bg-gray-900 border border-gray-700 rounded text-gray-200 font-mono placeholder-gray-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {(newJob.job_type === 'search' || newJob.job_type === 'score') && (
                <div>
                  <label className="text-xs text-gray-500 block mb-1">關鍵字（以逗號分隔）</label>
                  <input
                    type="text"
                    placeholder="例：AI, 機器學習, 新創"
                    value={newJob.keywords}
                    onChange={(e) => setNewJob({ ...newJob, keywords: e.target.value })}
                    className="w-full px-2.5 py-2 text-sm bg-gray-900 border border-gray-700 rounded text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              )}

              {createError && <p className="text-red-400 text-xs">{createError}</p>}

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="flex-1 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded transition-colors disabled:opacity-50"
                >
                  {createMutation.isPending ? '建立中...' : '建立任務'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowCreate(false); setCreateError(''); }}
                  className="flex-1 py-2 text-sm font-medium bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
                >
                  取消
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setShowCreate(true)}
              disabled={!workspaceId}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 border-dashed text-gray-400 hover:text-gray-300 rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
              新增排程任務
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
