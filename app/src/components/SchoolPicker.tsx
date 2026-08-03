'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export type SchoolValue = {
  /** Federal institution id from the Dept. of Education list, or null if unset. */
  id: number | null;
  /** Canonical institution name — what gets shown on the student's profile. */
  name: string;
  state: string | null;
};

type Suggestion = {
  id: number;
  name: string;
  state: string;
  label: string;
};

export const EMPTY_SCHOOL: SchoolValue = { id: null, name: '', state: null };

export function schoolFromStudent(student: {
  school_id?: number | null;
  school_name?: string | null;
  school_state?: string | null;
} | null): SchoolValue {
  return {
    id: student?.school_id ?? null,
    name: student?.school_name ?? '',
    state: student?.school_state ?? null,
  };
}

// Unlike a free-text field, a school is only ever set by picking a row from the
// approved list — typed text that was never committed is thrown away on blur.
export default function SchoolPicker({
  value,
  onChange,
  id = 'school',
  placeholder = 'Search your school...',
  disabled,
  inputStyle,
  hint,
}: {
  value: SchoolValue;
  onChange: (value: SchoolValue) => void;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  inputStyle?: React.CSSProperties;
  hint?: string;
}) {
  const [query, setQuery] = useState(value.name);
  const [results, setResults] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [loading, setLoading] = useState(false);

  // Latest committed selection. Typing that isn't followed by a pick reverts to
  // this on blur — that's what keeps school_name inside the approved list.
  const committedRef = useRef<SchoolValue>(value);
  const requestRef = useRef(0);

  // Keep the input in sync when the parent loads a value asynchronously.
  useEffect(() => {
    committedRef.current = value;
    setQuery(value.name);
  }, [value.id, value.name]);

  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      const requestId = ++requestRef.current;
      setLoading(true);
      try {
        const res = await fetch(`/api/schools?q=${encodeURIComponent(query)}`);
        const json = await res.json();
        // Drop responses that arrived out of order.
        if (requestRef.current === requestId) {
          setResults(json.results ?? []);
          setHighlight(0);
        }
      } catch {
        if (requestRef.current === requestId) setResults([]);
      } finally {
        if (requestRef.current === requestId) setLoading(false);
      }
    }, 200);

    return () => clearTimeout(handle);
  }, [query, open]);

  const commit = useCallback((suggestion: Suggestion) => {
    const next: SchoolValue = { id: suggestion.id, name: suggestion.name, state: suggestion.state };
    committedRef.current = next;
    setQuery(next.name);
    setOpen(false);
    setResults([]);
    onChange(next);
  }, [onChange]);

  function revert() {
    setQuery(committedRef.current.name);
    setOpen(false);
    setResults([]);
  }

  function clear() {
    committedRef.current = EMPTY_SCHOOL;
    setQuery('');
    setResults([]);
    setOpen(false);
    onChange(EMPTY_SCHOOL);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      // Never let Enter submit the surrounding form from this field.
      e.preventDefault();
      if (results[highlight]) commit(results[highlight]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      revert();
    }
  }

  const selected = committedRef.current.id !== null;
  const showNoMatch = open && !loading && query.trim().length >= 2 && results.length === 0;

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
          <input
            type="text"
            id={id}
            autoComplete="off"
            placeholder={placeholder}
            disabled={disabled}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            // A click on a suggestion fires blur first, so defer the revert.
            onBlur={() => setTimeout(revert, 120)}
            onKeyDown={handleKeyDown}
            style={{ width: '100%', paddingRight: selected ? 30 : undefined, ...inputStyle }}
          />
          {selected && (
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round"
              style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </div>
        {(query || selected) && !disabled && (
          <button
            type="button"
            onClick={clear}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text-secondary)', fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            Clear
          </button>
        )}
      </div>

      {open && (results.length > 0 || showNoMatch) && (
        <ul
          role="listbox"
          style={{
            position: 'absolute',
            zIndex: 50,
            left: 0,
            right: 0,
            top: '100%',
            marginTop: 4,
            listStyle: 'none',
            padding: 4,
            maxHeight: 260,
            overflowY: 'auto',
            background: 'var(--bg)',
            border: '1.5px solid var(--border)',
            borderRadius: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
          }}
        >
          {showNoMatch ? (
            <li style={{ padding: '10px 12px', fontSize: '0.85rem', color: 'var(--text-light)' }}>
              No matching school. Try the official name, e.g. &ldquo;University of&hellip;&rdquo;.
            </li>
          ) : (
            results.map((result, i) => (
              <li key={result.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={i === highlight}
                  // Keep focus on the input so onBlur's revert never races the click.
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => commit(result)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.88rem',
                    background: i === highlight ? 'var(--primary-light)' : 'transparent',
                    color: i === highlight ? 'var(--primary)' : 'var(--text-primary)',
                    fontWeight: i === highlight ? 600 : 400,
                  }}
                >
                  {result.label}
                </button>
              </li>
            ))
          )}
        </ul>
      )}

      {hint && (
        <small style={{ color: 'var(--text-light)', fontSize: '0.78rem', marginTop: '4px', display: 'block' }}>
          {hint}
        </small>
      )}
    </div>
  );
}
