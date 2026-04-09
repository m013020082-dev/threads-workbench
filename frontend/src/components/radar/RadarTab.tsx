import { MapPin } from 'lucide-react';
import { useRadar } from '../../hooks/useRadar';
import { RadarFilterPanel } from './RadarFilterPanel';
import { RadarCandidateList } from './RadarCandidateList';
import { RadarQueuePanel } from './RadarQueuePanel';
import { RadarCommentSettings } from './RadarCommentSettings';

interface RadarTabProps {
  workspaceId: string | null;
}

export function RadarTab({ workspaceId }: RadarTabProps) {
  const {
    candidates,
    isSearching,
    searchError,
    handleSearch,
    assignAction,
    addToQueue,
    addAllToQueue,
    removeFromQueue,
    batchMarkFollow,
    radarQueue,
    session,
    isStarting,
    isConfirming,
    startExecution,
    confirmExecution,
    cancelExecution,
    isRunningAll,
    startAll,
    stopAll,
    commentSettings,
    setCommentSettings,
    buildCommentText,
  } = useRadar(workspaceId);

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* LEFT — Filter (w-64) */}
      <aside className="w-64 flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col overflow-y-auto">
        <div className="p-4 flex-1">
          {/* Region badge */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">追互追雷達</span>
            </div>
            <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-900/40 border border-blue-700/50 text-blue-300 rounded-full text-xs">
              <MapPin className="w-2.5 h-2.5" />
              台灣地區
            </span>
          </div>

          <RadarFilterPanel
            onSearch={handleSearch}
            isSearching={isSearching}
            activeWorkspaceId={workspaceId}
          />

          <RadarCommentSettings
            settings={commentSettings}
            onChange={setCommentSettings}
          />

          {searchError && (
            <div className="mt-3 px-3 py-2 bg-red-900/20 border border-red-800 rounded text-red-400 text-xs">
              {searchError}
            </div>
          )}
        </div>
      </aside>

      {/* CENTER — Candidate List (flex-1) */}
      <main className="flex-1 flex flex-col overflow-hidden bg-gray-950">
        <RadarCandidateList
          candidates={candidates}
          isLoading={isSearching}
          radarQueue={radarQueue}
          commentTemplate={buildCommentText()}
          onAssignAction={assignAction}
          onAddToQueue={addToQueue}
          onAddAllToQueue={addAllToQueue}
        />
      </main>

      {/* RIGHT — Queue + Execution (w-72) */}
      <aside className="w-72 flex-shrink-0 bg-gray-900 border-l border-gray-800 flex flex-col overflow-y-auto p-4">
        <RadarQueuePanel
          radarQueue={radarQueue}
          onRemove={removeFromQueue}
          onBatchMarkFollow={batchMarkFollow}
          onExecute={startExecution}
          onConfirm={confirmExecution}
          onCancel={cancelExecution}
          session={session}
          isStarting={isStarting}
          isConfirming={isConfirming}
          isRunningAll={isRunningAll}
          onStartAll={() => startAll(radarQueue)}
          onStopAll={stopAll}
        />
      </aside>
    </div>
  );
}
