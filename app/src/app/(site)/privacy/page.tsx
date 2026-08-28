import type { Metadata } from 'next';
import PolicyPage from '@/components/PolicyPage';
import { pageMetadata } from '@/lib/site';

// Just 'Privacy Policy' — the root layout's `%s | InternFirst` template adds
// the brand. Hardcoding it here is what produced the doubled
// "Privacy Policy | InternFirst | InternFirst".
export const metadata: Metadata = pageMetadata({
  title: 'Privacy Policy',
  description:
    'How InternFirst collects, uses, stores, and protects the personal information of students and employers on the platform.',
  path: '/privacy',
});

export default function PrivacyPage() {
  return <PolicyPage kind="privacy" />;
}
