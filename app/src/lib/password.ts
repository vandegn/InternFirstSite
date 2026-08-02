// Password strength rules, shared by every place a password is set:
// registration, the settings password-change forms, and the reset-password
// page. One source of truth so the rules can't drift between them.
//
// The four hard requirements are what gate submission. The 0-4 strength score
// on top is advisory — it also penalises the passwords that technically pass
// (Password1!) but are the first thing an attacker tries.

export const MIN_PASSWORD_LENGTH = 10;

export type PasswordRequirement = {
  id: string;
  label: string;
  test: (pw: string) => boolean;
};

export const PASSWORD_REQUIREMENTS: PasswordRequirement[] = [
  {
    id: 'length',
    label: `At least ${MIN_PASSWORD_LENGTH} characters`,
    test: (pw) => pw.length >= MIN_PASSWORD_LENGTH,
  },
  {
    id: 'case',
    label: 'Upper and lowercase letters',
    test: (pw) => /[a-z]/.test(pw) && /[A-Z]/.test(pw),
  },
  {
    id: 'number',
    label: 'At least one number',
    test: (pw) => /\d/.test(pw),
  },
  {
    id: 'symbol',
    label: 'At least one symbol',
    test: (pw) => /[^A-Za-z0-9]/.test(pw),
  },
];

// Substrings common enough that containing one undoes most of the entropy the
// character-class rules pretend to measure.
const COMMON_PATTERNS = [
  'password', 'passw0rd', 'qwerty', 'asdf', 'letmein', 'welcome',
  'admin', 'iloveyou', 'monkey', 'dragon', 'football', 'baseball',
  'internfirst', 'intern', '123456', 'abc123', '111111',
];

export type PasswordStrength = {
  /** 0-4. 0-1 weak, 2 fair, 3 good, 4 strong. */
  score: number;
  label: 'Weak' | 'Fair' | 'Good' | 'Strong';
  /** Which of PASSWORD_REQUIREMENTS the password currently satisfies. */
  met: Record<string, boolean>;
  /** True when every hard requirement passes — this is what gates submit. */
  valid: boolean;
  /** Single most useful nudge, or null when there's nothing to say. */
  hint: string | null;
};

export function scorePassword(pw: string): PasswordStrength {
  const met: Record<string, boolean> = {};
  for (const req of PASSWORD_REQUIREMENTS) met[req.id] = req.test(pw);
  const valid = PASSWORD_REQUIREMENTS.every((r) => met[r.id]);

  if (!pw) {
    return { score: 0, label: 'Weak', met, valid: false, hint: null };
  }

  const lower = pw.toLowerCase();
  const commonHit = COMMON_PATTERNS.find((p) => lower.includes(p));
  // Three or more of the same character in a row, or a run like "abcd"/"1234".
  const repeated = /(.)\1{2,}/.test(pw);
  const sequential = /(?:abcdef|bcdefg|cdefgh|0123|1234|2345|3456|4567|5678|6789)/.test(lower);

  let score = PASSWORD_REQUIREMENTS.filter((r) => met[r.id]).length;
  if (pw.length >= 16) score += 1;
  if (commonHit) score -= 2;
  if (repeated || sequential) score -= 1;
  score = Math.max(0, Math.min(4, score));

  // A password that fails a hard requirement never reads better than "Fair",
  // so the meter can't say "Good" next to a disabled submit button.
  if (!valid) score = Math.min(score, 2);

  const label = score >= 4 ? 'Strong' : score === 3 ? 'Good' : score === 2 ? 'Fair' : 'Weak';

  let hint: string | null = null;
  if (commonHit) hint = `Avoid common words like "${commonHit}".`;
  else if (repeated) hint = 'Avoid repeating the same character.';
  else if (sequential) hint = 'Avoid sequences like "1234" or "abcd".';
  else if (valid && pw.length < 16) hint = 'Longer passwords are stronger — try a passphrase.';

  return { score, label, met, valid, hint };
}

/** Error message for the submit-time guard, or null when the password passes. */
export function validatePassword(pw: string): string | null {
  const failed = PASSWORD_REQUIREMENTS.filter((r) => !r.test(pw));
  if (failed.length === 0) return null;
  return `Password must meet all requirements: ${failed.map((f) => f.label.toLowerCase()).join(', ')}.`;
}
