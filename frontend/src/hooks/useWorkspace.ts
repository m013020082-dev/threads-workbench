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
    switchMutation.mutate(workspaces[0].id);
  }, [workspacesQuery.data, activeWorkspaceId]);

  const handleSwitch = useCallback(
    async (id: string) => { await switchMutation.mutateAsync(id); },
    [switchMutation]
  );

  return {
    workspaces: workspacesQuery.data || [],
    isLoading: workspacesQuery.isLoading,
    activeWorkspaceId,
    activeWorkspace: activeWorkspaceData.workspace,
    activeKeywords: activeWorkspaceData.keywords,
    activeStats: activeWorkspaceData.stats,
    switchWorkspace: handleSwitch,
    isSwitching: switchMutation.isPending,
    error: workspacesQuery.error,
  };
}
