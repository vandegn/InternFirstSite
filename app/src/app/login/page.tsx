'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import RoleSelector from '@/components/RoleSelector';
import { supabase, getProfile, DASHBOARD_ROUTES } from '@/lib/supabase';

type Role = 'student' | 'employer' | 'university_admin';

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role>('student');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    const profile = await getProfile(data.user.id);
    const dashRole = profile?.role || role;
    router.push(DASHBOARD_ROUTES[dashRole] || '/dashboard/student');
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
        <div className="auth-logo">
          <Link href="/">
            <img src="https://internfirst-demo.com/wp-content/uploads/2026/02/Top-Rated-2.png" alt="InternFirst" />
          </Link>
        </div>
        <h1>Login</h1>
        <p className="auth-subtitle">Welcome back. Select your role and sign in.</p>

        <RoleSelector selected={role} onChange={setRole} />

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
            <input
              type="password"
              id="password"
              placeholder="Enter your password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="form-row-between">
            <div className="remember-me">
              <input type="checkbox" id="remember" />
              <label htmlFor="remember">Remember me</label>
            </div>
            <a href="#" className="forgot-link">Forgot password?</a>
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
