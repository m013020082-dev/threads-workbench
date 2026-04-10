import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Post, Draft } from '../types';
import { getQueue, skipPost, approveDraft, approveAll, batchFollow, clearQueue, getSentPosts, getFollowedAccounts, FollowedRecord } from '../api/client';

export function useQueue(workspaceId: string | null) {
  const queryClient = useQueryClient();

  const queueQuery = useQuery({
    queryKey: ['queue', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return { queue: [], count: 0 };
      return getQueue(workspaceId);
    },
    enabled: !!workspaceId,
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 10000,
  });

  const skipMutation = useMutation({
    mutationFn: async (postId: string) => {
      return skipPost(postId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue', workspaceId] });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (draftId: string) => {
      return approveDraft(draftId);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['queue', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['drafts', data.draft.post_id] });
    },
  });

  const approveAllMutation = useMutation({
    mutationFn: async () => {
      if (!workspaceId) throw new Error('No workspace selected');
      return approveAll(workspaceId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue', workspaceId] });
    },
  });

  const batchFollowMutation = useMutation({
    mutationFn: async (postIds: string[]) => {
      return batchFollow(postIds);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue', workspaceId] });
    },
  });

  const clearQueueMutation = useMutation({
    mutationFn: async () => {
      if (!workspaceId) throw new Error('No workspace selected');
      return clearQueue(workspaceId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue', workspaceId] });
    },
  });

  const followedQuery = useQuery({
    queryKey: ['followed', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return { followed: [] as FollowedRecord[], count: 0 };
      return getFollowedAccounts(workspaceId);
    },
    enabled: !!workspaceId,
    refetchInterval: 30000,
    staleTime: 0,
  });

  const sentQuery = useQuery({
    queryKey: ['sent', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return { sent: [], count: 0 };
      return getSentPosts(workspaceId);
    },
    enabled: !!workspaceId,
    refetchInterval: 30000,
    staleTime: 0,
  });

  const getApprovedDraft = (post: Post): Draft | undefined => {
    return post.drafts?.find((d) => d.approved);
  };

  const getBestDraft = (post: Post): Draft | undefined => {
    if (!post.drafts || post.drafts.length === 0) return undefined;
    const approved = post.drafts.find((d) => d.approved);
    if (approved) return approved;
    // Return draft with fewest warnings
    return post.drafts.reduce((best, draft) => {
      const bestWarnings = best.risk_warnings?.length || 0;
      const draftWarnings = draft.risk_warnings?.length || 0;
      return draftWarnings < bestWarnings ? draft : best;
    });
  };

  return {
    queue: queueQuery.data?.queue || [],
    count: queueQuery.data?.count || 0,
    isLoading: queueQuery.isLoading,
    isRefetching: queueQuery.isRefetching,
    error: queueQuery.error,
    skipPost: skipMutation.mutateAsync,
    isSkipping: skipMutation.isPending,
    approveDraft: approveMutation.mutateAsync,
    isApproving: approveMutation.isPending,
    getApprovedDraft,
    getBestDraft,
    refetch: queueQuery.refetch,
    approveAll: approveAllMutation.mutateAsync,
    isApprovingAll: approveAllMutation.isPending,
    batchFollow: batchFollowMutation.mutateAsync,
    isBatchFollowing: batchFollowMutation.isPending,
    clearQueue: clearQueueMutation.mutateAsync,
    isClearing: clearQueueMutation.isPending,
    sentPosts: sentQuery.data?.sent || [],
    sentCount: sentQuery.data?.count || 0,
    refetchSent: sentQuery.refetch,
    followedAccounts: followedQuery.data?.followed || [],
    followedCount: followedQuery.data?.count || 0,
    refetchFollowed: followedQuery.refetch,
  };
}
