'use client';

// Landing page for a team-invitation link. The token in the URL is the
// credential for *reading* the invite; accepting additionally requires
// signing in (or creating a login) with the invited email address.

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { validatePassword } from '@/lib/password';

type InviteInfo = {
  state: 'valid' | 'expired' | 'revoked' | 'accepted';
  companyName: string;
  roleLabel: string;
  invitedEmail: string;
  invitedName: string | null;
  hasAccount: boolean;
};

export default function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [loadError, setLoadError] = useState('');
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const [{ data: { user } }, res] = await Promise.all([
          supabase.auth.getUser(),
          fetch(`/api/employer/team/invite/${token}`),
        ]);
        setSessionEmail(user?.email ?? null);
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || 'This invitation link is not valid.');
        setInvite(body);
        if (body.invitedName) setFullName(body.invitedName);
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : 'This invitation link is not valid.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);

  async function accept(extra?: { fullName: string; password: string }) {
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/employer/team/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, ...extra }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Failed to accept invitation');

      // New-account path: the accept call created the login; sign in with it.
      if (extra) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: invite!.invitedEmail,
          password: extra.password,
        });
        if (signInError) throw signInError;
      }
      router.replace('/dashboard/employer');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to accept invitation');
      setSubmitting(false);
    }
  }

  async function handleCreateAndAccept(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) { setError('Enter your name.'); return; }
    const pwError = validatePassword(password);
    if (pwError) { setError(pwError); return; }
    await accept({ fullName: fullName.trim(), password });
  }

  // Signed in with a different email: accepting would attach the wrong person.
  async function handleSwitchAccount() {
    await supabase.auth.signOut();
    setSessionEmail(null);
  }

  function frame(children: React.ReactNode) {
    return (
      <div className="auth-page">
        <div className="auth-container" style={{ maxWidth: 480 }}>
          <div className="auth-logo">
            <Link href="/">
              <img src="/internfirst-logo.png" alt="InternFirst" />
            </Link>
          </div>
          {children}
        </div>
      </div>
    );
  }

  if (loading) return frame(<p style={{ color: 'var(--text-secondary)' }}>Loading invitation…</p>);

  if (loadError || !invite) {
    return frame(
      <>
        <h1>Invitation not found</h1>
        <p className="auth-subtitle">{loadError || 'This invitation link is not valid.'}</p>
      </>,
    );
  }

  if (invite.state === 'revoked') {
    return frame(
      <>
        <h1>Invitation revoked</h1>
        <p className="auth-subtitle">This invitation is no longer active. Contact your company&apos;s Master Admin for a new one.</p>
      </>,
    );
  }

  if (invite.state === 'expired') {
    return frame(
      <>
        <h1>Invitation expired</h1>
        <p className="auth-subtitle">
          Invitations are valid for 7 days. Ask the Master Admin at {invite.companyName} to resend it.
        </p>
      </>,
    );
  }

  if (invite.state === 'accepted') {
    return frame(
      <>
        <h1>Already accepted</h1>
        <p className="auth-subtitle">This invitation has already been used.</p>
        <Link href="/login" className="btn-primary" style={{ display: 'inline-block', marginTop: 8 }}>Sign In</Link>
      </>,
    );
  }

  const header = (
    <>
      <h1>Join {invite.companyName}</h1>
      <p className="auth-subtitle">
        You&apos;ve been invited to join <strong>{invite.companyName}</strong>&apos;s recruiting team on InternFirst
        as <strong>{invite.roleLabel}</strong>. This invitation was sent to <strong>{invite.invitedEmail}</strong>.
      </p>
      {error && <div className="auth-error" style={{ display: 'block' }}>{error}</div>}
    </>
  );

  // Signed in already
  if (sessionEmail) {
    const matches = sessionEmail.toLowerCase() === invite.invitedEmail.toLowerCase();
    return frame(
      <>
        {header}
        {matches ? (
          <button className="btn-primary" disabled={submitting} onClick={() => accept()} style={{ width: '100%' }}>
            {submitting ? 'Joining…' : `Join ${invite.companyName}`}
          </button>
        ) : (
          <>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              You are signed in as <strong>{sessionEmail}</strong>, but this invitation is
              for <strong>{invite.invitedEmail}</strong>. Switch accounts to accept it.
            </p>
            <button className="btn-primary" onClick={handleSwitchAccount} style={{ width: '100%' }}>
              Sign out and switch
            </button>
          </>
        )}
      </>,
    );
  }

  // Not signed in, but the invited email already has a login
  if (invite.hasAccount) {
    return frame(
      <>
        {header}
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          Sign in as <strong>{invite.invitedEmail}</strong>, then open this invitation link again to accept it.
        </p>
        <Link href="/login" className="btn-primary" style={{ display: 'inline-block', width: '100%', textAlign: 'center' }}>
          Sign In
        </Link>
      </>,
    );
  }

  // Not signed in, no account yet: create the login as part of accepting
  return frame(
    <>
      {header}
      <form onSubmit={handleCreateAndAccept}>
        <div className="form-group">
          <label htmlFor="join-name">Full Name</label>
          <input id="join-name" type="text" required placeholder="Jordan Smith" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div className="form-group">
          <label htmlFor="join-password">Create a Password</label>
          <input id="join-password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <button type="submit" className="btn-primary" disabled={submitting} style={{ width: '100%', marginTop: 8 }}>
          {submitting ? 'Creating your account…' : `Create Account & Join ${invite.companyName}`}
        </button>
      </form>
    </>,
  );
}
