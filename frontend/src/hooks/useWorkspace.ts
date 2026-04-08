import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Workspace, Keyword, WorkspaceStats } from '../types';
import { listWorkspaces, createWorkspace, switchWorkspace } from '../api/client';

interface WorkspaceState {
  workspace: Workspace | null;
  keywords: Keyword[];
  stats: WorkspaceStats | null;
}

export function useWorkspace() {
  const queryClient = useQueryClient();
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(
    localStorage.getItem('activeWorkspaceId')
  );
  const [activeWorkspaceData, setActiveWorkspaceData] = useState<WorkspaceState>({
    workspace: null,
    keywords: [],
    stats: null,
  });

  // List all workspaces
  const workspacesQuery = useQuery({
    queryKey: ['workspaces'],
    queryFn: async () => {
      const result = await listWorkspaces();
      return result.workspaces;
    },
    staleTime: 30000,
  });

  // Create workspace mutation
  const createMutation = useMutation({
    mutationFn: async ({
      name,
      brandVoice,
      keywords,
    }: {
      name: string;
      brandVoice: string;
      keywords?: string[];
    }) => {
      return createWorkspace(name, brandVoice, keywords);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
    },
  });

  // Switch workspace
  const switchMutation = useMutation({
    mutationFn: async (id: string) => {
      return switchWorkspace(id);
    },
    onSuccess: (data, id) => {
      setActiveWorkspaceId(id);
      localStorage.setItem('activeWorkspaceId', id);
      setActiveWorkspaceData({
        workspace: data.workspace,
        keywords: data.keywords as Keyword[],
        stats: data.stats,
      });
      queryClient.invalidateQueries({ queryKey: ['queue', id] });
      queryClient.invalidateQueries({ queryKey: ['posts', id] });
    },
  });

  const handleSwitch = useCallback(
    async (id: string) => {
      await switchMutation.mutateAsync(id);
    },
    [switchMutation]
  );

  const handleCreate = useCallback(
    async (name: string, brandVoice: string, keywords?: string[]) => {
      const result = await createMutation.mutateAsync({ name, brandVoice, keywords });
      // Auto-switch to new workspace
      if (result.workspace) {
        await handleSwitch(result.workspace.id);
      }
      return result;
    },
    [createMutation, handleSwitch]
  );

  return {
    workspaces: workspacesQuery.data || [],
    isLoading: workspacesQuery.isLoading,
    activeWorkspaceId,
    activeWorkspace: activeWorkspaceData.workspace,
    activeKeywords: activeWorkspaceData.keywords,
    activeStats: activeWorkspaceData.stats,
    switchWorkspace: handleSwitch,
    createWorkspace: handleCreate,
    isSwitching: switchMutation.isPending,
    isCreating: createMutation.isPending,
    error: workspacesQuery.error || switchMutation.error || createMutation.error,
  };
}
