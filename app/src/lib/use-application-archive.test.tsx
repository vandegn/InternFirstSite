import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const getArchivedApplications = vi.fn();
const archiveApplication = vi.fn();
const restoreApplication = vi.fn();
vi.mock('@/lib/supabase', () => ({
  getArchivedApplications: (...a: unknown[]) => getArchivedApplications(...a),
  archiveApplication: (...a: unknown[]) => archiveApplication(...a),
  restoreApplication: (...a: unknown[]) => restoreApplication(...a),
}));

import { useApplicationArchive } from './use-application-archive';
import ApplicationRowAction from '@/components/ApplicationRowAction';

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.clearAllMocks();
  getArchivedApplications.mockResolvedValue({ 'app-old': '2026-10-01T00:00:00Z' });
});

async function loaded() {
  const hook = renderHook(() => useApplicationArchive('student-1'));
  await waitFor(() => expect(hook.result.current.loadState).toBe('ready'));
  return hook;
}

describe('useApplicationArchive', () => {
  it('loads the persisted archive for the student', async () => {
    const { result } = await loaded();
    expect(getArchivedApplications).toHaveBeenCalledWith('student-1');
    expect(result.current.archivedAt).toEqual({ 'app-old': '2026-10-01T00:00:00Z' });
  });

  it('reports a load failure instead of pretending nothing is archived', async () => {
    getArchivedApplications.mockRejectedValueOnce(new Error('We couldn’t load your archived applications.'));
    const { result } = renderHook(() => useApplicationArchive('student-1'));
    await waitFor(() => expect(result.current.loadState).toBe('error'));
    expect(result.current.loadError).toMatch(/couldn’t load/);
  });

  it('archives optimistically, persists, and offers Undo', async () => {
    const write = deferred<string>();
    archiveApplication.mockReturnValueOnce(write.promise);
    const { result } = await loaded();

    act(() => { void result.current.archive('app-1', 'Data Analyst Intern'); });
    expect(result.current.archivedAt['app-1']).toBeTruthy(); // moved before the write lands
    expect(result.current.isPending('app-1')).toBe(true);

    await act(async () => { write.resolve('2026-10-09T10:00:00Z'); });
    expect(archiveApplication).toHaveBeenCalledWith('student-1', 'app-1');
    expect(result.current.archivedAt['app-1']).toBe('2026-10-09T10:00:00Z');
    expect(result.current.isPending('app-1')).toBe(false);
    expect(result.current.toast).toMatchObject({ tone: 'success', message: 'Archived “Data Analyst Intern”.' });

    restoreApplication.mockResolvedValueOnce(undefined);
    await act(async () => { result.current.toast?.undo?.(); });
    expect(restoreApplication).toHaveBeenCalledWith('app-1');
    expect(result.current.archivedAt['app-1']).toBeUndefined();
  });

  it('ignores a second click while the first request is in flight', async () => {
    const write = deferred<string>();
    archiveApplication.mockReturnValue(write.promise);
    const { result } = await loaded();

    act(() => {
      void result.current.archive('app-1', 'Role');
      void result.current.archive('app-1', 'Role');
    });
    await act(async () => { write.resolve('2026-10-09T10:00:00Z'); });
    expect(archiveApplication).toHaveBeenCalledTimes(1);
  });

  it('puts the row back and shows an error when archiving fails', async () => {
    archiveApplication.mockRejectedValueOnce(new Error('We couldn’t archive this application. Please try again.'));
    const { result } = await loaded();

    await act(async () => { await result.current.archive('app-1', 'Role'); });
    expect(result.current.archivedAt['app-1']).toBeUndefined();
    expect(result.current.archivedAt['app-old']).toBeTruthy(); // other rows untouched
    expect(result.current.toast).toMatchObject({ tone: 'error' });
    expect(result.current.toast?.undo).toBeUndefined();
  });

  it('puts the row back in the archive when restoring fails', async () => {
    restoreApplication.mockRejectedValueOnce(new Error('We couldn’t restore this application. Please try again.'));
    const { result } = await loaded();

    await act(async () => { await result.current.restore('app-old', 'Role', 'Open'); });
    expect(result.current.archivedAt['app-old']).toBe('2026-10-01T00:00:00Z');
    expect(result.current.toast).toMatchObject({ tone: 'error' });
  });

  it('names the tab a restored application returns to', async () => {
    restoreApplication.mockResolvedValueOnce(undefined);
    const { result } = await loaded();
    await act(async () => { await result.current.restore('app-old', 'Role', 'Rejected'); });
    expect(result.current.toast?.message).toBe('Restored “Role” to Rejected.');
  });
});

describe('ApplicationRowAction', () => {
  it('archives without triggering the row link', async () => {
    const onActivate = vi.fn();
    const onNavigate = vi.fn((e: React.MouseEvent) => e.preventDefault());
    render(
      <div className="app-row" onClick={onNavigate}>
        <ApplicationRowAction mode="archive" itemLabel="Role at Co" pending={false} onActivate={onActivate} />
      </div>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Archive application: Role at Co' }));
    expect(onActivate).toHaveBeenCalledTimes(1);
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('is disabled while its request is pending', () => {
    render(<ApplicationRowAction mode="restore" itemLabel="Role" pending onActivate={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Restore application: Role' })).toBeDisabled();
  });
});
