import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ExecutionSession,
  getExecutionStatus,
  startExecution,
  confirmExecution,
  cancelExecution,
} from '../api/client';

export type ExecutionMode = 'manual' | 'semi-auto';

const MODE_KEY = 'executionMode';

export function useExecution(workspaceId: string | null) {
  const queryClient = useQueryClient();
  const [mode, setModeState] = useState<ExecutionMode>(
    () => (localStorage.getItem(MODE_KEY) as ExecutionMode) || 'manual'
  );
  const [session, setSession] = useState<ExecutionSession | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  const setMode = (m: ExecutionMode) => {
    setModeState(m);
    localStorage.setItem(MODE_KEY, m);
  };

  // Poll execution status when a session might be active
  // Bug #14：涵蓋所有終止狀態（confirmed / cancelled / error）
  useEffect(() => {
    const terminalStatuses = ['confirmed', 'cancelled', 'error'];
    if (!session || terminalStatuses.includes(session.status)) return;
    const interval = setInterval(async () => {
      try {
        const { session: s } = await getExecutionStatus();
        setSession(s);
        if (s && terminalStatuses.includes(s.status)) {
          clearInterval(interval);
        }
      } catch {}
    }, 2000);
    return () => clearInterval(interval);
  }, [session?.status]);

  const start = useCallback(async (postId: string, draftId: string) => {
    setIsStarting(true);
    try {
      const { session: s } = await startExecution(postId, draftId);
      setSession(s);
    } finally {
      setIsStarting(false);
    }
  }, []);

  const confirm = useCallback(async () => {
    setIsConfirming(true);
    try {
      await confirmExecution();
      setSession(null);
      queryClient.invalidateQueries({ queryKey: ['queue', workspaceId] });
    } finally {
      setIsConfirming(false);
    }
  }, [workspaceId, queryClient]);

  const cancel = useCallback(async () => {
    await cancelExecution();
    setSession(null);
  }, []);

  return {
    mode,
    setMode,
    session,
    isStarting,
    isConfirming,
    start,
    confirm,
    cancel,
  };
}
