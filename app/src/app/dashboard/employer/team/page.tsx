'use client';

// Team administration for the employer account. Master Admins invite
// teammates, assign role bundles from the role library, and (de)activate
// members; everyone else sees a read-only roster. All writes go through
// /api/employer/team so the guards in employer-team-service.ts apply.

import { useState, useEffect, useCallback } from 'react';
import Avatar from '@/components/Avatar';
import {
  EMPLOYER_ROLES,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  memberDisplayName,
  inviteJoinPath,
  roleCan,
  type EmployerRole,
} from '@/lib/employer-team';

type RosterMember = {
  id: string;
  user_id: string | null;
  role: EmployerRole;
  status: 'invited' | 'active' | 'deactivated';
  invited_email: string;
  invited_name: string | null;
  invite_token?: string | null;
  invite_expires_at: string | null;
  invite_expired: boolean;
  accepted_at: string | null;
  full_name: string | null;
};

type Me = { memberId: string; role: EmployerRole };

const STATUS_CHIP: Record<string, { label: string; bg: string; fg: string }> = {
  active: { label: 'Active', bg: '#d1fae5', fg: '#065f46' },
  invited: { label: 'Invited', bg: '#e0e7ff', fg: '#3730a3' },
  expired: { label: 'Invite expired', bg: '#fef3c7', fg: '#92400e' },
  deactivated: { label: 'Deactivated', bg: '#f3f4f6', fg: '#6b7280' },
};

export default function EmployerTeamPage() {
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<RosterMember[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Invite form
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<EmployerRole>('recruiter');
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteError, setInviteError] = useState('');

  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);

  const loadTeam = useCallback(async () => {
    try {
      const res = await fetch('/api/employer/team');
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Failed to load team');
      setMembers(body.members);
      setMe(body.me);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load team');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTeam(); }, [loadTeam]);

  const isAdmin = !!me && roleCan(me.role, 'manage_team');

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteError('');
    setInviteSending(true);
    try {
      const res = await fetch('/api/employer/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, name: inviteName, role: inviteRole }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Failed to send invitation');
      setInviteEmail('');
      setInviteName('');
      setInviteRole('recruiter');
      setShowInvite(false);
      setNotice(`Invitation sent to ${body.invited_email}.`);
      await loadTeam();
    } catch (e2) {
      setInviteError(e2 instanceof Error ? e2.message : 'Failed to send invitation');
    } finally {
      setInviteSending(false);
    }
  }

  async function memberAction(memberId: string, run: () => Promise<Response>, doneNotice?: string) {
    setBusyMemberId(memberId);
    setNotice('');
    setError('');
    try {
      const res = await run();
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Action failed');
      if (doneNotice) setNotice(doneNotice);
      await loadTeam();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusyMemberId(null);
    }
  }

  const handleRoleChange = (m: RosterMember, role: string) =>
    memberAction(m.id, () => fetch(`/api/employer/team/${m.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    }));

  const handleSetActive = (m: RosterMember, active: boolean) =>
    memberAction(m.id, () => fetch(`/api/employer/team/${m.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active }),
    }), active ? 'Member reactivated.' : 'Member deactivated.');

  const handleResend = (m: RosterMember) =>
    memberAction(m.id, () => fetch(`/api/employer/team/${m.id}/resend`, { method: 'POST' }),
      `Invitation to ${m.invited_email} resent.`);

  const handleRevoke = (m: RosterMember) =>
    memberAction(m.id, () => fetch(`/api/employer/team/${m.id}`, { method: 'DELETE' }),
      'Invitation revoked.');

  async function handleCopyLink(m: RosterMember) {
    if (!m.invite_token) return;
    const url = `${window.location.origin}${inviteJoinPath(m.invite_token)}`;
    await navigator.clipboard.writeText(url);
    setNotice('Invite link copied — anyone opening it must sign in with the invited email.');
  }

  if (loading) {
    return (
      <div className="dash-main" style={{ padding: '32px', color: 'var(--text-secondary)' }}>
        Loading...
      </div>
    );
  }

  const btnSmall: React.CSSProperties = {
    padding: '6px 12px', fontSize: '13px', fontWeight: 600, borderRadius: '8px',
    border: '1px solid var(--border)', background: 'var(--surface)',
    color: 'var(--text-secondary)', cursor: 'pointer',
  };

  return (
    <div className="dash-main" style={{ padding: '32px', maxWidth: 960 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', margin: 0 }}>Team</h1>
          <p style={{ color: 'var(--text-secondary)', margin: '6px 0 0', fontSize: '0.95rem' }}>
            {isAdmin
              ? 'Invite teammates and assign each a role from the role library. Invitations expire after 7 days.'
              : 'Your company’s recruiting team. Ask a Master Admin to make changes.'}
          </p>
        </div>
        {isAdmin && (
          <button className="btn-primary" style={{ whiteSpace: 'nowrap' }} onClick={() => { setShowInvite(!showInvite); setInviteError(''); }}>
            {showInvite ? 'Close' : '+ Invite Teammate'}
          </button>
        )}
      </div>

      {error && (
        <div style={{ background: '#fef2f2', color: '#991b1b', padding: '10px 14px', borderRadius: 10, margin: '12px 0', fontSize: '0.9rem' }}>
          {error}
        </div>
      )}
      {notice && (
        <div style={{ background: '#ecfdf5', color: '#065f46', padding: '10px 14px', borderRadius: 10, margin: '12px 0', fontSize: '0.9rem' }}>
          {notice}
        </div>
      )}

      {isAdmin && showInvite && (
        <form
          onSubmit={handleInvite}
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, margin: '16px 0' }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label htmlFor="invite-email">Work email</label>
              <input
                id="invite-email" type="email" required placeholder="teammate@company.com"
                value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="invite-name">Name (optional)</label>
              <input
                id="invite-name" type="text" placeholder="Jordan Smith"
                value={inviteName} onChange={(e) => setInviteName(e.target.value)}
              />
            </div>
          </div>
          <div className="form-group" style={{ marginTop: 8 }}>
            <label htmlFor="invite-role">Role</label>
            <select id="invite-role" value={inviteRole} onChange={(e) => setInviteRole(e.target.value as EmployerRole)}>
              {EMPLOYER_ROLES.map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '6px 0 0' }}>
              {ROLE_DESCRIPTIONS[inviteRole]}
            </p>
          </div>
          {inviteError && <div style={{ color: '#991b1b', fontSize: '0.88rem', marginTop: 8 }}>{inviteError}</div>}
          <button type="submit" className="btn-primary" disabled={inviteSending} style={{ marginTop: 12 }}>
            {inviteSending ? 'Sending…' : 'Send Invitation'}
          </button>
        </form>
      )}

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, marginTop: 16, overflow: 'hidden' }}>
        {members.map((m, i) => {
          const chipKey = m.status === 'invited' && m.invite_expired ? 'expired' : m.status;
          const chip = STATUS_CHIP[chipKey];
          const busy = busyMemberId === m.id;
          const isSelf = me?.memberId === m.id;
          return (
            <div
              key={m.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px',
                borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                opacity: m.status === 'deactivated' ? 0.6 : 1,
              }}
            >
              <Avatar src={null} name={memberDisplayName(m)} size={38} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                  {memberDisplayName(m)}
                  {isSelf && <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}> (you)</span>}
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {m.invited_email}
                </div>
              </div>

              <span style={{ background: chip.bg, color: chip.fg, fontSize: '0.75rem', fontWeight: 700, padding: '3px 10px', borderRadius: 20, whiteSpace: 'nowrap' }}>
                {chip.label}
              </span>

              {isAdmin && m.status !== 'invited' ? (
                <select
                  value={m.role}
                  disabled={busy}
                  onChange={(e) => handleRoleChange(m, e.target.value)}
                  style={{ fontSize: '0.85rem', padding: '6px 8px', borderRadius: 8, border: '1px solid var(--border)' }}
                  aria-label={`Role for ${memberDisplayName(m)}`}
                >
                  {EMPLOYER_ROLES.map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
              ) : (
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  {ROLE_LABELS[m.role]}
                </span>
              )}

              {isAdmin && (
                <div style={{ display: 'flex', gap: 6 }}>
                  {m.status === 'invited' && (
                    <>
                      <button style={btnSmall} disabled={busy} onClick={() => handleResend(m)}>Resend</button>
                      <button style={btnSmall} disabled={busy} onClick={() => handleCopyLink(m)}>Copy link</button>
                      <button style={{ ...btnSmall, color: '#991b1b' }} disabled={busy} onClick={() => handleRevoke(m)}>Revoke</button>
                    </>
                  )}
                  {m.status === 'active' && !isSelf && (
                    <button style={{ ...btnSmall, color: '#991b1b' }} disabled={busy} onClick={() => handleSetActive(m, false)}>Deactivate</button>
                  )}
                  {m.status === 'deactivated' && (
                    <button style={btnSmall} disabled={busy} onClick={() => handleSetActive(m, true)}>Reactivate</button>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {members.length === 0 && (
          <div style={{ padding: '24px 20px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            No team members yet.
          </div>
        )}
      </div>
    </div>
  );
}
