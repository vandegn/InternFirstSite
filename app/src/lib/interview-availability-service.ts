// ============================================
// INTERVIEW AVAILABILITY HANDSHAKE — server flow
// ============================================
// The three steps of the handshake, expressed against a narrow repository
// interface rather than a Supabase client directly. The API routes wire in the
// Supabase-backed repo (interview-availability-repo.ts); the tests wire in an
// in-memory one and drive the whole flow end to end.
//
// Every function returns { status, body } so the routes stay one-liners and the
// tests can assert on real HTTP semantics.

import {
  assertTransition,
  canTransition,
  localToday,
  validateWindow,
  validateSlots,
  validateConfirmedTime,
  formatWindowLabel,
  DEFAULT_DURATION_MINUTES,
  type AvailabilityRequest,
  type AvailabilitySlot,
  type AvailabilityStatus,
} from './interview-availability';

export type ServiceResult<T = unknown> = { status: number; body: T };

const err = (status: number, error: string): ServiceResult<{ error: string }> => ({ status, body: { error } });

export type RequestContext = {
  studentUserId: string | null;
  employerUserId: string | null;
  studentName: string;
  companyName: string;
  listingTitle: string;
};

export type AvailabilityRepo = {
  /** The employer row owned by this auth user, or null. */
  getEmployerIdForUser(userId: string): Promise<string | null>;
  /** The student row owned by this auth user, or null. */
  getStudentIdForUser(userId: string): Promise<string | null>;
  getApplication(applicationId: string): Promise<
    { id: string; listing_id: string; student_id: string; employer_id: string } | null
  >;
  /** The open negotiation on this application, if any. */
  getLiveRequestForApplication(applicationId: string): Promise<AvailabilityRequest | null>;
  getRequest(requestId: string): Promise<AvailabilityRequest | null>;
  insertRequest(row: {
    application_id: string;
    employer_id: string;
    student_id: string;
    listing_id: string;
    window_start: string;
    window_end: string;
    duration_minutes: number;
    employer_note: string | null;
    status: AvailabilityStatus;
  }): Promise<AvailabilityRequest>;
  updateRequest(requestId: string, patch: Partial<AvailabilityRequest>): Promise<AvailabilityRequest>;
  getSlots(requestId: string): Promise<AvailabilitySlot[]>;
  /** Resubmitting replaces the previous offer wholesale. */
  replaceSlots(requestId: string, slots: AvailabilitySlot[]): Promise<AvailabilitySlot[]>;
  insertMessage(row: {
    sender_id: string;
    receiver_id: string;
    body: string;
    application_id: string | null;
    availability_request_id: string;
  }): Promise<{ id: string }>;
  createNotification(row: {
    user_id: string;
    actor_id: string;
    type: 'interview';
    title: string;
    body: string;
    link: string;
  }): Promise<void>;
  createInterview(row: {
    application_id: string;
    employer_id: string;
    student_id: string;
    listing_id: string;
    scheduled_at: string;
    duration_minutes: number;
    employer_notes: string | null;
  }): Promise<{ id: string }>;
  getContext(requestId: string): Promise<RequestContext | null>;
};

// ============================================
// Step 1 — the employer requests times
// ============================================
export async function requestAvailability(
  repo: AvailabilityRepo,
  input: {
    userId: string;
    applicationId: string;
    windowStart: string;
    windowEnd: string;
    durationMinutes?: number;
    note?: string;
    /** The employer's local day; injected so "not in the past" is testable. */
    today?: string;
  },
): Promise<ServiceResult> {
  const { userId, applicationId, windowStart, windowEnd } = input;
  if (!applicationId || !windowStart || !windowEnd) {
    return err(400, 'applicationId, windowStart and windowEnd are required');
  }

  const employerId = await repo.getEmployerIdForUser(userId);
  if (!employerId) return err(403, 'Forbidden');

  const application = await repo.getApplication(applicationId);
  if (!application) return err(404, 'Application not found');
  if (application.employer_id !== employerId) return err(403, 'Forbidden');

  const windowCheck = validateWindow(windowStart, windowEnd, input.today ?? localToday());
  if (!windowCheck.ok) return err(400, windowCheck.error);

  // One live negotiation per application — the same rule the partial unique
  // index enforces. Re-requesting means cancelling first, which the board does
  // explicitly so the employer sees what they're replacing.
  const existing = await repo.getLiveRequestForApplication(applicationId);
  if (existing) {
    return err(409, 'This candidate already has an open interview request. Withdraw it before requesting new times.');
  }

  const durationMinutes = input.durationMinutes ?? DEFAULT_DURATION_MINUTES;
  if (!(durationMinutes > 0)) return err(400, 'Pick a valid interview length');

  const request = await repo.insertRequest({
    application_id: applicationId,
    employer_id: employerId,
    student_id: application.student_id,
    listing_id: application.listing_id,
    window_start: windowStart,
    window_end: windowEnd,
    duration_minutes: durationMinutes,
    employer_note: input.note?.trim() || null,
    status: 'requested',
  });

  const context = await repo.getContext(request.id);

  // The inbox message *is* the student-facing step — without it there is
  // nothing for them to answer. If we can't resolve who to send it to, leave
  // the row at 'requested' rather than claiming we're awaiting a student who
  // was never asked.
  if (!context?.studentUserId) {
    return err(500, 'Could not reach this candidate to ask for their availability');
  }

  const window = formatWindowLabel(windowStart, windowEnd);
  // The body is a readable fallback for anywhere the picker can't render
  // (email notifications, conversation previews); the inbox itself keys off
  // availability_request_id.
  const body =
    `${context.companyName} would like to interview you for ${context.listingTitle}. ` +
    `Let them know which days and times work for you between ${window}.` +
    (input.note?.trim() ? `\n\n${input.note.trim()}` : '');

  const message = await repo.insertMessage({
    sender_id: userId,
    receiver_id: context.studentUserId,
    body,
    application_id: applicationId,
    availability_request_id: request.id,
  });

  await repo.createNotification({
    user_id: context.studentUserId,
    actor_id: userId,
    type: 'interview',
    title: 'Interview times requested',
    body: `${context.companyName} asked for your availability between ${window}.`,
    link: '/dashboard/student/inbox',
  });

  // 'requested' -> 'awaiting_student': the ball is now in the student's court.
  // A separate write from the insert, so a message that never got sent leaves
  // the row visibly stuck at 'requested' instead of silently claiming it was.
  assertTransition(request.status, 'awaiting_student');
  const updated = await repo.updateRequest(request.id, {
    status: 'awaiting_student',
    message_id: message.id,
  });

  return { status: 200, body: updated };
}

// ============================================
// Step 2 — the student submits availability
// ============================================
export async function submitAvailability(
  repo: AvailabilityRepo,
  input: {
    userId: string;
    requestId: string;
    slots: AvailabilitySlot[];
    note?: string;
    timezone?: string;
    /** "None of these days work for me." */
    noneWork?: boolean;
  },
): Promise<ServiceResult> {
  const request = await repo.getRequest(input.requestId);
  if (!request) return err(404, 'Interview request not found');

  const studentId = await repo.getStudentIdForUser(input.userId);
  if (!studentId || studentId !== request.student_id) return err(403, 'Forbidden');

  const target: AvailabilityStatus = input.noneWork ? 'no_availability' : 'awaiting_employer';
  if (!canTransition(request.status, target)) {
    return err(409, `This interview request is no longer awaiting your availability (it is "${request.status}")`);
  }

  const context = await repo.getContext(request.id);

  // ---- the student can't make any of it work ----
  // A real, recorded outcome rather than an empty submission: the employer sees
  // "No times worked" on the board and can re-request a different window.
  if (input.noneWork) {
    await repo.replaceSlots(request.id, []);
    const updated = await repo.updateRequest(request.id, {
      status: 'no_availability',
      student_note: input.note?.trim() || null,
      student_timezone: input.timezone ?? null,
      responded_at: new Date().toISOString(),
    });

    if (context?.employerUserId) {
      await repo.createNotification({
        user_id: context.employerUserId,
        actor_id: input.userId,
        type: 'interview',
        title: 'No availability in that window',
        body: `${context.studentName} can't make any time between ${formatWindowLabel(request.window_start, request.window_end)}. Request a different window.`,
        link: '/dashboard/employer/pipeline',
      });
    }
    return { status: 200, body: updated };
  }

  // ---- normal path: frames inside the window ----
  const slotCheck = validateSlots(input.slots, request, request.duration_minutes);
  if (!slotCheck.ok) return err(400, slotCheck.error);

  const slots = await repo.replaceSlots(request.id, input.slots);
  const updated = await repo.updateRequest(request.id, {
    status: 'awaiting_employer',
    student_note: input.note?.trim() || null,
    student_timezone: input.timezone ?? null,
    responded_at: new Date().toISOString(),
  });

  // Step 3's trigger: pull the employer back to the pipeline to pick a time.
  if (context?.employerUserId) {
    await repo.createNotification({
      user_id: context.employerUserId,
      actor_id: input.userId,
      type: 'interview',
      title: 'Candidate shared their availability',
      body: `${context.studentName} offered ${slots.length} time${slots.length === 1 ? '' : 's'} for ${context.listingTitle}. Pick one to lock in the interview.`,
      link: '/dashboard/employer/pipeline',
    });
  }

  return { status: 200, body: { ...updated, slots } };
}

// ============================================
// Step 3 — the employer picks the final time
// ============================================
export async function confirmInterviewTime(
  repo: AvailabilityRepo,
  input: {
    userId: string;
    requestId: string;
    scheduledAt: string;
    durationMinutes?: number;
    notes?: string;
  },
): Promise<ServiceResult> {
  const request = await repo.getRequest(input.requestId);
  if (!request) return err(404, 'Interview request not found');

  const employerId = await repo.getEmployerIdForUser(input.userId);
  if (!employerId || employerId !== request.employer_id) return err(403, 'Forbidden');

  if (!canTransition(request.status, 'scheduled')) {
    return err(409, `This interview request is not ready to be scheduled (it is "${request.status}")`);
  }

  const durationMinutes = input.durationMinutes ?? request.duration_minutes;
  const slots = await repo.getSlots(request.id);
  const timeCheck = validateConfirmedTime(input.scheduledAt, durationMinutes, slots);
  if (!timeCheck.ok) return err(400, timeCheck.error);

  // The real interview row. Its insert trigger moves the pipeline card and the
  // existing student-facing interview surfaces (banner, response modal) pick it
  // up with no further work.
  const interview = await repo.createInterview({
    application_id: request.application_id,
    employer_id: request.employer_id,
    student_id: request.student_id,
    listing_id: request.listing_id,
    scheduled_at: input.scheduledAt,
    duration_minutes: durationMinutes,
    employer_notes: input.notes?.trim() || null,
  });

  const updated = await repo.updateRequest(request.id, {
    status: 'scheduled',
    interview_id: interview.id,
    scheduled_at_confirmed: input.scheduledAt,
    duration_minutes: durationMinutes,
  });

  const context = await repo.getContext(request.id);
  if (context?.studentUserId) {
    await repo.createNotification({
      user_id: context.studentUserId,
      actor_id: input.userId,
      type: 'interview',
      title: 'Interview scheduled',
      body: `${context.companyName} booked your ${context.listingTitle} interview from the times you offered.`,
      link: '/dashboard/student/applications',
    });
  }

  return { status: 200, body: { ...updated, interview_id: interview.id } };
}

// ============================================
// Off-ramp — the employer withdraws / re-requests
// ============================================
// Used when none of the offered slots work, or when the student reported no
// availability. Cancelling frees the partial unique index so the board can open
// a fresh request with a different window; the cancelled row stays as history.
export async function cancelAvailabilityRequest(
  repo: AvailabilityRepo,
  input: { userId: string; requestId: string; reason?: string },
): Promise<ServiceResult> {
  const request = await repo.getRequest(input.requestId);
  if (!request) return err(404, 'Interview request not found');

  const employerId = await repo.getEmployerIdForUser(input.userId);
  if (!employerId || employerId !== request.employer_id) return err(403, 'Forbidden');

  if (!canTransition(request.status, 'cancelled')) {
    return err(409, `This interview request can no longer be withdrawn (it is "${request.status}")`);
  }

  const updated = await repo.updateRequest(request.id, { status: 'cancelled' });

  // Only worth telling the student if they were the one being waited on.
  const context = await repo.getContext(request.id);
  if (context?.studentUserId && request.status === 'awaiting_student') {
    await repo.createNotification({
      user_id: context.studentUserId,
      actor_id: input.userId,
      type: 'interview',
      title: 'Interview request withdrawn',
      body: `${context.companyName} withdrew their request for your availability.`,
      link: '/dashboard/student/inbox',
    });
  }

  return { status: 200, body: updated };
}
