import { describe, it, expect } from 'vitest';
import {
  canTransition,
  assertTransition,
  validateWindow,
  validateProposedSlots,
  validateSlotChoice,
  slotIsInsideWindow,
  enumerateDays,
  countDays,
  isDateOnly,
  localToday,
  buildSlot,
  slotsForRange,
  groupSlotsByDay,
  isLiveAvailabilityStatus,
  meetingTypeForStage,
  employerSchedulingView,
  primarySchedulingAction,
  formatMeetingWhen,
  formatSlotRange,
  formatSelectedLabel,
  formatMinuteOfDay,
  timeZoneAbbr,
  MAX_WINDOW_DAYS,
  MAX_PROPOSED_SLOTS,
  type AvailabilityRequest,
  type AvailabilityStatus,
} from './interview-availability';

const WINDOW = { window_start: '2026-09-07', window_end: '2026-09-11' };

describe('state machine', () => {
  it('walks the happy path and nothing else', () => {
    expect(canTransition('requested', 'awaiting_student')).toBe(true);
    expect(canTransition('awaiting_student', 'awaiting_employer')).toBe(true);
    expect(canTransition('awaiting_employer', 'scheduled')).toBe(true);

    // No skipping steps.
    expect(canTransition('requested', 'scheduled')).toBe(false);
    expect(canTransition('awaiting_student', 'scheduled')).toBe(false);
  });

  it('never moves backwards', () => {
    expect(canTransition('awaiting_employer', 'awaiting_student')).toBe(false);
    expect(canTransition('scheduled', 'awaiting_employer')).toBe(false);
  });

  it('treats scheduled, no_availability and cancelled as terminal', () => {
    const terminal: AvailabilityStatus[] = ['scheduled', 'no_availability', 'cancelled'];
    const all: AvailabilityStatus[] = [
      'requested', 'awaiting_student', 'awaiting_employer',
      'scheduled', 'no_availability', 'cancelled',
    ];
    for (const from of terminal) {
      for (const to of all) {
        expect(canTransition(from, to)).toBe(false);
      }
    }
  });

  it('lets the student decline the whole window only while it is their turn', () => {
    expect(canTransition('awaiting_student', 'no_availability')).toBe(true);
    expect(canTransition('awaiting_employer', 'no_availability')).toBe(false);
  });

  it('allows the employer to withdraw at any open step', () => {
    expect(canTransition('requested', 'cancelled')).toBe(true);
    expect(canTransition('awaiting_student', 'cancelled')).toBe(true);
    expect(canTransition('awaiting_employer', 'cancelled')).toBe(true);
  });

  it('throws a readable message on an illegal move', () => {
    expect(() => assertTransition('scheduled', 'awaiting_student'))
      .toThrow(/from "scheduled" to "awaiting_student"/);
  });

  it('knows which statuses still occupy the one-live-request slot', () => {
    expect(isLiveAvailabilityStatus('awaiting_student')).toBe(true);
    expect(isLiveAvailabilityStatus('awaiting_employer')).toBe(true);
    expect(isLiveAvailabilityStatus('cancelled')).toBe(false);
    expect(isLiveAvailabilityStatus('no_availability')).toBe(false);
    expect(isLiveAvailabilityStatus('scheduled')).toBe(false);
  });
});

describe('calendar helpers', () => {
  it('accepts only real calendar dates', () => {
    expect(isDateOnly('2026-09-07')).toBe(true);
    expect(isDateOnly('2026-02-30')).toBe(false); // rolls over
    expect(isDateOnly('2026-9-7')).toBe(false);
    expect(isDateOnly('not-a-date')).toBe(false);
  });

  it('enumerates an inclusive range', () => {
    expect(enumerateDays('2026-09-07', '2026-09-09')).toEqual([
      '2026-09-07', '2026-09-08', '2026-09-09',
    ]);
    expect(countDays('2026-09-07', '2026-09-07')).toBe(1);
  });

  it('crosses a month boundary without skipping a day', () => {
    expect(enumerateDays('2026-08-30', '2026-09-02')).toEqual([
      '2026-08-30', '2026-08-31', '2026-09-01', '2026-09-02',
    ]);
  });

  it('crosses a US daylight-saving boundary without duplicating or dropping a day', () => {
    // DST ends 2026-11-01 in the US; stepping in UTC keeps this honest.
    expect(enumerateDays('2026-10-31', '2026-11-02')).toEqual([
      '2026-10-31', '2026-11-01', '2026-11-02',
    ]);
  });

  it('returns nothing for an inverted range', () => {
    expect(enumerateDays('2026-09-09', '2026-09-07')).toEqual([]);
  });

  it('reads today in local time, not UTC', () => {
    // 11pm on the 7th locally is already the 8th in UTC for US zones — the
    // window rules must use the employer's day.
    const lateEvening = new Date(2026, 8, 7, 23, 30);
    expect(localToday(lateEvening)).toBe('2026-09-07');
  });
});

describe('validateWindow', () => {
  const today = '2026-09-01';

  it('accepts a normal forward-looking range', () => {
    expect(validateWindow('2026-09-07', '2026-09-11', today)).toEqual({ ok: true });
  });

  it('accepts a single-day window', () => {
    expect(validateWindow('2026-09-07', '2026-09-07', today).ok).toBe(true);
  });

  it('accepts a window starting today', () => {
    expect(validateWindow(today, '2026-09-05', today).ok).toBe(true);
  });

  it('rejects a start in the past', () => {
    const result = validateWindow('2026-08-25', '2026-09-05', today);
    expect(result).toMatchObject({ ok: false });
    expect(result.ok === false && result.error).toMatch(/past/i);
  });

  it('rejects an inverted range', () => {
    const result = validateWindow('2026-09-11', '2026-09-07', today);
    expect(result.ok === false && result.error).toMatch(/end date must come after/i);
  });

  it('rejects a window longer than the cap', () => {
    const result = validateWindow('2026-09-07', '2026-11-07', today);
    expect(result.ok === false && result.error).toMatch(new RegExp(`${MAX_WINDOW_DAYS} days`));
  });

  it('accepts a window exactly at the cap', () => {
    const days = enumerateDays('2026-09-07', '2026-12-31').slice(0, MAX_WINDOW_DAYS);
    expect(validateWindow(days[0], days[days.length - 1], today).ok).toBe(true);
  });

  it('rejects malformed dates', () => {
    expect(validateWindow('', '2026-09-11', today).ok).toBe(false);
    expect(validateWindow('2026-13-01', '2026-09-11', today).ok).toBe(false);
  });
});

// "Now" for the slot rules: well before the window.
const NOW = new Date('2026-09-01T12:00:00Z');

describe('slotsForRange — employer availability cut into meeting slots', () => {
  it('cuts 1:00–3:00 PM into four 30-minute slots (the spec example)', () => {
    const slots = slotsForRange({ date: '2026-09-07', startMinute: 13 * 60, endMinute: 15 * 60 }, 30);
    expect(slots.map(s => [new Date(s.starts_at).getHours(), new Date(s.starts_at).getMinutes()])).toEqual([
      [13, 0], [13, 30], [14, 0], [14, 30],
    ]);
    // Each slot is exactly one meeting long and the last ends at 3:00.
    for (const s of slots) expect(Date.parse(s.ends_at) - Date.parse(s.starts_at)).toBe(30 * 60_000);
    expect(new Date(slots[3].ends_at).getHours()).toBe(15);
  });

  it('reflects the chosen duration', () => {
    const range = { date: '2026-09-07', startMinute: 13 * 60, endMinute: 15 * 60 };
    expect(slotsForRange(range, 15)).toHaveLength(8);
    expect(slotsForRange(range, 45)).toHaveLength(2); // 1:00, 1:45 — 2:30 would overrun
    expect(slotsForRange(range, 60)).toHaveLength(2);
  });

  it('never offers a slot that overruns the range', () => {
    const slots = slotsForRange({ date: '2026-09-07', startMinute: 9 * 60, endMinute: 9 * 60 + 50 }, 30);
    expect(slots).toHaveLength(1);
    expect(new Date(slots[0].ends_at).getMinutes()).toBe(30);
  });

  it('returns nothing for an empty, inverted or too-short range', () => {
    expect(slotsForRange({ date: '2026-09-07', startMinute: 600, endMinute: 600 }, 30)).toEqual([]);
    expect(slotsForRange({ date: '2026-09-07', startMinute: 700, endMinute: 600 }, 30)).toEqual([]);
    expect(slotsForRange({ date: '2026-09-07', startMinute: 600, endMinute: 615 }, 30)).toEqual([]);
    expect(slotsForRange({ date: 'nope', startMinute: 600, endMinute: 700 }, 30)).toEqual([]);
  });

  it('labels the editor times in 12-hour form', () => {
    expect(formatMinuteOfDay(13 * 60)).toBe('1:00 PM');
    expect(formatMinuteOfDay(9 * 60 + 15)).toBe('9:15 AM');
    expect(formatMinuteOfDay(0)).toBe('12:00 AM');
    expect(formatMinuteOfDay(12 * 60)).toBe('12:00 PM');
  });
});

describe('validateProposedSlots', () => {
  const thirty = () => slotsForRange({ date: '2026-09-07', startMinute: 13 * 60, endMinute: 15 * 60 }, 30);

  it('accepts meeting-length slots inside the window', () => {
    expect(validateProposedSlots(thirty(), WINDOW, 30, NOW)).toEqual({ ok: true });
  });

  it('accepts slots on the first and last day of the window', () => {
    const slots = [buildSlot('2026-09-07', 600, 630), buildSlot('2026-09-11', 600, 630)];
    expect(validateProposedSlots(slots, WINDOW, 30, NOW).ok).toBe(true);
  });

  it('rejects an empty proposal', () => {
    const result = validateProposedSlots([], WINDOW, 30, NOW);
    expect(result.ok === false && result.error).toMatch(/at least one time slot/i);
  });

  it('rejects a slot outside the window', () => {
    const slots = [...thirty(), buildSlot('2026-09-20', 600, 630)];
    const result = validateProposedSlots(slots, WINDOW, 30, NOW);
    expect(result.ok === false && result.error).toMatch(/outside the date window/i);
  });

  it('rejects a slot that is not exactly the meeting length', () => {
    const result = validateProposedSlots([buildSlot('2026-09-07', 600, 660)], WINDOW, 30, NOW);
    expect(result.ok === false && result.error).toMatch(/exactly 30 minutes/i);
  });

  it('rejects overlapping slots', () => {
    const result = validateProposedSlots(
      [buildSlot('2026-09-07', 600, 630), buildSlot('2026-09-07', 615, 645)],
      WINDOW, 30, NOW,
    );
    expect(result.ok === false && result.error).toMatch(/overlap/i);
  });

  it('rejects a slot that has already started', () => {
    const past = buildSlot('2026-09-07', 600, 630);
    const result = validateProposedSlots([past], WINDOW, 30, new Date(Date.parse(past.starts_at) + 1));
    expect(result.ok === false && result.error).toMatch(/already passed/i);
  });

  it('caps the number of slots', () => {
    const many = Array.from({ length: MAX_PROPOSED_SLOTS + 1 }, (_, i) =>
      buildSlot('2026-09-08', i * 15, i * 15 + 15));
    const result = validateProposedSlots(many, WINDOW, 15, NOW);
    expect(result.ok === false && result.error).toMatch(new RegExp(`${MAX_PROPOSED_SLOTS}`));
  });

  it('checks window membership by the day label, not the instant', () => {
    // 11pm local on the window's last day can be the next day in UTC.
    const late = buildSlot('2026-09-11', 23 * 60, 23 * 60 + 30);
    expect(slotIsInsideWindow(late, WINDOW)).toBe(true);
  });
});

describe('validateSlotChoice', () => {
  const slots = [
    { id: 's1', ...buildSlot('2026-09-07', 600, 630) },
    { id: 's2', ...buildSlot('2026-09-08', 600, 630) },
  ];

  it('accepts one of the offered slots', () => {
    expect(validateSlotChoice('s2', slots, NOW)).toEqual({ ok: true });
  });

  it('rejects a missing or unknown slot', () => {
    expect(validateSlotChoice(null, slots, NOW).ok).toBe(false);
    const result = validateSlotChoice('nope', slots, NOW);
    expect(result.ok === false && result.error).toMatch(/not one of the offered/i);
  });

  it('rejects a slot that has passed', () => {
    const result = validateSlotChoice('s1', slots, new Date(Date.parse(slots[0].starts_at) + 60_000));
    expect(result.ok === false && result.error).toMatch(/already passed/i);
  });
});

describe('time zone formatting', () => {
  const iso = '2026-10-14T18:00:00.000Z'; // 2:00 PM EDT, 11:00 AM PDT

  it('always carries the zone', () => {
    expect(formatMeetingWhen(iso, 'America/New_York')).toBe('Wed, Oct 14 at 2:00 PM EDT');
    expect(formatMeetingWhen(iso, 'America/Los_Angeles')).toBe('Wed, Oct 14 at 11:00 AM PDT');
    expect(timeZoneAbbr(iso, 'America/New_York')).toBe('EDT');
  });

  it('formats a slot range and the selected banner', () => {
    expect(formatSlotRange({ starts_at: iso, ends_at: '2026-10-14T18:30:00.000Z' }, 'America/New_York'))
      .toBe('2:00 PM – 2:30 PM EDT');
    expect(formatSelectedLabel(iso, 'America/New_York')).toBe('Selected Wed, Oct 14 at 2:00 PM EDT');
  });

  it('falls back to the viewer zone on a bad zone name', () => {
    expect(() => formatMeetingWhen(iso, 'Not/AZone')).not.toThrow();
  });
});

describe('groupSlotsByDay', () => {
  it('groups by day and orders both days and slots', () => {
    const slots = [
      buildSlot('2026-09-09', 13 * 60, 13 * 60 + 30),
      buildSlot('2026-09-07', 14 * 60, 14 * 60 + 30),
      buildSlot('2026-09-07', 9 * 60, 9 * 60 + 30),
    ];
    const grouped = groupSlotsByDay(slots);
    expect(grouped.map(g => g.day)).toEqual(['2026-09-07', '2026-09-09']);
    expect(grouped[0].slots.map(s => new Date(s.starts_at).getHours())).toEqual([9, 14]);
  });

  it('handles an empty offer', () => {
    expect(groupSlotsByDay([])).toEqual([]);
  });
});

// ============================================
// Scheduling visibility rules (spec §2 and §3)
// ============================================

function request(overrides: Partial<AvailabilityRequest> = {}): AvailabilityRequest {
  return {
    id: 'r1', application_id: 'a1', employer_id: 'e1', student_id: 's1', listing_id: 'l1',
    window_start: '2026-09-07', window_end: '2026-09-11',
    status: 'awaiting_student', duration_minutes: 30,
    employer_note: null, student_note: null, student_timezone: null,
    message_id: 'm1', interview_id: null, requested_at: '2026-09-01T00:00:00Z',
    responded_at: null, scheduled_at_confirmed: null,
    meeting_type: 'interview', selected_slot_id: null,
    slots: [{ id: 'slot-1', ...buildSlot('2026-09-07', 600, 630) }],
    ...overrides,
  };
}

const INTERVIEW_STAGE = { stage_type: 'interviewing', label: 'Interview 1' };
const SCREENING_STAGE = { stage_type: 'screening', label: 'Phone Screening' };

describe('meetingTypeForStage', () => {
  it('maps screening and interview categories', () => {
    expect(meetingTypeForStage(SCREENING_STAGE)).toBe('screening');
    expect(meetingTypeForStage(INTERVIEW_STAGE)).toBe('interview');
  });

  it('recognises a pre-migration "Phone Screening" column stored as reviewing', () => {
    expect(meetingTypeForStage({ stage_type: 'reviewing', label: 'Phone Screening' })).toBe('screening');
    expect(meetingTypeForStage({ stage_type: 'reviewing', label: 'Under Review' })).toBeNull();
  });

  it('has no category for every other stage', () => {
    for (const t of ['applied', 'reviewing', 'offered', 'rejected']) {
      expect(meetingTypeForStage({ stage_type: t, label: t })).toBeNull();
    }
    expect(meetingTypeForStage(null)).toBeNull();
  });
});

describe('employerSchedulingView', () => {
  it('hides scheduling outside Screening and Interview', () => {
    for (const t of ['applied', 'reviewing', 'offered', 'rejected']) {
      const view = employerSchedulingView({ stage: { stage_type: t, label: t }, request: null, interview: null });
      expect(view.kind).toBe('hidden');
      expect(primarySchedulingAction(view)).toBeNull();
    }
  });

  it('before requesting: the one action is Request Time', () => {
    const view = employerSchedulingView({ stage: SCREENING_STAGE, request: null, interview: null });
    expect(view).toMatchObject({ kind: 'request', meetingType: 'screening' });
    expect(primarySchedulingAction(view)).toBe('Request Time');
  });

  it('after sending: Awaiting Student Selection, and no Request Time', () => {
    const view = employerSchedulingView({ stage: INTERVIEW_STAGE, request: request(), interview: null });
    expect(view.kind).toBe('awaiting_student');
    expect(primarySchedulingAction(view)).toBeNull();
  });

  it('after the student selects: Confirm Screening / Confirm Interview replaces Request Time', () => {
    const picked = request({ status: 'awaiting_employer', selected_slot_id: 'slot-1' });
    const asInterview = employerSchedulingView({ stage: INTERVIEW_STAGE, request: picked, interview: null });
    expect(asInterview.kind).toBe('selected');
    expect(primarySchedulingAction(asInterview)).toBe('Confirm Interview');

    const asScreening = employerSchedulingView({ stage: SCREENING_STAGE, request: picked, interview: null });
    expect(primarySchedulingAction(asScreening)).toBe('Confirm Screening');
  });

  it('after confirmation: the meeting is confirmed, with no primary action', () => {
    const view = employerSchedulingView({
      stage: INTERVIEW_STAGE,
      request: request({ status: 'scheduled' }),
      interview: { id: 'i1', status: 'accepted', scheduled_at: '2026-09-07T14:00:00Z', duration_minutes: 30, meeting_type: 'interview' },
    });
    expect(view.kind).toBe('confirmed');
    expect(primarySchedulingAction(view)).toBeNull();
  });

  it('a reschedule in progress shows the negotiation, not the old booking', () => {
    const view = employerSchedulingView({
      stage: INTERVIEW_STAGE,
      request: request({ status: 'awaiting_employer', selected_slot_id: 'slot-1' }),
      interview: { id: 'i1', status: 'accepted', scheduled_at: '2026-09-07T14:00:00Z', duration_minutes: 30 },
    });
    expect(view.kind).toBe('selected');
  });

  it('never offers Request Time and a confirm action at once, in any state', () => {
    const states = [
      employerSchedulingView({ stage: INTERVIEW_STAGE, request: null, interview: null }),
      employerSchedulingView({ stage: INTERVIEW_STAGE, request: request(), interview: null }),
      employerSchedulingView({ stage: INTERVIEW_STAGE, request: request({ status: 'awaiting_employer', selected_slot_id: 'slot-1' }), interview: null }),
    ];
    for (const view of states) {
      const action = primarySchedulingAction(view);
      expect(action === null || typeof action === 'string').toBe(true);
    }
    expect(states.map(primarySchedulingAction)).toEqual(['Request Time', null, 'Confirm Interview']);
  });

  it('offers Request Time again after "none work" or a withdrawal', () => {
    const view = employerSchedulingView({
      stage: INTERVIEW_STAGE, request: request({ status: 'no_availability' }), interview: null,
    });
    expect(view).toMatchObject({ kind: 'request', lastOutcome: 'no_availability' });
  });

  it('keeps showing a pick but withholds Confirm once the card left the category', () => {
    const view = employerSchedulingView({
      stage: { stage_type: 'reviewing', label: 'Under Review' },
      request: request({ status: 'awaiting_employer', selected_slot_id: 'slot-1' }),
      interview: null,
    });
    expect(view).toMatchObject({ kind: 'selected', canAct: false });
    expect(primarySchedulingAction(view)).toBeNull();
  });
});
