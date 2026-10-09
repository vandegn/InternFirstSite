'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  archiveApplication,
  getArchivedApplications,
  restoreApplication,
} from '@/lib/supabase';

// Archive / restore for the student's My Applications views — the dashboard
// home list and the full page share this so they behave identically and read
// the same persisted state (student_application_archives).
//
// Every action is optimistic: the row moves immediately, the write runs, and
// a failure puts the row back where it was and says so. One request per
// application at a time — a second click while one is in flight is ignored.

export type ArchiveToast = {
  id: number;
  tone: 'success' | 'error';
  message: string;
  // Present on success: reverses the action that produced this toast.
  undo?: () => void;
};

export type ArchiveLoadState = 'idle' | 'loading' | 'ready' | 'error';

export function useApplicationArchive(studentId: string | null) {
  const [archivedAt, setArchivedAt] = useState<Record<string, string>>({});
  const [loadState, setLoadState] = useState<ArchiveLoadState>('idle');
  const [loadError, setLoadError] = useState('');
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const [toast, setToast] = useState<ArchiveToast | null>(null);

  // Refs mirror the state the async handlers need, so a handler that started
  // before a re-render still sees the current values.
  const pendingRef = useRef(new Set<string>());
  const archivedRef = useRef<Record<string, string>>({});
  const toastSeq = useRef(0);

  const commit = useCallback((next: Record<string, string>) => {
    archivedRef.current = next;
    setArchivedAt(next);
  }, []);

  const reload = useCallback(async () => {
    if (!studentId) return;
    setLoadState('loading');
    setLoadError('');
    try {
      commit(await getArchivedApplications(studentId));
      setLoadState('ready');
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'We couldn’t load your archived applications.');
      setLoadState('error');
    }
  }, [studentId, commit]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const showToast = useCallback((t: Omit<ArchiveToast, 'id'>) => {
    toastSeq.current += 1;
    setToast({ ...t, id: toastSeq.current });
  }, []);

  const dismissToast = useCallback(() => setToast(null), []);

  const setArchived = useCallback(
    async (
      applicationId: string,
      archive: boolean,
      messages: { success: string; undoSuccess: string },
    ): Promise<void> => {
      if (!studentId || pendingRef.current.has(applicationId)) return;
      pendingRef.current.add(applicationId);
      setPendingIds(Array.from(pendingRef.current));

      const previous = archivedRef.current;
      const optimistic = { ...previous };
      if (archive) optimistic[applicationId] = new Date().toISOString();
      else delete optimistic[applicationId];
      commit(optimistic);

      try {
        if (archive) {
          const stamp = await archiveApplication(studentId, applicationId);
          commit({ ...archivedRef.current, [applicationId]: stamp });
        } else {
          await restoreApplication(applicationId);
        }
        showToast({
          tone: 'success',
          message: messages.success,
          undo: () => {
            void setArchived(applicationId, !archive, {
              success: messages.undoSuccess,
              undoSuccess: messages.success,
            });
          },
        });
      } catch (err) {
        // Put back exactly this row's prior state; other rows may have changed
        // while the request was in flight.
        const reverted = { ...archivedRef.current };
        if (previous[applicationId]) reverted[applicationId] = previous[applicationId];
        else delete reverted[applicationId];
        commit(reverted);
        showToast({
          tone: 'error',
          message: err instanceof Error ? err.message : 'Something went wrong. Please try again.',
        });
      } finally {
        pendingRef.current.delete(applicationId);
        setPendingIds(Array.from(pendingRef.current));
      }
    },
    [studentId, commit, showToast],
  );

  const archive = useCallback(
    (applicationId: string, title: string) =>
      setArchived(applicationId, true, {
        success: `Archived “${title}”.`,
        undoSuccess: `Restored “${title}”.`,
      }),
    [setArchived],
  );

  const restore = useCallback(
    (applicationId: string, title: string, destination: string) =>
      setArchived(applicationId, false, {
        success: `Restored “${title}” to ${destination}.`,
        undoSuccess: `Archived “${title}”.`,
      }),
    [setArchived],
  );

  return {
    archivedAt,
    loadState,
    loadError,
    reload,
    archive,
    restore,
    isPending: (applicationId: string) => pendingIds.includes(applicationId),
    toast,
    dismissToast,
  };
}
