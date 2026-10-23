'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { Dot } from './map-data';
import s from './home.module.css';

type School = { id: number; name: string; state: string; label: string };

// The map sweeps in west to east once, then answers the visitor: pick your
// school and its state lights up green.
export default function CampusMap({ dots, width, height }: { dots: Dot[]; width: number; height: number }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<School[]>([]);
  const [picked, setPicked] = useState<School | null>(null);
  const [open, setOpen] = useState(false);
  const listId = useId();
  const reqRef = useRef(0);
  const svgRef = useRef<SVGSVGElement>(null);
  const liftedRef = useRef<Set<number>>(new Set());
  const frameRef = useRef(0);

  // Dots near the cursor hop up, more the closer they are, and spring back
  // (via the CSS transition) once the cursor moves on. Done imperatively so
  // two thousand circles don't re-render on every mouse move.
  const onMapMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => {
      const circles = svg.querySelectorAll('circle');
      const next = new Set<number>();
      const R = 4;
      dots.forEach((d, i) => {
        const dist = Math.hypot(d.x - pt.x, d.y - pt.y);
        if (dist < R) {
          const k = 1 - dist / R;
          const el = circles[i] as SVGCircleElement;
          el.style.translate = `0 ${-k * 1.6}px`;
          el.style.scale = `${1 + k * 0.6}`;
          next.add(i);
        }
      });
      liftedRef.current.forEach((i) => {
        if (!next.has(i)) {
          const el = circles[i] as SVGCircleElement;
          el.style.translate = '';
          el.style.scale = '';
        }
      });
      liftedRef.current = next;
    });
  };

  const onMapLeave = () => {
    cancelAnimationFrame(frameRef.current);
    const circles = svgRef.current?.querySelectorAll('circle');
    liftedRef.current.forEach((i) => {
      const el = circles?.[i] as SVGCircleElement | undefined;
      if (el) { el.style.translate = ''; el.style.scale = ''; }
    });
    liftedRef.current = new Set();
  };

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2 || picked?.name === query) return;
    const n = ++reqRef.current;
    const t = setTimeout(async () => {
      const res = await fetch(`/api/schools?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (n === reqRef.current) { setResults(data.results.slice(0, 6)); setOpen(true); }
    }, 150);
    return () => clearTimeout(t);
  }, [query, picked]);

  const shown = query.trim().length >= 2 && picked?.name !== query ? results : [];
  const pickedCode = picked ? picked.label.split(' · ').pop() : null;

  return (
    <>
      <div className={s.lookup}>
        <label htmlFor={`${listId}-input`} className={s.lookupLabel}>Check your school</label>
        <div className={s.combo}>
          <input
            id={`${listId}-input`}
            className={s.input}
            placeholder="Start typing, like NC State or Miami University"
            value={query}
            autoComplete="off"
            role="combobox"
            aria-expanded={open && shown.length > 0}
            aria-controls={listId}
            onChange={(e) => { setQuery(e.target.value); setPicked(null); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 120)}
          />
          {open && shown.length > 0 && (
            <ul id={listId} role="listbox" className={s.options}>
              {shown.map((r) => (
                <li key={r.id} role="option" aria-selected={false}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { setPicked(r); setQuery(r.name); setOpen(false); }}
                  >
                    <span>{r.name}</span>
                    <span className={s.optState}>{r.state}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className={s.answer} aria-live="polite">
          {picked
            ? `You're in. Students at ${picked.name} can sign up with their .edu email.`
            : 'Every school on the Department of Education’s accredited list is eligible.'}
        </p>
      </div>

      <svg
        ref={svgRef}
        className={s.map}
        onPointerMove={onMapMove}
        onPointerLeave={onMapLeave}
        viewBox={`-1 -1 ${width + 2} ${height + 2}`}
        data-picked={pickedCode ? 'true' : 'false'}
        role="img"
        aria-label="Dot map of the continental United States"
      >
        {dots.map((d, i) => (
          <circle
            key={i}
            cx={d.x}
            cy={d.y}
            r={d.lit ? 0.36 : 0.26}
            className={pickedCode && d.st === pickedCode ? s.dotOn : d.lit ? s.dotLit : s.dot}
            style={{ '--d': `${(d.x / width) * 1.4 + (d.y / height) * 0.2}s` } as React.CSSProperties}
          />
        ))}
      </svg>
    </>
  );
}
