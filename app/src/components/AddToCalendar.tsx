'use client';

import { useEffect, useRef, useState } from 'react';
import { eventIcs, googleCalendarUrl, icsFilename, type ExportableEvent } from '@/lib/event-calendar-export';

// "Add to calendar" on a career event: Google Calendar opens its new-event
// page pre-filled; Apple / Outlook downloads a one-event .ics file. Built
// entirely in the browser from the event row (lib/event-calendar-export.ts).

const itemStyle: React.CSSProperties = {
  display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', background: 'none',
  fontSize: '0.84rem', color: 'var(--text)', cursor: 'pointer', textDecoration: 'none', fontFamily: 'inherit', borderRadius: 6,
};

function downloadIcs(event: ExportableEvent) {
  const blob = new Blob([eventIcs(event)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = icsFilename(event.title);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function AddToCalendar({ event }: { event: ExportableEvent }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); button.current?.focus(); }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <div ref={wrap} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        ref={button}
        type="button"
        className="btn-secondary"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{ fontSize: '0.8rem', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /><line x1="12" y1="14" x2="12" y2="20" /><line x1="9" y1="17" x2="15" y2="17" />
        </svg>
        Add to calendar
      </button>
      {open && (
        <div
          role="menu"
          aria-label={`Add ${event.title} to a calendar`}
          style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 20, minWidth: 210, padding: 4,
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: 'var(--shadow-md)',
          }}
        >
          <a role="menuitem" href={googleCalendarUrl(event)} target="_blank" rel="noopener noreferrer" style={itemStyle} onClick={() => setOpen(false)}>
            Google Calendar
          </a>
          <button role="menuitem" type="button" style={itemStyle} onClick={() => { downloadIcs(event); setOpen(false); }}>
            Apple / Outlook (.ics file)
          </button>
        </div>
      )}
    </div>
  );
}
