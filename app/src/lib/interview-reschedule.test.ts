import { describe, it, expect } from 'vitest';
import { resolveRescheduleTarget, isUniqueViolation } from './interview-reschedule';

// The duplicate-key bug: the client asked to reschedule a stale, closed row
// while the application already had a different live interview. Forcing the
// stale row back to 'pending' produced two live rows, which the unique index
// interview_schedules_one_active_per_application rejects.
describe('resolveRescheduleTarget', () => {
  it('moves the live interview when the client sent its id', () => {
    expect(resolveRescheduleTarget({ id: 'live' }, { id: 'live' })).toBe('live');
  });

  it('moves the live interview, not a stale closed row the client still showed', () => {
    expect(resolveRescheduleTarget({ id: 'old-cancelled' }, { id: 'live' })).toBe('live');
  });

  it('revives the requested row only when nothing else is live', () => {
    expect(resolveRescheduleTarget({ id: 'old-declined' }, null)).toBe('old-declined');
  });
});

describe('isUniqueViolation', () => {
  it('recognises the Postgres unique_violation code', () => {
    expect(isUniqueViolation({ code: '23505' })).toBe(true);
    expect(isUniqueViolation({ code: '42501' })).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
  });
});
