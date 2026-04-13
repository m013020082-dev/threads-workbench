import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Workspace, Keyword, WorkspaceStats } from '../types';
import { listWorkspaces, switchWorkspace } from '../api/client';

interface WorkspaceState {
  workspace: Workspace | null;
  keywords: Keyword[];
  stats: WorkspaceStats | null;
}

export function useWorkspace() {
  const queryClient = useQueryClient();
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [activeWorkspaceData, setActiveWorkspaceData] = useState<WorkspaceState>({
    workspace: null,
    keywords: [],
    stats: null,
  });

  const workspacesQuery = useQuery({
    queryKey: ['workspaces'],
    queryFn: async () => {
      const result = await listWorkspaces();
      return result.workspaces;
    },
    staleTime: 30000,
  });

  const switchMutation = useMutation({
    mutationFn: async (id: string) => switchWorkspace(id),
    onSuccess: (data, id) => {
      setActiveWorkspaceId(id);
      setActiveWorkspaceData({
        workspace: data.workspace,
        keywords: data.keywords as Keyword[],
        stats: data.stats,
      });
      queryClient.invalidateQueries({ queryKey: ['queue', id] });
      queryClient.invalidateQueries({ queryKey: ['posts', id] });
    },
  });

  // 自動選第一個工作區
  useEffect(() => {
    const workspaces = workspacesQuery.data;
    if (!workspaces || workspaces.length === 0) return;
    if (activeWorkspaceId) return;
    if (switchMutation.isPending) return;
    if (switchMutation.isError) return; // 失敗後不自動無限重試
    switchMutation.mutate(workspaces[0].id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspacesQuery.data, activeWorkspaceId]); // 只在資料或選取狀態改變時觸發

  const handleSwitch = useCallback(
    async (id: string) => { await switchMutation.mutateAsync(id); },
    [switchMutation]
  );

  // loading = query 正在抓 OR mutation 正在切換 OR 資料已到但 activeId 尚未設定（render gap）
  const isLoading =
    workspacesQuery.isLoading ||
    switchMutation.isPending ||
    (!activeWorkspaceId && !!workspacesQuery.data?.length && !switchMutation.isError);

  return {
    workspaces: workspacesQuery.data || [],
    isLoading,
    activeWorkspaceId,
    activeWorkspace: activeWorkspaceData.workspace,
    activeKeywords: activeWorkspaceData.keywords,
    activeStats: activeWorkspaceData.stats,
    switchWorkspace: handleSwitch,
    isSwitching: switchMutation.isPending,
    error: workspacesQuery.error,
  };
}
