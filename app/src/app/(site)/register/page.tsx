'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import RoleSelector from '@/components/RoleSelector';
import PasswordInput from '@/components/PasswordInput';
import PasswordStrengthMeter from '@/components/PasswordStrengthMeter';
import { supabase, isEduEmail, EMPLOYER_EMAIL_ERROR } from '@/lib/supabase';
import { isFreeEmailProvider, normalizeDomain } from '@/lib/domain-signals';
import { validatePassword } from '@/lib/password';
import { MAJORS } from '@/lib/constants';
import SchoolPicker, { EMPTY_SCHOOL, type SchoolValue } from '@/components/SchoolPicker';
import PolicyAgreementModal from '@/components/PolicyAgreementModal';
import { getPolicyVersions } from '@/lib/policies';

type Role = 'student' | 'employer';

export default function RegisterPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role>('student');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  // Student fields
  const [major, setMajor] = useState('');
  const [majorSearch, setMajorSearch] = useState('');
  const [majorDropdownOpen, setMajorDropdownOpen] = useState(false);
  const majorRef = useRef<HTMLDivElement>(null);
  const [graduationYear, setGraduationYear] = useState('');
  const [school, setSchool] = useState<SchoolValue>(EMPTY_SCHOOL);
  // Employer fields
  const [companyName, setCompanyName] = useState('');
  const [website, setWebsite] = useState('');
  const [companyDescription, setCompanyDescription] = useState('');
  const [terms, setTerms] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // The two roles have distinct Terms & Privacy documents, so any prior
  // acceptance is void once the role changes — force a fresh acknowledgement.
  useEffect(() => { setTerms(false); }, [role]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (majorRef.current && !majorRef.current.contains(e.target as Node)) {
        setMajorDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredMajors = MAJORS.filter((m) =>
    m.toLowerCase().includes(majorSearch.toLowerCase())
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match!');
      return;
    }

    if (role === 'employer' && !companyName) {
      setError('Company name is required.');
      return;
    }

    // Employers verify against a company domain, so a personal or disposable
    // mailbox leaves nothing to check. Mirrored server-side in
    // createProfileAndRoleData — this is only the fast feedback path.
    if (role === 'employer' && isFreeEmailProvider(email)) {
      setError(EMPLOYER_EMAIL_ERROR);
      return;
    }

    if (role === 'employer' && !normalizeDomain(website)) {
      setError('Please enter your company website, e.g. example.com.');
      return;
    }

    if (role === 'student' && !isEduEmail(email)) {
      setError('Student accounts require a .edu email address.');
      return;
    }

    // The picker only ever commits a row from the approved list, so a missing
    // id means nothing was actually selected.
    if (role === 'student' && !school.id) {
      setError('Please select your school from the list.');
      return;
    }

    // The checkbox is disabled until acceptance, so native `required` can't
    // enforce this — guard explicitly.
    if (!terms) {
      setError('Please review and accept the Terms & Conditions and Privacy Policy.');
      return;
    }

    setLoading(true);

    try {
      // Build user_metadata with role-specific fields
      const metadata: Record<string, string> = { role, fullName, phone };

      // Which document versions were on screen when the user clicked I Agree.
      // /auth/callback turns this into a durable policy_acceptances row once
      // the email is verified.
      const policyVersions = getPolicyVersions(role);
      metadata.termsVersion = policyVersions.terms;
      metadata.privacyVersion = policyVersions.privacy;
      metadata.policyAcceptedAt = new Date().toISOString();

      if (role === 'student') {
        metadata.major = major;
        metadata.graduationYear = graduationYear;
        metadata.schoolId = String(school.id);
        metadata.schoolName = school.name;
        metadata.schoolState = school.state ?? '';
      } else if (role === 'employer') {
        metadata.companyName = companyName;
        metadata.website = website;
        metadata.companyDescription = companyDescription;
      }

      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: metadata,
        },
      });

      if (authError) throw authError;

      // Supabase does not error on duplicate emails (to prevent email
      // enumeration). Instead it returns a user with an empty identities
      // array — that's how we detect an email that's already registered.
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        setError('An account with this email already exists. Try logging in instead.');
        setLoading(false);
        return;
      }

      // Redirect to verify-email page
      router.push(`/verify-email?email=${encodeURIComponent(email)}`);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-container" style={{ maxWidth: 680 }}>
        <button
          type="button"
          onClick={() => { if (typeof window !== 'undefined' && window.history.length > 1) router.back(); else router.push('/'); }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
            color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500, marginBottom: '4px',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          Back
        </button>
        <div className="auth-logo">
          <Link href="/">
            <img src="https://internfirst-demo.com/wp-content/uploads/2026/02/Top-Rated-2.png" alt="InternFirst" />
          </Link>
        </div>
        <h1>Register</h1>
        <p className="auth-subtitle">Create your account. Select your role to get started.</p>

        <RoleSelector selected={role} onChange={setRole} />

        {error && <div className="auth-error" style={{ display: 'block' }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="fullName">Full Name</label>
              <input type="text" id="fullName" placeholder="John Doe" required value={fullName} onChange={e => setFullName(e.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="phone">Phone Number</label>
              <input type="tel" id="phone" placeholder="+1 (555) 000-0000" value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="email">{role === 'employer' ? 'Work Email Address' : 'Email Address'}</label>
              <input
                type="email"
                id="email"
                placeholder={role === 'employer' ? 'you@company.com' : 'john@university.edu'}
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <PasswordInput id="password" placeholder="Create a password" required value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" />
              <PasswordStrengthMeter password={password} />
            </div>
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <PasswordInput id="confirmPassword" placeholder="Confirm your password" required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} autoComplete="new-password" />
              {confirmPassword && confirmPassword !== password && (
                <p style={{ marginTop: '6px', fontSize: '0.72rem', color: 'var(--danger-accent)' }}>
                  Passwords do not match.
                </p>
              )}
            </div>

            {/* Student fields */}
            {role === 'student' && (
              <>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label htmlFor="school">School</label>
                  <SchoolPicker
                    value={school}
                    onChange={setSchool}
                    placeholder="Search your college or university..."
                    hint="Pick from the list — typed text that isn't selected won't be saved."
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="major">Major</label>
                  <div ref={majorRef} style={{ position: 'relative' }}>
                    <input
                      type="text"
                      id="major"
                      placeholder="Search for your major..."
                      value={majorDropdownOpen ? majorSearch : major || majorSearch}
                      onChange={(e) => {
                        setMajorSearch(e.target.value);
                        setMajorDropdownOpen(true);
                        if (!e.target.value) setMajor('');
                      }}
                      onFocus={() => setMajorDropdownOpen(true)}
                      autoComplete="off"
                    />
                    {majorDropdownOpen && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        maxHeight: '200px',
                        overflowY: 'auto',
                        background: 'var(--bg)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        boxShadow: 'var(--shadow-md)',
                        zIndex: 50,
                      }}>
                        {filteredMajors.length === 0 ? (
                          <div style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                            No majors found
                          </div>
                        ) : (
                          filteredMajors.map((m) => (
                            <div
                              key={m}
                              onClick={() => {
                                setMajor(m);
                                setMajorSearch(m);
                                setMajorDropdownOpen(false);
                              }}
                              style={{
                                padding: '10px 14px',
                                cursor: 'pointer',
                                fontSize: '0.9rem',
                                background: major === m ? 'var(--primary-light)' : 'transparent',
                                color: major === m ? 'var(--primary)' : 'var(--text)',
                              }}
                              onMouseEnter={(e) => { if (major !== m) (e.target as HTMLElement).style.background = 'var(--bg-light)'; }}
                              onMouseLeave={(e) => { (e.target as HTMLElement).style.background = major === m ? 'var(--primary-light)' : 'transparent'; }}
                            >
                              {m}
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="graduationYear">Graduation Year</label>
                  <select id="graduationYear" value={graduationYear} onChange={e => setGraduationYear(e.target.value)}>
                    <option value="" disabled>Select year</option>
                    <option value="2026">2026</option>
                    <option value="2027">2027</option>
                    <option value="2028">2028</option>
                    <option value="2029">2029</option>
                    <option value="2030">2030</option>
                  </select>
                </div>
              </>
            )}

            {/* Employer fields */}
            {role === 'employer' && (
              <>
                <div className="form-group">
                  <label htmlFor="companyName">Company Name</label>
                  <input type="text" id="companyName" placeholder="Acme Inc." required value={companyName} onChange={e => setCompanyName(e.target.value)} />
                </div>
                <div className="form-group">
                  <label htmlFor="website">Company Website</label>
                  <input type="text" id="website" placeholder="example.com" required value={website} onChange={e => setWebsite(e.target.value)} />
                  <p style={{ marginTop: '6px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    Used to verify your company. Accounts are reviewed before listings go live.
                  </p>
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label htmlFor="companyDescription">Company Description</label>
                  <textarea id="companyDescription" placeholder="Tell students about your company..." rows={3} value={companyDescription} onChange={e => setCompanyDescription(e.target.value)} style={{ width: '100%', resize: 'vertical' }} />
                </div>
              </>
            )}

          </div>

          <div className="checkbox-group">
            {/* Checking the box requires reading the policy first — an unchecked
                click opens the modal instead of toggling; only the modal's
                "I Agree" sets `terms`. Unchecking is always allowed. */}
            <input
              type="checkbox"
              id="terms"
              checked={terms}
              onChange={e => { if (e.target.checked) setPolicyOpen(true); else setTerms(false); }}
            />
            <label htmlFor="terms">
              I agree to the{' '}
              <button
                type="button"
                onClick={() => setPolicyOpen(true)}
                style={{ background: 'none', border: 'none', padding: 0, color: 'var(--primary)', font: 'inherit', textDecoration: 'underline', cursor: 'pointer' }}
              >
                Terms &amp; Conditions and Privacy Policy
              </button>
            </label>
          </div>

          {policyOpen && (
            <PolicyAgreementModal
              role={role}
              onAgree={() => setTerms(true)}
              onClose={() => setPolicyOpen(false)}
            />
          )}

          <button
            type="submit"
            className="btn-auth"
            disabled={loading || !terms}
            style={{ opacity: loading || !terms ? 0.5 : 1, cursor: loading || !terms ? 'not-allowed' : 'pointer' }}
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="auth-footer">Already have an account? <Link href="/login">Sign in</Link></p>
      </div>
    </div>
  );
}
