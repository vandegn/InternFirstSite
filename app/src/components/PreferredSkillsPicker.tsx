'use client';

import { useState, useEffect, useRef } from 'react';
import { MAX_LISTING_SKILLS } from '@/lib/constants';

// Employers pick the skills a listing wants from the same catalog students
// pick from (public/skills.json), so match scoring compares like with like
// instead of guessing from the prose. Capped at MAX_LISTING_SKILLS.
export default function PreferredSkillsPicker({ value, onChange }: {
  value: string[];
  onChange: (skills: string[]) => void;
}) {
  const [catalog, setCatalog] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Kept out of the JS bundle so it doesn't weigh on every page.
  useEffect(() => {
    let cancelled = false;
    fetch('/skills.json')
      .then((r) => r.json())
      .then((data: string[]) => { if (!cancelled) setCatalog(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 120);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const chosen = new Set(value.map((s) => s.toLowerCase()));
  const query = debounced.toLowerCase().trim();
  const atLimit = value.length >= MAX_LISTING_SKILLS;

  // Empty query lists the whole catalog so the options are browsable without
  // having to guess a search term. Ranked prefix > word-start > substring.
  const matches = query === ''
    ? catalog.filter((s) => !chosen.has(s.toLowerCase()))
    : catalog
      .reduce<{ name: string; score: number }[]>((acc, s) => {
        const lower = s.toLowerCase();
        if (chosen.has(lower)) return acc;
        const idx = lower.indexOf(query);
        if (idx === -1) return acc;
        acc.push({ name: s, score: idx === 0 ? 0 : lower[idx - 1] === ' ' ? 1 : 2 });
        return acc;
      }, [])
      .sort((a, b) => a.score - b.score || a.name.localeCompare(b.name))
      .map((x) => x.name);

  function add(skill: string) {
    if (atLimit || chosen.has(skill.toLowerCase())) return;
    onChange([...value, skill]);
    setSearch('');
    setOpen(false);
  }

  return (
    <div className="form-group" style={{ marginTop: '8px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
      <label style={{ fontSize: '1.05rem', fontWeight: 600 }}>
        Preferred Skills{' '}
        <span style={{ fontWeight: 400, fontSize: '0.85rem', color: atLimit ? 'var(--primary)' : 'var(--text-light)' }}>
          ({value.length}/{MAX_LISTING_SKILLS})
        </span>
      </label>
      <small style={{ color: 'var(--text-light)', fontSize: '0.78rem', margin: '4px 0 12px', display: 'block' }}>
        The skills you actually want. These are matched directly against student profiles, so they carry more weight than skills merely mentioned in the text above.
      </small>

      {value.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
          {value.map((skill) => (
            <span
              key={skill}
              style={{
                padding: '4px 10px', borderRadius: '6px', fontSize: '0.8rem',
                background: 'var(--primary-light)', color: 'var(--primary)', fontWeight: 500,
                display: 'inline-flex', alignItems: 'center', gap: '6px',
              }}
            >
              {skill}
              <button
                type="button"
                onClick={() => onChange(value.filter((s) => s !== skill))}
                aria-label={`Remove ${skill}`}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--primary)', lineHeight: 1, display: 'flex', opacity: 0.6 }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </span>
          ))}
        </div>
      )}

      {atLimit ? (
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
          You&apos;ve reached the {MAX_LISTING_SKILLS}-skill limit. Remove one to add a different skill.
        </p>
      ) : (
        <div style={{ position: 'relative' }} ref={dropdownRef}>
          <input
            type="text"
            placeholder="Browse or search skills..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            autoComplete="off"
            style={{ width: '100%' }}
          />
          {open && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, maxHeight: '240px',
              overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: '8px', zIndex: 20, boxShadow: 'var(--shadow-md)', marginTop: '2px',
            }}>
              {matches.length === 0 ? (
                <div style={{ padding: '8px 12px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  {catalog.length === 0 ? 'Loading skills…' : 'No matching skill in our list.'}
                </div>
              ) : matches.map((skill) => (
                <div
                  key={skill}
                  onClick={() => add(skill)}
                  style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '0.82rem' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  {skill}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
