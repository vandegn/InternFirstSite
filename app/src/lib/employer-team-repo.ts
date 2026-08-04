// Supabase implementation of the TeamRepo seam. Built on the service-role
// client: employer_members has no INSERT/UPDATE/DELETE policies for
// authenticated users by design, so every write funnels through
// employer-team-service.ts, which owns the authorization checks.

import { type SupabaseClient } from '@supabase/supabase-js';
import { type TeamRepo } from './employer-team-service';
import { type TeamMember } from './employer-team';
import { resend, FROM_EMAIL } from './resend';
import { teamInviteEmail } from './email-templates';

export function createTeamRepo(admin: SupabaseClient): TeamRepo {
  return {
    async getActiveMembership(userId) {
      const { data } = await admin
        .from('employer_members')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle();
      return (data as TeamMember | null) ?? null;
    },

    async getAnyMembershipForUser(userId) {
      const { data } = await admin
        .from('employer_members')
        .select('*')
        .eq('user_id', userId)
        .neq('status', 'revoked')
        .maybeSingle();
      return (data as TeamMember | null) ?? null;
    },

    async getEmployer(employerId) {
      const { data } = await admin
        .from('employers')
        .select('id, company_name')
        .eq('id', employerId)
        .maybeSingle();
      return data ?? null;
    },

    async listMembers(employerId) {
      const { data } = await admin
        .from('employer_members')
        .select('*')
        .eq('employer_id', employerId)
        .order('created_at', { ascending: true });
      return (data as TeamMember[] | null) ?? [];
    },

    async getMember(memberId) {
      const { data } = await admin
        .from('employer_members')
        .select('*')
        .eq('id', memberId)
        .maybeSingle();
      return (data as TeamMember | null) ?? null;
    },

    async getMemberByToken(token) {
      const { data } = await admin
        .from('employer_members')
        .select('*')
        .eq('invite_token', token)
        .maybeSingle();
      return (data as TeamMember | null) ?? null;
    },

    async insertMember(row) {
      const { data, error } = await admin
        .from('employer_members')
        .insert(row)
        .select()
        .single();
      if (error) throw error;
      return data as TeamMember;
    },

    async updateMember(memberId, patch) {
      const { data, error } = await admin
        .from('employer_members')
        .update(patch)
        .eq('id', memberId)
        .select()
        .single();
      if (error) throw error;
      return data as TeamMember;
    },

    async getProfileById(userId) {
      const { data } = await admin
        .from('profiles')
        .select('user_id, email, role, full_name')
        .eq('user_id', userId)
        .maybeSingle();
      return data ?? null;
    },

    async findProfileByEmail(email) {
      const { data } = await admin
        .from('profiles')
        .select('user_id, email, role, full_name')
        .ilike('email', email)
        .maybeSingle();
      return data ?? null;
    },

    async createEmployerAccount({ email, password, fullName }) {
      // email_confirm: possession of the invite token already proved the
      // mailbox received the invitation, so a second confirmation loop would
      // only add friction.
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { fullName, invitedTeamMember: 'true' },
      });
      if (error || !data.user) throw error ?? new Error('Account creation failed');

      // The profile is created here, not by /auth/callback (which invited
      // users never hit) and not by createProfileAndRoleData (which would
      // also create a company row — invited members join an existing one).
      const { error: profileError } = await admin.from('profiles').insert({
        user_id: data.user.id,
        role: 'employer',
        full_name: fullName,
        email,
      });
      if (profileError) {
        // Don't leave an orphaned login behind a failed profile insert.
        await admin.auth.admin.deleteUser(data.user.id);
        throw profileError;
      }

      return { userId: data.user.id };
    },

    async recordEvent(row) {
      const { error } = await admin.from('employer_team_events').insert({
        employer_id: row.employer_id,
        actor_user_id: row.actor_user_id,
        member_id: row.member_id,
        action: row.action,
        subject_email: row.subject_email,
        prior: row.prior ?? null,
        next: row.next ?? null,
      });
      if (error) throw error;
    },

    async sendInviteEmail({ to, companyName, inviterName, roleLabel, token }) {
      if (!resend) return; // no API key — the master admin copies the link instead
      try {
        const { subject, html } = teamInviteEmail({ companyName, inviterName, roleLabel, token });
        await resend.emails.send({ from: FROM_EMAIL, to, subject, html });
      } catch (e) {
        // The invite row exists and the join link is copyable from the roster;
        // a mail hiccup must not fail the action.
        console.error('[employer-team] invite email failed:', e);
      }
    },
  };
}
