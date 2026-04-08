import { useState, useEffect } from 'react';
import { Plus, Trash2, Check, User, Key, Users } from 'lucide-react';
import { getAccounts, addAccount, deleteAccount, switchAccount, AccountInfo } from '../../api/client';

interface Props { workspaceId: string; }

export function AccountsPage({ workspaceId: _workspaceId }: Props) {
  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCookies, setNewCookies] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    getAccounts()
      .then(r => setAccounts(r.accounts))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!newName.trim() || !newCookies.trim()) return;
    setAdding(true);
    setError('');
    try {
      await addAccount(newName.trim(), newCookies.trim());
      setNewName('');
      setNewCookies('');
      setShowAdd(false);
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('確定要刪除此帳號？')) return;
    await deleteAccount(id);
    load();
  };

  const handleSwitch = async (id: string) => {
    await switchAccount(id);
    load();
  };

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-100">Threads 帳號</h1>
          <p className="text-sm text-gray-500 mt-1">管理用於發布貼文的帳號（Cookie 登入，無需 API Token）</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm transition-colors"
        >
          <Plus className="w-4 h-4" /> 新增帳號
        </button>
      </div>

      {showAdd && (
        <div className="mb-6 p-4 bg-gray-800 border border-gray-700 rounded-xl">
          <h3 className="text-sm font-medium text-gray-200 mb-3 flex items-center gap-2">
            <Key className="w-4 h-4 text-indigo-400" /> 新增 Threads 帳號
          </h3>
          <div className="p-3 bg-blue-900/20 border border-blue-800/40 rounded-lg text-xs text-blue-400 mb-3 space-y-1">
            <p className="font-semibold text-blue-300">取得 Cookies：</p>
            <ol className="list-decimal list-inside space-y-0.5">
              <li>用 Chrome 登入 threads.net</li>
              <li>安裝 Cookie-Editor 擴充功能</li>
              <li>點擊 Export（JSON 格式）→ 複製</li>
            </ol>
          </div>
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="帳號名稱（例：主帳號、行銷帳號）"
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-indigo-500 mb-2"
          />
          <textarea
            value={newCookies}
            onChange={e => setNewCookies(e.target.value)}
            placeholder={'貼入 JSON cookies，例如：[{"name":"sessionid","value":"..."}]'}
            rows={4}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-indigo-500 font-mono resize-none"
          />
          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleAdd}
              disabled={adding || !newName.trim() || !newCookies.trim()}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-sm transition-colors"
            >
              {adding ? '新增中...' : '儲存帳號'}
            </button>
            <button
              onClick={() => { setShowAdd(false); setNewName(''); setNewCookies(''); setError(''); }}
              className="px-4 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500 text-sm">載入中...</div>
      ) : accounts.length === 0 ? (
        <div className="text-center py-16 text-gray-600">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">尚未設定任何帳號</p>
          <p className="text-xs mt-1">點擊「新增帳號」並貼入 Cookie 開始使用</p>
        </div>
      ) : (
        <div className="space-y-3">
          {accounts.map(acc => (
            <div
              key={acc.id}
              className={`p-4 bg-gray-800 border rounded-xl flex items-center gap-4 ${
                acc.is_active ? 'border-indigo-700/60' : 'border-gray-700'
              }`}
            >
              <div className="w-10 h-10 rounded-full bg-indigo-900/50 flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5 text-indigo-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-100">{acc.name}</span>
                  {acc.is_active && <Check className="w-3.5 h-3.5 text-green-400" />}
                </div>
                {acc.username && (
                  <p className="text-xs text-gray-500 mt-0.5">@{acc.username}</p>
                )}
                <p className={`text-xs mt-0.5 ${acc.is_active ? 'text-green-400' : 'text-gray-600'}`}>
                  {acc.is_active ? '使用中（發文將使用此帳號）' : '備用'}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {!acc.is_active && (
                  <button
                    onClick={() => handleSwitch(acc.id)}
                    className="px-3 py-1.5 text-xs text-indigo-400 hover:text-indigo-300 bg-indigo-900/20 hover:bg-indigo-900/40 rounded-lg transition-colors"
                  >
                    切換
                  </button>
                )}
                <button
                  onClick={() => handleDelete(acc.id)}
                  title="刪除帳號"
                  className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 p-4 bg-gray-900 border border-gray-800 rounded-xl">
        <h3 className="text-xs font-medium text-gray-400 mb-2">發文原理</h3>
        <p className="text-xs text-gray-600">
          本系統使用 Cookie 模擬已登入的瀏覽器操作，透過 Threads 網頁介面發布貼文，無需申請官方 API Token。
          Cookie 與「搜尋工作台」共用同一套帳號，頂部按鈕也可管理。
        </p>
      </div>
    </div>
  );
}
