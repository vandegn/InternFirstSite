'use client';

// The Archive / Restore button on a My Applications row (dashboard home list
// and the full page). Hidden until the row is hovered or anything in it has
// keyboard focus, and always visible on touch screens, where there is no hover
// — see .app-row / .app-row-action in globals.css. Put it inside an element
// with className "app-row".
//
// The click is stopped here so a row that is itself a link (the dashboard home
// list) doesn't navigate when the student archives it.

export default function ApplicationRowAction({
  mode,
  itemLabel,
  pending,
  disabled,
  onActivate,
}: {
  mode: 'archive' | 'restore';
  // What the row is, for screen readers: "Data Analyst Intern at Northwind".
  itemLabel: string;
  pending: boolean;
  disabled?: boolean;
  onActivate: () => void;
}) {
  const verb = mode === 'archive' ? 'Archive' : 'Restore';
  return (
    <button
      type="button"
      className="app-row-action"
      aria-label={`${verb} application: ${itemLabel}`}
      aria-busy={pending || undefined}
      disabled={pending || disabled}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!pending && !disabled) onActivate();
      }}
    >
      {mode === 'archive' ? (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="21 8 21 21 3 21 3 8" /><rect x="1" y="3" width="22" height="5" /><line x1="10" y1="12" x2="14" y2="12" />
        </svg>
      ) : (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
        </svg>
      )}
      <span>{pending ? (mode === 'archive' ? 'Archiving…' : 'Restoring…') : verb}</span>
    </button>
  );
}
