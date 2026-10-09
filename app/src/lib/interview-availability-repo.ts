// Supabase-backed implementation of AvailabilityRepo.
//
// Every call runs through the caller's cookie-scoped client, so RLS is the
// real authorization boundary; the ownership checks in the service are there to
// return a clean 403/404 instead of an opaque empty result.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { AvailabilityRepo, RequestContext } from './interview-availability-service';
import type { AvailabilityRequest, AvailabilitySlot } from './interview-availability';
import { LIVE_AVAILABILITY_STATUSES, LIVE_INTERVIEW_STATUSES } from './interview-availability';

// PostgREST hands embedded rows back as an object or a one-element array
// depending on the relationship it infers — same helper the pipeline uses.
const one = <T,>(v: unknown): T => (Array.isArray(v) ? v[0] : v) as T;

export const SCHEDULING_MIGRATION_HINT =
  'Interview scheduling needs the 20261009_employer_proposed_interview_slots migration applied to the database.';

type PgError = { code?: string; message?: string } | null;

/** A column or policy the 20261009 migration adds is missing. */
function isMissingMigration(error: PgError): boolean {
  if (!error) return false;
  return error.code === 'PGRST204' // column not in PostgREST's schema cache
    || error.code === '42703'      // undefined column
    || error.code === '42501'      // RLS: no employer insert policy on slots yet
    || /row-level security|column .* does not exist|schema cache/i.test(error.message ?? '');
}

function fail(error: PgError, fallback: string): never {
  if (isMissingMigration(error)) throw new Error(SCHEDULING_MIGRATION_HINT);
  if (error?.code === '23505') {
    throw new Error('This candidate already has an active interview. Refresh and try again.');
  }
  throw new Error(error?.message ?? fallback);
}

export function createAvailabilityRepo(supabase: SupabaseClient): AvailabilityRepo {
  return {
    async getEmployerIdForUser(userId) {
      // Team membership first (any active member can schedule), then the
      // legacy ownership lookup for a DB the team migration hasn't reached.
      const { data: member } = await supabase
        .from('employer_members')
        .select('employer_id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle();
      if (member) return member.employer_id;

      const { data } = await supabase
        .from('employers')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();
      return data?.id ?? null;
    },

    async getStudentIdForUser(userId) {
      const { data } = await supabase
        .from('students')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();
      return data?.id ?? null;
    },

    async getApplication(applicationId) {
      const { data } = await supabase
        .from('applications')
        // `*` rather than naming detached_at, so this still works before the
        // 20261009_listing_archive_end_hiring migration is applied.
        .select(`
          *,
          listing:internship_listings(employer_id),
          stage:pipeline_stages!applications_stage_id_fkey(stage_type, label)
        `)
        .eq('id', applicationId)
        .maybeSingle();
      if (!data) return null;
      const row = data as Record<string, unknown>;
      // This repo runs as the service role, so RLS doesn't hide applications
      // detached from an unarchived posting — refuse them here instead.
      if (row.detached_at != null) return null;
      const listing = one<{ employer_id: string } | null>(row.listing);
      const stage = one<{ stage_type: string | null; label: string | null } | null>(row.stage);
      return {
        id: data.id,
        listing_id: data.listing_id,
        student_id: data.student_id,
        employer_id: listing?.employer_id ?? '',
        stage: stage ?? null,
      };
    },

    async getLiveRequestForApplication(applicationId) {
      const { data } = await supabase
        .from('interview_availability_requests')
        .select('*')
        .eq('application_id', applicationId)
        .in('status', LIVE_AVAILABILITY_STATUSES)
        .maybeSingle();
      return (data as AvailabilityRequest) ?? null;
    },

    async getRequest(requestId) {
      const { data } = await supabase
        .from('interview_availability_requests')
        .select('*')
        .eq('id', requestId)
        .maybeSingle();
      return (data as AvailabilityRequest) ?? null;
    },

    async insertRequest(row) {
      const { data, error } = await supabase
        .from('interview_availability_requests')
        .insert(row)
        .select()
        .single();
      if (error || !data) fail(error, 'Failed to create the time request');
      return data as AvailabilityRequest;
    },

    async updateRequest(requestId, patch) {
      const { data, error } = await supabase
        .from('interview_availability_requests')
        .update(patch)
        .eq('id', requestId)
        .select()
        .single();
      if (error || !data) fail(error, 'Failed to update the time request');
      return data as AvailabilityRequest;
    },

    async getSlots(requestId) {
      const { data } = await supabase
        .from('interview_availability_slots')
        .select('*')
        .eq('request_id', requestId)
        .order('starts_at', { ascending: true });
      return (data ?? []) as AvailabilitySlot[];
    },

    async insertSlots(requestId, slots) {
      if (slots.length === 0) return [];
      const { data, error } = await supabase
        .from('interview_availability_slots')
        .insert(slots.map(s => ({
          request_id: requestId,
          slot_date: s.slot_date,
          starts_at: s.starts_at,
          ends_at: s.ends_at,
        })))
        .select();
      if (error) {
        // Don't leave a request with nothing to pick from behind.
        await supabase.from('interview_availability_requests').update({ status: 'cancelled' }).eq('id', requestId);
        fail(error, 'Failed to save the time slots');
      }
      return ((data ?? []) as AvailabilitySlot[])
        .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
    },

    async insertMessage(row) {
      const { data, error } = await supabase
        .from('messages')
        .insert(row)
        .select('id')
        .single();
      if (error || !data) fail(error, 'Failed to send the message');
      return { id: data.id };
    },

    async createNotification(row) {
      // Best-effort, exactly like createNotification in supabase.ts: a missing
      // notification must never fail the underlying action.
      const { error } = await supabase.from('notifications').insert(row);
      if (error) console.error('[availability notification]', error.message);
    },

    async getLiveInterviewForApplication(applicationId) {
      const { data } = await supabase
        .from('interview_schedules')
        .select('id')
        .eq('application_id', applicationId)
        .in('status', LIVE_INTERVIEW_STATUSES)
        .order('scheduled_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data ? { id: data.id } : null;
    },

    async createInterview(row) {
      const { data, error } = await supabase
        .from('interview_schedules')
        .insert(row)
        .select('id')
        .single();
      if (error || !data) fail(error, 'Failed to schedule the meeting');
      return { id: data.id };
    },

    async updateInterview(interviewId, patch) {
      // One UPDATE statement, so the reschedule is atomic: the row moves to the
      // new time in place and never coexists with a second live row.
      const { data, error } = await supabase
        .from('interview_schedules')
        .update({ ...patch, cancelled_by: null, cancelled_at: null })
        .eq('id', interviewId)
        .select('id')
        .single();
      if (error || !data) fail(error, 'Failed to reschedule the meeting');
      return { id: data.id };
    },

    async getContext(requestId): Promise<RequestContext | null> {
      const { data } = await supabase
        .from('interview_availability_requests')
        .select(`
          id,
          listing:internship_listings(title),
          student:students(user_id, profile:profiles!students_user_id_fkey(full_name)),
          employer:employers(user_id, company_name)
        `)
        .eq('id', requestId)
        .maybeSingle();
      if (!data) return null;

      const listing = one<{ title: string } | null>((data as Record<string, unknown>).listing);
      const student = one<{ user_id: string; profile: unknown } | null>((data as Record<string, unknown>).student);
      const employer = one<{ user_id: string; company_name: string } | null>((data as Record<string, unknown>).employer);
      const studentProfile = student ? one<{ full_name: string } | null>(student.profile) : null;

      return {
        studentUserId: student?.user_id ?? null,
        employerUserId: employer?.user_id ?? null,
        studentName: studentProfile?.full_name ?? 'The candidate',
        companyName: employer?.company_name ?? 'The employer',
        listingTitle: listing?.title ?? 'the role',
      };
    },
  };
}
