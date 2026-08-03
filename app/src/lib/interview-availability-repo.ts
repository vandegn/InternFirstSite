// Supabase-backed implementation of AvailabilityRepo.
//
// Every call runs through the caller's cookie-scoped client, so RLS is the
// real authorization boundary; the ownership checks in the service are there to
// return a clean 403/404 instead of an opaque empty result.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { AvailabilityRepo, RequestContext } from './interview-availability-service';
import type { AvailabilityRequest, AvailabilitySlot } from './interview-availability';
import { LIVE_AVAILABILITY_STATUSES } from './interview-availability';

// PostgREST hands embedded rows back as an object or a one-element array
// depending on the relationship it infers — same helper the pipeline uses.
const one = <T,>(v: unknown): T => (Array.isArray(v) ? v[0] : v) as T;

export function createAvailabilityRepo(supabase: SupabaseClient): AvailabilityRepo {
  return {
    async getEmployerIdForUser(userId) {
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
        .select('id, listing_id, student_id, listing:internship_listings(employer_id)')
        .eq('id', applicationId)
        .maybeSingle();
      if (!data) return null;
      const listing = one<{ employer_id: string } | null>((data as Record<string, unknown>).listing);
      return {
        id: data.id,
        listing_id: data.listing_id,
        student_id: data.student_id,
        employer_id: listing?.employer_id ?? '',
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
      if (error || !data) throw new Error(error?.message ?? 'Failed to create the interview request');
      return data as AvailabilityRequest;
    },

    async updateRequest(requestId, patch) {
      const { data, error } = await supabase
        .from('interview_availability_requests')
        .update(patch)
        .eq('id', requestId)
        .select()
        .single();
      if (error || !data) throw new Error(error?.message ?? 'Failed to update the interview request');
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

    async replaceSlots(requestId, slots) {
      // Resubmitting is a wholesale replace — the student's latest answer is
      // the only one that means anything.
      const { error: deleteError } = await supabase
        .from('interview_availability_slots')
        .delete()
        .eq('request_id', requestId);
      if (deleteError) throw new Error(deleteError.message);

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
      if (error) throw new Error(error.message);
      return (data ?? []) as AvailabilitySlot[];
    },

    async insertMessage(row) {
      const { data, error } = await supabase
        .from('messages')
        .insert(row)
        .select('id')
        .single();
      if (error || !data) throw new Error(error?.message ?? 'Failed to send the message');
      return { id: data.id };
    },

    async createNotification(row) {
      // Best-effort, exactly like createNotification in supabase.ts: a missing
      // notification must never fail the underlying action.
      const { error } = await supabase.from('notifications').insert(row);
      if (error) console.error('[availability notification]', error.message);
    },

    async createInterview(row) {
      const { data, error } = await supabase
        .from('interview_schedules')
        .insert({ ...row, status: 'pending' })
        .select('id')
        .single();
      if (error || !data) throw new Error(error?.message ?? 'Failed to schedule the interview');
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
