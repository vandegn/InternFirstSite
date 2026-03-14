'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase, getProfile, DASHBOARD_ROUTES } from '@/lib/supabase';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    async function checkAccess() {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.replace('/login');
        return;
      }

      const profile = await getProfile(user.id);

      if (!profile) {
        router.replace('/register');
        return;
      }

      const allowedPath = DASHBOARD_ROUTES[profile.role];

      if (!allowedPath || !pathname.startsWith(allowedPath)) {
        router.replace(allowedPath || '/login');
        return;
      }

      setAuthorized(true);
    }

    checkAccess();
  }, [pathname, router]);

  if (!authorized) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#888' }}>
        Loading...
      </div>
    );
  }

  return <>{children}</>;
}
