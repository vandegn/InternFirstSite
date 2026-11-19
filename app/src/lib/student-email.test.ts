import { describe, expect, it } from 'vitest';
import { isEduEmail } from './supabase';

describe('isEduEmail', () => {
  it('accepts .edu addresses', () => {
    expect(isEduEmail('chud@htn.edu')).toBe(true);
  });

  it('accepts approved non-.edu exceptions, ignoring case and whitespace', () => {
    expect(isEduEmail('r0994833@student.kuleuven.be')).toBe(true);
    expect(isEduEmail('  Thibaut@InsightConsulting.be ')).toBe(true);
  });

  it('rejects other non-.edu addresses', () => {
    expect(isEduEmail('someone@student.kuleuven.be')).toBe(false);
    expect(isEduEmail('thibaut@gmail.com')).toBe(false);
  });
});
