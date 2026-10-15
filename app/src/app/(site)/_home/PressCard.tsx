'use client';

import { useRef } from 'react';
import s from './home.module.css';

// A raised slab that sinks under the cursor: the whole card presses down on
// hover, and the side nearest the pointer dips furthest, as if it's carrying
// the weight. Reduced-motion users get the plain press without the tilt.
export default function PressCard({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el || e.pointerType !== 'mouse') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const r = el.getBoundingClientRect();
    const dx = (e.clientX - r.left) / r.width - 0.5;
    const dy = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty('--ry', `${dx * 7}deg`);
    el.style.setProperty('--rx', `${-dy * 7}deg`);
  };

  const onLeave = () => {
    ref.current?.style.setProperty('--ry', '0deg');
    ref.current?.style.setProperty('--rx', '0deg');
  };

  return (
    <div className={s.pressWrap}>
      <div ref={ref} className={s.side} onPointerMove={onMove} onPointerLeave={onLeave}>
        {children}
      </div>
    </div>
  );
}
