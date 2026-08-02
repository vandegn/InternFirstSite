'use client';

import ReactMarkdown from 'react-markdown';
import AutoResizeTextarea from '@/components/AutoResizeTextarea';

// The three sections every listing must have. They render in the employer's
// chosen order on the posting, the live preview, and the student detail page —
// see internship_listings.section_order.
export type CoreSectionKey = 'description' | 'requirements' | 'key_responsibilities';

export const CORE_SECTION_KEYS: CoreSectionKey[] = ['description', 'requirements', 'key_responsibilities'];

// Qualifications first is the default for new listings; employers said it's
// what students skim for. Existing listings keep the order they were authored
// in (the migration backfills them).
export const DEFAULT_SECTION_ORDER: CoreSectionKey[] = ['requirements', 'description', 'key_responsibilities'];

export const CORE_SECTIONS: Record<CoreSectionKey, { label: string; placeholder: string }> = {
  requirements: {
    label: 'Qualifications',
    placeholder: 'List skills, qualifications, or experience needed...\n\nTip: Use - for bullet points',
  },
  description: {
    label: 'Job Overview',
    placeholder: 'Describe the role and what the intern will learn...\n\nTip: Use - for bullet points',
  },
  key_responsibilities: {
    label: 'Key Responsibilities',
    placeholder: 'List the main duties and responsibilities of the role...\n\nTip: Use - for bullet points',
  },
};

// Repairs anything that isn't exactly the three keys — a listing saved before
// section_order existed, or a hand-edited row — so a missing key can never
// make a section vanish from the page.
export function normalizeSectionOrder(order: unknown): CoreSectionKey[] {
  const raw = Array.isArray(order) ? order.filter((k): k is CoreSectionKey => CORE_SECTION_KEYS.includes(k as CoreSectionKey)) : [];
  const seen = new Set<CoreSectionKey>();
  const out: CoreSectionKey[] = [];
  for (const key of raw) {
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  for (const key of DEFAULT_SECTION_ORDER) {
    if (!seen.has(key)) out.push(key);
  }
  return out;
}

export type CoreSectionValues = Record<CoreSectionKey, string>;

export default function ListingCoreSections({
  order,
  values,
  showErrors = false,
  onChange,
  onReorder,
}: {
  order: CoreSectionKey[];
  values: CoreSectionValues;
  showErrors?: boolean;
  onChange: (key: CoreSectionKey, value: string) => void;
  onReorder: (order: CoreSectionKey[]) => void;
}) {
  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    onReorder(next);
  }

  return (
    <>
      {order.map((key, i) => {
        const section = CORE_SECTIONS[key];
        const missing = showErrors && !values[key].trim();
        return (
          <div className="form-group" key={key}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <label htmlFor={key} style={{ flex: 1, margin: 0 }}>
                {section.label} <span style={{ color: 'var(--danger-fg)' }}>*</span>
              </label>
              <button
                type="button"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                aria-label={`Move ${section.label} up`}
                style={iconButtonStyle(i === 0)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15" /></svg>
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === order.length - 1}
                aria-label={`Move ${section.label} down`}
                style={iconButtonStyle(i === order.length - 1)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
              </button>
            </div>
            <AutoResizeTextarea
              id={key}
              placeholder={section.placeholder}
              rows={key === 'description' ? 5 : 4}
              value={values[key]}
              onChange={(e) => onChange(key, e.target.value)}
              style={{
                width: '100%',
                resize: 'vertical',
                borderColor: missing ? 'var(--danger-border)' : undefined,
              }}
            />
            {missing && (
              <small style={{ color: 'var(--danger-fg)', fontSize: '0.78rem', marginTop: '4px', display: 'block' }}>
                {section.label} is required.
              </small>
            )}
          </div>
        );
      })}
    </>
  );
}

// Read-only counterpart used everywhere a listing is displayed — the employer's
// live preview, the student browse pane, the detail pages. Keeping the render
// in one place is what stops the preview and the real page from drifting.
export function ListingCoreSectionsView({
  listing,
  headingStyle,
  emptyPlaceholder = false,
}: {
  listing: {
    description?: string | null;
    requirements?: string | null;
    key_responsibilities?: string | null;
    section_order?: string[] | null;
  };
  headingStyle?: React.CSSProperties;
  // The employer preview shows dashed "fill this in" boxes; live pages just
  // omit an empty section.
  emptyPlaceholder?: boolean;
}) {
  const order = normalizeSectionOrder(listing.section_order);
  const heading: React.CSSProperties = headingStyle ?? { fontSize: '1.05rem', fontWeight: 600, marginBottom: '12px' };

  return (
    <>
      {order.map((key) => {
        const body = (listing[key] ?? '') as string;
        const label = CORE_SECTIONS[key].label;
        if (!body.trim()) {
          if (!emptyPlaceholder) return null;
          return (
            <div key={key} style={{ marginBottom: '24px', padding: '16px', border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm, 8px)' }}>
              <h3 style={{ ...heading, marginBottom: '4px', color: 'var(--text-light)' }}>{label}</h3>
              <p style={{ color: 'var(--text-light)', fontSize: '0.85rem', margin: 0 }}>Fill in the {label} field to preview...</p>
            </div>
          );
        }
        return (
          <div key={key} style={{ marginBottom: '24px' }}>
            <h3 style={heading}>{label}</h3>
            <div className="markdown-content"><ReactMarkdown>{body}</ReactMarkdown></div>
          </div>
        );
      })}
    </>
  );
}

function iconButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    borderRadius: 8,
    border: '1.5px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text-secondary)',
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.4 : 1,
    flexShrink: 0,
  };
}
