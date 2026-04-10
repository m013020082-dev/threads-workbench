import { useState, useCallback, useRef } from 'react';
import { RankingResult, RadarCandidate, RadarQueueItem, RadarAction } from '../types';
import type { CommentSettings } from '../components/radar/RadarCommentSettings';
import {
  searchPosts,
  generateDrafts,
  ExecutionSession,
  RadarActionType,
  startRadarExecution,
  confirmRadarExecution,
  cancelRadarExecution,
  getRadarExecutionStatus,
  radarExecuteDirect,
} from '../api/client';

export type ExecutionMode = 'manual' | 'semi-auto';
const MODE_KEY = 'radarExecutionMode';
const COMMENT_SETTINGS_KEY = 'radarCommentSettings';

const DEFAULT_COMMENT_SETTINGS: CommentSettings = { followPhrase: '已追！', selfPromo: '' };

function loadCommentSettings(): CommentSettings {
  try {
    const raw = localStorage.getItem(COMMENT_SETTINGS_KEY);
    if (raw) return { ...DEFAULT_COMMENT_SETTINGS, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_COMMENT_SETTINGS;
}

export function useRadar(workspaceId: string | null) {
  const [candidates, setCandidates] = useState<RadarCandidate[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [radarQueue, setRadarQueue] = useState<RadarQueueItem[]>([]);
  const [executionMode, setExecutionModeState] = useState<ExecutionMode>(
    () => (localStorage.getItem(MODE_KEY) as ExecutionMode) || 'manual'
  );
  const [session, setSession] = useState<ExecutionSession | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [replyingIds, setReplyingIds] = useState<Set<string>>(new Set());
  const stopAllRef = useRef(false);
  const [commentSettings, setCommentSettingsState] = useState<CommentSettings>(loadCommentSettings);

  const setCommentSettings = useCallback((s: CommentSettings) => {
    setCommentSettingsState(s);
    localStorage.setItem(COMMENT_SETTINGS_KEY, JSON.stringify(s));
  }, []);

  const buildCommentText = useCallback(() => {
    const { followPhrase, selfPromo } = commentSettings;
    return [followPhrase, selfPromo].filter(Boolean).join('\n');
  }, [commentSettings]);

  const setExecutionMode = (m: ExecutionMode) => {
    setExecutionModeState(m);
    localStorage.setItem(MODE_KEY, m);
  };

  const handleSearch = useCallback(
    async (params: { keywords: string[]; time_range: '1h' | '6h' | '24h' | '7d'; min_followers?: number; max_followers?: number; min_engagement?: number; search_mode?: 'fuzzy' | 'precise' }) => {
      if (!workspaceId) { setSearchError('請先選擇工作區'); return; }
      setIsSearching(true);
      setSearchError(null);
      try {
        const result = await searchPosts({
          ...params,
          workspace_id: workspaceId,
          engagement_threshold: params.min_engagement || 0,
        });
        const mapped: RadarCandidate[] = result.results.map((r: RankingResult) => ({
          post: r.post,
          followScore: Math.round(r.score),
          keywordMatches: r.keyword_matches,
        }));
        setCandidates(mapped);
      } catch (err) {
        setSearchError(err instanceof Error ? err.message : '搜尋失敗');
        setCandidates([]);
      } finally {
        setIsSearching(false);
      }
    },
    [workspaceId]
  );

  const assignAction = useCallback((postId: string, action: RadarAction) => {
    const commentText = buildCommentText();
    setCandidates(prev => prev.map(c =>
      c.post.id === postId
        ? { ...c, selectedAction: c.selectedAction === action ? undefined : action }
        : c
    ));
    // 同步更新佇列中的動作與留言文字
    setRadarQueue(prev => prev.map(item => {
      if (item.candidate.post.id !== postId) return item;
      const needsComment = action === 'comment' || action === 'both';
      return {
        ...item,
        action,
        candidate: { ...item.candidate, selectedAction: action },
        draftText: needsComment ? (item.draftText || commentText) : item.draftText,
      };
    }));
  }, [buildCommentText]);

  const addToQueue = useCallback((candidate: RadarCandidate, draftText?: string) => {
    if (!candidate.selectedAction) return;
    setRadarQueue(prev => {
      if (prev.some(item => item.candidate.post.id === candidate.post.id)) return prev;
      return [...prev, {
        candidate,
        action: candidate.selectedAction!,
        draftText,
      }];
    });
  }, []);

  const addAllToQueue = useCallback(() => {
    const withAction = candidates.filter(c => c.selectedAction);
    const commentText = buildCommentText();
    setRadarQueue(prev => {
      const existingIds = new Set(prev.map(i => i.candidate.post.id));
      const newItems = withAction
        .filter(c => !existingIds.has(c.post.id))
        .map(c => ({
          candidate: c,
          action: c.selectedAction!,
          draftText: (c.selectedAction === 'comment' || c.selectedAction === 'both') ? commentText : undefined,
        }));
      return [...prev, ...newItems];
    });
  }, [candidates, buildCommentText]);

  const removeFromQueue = useCallback((postId: string) => {
    setRadarQueue(prev => prev.filter(item => item.candidate.post.id !== postId));
  }, []);

  const clearQueue = useCallback(() => setRadarQueue([]), []);

  const updateQueueDraftText = useCallback((postId: string, text: string) => {
    setRadarQueue(prev => prev.map(item =>
      item.candidate.post.id === postId ? { ...item, draftText: text } : item
    ));
  }, []);

  // 批次升級為「兩者」：將佇列所有項目改為 both，並補上留言文字
  const batchMarkFollow = useCallback(() => {
    const commentText = buildCommentText();
    setRadarQueue(prev => prev.map(item => ({
      ...item,
      action: 'both' as RadarAction,
      candidate: { ...item.candidate, selectedAction: 'both' as RadarAction },
      draftText: item.draftText || commentText,
    })));
  }, [buildCommentText]);

  // 生成留言草稿（用於 comment / both）
  const generateDraftForItem = useCallback(async (
    item: RadarQueueItem,
    postingLogic: string,
    replyNote: string,
    brandVoice: string
  ): Promise<string> => {
    if (!workspaceId) throw new Error('No workspace');
    const result = await generateDrafts(
      item.candidate.post.id,
      item.candidate.post.post_text,
      'comment',
      brandVoice,
      workspaceId,
      'short',
      false,
      postingLogic,
      replyNote
    );
    const draftText = result.drafts[0]?.draft_text || '';
    // 更新佇列中的 draftText
    setRadarQueue(prev => prev.map(q =>
      q.candidate.post.id === item.candidate.post.id
        ? { ...q, draftText }
        : q
    ));
    return draftText;
  }, [workspaceId]);

  // 半自動執行
  const startExecution = useCallback(async (item: RadarQueueItem) => {
    setIsStarting(true);
    try {
      const { session: s } = await startRadarExecution(
        item.candidate.post.id,
        null,
        item.action as RadarActionType,
        item.candidate.post.author_handle,
        item.draftText
      );
      setSession(s);
    } finally {
      setIsStarting(false);
    }
  }, []);

  const confirmExecution = useCallback(async () => {
    setIsConfirming(true);
    try {
      await confirmRadarExecution();
      setSession(null);
      // 從佇列移除已執行的
      if (session?.postId) {
        setRadarQueue(prev => prev.filter(i => i.candidate.post.id !== session.postId));
      }
    } finally {
      setIsConfirming(false);
    }
  }, [session]);

  const cancelExecution = useCallback(async () => {
    await cancelRadarExecution();
    setSession(null);
  }, []);

  // 一鍵全部執行：依序 headless 執行佇列中每個項目，不開視窗
  const startAll = useCallback(async (currentQueue: RadarQueueItem[]) => {
    if (currentQueue.length === 0) return;
    stopAllRef.current = false;
    setIsRunningAll(true);
    try {
      for (const item of currentQueue) {
        if (stopAllRef.current) break;
        const postId = item.candidate.post.id;
        setReplyingIds(prev => new Set(prev).add(postId));
        try {
          const result = await radarExecuteDirect(
            postId,
            item.action as RadarActionType,
            item.candidate.post.author_handle,
            item.draftText
          );
          if (result.success) {
            setRadarQueue(prev => prev.filter(i => i.candidate.post.id !== postId));
          } else {
            console.warn(`[Radar] 項目失敗: ${item.candidate.post.author_handle} — ${result.error}`);
          }
        } finally {
          setReplyingIds(prev => { const s = new Set(prev); s.delete(postId); return s; });
        }
      }
    } finally {
      setIsRunningAll(false);
      stopAllRef.current = false;
    }
  }, []);

  const stopAll = useCallback(() => {
    stopAllRef.current = true;
  }, []);

  // 直接執行（headless，不開瀏覽器視窗）：留言 / 追蹤 / 兩者
  const replyDirect = useCallback(async (item: RadarQueueItem): Promise<{ success: boolean; error?: string }> => {
    const postId = item.candidate.post.id;
    const needsComment = item.action === 'comment' || item.action === 'both';
    if (needsComment && !item.draftText) return { success: false, error: '留言內容為空' };
    setReplyingIds(prev => new Set(prev).add(postId));
    try {
      const result = await radarExecuteDirect(
        postId,
        item.action as RadarActionType,
        item.candidate.post.author_handle,
        item.draftText
      );
      if (result.success) {
        setRadarQueue(prev => prev.filter(i => i.candidate.post.id !== postId));
      }
      return result;
    } finally {
      setReplyingIds(prev => { const s = new Set(prev); s.delete(postId); return s; });
    }
  }, []);

  return {
    candidates,
    isSearching,
    searchError,
    handleSearch,
    assignAction,
    addToQueue,
    addAllToQueue,
    removeFromQueue,
    clearQueue,
    updateQueueDraftText,
    batchMarkFollow,
    generateDraftForItem,
    radarQueue,
    executionMode,
    setExecutionMode,
    session,
    isStarting,
    isConfirming,
    isRunningAll,
    startExecution,
    confirmExecution,
    cancelExecution,
    startAll,
    stopAll,
    replyDirect,
    replyingIds,
    commentSettings,
    setCommentSettings,
    buildCommentText,
  };
}
