import { Radio, ListPlus } from 'lucide-react';
import { RadarCandidate, RadarAction, RadarQueueItem } from '../../types';
import { RadarCandidateCard } from './RadarCandidateCard';

interface Props {
  candidates: RadarCandidate[];
  isLoading: boolean;
  radarQueue: RadarQueueItem[];
  commentTemplate: string;
  onAssignAction: (postId: string, action: RadarAction) => void;
  onAddToQueue: (candidate: RadarCandidate, draftText?: string) => void;
  onAddAllToQueue: () => void;
}

export function RadarCandidateList({ candidates, isLoading, radarQueue, commentTemplate, onAssignAction, onAddToQueue, onAddAllToQueue }: Props) {
  const queuedIds = new Set(radarQueue.map(i => i.candidate.post.id));
  const withAction = candidates.filter(c => c.selectedAction && !queuedIds.has(c.post.id));

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-gray-800 border border-gray-700 rounded-lg p-3 animate-pulse">
            <div className="flex gap-2 mb-2">
              <div className="w-7 h-7 rounded-full bg-gray-700" />
              <div className="flex-1 space-y-1">
                <div className="h-3 bg-gray-700 rounded w-24" />
                <div className="h-2 bg-gray-700 rounded w-16" />
              </div>
            </div>
            <div className="h-3 bg-gray-700 rounded w-full mb-1" />
            <div className="h-3 bg-gray-700 rounded w-3/4" />
          </div>
        ))}
      </div>
    );
  }

  if (candidates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gray-800 flex items-center justify-center mb-4">
          <Radio className="w-8 h-8 text-gray-600" />
        </div>
        <h3 className="text-base font-semibold text-gray-400 mb-1">尚無候選人</h3>
        <p className="text-xs text-gray-600 max-w-xs">輸入關鍵字並點擊「雷達掃描」，找出適合互追的 Threads 用戶</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-indigo-400" />
          <span className="text-sm font-semibold text-gray-300">候選人清單</span>
          <span className="px-1.5 py-0.5 bg-gray-800 text-gray-400 rounded-full text-xs">{candidates.length}</span>
        </div>
        {withAction.length > 0 && (
          <button
            onClick={onAddAllToQueue}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-700/60 hover:bg-indigo-600/60 border border-indigo-600/50 text-indigo-300 rounded-lg text-xs font-medium transition-colors"
          >
            <ListPlus className="w-3.5 h-3.5" />
            全部加入佇列（{withAction.length}）
          </button>
        )}
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {candidates.map(candidate => (
          <RadarCandidateCard
            key={candidate.post.id}
            candidate={candidate}
            inQueue={queuedIds.has(candidate.post.id)}
            commentTemplate={commentTemplate}
            onAssignAction={onAssignAction}
            onAddToQueue={onAddToQueue}
          />
        ))}
      </div>
    </div>
  );
}
