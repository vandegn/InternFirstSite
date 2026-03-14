import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : (null as unknown as ReturnType<typeof createClient>);

export const DASHBOARD_ROUTES: Record<string, string> = {
  student: '/dashboard/student',
  employer: '/dashboard/employer',
  university_admin: '/dashboard/university',
};

export async function getProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error) return null;
  return data;
}

export type RoleData = {
  major?: string;
  graduationYear?: string;
  companyName?: string;
  website?: string;
  universityName?: string;
  jobTitle?: string;
  universityId?: string;
};

export async function createProfileAndRoleData(
  userId: string,
  opts: {
    role: string;
    fullName: string;
    email: string;
    phone?: string;
    roleData: RoleData;
  }
) {
  const { role, fullName, email, phone, roleData } = opts;

  if ((role === 'student' || role === 'university_admin') && !isEduEmail(email)) {
    throw new Error('Student and university accounts require a .edu email address.');
  }

  const { error: profileError } = await supabase.from('profiles').insert({
    user_id: userId,
    role,
    full_name: fullName,
    email,
    phone: phone || null,
  });
  if (profileError) throw profileError;

  if (role === 'student') {
    const { error } = await supabase.from('students').insert({
      user_id: userId,
      major: roleData.major || null,
      graduation_year: roleData.graduationYear
        ? parseInt(roleData.graduationYear)
        : null,
    });
    if (error) throw error;
  } else if (role === 'employer') {
    const { error } = await supabase.from('employers').insert({
      user_id: userId,
      company_name: roleData.companyName!,
      website: roleData.website || null,
    });
    if (error) throw error;
  } else if (role === 'university_admin') {
    const { error } = await supabase.from('university_admins').insert({
      user_id: userId,
      university_id: roleData.universityId || null,
      job_title: roleData.jobTitle || null,
    });
    if (error) throw error;
  }
}

export function isEduEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith('.edu');
}

export async function getPartnerUniversity(email: string) {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return null;

  const { data, error } = await supabase
    .from('universities')
    .select('id, name, logo_url')
    .eq('domain', domain)
    .eq('partner', true)
    .single();

  if (error || !data) return null;
  return data;
}

export async function getEmployerByUserId(userId: string) {
  const { data, error } = await supabase
    .from('employers')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error || !data) return null;
  return data;
}

export async function createListing(listing: {
  employer_id: string;
  title: string;
  description: string;
  location?: string;
  is_remote?: boolean;
  compensation?: string;
  requirements?: string;
  external_apply_url?: string;
}) {
  const { data, error } = await supabase
    .from('internship_listings')
    .insert(listing)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getEmployerListings(employerId: string) {
  const { data, error } = await supabase
    .from('internship_listings')
    .select('*')
    .eq('employer_id', employerId)
    .order('created_at', { ascending: false });
  if (error) return [];
  return data;
}

export async function getActiveListings() {
  const { data, error } = await supabase
    .from('internship_listings')
    .select('*, employers(company_name, logo_url)')
    .eq('status', 'active')
    .order('created_at', { ascending: false });
  if (error) return [];
  return data;
}

export async function getListingById(id: string) {
  const { data, error } = await supabase
    .from('internship_listings')
    .select('*, employers(company_name, logo_url, website)')
    .eq('id', id)
    .single();
  if (error || !data) return null;
  return data;
}

export async function getStudentByUserId(userId: string) {
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error || !data) return null;
  return data;
}

export async function applyToListing(studentId: string, listingId: string) {
  const { data, error } = await supabase
    .from('applications')
    .insert({ student_id: studentId, listing_id: listingId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getApplicationStatus(studentId: string, listingId: string) {
  const { data, error } = await supabase
    .from('applications')
    .select('status')
    .eq('student_id', studentId)
    .eq('listing_id', listingId)
    .single();
  if (error || !data) return null;
  return data.status as string;
}
