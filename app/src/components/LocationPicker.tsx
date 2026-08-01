'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export type LocationValue = {
  label: string;             // canonical "Raleigh, NC" — written to internship_listings.location
  city: string | null;
  state: string | null;
  lat: number | null;
  lng: number | null;
};

type Suggestion = {
  id: string;
  city: string;
  state: string;
  label: string;
  lat: number;
  lng: number;
};

export const EMPTY_LOCATION: LocationValue = { label: '', city: null, state: null, lat: null, lng: null };

// A listing saved before the picker existed has a free-text label and no
// structured parts. It still displays, but we prompt the employer to re-pick.
export function isUnverified(value: LocationValue): boolean {
  return !!value.label && !value.city;
}

export function locationFromListing(listing: {
  location?: string | null;
  city?: string | null;
  state?: string | null;
  lat?: number | null;
  lng?: number | null;
}): LocationValue {
  return {
    label: listing.location || '',
    city: listing.city ?? null,
    state: listing.state ?? null,
    lat: listing.lat ?? null,
    lng: listing.lng ?? null,
  };
}

export default function LocationPicker({ value, onChange, required, disabled }: {
  value: LocationValue;
  onChange: (value: LocationValue) => void;
  required?: boolean;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState(value.label);
  const [results, setResults] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [loading, setLoading] = useState(false);

  // Latest committed selection. Typing that isn't followed by a pick reverts to
  // this on blur — that's what stops employers from free-typing a location.
  const committedRef = useRef<LocationValue>(value);
  const requestRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep the input in sync when the parent loads a value asynchronously (edit page).
  useEffect(() => {
    committedRef.current = value;
    setQuery(value.label);
  }, [value.label, value.city]);

  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      const requestId = ++requestRef.current;
      setLoading(true);
      try {
        const res = await fetch(`/api/locations?q=${encodeURIComponent(query)}`);
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
    const next: LocationValue = {
      label: suggestion.label,
      city: suggestion.city,
      state: suggestion.state,
      lat: suggestion.lat,
      lng: suggestion.lng,
    };
    committedRef.current = next;
    setQuery(next.label);
    setOpen(false);
    setResults([]);
    onChange(next);
  }, [onChange]);

  function revert() {
    setQuery(committedRef.current.label);
    setOpen(false);
    setResults([]);
  }

  function clear() {
    committedRef.current = EMPTY_LOCATION;
    setQuery('');
    setResults([]);
    setOpen(false);
    onChange(EMPTY_LOCATION);
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
      // Never let Enter submit the listing form from this field.
      e.preventDefault();
      if (results[highlight]) commit(results[highlight]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      revert();
    }
  }

  const selected = !!committedRef.current.city;
  const unverified = isUnverified(committedRef.current);
  const showNoMatch = open && !loading && query.trim().length >= 2 && results.length === 0;

  return (
    <div className="form-group" ref={containerRef} style={{ position: 'relative' }}>
      <label htmlFor="location">
        Location {!required && <span style={{ color: 'var(--text-light)', fontWeight: 400 }}>(optional)</span>}
      </label>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
          <input
            type="text"
            id="location"
            autoComplete="off"
            placeholder="Search a city, e.g. Raleigh"
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
            style={{
              width: '100%',
              paddingRight: selected ? 30 : undefined,
              borderColor: unverified ? 'var(--chip-amber-ink)' : undefined,
            }}
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
        {(query || selected) && (
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
            zIndex: 20,
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
              No matching US city. Try the nearest larger city.
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

      {unverified ? (
        <small style={{ color: 'var(--chip-amber-ink)', fontSize: '0.78rem', marginTop: '4px', display: 'block' }}>
          This location predates city search. Pick it from the list to confirm it.
        </small>
      ) : (
        <small style={{ color: 'var(--text-light)', fontSize: '0.78rem', marginTop: '4px', display: 'block' }}>
          Pick from the list — typed text that isn&apos;t selected won&apos;t be saved.
        </small>
      )}
    </div>
  );
}
