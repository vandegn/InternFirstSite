import { describe, it, expect } from 'vitest';
import { interviewHasEnded, joinAction, joinWindowStatus, splitInterviewsByTime } from './interview-join';

const T0 = Date.parse('2026-10-23T15:00:00Z');
const min = (n: number) => n * 60_000;
const at = (offsetMinutes: number) => new Date(T0 + min(offsetMinutes)).toISOString();

describe('joinWindowStatus', () => {
  it('opens 10 minutes before the start and closes 30 minutes after the end', () => {
    expect(joinWindowStatus(at(0), 30, T0 - min(11))).toBe('too_early');
    expect(joinWindowStatus(at(0), 30, T0 - min(10))).toBe('open');
    expect(joinWindowStatus(at(0), 30, T0 + min(60))).toBe('open');
    expect(joinWindowStatus(at(0), 30, T0 + min(61))).toBe('ended');
  });
});

describe('interviewHasEnded', () => {
  it('is over at the scheduled end, with no grace', () => {
    expect(interviewHasEnded(at(0), 30, T0 + min(29))).toBe(false);
    expect(interviewHasEnded(at(0), 30, T0 + min(30))).toBe(true);
  });
});

describe('splitInterviewsByTime', () => {
  it('keeps a running meeting upcoming, orders upcoming soonest first and past most recent first', () => {
    const list = [
      { id: 'later', scheduledAt: at(120), durationMinutes: 30 },
      { id: 'yesterday', scheduledAt: at(-24 * 60), durationMinutes: 30 },
      { id: 'running', scheduledAt: at(-5), durationMinutes: 30 },
      { id: 'soon', scheduledAt: at(30), durationMinutes: 30 },
      { id: 'last-week', scheduledAt: at(-7 * 24 * 60), durationMinutes: 30 },
    ];
    const { upcoming, past } = splitInterviewsByTime(list, T0);
    expect(upcoming.map(i => i.id)).toEqual(['running', 'soon', 'later']);
    expect(past.map(i => i.id)).toEqual(['yesterday', 'last-week']);
  });
});

describe('joinAction', () => {
  const base = { id: 'iv1', scheduledAt: at(0), durationMinutes: 30 };

  it('links the InternFirst room before the window, with a hint, and says "now" once open', () => {
    const early = joinAction({ ...base, format: 'internfirst' }, 'student', T0 - min(60));
    expect(early).toMatchObject({ href: '/dashboard/student/interviews/iv1', external: false, label: 'Join interview', status: 'too_early' });
    expect(early?.hint).toMatch(/^Room opens at /);

    const open = joinAction({ ...base, format: 'internfirst', meetingType: 'screening' }, 'employer', T0);
    expect(open).toMatchObject({ href: '/dashboard/employer/interviews/iv1', label: 'Join screening now', status: 'open', hint: null });
  });

  it('opens the employer’s own link in a new tab', () => {
    expect(joinAction({ ...base, format: 'external_link', meetingUrl: 'https://meet.example.com/x' }, 'student', T0))
      .toMatchObject({ href: 'https://meet.example.com/x', external: true, label: 'Join interview' });
  });

  it('has nothing to click for a phone screen', () => {
    expect(joinAction({ ...base, format: 'phone', meetingType: 'screening' }, 'student', T0)).toBeNull();
  });
});
