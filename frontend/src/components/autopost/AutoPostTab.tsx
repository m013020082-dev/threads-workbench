import { useState, useEffect } from 'react';
import {
  LayoutDashboard, Users, PenSquare, Clock, History,
  TrendingUp, Bot, Settings, ChevronRight,
} from 'lucide-react';
import clsx from 'clsx';
import { DashboardPage } from './DashboardPage';
import { AccountsPage } from './AccountsPage';
import { ComposePage } from './ComposePage';
import { ScheduledPage } from './ScheduledPage';
import { HistoryPage } from './HistoryPage';
import { TrendingPage } from './TrendingPage';
import { AIDraftsPage } from './AIDraftsPage';
import { BrandProfilePage } from './BrandProfilePage';
import { getAutoDrafts, AutoDraft } from '../../api/client';

type Page = 'dashboard' | 'accounts' | 'compose' | 'scheduled' | 'history' | 'trending' | 'ai-drafts' | 'brand-profile';

interface Props { workspaceId: string; }

const navItems: { id: Page; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'dashboard', label: '總覽', icon: LayoutDashboard },
  { id: 'accounts', label: 'Threads 帳號', icon: Users },
  { id: 'compose', label: '撰寫發文', icon: PenSquare },
  { id: 'scheduled', label: '排程發文', icon: Clock },
  { id: 'history', label: '發文歷史', icon: History },
  { id: 'trending', label: '熱門話題', icon: TrendingUp },
  { id: 'ai-drafts', label: 'AI 草稿管理', icon: Bot },
  { id: 'brand-profile', label: '品牌設定', icon: Settings },
];

export function AutoPostTab({ workspaceId }: Props) {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [composeTopic, setComposeTopic] = useState('');
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (!workspaceId) return;

    const fetchPending = () => {
      getAutoDrafts(workspaceId)
        .then(r => {
          const count = r.drafts.filter((d: AutoDraft) => d.status === 'pending_review').length;
          setPendingCount(count);
        })
        .catch(() => {});
    };

    fetchPending();
    const interval = setInterval(fetchPending, 30000);
    return () => clearInterval(interval);
  }, [workspaceId]);

  const handleNavigate = (page: string) => {
    setCurrentPage(page as Page);
  };

  const handleUseTopic = (topic: string) => {
    setComposeTopic(topic);
    setCurrentPage('compose');
  };

  if (!workspaceId) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-600">
        <p className="text-sm">請先選擇工作區</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Sidebar */}
      <aside className="w-52 flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col py-4">
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => setCurrentPage(item.id)}
            className={clsx(
              'flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left group',
              currentPage === item.id
                ? 'bg-indigo-600/20 text-indigo-300 border-r-2 border-indigo-500'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
            )}
          >
            <item.icon className={clsx('w-4 h-4 flex-shrink-0', currentPage === item.id ? 'text-indigo-400' : 'text-gray-500 group-hover:text-gray-400')} />
            <span className="flex-1 truncate">{item.label}</span>
            {item.id === 'ai-drafts' && pendingCount > 0 && (
              <span className="ml-auto px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-full font-bold min-w-[18px] text-center">
                {pendingCount}
              </span>
            )}
            {currentPage === item.id && <ChevronRight className="w-3 h-3 text-indigo-400 flex-shrink-0" />}
          </button>
        ))}
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-gray-950">
        {currentPage === 'dashboard' && (
          <DashboardPage workspaceId={workspaceId} onNavigate={handleNavigate} />
        )}
        {currentPage === 'accounts' && (
          <AccountsPage workspaceId={workspaceId} />
        )}
        {currentPage === 'compose' && (
          <ComposePage workspaceId={workspaceId} initialTopic={composeTopic} />
        )}
        {currentPage === 'scheduled' && (
          <ScheduledPage workspaceId={workspaceId} />
        )}
        {currentPage === 'history' && (
          <HistoryPage workspaceId={workspaceId} />
        )}
        {currentPage === 'trending' && (
          <TrendingPage workspaceId={workspaceId} onUseTopic={handleUseTopic} />
        )}
        {currentPage === 'ai-drafts' && (
          <AIDraftsPage workspaceId={workspaceId} />
        )}
        {currentPage === 'brand-profile' && (
          <BrandProfilePage workspaceId={workspaceId} />
        )}
      </main>
    </div>
  );
}
