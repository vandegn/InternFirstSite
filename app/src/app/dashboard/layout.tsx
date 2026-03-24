'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase, getProfile, DASHBOARD_ROUTES } from '@/lib/supabase';
import DashboardShell from '@/components/DashboardShell';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authorized, setAuthorized] = useState(false);
  const [role, setRole] = useState<string | null>(null);

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

      setRole(profile.role);
      setAuthorized(true);
    }

    checkAccess();
  }, [pathname, router]);

  if (!authorized || !role) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#888' }}>
        Loading...
      </div>
    );
  }

  return (
    <DashboardShell role={role}>
      {children}
    </DashboardShell>
  );
}
