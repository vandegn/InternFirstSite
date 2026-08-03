import { describe, it, expect, beforeEach } from 'vitest';
import {
  requestAvailability,
  submitAvailability,
  confirmInterviewTime,
  cancelAvailabilityRequest,
  type AvailabilityRepo,
} from './interview-availability-service';
import {
  buildSlot,
  enumerateStartTimes,
  type AvailabilityRequest,
  type AvailabilitySlot,
} from './interview-availability';

// ============================================
// In-memory repo
// ============================================
// Stands in for Supabase so the whole three-step handshake can be driven for
// real — every state transition, message, notification and interview row the
// production flow would write actually gets written here.

const EMPLOYER_USER = 'user-employer';
const STUDENT_USER = 'user-student';
const OTHER_EMPLOYER_USER = 'user-other-employer';
const EMPLOYER_ID = 'employer-1';
const STUDENT_ID = 'student-1';
const LISTING_ID = 'listing-1';
const APPLICATION_ID = 'application-1';

const TODAY = '2026-09-01';
const WINDOW_START = '2026-09-07';
const WINDOW_END = '2026-09-11';

type Captured = {
  messages: Array<{ id: string; sender_id: string; receiver_id: string; body: string; availability_request_id: string }>;
  notifications: Array<{ user_id: string; actor_id: string; title: string; body: string; link: string }>;
  interviews: Array<{ id: string; application_id: string; scheduled_at: string; duration_minutes: number }>;
  requests: Map<string, AvailabilityRequest>;
  slots: Map<string, AvailabilitySlot[]>;
};

function makeRepo() {
  let seq = 0;
  const nextId = (prefix: string) => `${prefix}-${++seq}`;

  const captured: Captured = {
    messages: [],
    notifications: [],
    interviews: [],
    requests: new Map(),
    slots: new Map(),
  };

  const repo: AvailabilityRepo = {
    async getEmployerIdForUser(userId) {
      if (userId === EMPLOYER_USER) return EMPLOYER_ID;
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
    async replaceSlots(requestId, slots) {
      const stored = slots.map(s => ({ ...s, id: nextId('slot') }));
      captured.slots.set(requestId, stored);
      return stored;
    },
    async insertMessage(row) {
      const id = nextId('message');
      captured.messages.push({ id, ...row, application_id: undefined } as never);
      captured.messages[captured.messages.length - 1] = {
        id,
        sender_id: row.sender_id,
        receiver_id: row.receiver_id,
        body: row.body,
        availability_request_id: row.availability_request_id,
      };
      return { id };
    },
    async createNotification(row) {
      captured.notifications.push(row);
    },
    async createInterview(row) {
      const id = nextId('interview');
      captured.interviews.push({
        id,
        application_id: row.application_id,
        scheduled_at: row.scheduled_at,
        duration_minutes: row.duration_minutes,
      });
      return { id };
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

  return { repo, captured };
}

// Convenience: the employer's opening move, which every test starts from.
async function openRequest(repo: AvailabilityRepo, overrides: Partial<{ windowStart: string; windowEnd: string }> = {}) {
  return requestAvailability(repo, {
    userId: EMPLOYER_USER,
    applicationId: APPLICATION_ID,
    windowStart: overrides.windowStart ?? WINDOW_START,
    windowEnd: overrides.windowEnd ?? WINDOW_END,
    durationMinutes: 30,
    note: 'You’ll meet with the data team.',
    today: TODAY,
  });
}

// Two frames inside the window: Mon morning and Wed afternoon.
function goodSlots(): AvailabilitySlot[] {
  return [
    buildSlot('2026-09-07', 9 * 60, 12 * 60),
    buildSlot('2026-09-09', 13 * 60, 17 * 60),
  ];
}

describe('interview availability — full three-step flow', () => {
  let repo: AvailabilityRepo;
  let captured: Captured;

  beforeEach(() => {
    ({ repo, captured } = makeRepo());
  });

  it('runs employer request -> student availability -> employer selection end to end', async () => {
    // ---- Step 1: employer submits the date range ----
    const step1 = await openRequest(repo);
    expect(step1.status).toBe(200);

    const request = step1.body as AvailabilityRequest;
    expect(request.window_start).toBe(WINDOW_START);
    expect(request.window_end).toBe(WINDOW_END);
    // The ball is explicitly in the student's court, and persisted as such.
    expect(request.status).toBe('awaiting_student');

    // A message carrying the picker landed in the student's inbox...
    expect(captured.messages).toHaveLength(1);
    expect(captured.messages[0].receiver_id).toBe(STUDENT_USER);
    expect(captured.messages[0].availability_request_id).toBe(request.id);
    // ...and the message is linked back from the request.
    expect(request.message_id).toBe(captured.messages[0].id);

    // The student is notified, nobody else.
    expect(captured.notifications).toHaveLength(1);
    expect(captured.notifications[0]).toMatchObject({
      user_id: STUDENT_USER,
      title: 'Interview times requested',
      link: '/dashboard/student/inbox',
    });

    // ---- Step 2: student submits availability ----
    const step2 = await submitAvailability(repo, {
      userId: STUDENT_USER,
      requestId: request.id,
      slots: goodSlots(),
      note: 'Wednesdays are easier for me.',
      timezone: 'America/New_York',
    });
    expect(step2.status).toBe(200);

    const responded = step2.body as AvailabilityRequest;
    expect(responded.status).toBe('awaiting_employer');
    expect(responded.student_note).toBe('Wednesdays are easier for me.');
    expect(responded.student_timezone).toBe('America/New_York');
    expect(responded.responded_at).toBeTruthy();
    expect(await repo.getSlots(request.id)).toHaveLength(2);

    // Step 3's trigger: the employer is pulled back to the pipeline.
    expect(captured.notifications).toHaveLength(2);
    expect(captured.notifications[1]).toMatchObject({
      user_id: EMPLOYER_USER,
      title: 'Candidate shared their availability',
      link: '/dashboard/employer/pipeline',
    });

    // ---- Step 3: employer picks a final time ----
    const slots = await repo.getSlots(request.id);
    const chosen = enumerateStartTimes(slots[0], 30)[2]; // 10:00 inside the 9–12 frame
    expect(chosen).toBeTruthy();

    const step3 = await confirmInterviewTime(repo, {
      userId: EMPLOYER_USER,
      requestId: request.id,
      scheduledAt: chosen,
      durationMinutes: 30,
      notes: 'Bring a portfolio.',
    });
    expect(step3.status).toBe(200);

    const scheduled = step3.body as AvailabilityRequest;
    expect(scheduled.status).toBe('scheduled');
    expect(scheduled.scheduled_at_confirmed).toBe(chosen);

    // A real interview row now exists, which is what every other interview
    // surface in the app reads from.
    expect(captured.interviews).toHaveLength(1);
    expect(captured.interviews[0]).toMatchObject({
      application_id: APPLICATION_ID,
      scheduled_at: chosen,
      duration_minutes: 30,
    });
    expect(scheduled.interview_id).toBe(captured.interviews[0].id);

    // And the student is told it's booked.
    expect(captured.notifications).toHaveLength(3);
    expect(captured.notifications[2]).toMatchObject({
      user_id: STUDENT_USER,
      title: 'Interview scheduled',
    });
  });

  it('records every state transition in order', async () => {
    const { body: created } = await openRequest(repo);
    const id = (created as AvailabilityRequest).id;

    const seen: string[] = [(created as AvailabilityRequest).status];

    const afterStudent = await submitAvailability(repo, {
      userId: STUDENT_USER, requestId: id, slots: goodSlots(),
    });
    seen.push((afterStudent.body as AvailabilityRequest).status);

    const slots = await repo.getSlots(id);
    const afterEmployer = await confirmInterviewTime(repo, {
      userId: EMPLOYER_USER, requestId: id, scheduledAt: enumerateStartTimes(slots[0], 30)[0],
    });
    seen.push((afterEmployer.body as AvailabilityRequest).status);

    expect(seen).toEqual(['awaiting_student', 'awaiting_employer', 'scheduled']);
  });
});

describe('edge case — the student has no availability in the window', () => {
  let repo: AvailabilityRepo;
  let captured: Captured;

  beforeEach(() => {
    ({ repo, captured } = makeRepo());
  });

  it('rejects frames that all fall outside the requested window', async () => {
    const { body: created } = await openRequest(repo);
    const request = created as AvailabilityRequest;

    // Every frame is a week past the window's end.
    const outside = [
      buildSlot('2026-09-18', 9 * 60, 12 * 60),
      buildSlot('2026-09-19', 13 * 60, 17 * 60),
    ];

    const result = await submitAvailability(repo, {
      userId: STUDENT_USER, requestId: request.id, slots: outside,
    });

    expect(result.status).toBe(400);
    expect((result.body as { error: string }).error).toMatch(/inside the requested window/i);

    // Nothing moved: the request is still the student's to answer, and no
    // half-written slots were left behind.
    const after = await repo.getRequest(request.id);
    expect(after?.status).toBe('awaiting_student');
    expect(await repo.getSlots(request.id)).toHaveLength(0);
    // The employer was not falsely told the candidate had replied.
    expect(captured.notifications.filter(n => n.user_id === EMPLOYER_USER)).toHaveLength(0);
  });

  it('rejects a partially out-of-window submission rather than silently dropping frames', async () => {
    const { body: created } = await openRequest(repo);
    const request = created as AvailabilityRequest;

    const mixed = [
      buildSlot('2026-09-08', 9 * 60, 12 * 60),   // inside
      buildSlot('2026-09-25', 9 * 60, 12 * 60),   // outside
    ];

    const result = await submitAvailability(repo, {
      userId: STUDENT_USER, requestId: request.id, slots: mixed,
    });

    expect(result.status).toBe(400);
    expect((result.body as { error: string }).error).toMatch(/outside the requested window/i);
    expect(await repo.getSlots(request.id)).toHaveLength(0);
  });

  it('records "none of these days work" as a real outcome and notifies the employer', async () => {
    const { body: created } = await openRequest(repo);
    const request = created as AvailabilityRequest;

    const result = await submitAvailability(repo, {
      userId: STUDENT_USER,
      requestId: request.id,
      slots: [],
      noneWork: true,
      note: 'I’m abroad that whole week.',
    });

    expect(result.status).toBe(200);
    const after = result.body as AvailabilityRequest;
    expect(after.status).toBe('no_availability');
    expect(after.student_note).toBe('I’m abroad that whole week.');

    const employerNotifications = captured.notifications.filter(n => n.user_id === EMPLOYER_USER);
    expect(employerNotifications).toHaveLength(1);
    expect(employerNotifications[0].title).toBe('No availability in that window');
    expect(employerNotifications[0].link).toBe('/dashboard/employer/pipeline');

    // Nothing to schedule from, so confirming is refused.
    const confirm = await confirmInterviewTime(repo, {
      userId: EMPLOYER_USER, requestId: request.id, scheduledAt: '2026-09-08T14:00:00.000Z',
    });
    expect(confirm.status).toBe(409);
    expect(captured.interviews).toHaveLength(0);
  });

  it('an empty submission is refused when the student did not say "none work"', async () => {
    const { body: created } = await openRequest(repo);
    const request = created as AvailabilityRequest;

    const result = await submitAvailability(repo, {
      userId: STUDENT_USER, requestId: request.id, slots: [],
    });

    expect(result.status).toBe(400);
    expect((result.body as { error: string }).error).toMatch(/at least one time frame/i);
    expect((await repo.getRequest(request.id))?.status).toBe('awaiting_student');
  });
});

describe('edge case — the employer needs to re-request a different window', () => {
  let repo: AvailabilityRepo;
  let captured: Captured;

  beforeEach(() => {
    ({ repo, captured } = makeRepo());
  });

  it('blocks a second live request until the first is withdrawn', async () => {
    await openRequest(repo);

    const second = await openRequest(repo, { windowStart: '2026-09-14', windowEnd: '2026-09-18' });
    expect(second.status).toBe(409);
    expect((second.body as { error: string }).error).toMatch(/already has an open interview request/i);
  });

  it('lets the employer withdraw and ask for a new window when no offered slot works', async () => {
    const { body: created } = await openRequest(repo);
    const first = created as AvailabilityRequest;

    await submitAvailability(repo, {
      userId: STUDENT_USER, requestId: first.id, slots: goodSlots(),
    });
    expect((await repo.getRequest(first.id))?.status).toBe('awaiting_employer');

    // None of the offered times work for the panel — withdraw.
    const withdrawn = await cancelAvailabilityRequest(repo, {
      userId: EMPLOYER_USER, requestId: first.id,
    });
    expect(withdrawn.status).toBe(200);
    expect((withdrawn.body as AvailabilityRequest).status).toBe('cancelled');

    // The slot is free again, so a fresh window can be requested.
    const second = await requestAvailability(repo, {
      userId: EMPLOYER_USER,
      applicationId: APPLICATION_ID,
      windowStart: '2026-09-14',
      windowEnd: '2026-09-18',
      today: TODAY,
    });
    expect(second.status).toBe(200);
    const secondRequest = second.body as AvailabilityRequest;
    expect(secondRequest.status).toBe('awaiting_student');
    expect(secondRequest.id).not.toBe(first.id);
    expect(secondRequest.window_start).toBe('2026-09-14');

    // The cancelled row is kept as history rather than revived.
    expect((await repo.getRequest(first.id))?.status).toBe('cancelled');

    // The student got a second inbox message for the new window.
    expect(captured.messages).toHaveLength(2);
    expect(captured.messages[1].availability_request_id).toBe(secondRequest.id);
  });

  it('re-requests after the student reported no availability', async () => {
    const { body: created } = await openRequest(repo);
    const first = created as AvailabilityRequest;

    await submitAvailability(repo, {
      userId: STUDENT_USER, requestId: first.id, slots: [], noneWork: true,
    });

    // no_availability is terminal, so it never blocks the next request.
    const second = await requestAvailability(repo, {
      userId: EMPLOYER_USER,
      applicationId: APPLICATION_ID,
      windowStart: '2026-09-21',
      windowEnd: '2026-09-25',
      today: TODAY,
    });
    expect(second.status).toBe(200);
    expect((second.body as AvailabilityRequest).status).toBe('awaiting_student');
  });

  it('tells the student when a request they still owed an answer on is withdrawn', async () => {
    const { body: created } = await openRequest(repo);
    const request = created as AvailabilityRequest;

    await cancelAvailabilityRequest(repo, { userId: EMPLOYER_USER, requestId: request.id });

    const studentNotifications = captured.notifications.filter(n => n.user_id === STUDENT_USER);
    expect(studentNotifications.map(n => n.title)).toContain('Interview request withdrawn');
  });
});

describe('guards', () => {
  let repo: AvailabilityRepo;
  let captured: Captured;

  beforeEach(() => {
    ({ repo, captured } = makeRepo());
  });

  it('refuses a window that starts in the past', async () => {
    const result = await requestAvailability(repo, {
      userId: EMPLOYER_USER,
      applicationId: APPLICATION_ID,
      windowStart: '2026-08-20',
      windowEnd: '2026-08-25',
      today: TODAY,
    });
    expect(result.status).toBe(400);
    expect((result.body as { error: string }).error).toMatch(/cannot start in the past/i);
  });

  it('refuses an inverted date range', async () => {
    const result = await requestAvailability(repo, {
      userId: EMPLOYER_USER,
      applicationId: APPLICATION_ID,
      windowStart: '2026-09-11',
      windowEnd: '2026-09-07',
      today: TODAY,
    });
    expect(result.status).toBe(400);
    expect((result.body as { error: string }).error).toMatch(/end date must come after/i);
  });

  it("refuses an employer who does not own the candidate's application", async () => {
    const result = await requestAvailability(repo, {
      userId: OTHER_EMPLOYER_USER,
      applicationId: APPLICATION_ID,
      windowStart: WINDOW_START,
      windowEnd: WINDOW_END,
      today: TODAY,
    });
    expect(result.status).toBe(403);
  });

  it('refuses a student responding to somebody else’s request', async () => {
    const { body: created } = await openRequest(repo);
    const result = await submitAvailability(repo, {
      userId: OTHER_EMPLOYER_USER,
      requestId: (created as AvailabilityRequest).id,
      slots: goodSlots(),
    });
    expect(result.status).toBe(403);
  });

  it('refuses a second submission from the student', async () => {
    const { body: created } = await openRequest(repo);
    const id = (created as AvailabilityRequest).id;

    await submitAvailability(repo, { userId: STUDENT_USER, requestId: id, slots: goodSlots() });
    const again = await submitAvailability(repo, { userId: STUDENT_USER, requestId: id, slots: goodSlots() });

    expect(again.status).toBe(409);
    expect((again.body as { error: string }).error).toMatch(/no longer awaiting your availability/i);
  });

  it('refuses a final time that falls outside every offered frame', async () => {
    const { body: created } = await openRequest(repo);
    const id = (created as AvailabilityRequest).id;
    await submitAvailability(repo, { userId: STUDENT_USER, requestId: id, slots: goodSlots() });

    // 8pm on an offered day — the student never offered that evening.
    const outside = buildSlot('2026-09-07', 20 * 60, 21 * 60).starts_at;
    const result = await confirmInterviewTime(repo, {
      userId: EMPLOYER_USER, requestId: id, scheduledAt: outside, durationMinutes: 30,
    });

    expect(result.status).toBe(400);
    expect((result.body as { error: string }).error).toMatch(/fits inside one of the frames/i);
    expect(captured.interviews).toHaveLength(0);
    expect((await repo.getRequest(id))?.status).toBe('awaiting_employer');
  });

  it('refuses a final time that starts inside a frame but overruns its end', async () => {
    const { body: created } = await openRequest(repo);
    const id = (created as AvailabilityRequest).id;
    await submitAvailability(repo, { userId: STUDENT_USER, requestId: id, slots: goodSlots() });

    // 11:45 start on a frame ending at 12:00 — a 30 minute interview spills over.
    const lateStart = buildSlot('2026-09-07', 11 * 60 + 45, 12 * 60).starts_at;
    const result = await confirmInterviewTime(repo, {
      userId: EMPLOYER_USER, requestId: id, scheduledAt: lateStart, durationMinutes: 30,
    });

    expect(result.status).toBe(400);
    expect(captured.interviews).toHaveLength(0);
  });

  it('refuses confirming before the student has responded', async () => {
    const { body: created } = await openRequest(repo);
    const result = await confirmInterviewTime(repo, {
      userId: EMPLOYER_USER,
      requestId: (created as AvailabilityRequest).id,
      scheduledAt: '2026-09-08T14:00:00.000Z',
    });
    expect(result.status).toBe(409);
    expect((result.body as { error: string }).error).toMatch(/not ready to be scheduled/i);
  });

  it('refuses confirming twice', async () => {
    const { body: created } = await openRequest(repo);
    const id = (created as AvailabilityRequest).id;
    await submitAvailability(repo, { userId: STUDENT_USER, requestId: id, slots: goodSlots() });

    const slots = await repo.getSlots(id);
    const chosen = enumerateStartTimes(slots[0], 30)[0];
    await confirmInterviewTime(repo, { userId: EMPLOYER_USER, requestId: id, scheduledAt: chosen });

    const again = await confirmInterviewTime(repo, { userId: EMPLOYER_USER, requestId: id, scheduledAt: chosen });
    expect(again.status).toBe(409);
    expect(captured.interviews).toHaveLength(1);
  });

  it('refuses withdrawing an already-scheduled interview', async () => {
    const { body: created } = await openRequest(repo);
    const id = (created as AvailabilityRequest).id;
    await submitAvailability(repo, { userId: STUDENT_USER, requestId: id, slots: goodSlots() });
    const slots = await repo.getSlots(id);
    await confirmInterviewTime(repo, {
      userId: EMPLOYER_USER, requestId: id, scheduledAt: enumerateStartTimes(slots[0], 30)[0],
    });

    const result = await cancelAvailabilityRequest(repo, { userId: EMPLOYER_USER, requestId: id });
    expect(result.status).toBe(409);
  });

  it('leaves the request at "requested" when the student cannot be reached', async () => {
    // No student user id — the picker message can't be delivered, so claiming
    // we're awaiting their availability would be a lie.
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

    const stuck = [...captured.requests.values()][0];
    expect(stuck.status).toBe('requested');
  });

  it('404s on an unknown request', async () => {
    const result = await submitAvailability(repo, {
      userId: STUDENT_USER, requestId: 'nope', slots: goodSlots(),
    });
    expect(result.status).toBe(404);
  });
});
