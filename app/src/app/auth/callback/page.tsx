'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase, createProfileAndRoleData, DASHBOARD_ROUTES } from '@/lib/supabase';
import { Suspense } from 'react';

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState('');

  useEffect(() => {
    async function handleCallback() {
      const code = searchParams.get('code');

      if (!code) {
        router.replace('/login?error=missing_code');
        return;
      }

      // Exchange the code for a session (browser client has the PKCE code_verifier in localStorage)
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

      if (exchangeError) {
        console.error('Code exchange failed:', exchangeError);
        router.replace('/login?error=verification_failed');
        return;
      }

      // Get the authenticated user and their metadata
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace('/login?error=no_user');
        return;
      }

      const metadata = user.user_metadata;
      const role = metadata?.role as string;

      if (!role) {
        router.replace('/login');
        return;
      }

      // Idempotency check: skip profile creation if it already exists
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!existingProfile) {
        const roleData: Record<string, string | undefined> = {};

        if (role === 'student') {
          roleData.major = metadata.major;
          roleData.graduationYear = metadata.graduationYear;
        } else if (role === 'employer') {
          roleData.companyName = metadata.companyName;
          roleData.website = metadata.website;
          roleData.companyDescription = metadata.companyDescription;
        } else if (role === 'university_admin') {
          roleData.universityId = metadata.universityId;
          roleData.jobTitle = metadata.jobTitle;
        }

        try {
          await createProfileAndRoleData(supabase, user.id, {
            role,
            fullName: metadata.fullName || '',
            email: user.email || '',
            phone: metadata.phone,
            roleData,
          });
        } catch (err) {
          console.error('Profile creation failed:', err);
          setError('Account verified but profile setup failed. Please try logging in.');
          return;
        }
      }

      // Redirect to the role-appropriate dashboard
      router.replace(DASHBOARD_ROUTES[role] || '/dashboard/student');
    }

    handleCallback();
  }, [router, searchParams]);

  if (error) {
    return (
      <div className="auth-page">
        <div className="auth-container narrow">
          <div className="auth-error" style={{ display: 'block' }}>{error}</div>
          <a href="/login" className="btn-auth" style={{ display: 'block', textAlign: 'center', marginTop: '16px' }}>
            Go to Login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#888' }}>
      Verifying your email...
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense>
      <CallbackContent />
    </Suspense>
  );
}
