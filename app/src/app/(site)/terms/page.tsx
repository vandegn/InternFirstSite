import type { Metadata } from 'next';
import PolicyPage from '@/components/PolicyPage';
import { pageMetadata } from '@/lib/site';

// See the note in privacy/page.tsx — the brand comes from the title template,
// never from the page.
export const metadata: Metadata = pageMetadata({
  title: 'Terms & Conditions',
  description:
    'The terms governing use of InternFirst by students and employers, including account eligibility, acceptable use, and platform responsibilities.',
  path: '/terms',
});

export default function TermsPage() {
  return <PolicyPage kind="terms" />;
}
