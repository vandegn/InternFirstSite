import { describe, it, expect, beforeEach } from 'vitest';
import {
  listTeam,
  inviteMember,
  resendInvite,
  revokeInvite,
  getInviteInfo,
  acceptInvite,
  changeMemberRole,
  setMemberActive,
  type TeamRepo,
  type MemberProfile,
  type TeamAuditAction,
} from './employer-team-service';
import { type TeamMember } from './employer-team';

// ============================================
// In-memory repo
// ============================================
// Stands in for Supabase + the auth admin API so every team flow can be
// driven end to end: invitations, acceptance (both paths), role changes,
// (de)activation, and the audit rows each of them must leave behind.

const ADMIN_USER = 'user-admin';          // master admin of employer-1 (the original owner)
const OTHER_ADMIN_USER = 'user-admin-2';  // master admin of employer-2
const STUDENT_USER = 'user-student';

const EMPLOYER_1 = 'employer-1';
const EMPLOYER_2 = 'employer-2';

type Captured = {
  members: Map<string, TeamMember>;
  events: Array<{ employer_id: string; actor_user_id: string | null; action: TeamAuditAction; subject_email: string; prior?: unknown; next?: unknown }>;
  emails: Array<{ to: string; token: string; companyName: string }>;
  profiles: Map<string, MemberProfile>;
  createdAccounts: Array<{ email: string; password: string }>;
};

function makeRepo() {
  let seq = 0;
  const nextId = (prefix: string) => `${prefix}-${++seq}`;

  const captured: Captured = {
    members: new Map(),
    events: [],
    emails: [],
    profiles: new Map([
      [ADMIN_USER, { user_id: ADMIN_USER, email: 'owner@acme.com', role: 'employer', full_name: 'Acme Owner' }],
      [OTHER_ADMIN_USER, { user_id: OTHER_ADMIN_USER, email: 'owner@globex.com', role: 'employer', full_name: 'Globex Owner' }],
      [STUDENT_USER, { user_id: STUDENT_USER, email: 'student@school.edu', role: 'student', full_name: 'Student One' }],
    ]),
    createdAccounts: [],
  };

  // The backfilled owner rows the migration would create.
  function seedOwner(memberId: string, employerId: string, userId: string, email: string) {
    captured.members.set(memberId, {
      id: memberId,
      employer_id: employerId,
      user_id: userId,
      role: 'master_admin',
      status: 'active',
      invited_email: email,
      invited_name: null,
      invited_by: null,
      invite_token: null,
      invite_expires_at: null,
      accepted_at: '2026-08-01T00:00:00Z',
      deactivated_at: null,
      created_at: '2026-08-01T00:00:00Z',
    });
  }
  seedOwner('owner-1', EMPLOYER_1, ADMIN_USER, 'owner@acme.com');
  seedOwner('owner-2', EMPLOYER_2, OTHER_ADMIN_USER, 'owner@globex.com');

  const repo: TeamRepo = {
    async getActiveMembership(userId) {
      for (const m of captured.members.values()) {
        if (m.user_id === userId && m.status === 'active') return m;
      }
      return null;
    },
    async getAnyMembershipForUser(userId) {
      for (const m of captured.members.values()) {
        if (m.user_id === userId && m.status !== 'revoked') return m;
      }
      return null;
    },
    async getEmployer(employerId) {
      if (employerId === EMPLOYER_1) return { id: EMPLOYER_1, company_name: 'Acme' };
      if (employerId === EMPLOYER_2) return { id: EMPLOYER_2, company_name: 'Globex' };
      return null;
    },
    async listMembers(employerId) {
      return [...captured.members.values()].filter((m) => m.employer_id === employerId);
    },
    async getMember(memberId) {
      return captured.members.get(memberId) ?? null;
    },
    async getMemberByToken(token) {
      for (const m of captured.members.values()) {
        if (m.invite_token === token) return m;
      }
      return null;
    },
    async insertMember(row) {
      const memberRow: TeamMember = {
        id: nextId('member'),
        user_id: null,
        invited_name: null,
        invite_token: nextId('token'),
        accepted_at: null,
        deactivated_at: null,
        created_at: new Date().toISOString(),
        ...row,
      };
      captured.members.set(memberRow.id, memberRow);
      return memberRow;
    },
    async updateMember(memberId, patch) {
      const existing = captured.members.get(memberId);
      if (!existing) throw new Error('member not found');
      const updated = { ...existing, ...patch };
      captured.members.set(memberId, updated);
      return updated;
    },
    async getProfileById(userId) {
      return captured.profiles.get(userId) ?? null;
    },
    async findProfileByEmail(email) {
      for (const p of captured.profiles.values()) {
        if (p.email.toLowerCase() === email.toLowerCase()) return p;
      }
      return null;
    },
    async createEmployerAccount({ email, password, fullName }) {
      const userId = nextId('user');
      captured.profiles.set(userId, { user_id: userId, email, role: 'employer', full_name: fullName });
      captured.createdAccounts.push({ email, password });
      return { userId };
    },
    async recordEvent(row) {
      captured.events.push(row);
    },
    async sendInviteEmail({ to, token, companyName }) {
      captured.emails.push({ to, token, companyName });
    },
  };

  return { repo, captured };
}

let repo: TeamRepo;
let captured: Captured;

beforeEach(() => {
  ({ repo, captured } = makeRepo());
});

const invite = (email = 'new.recruiter@acme.com', role = 'recruiter', userId = ADMIN_USER) =>
  inviteMember(repo, { userId, email, role });

describe('inviting', () => {
  it('creates a pending invite, emails the join link, and audits it', async () => {
    const result = await invite();
    expect(result.status).toBe(200);
    const body = result.body as TeamMember;
    expect(body.status).toBe('invited');
    expect(body.role).toBe('recruiter');
    expect(body.invited_email).toBe('new.recruiter@acme.com');
    expect(body.invite_expires_at).toBeTruthy();

    expect(captured.emails).toHaveLength(1);
    expect(captured.emails[0].to).toBe('new.recruiter@acme.com');
    expect(captured.emails[0].companyName).toBe('Acme');

    expect(captured.events).toEqual([
      expect.objectContaining({ action: 'invite_sent', employer_id: EMPLOYER_1, actor_user_id: ADMIN_USER, subject_email: 'new.recruiter@acme.com' }),
    ]);
  });

  it('rejects non-members and non-master-admins', async () => {
    expect((await invite('a@acme.com', 'recruiter', 'user-nobody')).status).toBe(403);

    // Promote a recruiter into the team, then have them try to invite.
    await invite('recruiter@acme.com');
    const accept = await acceptInvite(repo, {
      token: tokenFor('recruiter@acme.com'),
      fullName: 'Rec Ruiter',
      password: 'Str0ng-Passw0rd!',
    });
    expect(accept.status).toBe(200);
    const recruiterUserId = [...captured.profiles.values()].find((p) => p.email === 'recruiter@acme.com')!.user_id;

    const denied = await inviteMember(repo, { userId: recruiterUserId, email: 'x@acme.com', role: 'recruiter' });
    expect(denied.status).toBe(403);
  });

  it('rejects invalid emails, personal mailboxes, and unknown roles', async () => {
    expect((await invite('nope', 'recruiter')).status).toBe(400);
    expect((await invite('someone@gmail.com', 'recruiter')).status).toBe(400);
    expect((await invite('someone@acme.com', 'ceo')).status).toBe(400);
  });

  it('rejects duplicates: pending invite, active member, other-company member, student email', async () => {
    await invite();
    expect((await invite()).status).toBe(409);                                       // pending invite
    expect((await invite('owner@acme.com')).status).toBe(409);                       // already active here
    expect((await invite('owner@globex.com')).status).toBe(409);                     // belongs to another company
    expect((await invite('student@school.edu')).status).toBe(409);                   // non-employer account
  });
});

function tokenFor(email: string): string {
  for (const m of captured.members.values()) {
    if (m.invited_email === email && m.invite_token) return m.invite_token;
  }
  throw new Error(`no token for ${email}`);
}

describe('accepting', () => {
  it('new-account path: creates the login, activates membership, audits', async () => {
    await invite();
    const result = await acceptInvite(repo, {
      token: tokenFor('new.recruiter@acme.com'),
      fullName: 'New Recruiter',
      password: 'Str0ng-Passw0rd!',
    });
    expect(result.status).toBe(200);
    expect((result.body as { role: string }).role).toBe('recruiter');
    expect(captured.createdAccounts).toEqual([{ email: 'new.recruiter@acme.com', password: 'Str0ng-Passw0rd!' }]);

    const member = [...captured.members.values()].find((m) => m.invited_email === 'new.recruiter@acme.com')!;
    expect(member.status).toBe('active');
    expect(member.user_id).toBeTruthy();
    expect(member.accepted_at).toBeTruthy();
    expect(captured.events.map((e) => e.action)).toEqual(['invite_sent', 'invite_accepted']);
  });

  it('signed-in path: requires an employer profile whose email matches the invite', async () => {
    await invite('owner2.backup@acme.com', 'master_admin');
    const token = tokenFor('owner2.backup@acme.com');

    // A student session cannot accept.
    expect((await acceptInvite(repo, { token, userId: STUDENT_USER })).status).toBe(409);
    // An employer session with the wrong email cannot accept.
    expect((await acceptInvite(repo, { token, userId: OTHER_ADMIN_USER })).status).toBe(403);
  });

  it('rejects weak passwords on the new-account path', async () => {
    await invite();
    const result = await acceptInvite(repo, {
      token: tokenFor('new.recruiter@acme.com'),
      fullName: 'New Recruiter',
      password: 'short',
    });
    expect(result.status).toBe(400);
  });

  it('cannot be accepted twice, after revocation, or after expiry', async () => {
    await invite();
    const token = tokenFor('new.recruiter@acme.com');

    await acceptInvite(repo, { token, fullName: 'New Recruiter', password: 'Str0ng-Passw0rd!' });
    expect((await acceptInvite(repo, { token, fullName: 'X', password: 'Str0ng-Passw0rd!' })).status).toBe(409);

    await invite('second@acme.com');
    const member = [...captured.members.values()].find((m) => m.invited_email === 'second@acme.com')!;
    await revokeInvite(repo, { userId: ADMIN_USER, memberId: member.id });
    expect((await acceptInvite(repo, { token: tokenFor('second@acme.com'), fullName: 'X', password: 'Str0ng-Passw0rd!' })).status).toBe(410);

    await invite('third@acme.com');
    const third = [...captured.members.values()].find((m) => m.invited_email === 'third@acme.com')!;
    third.invite_expires_at = '2020-01-01T00:00:00Z';
    expect((await acceptInvite(repo, { token: tokenFor('third@acme.com'), fullName: 'X', password: 'Str0ng-Passw0rd!' })).status).toBe(410);
  });
});

describe('resend and revoke', () => {
  it('resend extends the expiry (reviving an expired invite) and re-sends the email', async () => {
    await invite();
    const member = [...captured.members.values()].find((m) => m.invited_email === 'new.recruiter@acme.com')!;
    member.invite_expires_at = '2020-01-01T00:00:00Z';

    const result = await resendInvite(repo, { userId: ADMIN_USER, memberId: member.id });
    expect(result.status).toBe(200);
    expect(new Date(captured.members.get(member.id)!.invite_expires_at!).getTime()).toBeGreaterThan(Date.now());
    expect(captured.emails).toHaveLength(2);
    expect(captured.events.map((e) => e.action)).toEqual(['invite_sent', 'invite_resent']);
  });

  it('only pending invites can be resent or revoked', async () => {
    await invite();
    const token = tokenFor('new.recruiter@acme.com');
    await acceptInvite(repo, { token, fullName: 'New Recruiter', password: 'Str0ng-Passw0rd!' });
    const member = [...captured.members.values()].find((m) => m.invited_email === 'new.recruiter@acme.com')!;

    expect((await resendInvite(repo, { userId: ADMIN_USER, memberId: member.id })).status).toBe(409);
    expect((await revokeInvite(repo, { userId: ADMIN_USER, memberId: member.id })).status).toBe(409);
  });

  it('is isolated per company: another company\'s admin gets 404', async () => {
    await invite();
    const member = [...captured.members.values()].find((m) => m.invited_email === 'new.recruiter@acme.com')!;
    expect((await revokeInvite(repo, { userId: OTHER_ADMIN_USER, memberId: member.id })).status).toBe(404);
    expect((await resendInvite(repo, { userId: OTHER_ADMIN_USER, memberId: member.id })).status).toBe(404);
    expect((await changeMemberRole(repo, { userId: OTHER_ADMIN_USER, memberId: member.id, role: 'approver' })).status).toBe(404);
  });
});

describe('roles and (de)activation', () => {
  async function addActiveRecruiter(email = 'recruiter@acme.com'): Promise<TeamMember> {
    await invite(email);
    await acceptInvite(repo, { token: tokenFor(email), fullName: 'Rec', password: 'Str0ng-Passw0rd!' });
    return [...captured.members.values()].find((m) => m.invited_email === email)!;
  }

  it('changes a role and audits prior/next', async () => {
    const member = await addActiveRecruiter();
    const result = await changeMemberRole(repo, { userId: ADMIN_USER, memberId: member.id, role: 'recruiting_lead' });
    expect(result.status).toBe(200);
    expect(captured.members.get(member.id)!.role).toBe('recruiting_lead');
    const event = captured.events.at(-1)!;
    expect(event.action).toBe('role_changed');
    expect(event.prior).toEqual({ role: 'recruiter' });
    expect(event.next).toEqual({ role: 'recruiting_lead' });
  });

  it('never demotes or deactivates the last active master admin', async () => {
    expect((await changeMemberRole(repo, { userId: ADMIN_USER, memberId: 'owner-1', role: 'recruiter' })).status).toBe(409);
    expect((await setMemberActive(repo, { userId: ADMIN_USER, memberId: 'owner-1', active: false })).status).toBe(409);
  });

  it('allows demotion once a backup master admin is active', async () => {
    await invite('backup@acme.com', 'master_admin');
    await acceptInvite(repo, { token: tokenFor('backup@acme.com'), fullName: 'Backup', password: 'Str0ng-Passw0rd!' });

    const result = await changeMemberRole(repo, { userId: ADMIN_USER, memberId: 'owner-1', role: 'recruiter' });
    expect(result.status).toBe(200);
  });

  it('deactivates and reactivates a member, with audit rows', async () => {
    const member = await addActiveRecruiter();

    const off = await setMemberActive(repo, { userId: ADMIN_USER, memberId: member.id, active: false });
    expect(off.status).toBe(200);
    expect(captured.members.get(member.id)!.status).toBe('deactivated');
    expect(captured.members.get(member.id)!.deactivated_at).toBeTruthy();

    const on = await setMemberActive(repo, { userId: ADMIN_USER, memberId: member.id, active: true });
    expect(on.status).toBe(200);
    expect(captured.members.get(member.id)!.status).toBe('active');
    expect(captured.members.get(member.id)!.deactivated_at).toBeNull();

    expect(captured.events.map((e) => e.action)).toEqual([
      'invite_sent', 'invite_accepted', 'member_deactivated', 'member_reactivated',
    ]);
  });

  it('does not deactivate a pending invite (revoke is the path)', async () => {
    await invite();
    const member = [...captured.members.values()].find((m) => m.invited_email === 'new.recruiter@acme.com')!;
    expect((await setMemberActive(repo, { userId: ADMIN_USER, memberId: member.id, active: false })).status).toBe(409);
  });

  it('a deactivated member no longer counts as an active membership', async () => {
    const member = await addActiveRecruiter();
    await setMemberActive(repo, { userId: ADMIN_USER, memberId: member.id, active: false });
    const roster = await listTeam(repo, { userId: member.user_id! });
    expect(roster.status).toBe(403);
  });
});

describe('roster', () => {
  it('shows tokens to master admins and hides them from everyone else', async () => {
    await invite();
    await invite('recruiter2@acme.com');
    await acceptInvite(repo, { token: tokenFor('recruiter2@acme.com'), fullName: 'R2', password: 'Str0ng-Passw0rd!' });
    const recruiterUserId = [...captured.profiles.values()].find((p) => p.email === 'recruiter2@acme.com')!.user_id;

    const adminView = await listTeam(repo, { userId: ADMIN_USER });
    expect(adminView.status).toBe(200);
    const adminMembers = (adminView.body as { members: Array<{ invite_token?: string | null }> }).members;
    expect(adminMembers.some((m) => m.invite_token)).toBe(true);

    const memberView = await listTeam(repo, { userId: recruiterUserId });
    expect(memberView.status).toBe(200);
    const memberMembers = (memberView.body as { members: Array<{ invite_token?: string | null }> }).members;
    expect(memberMembers.every((m) => m.invite_token === undefined)).toBe(true);
  });

  it('excludes revoked invites and includes expiry flags', async () => {
    await invite();
    const member = [...captured.members.values()].find((m) => m.invited_email === 'new.recruiter@acme.com')!;
    member.invite_expires_at = '2020-01-01T00:00:00Z';

    await invite('revoked@acme.com');
    const revoked = [...captured.members.values()].find((m) => m.invited_email === 'revoked@acme.com')!;
    await revokeInvite(repo, { userId: ADMIN_USER, memberId: revoked.id });

    const view = await listTeam(repo, { userId: ADMIN_USER });
    const members = (view.body as { members: Array<{ invited_email: string; invite_expired: boolean }> }).members;
    expect(members.map((m) => m.invited_email)).not.toContain('revoked@acme.com');
    expect(members.find((m) => m.invited_email === 'new.recruiter@acme.com')!.invite_expired).toBe(true);
  });
});

describe('invite info (the /join page)', () => {
  it('reports valid, expired, revoked, and accepted states', async () => {
    await invite();
    const token = tokenFor('new.recruiter@acme.com');

    let info = await getInviteInfo(repo, { token });
    expect((info.body as { state: string; companyName: string }).state).toBe('valid');
    expect((info.body as { companyName: string }).companyName).toBe('Acme');

    const member = [...captured.members.values()].find((m) => m.invited_email === 'new.recruiter@acme.com')!;
    member.invite_expires_at = '2020-01-01T00:00:00Z';
    info = await getInviteInfo(repo, { token });
    expect((info.body as { state: string }).state).toBe('expired');

    member.invite_expires_at = new Date(Date.now() + 86400000).toISOString();
    await acceptInvite(repo, { token, fullName: 'X', password: 'Str0ng-Passw0rd!' });
    info = await getInviteInfo(repo, { token });
    expect((info.body as { state: string }).state).toBe('accepted');

    await invite('r2@acme.com');
    const r2 = [...captured.members.values()].find((m) => m.invited_email === 'r2@acme.com')!;
    await revokeInvite(repo, { userId: ADMIN_USER, memberId: r2.id });
    info = await getInviteInfo(repo, { token: tokenFor('r2@acme.com') });
    expect((info.body as { state: string }).state).toBe('revoked');

    expect((await getInviteInfo(repo, { token: 'no-such-token' })).status).toBe(404);
  });
});
