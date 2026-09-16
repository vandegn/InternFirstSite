'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { trackProductEvent } from '@/lib/product-analytics-client';

export default function ProductAnalytics() {
  const pathname = usePathname();
  useEffect(() => {
    const listing = pathname.match(/^\/internships\/([0-9a-f-]{36})$/i);
    if (listing) trackProductEvent('listing_viewed', { listingId: listing[1] });
  }, [pathname]);
  useEffect(() => {
    function click(event: MouseEvent) {
      const target = event.target instanceof Element ? event.target.closest('a,button') : null;
      if (!target || target.hasAttribute('disabled')) return;
      const href = target.getAttribute('href')?.split('?')[0];
      const cta = target.getAttribute('data-analytics-cta') || (href === '/register' ? 'register' : href === '/dashboard/employer/listings/new' ? 'post_job' : href === '/internships' ? 'browse_internships' : href === '/waitlist' ? 'waitlist' : null);
      if (cta) trackProductEvent('cta_clicked', { cta });
    }
    document.addEventListener('click', click, true);
    return () => document.removeEventListener('click', click, true);
  }, []);
  return null;
}
