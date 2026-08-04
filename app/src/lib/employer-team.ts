// ============================================
// EMPLOYER TEAM — pure domain module
// ============================================
// The role library, invite lifecycle, and admin guards for multi-user
// employer accounts. No I/O here: this file is imported by the API service
// (employer-team-service.ts) *and* the team UI, so the rules cannot drift
// between the two — the same pattern as interview-availability.ts.

import { isFreeEmailProvider } from './domain-signals';

// ---- Role library ----
// The six built-in role bundles from the customization framework. Custom
// employer-defined roles and permission bundles are future work; when they
// arrive, EmployerRole widens to include a reference into a roles table.
export const EMPLOYER_ROLES = [
  'master_admin',
  'recruiting_lead',
  'recruiter',
  'hiring_manager',
  'interviewer',
  'approver',
] as const;

export type EmployerRole = (typeof EMPLOYER_ROLES)[number];

export const ROLE_LABELS: Record<EmployerRole, string> = {
  master_admin: 'Master Admin',
  recruiting_lead: 'Recruiting Lead',
  recruiter: 'Recruiter',
  hiring_manager: 'Hiring Manager',
  interviewer: 'Interviewer / Reviewer',
  approver: 'Approver',
};

export const ROLE_DESCRIPTIONS: Record<EmployerRole, string> = {
  master_admin: 'Controls the company account: team, roles, company profile, and all recruiting tools. Invite a second Master Admin to act as a backup administrator.',
  recruiting_lead: 'Oversees recruiting operations, performance, and requisition delivery across the team.',
  recruiter: 'Manages candidates: screening, messaging, interview scheduling, and moving candidates through the pipeline.',
  hiring_manager: 'Reviews candidates, provides feedback, and participates in interviews.',
  interviewer: 'Conducts interviews and submits feedback on candidates.',
  approver: 'Approves actions at configured checkpoints. (Approval workflows are not yet configurable — this role currently has review-only access.)',
};

export function isEmployerRole(value: string): value is EmployerRole {
  return (EMPLOYER_ROLES as readonly string[]).includes(value);
}

// ---- Capabilities ----
// Application-layer permission bundles. The database grants at membership
// level (any active member can reach the employer dashboard); these govern
// what the API routes and UI let each role bundle actually do. Field-level
// permissions, scopes, and inheritance are deliberately not modeled yet.
export type TeamCapability =
  | 'manage_team'          // invite / revoke / role changes / (de)activation
  | 'edit_company'         // company profile and account settings
  | 'manage_listings'      // create / edit / close listings
  | 'manage_pipeline'      // move candidates between stages
  | 'view_candidates'
  | 'message_candidates'
  | 'schedule_interviews'
  | 'view_team_history';   // the team audit trail

const ALL_CAPABILITIES: TeamCapability[] = [
  'manage_team', 'edit_company', 'manage_listings', 'manage_pipeline',
  'view_candidates', 'message_candidates', 'schedule_interviews', 'view_team_history',
];

export const ROLE_CAPABILITIES: Record<EmployerRole, TeamCapability[]> = {
  master_admin: ALL_CAPABILITIES,
  recruiting_lead: ['manage_listings', 'manage_pipeline', 'view_candidates', 'message_candidates', 'schedule_interviews'],
  recruiter: ['manage_pipeline', 'view_candidates', 'message_candidates', 'schedule_interviews'],
  hiring_manager: ['view_candidates', 'message_candidates', 'schedule_interviews'],
  interviewer: ['view_candidates', 'schedule_interviews'],
  approver: ['view_candidates'],
};

export function roleCan(role: EmployerRole, capability: TeamCapability): boolean {
  return ROLE_CAPABILITIES[role].includes(capability);
}

// ---- Membership rows ----
export type MemberStatus = 'invited' | 'active' | 'deactivated' | 'revoked';

export type TeamMember = {
  id: string;
  employer_id: string;
  user_id: string | null;
  role: EmployerRole;
  status: MemberStatus;
  invited_email: string;
  invited_name: string | null;
  invited_by: string | null;
  invite_token: string | null;
  invite_expires_at: string | null;
  accepted_at: string | null;
  deactivated_at: string | null;
  created_at: string;
};

// ---- Invite lifecycle ----
export const INVITE_TTL_DAYS = 7;

export function inviteExpiresAt(from: Date = new Date()): string {
  return new Date(from.getTime() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

export function isInviteExpired(member: Pick<TeamMember, 'status' | 'invite_expires_at'>, now: Date = new Date()): boolean {
  return (
    member.status === 'invited' &&
    !!member.invite_expires_at &&
    new Date(member.invite_expires_at).getTime() < now.getTime()
  );
}

// The status machine. Resending an invite is invited -> invited (a timer
// reset, not a transition); an expired invite stays 'invited' and is revived
// the same way. 'revoked' is terminal — re-inviting creates a fresh row.
const MEMBER_TRANSITIONS: Record<MemberStatus, MemberStatus[]> = {
  invited: ['active', 'revoked'],
  active: ['deactivated'],
  deactivated: ['active'],
  revoked: [],
};

export function canTransitionMember(from: MemberStatus, to: MemberStatus): boolean {
  return MEMBER_TRANSITIONS[from]?.includes(to) ?? false;
}

// ---- Validation ----
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type InviteCheck =
  | { ok: true; email: string }
  | { ok: false; error: string };

export function validateInvite(input: { email: string; role: string }): InviteCheck {
  const email = input.email?.trim().toLowerCase() ?? '';
  if (!EMAIL_RE.test(email)) {
    return { ok: false, error: 'Enter a valid email address.' };
  }
  // The same rule the register page applies to company accounts: teammates
  // sign in under the company's umbrella, so a personal mailbox has nothing
  // to tie them to it.
  if (isFreeEmailProvider(email)) {
    return { ok: false, error: 'Team invitations require a company email address, not a personal one.' };
  }
  if (!isEmployerRole(input.role)) {
    return { ok: false, error: 'Pick a role from the role library.' };
  }
  return { ok: true, email };
}

// ---- Admin guards ----
// A company must always keep at least one active Master Admin, or nobody can
// administer it. Applied before demoting or deactivating.
export function isLastActiveMasterAdmin(members: TeamMember[], memberId: string): boolean {
  const target = members.find((m) => m.id === memberId);
  if (!target || target.status !== 'active' || target.role !== 'master_admin') return false;
  return !members.some(
    (m) => m.id !== memberId && m.status === 'active' && m.role === 'master_admin',
  );
}

// ---- Display helpers ----
export function memberDisplayName(member: Pick<TeamMember, 'invited_name' | 'invited_email'> & { full_name?: string | null }): string {
  return member.full_name || member.invited_name || member.invited_email;
}

export function inviteJoinPath(token: string): string {
  return `/join/${token}`;
}
