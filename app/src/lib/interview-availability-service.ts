// ============================================
// INTERVIEW AVAILABILITY HANDSHAKE — server flow
// ============================================
// The three steps of the handshake, expressed against a narrow repository
// interface rather than a Supabase client directly. The API routes wire in the
// Supabase-backed repo (interview-availability-repo.ts); the tests wire in an
// in-memory one and drive the whole flow end to end.
//
//   1. requestAvailability   — employer proposes concrete slots   -> awaiting_student
//   2. selectInterviewSlot   — student picks one (tentative)      -> awaiting_employer
//   3. confirmInterviewTime  — employer confirms it               -> scheduled
//
// Every function returns { status, body } so the routes stay one-liners and the
// tests can assert on real HTTP semantics.

import {
  assertTransition,
  canTransition,
  localToday,
  validateWindow,
  validateProposedSlots,
  validateSlotChoice,
  formatWindowLabel,
  formatMeetingWhen,
  meetingTypeForStage,
  isMeetingType,
  MEETING_TYPE_LABELS,
  DEFAULT_DURATION_MINUTES,
  type AvailabilityRequest,
  type AvailabilitySlot,
  type AvailabilityStatus,
  type MeetingType,
} from './interview-availability';
import {
  validateInterviewFormat,
  buildConfirmedMeetingMessage,
  type InterviewFormat,
} from './interview-format';

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
  /** The employer row this auth user acts for, or null. */
  getEmployerIdForUser(userId: string): Promise<string | null>;
  /** The student row owned by this auth user, or null. */
  getStudentIdForUser(userId: string): Promise<string | null>;
  getApplication(applicationId: string): Promise<{
    id: string;
    listing_id: string;
    student_id: string;
    employer_id: string;
    /** The candidate's current pipeline column — decides Screening vs Interview. */
    stage: { stage_type: string | null; label: string | null } | null;
  } | null>;
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
    meeting_type: MeetingType;
    employer_timezone: string | null;
    requested_by: string;
  }): Promise<AvailabilityRequest>;
  updateRequest(requestId: string, patch: Partial<AvailabilityRequest>): Promise<AvailabilityRequest>;
  getSlots(requestId: string): Promise<AvailabilitySlot[]>;
  /** The employer's proposed slots, written once when the request is made. */
  insertSlots(requestId: string, slots: AvailabilitySlot[]): Promise<AvailabilitySlot[]>;
  insertMessage(row: {
    sender_id: string;
    receiver_id: string;
    body: string;
    application_id: string | null;
    /** Set only for the picker message; plain chat messages leave it out. */
    availability_request_id?: string | null;
  }): Promise<{ id: string }>;
  createNotification(row: {
    user_id: string;
    actor_id: string;
    type: 'interview';
    title: string;
    body: string;
    link: string;
  }): Promise<void>;
  /** The application's interview that still has to happen, if any. */
  getLiveInterviewForApplication(applicationId: string): Promise<{ id: string } | null>;
  createInterview(row: InterviewWrite & {
    application_id: string;
    employer_id: string;
    student_id: string;
    listing_id: string;
  }): Promise<{ id: string }>;
  /** Moves an existing live interview to the confirmed time — the reschedule path. */
  updateInterview(interviewId: string, patch: InterviewWrite): Promise<{ id: string }>;
  getContext(requestId: string): Promise<RequestContext | null>;
};

export type InterviewWrite = {
  scheduled_at: string;
  duration_minutes: number;
  employer_notes: string | null;
  format: InterviewFormat;
  meeting_url: string | null;
  meeting_type: MeetingType;
  organizer_user_id: string;
  status: 'accepted';
};

/** Deep link to one candidate's expanded application on the board. */
export function candidateLink(request: Pick<AvailabilityRequest, 'listing_id' | 'application_id'>): string {
  return `/dashboard/employer/pipeline?listing=${request.listing_id}&application=${request.application_id}`;
}

// ============================================
// Step 1 — the employer proposes time slots
// ============================================
export async function requestAvailability(
  repo: AvailabilityRepo,
  input: {
    userId: string;
    applicationId: string;
    windowStart: string;
    windowEnd: string;
    durationMinutes?: number;
    /** Concrete meeting-length slots inside the window. */
    slots: AvailabilitySlot[];
    /** The employer's IANA zone — the zone the slots were drawn in. */
    timeZone?: string;
    note?: string;
    /** The employer's local day; injected so "not in the past" is testable. */
    today?: string;
    now?: Date;
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

  // Scheduling only exists for Screening and Interview columns.
  const meetingType = meetingTypeForStage(application.stage);
  if (!meetingType) {
    return err(409, 'Move this candidate into a Screening or Interview stage before requesting a time.');
  }

  const windowCheck = validateWindow(windowStart, windowEnd, input.today ?? localToday());
  if (!windowCheck.ok) return err(400, windowCheck.error);

  const durationMinutes = input.durationMinutes ?? DEFAULT_DURATION_MINUTES;
  if (!(durationMinutes > 0)) return err(400, 'Pick a valid meeting length');

  const slots = Array.isArray(input.slots) ? input.slots : [];
  const slotCheck = validateProposedSlots(
    slots,
    { window_start: windowStart, window_end: windowEnd },
    durationMinutes,
    input.now ?? new Date(),
  );
  if (!slotCheck.ok) return err(400, slotCheck.error);

  // One live negotiation per application — the same rule the partial unique
  // index enforces. Re-requesting means withdrawing first.
  const existing = await repo.getLiveRequestForApplication(applicationId);
  if (existing) {
    return err(409, 'This candidate already has an open time request. Withdraw it before requesting new times.');
  }

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
    meeting_type: meetingType,
    employer_timezone: input.timeZone ?? null,
    requested_by: userId,
  });
  const stored = await repo.insertSlots(request.id, slots);

  const context = await repo.getContext(request.id);

  // The inbox message *is* the student-facing step — without it there is
  // nothing for them to answer. If we can't resolve who to send it to, leave
  // the row at 'requested' rather than claiming we're awaiting a student who
  // was never asked.
  if (!context?.studentUserId) {
    return err(500, 'Could not reach this candidate to ask them to pick a time');
  }

  const typeLabel = MEETING_TYPE_LABELS[meetingType].toLowerCase();
  const window = formatWindowLabel(windowStart, windowEnd);
  // The body is a readable fallback for anywhere the picker can't render
  // (email notifications, conversation previews); the inbox itself keys off
  // availability_request_id.
  const body =
    `${context.companyName} would like to schedule a ${durationMinutes}-minute ${typeLabel} for ${context.listingTitle}. ` +
    `Pick one of the ${stored.length} time${stored.length === 1 ? '' : 's'} they offered between ${window}.` +
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
    title: `Pick a ${typeLabel} time`,
    body: `${context.companyName} offered ${stored.length} time${stored.length === 1 ? '' : 's'} between ${window}.`,
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

  return { status: 200, body: { ...updated, slots: stored } };
}

// ============================================
// Step 2 — the student picks one slot (tentative)
// ============================================
export async function selectInterviewSlot(
  repo: AvailabilityRepo,
  input: {
    userId: string;
    requestId: string;
    slotId?: string | null;
    note?: string;
    timezone?: string;
    /** "None of these times work for me." */
    noneWork?: boolean;
    now?: Date;
  },
): Promise<ServiceResult> {
  const request = await repo.getRequest(input.requestId);
  if (!request) return err(404, 'Interview request not found');

  const studentId = await repo.getStudentIdForUser(input.userId);
  if (!studentId || studentId !== request.student_id) return err(403, 'Forbidden');

  const target: AvailabilityStatus = input.noneWork ? 'no_availability' : 'awaiting_employer';
  if (!canTransition(request.status, target)) {
    return err(409, `This request is no longer waiting on your pick (it is "${request.status}")`);
  }

  const context = await repo.getContext(request.id);
  const meetingType: MeetingType = isMeetingType(request.meeting_type) ? request.meeting_type : 'interview';
  const typeLabel = MEETING_TYPE_LABELS[meetingType].toLowerCase();
  // The teammate who sent the times owns the follow-up; older rows without
  // requested_by fall back to the company's account owner.
  const employerRecipient = request.requested_by ?? context?.employerUserId ?? null;

  // ---- none of the offered times work ----
  // A real, recorded outcome rather than an empty submission: the employer sees
  // "No times worked" and can request different times.
  if (input.noneWork) {
    const updated = await repo.updateRequest(request.id, {
      status: 'no_availability',
      student_note: input.note?.trim() || null,
      student_timezone: input.timezone ?? null,
      responded_at: new Date().toISOString(),
    });

    if (employerRecipient) {
      await repo.createNotification({
        user_id: employerRecipient,
        actor_id: input.userId,
        type: 'interview',
        title: 'None of the offered times work',
        body: `${context?.studentName ?? 'The candidate'} can't make any of the ${typeLabel} times you offered for ${context?.listingTitle ?? 'the role'}. Request different times.`,
        link: candidateLink(request),
      });
    }
    return { status: 200, body: updated };
  }

  // ---- normal path: one of the offered slots ----
  const slots = await repo.getSlots(request.id);
  const choice = validateSlotChoice(input.slotId, slots, input.now ?? new Date());
  if (!choice.ok) return err(400, choice.error);
  const slot = slots.find(s => s.id === input.slotId)!;

  const updated = await repo.updateRequest(request.id, {
    status: 'awaiting_employer',
    selected_slot_id: slot.id,
    selected_at: new Date().toISOString(),
    student_note: input.note?.trim() || null,
    student_timezone: input.timezone ?? null,
    responded_at: new Date().toISOString(),
  });

  // Step 3's trigger: the employer has a tentative time to confirm.
  if (employerRecipient) {
    await repo.createNotification({
      user_id: employerRecipient,
      actor_id: input.userId,
      type: 'interview',
      title: 'Candidate selected a time',
      body: `${context?.studentName ?? 'The candidate'} selected ${formatMeetingWhen(slot.starts_at, request.employer_timezone)} for the ${context?.listingTitle ?? 'role'} ${typeLabel}. Confirm it to lock it in.`,
      link: candidateLink(request),
    });
  }

  return { status: 200, body: { ...updated, slots } };
}

// ============================================
// Step 3 — the employer confirms the student's pick
// ============================================
export async function confirmInterviewTime(
  repo: AvailabilityRepo,
  input: {
    userId: string;
    requestId: string;
    notes?: string;
    format?: InterviewFormat;
    meetingUrl?: string | null;
    /** The employer's zone, so the chat message reads in their time. */
    timeZone?: string;
    /** The category the candidate is in now; falls back to the request's. */
    meetingType?: MeetingType;
    now?: Date;
  },
): Promise<ServiceResult> {
  const request = await repo.getRequest(input.requestId);
  if (!request) return err(404, 'Interview request not found');

  const employerId = await repo.getEmployerIdForUser(input.userId);
  if (!employerId || employerId !== request.employer_id) return err(403, 'Forbidden');

  const formatCheck = validateInterviewFormat({ format: input.format, meetingUrl: input.meetingUrl });
  if (!formatCheck.ok) return err(400, formatCheck.error);

  if (!canTransition(request.status, 'scheduled')) {
    return err(409, `This request has no selected time to confirm (it is "${request.status}")`);
  }

  const slots = await repo.getSlots(request.id);
  const choice = validateSlotChoice(request.selected_slot_id, slots, input.now ?? new Date());
  if (!choice.ok) return err(409, `The candidate's selected time can't be confirmed: ${choice.error}`);
  const slot = slots.find(s => s.id === request.selected_slot_id)!;

  const meetingType: MeetingType = input.meetingType
    ?? (isMeetingType(request.meeting_type) ? request.meeting_type : 'interview');
  const durationMinutes = Math.round((Date.parse(slot.ends_at) - Date.parse(slot.starts_at)) / 60_000);

  // The student picked this time, so the meeting is confirmed on both sides
  // ('accepted') the moment the employer confirms it.
  const write: InterviewWrite = {
    scheduled_at: slot.starts_at,
    duration_minutes: durationMinutes,
    employer_notes: input.notes?.trim() || null,
    format: formatCheck.format,
    meeting_url: formatCheck.meetingUrl,
    meeting_type: meetingType,
    organizer_user_id: input.userId,
    status: 'accepted',
  };

  // At most one live interview per application (unique index
  // interview_schedules_one_active_per_application). When one already exists
  // this handshake is a reschedule, so move that row instead of inserting a
  // second — inserting is what used to fail with a duplicate-key error.
  const live = await repo.getLiveInterviewForApplication(request.application_id);
  const interview = live
    ? await repo.updateInterview(live.id, write)
    : await repo.createInterview({
        ...write,
        application_id: request.application_id,
        employer_id: request.employer_id,
        student_id: request.student_id,
        listing_id: request.listing_id,
      });

  const updated = await repo.updateRequest(request.id, {
    status: 'scheduled',
    interview_id: interview.id,
    scheduled_at_confirmed: slot.starts_at,
    duration_minutes: durationMinutes,
  });

  const context = await repo.getContext(request.id);
  const typeLabel = MEETING_TYPE_LABELS[meetingType];
  if (context?.studentUserId) {
    await repo.createNotification({
      user_id: context.studentUserId,
      actor_id: input.userId,
      type: 'interview',
      title: `${typeLabel} confirmed`,
      body: `${context.companyName} confirmed your ${context.listingTitle} ${typeLabel.toLowerCase()} for ${formatMeetingWhen(slot.starts_at, request.student_timezone ?? input.timeZone)}.`,
      link: '/dashboard/student/interviews',
    });

    // The final details land in the shared thread, which both parties read.
    await repo.insertMessage({
      sender_id: input.userId,
      receiver_id: context.studentUserId,
      body: buildConfirmedMeetingMessage({
        meetingType,
        format: formatCheck.format,
        companyName: context.companyName,
        listingTitle: context.listingTitle,
        scheduledAt: slot.starts_at,
        durationMinutes,
        meetingUrl: formatCheck.meetingUrl,
        timeZone: input.timeZone ?? request.employer_timezone ?? undefined,
        studentTimeZone: request.student_timezone,
        notes: input.notes,
        rescheduled: Boolean(live),
      }),
      application_id: request.application_id,
    });
  }

  return { status: 200, body: { ...updated, slots, interview_id: interview.id } };
}

// ============================================
// Off-ramp — the employer withdraws / re-requests
// ============================================
// Used when the student's pick no longer works, or when the student said none
// of the times did. Cancelling frees the partial unique index so a fresh
// request with different slots can be opened; the cancelled row stays as history.
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

  // Tell the student whenever they had something open on it: times to pick
  // from, or a pick that was waiting on the employer.
  const context = await repo.getContext(request.id);
  if (context?.studentUserId && (request.status === 'awaiting_student' || request.status === 'awaiting_employer')) {
    await repo.createNotification({
      user_id: context.studentUserId,
      actor_id: input.userId,
      type: 'interview',
      title: 'Time request withdrawn',
      body: `${context.companyName} withdrew the times they offered${request.status === 'awaiting_employer' ? ', including the one you picked' : ''}. They may send new ones.`,
      link: '/dashboard/student/inbox',
    });
  }

  return { status: 200, body: updated };
}
