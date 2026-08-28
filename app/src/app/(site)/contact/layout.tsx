import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/site';

// contact/page.tsx is a client component (it owns the contact form's state), so
// it cannot export metadata itself. A pass-through layout is the standard
// Next.js escape hatch — same pattern as login/ and register/.
export const metadata: Metadata = pageMetadata({
  absoluteTitle: 'Contact InternFirst | Talk to Our Team',
  description:
    'Questions about InternFirst? Reach the team about student accounts, employer verification, partnerships, or support.',
  path: '/contact',
});

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
