'use client';

import { createPortal } from 'react-dom';

// Renders a modal as a direct child of <body>, outside whatever the page has
// wrapped it in.
//
// `position: fixed` is only viewport-relative while no ancestor establishes a
// containing block, and a surprising number of ordinary properties do:
// transform, filter, backdrop-filter, perspective, contain, and will-change
// naming any of them. One of those anywhere up the tree — a hover lift, a fade
// animation, a blurred header — silently re-anchors a fixed modal to that
// element and drops it wherever that element happens to sit on the page.
// Chasing them one at a time is a losing game, because the next one gets added
// by someone styling an unrelated component.
//
// Portalling to <body> removes the question: there are no ancestors left to
// interfere, so `inset: 0` means the viewport and centering means the middle of
// the screen. It also escapes any ancestor's `overflow: hidden` and stacking
// context.
//
// The document check is for SSR, where there is no body to portal into. It
// cannot cause a hydration mismatch: every modal here returns null until its
// `open`/`visible` state flips, and that only happens from a user interaction
// well after hydration — so on the server, and on the first client render,
// this component is never reached at all.
//
// EeoConfirmModal has done exactly this inline since it was written; this is
// the same thing, shared.
export default function ModalPortal({ children }: { children: React.ReactNode }) {
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}
