'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import RoleSelector from '@/components/RoleSelector';
import PasswordInput from '@/components/PasswordInput';
import { supabase, getProfile, DASHBOARD_ROUTES, isEduEmail } from '@/lib/supabase';

type Role = 'student' | 'employer';

const VALID_ROLES: Role[] = ['student', 'employer'];

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roleParam = searchParams.get('role');
  const initialRole = VALID_ROLES.includes(roleParam as Role) ? (roleParam as Role) : 'student';
  const [role, setRole] = useState<Role>(initialRole);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Map callback error codes to user-friendly messages
  const ERROR_MESSAGES: Record<string, string> = {
    missing_code: 'Verification link was invalid. Please try again.',
    verification_failed: 'Email verification failed. Please try again or request a new link.',
    no_user: 'Something went wrong during verification. Please try again.',
    profile_creation_failed: 'Account verified but profile setup failed. Please try logging in — if the issue persists, contact support.',
  };

  const errorParam = searchParams.get('error');
  const callbackError = errorParam ? ERROR_MESSAGES[errorParam] || '' : '';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (role === 'student' && !isEduEmail(email)) {
      setError('Student accounts require a .edu email address.');
      return;
    }

    setLoading(true);

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      // Supabase returns this message when email is not confirmed
      if (authError.message === 'Email not confirmed') {
        setLoading(false);
        router.push(`/verify-email?email=${encodeURIComponent(email)}`);
        return;
      }
      setError(authError.message);
      setLoading(false);
      return;
    }

    try {
      const profile = await getProfile(data.user.id);
      const dashRole = profile?.role || role;
      const nextParam = searchParams.get('next');
      // Only honor same-origin paths to prevent open-redirect attacks
      const safeNext = nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : null;
      router.push(safeNext || DASHBOARD_ROUTES[dashRole] || '/dashboard/student');
    } catch {
      setError('Login succeeded but failed to load your profile. Please try again.');
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/dashboard/student',
      },
    });
    if (authError) setError(authError.message);
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <button
          type="button"
          onClick={() => { if (typeof window !== 'undefined' && window.history.length > 1) router.back(); else router.push('/'); }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
            color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500, marginBottom: '4px',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          Back
        </button>
        <div className="auth-logo">
          <Link href="/">
            <img src="https://internfirst-demo.com/wp-content/uploads/2026/02/Top-Rated-2.png" alt="InternFirst" />
          </Link>
        </div>
        <h1>Login</h1>
        <p className="auth-subtitle">Welcome back. Select your role and sign in.</p>

        <RoleSelector selected={role} onChange={setRole} />

        {callbackError && <div className="auth-error" style={{ display: 'block' }}>{callbackError}</div>}
        {error && <div className="auth-error" style={{ display: 'block' }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              placeholder="Enter your email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <PasswordInput
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              autoComplete="current-password"
            />
          </div>

          <div className="form-row-between" style={{ justifyContent: 'flex-end' }}>
            <Link href="/forgot-password" className="forgot-link">Forgot password?</Link>
          </div>

          <button type="submit" className="btn-auth" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="divider"><span>OR</span></div>

        <button className="btn-google" onClick={handleGoogleLogin}>
          <svg viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
          Continue with Google
        </button>

        <p className="auth-footer">Don&apos;t have an account? <Link href="/register">Create one</Link></p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
