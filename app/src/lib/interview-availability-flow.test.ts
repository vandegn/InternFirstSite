import { describe, it, expect, beforeEach } from 'vitest';
import {
  requestAvailability,
  selectInterviewSlot,
  confirmInterviewTime,
  cancelAvailabilityRequest,
  type AvailabilityRepo,
  type InterviewWrite,
} from './interview-availability-service';
import {
  slotsForRange,
  buildSlot,
  isLiveInterviewStatus,
  type AvailabilityRequest,
  type AvailabilitySlot,
} from './interview-availability';

// ============================================
// In-memory repo
// ============================================
// Stands in for Supabase so the whole three-step handshake can be driven for
// real — every state transition, message, notification and interview row the
// production flow would write actually gets written here. createInterview
// enforces the same one-live-interview-per-application rule as the unique
// index interview_schedules_one_active_per_application.

const EMPLOYER_USER = 'user-employer';
const TEAMMATE_USER = 'user-teammate';
const STUDENT_USER = 'user-student';
const OTHER_EMPLOYER_USER = 'user-other-employer';
const EMPLOYER_ID = 'employer-1';
const STUDENT_ID = 'student-1';
const LISTING_ID = 'listing-1';
const APPLICATION_ID = 'application-1';

const TODAY = '2026-09-01';
const NOW = new Date('2026-09-01T12:00:00Z');
const WINDOW_START = '2026-09-07';
const WINDOW_END = '2026-09-11';
const EMPLOYER_TZ = 'America/New_York';

type StoredInterview = InterviewWrite & {
  id: string;
  application_id: string;
  status: string;
};

type Captured = {
  messages: Array<{ id: string; sender_id: string; receiver_id: string; body: string; availability_request_id?: string | null }>;
  notifications: Array<{ user_id: string; actor_id: string; title: string; body: string; link: string }>;
  interviews: StoredInterview[];
  requests: Map<string, AvailabilityRequest>;
  slots: Map<string, AvailabilitySlot[]>;
};

function makeRepo(stage: { stage_type: string; label: string } = { stage_type: 'interviewing', label: 'Interview 1' }) {
  let seq = 0;
  const nextId = (prefix: string) => `${prefix}-${++seq}`;
  const application = { stage: stage as { stage_type: string | null; label: string | null } | null };

  const captured: Captured = {
    messages: [],
    notifications: [],
    interviews: [],
    requests: new Map(),
    slots: new Map(),
  };

  const repo: AvailabilityRepo = {
    async getEmployerIdForUser(userId) {
      if (userId === EMPLOYER_USER || userId === TEAMMATE_USER) return EMPLOYER_ID;
      if (userId === OTHER_EMPLOYER_USER) return 'employer-2';
      return null;
    },
    async getStudentIdForUser(userId) {
      return userId === STUDENT_USER ? STUDENT_ID : null;
    },
    async getApplication(applicationId) {
      if (applicationId !== APPLICATION_ID) return null;
      return {
        id: APPLICATION_ID,
        listing_id: LISTING_ID,
        student_id: STUDENT_ID,
        employer_id: EMPLOYER_ID,
        stage: application.stage,
      };
    },
    async getLiveRequestForApplication(applicationId) {
      for (const r of captured.requests.values()) {
        if (
          r.application_id === applicationId &&
          ['requested', 'awaiting_student', 'awaiting_employer'].includes(r.status)
        ) {
          return r;
        }
      }
      return null;
    },
    async getRequest(requestId) {
      return captured.requests.get(requestId) ?? null;
    },
    async insertRequest(row) {
      const id = nextId('request');
      const request: AvailabilityRequest = {
        id,
        ...row,
        student_note: null,
        student_timezone: null,
        message_id: null,
        interview_id: null,
        requested_at: '2026-09-01T00:00:00.000Z',
        responded_at: null,
        scheduled_at_confirmed: null,
        selected_slot_id: null,
        selected_at: null,
      };
      captured.requests.set(id, request);
      captured.slots.set(id, []);
      return request;
    },
    async updateRequest(requestId, patch) {
      const existing = captured.requests.get(requestId);
      if (!existing) throw new Error('no such request');
      const updated = { ...existing, ...patch } as AvailabilityRequest;
      captured.requests.set(requestId, updated);
      return updated;
    },
    async getSlots(requestId) {
      return captured.slots.get(requestId) ?? [];
    },
    async insertSlots(requestId, slots) {
      const stored = slots.map(s => ({ ...s, id: nextId('slot') }));
      captured.slots.set(requestId, stored);
      return stored;
    },
    async insertMessage(row) {
      const id = nextId('message');
      captured.messages.push({
        id,
        sender_id: row.sender_id,
        receiver_id: row.receiver_id,
        body: row.body,
        availability_request_id: row.availability_request_id,
      });
      return { id };
    },
    async createNotification(row) {
      captured.notifications.push(row);
    },
    async getLiveInterviewForApplication(applicationId) {
      const live = captured.interviews.find(i => i.application_id === applicationId && isLiveInterviewStatus(i.status));
      return live ? { id: live.id } : null;
    },
    async createInterview(row) {
      // The partial unique index, enforced the way Postgres would.
      if (captured.interviews.some(i => i.application_id === row.application_id && isLiveInterviewStatus(i.status))) {
        throw new Error('duplicate key value violates unique constraint "interview_schedules_one_active_per_application"');
      }
      const id = nextId('interview');
      captured.interviews.push({ ...row, id });
      return { id };
    },
    async updateInterview(interviewId, patch) {
      const idx = captured.interviews.findIndex(i => i.id === interviewId);
      if (idx === -1) throw new Error('no such interview');
      captured.interviews[idx] = { ...captured.interviews[idx], ...patch };
      return { id: interviewId };
    },
    async getContext() {
      return {
        studentUserId: STUDENT_USER,
        employerUserId: EMPLOYER_USER,
        studentName: 'Casey Rivera',
        companyName: 'Northwind Labs',
        listingTitle: 'Data Analyst Intern',
      };
    },
  };

  return { repo, captured, application };
}

// 1:00–3:00 PM on Monday at 30 minutes: four slots, plus a 10:00 on Wednesday.
function proposedSlots(): AvailabilitySlot[] {
  return [
    ...slotsForRange({ date: '2026-09-07', startMinute: 13 * 60, endMinute: 15 * 60 }, 30),
    ...slotsForRange({ date: '2026-09-09', startMinute: 10 * 60, endMinute: 10 * 60 + 30 }, 30),
  ];
}

// Convenience: the employer's opening move, which every test starts from.
async function openRequest(
  repo: AvailabilityRepo,
  overrides: Partial<{ windowStart: string; windowEnd: string; slots: AvailabilitySlot[]; userId: string }> = {},
) {
  return requestAvailability(repo, {
    userId: overrides.userId ?? EMPLOYER_USER,
    applicationId: APPLICATION_ID,
    windowStart: overrides.windowStart ?? WINDOW_START,
    windowEnd: overrides.windowEnd ?? WINDOW_END,
    durationMinutes: 30,
    slots: overrides.slots ?? proposedSlots(),
    timeZone: EMPLOYER_TZ,
    note: 'You’ll meet with the data team.',
    today: TODAY,
    now: NOW,
  });
}

async function pick(repo: AvailabilityRepo, requestId: string, index = 1) {
  const slots = await repo.getSlots(requestId);
  return selectInterviewSlot(repo, {
    userId: STUDENT_USER,
    requestId,
    slotId: slots[index].id,
    timezone: 'America/Los_Angeles',
    now: NOW,
  });
}

describe('scheduling — employer proposes, student picks, employer confirms', () => {
  let repo: AvailabilityRepo;
  let captured: Captured;

  beforeEach(() => {
    ({ repo, captured } = makeRepo());
  });

  it('runs the whole sequence end to end', async () => {
    // ---- Step 1: employer proposes specific slots ----
    const step1 = await openRequest(repo);
    expect(step1.status).toBe(200);

    const request = step1.body as AvailabilityRequest;
    expect(request.status).toBe('awaiting_student');
    expect(request.meeting_type).toBe('interview');
    expect(request.employer_timezone).toBe(EMPLOYER_TZ);
    expect(request.requested_by).toBe(EMPLOYER_USER);
    expect(request.slots).toHaveLength(5);

    // A message carrying the picker landed in the student's inbox...
    expect(captured.messages).toHaveLength(1);
    expect(captured.messages[0].receiver_id).toBe(STUDENT_USER);
    expect(captured.messages[0].availability_request_id).toBe(request.id);
    expect(captured.messages[0].body).toMatch(/30-minute interview/);
    expect(request.message_id).toBe(captured.messages[0].id);
    expect(captured.notifications).toHaveLength(1);
    expect(captured.notifications[0]).toMatchObject({ user_id: STUDENT_USER, link: '/dashboard/student/inbox' });

    // ---- Step 2: student selects one slot — tentative ----
    const slots = await repo.getSlots(request.id);
    const step2 = await pick(repo, request.id, 1);
    expect(step2.status).toBe(200);
    const picked = step2.body as AvailabilityRequest;
    expect(picked.status).toBe('awaiting_employer');
    expect(picked.selected_slot_id).toBe(slots[1].id);
    expect(picked.student_timezone).toBe('America/Los_Angeles');
    // Nothing is booked yet: the pick is tentative until the employer confirms.
    expect(captured.interviews).toHaveLength(0);

    // The employer is pointed straight at the candidate's application.
    expect(captured.notifications[1]).toMatchObject({
      user_id: EMPLOYER_USER,
      title: 'Candidate selected a time',
      link: `/dashboard/employer/pipeline?listing=${LISTING_ID}&application=${APPLICATION_ID}`,
    });
    expect(captured.notifications[1].body).toMatch(/1:30 PM EDT/);

    // ---- Step 3: employer confirms ----
    const step3 = await confirmInterviewTime(repo, {
      userId: EMPLOYER_USER,
      requestId: request.id,
      notes: 'Bring a portfolio.',
      timeZone: EMPLOYER_TZ,
      now: NOW,
    });
    expect(step3.status).toBe(200);
    const scheduled = step3.body as AvailabilityRequest;
    expect(scheduled.status).toBe('scheduled');
    expect(scheduled.scheduled_at_confirmed).toBe(slots[1].starts_at);

    // A confirmed interview row, exactly at the student's pick.
    expect(captured.interviews).toHaveLength(1);
    expect(captured.interviews[0]).toMatchObject({
      application_id: APPLICATION_ID,
      scheduled_at: slots[1].starts_at,
      duration_minutes: 30,
      status: 'accepted',
      meeting_type: 'interview',
      organizer_user_id: EMPLOYER_USER,
      format: 'internfirst',
    });
    expect(scheduled.interview_id).toBe(captured.interviews[0].id);

    // Final details in the shared thread — type, date, time, zone, duration, location.
    const final = captured.messages[captured.messages.length - 1];
    expect(final).toMatchObject({ sender_id: EMPLOYER_USER, receiver_id: STUDENT_USER });
    expect(final.body).toContain('Interview confirmed — Data Analyst Intern at Northwind Labs');
    expect(final.body).toContain('Type: Interview');
    expect(final.body).toContain('Date: Monday, September 7, 2026');
    expect(final.body).toContain('Time: 1:30 PM EDT (10:30 AM PDT your time)');
    expect(final.body).toContain('Duration: 30 min');
    expect(final.body).toContain('Location: InternFirst video room');
    expect(final.body).toContain('Notes: Bring a portfolio.');

    expect(captured.notifications[2]).toMatchObject({
      user_id: STUDENT_USER,
      title: 'Interview confirmed',
      link: '/dashboard/student/interviews',
    });
  });

  it('records every state transition in order', async () => {
    const { body: created } = await openRequest(repo);
    const id = (created as AvailabilityRequest).id;
    const seen: string[] = [(created as AvailabilityRequest).status];
    seen.push(((await pick(repo, id)).body as AvailabilityRequest).status);
    seen.push(((await confirmInterviewTime(repo, { userId: EMPLOYER_USER, requestId: id, now: NOW })).body as AvailabilityRequest).status);
    expect(seen).toEqual(['awaiting_student', 'awaiting_employer', 'scheduled']);
  });

  it('a Screening stage produces a screening, labelled as such', async () => {
    ({ repo, captured } = makeRepo({ stage_type: 'screening', label: 'Phone Screening' }));
    const { body } = await openRequest(repo);
    const id = (body as AvailabilityRequest).id;
    expect((body as AvailabilityRequest).meeting_type).toBe('screening');
    await pick(repo, id);
    await confirmInterviewTime(repo, { userId: EMPLOYER_USER, requestId: id, format: 'phone', timeZone: EMPLOYER_TZ, now: NOW });
    expect(captured.interviews[0].meeting_type).toBe('screening');
    const final = captured.messages[captured.messages.length - 1].body;
    expect(final).toContain('Screening confirmed');
    expect(final).toContain('Type: Screening (phone)');
    expect(final).toContain('best phone number');
  });

  it('notifies the teammate who sent the times, not just the account owner', async () => {
    const { body } = await openRequest(repo, { userId: TEAMMATE_USER });
    await pick(repo, (body as AvailabilityRequest).id);
    expect(captured.notifications.find(n => n.title === 'Candidate selected a time')?.user_id).toBe(TEAMMATE_USER);
  });
});

describe('only Screening and Interview candidates can be scheduled', () => {
  it('refuses a request for a candidate in another stage', async () => {
    const { repo, captured } = makeRepo({ stage_type: 'reviewing', label: 'Under Review' });
    const result = await openRequest(repo);
    expect(result.status).toBe(409);
    expect((result.body as { error: string }).error).toMatch(/Screening or Interview stage/);
    expect(captured.requests.size).toBe(0);
  });
});

describe('Task A — rescheduling a confirmed meeting', () => {
  it('moves the existing interview in place instead of inserting a duplicate live row', async () => {
    const { repo, captured } = makeRepo();

    // First booking.
    const first = (await openRequest(repo)).body as AvailabilityRequest;
    await pick(repo, first.id, 0);
    await confirmInterviewTime(repo, { userId: EMPLOYER_USER, requestId: first.id, now: NOW });
    expect(captured.interviews).toHaveLength(1);
    const originalId = captured.interviews[0].id;

    // Reschedule: new times, new pick, confirm again. This used to insert a
    // second live row and fail on interview_schedules_one_active_per_application.
    const second = (await openRequest(repo, {
      windowStart: '2026-09-14',
      windowEnd: '2026-09-18',
      slots: slotsForRange({ date: '2026-09-15', startMinute: 9 * 60, endMinute: 10 * 60 }, 30),
    })).body as AvailabilityRequest;
    await pick(repo, second.id, 1);
    const result = await confirmInterviewTime(repo, {
      userId: EMPLOYER_USER, requestId: second.id, format: 'external_link', meetingUrl: 'https://zoom.us/j/1', timeZone: EMPLOYER_TZ, now: NOW,
    });

    expect(result.status).toBe(200);
    expect(captured.interviews).toHaveLength(1);
    expect(captured.interviews[0].id).toBe(originalId);
    const newSlots = await repo.getSlots(second.id);
    expect(captured.interviews[0]).toMatchObject({
      scheduled_at: newSlots[1].starts_at,
      format: 'external_link',
      meeting_url: 'https://zoom.us/j/1',
      status: 'accepted',
    });
    expect((result.body as AvailabilityRequest).interview_id).toBe(originalId);
    expect(captured.messages[captured.messages.length - 1].body).toMatch(/^Updated: Interview confirmed/);
  });
});

describe('edge cases on the student side', () => {
  let repo: AvailabilityRepo;
  let captured: Captured;

  beforeEach(() => {
    ({ repo, captured } = makeRepo());
  });

  it('refuses a pick that is not one of the offered slots', async () => {
    const { body } = await openRequest(repo);
    const id = (body as AvailabilityRequest).id;
    const result = await selectInterviewSlot(repo, { userId: STUDENT_USER, requestId: id, slotId: 'made-up', now: NOW });
    expect(result.status).toBe(400);
    expect((await repo.getRequest(id))?.status).toBe('awaiting_student');
    expect(captured.notifications.filter(n => n.user_id === EMPLOYER_USER)).toHaveLength(0);
  });

  it('records "none of these work" as a real outcome and notifies the employer', async () => {
    const { body } = await openRequest(repo);
    const id = (body as AvailabilityRequest).id;
    const result = await selectInterviewSlot(repo, {
      userId: STUDENT_USER, requestId: id, noneWork: true, note: 'I’m abroad that whole week.', now: NOW,
    });
    expect(result.status).toBe(200);
    expect((result.body as AvailabilityRequest).status).toBe('no_availability');
    const toEmployer = captured.notifications.filter(n => n.user_id === EMPLOYER_USER);
    expect(toEmployer).toHaveLength(1);
    expect(toEmployer[0].title).toBe('None of the offered times work');

    const confirm = await confirmInterviewTime(repo, { userId: EMPLOYER_USER, requestId: id, now: NOW });
    expect(confirm.status).toBe(409);
    expect(captured.interviews).toHaveLength(0);
  });

  it('refuses a second pick once one is waiting on the employer', async () => {
    const { body } = await openRequest(repo);
    const id = (body as AvailabilityRequest).id;
    await pick(repo, id, 0);
    const again = await pick(repo, id, 2);
    expect(again.status).toBe(409);
    expect((await repo.getRequest(id))?.selected_slot_id).toBe((await repo.getSlots(id))[0].id);
  });

  it('refuses a student responding to somebody else’s request', async () => {
    const { body } = await openRequest(repo);
    const slots = await repo.getSlots((body as AvailabilityRequest).id);
    const result = await selectInterviewSlot(repo, {
      userId: OTHER_EMPLOYER_USER, requestId: (body as AvailabilityRequest).id, slotId: slots[0].id, now: NOW,
    });
    expect(result.status).toBe(403);
  });
});

describe('re-requesting and withdrawing', () => {
  let repo: AvailabilityRepo;
  let captured: Captured;

  beforeEach(() => {
    ({ repo, captured } = makeRepo());
  });

  it('blocks a second live request until the first is withdrawn', async () => {
    await openRequest(repo);
    const second = await openRequest(repo);
    expect(second.status).toBe(409);
    expect((second.body as { error: string }).error).toMatch(/already has an open time request/i);
  });

  it('lets the employer withdraw a pick they can no longer make and send new times', async () => {
    const first = (await openRequest(repo)).body as AvailabilityRequest;
    await pick(repo, first.id);

    const withdrawn = await cancelAvailabilityRequest(repo, { userId: EMPLOYER_USER, requestId: first.id });
    expect(withdrawn.status).toBe(200);
    expect((withdrawn.body as AvailabilityRequest).status).toBe('cancelled');
    // The student had a pick waiting, so they're told.
    expect(captured.notifications.filter(n => n.user_id === STUDENT_USER).map(n => n.title))
      .toContain('Time request withdrawn');

    const second = await openRequest(repo, {
      windowStart: '2026-09-14', windowEnd: '2026-09-18',
      slots: slotsForRange({ date: '2026-09-14', startMinute: 600, endMinute: 660 }, 30),
    });
    expect(second.status).toBe(200);
    expect((await repo.getRequest(first.id))?.status).toBe('cancelled');
  });

  it('re-requests after the student reported none work', async () => {
    const first = (await openRequest(repo)).body as AvailabilityRequest;
    await selectInterviewSlot(repo, { userId: STUDENT_USER, requestId: first.id, noneWork: true, now: NOW });
    const second = await openRequest(repo, {
      windowStart: '2026-09-21', windowEnd: '2026-09-25',
      slots: slotsForRange({ date: '2026-09-22', startMinute: 600, endMinute: 660 }, 30),
    });
    expect(second.status).toBe(200);
  });

  it('refuses withdrawing an already-confirmed meeting', async () => {
    const { body } = await openRequest(repo);
    const id = (body as AvailabilityRequest).id;
    await pick(repo, id);
    await confirmInterviewTime(repo, { userId: EMPLOYER_USER, requestId: id, now: NOW });
    const result = await cancelAvailabilityRequest(repo, { userId: EMPLOYER_USER, requestId: id });
    expect(result.status).toBe(409);
  });
});

describe('guards', () => {
  let repo: AvailabilityRepo;
  let captured: Captured;

  beforeEach(() => {
    ({ repo, captured } = makeRepo());
  });

  it('refuses a window that starts in the past', async () => {
    const result = await openRequest(repo, { windowStart: '2026-08-20', windowEnd: '2026-08-25' });
    expect(result.status).toBe(400);
    expect((result.body as { error: string }).error).toMatch(/cannot start in the past/i);
  });

  it('refuses slots outside the window', async () => {
    const result = await openRequest(repo, { slots: [buildSlot('2026-09-20', 600, 630)] });
    expect(result.status).toBe(400);
    expect((result.body as { error: string }).error).toMatch(/outside the date window/i);
    expect(captured.requests.size).toBe(0);
  });

  it('refuses a request with no slots', async () => {
    const result = await openRequest(repo, { slots: [] });
    expect(result.status).toBe(400);
  });

  it("refuses an employer who does not own the candidate's application", async () => {
    const result = await openRequest(repo, { userId: OTHER_EMPLOYER_USER });
    expect(result.status).toBe(403);
  });

  it('refuses confirming before the student has picked', async () => {
    const { body } = await openRequest(repo);
    const result = await confirmInterviewTime(repo, { userId: EMPLOYER_USER, requestId: (body as AvailabilityRequest).id, now: NOW });
    expect(result.status).toBe(409);
    expect((result.body as { error: string }).error).toMatch(/no selected time/i);
  });

  it('refuses confirming twice', async () => {
    const { body } = await openRequest(repo);
    const id = (body as AvailabilityRequest).id;
    await pick(repo, id);
    await confirmInterviewTime(repo, { userId: EMPLOYER_USER, requestId: id, now: NOW });
    const again = await confirmInterviewTime(repo, { userId: EMPLOYER_USER, requestId: id, now: NOW });
    expect(again.status).toBe(409);
    expect(captured.interviews).toHaveLength(1);
  });

  it('refuses confirming a pick whose time has already passed', async () => {
    const { body } = await openRequest(repo);
    const id = (body as AvailabilityRequest).id;
    await pick(repo, id, 0);
    const later = new Date('2026-09-30T00:00:00Z');
    const result = await confirmInterviewTime(repo, { userId: EMPLOYER_USER, requestId: id, now: later });
    expect(result.status).toBe(409);
    expect(captured.interviews).toHaveLength(0);
  });

  it('own link: refuses a missing link without scheduling anything', async () => {
    const { body } = await openRequest(repo);
    const id = (body as AvailabilityRequest).id;
    await pick(repo, id);
    const result = await confirmInterviewTime(repo, {
      userId: EMPLOYER_USER, requestId: id, format: 'external_link', meetingUrl: '  ', now: NOW,
    });
    expect(result.status).toBe(400);
    expect(captured.interviews).toHaveLength(0);
  });

  it('own link: the link is stored and sent with the final details', async () => {
    const { body } = await openRequest(repo);
    const id = (body as AvailabilityRequest).id;
    await pick(repo, id);
    await confirmInterviewTime(repo, {
      userId: EMPLOYER_USER, requestId: id, format: 'external_link', meetingUrl: 'https://zoom.us/j/123456', timeZone: EMPLOYER_TZ, now: NOW,
    });
    expect(captured.interviews[0]).toMatchObject({ format: 'external_link', meeting_url: 'https://zoom.us/j/123456' });
    expect(captured.messages[captured.messages.length - 1].body).toContain('Link: https://zoom.us/j/123456');
  });

  it('leaves the request at "requested" when the student cannot be reached', async () => {
    repo.getContext = async () => ({
      studentUserId: null,
      employerUserId: EMPLOYER_USER,
      studentName: 'Casey Rivera',
      companyName: 'Northwind Labs',
      listingTitle: 'Data Analyst Intern',
    });
    const result = await openRequest(repo);
    expect(result.status).toBe(500);
    expect(captured.messages).toHaveLength(0);
    expect([...captured.requests.values()][0].status).toBe('requested');
  });

  it('404s on an unknown request', async () => {
    const result = await selectInterviewSlot(repo, { userId: STUDENT_USER, requestId: 'nope', slotId: 'x', now: NOW });
    expect(result.status).toBe(404);
  });
});
