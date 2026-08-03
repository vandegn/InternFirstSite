import { describe, it, expect } from 'vitest';
import {
  canTransition,
  assertTransition,
  validateWindow,
  validateSlots,
  validateConfirmedTime,
  slotIsInsideWindow,
  enumerateDays,
  countDays,
  isDateOnly,
  localToday,
  buildSlot,
  enumerateStartTimes,
  groupSlotsByDay,
  isLiveAvailabilityStatus,
  MAX_WINDOW_DAYS,
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

describe('validateSlots', () => {
  it('accepts frames inside the window', () => {
    const slots = [buildSlot('2026-09-08', 9 * 60, 12 * 60)];
    expect(validateSlots(slots, WINDOW, 30)).toEqual({ ok: true });
  });

  it('accepts a frame on the first and last day of the window', () => {
    const slots = [
      buildSlot(WINDOW.window_start, 9 * 60, 12 * 60),
      buildSlot(WINDOW.window_end, 9 * 60, 12 * 60),
    ];
    expect(validateSlots(slots, WINDOW, 30).ok).toBe(true);
  });

  it('rejects an empty submission', () => {
    const result = validateSlots([], WINDOW, 30);
    expect(result.ok === false && result.error).toMatch(/at least one time frame/i);
  });

  it('rejects a submission with no overlap with the window at all', () => {
    const slots = [buildSlot('2026-10-01', 9 * 60, 12 * 60)];
    const result = validateSlots(slots, WINDOW, 30);
    expect(result.ok === false && result.error).toMatch(/none of your time frames/i);
  });

  it('rejects a partially out-of-window submission rather than dropping frames', () => {
    const slots = [
      buildSlot('2026-09-08', 9 * 60, 12 * 60),
      buildSlot('2026-10-01', 9 * 60, 12 * 60),
    ];
    const result = validateSlots(slots, WINDOW, 30);
    expect(result.ok === false && result.error).toMatch(/1 time frame falls outside/i);
  });

  it('rejects a frame shorter than the interview itself', () => {
    const slots = [buildSlot('2026-09-08', 9 * 60, 9 * 60 + 20)];
    const result = validateSlots(slots, WINDOW, 30);
    expect(result.ok === false && result.error).toMatch(/at least 30 minutes/i);
  });

  it('rejects a frame that ends before it starts', () => {
    const bad = { slot_date: '2026-09-08', starts_at: '2026-09-08T17:00:00.000Z', ends_at: '2026-09-08T09:00:00.000Z' };
    const result = validateSlots([bad], WINDOW, 30);
    expect(result.ok === false && result.error).toMatch(/end after it starts/i);
  });

  it('checks window membership by the day label, not the instant', () => {
    expect(slotIsInsideWindow(buildSlot('2026-09-07', 0, 60), WINDOW)).toBe(true);
    expect(slotIsInsideWindow(buildSlot('2026-09-06', 0, 60), WINDOW)).toBe(false);
    expect(slotIsInsideWindow(buildSlot('2026-09-12', 0, 60), WINDOW)).toBe(false);
  });
});

describe('validateConfirmedTime', () => {
  const slot = buildSlot('2026-09-08', 9 * 60, 12 * 60);

  it('accepts a time wholly inside an offered frame', () => {
    const at = buildSlot('2026-09-08', 10 * 60, 11 * 60).starts_at;
    expect(validateConfirmedTime(at, 30, [slot])).toEqual({ ok: true });
  });

  it('accepts a time flush against the start of a frame', () => {
    expect(validateConfirmedTime(slot.starts_at, 30, [slot]).ok).toBe(true);
  });

  it('accepts a time that ends exactly at the frame boundary', () => {
    const at = buildSlot('2026-09-08', 11 * 60 + 30, 12 * 60).starts_at;
    expect(validateConfirmedTime(at, 30, [slot]).ok).toBe(true);
  });

  it('rejects a time that starts inside but overruns the frame', () => {
    const at = buildSlot('2026-09-08', 11 * 60 + 45, 12 * 60).starts_at;
    expect(validateConfirmedTime(at, 30, [slot]).ok).toBe(false);
  });

  it('rejects a time outside every frame', () => {
    const at = buildSlot('2026-09-08', 20 * 60, 21 * 60).starts_at;
    const result = validateConfirmedTime(at, 30, [slot]);
    expect(result.ok === false && result.error).toMatch(/fits inside one of the frames/i);
  });

  it('rejects anything when no frames were offered', () => {
    expect(validateConfirmedTime(slot.starts_at, 30, []).ok).toBe(false);
  });

  it('rejects a malformed time or duration', () => {
    expect(validateConfirmedTime('nonsense', 30, [slot]).ok).toBe(false);
    expect(validateConfirmedTime(slot.starts_at, 0, [slot]).ok).toBe(false);
  });
});

describe('enumerateStartTimes', () => {
  const slot = buildSlot('2026-09-08', 9 * 60, 10 * 60); // one hour

  it('only offers starts that leave room for the full interview', () => {
    const starts = enumerateStartTimes(slot, 30, 15);
    // 9:00, 9:15, 9:30 — 9:45 would run past 10:00.
    expect(starts).toHaveLength(3);
    expect(starts[0]).toBe(slot.starts_at);
    for (const iso of starts) {
      expect(validateConfirmedTime(iso, 30, [slot]).ok).toBe(true);
    }
  });

  it('offers exactly one start when the frame is the interview length', () => {
    expect(enumerateStartTimes(buildSlot('2026-09-08', 9 * 60, 9 * 60 + 30), 30, 15)).toHaveLength(1);
  });

  it('offers nothing when the frame is too short', () => {
    expect(enumerateStartTimes(buildSlot('2026-09-08', 9 * 60, 9 * 60 + 20), 30, 15)).toEqual([]);
  });

  it('every generated start passes the confirmation rule for a longer interview too', () => {
    const wide = buildSlot('2026-09-08', 9 * 60, 17 * 60);
    for (const iso of enumerateStartTimes(wide, 60, 15)) {
      expect(validateConfirmedTime(iso, 60, [wide]).ok).toBe(true);
    }
  });
});

describe('groupSlotsByDay', () => {
  it('groups by day and orders both days and frames', () => {
    const grouped = groupSlotsByDay([
      buildSlot('2026-09-09', 13 * 60, 17 * 60),
      buildSlot('2026-09-07', 13 * 60, 17 * 60),
      buildSlot('2026-09-07', 9 * 60, 12 * 60),
    ]);

    expect(grouped.map(g => g.day)).toEqual(['2026-09-07', '2026-09-09']);
    expect(grouped[0].slots).toHaveLength(2);
    // Morning before afternoon.
    expect(Date.parse(grouped[0].slots[0].starts_at))
      .toBeLessThan(Date.parse(grouped[0].slots[1].starts_at));
  });

  it('handles an empty offer', () => {
    expect(groupSlotsByDay([])).toEqual([]);
  });
});
