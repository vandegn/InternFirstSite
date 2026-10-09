'use client';

import { useEffect, useId, useRef, useState } from 'react';
import ModalPortal from './ModalPortal';

// A confirm-before-you-commit dialog for actions with consequences (Posted
// Jobs' Archive/End Hiring and Unarchive). Nothing happens until the confirm
// button is pressed; Cancel, Escape and the backdrop all back out untouched.
//
// Keyboard: focus lands on Cancel (the safe choice) when it opens, Tab stays
// inside the dialog, Escape cancels, and focus returns to whatever opened it.
// Duplicate submissions: the confirm button locks on the first press until
// onConfirm settles — a second click, or Enter held down, does nothing.
// onConfirm should throw to report failure; its message is shown in the
// dialog and the dialog stays open so the employer can retry or cancel.

export default function ConfirmActionModal({
  open,
  title,
  paragraphs,
  cancelLabel = 'Cancel',
  confirmLabel,
  busyLabel,
  tone = 'danger',
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  paragraphs: readonly string[];
  cancelLabel?: string;
  confirmLabel: string;
  busyLabel?: string;
  tone?: 'danger' | 'primary';
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}) {
  const titleId = useId();
  const bodyId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Focus in on open, back out on close.
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    return () => { opener?.focus?.(); };
  }, [open]);

  if (!open) return null;

  function cancel() {
    if (busyRef.current) return;
    setError('');
    onCancel();
  }

  async function confirm() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      await onConfirm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Nothing was changed — please try again.');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      cancel();
      return;
    }
    if (e.key !== 'Tab' || !dialogRef.current) return;
    const focusable = Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'),
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  return (
    <ModalPortal>
      <div
        className="confirm-modal-backdrop"
        onMouseDown={(e) => { if (e.target === e.currentTarget) cancel(); }}
      >
        <div
          ref={dialogRef}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={bodyId}
          aria-busy={busy || undefined}
          className="confirm-modal"
          onKeyDown={handleKeyDown}
        >
          <h3 id={titleId} className="confirm-modal-title">{title}</h3>
          <div id={bodyId} className="confirm-modal-body">
            {paragraphs.map((p) => <p key={p}>{p}</p>)}
          </div>
          {error && (
            <p role="alert" className="confirm-modal-error">{error}</p>
          )}
          <div className="confirm-modal-actions">
            <button
              ref={cancelRef}
              type="button"
              className="btn-modal-secondary"
              onClick={cancel}
              disabled={busy}
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              className={tone === 'danger' ? 'btn-danger-solid' : 'btn-modal-primary'}
              onClick={() => { void confirm(); }}
              disabled={busy}
            >
              {busy ? (busyLabel ?? 'Working…') : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
