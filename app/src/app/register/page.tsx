'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import RoleSelector from '@/components/RoleSelector';
import { supabase, createProfileAndRoleData, isEduEmail, DASHBOARD_ROUTES, uploadImage, getAllUniversities, type RoleData } from '@/lib/supabase';

type Role = 'student' | 'employer' | 'university_admin';

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
  const [graduationYear, setGraduationYear] = useState('');
  // Image upload
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Employer fields
  const [companyName, setCompanyName] = useState('');
  const [website, setWebsite] = useState('');
  const [companyDescription, setCompanyDescription] = useState('');
  // University fields
  const [universityId, setUniversityId] = useState('');
  const [universities, setUniversities] = useState<{ id: string; name: string }[]>([]);
  const [jobTitle, setJobTitle] = useState('');

  const [terms, setTerms] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (role === 'university_admin') {
      getAllUniversities().then(setUniversities);
    }
  }, [role]);

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError('Image must be under 2MB.');
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match!');
      return;
    }

    if (role === 'employer' && !companyName) {
      setError('Company name is required.');
      return;
    }

    if (role === 'university_admin' && !universityId) {
      setError('Please select your university.');
      return;
    }

    if ((role === 'student' || role === 'university_admin') && !isEduEmail(email)) {
      setError('Student and university accounts require a .edu email address.');
      return;
    }

    setLoading(true);

    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, role },
        },
      });

      if (authError) throw authError;

      const userId = data.user!.id;

      // Auto-login immediately so the session is active for uploads and DB writes
      await supabase.auth.signInWithPassword({ email, password });

      // Upload image if provided (needs active session for storage RLS)
      let imageUrl: string | undefined;
      if (imageFile) {
        const ext = imageFile.name.split('.').pop();
        const folder = role === 'student' ? 'avatars' : 'logos';
        const path = `${folder}/${userId}.${ext}`;
        imageUrl = await uploadImage('images', path, imageFile);
      }

      const roleData: RoleData = {};
      if (role === 'student') {
        roleData.major = major;
        roleData.graduationYear = graduationYear;
      } else if (role === 'employer') {
        roleData.companyName = companyName;
        roleData.website = website;
        roleData.companyDescription = companyDescription;
        roleData.logoUrl = imageUrl;
      } else if (role === 'university_admin') {
        roleData.universityId = universityId;
        roleData.jobTitle = jobTitle;
      }

      await createProfileAndRoleData(userId, {
        role,
        fullName,
        email,
        phone,
        avatarUrl: imageUrl,
        roleData,
      });

      router.push(DASHBOARD_ROUTES[role] || '/dashboard/student');
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-container" style={{ maxWidth: 680 }}>
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
              <label htmlFor="email">Email Address</label>
              <input type="email" id="email" placeholder="john@university.edu" required value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input type="password" id="password" placeholder="Create a password" required value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input type="password" id="confirmPassword" placeholder="Confirm your password" required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
            </div>

            {/* Student fields */}
            {role === 'student' && (
              <>
                <div className="form-group">
                  <label htmlFor="major">Major</label>
                  <input type="text" id="major" placeholder="e.g. Computer Science" value={major} onChange={e => setMajor(e.target.value)} />
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
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>Profile Picture (optional)</label>
                  <div className="image-upload-area" onClick={() => fileInputRef.current?.click()}>
                    {imagePreview ? (
                      <img src={imagePreview} alt="Preview" className="image-upload-preview" style={{ borderRadius: '50%' }} />
                    ) : (
                      <div className="image-upload-placeholder">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        <span>Click to upload photo</span>
                      </div>
                    )}
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} />
                  </div>
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
                  <input type="text" id="website" placeholder="example.com" value={website} onChange={e => setWebsite(e.target.value)} />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label htmlFor="companyDescription">Company Description</label>
                  <textarea id="companyDescription" placeholder="Tell students about your company..." rows={3} value={companyDescription} onChange={e => setCompanyDescription(e.target.value)} style={{ width: '100%', resize: 'vertical' }} />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>Company Logo (optional)</label>
                  <div className="image-upload-area" onClick={() => fileInputRef.current?.click()}>
                    {imagePreview ? (
                      <img src={imagePreview} alt="Preview" className="image-upload-preview" />
                    ) : (
                      <div className="image-upload-placeholder">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                        <span>Click to upload logo</span>
                      </div>
                    )}
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} />
                  </div>
                </div>
              </>
            )}

            {/* University fields */}
            {role === 'university_admin' && (
              <>
                <div className="form-group">
                  <label htmlFor="universityId">University</label>
                  <select id="universityId" value={universityId} onChange={e => setUniversityId(e.target.value)} required>
                    <option value="" disabled>Select your university</option>
                    {universities.map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                  {universities.length === 0 && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
                      No universities available. Contact support to add yours.
                    </p>
                  )}
                </div>
                <div className="form-group">
                  <label htmlFor="jobTitle">Your Title</label>
                  <input type="text" id="jobTitle" placeholder="e.g. Career Services Director" value={jobTitle} onChange={e => setJobTitle(e.target.value)} />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>University Logo (optional)</label>
                  <div className="image-upload-area" onClick={() => fileInputRef.current?.click()}>
                    {imagePreview ? (
                      <img src={imagePreview} alt="Preview" className="image-upload-preview" />
                    ) : (
                      <div className="image-upload-placeholder">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"/></svg>
                        <span>Click to upload logo</span>
                      </div>
                    )}
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} />
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="checkbox-group">
            <input type="checkbox" id="terms" required checked={terms} onChange={e => setTerms(e.target.checked)} />
            <label htmlFor="terms">I agree to the <a href="#">Terms</a> and <a href="#">Privacy Policy</a></label>
          </div>

          <button type="submit" className="btn-auth" disabled={loading}>
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="auth-footer">Already have an account? <Link href="/login">Sign in</Link></p>
      </div>
    </div>
  );
}
