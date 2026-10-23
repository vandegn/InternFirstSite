'use client';

import { useRef } from 'react';

export type InterviewTab = 'upcoming' | 'past';

const TABS: { id: InterviewTab; label: string }[] = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'past', label: 'Past' },
];

type Props = {
  tab: InterviewTab;
  counts: Record<InterviewTab, number> | null;
  onChange: (tab: InterviewTab) => void;
};

// Upcoming / Past, the same ARIA tabs pattern (and styles) as My Applications.
export default function InterviewTabs({ tab, counts, onChange }: Props) {
  const refs = useRef<Record<InterviewTab, HTMLButtonElement | null>>({ upcoming: null, past: null });

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    const i = TABS.findIndex(t => t.id === tab);
    const next =
      e.key === 'Home' ? 0
      : e.key === 'End' ? TABS.length - 1
      : (i + (e.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length;
    onChange(TABS[next].id);
    refs.current[TABS[next].id]?.focus();
  };

  return (
    <div role="tablist" aria-label="Interview groups" className="app-tabs">
      {TABS.map(t => {
        const selected = tab === t.id;
        return (
          <button
            key={t.id}
            ref={node => { refs.current[t.id] = node; }}
            type="button"
            role="tab"
            id={`interviews-tab-${t.id}`}
            aria-selected={selected}
            aria-controls={`interviews-panel-${t.id}`}
            tabIndex={selected ? 0 : -1}
            className="app-tab"
            onClick={() => onChange(t.id)}
            onKeyDown={onKeyDown}
          >
            {t.label}
            <span className="app-tab-count" aria-label={`${counts ? counts[t.id] : 'loading'} interviews`}>
              {counts ? counts[t.id] : '–'}
            </span>
          </button>
        );
      })}
    </div>
  );
}
