import { useState, useEffect, useRef } from 'react';
import { Users, Plus, Trash2, Check, LogIn, X, ChevronDown, Link, CheckCircle2, AlertCircle, RefreshCw, Monitor, ClipboardPaste, ExternalLink, Copy } from 'lucide-react';
import clsx from 'clsx';
import { getAccounts, deleteAccount, switchAccount, addAccount, AccountInfo, api } from '../api/client';

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
  const [addMethod, setAddMethod] = useState<'browser' | 'cookie'>('cookie');
  const [newName, setNewName] = useState('');
  const [cookieInput, setCookieInput] = useState('');
  const [loginStatus, setLoginStatus] = useState<'idle' | 'opening' | 'waiting' | 'success' | 'failed'>('idle');
  const [loginMessage, setLoginMessage] = useState('');
  const [cmdCopied, setCmdCopied] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const copyJsCmd = () => {
    navigator.clipboard.writeText('copy(document.cookie)');
    setCmdCopied(true);
    setTimeout(() => setCmdCopied(false), 2000);
  };

  // Threads API Token
  const [apiStatus, setApiStatus] = useState<{ connected: boolean; username?: string; expired?: boolean } | null>(null);
  const [showTokenForm, setShowTokenForm] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [tokenStatus, setTokenStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [tokenMessage, setTokenMessage] = useState('');

  const fetchApiStatus = async () => {
    try {
      const res = await api.get('/auth/threads/api-status');
      setApiStatus(res.data);
    } catch {}
  };

  const handleSaveToken = async () => {
    if (!tokenInput.trim()) return;
    setTokenStatus('loading');
    setTokenMessage('驗證 Token 中...');
    try {
      const res = await api.post('/auth/threads/manual-token', { accessToken: tokenInput.trim() });
      setTokenStatus('success');
      setTokenMessage(`連接成功：@${res.data.username}`);
      await fetchApiStatus();
      setTimeout(() => {
        setShowTokenForm(false);
        setTokenStatus('idle');
        setTokenInput('');
        setTokenMessage('');
      }, 2000);
    } catch (err: any) {
      setTokenStatus('error');
      setTokenMessage(err?.response?.data?.error || 'Token 無效，請確認後重試');
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

  const handleCookieLogin = async () => {
    if (!newName.trim() || !cookieInput.trim()) return;
    setLoginStatus('opening');
    setLoginMessage('正在驗證 Cookies...');
    try {
      await addAccount(newName.trim(), cookieInput.trim());
      setLoginStatus('success');
      setLoginMessage('帳號新增成功！');
      await fetchAccounts();
      onAccountChange();
      setTimeout(() => {
        setShowAddForm(false);
        setLoginStatus('idle');
        setNewName('');
        setCookieInput('');
        setLoginMessage('');
      }, 2000);
    } catch (err: any) {
      setLoginStatus('failed');
      setLoginMessage(err?.response?.data?.error || '新增失敗，請確認 Cookies 格式正確');
    }
  };

  const resetAddForm = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    setShowAddForm(false);
    setLoginStatus('idle');
    setNewName('');
    setCookieInput('');
    setLoginMessage('');
    setAddMethod('cookie');
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
              {apiStatus?.connected && !showTokenForm ? (
                <div className="flex items-center gap-2 px-3 py-2 bg-green-900/20 border border-green-800/40 rounded-lg">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-green-300">已連接</p>
                    {apiStatus.username && <p className="text-[10px] text-green-500">@{apiStatus.username}</p>}
                  </div>
                  <button onClick={() => setShowTokenForm(true)} className="text-[10px] text-gray-400 hover:text-gray-300 px-2 py-1 rounded hover:bg-gray-700">
                    更換 Token
                  </button>
                </div>
              ) : showTokenForm ? (
                <div className="space-y-2">
                  <div className="bg-gray-800/60 rounded-lg p-3 text-[11px] text-gray-400 space-y-1">
                    <p className="text-gray-300 font-medium text-xs">取得 Access Token：</p>
                    <p>1. 前往 <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300">Meta Graph API Explorer <ExternalLink className="w-3 h-3 inline" /></a></p>
                    <p>2. 選擇你的 Threads App → 產生 User Token</p>
                    <p>3. 勾選 <code className="bg-gray-700 px-1 rounded">threads_basic</code> 和 <code className="bg-gray-700 px-1 rounded">threads_content_publish</code></p>
                    <p>4. 複製 Token 貼到下方</p>
                  </div>
                  <textarea
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder="貼上 Access Token..."
                    rows={3}
                    disabled={tokenStatus === 'loading'}
                    className="w-full px-3 py-2 text-xs bg-gray-800 border border-gray-700 rounded text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500 disabled:opacity-50 font-mono resize-none"
                  />
                  {tokenStatus !== 'idle' && (
                    <div className={clsx(
                      'flex items-center gap-2 px-3 py-2 rounded-lg text-xs',
                      tokenStatus === 'success' ? 'bg-green-900/30 border border-green-800/50 text-green-300' :
                      tokenStatus === 'error' ? 'bg-red-900/30 border border-red-800/50 text-red-300' :
                      'bg-indigo-900/20 border border-indigo-800/40 text-indigo-300'
                    )}>
                      {tokenStatus === 'loading' && <RefreshCw className="w-3.5 h-3.5 animate-spin flex-shrink-0" />}
                      {tokenStatus === 'success' && <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />}
                      {tokenStatus === 'error' && <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />}
                      <span>{tokenMessage}</span>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveToken}
                      disabled={!tokenInput.trim() || tokenStatus === 'loading'}
                      className="flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded transition-colors disabled:opacity-50"
                    >
                      <Link className="w-3.5 h-3.5" />
                      儲存 Token
                    </button>
                    <button
                      onClick={() => { setShowTokenForm(false); setTokenStatus('idle'); setTokenInput(''); setTokenMessage(''); }}
                      className="flex-1 py-2 text-xs text-gray-400 bg-gray-800 hover:bg-gray-700 rounded transition-colors"
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {apiStatus?.expired && (
                    <div className="flex items-center gap-1.5 text-[10px] text-yellow-400">
                      <AlertCircle className="w-3 h-3" />
                      Token 已過期，請重新輸入
                    </div>
                  )}
                  <button
                    onClick={() => setShowTokenForm(true)}
                    className="w-full flex items-center justify-center gap-2 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
                  >
                    <Link className="w-3.5 h-3.5" />
                    輸入 Access Token
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

                  {/* Method toggle */}
                  <div className="flex rounded-lg overflow-hidden border border-gray-700 text-xs">
                    <button
                      onClick={() => setAddMethod('cookie')}
                      className={clsx('flex-1 py-1.5 flex items-center justify-center gap-1.5 transition-colors',
                        addMethod === 'cookie' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-gray-200'
                      )}
                    >
                      <ClipboardPaste className="w-3 h-3" />
                      貼上 Cookies
                    </button>
                    <button
                      onClick={() => setAddMethod('browser')}
                      className={clsx('flex-1 py-1.5 flex items-center justify-center gap-1.5 transition-colors',
                        addMethod === 'browser' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-gray-200'
                      )}
                    >
                      <Monitor className="w-3 h-3" />
                      本機瀏覽器
                    </button>
                  </div>

                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="帳號名稱（例：主帳號、行銷帳號）"
                    disabled={loginStatus === 'waiting' || loginStatus === 'opening'}
                    className="w-full px-3 py-2 text-xs bg-gray-800 border border-gray-700 rounded text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                  />

                  {addMethod === 'cookie' && (
                    <div className="space-y-2">
                      {/* Step-by-step guide */}
                      <div className="bg-gray-800/60 rounded-lg p-3 space-y-2 text-[11px] text-gray-400">
                        <p className="text-gray-300 font-medium text-xs">取得 Cookies 步驟：</p>
                        <div className="space-y-1.5">
                          <div className="flex items-start gap-2">
                            <span className="text-indigo-400 font-bold flex-shrink-0">1.</span>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span>在瀏覽器開啟 Threads 並登入</span>
                              <a
                                href="https://www.threads.net/login"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300"
                              >
                                開啟 Threads <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-indigo-400 font-bold flex-shrink-0">2.</span>
                            <span>按 <kbd className="px-1 py-0.5 bg-gray-700 rounded text-[10px]">F12</kbd> 開啟開發者工具 → 點 <strong className="text-gray-300">Console</strong></span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-indigo-400 font-bold flex-shrink-0">3.</span>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span>貼上並執行此指令：</span>
                              <div className="flex items-center gap-1 bg-gray-900 rounded px-2 py-0.5 font-mono text-[10px] text-green-400">
                                copy(document.cookie)
                                <button onClick={copyJsCmd} className="text-gray-500 hover:text-gray-300 ml-1">
                                  {cmdCopied ? <CheckCircle2 className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                                </button>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-indigo-400 font-bold flex-shrink-0">4.</span>
                            <span>回到這裡，在下方貼上（Ctrl+V）</span>
                          </div>
                        </div>
                      </div>
                      <textarea
                        value={cookieInput}
                        onChange={(e) => setCookieInput(e.target.value)}
                        placeholder="貼上 Cookies 到這裡..."
                        disabled={loginStatus === 'opening'}
                        rows={3}
                        className="w-full px-3 py-2 text-xs bg-gray-800 border border-gray-700 rounded text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500 disabled:opacity-50 font-mono resize-none"
                      />
                    </div>
                  )}

                  {/* Status display */}
                  {loginStatus !== 'idle' && (
                    <div className={clsx(
                      'flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs',
                      loginStatus === 'success' ? 'bg-green-900/30 border border-green-800/50 text-green-300' :
                      loginStatus === 'failed' ? 'bg-red-900/30 border border-red-800/50 text-red-300' :
                      'bg-indigo-900/20 border border-indigo-800/40 text-indigo-300'
                    )}>
                      {loginStatus === 'waiting' && <RefreshCw className="w-3.5 h-3.5 animate-spin flex-shrink-0" />}
                      {loginStatus === 'success' && <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />}
                      {loginStatus === 'failed' && <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />}
                      {(loginStatus === 'opening') && (addMethod === 'browser' ? <Monitor className="w-3.5 h-3.5 flex-shrink-0" /> : <RefreshCw className="w-3.5 h-3.5 animate-spin flex-shrink-0" />)}
                      <span>{loginMessage}</span>
                    </div>
                  )}

                  <div className="flex gap-2">
                    {addMethod === 'cookie' ? (
                      <button
                        onClick={handleCookieLogin}
                        disabled={!newName.trim() || !cookieInput.trim() || loginStatus === 'opening'}
                        className="flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded transition-colors disabled:opacity-50"
                      >
                        <ClipboardPaste className="w-3.5 h-3.5" />
                        新增帳號
                      </button>
                    ) : (
                      <button
                        onClick={handleOpenBrowserLogin}
                        disabled={!newName.trim() || loginStatus === 'opening' || loginStatus === 'waiting'}
                        className="flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded transition-colors disabled:opacity-50"
                      >
                        <Monitor className="w-3.5 h-3.5" />
                        {loginStatus === 'waiting' ? '等待登入中...' : '開啟瀏覽器登入'}
                      </button>
                    )}
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
