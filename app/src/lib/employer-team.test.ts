import { describe, it, expect } from 'vitest';
import {
  EMPLOYER_ROLES,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  ROLE_CAPABILITIES,
  roleCan,
  isEmployerRole,
  canTransitionMember,
  inviteExpiresAt,
  isInviteExpired,
  validateInvite,
  isLastActiveMasterAdmin,
  memberDisplayName,
  INVITE_TTL_DAYS,
  type TeamMember,
  type MemberStatus,
} from './employer-team';

function member(overrides: Partial<TeamMember>): TeamMember {
  return {
    id: 'm-1',
    employer_id: 'emp-1',
    user_id: 'u-1',
    role: 'recruiter',
    status: 'active',
    invited_email: 'someone@company.com',
    invited_name: null,
    invited_by: null,
    invite_token: 'tok-1',
    invite_expires_at: null,
    accepted_at: null,
    deactivated_at: null,
    created_at: '2026-08-01T00:00:00Z',
    ...overrides,
  };
}

describe('role library', () => {
  it('contains exactly the six diagram roles', () => {
    expect([...EMPLOYER_ROLES]).toEqual([
      'master_admin', 'recruiting_lead', 'recruiter', 'hiring_manager', 'interviewer', 'approver',
    ]);
  });

  it('has a label, description, and capability bundle for every role', () => {
    for (const role of EMPLOYER_ROLES) {
      expect(ROLE_LABELS[role]).toBeTruthy();
      expect(ROLE_DESCRIPTIONS[role]).toBeTruthy();
      expect(ROLE_CAPABILITIES[role].length).toBeGreaterThan(0);
    }
  });

  it('recognises valid and rejects invalid role names', () => {
    expect(isEmployerRole('recruiter')).toBe(true);
    expect(isEmployerRole('master_admin')).toBe(true);
    expect(isEmployerRole('super_admin')).toBe(false);
    expect(isEmployerRole('')).toBe(false);
  });
});

describe('capability boundaries', () => {
  it('only master_admin can manage the team or edit the company', () => {
    for (const role of EMPLOYER_ROLES) {
      const expected = role === 'master_admin';
      expect(roleCan(role, 'manage_team')).toBe(expected);
      expect(roleCan(role, 'edit_company')).toBe(expected);
    }
  });

  it('interviewers and approvers cannot manage listings or the pipeline', () => {
    for (const role of ['interviewer', 'approver'] as const) {
      expect(roleCan(role, 'manage_listings')).toBe(false);
      expect(roleCan(role, 'manage_pipeline')).toBe(false);
    }
  });

  it('recruiters can run the pipeline but not create listings', () => {
    expect(roleCan('recruiter', 'manage_pipeline')).toBe(true);
    expect(roleCan('recruiter', 'message_candidates')).toBe(true);
    expect(roleCan('recruiter', 'manage_listings')).toBe(false);
    expect(roleCan('recruiting_lead', 'manage_listings')).toBe(true);
  });

  it('every role can at least view candidates', () => {
    for (const role of EMPLOYER_ROLES) {
      expect(roleCan(role, 'view_candidates')).toBe(true);
    }
  });
});

describe('member status machine', () => {
  it('allows only the modeled transitions', () => {
    const allowed: Array<[MemberStatus, MemberStatus]> = [
      ['invited', 'active'],
      ['invited', 'revoked'],
      ['active', 'deactivated'],
      ['deactivated', 'active'],
    ];
    const statuses: MemberStatus[] = ['invited', 'active', 'deactivated', 'revoked'];
    for (const from of statuses) {
      for (const to of statuses) {
        const expected = allowed.some(([f, t]) => f === from && t === to);
        expect(canTransitionMember(from, to), `${from} -> ${to}`).toBe(expected);
      }
    }
  });

  it('revoked is terminal', () => {
    expect(canTransitionMember('revoked', 'active')).toBe(false);
    expect(canTransitionMember('revoked', 'invited')).toBe(false);
  });
});

describe('invite expiry', () => {
  it('expires INVITE_TTL_DAYS after issue', () => {
    const from = new Date('2026-08-03T12:00:00Z');
    const expires = new Date(inviteExpiresAt(from));
    const days = (expires.getTime() - from.getTime()) / (24 * 60 * 60 * 1000);
    expect(days).toBe(INVITE_TTL_DAYS);
  });

  it('flags only past-deadline pending invites as expired', () => {
    const now = new Date('2026-08-10T00:00:00Z');
    expect(isInviteExpired(member({ status: 'invited', invite_expires_at: '2026-08-09T00:00:00Z' }), now)).toBe(true);
    expect(isInviteExpired(member({ status: 'invited', invite_expires_at: '2026-08-11T00:00:00Z' }), now)).toBe(false);
    // Accepted members never read as expired, whatever the old deadline says.
    expect(isInviteExpired(member({ status: 'active', invite_expires_at: '2026-08-01T00:00:00Z' }), now)).toBe(false);
    expect(isInviteExpired(member({ status: 'invited', invite_expires_at: null }), now)).toBe(false);
  });
});

describe('validateInvite', () => {
  it('normalises and accepts a company email with a library role', () => {
    const result = validateInvite({ email: '  Jordan@Company.com ', role: 'recruiter' });
    expect(result).toEqual({ ok: true, email: 'jordan@company.com' });
  });

  it('rejects malformed emails', () => {
    expect(validateInvite({ email: 'not-an-email', role: 'recruiter' }).ok).toBe(false);
    expect(validateInvite({ email: '', role: 'recruiter' }).ok).toBe(false);
  });

  it('rejects personal-mailbox providers, matching the register rule', () => {
    const result = validateInvite({ email: 'jordan@gmail.com', role: 'recruiter' });
    expect(result.ok).toBe(false);
  });

  it('rejects roles outside the library', () => {
    expect(validateInvite({ email: 'jordan@company.com', role: 'ceo' }).ok).toBe(false);
  });
});

describe('isLastActiveMasterAdmin', () => {
  const admin1 = member({ id: 'a1', role: 'master_admin', status: 'active' });
  const admin2 = member({ id: 'a2', role: 'master_admin', status: 'active' });
  const recruiter = member({ id: 'r1', role: 'recruiter', status: 'active' });

  it('is true when no other active master admin exists', () => {
    expect(isLastActiveMasterAdmin([admin1, recruiter], 'a1')).toBe(true);
  });

  it('is false when a backup master admin is active', () => {
    expect(isLastActiveMasterAdmin([admin1, admin2, recruiter], 'a1')).toBe(false);
  });

  it('ignores deactivated and invited master admins as backups', () => {
    const inactiveAdmin = member({ id: 'a3', role: 'master_admin', status: 'deactivated' });
    const invitedAdmin = member({ id: 'a4', role: 'master_admin', status: 'invited' });
    expect(isLastActiveMasterAdmin([admin1, inactiveAdmin, invitedAdmin], 'a1')).toBe(true);
  });

  it('is false for non-admin members', () => {
    expect(isLastActiveMasterAdmin([admin1, recruiter], 'r1')).toBe(false);
  });
});

describe('memberDisplayName', () => {
  it('prefers profile name, then invited name, then email', () => {
    expect(memberDisplayName({ full_name: 'Real Name', invited_name: 'Invite Name', invited_email: 'e@c.com' })).toBe('Real Name');
    expect(memberDisplayName({ invited_name: 'Invite Name', invited_email: 'e@c.com' })).toBe('Invite Name');
    expect(memberDisplayName({ invited_name: null, invited_email: 'e@c.com' })).toBe('e@c.com');
  });
});
