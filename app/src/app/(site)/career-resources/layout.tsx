import type { Metadata } from 'next';

// The four cards here describe services that don't exist yet — every
// "Get Started" link loops back to this same page. Real, signed-in resources
// live at /dashboard/student/resources. Keep this out of the index until the
// public version has somewhere to send people.
//
// Delete this file and re-add the route to app/sitemap.ts once it does.
export const metadata: Metadata = {
  title: 'Career Resources',
  robots: { index: false, follow: true },
};

export default function CareerResourcesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
