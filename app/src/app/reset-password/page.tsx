'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    // Supabase automatically picks up the token from the URL hash
    // and establishes a session. We wait for that before showing the form.
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSessionReady(true);
      }
    });

    // Also check if we already have a session (e.g. user refreshed)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setSessionReady(true);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);

    // Redirect to login after a short delay
    setTimeout(() => router.push('/login'), 3000);
  }

  return (
    <div className="auth-page">
      <div className="auth-container narrow">
        <div className="auth-logo">
          <Link href="/">
            <img
              src="https://internfirst-demo.com/wp-content/uploads/2026/02/Top-Rated-2.png"
              alt="InternFirst"
            />
          </Link>
        </div>

        {success ? (
          <>
            <h1>Password updated</h1>
            <p className="auth-subtitle">
              Your password has been reset successfully. Redirecting you to sign
              in...
            </p>
            <Link href="/login" className="btn-auth" style={{ display: 'block', textAlign: 'center' }}>
              Sign In
            </Link>
          </>
        ) : !sessionReady ? (
          <>
            <h1>Verifying link...</h1>
            <p className="auth-subtitle">
              Please wait while we verify your reset link. If this takes too
              long, the link may have expired.
            </p>
            <p className="auth-footer">
              <Link href="/forgot-password">Request a new link</Link>
            </p>
          </>
        ) : (
          <>
            <h1>Set a new password</h1>
            <p className="auth-subtitle">
              Choose a new password for your account.
            </p>

            {error && (
              <div className="auth-error" style={{ display: 'block' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="password">New Password</label>
                <input
                  type="password"
                  id="password"
                  placeholder="At least 6 characters"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ marginTop: '16px' }}>
                <label htmlFor="confirm">Confirm Password</label>
                <input
                  type="password"
                  id="confirm"
                  placeholder="Re-enter your password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>

              <button
                type="submit"
                className="btn-auth"
                disabled={loading}
                style={{ marginTop: '28px' }}
              >
                {loading ? 'Updating...' : 'Update Password'}
              </button>
            </form>

            <p className="auth-footer">
              <Link href="/login">Back to sign in</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
