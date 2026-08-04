// ============================================
// EMPLOYER TEAM — server flow
// ============================================
// Every team-administration action, expressed against a narrow repository
// interface (the same seam pattern as interview-availability-service.ts). The
// API routes wire in the Supabase service-role repo (employer-team-repo.ts);
// the tests wire in an in-memory one and drive the flows end to end.
//
// All writes run through here so the invariants live in one place: only an
// active Master Admin administers the team, a company always keeps at least
// one active Master Admin, invites expire and require an email match to
// accept, and every action lands in the immutable employer_team_events log.

import {
  canTransitionMember,
  inviteExpiresAt,
  isInviteExpired,
  isLastActiveMasterAdmin,
  isEmployerRole,
  validateInvite,
  ROLE_LABELS,
  type EmployerRole,
  type TeamMember,
} from './employer-team';
import { validatePassword } from './password';

export type ServiceResult<T = unknown> = { status: number; body: T };

const err = (status: number, error: string): ServiceResult<{ error: string }> => ({ status, body: { error } });

export type TeamAuditAction =
  | 'invite_sent' | 'invite_resent' | 'invite_revoked' | 'invite_accepted'
  | 'role_changed' | 'member_deactivated' | 'member_reactivated';

export type MemberProfile = { user_id: string; email: string; role: string; full_name: string };

export type TeamRepo = {
  /** Active membership row for this auth user, or null. */
  getActiveMembership(userId: string): Promise<TeamMember | null>;
  /** Any membership row (active, deactivated, invited-with-user) for this auth user. */
  getAnyMembershipForUser(userId: string): Promise<TeamMember | null>;
  getEmployer(employerId: string): Promise<{ id: string; company_name: string } | null>;
  listMembers(employerId: string): Promise<TeamMember[]>;
  getMember(memberId: string): Promise<TeamMember | null>;
  getMemberByToken(token: string): Promise<TeamMember | null>;
  insertMember(row: {
    employer_id: string;
    role: EmployerRole;
    status: 'invited';
    invited_email: string;
    invited_name: string | null;
    invited_by: string;
    invite_expires_at: string;
  }): Promise<TeamMember>;
  updateMember(memberId: string, patch: Partial<TeamMember>): Promise<TeamMember>;
  getProfileById(userId: string): Promise<MemberProfile | null>;
  findProfileByEmail(email: string): Promise<MemberProfile | null>;
  /** Creates the auth user (email pre-confirmed — the token proved mailbox access) plus its profile row. */
  createEmployerAccount(opts: { email: string; password: string; fullName: string }): Promise<{ userId: string }>;
  recordEvent(row: {
    employer_id: string;
    actor_user_id: string | null;
    member_id: string | null;
    action: TeamAuditAction;
    subject_email: string;
    prior?: Record<string, unknown> | null;
    next?: Record<string, unknown> | null;
  }): Promise<void>;
  /** No-op when outbound email is not configured; the copy-link fallback covers it. */
  sendInviteEmail(opts: {
    to: string;
    companyName: string;
    inviterName: string;
    roleLabel: string;
    token: string;
  }): Promise<void>;
};

// Resolves the caller into "an active Master Admin of employer X" or an error.
type MasterAdminCheck =
  | { error: ServiceResult<{ error: string }> }
  | { membership: TeamMember };

async function requireMasterAdmin(repo: TeamRepo, userId: string): Promise<MasterAdminCheck> {
  const membership = await repo.getActiveMembership(userId);
  if (!membership) return { error: err(403, 'You are not an active member of a company account.') };
  if (membership.role !== 'master_admin') {
    return { error: err(403, 'Only a Master Admin can manage the team.') };
  }
  return { membership };
}

// Public shape of a roster row. invite_token never leaves the server for
// non-admins; for master admins the token is exposed so the UI can offer a
// copy-able join link.
export type RosterMember = Omit<TeamMember, 'invite_token'> & {
  invite_token?: string | null;
  invite_expired: boolean;
  full_name: string | null;
};

function toRosterMember(member: TeamMember, profile: MemberProfile | null, includeToken: boolean): RosterMember {
  const { invite_token, ...rest } = member;
  return {
    ...rest,
    ...(includeToken ? { invite_token } : {}),
    invite_expired: isInviteExpired(member),
    full_name: profile?.full_name ?? null,
  };
}

// ============================================
// Roster
// ============================================
export async function listTeam(repo: TeamRepo, input: { userId: string }): Promise<ServiceResult> {
  const membership = await repo.getActiveMembership(input.userId);
  if (!membership) return err(403, 'You are not an active member of a company account.');

  const isAdmin = membership.role === 'master_admin';
  const members = await repo.listMembers(membership.employer_id);
  // Revoked invites are history, not roster.
  const visible = members.filter((m) => m.status !== 'revoked');
  const roster: RosterMember[] = [];
  for (const m of visible) {
    const profile = m.user_id ? await repo.getProfileById(m.user_id) : null;
    roster.push(toRosterMember(m, profile, isAdmin));
  }
  return {
    status: 200,
    body: {
      members: roster,
      me: { memberId: membership.id, role: membership.role },
    },
  };
}

// ============================================
// Invite
// ============================================
export async function inviteMember(
  repo: TeamRepo,
  input: { userId: string; email: string; name?: string; role: string },
): Promise<ServiceResult> {
  const admin = await requireMasterAdmin(repo, input.userId);
  if ('error' in admin) return admin.error;
  const { membership } = admin;

  const check = validateInvite({ email: input.email, role: input.role });
  if (!check.ok) return err(400, check.error);
  const email = check.email;
  const role = input.role as EmployerRole;

  // One company account per user, platform-wide. If the address already has
  // an InternFirst identity, it can only be invited if that identity is an
  // unattached employer user — which cannot exist today (every employer user
  // is backfilled as an owner), so any hit is a conflict.
  const existingProfile = await repo.findProfileByEmail(email);
  if (existingProfile) {
    if (existingProfile.role !== 'employer') {
      return err(409, 'That email belongs to a non-company InternFirst account and cannot join an employer team.');
    }
    const theirMembership = await repo.getAnyMembershipForUser(existingProfile.user_id);
    if (theirMembership) {
      return err(409, theirMembership.employer_id === membership.employer_id
        ? 'That person is already on your team.'
        : 'That email already belongs to another company account.');
    }
  }

  const members = await repo.listMembers(membership.employer_id);
  const clash = members.find(
    (m) => m.invited_email.toLowerCase() === email && (m.status === 'invited' || m.status === 'active' || m.status === 'deactivated'),
  );
  if (clash) {
    if (clash.status === 'invited') return err(409, 'That email already has a pending invitation. Resend or revoke it instead.');
    return err(409, clash.status === 'active'
      ? 'That person is already on your team.'
      : 'That email belongs to a deactivated member. Reactivate them instead of re-inviting.');
  }

  const member = await repo.insertMember({
    employer_id: membership.employer_id,
    role,
    status: 'invited',
    invited_email: email,
    invited_name: input.name?.trim() || null,
    invited_by: input.userId,
    invite_expires_at: inviteExpiresAt(),
  });

  await repo.recordEvent({
    employer_id: membership.employer_id,
    actor_user_id: input.userId,
    member_id: member.id,
    action: 'invite_sent',
    subject_email: email,
    next: { role, status: 'invited' },
  });

  const employer = await repo.getEmployer(membership.employer_id);
  const inviter = await repo.getProfileById(input.userId);
  if (member.invite_token) {
    await repo.sendInviteEmail({
      to: email,
      companyName: employer?.company_name ?? 'your company',
      inviterName: inviter?.full_name ?? 'A teammate',
      roleLabel: ROLE_LABELS[role],
      token: member.invite_token,
    });
  }

  return { status: 200, body: toRosterMember(member, null, true) };
}

// ============================================
// Resend / revoke
// ============================================
export async function resendInvite(repo: TeamRepo, input: { userId: string; memberId: string }): Promise<ServiceResult> {
  const admin = await requireMasterAdmin(repo, input.userId);
  if ('error' in admin) return admin.error;
  const { membership } = admin;

  const member = await repo.getMember(input.memberId);
  if (!member || member.employer_id !== membership.employer_id) return err(404, 'Invitation not found');
  if (member.status !== 'invited') return err(409, 'Only a pending invitation can be resent.');

  // Resending revives an expired invite: same row, same token, fresh clock.
  const updated = await repo.updateMember(member.id, { invite_expires_at: inviteExpiresAt() });

  await repo.recordEvent({
    employer_id: membership.employer_id,
    actor_user_id: input.userId,
    member_id: member.id,
    action: 'invite_resent',
    subject_email: member.invited_email,
  });

  const employer = await repo.getEmployer(membership.employer_id);
  const inviter = await repo.getProfileById(input.userId);
  if (updated.invite_token) {
    await repo.sendInviteEmail({
      to: member.invited_email,
      companyName: employer?.company_name ?? 'your company',
      inviterName: inviter?.full_name ?? 'A teammate',
      roleLabel: ROLE_LABELS[member.role],
      token: updated.invite_token,
    });
  }

  return { status: 200, body: toRosterMember(updated, null, true) };
}

export async function revokeInvite(repo: TeamRepo, input: { userId: string; memberId: string }): Promise<ServiceResult> {
  const admin = await requireMasterAdmin(repo, input.userId);
  if ('error' in admin) return admin.error;
  const { membership } = admin;

  const member = await repo.getMember(input.memberId);
  if (!member || member.employer_id !== membership.employer_id) return err(404, 'Invitation not found');
  if (!canTransitionMember(member.status, 'revoked')) {
    return err(409, 'Only a pending invitation can be revoked. Deactivate active members instead.');
  }

  const updated = await repo.updateMember(member.id, { status: 'revoked' });

  await repo.recordEvent({
    employer_id: membership.employer_id,
    actor_user_id: input.userId,
    member_id: member.id,
    action: 'invite_revoked',
    subject_email: member.invited_email,
    prior: { status: member.status },
    next: { status: 'revoked' },
  });

  return { status: 200, body: toRosterMember(updated, null, true) };
}

// ============================================
// The public face of an invite (the /join page)
// ============================================
export async function getInviteInfo(repo: TeamRepo, input: { token: string }): Promise<ServiceResult> {
  const member = await repo.getMemberByToken(input.token);
  if (!member) return err(404, 'Invitation not found');

  const employer = await repo.getEmployer(member.employer_id);
  const state =
    member.status === 'active' ? 'accepted'
    : member.status === 'revoked' ? 'revoked'
    : member.status === 'deactivated' ? 'revoked'
    : isInviteExpired(member) ? 'expired'
    : 'valid';

  return {
    status: 200,
    body: {
      state,
      companyName: employer?.company_name ?? 'a company',
      role: member.role,
      roleLabel: ROLE_LABELS[member.role],
      invitedEmail: member.invited_email,
      invitedName: member.invited_name,
      // Whether the invited address already has an InternFirst login, so the
      // join page knows to ask for sign-in instead of account creation.
      hasAccount: !!(await repo.findProfileByEmail(member.invited_email)),
    },
  };
}

// ============================================
// Accept
// ============================================
// Two paths share the endpoint: an existing signed-in user accepting, or a
// brand-new user creating their login as part of accepting. Both require the
// accepting identity's email to match invited_email — the token proves the
// invite reached the mailbox, the match proves the acceptor owns it.
export async function acceptInvite(
  repo: TeamRepo,
  input: {
    token: string;
    /** Signed-in acceptance. */
    userId?: string;
    /** New-account acceptance. */
    fullName?: string;
    password?: string;
  },
): Promise<ServiceResult> {
  const member = await repo.getMemberByToken(input.token);
  if (!member) return err(404, 'Invitation not found');
  if (member.status === 'revoked') return err(410, 'This invitation was revoked.');
  if (member.status !== 'invited') return err(409, 'This invitation has already been used.');
  if (isInviteExpired(member)) {
    return err(410, 'This invitation has expired. Ask your Master Admin to resend it.');
  }

  let userId = input.userId ?? null;

  if (userId) {
    const profile = await repo.getProfileById(userId);
    if (!profile) return err(403, 'No InternFirst profile found for your login.');
    if (profile.role !== 'employer') {
      return err(409, 'This invitation is for a company account, but you are signed in with a different kind of account.');
    }
    if (profile.email.toLowerCase() !== member.invited_email.toLowerCase()) {
      return err(403, `This invitation was sent to ${member.invited_email}. Sign in with that email to accept it.`);
    }
    const existing = await repo.getAnyMembershipForUser(userId);
    if (existing) return err(409, 'Your account already belongs to a company team.');
  } else {
    const fullName = input.fullName?.trim();
    if (!fullName) return err(400, 'Enter your name.');
    const passwordError = validatePassword(input.password ?? '');
    if (passwordError) return err(400, passwordError);
    if (await repo.findProfileByEmail(member.invited_email)) {
      return err(409, 'An account with this email already exists. Sign in first, then open the invite link again.');
    }
    const created = await repo.createEmployerAccount({
      email: member.invited_email,
      password: input.password!,
      fullName,
    });
    userId = created.userId;
  }

  const updated = await repo.updateMember(member.id, {
    user_id: userId,
    status: 'active',
    accepted_at: new Date().toISOString(),
  });

  await repo.recordEvent({
    employer_id: member.employer_id,
    actor_user_id: userId,
    member_id: member.id,
    action: 'invite_accepted',
    subject_email: member.invited_email,
    prior: { status: 'invited' },
    next: { status: 'active', role: member.role },
  });

  return { status: 200, body: { memberId: updated.id, employerId: member.employer_id, role: member.role } };
}

// ============================================
// Role changes and (de)activation
// ============================================
export async function changeMemberRole(
  repo: TeamRepo,
  input: { userId: string; memberId: string; role: string },
): Promise<ServiceResult> {
  const admin = await requireMasterAdmin(repo, input.userId);
  if ('error' in admin) return admin.error;
  const { membership } = admin;

  if (!isEmployerRole(input.role)) return err(400, 'Pick a role from the role library.');

  const member = await repo.getMember(input.memberId);
  if (!member || member.employer_id !== membership.employer_id) return err(404, 'Team member not found');
  if (member.status === 'revoked') return err(409, 'This invitation was revoked.');
  if (member.role === input.role) return { status: 200, body: toRosterMember(member, null, true) };

  const members = await repo.listMembers(membership.employer_id);
  if (member.role === 'master_admin' && isLastActiveMasterAdmin(members, member.id)) {
    return err(409, 'A company needs at least one active Master Admin. Promote someone else first.');
  }

  const updated = await repo.updateMember(member.id, { role: input.role });

  await repo.recordEvent({
    employer_id: membership.employer_id,
    actor_user_id: input.userId,
    member_id: member.id,
    action: 'role_changed',
    subject_email: member.invited_email,
    prior: { role: member.role },
    next: { role: input.role },
  });

  return { status: 200, body: toRosterMember(updated, null, true) };
}

export async function setMemberActive(
  repo: TeamRepo,
  input: { userId: string; memberId: string; active: boolean },
): Promise<ServiceResult> {
  const admin = await requireMasterAdmin(repo, input.userId);
  if ('error' in admin) return admin.error;
  const { membership } = admin;

  const member = await repo.getMember(input.memberId);
  if (!member || member.employer_id !== membership.employer_id) return err(404, 'Team member not found');

  const target = input.active ? 'active' : 'deactivated';
  if (!canTransitionMember(member.status, target)) {
    return err(409, member.status === 'invited'
      ? 'Pending invitations are revoked, not deactivated.'
      : `Cannot move this member from "${member.status}" to "${target}".`);
  }

  if (!input.active) {
    const members = await repo.listMembers(membership.employer_id);
    if (isLastActiveMasterAdmin(members, member.id)) {
      return err(409, 'A company needs at least one active Master Admin. Promote someone else first.');
    }
  }

  const updated = await repo.updateMember(member.id, {
    status: target,
    deactivated_at: input.active ? null : new Date().toISOString(),
  });

  await repo.recordEvent({
    employer_id: membership.employer_id,
    actor_user_id: input.userId,
    member_id: member.id,
    action: input.active ? 'member_reactivated' : 'member_deactivated',
    subject_email: member.invited_email,
    prior: { status: member.status },
    next: { status: target },
  });

  return { status: 200, body: toRosterMember(updated, null, true) };
}
