'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';

// Interstitial for email confirmation and password-reset links. The email
// lands here with ?token_hash=&type=, but verification only fires when the
// user clicks the button — corporate mail scanners prefetch links, and the
// token is single-use, so verifying on load would burn it before the user
// arrives.
function ConfirmEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenHash = searchParams.get('token_hash') || '';
  const type = searchParams.get('type') || 'email';
  const isRecovery = type === 'recovery';
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');

  async function handleConfirm() {
    if (confirming || confirmed) return;
    setConfirming(true);
    setError('');

    try {
      const res = await fetch('/api/auth/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token_hash: tokenHash, type }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(
          isRecovery
            ? 'This reset link is invalid or has expired. Request a new one from the Forgot Password page.'
            : 'This confirmation link is invalid or has expired. Request a new one by signing in — ' +
              'we’ll send a fresh link if your email still needs verifying.'
        );
        setConfirming(false);
        return;
      }

      setConfirmed(true);
      router.replace(data.redirectTo || '/login');
    } catch {
      setError('Something went wrong. Please try again.');
      setConfirming(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-container narrow">
        <div className="auth-logo">
          <Link href="/">
            <img
              src="/internfirst-logo.png"
              alt="InternFirst"
            />
          </Link>
        </div>

        {!tokenHash ? (
          <>
            <h1>Link incomplete</h1>
            <p className="auth-subtitle">
              This confirmation link is missing its verification code. Try clicking
              the link in your email again, or copy and paste the full URL.
            </p>
          </>
        ) : (
          <>
            <h1>{isRecovery ? 'Reset your password' : 'Confirm your email'}</h1>
            <p className="auth-subtitle">
              {isRecovery
                ? 'Continue below to choose a new password for your InternFirst account.'
                : "You're one click away from activating your InternFirst account."}
            </p>

            {error && (
              <div className="auth-error" style={{ display: 'block' }}>{error}</div>
            )}

            <button
              type="button"
              className="btn-auth"
              onClick={handleConfirm}
              disabled={confirming || confirmed}
              style={{ marginTop: '8px' }}
            >
              {confirmed
                ? 'Verified! Redirecting...'
                : confirming
                  ? 'Verifying...'
                  : isRecovery
                    ? 'Reset my password'
                    : 'Confirm my email'}
            </button>
          </>
        )}

        <p className="auth-footer">
          {isRecovery
            ? <Link href="/forgot-password">Request a new link</Link>
            : <>Already verified? <Link href="/login">Sign in</Link></>}
        </p>
      </div>
    </div>
  );
}

export default function ConfirmEmailPage() {
  return (
    <Suspense>
      <ConfirmEmailContent />
    </Suspense>
  );
}
