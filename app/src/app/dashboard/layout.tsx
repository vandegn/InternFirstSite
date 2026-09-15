'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase, getProfile, ensureProfileFromMetadata, getStudentByUserId, getStudentEeo, DASHBOARD_ROUTES } from '@/lib/supabase';
import DashboardShell from '@/components/DashboardShell';
import { analytics } from '@heycatch/sdk';

const STUDENT_WELCOME_PATH = '/dashboard/student/welcome';

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

      let profile = await getProfile(user.id);

      // Self-heal: the profile row is normally created by /auth/callback, but
      // accounts confirmed via a password-recovery link never hit that route.
      // Signup stashes everything needed in user_metadata, so rebuild from it.
      let signupJustCompleted = false;
      if (!profile) {
        try {
          const profileState = await ensureProfileFromMetadata(supabase, user);
          if (profileState) {
            signupJustCompleted = profileState === 'created';
            profile = await getProfile(user.id);
          }
        } catch (e) {
          console.error('[DashboardLayout] profile self-heal failed', e);
        }
      }

      if (!profile) {
        router.replace('/register');
        return;
      }

      // Every signed-in session passes through here, whichever way the user got
      // in (password, Google, invite link), so this is where analytics learns
      // who they are. setIdentity is safe to repeat on each navigation.
      analytics.setIdentity(
        user.id,
        { email: user.email, name: profile.full_name, role: profile.role },
        { signup_date: user.created_at },
      );
      // Signup normally completes server-side in /auth/callback, which sends its
      // own event. This covers the self-heal path, where it completes here.
      if (signupJustCompleted) {
        analytics.trackEvent('signup_completed', { role: profile.role });
      }

      const allowedPath = DASHBOARD_ROUTES[profile.role];

      if (!allowedPath || !pathname.startsWith(allowedPath)) {
        router.replace(allowedPath || '/login');
        return;
      }

      // Students must complete the voluntary self-id welcome screen before
      // accessing the rest of the dashboard. The welcome page itself is exempt.
      if (profile.role === 'student' && pathname !== STUDENT_WELCOME_PATH) {
        const student = await getStudentByUserId(user.id);
        if (student) {
          const eeo = await getStudentEeo(student.id);
          if (!eeo) {
            router.replace(STUDENT_WELCOME_PATH);
            return;
          }
        }
      }

      setRole(profile.role);
      setAuthorized(true);
    }

    checkAccess();
  }, [pathname, router]);

  if (!authorized || !role) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div className="spinner" role="status" aria-label="Loading" />
      </div>
    );
  }

  return (
    <DashboardShell role={role}>
      {children}
    </DashboardShell>
  );
}
