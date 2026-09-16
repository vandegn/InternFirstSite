import { describe, it, expect } from 'vitest';
import { parseEvent, conversionRate } from './product-analytics';
const base = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', sessionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', path: '/register' };
describe('analytics input boundary', () => {
  it('accepts explicit CTA labels and discards arbitrary user data', () => {
    const result = parseEvent({ ...base, name: 'cta_clicked', cta: 'register', email: 'private@example.com' });
    expect(result?.cta).toBe('register'); expect(result).not.toHaveProperty('email');
  });
  it('rejects client-forged completion events', () => {
    for (const name of ['registration_completed', 'application_completed', 'job_published']) expect(parseEvent({ ...base, name })).toBeNull();
  });
  it('requires valid role and correlation ID for registration', () => {
    expect(parseEvent({ ...base, name: 'registration_started', role: 'student', flowId: base.id })).not.toBeNull();
    expect(parseEvent({ ...base, name: 'registration_started', role: 'intern_first_admin', flowId: base.id })).toBeNull();
    expect(parseEvent({ ...base, name: 'registration_started', role: 'student' })).toBeNull();
  });
  it('rejects query strings, arbitrary CTA labels and invalid listing identifiers', () => {
    expect(parseEvent({ ...base, path: '/register?email=private@example.com', name: 'cta_clicked', cta: 'register' })).toBeNull();
    expect(parseEvent({ ...base, name: 'cta_clicked', cta: 'user-entered text' })).toBeNull();
    expect(parseEvent({ ...base, name: 'application_started', listingId: 'invalid' })).toBeNull();
  });
  it('distinguishes no starts from zero conversion', () => {
    expect(conversionRate(0, 0)).toBe('—'); expect(conversionRate(4, 0)).toBe('0.0%'); expect(conversionRate(4, 1)).toBe('25.0%');
  });
});
