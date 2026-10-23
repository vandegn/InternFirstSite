'use client';

import { useRef } from 'react';
import s from './PressCard.module.css';

type Props = {
  children: React.ReactNode;
  /** Inner padding; the homepage cards use the default. */
  padding?: string;
  /** Extra class on the card face (for the page's own text styles). */
  className?: string;
  /**
   * The hover press + tilt. Off for cards people type into: a form that sinks
   * and tilts under the cursor is a form that moves while you try to click it.
   * The slab look (navy edge, drop) stays either way.
   */
  pressable?: boolean;
};

// A raised slab that sinks under the cursor: the whole card presses down on
// hover, and the side nearest the pointer dips furthest, as if it's carrying
// the weight. Reduced-motion users get the plain press without the tilt.
export default function PressCard({ children, padding, className, pressable = true }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el || !pressable || e.pointerType !== 'mouse') return;
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

  const face = [s.side, pressable ? s.pressable : '', className ?? ''].filter(Boolean).join(' ');

  return (
    <div className={s.wrap}>
      <div
        ref={ref}
        className={face}
        style={padding ? { padding } : undefined}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
      >
        {children}
      </div>
    </div>
  );
}
