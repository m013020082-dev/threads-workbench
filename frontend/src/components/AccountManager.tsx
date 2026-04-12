import { useState, useEffect, useRef } from 'react';
import { Users, Plus, Trash2, Check, LogIn, X, ChevronDown, Link, CheckCircle2, AlertCircle, RefreshCw, Monitor } from 'lucide-react';
import clsx from 'clsx';
import { getAccounts, deleteAccount, switchAccount, AccountInfo, api } from '../api/client';

interface Props {
  activeAccount: Pick<AccountInfo, 'id' | 'name' | 'username'> | null;
  loggedIn: boolean;
  onAccountChange: () => void;
}

export function AccountManager({ activeAccount, loggedIn, onAccountChange }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // 新增帳號流程
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [loginStatus, setLoginStatus] = useState<'idle' | 'opening' | 'waiting' | 'success' | 'failed'>('idle');
  const [loginMessage, setLoginMessage] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Threads API OAuth
  const [apiStatus, setApiStatus] = useState<{ connected: boolean; username?: string; expired?: boolean } | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const fetchApiStatus = async () => {
    try {
      const res = await api.get('/auth/threads/api-status');
      setApiStatus(res.data);
    } catch {}
  };

  const handleConnectApi = async () => {
    setIsConnecting(true);
    try {
      const res = await api.get('/auth/threads/oauth-url');
      window.open(res.data.url, '_blank', 'width=600,height=700');
      const interval = setInterval(async () => {
        const status = await api.get('/auth/threads/api-status');
        if (status.data.connected) {
          setApiStatus(status.data);
          clearInterval(interval);
          setIsConnecting(false);
        }
      }, 2000);
      setTimeout(() => { clearInterval(interval); setIsConnecting(false); }, 120000);
    } catch {
      setIsConnecting(false);
    }
  };

  const fetchAccounts = async () => {
    setIsLoading(true);
    try {
      const { accounts } = await getAccounts();
      setAccounts(accounts);
    } catch {}
    setIsLoading(false);
  };

  useEffect(() => {
    if (showModal) {
      fetchAccounts();
      fetchApiStatus();
    }
  }, [showModal]);

  // 清理輪詢
  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const handleOpenBrowserLogin = async () => {
    if (!newName.trim()) return;
    setLoginStatus('opening');
    setLoginMessage('正在開啟瀏覽器...');

    try {
      await api.post('/auth/accounts/browser-login', { name: newName.trim() });
      setLoginStatus('waiting');
      setLoginMessage('請在彈出的瀏覽器視窗中登入 Threads，完成後自動偵測...');

      // 輪詢狀態
      pollRef.current = setInterval(async () => {
        try {
          const res = await api.get('/auth/accounts/browser-login/status');
          const { status, username, error } = res.data;
          if (status === 'success') {
            clearInterval(pollRef.current!);
            setLoginStatus('success');
            setLoginMessage(`登入成功${username ? `：@${username}` : ''}！`);
            await fetchAccounts();
            onAccountChange();
            setTimeout(() => {
              setShowAddForm(false);
              setLoginStatus('idle');
              setNewName('');
              setLoginMessage('');
            }, 2000);
          } else if (status === 'failed' || status === 'timeout') {
            clearInterval(pollRef.current!);
            setLoginStatus('failed');
            setLoginMessage(error || '登入失敗，請重試');
          }
        } catch {}
      }, 2000);
    } catch (err) {
      setLoginStatus('failed');
      setLoginMessage('無法開啟瀏覽器，請確認後端正在本機執行');
    }
  };

  const handleSwitch = async (id: string) => {
    try {
      await switchAccount(id);
      await fetchAccounts();
      onAccountChange();
    } catch {}
  };

  const handleDelete = async (id: string) => {
    if (!confirm('確定要刪除這個帳號？')) return;
    try {
      await deleteAccount(id);
      await fetchAccounts();
      onAccountChange();
    } catch {}
  };

  const resetAddForm = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    setShowAddForm(false);
    setLoginStatus('idle');
    setNewName('');
    setLoginMessage('');
  };

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className={clsx(
          'flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors',
          loggedIn
            ? 'text-green-400 bg-green-900/30 border-green-800/50 hover:bg-green-900/50'
            : 'text-white bg-indigo-600 border-transparent hover:bg-indigo-700'
        )}
      >
        {loggedIn ? (
          <>
            <Users className="w-3.5 h-3.5" />
            <span className="hidden sm:block max-w-[80px] truncate">
              {activeAccount?.name || 'Threads 帳號'}
            </span>
            <ChevronDown className="w-3 h-3 opacity-60" />
          </>
        ) : (
          <>
            <LogIn className="w-3.5 h-3.5" />
            設定帳號
          </>
        )}
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-md mx-4">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-400" />
                <h2 className="text-sm font-semibold text-gray-200">Threads 帳號管理</h2>
              </div>
              <button
                onClick={() => { setShowModal(false); resetAddForm(); }}
                className="text-gray-500 hover:text-gray-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Account list */}
            <div className="p-4 space-y-2 max-h-64 overflow-y-auto">
              {isLoading ? (
                <p className="text-xs text-gray-500 text-center py-4">載入中...</p>
              ) : accounts.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-6">尚未設定任何帳號</p>
              ) : (
                accounts.map((acc) => (
                  <div
                    key={acc.id}
                    className={clsx(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors',
                      acc.is_active
                        ? 'bg-indigo-900/30 border-indigo-700/50'
                        : 'bg-gray-800/50 border-gray-700/50 hover:border-gray-600'
                    )}
                  >
                    <div className={clsx('w-2 h-2 rounded-full flex-shrink-0', acc.is_active ? 'bg-green-400' : 'bg-gray-600')} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-200 truncate">{acc.name}</p>
                      {acc.username && <p className="text-[10px] text-gray-500 truncate">@{acc.username}</p>}
                    </div>
                    {acc.is_active ? (
                      <span className="flex items-center gap-1 text-[10px] text-green-400 flex-shrink-0">
                        <Check className="w-3 h-3" />
                        使用中
                      </span>
                    ) : (
                      <button
                        onClick={() => handleSwitch(acc.id)}
                        className="text-[10px] text-indigo-400 hover:text-indigo-300 flex-shrink-0 px-2 py-1 rounded hover:bg-indigo-900/30"
                      >
                        切換
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(acc.id)}
                      className="text-gray-600 hover:text-red-400 flex-shrink-0 p-1 rounded"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Threads Official API */}
            <div className="px-4 py-3 border-t border-gray-800">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">官方 API（回覆用）</p>
              {apiStatus?.connected ? (
                <div className="flex items-center gap-2 px-3 py-2 bg-green-900/20 border border-green-800/40 rounded-lg">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-green-300">已連接</p>
                    {apiStatus.username && <p className="text-[10px] text-green-500">@{apiStatus.username}</p>}
                  </div>
                  <button onClick={handleConnectApi} className="text-[10px] text-gray-400 hover:text-gray-300 px-2 py-1 rounded hover:bg-gray-700">
                    重新授權
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {apiStatus?.expired && (
                    <div className="flex items-center gap-1.5 text-[10px] text-yellow-400">
                      <AlertCircle className="w-3 h-3" />
                      Token 已過期，請重新授權
                    </div>
                  )}
                  <button
                    onClick={handleConnectApi}
                    disabled={isConnecting}
                    className="w-full flex items-center justify-center gap-2 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Link className="w-3.5 h-3.5" />
                    {isConnecting ? '等待授權中...' : '連接 Threads 官方 API'}
                  </button>
                </div>
              )}
            </div>

            {/* Add account */}
            <div className="px-4 pb-4 border-t border-gray-800 pt-3">
              {!showAddForm ? (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="w-full flex items-center justify-center gap-2 py-2 text-xs text-indigo-400 hover:text-indigo-300 border border-dashed border-indigo-800/60 hover:border-indigo-600 rounded-lg transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  新增帳號
                </button>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs font-medium text-gray-300">新增 Threads 帳號</p>

                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="帳號名稱（例：主帳號、行銷帳號）"
                    disabled={loginStatus === 'waiting' || loginStatus === 'opening'}
                    className="w-full px-3 py-2 text-xs bg-gray-800 border border-gray-700 rounded text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                  />

                  {/* Status display */}
                  {loginStatus !== 'idle' && (
                    <div className={clsx(
                      'flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs',
                      loginStatus === 'success' ? 'bg-green-900/30 border border-green-800/50 text-green-300' :
                      loginStatus === 'failed' ? 'bg-red-900/30 border border-red-800/50 text-red-300' :
                      'bg-indigo-900/20 border border-indigo-800/40 text-indigo-300'
                    )}>
                      {loginStatus === 'waiting' && (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
                      )}
                      {loginStatus === 'success' && <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />}
                      {loginStatus === 'failed' && <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />}
                      {loginStatus === 'opening' && <Monitor className="w-3.5 h-3.5 flex-shrink-0" />}
                      <span>{loginMessage}</span>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={handleOpenBrowserLogin}
                      disabled={!newName.trim() || loginStatus === 'opening' || loginStatus === 'waiting'}
                      className="flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded transition-colors disabled:opacity-50"
                    >
                      <Monitor className="w-3.5 h-3.5" />
                      {loginStatus === 'waiting' ? '等待登入中...' : '開啟瀏覽器登入'}
                    </button>
                    <button
                      onClick={resetAddForm}
                      className="flex-1 py-2 text-xs text-gray-400 bg-gray-800 hover:bg-gray-700 rounded transition-colors"
                    >
                      取消
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
