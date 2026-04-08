import { useState } from 'react';
import { ChevronDown, Plus, Briefcase, Check } from 'lucide-react';
import clsx from 'clsx';
import { Workspace } from '../types';

interface WorkspaceSwitcherProps {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  onSwitch: (id: string) => Promise<void>;
  onCreate: (name: string, brandVoice: string, keywords?: string[]) => Promise<unknown>;
  isSwitching: boolean;
  isCreating: boolean;
}

export function WorkspaceSwitcher({
  workspaces,
  activeWorkspace,
  onSwitch,
  onCreate,
  isSwitching,
  isCreating,
}: WorkspaceSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newBrandVoice, setNewBrandVoice] = useState('');
  const [newKeywords, setNewKeywords] = useState('');
  const [createError, setCreateError] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      setCreateError('請輸入工作區名稱');
      return;
    }
    setCreateError('');
    try {
      const keywords = newKeywords
        .split(',')
        .map((k) => k.trim())
        .filter((k) => k.length > 0);
      await onCreate(newName.trim(), newBrandVoice.trim(), keywords);
      setNewName('');
      setNewBrandVoice('');
      setNewKeywords('');
      setShowCreateForm(false);
      setIsOpen(false);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : '建立工作區失敗');
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
          'bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-200'
        )}
      >
        <Briefcase className="w-4 h-4 text-indigo-400" />
        <span className="max-w-[140px] truncate">
          {activeWorkspace ? activeWorkspace.name : '選擇工作區'}
        </span>
        <ChevronDown className={clsx('w-4 h-4 text-gray-400 transition-transform', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-72 bg-gray-800 border border-gray-700 rounded-lg shadow-2xl z-50">
          <div className="p-2 max-h-64 overflow-y-auto">
            {workspaces.length === 0 ? (
              <p className="text-gray-500 text-sm px-3 py-2">尚無工作區</p>
            ) : (
              workspaces.map((ws) => (
                <button
                  key={ws.id}
                  onClick={async () => {
                    await onSwitch(ws.id);
                    setIsOpen(false);
                  }}
                  disabled={isSwitching}
                  className={clsx(
                    'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-left transition-colors',
                    activeWorkspace?.id === ws.id
                      ? 'bg-indigo-900/50 text-indigo-300'
                      : 'text-gray-300 hover:bg-gray-700'
                  )}
                >
                  <Briefcase className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="flex-1 truncate">{ws.name}</span>
                  {activeWorkspace?.id === ws.id && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                </button>
              ))
            )}
          </div>

          <div className="border-t border-gray-700 p-2">
            {!showCreateForm ? (
              <button
                onClick={() => setShowCreateForm(true)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-indigo-400 hover:bg-gray-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                新建工作區
              </button>
            ) : (
              <form onSubmit={handleCreate} className="p-1 space-y-2">
                <div>
                  <input
                    type="text"
                    placeholder="工作區名稱 *"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full px-2 py-1.5 text-sm bg-gray-900 border border-gray-600 rounded text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                    autoFocus
                  />
                </div>
                <div>
                  <textarea
                    placeholder="品牌語氣（如：友善、專業、科技感）"
                    value={newBrandVoice}
                    onChange={(e) => setNewBrandVoice(e.target.value)}
                    rows={2}
                    className="w-full px-2 py-1.5 text-sm bg-gray-900 border border-gray-600 rounded text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500 resize-none"
                  />
                </div>
                <div>
                  <input
                    type="text"
                    placeholder="關鍵字（以逗號分隔）"
                    value={newKeywords}
                    onChange={(e) => setNewKeywords(e.target.value)}
                    className="w-full px-2 py-1.5 text-sm bg-gray-900 border border-gray-600 rounded text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                {createError && <p className="text-red-400 text-xs">{createError}</p>}
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={isCreating}
                    className="flex-1 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded transition-colors disabled:opacity-50"
                  >
                    {isCreating ? '建立中...' : '建立'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateForm(false);
                      setCreateError('');
                    }}
                    className="flex-1 py-1.5 text-xs font-medium bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
                  >
                    取消
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
