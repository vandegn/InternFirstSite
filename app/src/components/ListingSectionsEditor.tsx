'use client';

import AutoResizeTextarea from '@/components/AutoResizeTextarea';
import type { ListingSectionInput } from '@/lib/supabase';

// Employer-authored content blocks rendered after the core three sections
// (Job Overview / Qualifications / Key Responsibilities). Order is the array
// order — persisted as `position` by replaceListingSections.
export default function ListingSectionsEditor({ sections, onChange }: {
  sections: ListingSectionInput[];
  onChange: (sections: ListingSectionInput[]) => void;
}) {
  function update(index: number, patch: Partial<ListingSectionInput>) {
    onChange(sections.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function remove(index: number) {
    onChange(sections.filter((_, i) => i !== index));
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= sections.length) return;
    const next = [...sections];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <div className="form-group" style={{ marginTop: '8px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
      <label style={{ fontSize: '1.05rem', fontWeight: 600 }}>Additional Sections</label>
      <small style={{ color: 'var(--text-light)', fontSize: '0.78rem', margin: '4px 0 12px', display: 'block' }}>
        Optional extra blocks — &quot;Benefits&quot;, &quot;Our Team&quot;, &quot;What Success Looks Like&quot;. They appear after Key Responsibilities.
      </small>

      {sections.map((section, i) => (
        <div
          key={i}
          style={{
            border: '1.5px solid var(--border)',
            borderRadius: 10,
            padding: '14px',
            marginBottom: '12px',
            background: 'var(--bg-light)',
          }}
        >
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px' }}>
            <input
              type="text"
              placeholder="Section heading, e.g. Benefits"
              value={section.heading}
              onChange={(e) => update(i, { heading: e.target.value })}
              style={{ flex: 1 }}
            />
            <button
              type="button"
              onClick={() => move(i, -1)}
              disabled={i === 0}
              aria-label="Move section up"
              style={iconButtonStyle(i === 0)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15" /></svg>
            </button>
            <button
              type="button"
              onClick={() => move(i, 1)}
              disabled={i === sections.length - 1}
              aria-label="Move section down"
              style={iconButtonStyle(i === sections.length - 1)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
            </button>
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label="Remove section"
              style={{ ...iconButtonStyle(false), color: 'var(--danger-fg)', borderColor: 'var(--danger-border)' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>
          <AutoResizeTextarea
            placeholder="Section content...&#10;&#10;Tip: Use - for bullet points"
            rows={3}
            value={section.body}
            onChange={(e) => update(i, { body: e.target.value })}
            style={{ width: '100%', resize: 'vertical' }}
          />
        </div>
      ))}

      <button
        type="button"
        onClick={() => onChange([...sections, { heading: '', body: '' }])}
        style={{
          padding: '9px 16px',
          borderRadius: 8,
          border: '1.5px dashed var(--border)',
          background: 'transparent',
          color: 'var(--primary)',
          fontWeight: 600,
          fontSize: '0.85rem',
          cursor: 'pointer',
        }}
      >
        + Add section
      </button>
    </div>
  );
}

function iconButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 30,
    height: 30,
    borderRadius: 8,
    border: '1.5px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text-secondary)',
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.4 : 1,
    flexShrink: 0,
  };
}
