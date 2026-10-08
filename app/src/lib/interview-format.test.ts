import { describe, it, expect } from 'vitest';
import {
  validateInterviewFormat,
  buildInterviewFormatMessage,
  interviewFormatOf,
} from './interview-format';

describe('validateInterviewFormat', () => {
  it('defaults to the InternFirst room', () => {
    expect(validateInterviewFormat({})).toEqual({ ok: true, format: 'internfirst', meetingUrl: null });
  });

  it('rejects unknown formats', () => {
    expect(validateInterviewFormat({ format: 'carrier_pigeon' }).ok).toBe(false);
  });

  it('requires a link for external_link and normalizes a bare domain to https', () => {
    expect(validateInterviewFormat({ format: 'external_link', meetingUrl: '' }).ok).toBe(false);
    expect(validateInterviewFormat({ format: 'external_link', meetingUrl: 'meet.google.com/abc-defg-hij' }))
      .toEqual({ ok: true, format: 'external_link', meetingUrl: 'https://meet.google.com/abc-defg-hij' });
  });

  it('refuses non-web links', () => {
    expect(validateInterviewFormat({ format: 'external_link', meetingUrl: 'javascript:alert(1)' }).ok).toBe(false);
    expect(validateInterviewFormat({ format: 'external_link', meetingUrl: 'ftp://files.example.com' }).ok).toBe(false);
    expect(validateInterviewFormat({ format: 'external_link', meetingUrl: 'not a url' }).ok).toBe(false);
  });

  it('drops a stray link for formats that do not use one', () => {
    expect(validateInterviewFormat({ format: 'phone', meetingUrl: 'https://zoom.us/j/1' }))
      .toEqual({ ok: true, format: 'phone', meetingUrl: null });
  });
});

describe('buildInterviewFormatMessage', () => {
  const base = {
    companyName: 'Northwind Labs',
    listingTitle: 'Data Analyst Intern',
    scheduledAt: '2026-10-14T18:00:00.000Z', // 2:00 PM in New York
    durationMinutes: 30,
    timeZone: 'America/New_York',
  };

  it('sends nothing for the InternFirst room', () => {
    expect(buildInterviewFormatMessage({ ...base, format: 'internfirst' })).toBeNull();
  });

  it('own link: date, time and link', () => {
    const msg = buildInterviewFormatMessage({ ...base, format: 'external_link', meetingUrl: 'https://zoom.us/j/1' })!;
    expect(msg).toContain('Date: Wednesday, October 14, 2026');
    expect(msg).toMatch(/Time: 2:00\sPM EDT \(30 min\)/);
    expect(msg).toContain('Link: https://zoom.us/j/1');
  });

  it('phone: asks for a number and gives the time', () => {
    const msg = buildInterviewFormatMessage({ ...base, format: 'phone', notes: 'Ask for Sam.' })!;
    expect(msg).toContain('Phone screening');
    expect(msg).toContain('Date: Wednesday, October 14, 2026');
    expect(msg).toMatch(/Time: 2:00\sPM EDT/);
    expect(msg).toContain('reply here with the best phone number');
    expect(msg).toContain('Notes: Ask for Sam.');
  });

  it('marks reschedules and survives a bogus time zone', () => {
    const msg = buildInterviewFormatMessage({ ...base, format: 'phone', timeZone: 'Mars/Olympus', rescheduled: true })!;
    expect(msg.startsWith('Updated: ')).toBe(true);
    expect(msg).toMatch(/Time: 6:00\sPM UTC/);
  });
});

describe('interviewFormatOf', () => {
  it('treats legacy rows as InternFirst video', () => {
    expect(interviewFormatOf({})).toBe('internfirst');
    expect(interviewFormatOf({ format: null })).toBe('internfirst');
    expect(interviewFormatOf({ format: 'phone' })).toBe('phone');
  });
});
