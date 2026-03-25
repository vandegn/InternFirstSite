import { type SupabaseClient } from '@supabase/supabase-js';
import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = supabaseUrl && supabaseAnonKey
  ? createBrowserClient(supabaseUrl, supabaseAnonKey)
  : (null as unknown as SupabaseClient);

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
  companyDescription?: string;
  logoUrl?: string;
  universityName?: string;
  jobTitle?: string;
  universityId?: string;
};

export async function createProfileAndRoleData(
  client: SupabaseClient,
  userId: string,
  opts: {
    role: string;
    fullName: string;
    email: string;
    phone?: string;
    avatarUrl?: string;
    roleData: RoleData;
  }
) {
  const { role, fullName, email, phone, avatarUrl, roleData } = opts;

  if ((role === 'student' || role === 'university_admin') && !isEduEmail(email)) {
    throw new Error('Student and university accounts require a .edu email address.');
  }

  const { error: profileError } = await client.from('profiles').insert({
    user_id: userId,
    role,
    full_name: fullName,
    email,
    phone: phone || null,
    avatar_url: avatarUrl || null,
  });
  if (profileError) throw profileError;

  if (role === 'student') {
    const { error } = await client.from('students').insert({
      user_id: userId,
      major: roleData.major || null,
      graduation_year: roleData.graduationYear
        ? parseInt(roleData.graduationYear)
        : null,
    });
    if (error) throw error;
  } else if (role === 'employer') {
    const { error } = await client.from('employers').insert({
      user_id: userId,
      company_name: roleData.companyName!,
      website: roleData.website || null,
      description: roleData.companyDescription || null,
      logo_url: roleData.logoUrl || null,
    });
    if (error) throw error;
  } else if (role === 'university_admin') {
    const { error } = await client.from('university_admins').insert({
      user_id: userId,
      university_id: roleData.universityId || null,
      job_title: roleData.jobTitle || null,
    });
    if (error) throw error;
  }
}

export async function getAllUniversities() {
  const { data, error } = await supabase
    .from('universities')
    .select('id, name')
    .order('name', { ascending: true });
  if (error) return [];
  return data;
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

export async function uploadImage(bucket: string, path: string, file: File) {
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: true });
  if (error) throw error;

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export async function updateEmployer(employerId: string, fields: {
  company_name?: string;
  website?: string;
  logo_url?: string;
  description?: string;
}) {
  const { data, error } = await supabase
    .from('employers')
    .update(fields)
    .eq('id', employerId)
    .select()
    .single();
  if (error) throw error;
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
  industry: string;
  application_deadline?: string;
}) {
  const { data, error } = await supabase
    .from('internship_listings')
    .insert(listing)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getEmployerListings(employerId: string, page = 1, pageSize = 10) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, error, count } = await supabase
    .from('internship_listings')
    .select('*', { count: 'exact' })
    .eq('employer_id', employerId)
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error) return { data: [], totalCount: 0 };
  return { data: data ?? [], totalCount: count ?? 0 };
}

export async function getActiveListings(page = 1, pageSize = 10, industry?: string) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  let query = supabase
    .from('internship_listings')
    .select('*, employers(company_name, logo_url)', { count: 'exact' })
    .eq('status', 'active');

  if (industry) {
    query = query.eq('industry', industry);
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error) return { data: [], totalCount: 0 };
  return { data: data ?? [], totalCount: count ?? 0 };
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

export async function getRecommendedListings(industries: string[], limit = 3) {
  if (industries.length === 0) return [];
  const { data, error } = await supabase
    .from('internship_listings')
    .select('*, employers(company_name, logo_url)')
    .eq('status', 'active')
    .in('industry', industries)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return [];
  return data ?? [];
}

// ---- Messages ----

export async function getConversations(userId: string) {
  // Get all messages where user is sender or receiver, grouped by the other party
  const { data, error } = await supabase
    .from('messages')
    .select('*, sender:profiles!messages_sender_id_fkey(full_name, avatar_url, role), receiver:profiles!messages_receiver_id_fkey(full_name, avatar_url, role)')
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .order('sent_at', { ascending: false });
  if (error || !data) return [];
  // Group by the other user
  const convMap = new Map<string, { otherUserId: string; otherName: string; otherAvatar: string | null; otherRole: string; lastMessage: string; lastSentAt: string; unreadCount: number }>();
  for (const msg of data) {
    const otherUserId = msg.sender_id === userId ? msg.receiver_id : msg.sender_id;
    const other = msg.sender_id === userId ? msg.receiver : msg.sender;
    if (!convMap.has(otherUserId)) {
      convMap.set(otherUserId, {
        otherUserId,
        otherName: other?.full_name || 'Unknown',
        otherAvatar: other?.avatar_url || null,
        otherRole: other?.role || '',
        lastMessage: msg.body,
        lastSentAt: msg.sent_at,
        unreadCount: 0,
      });
    }
    if (msg.receiver_id === userId && !msg.read) {
      const conv = convMap.get(otherUserId)!;
      conv.unreadCount++;
    }
  }
  return Array.from(convMap.values());
}

export async function getMessagesWith(userId: string, otherUserId: string) {
  const { data, error } = await supabase
    .from('messages')
    .select('*, sender:profiles!messages_sender_id_fkey(full_name, avatar_url)')
    .or(`and(sender_id.eq.${userId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${userId})`)
    .order('sent_at', { ascending: true });
  if (error) return [];
  return data ?? [];
}

export async function sendMessage(senderId: string, receiverId: string, body: string) {
  const { data, error } = await supabase
    .from('messages')
    .insert({ sender_id: senderId, receiver_id: receiverId, body })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function markMessagesAsRead(userId: string, otherUserId: string) {
  await supabase
    .from('messages')
    .update({ read: true })
    .eq('receiver_id', userId)
    .eq('sender_id', otherUserId)
    .eq('read', false);
}

export async function getUnreadCount(userId: string) {
  const { count, error } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('receiver_id', userId)
    .eq('read', false);
  if (error) return 0;
  return count ?? 0;
}

export async function getEmployerUserIdByListingId(listingId: string) {
  const { data, error } = await supabase
    .from('internship_listings')
    .select('employers(user_id)')
    .eq('id', listingId)
    .single();
  if (error || !data) return null;
  return (data as any).employers?.user_id as string | null;
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

export async function getEmployerApplications(employerId: string) {
  const { data, error } = await supabase
    .from('applications')
    .select(`
      id,
      status,
      applied_at,
      updated_at,
      resume_id,
      resume:student_resumes(id, name, file_url),
      listing:internship_listings!inner(id, title, employer_id),
      student:students!inner(
        id,
        major,
        graduation_year,
        bio,
        user_id,
        profile:profiles!students_user_id_fkey(full_name, email, avatar_url)
      )
    `)
    .eq('listing.employer_id', employerId)
    .order('applied_at', { ascending: false });
  if (error) {
    console.error('[getEmployerApplications] Error:', error.message, error);
    return [];
  }
  return data ?? [];
}

export async function updateApplicationStatus(applicationId: string, status: string) {
  const { data, error } = await supabase
    .from('applications')
    .update({ status })
    .eq('id', applicationId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getEmployerStats(employerId: string) {
  // Get all listing IDs for this employer
  const { data: listings } = await supabase
    .from('internship_listings')
    .select('id')
    .eq('employer_id', employerId);
  if (!listings || listings.length === 0) return { totalApplicants: 0, interviewing: 0, offered: 0 };

  const listingIds = listings.map(l => l.id);
  const { data: apps } = await supabase
    .from('applications')
    .select('status')
    .in('listing_id', listingIds);
  if (!apps) return { totalApplicants: 0, interviewing: 0, offered: 0 };

  return {
    totalApplicants: apps.length,
    interviewing: apps.filter(a => a.status === 'interviewing').length,
    offered: apps.filter(a => a.status === 'offered').length,
  };
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

// ---- Student Resumes ----

export async function uploadResume(studentId: string, file: File, displayName: string) {
  const ext = file.name.split('.').pop();
  const path = `resumes/${studentId}/${Date.now()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from('images')
    .upload(path, file, { upsert: false });
  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage.from('images').getPublicUrl(path);

  const { data, error } = await supabase
    .from('student_resumes')
    .insert({ student_id: studentId, name: displayName, file_url: urlData.publicUrl })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getStudentResumes(studentId: string) {
  const { data, error } = await supabase
    .from('student_resumes')
    .select('*')
    .eq('student_id', studentId)
    .order('uploaded_at', { ascending: false });
  if (error) return [];
  return data ?? [];
}

export async function deleteResume(resumeId: string) {
  const { error } = await supabase
    .from('student_resumes')
    .delete()
    .eq('id', resumeId);
  if (error) throw error;
}

// ---- Student Applications ----

export async function getStudentApplications(studentId: string) {
  const { data, error } = await supabase
    .from('applications')
    .select(`
      id,
      status,
      applied_at,
      updated_at,
      resume_id,
      listing:internship_listings!inner(
        id, title, location, is_remote, compensation, industry,
        employers:employers!inner(company_name, logo_url)
      )
    `)
    .eq('student_id', studentId)
    .order('applied_at', { ascending: false });
  if (error) return [];
  return data ?? [];
}

export async function getStudentStats(studentId: string) {
  const { data, error } = await supabase
    .from('applications')
    .select('status')
    .eq('student_id', studentId);
  if (error || !data) return { total: 0, offers: 0 };
  return {
    total: data.length,
    offers: data.filter(a => a.status === 'offered').length,
  };
}

// ---- Update student profile ----

export async function updateStudent(studentId: string, fields: {
  major?: string;
  graduation_year?: number;
  bio?: string;
}) {
  const { data, error } = await supabase
    .from('students')
    .update(fields)
    .eq('id', studentId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateProfile(userId: string, fields: {
  full_name?: string;
  phone?: string;
  avatar_url?: string;
}) {
  const { data, error } = await supabase
    .from('profiles')
    .update(fields)
    .eq('user_id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ---- Apply with resume ----

// ---- Listing Analytics ----

export async function getListingViewCounts(employerId: string) {
  const { data: listings } = await supabase
    .from('internship_listings')
    .select('id')
    .eq('employer_id', employerId);
  if (!listings || listings.length === 0) return {};

  const listingIds = listings.map(l => l.id);
  const { data: views } = await supabase
    .from('listing_views')
    .select('listing_id')
    .in('listing_id', listingIds);
  if (!views) return {};

  const counts: Record<string, number> = {};
  for (const v of views) {
    counts[v.listing_id] = (counts[v.listing_id] || 0) + 1;
  }
  return counts;
}

export async function trackListingView(listingId: string, viewerId: string | null) {
  await supabase.from('listing_views').insert({
    listing_id: listingId,
    viewer_id: viewerId,
  });
}

// ---- Employer Listings with full details ----

export async function getEmployerListingsWithStats(employerId: string) {
  const { data: listings, error } = await supabase
    .from('internship_listings')
    .select('*')
    .eq('employer_id', employerId)
    .order('created_at', { ascending: false });
  if (error || !listings) return [];

  const listingIds = listings.map(l => l.id);
  if (listingIds.length === 0) return listings.map(l => ({ ...l, applicant_count: 0, view_count: 0 }));

  const [{ data: apps }, { data: views }] = await Promise.all([
    supabase.from('applications').select('listing_id').in('listing_id', listingIds),
    supabase.from('listing_views').select('listing_id').in('listing_id', listingIds),
  ]);

  const appCounts: Record<string, number> = {};
  for (const a of apps || []) {
    appCounts[a.listing_id] = (appCounts[a.listing_id] || 0) + 1;
  }
  const viewCounts: Record<string, number> = {};
  for (const v of views || []) {
    viewCounts[v.listing_id] = (viewCounts[v.listing_id] || 0) + 1;
  }

  return listings.map(l => ({
    ...l,
    applicant_count: appCounts[l.id] || 0,
    view_count: viewCounts[l.id] || 0,
  }));
}

export async function applyToListingWithResume(studentId: string, listingId: string, resumeId: string | null) {
  const row: any = { student_id: studentId, listing_id: listingId };
  if (resumeId) row.resume_id = resumeId;
  const { data, error } = await supabase
    .from('applications')
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ---- University Dashboard Stats ----

export async function getUniversityStats(universityId: string) {
  // Count students enrolled at this university
  const { count: studentCount } = await supabase
    .from('students')
    .select('*', { count: 'exact', head: true })
    .eq('university_id', universityId);

  // Get all student IDs at this university
  const { data: students } = await supabase
    .from('students')
    .select('id')
    .eq('university_id', universityId);
  const studentIds = students?.map(s => s.id) ?? [];

  if (studentIds.length === 0) {
    return { studentsEnrolled: studentCount ?? 0, totalApplications: 0, offers: 0, interviewing: 0 };
  }

  // Get all applications from these students
  const { data: apps } = await supabase
    .from('applications')
    .select('status')
    .in('student_id', studentIds);

  const totalApplications = apps?.length ?? 0;
  const offers = apps?.filter(a => a.status === 'offered').length ?? 0;
  const interviewing = apps?.filter(a => a.status === 'interviewing').length ?? 0;

  return { studentsEnrolled: studentCount ?? 0, totalApplications, offers, interviewing };
}

export async function getTopEmployersForUniversity(universityId: string, limit = 3) {
  // Get student IDs for this university
  const { data: students } = await supabase
    .from('students')
    .select('id')
    .eq('university_id', universityId);
  const studentIds = students?.map(s => s.id) ?? [];
  if (studentIds.length === 0) return [];

  // Get applications with listing/employer info
  const { data: apps } = await supabase
    .from('applications')
    .select('listing:internship_listings!inner(employers:employers!inner(company_name))')
    .in('student_id', studentIds);
  if (!apps || apps.length === 0) return [];

  // Count applications per employer
  const counts: Record<string, number> = {};
  for (const app of apps) {
    const listing = Array.isArray(app.listing) ? app.listing[0] : app.listing;
    const employer = listing ? (Array.isArray((listing as any).employers) ? (listing as any).employers[0] : (listing as any).employers) : null;
    const name = employer?.company_name;
    if (name) counts[name] = (counts[name] || 0) + 1;
  }

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
}

export async function getPlacementCities(universityId: string) {
  // Get student IDs
  const { data: students } = await supabase
    .from('students')
    .select('id')
    .eq('university_id', universityId);
  const studentIds = students?.map(s => s.id) ?? [];
  if (studentIds.length === 0) return [];

  // Get offered applications with listing location
  const { data: apps } = await supabase
    .from('applications')
    .select('listing:internship_listings!inner(location)')
    .eq('status', 'offered')
    .in('student_id', studentIds);
  if (!apps || apps.length === 0) return [];

  const counts: Record<string, number> = {};
  for (const app of apps) {
    const listing = Array.isArray(app.listing) ? app.listing[0] : app.listing;
    const loc = (listing as any)?.location;
    if (loc) counts[loc] = (counts[loc] || 0) + 1;
  }

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([city, count]) => ({ city, count }));
}

// ---- Listing Management (Edit/Close) ----

// ---- Student Skills ----

export async function getStudentSkills(studentId: string) {
  const { data, error } = await supabase
    .from('student_skills')
    .select('*')
    .eq('student_id', studentId)
    .order('name', { ascending: true });
  if (error) return [];
  return data ?? [];
}

export async function addStudentSkill(studentId: string, name: string, isCustom: boolean) {
  const { data, error } = await supabase
    .from('student_skills')
    .insert({ student_id: studentId, name, is_custom: isCustom })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function removeStudentSkill(skillId: string) {
  const { error } = await supabase
    .from('student_skills')
    .delete()
    .eq('id', skillId);
  if (error) throw error;
}

// ---- Student Experiences ----

export async function getStudentExperiences(studentId: string, type?: string) {
  let query = supabase
    .from('student_experiences')
    .select('*')
    .eq('student_id', studentId);
  if (type) query = query.eq('type', type);
  const { data, error } = await query.order('start_date', { ascending: false });
  if (error) return [];
  return data ?? [];
}

export async function addStudentExperience(studentId: string, experience: {
  type: string;
  title: string;
  organization?: string;
  location?: string;
  description?: string;
  technologies?: string;
  link?: string;
  start_date?: string;
  end_date?: string;
  is_current?: boolean;
}) {
  const { data, error } = await supabase
    .from('student_experiences')
    .insert({ student_id: studentId, ...experience })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateStudentExperience(experienceId: string, fields: {
  title?: string;
  organization?: string;
  location?: string;
  description?: string;
  technologies?: string;
  link?: string;
  start_date?: string;
  end_date?: string | null;
  is_current?: boolean;
}) {
  const { data, error } = await supabase
    .from('student_experiences')
    .update(fields)
    .eq('id', experienceId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteStudentExperience(experienceId: string) {
  const { error } = await supabase
    .from('student_experiences')
    .delete()
    .eq('id', experienceId);
  if (error) throw error;
}

// ---- Student Organizations ----

export async function getStudentOrganizations(studentId: string, type?: string) {
  let query = supabase
    .from('student_organizations')
    .select('*')
    .eq('student_id', studentId);
  if (type) query = query.eq('type', type);
  const { data, error } = await query.order('join_date', { ascending: false });
  if (error) return [];
  return data ?? [];
}

export async function addStudentOrganization(studentId: string, org: {
  type: string;
  name: string;
  chapter?: string;
  role?: string;
  join_date?: string;
  end_date?: string;
}) {
  const { data, error } = await supabase
    .from('student_organizations')
    .insert({ student_id: studentId, ...org })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateStudentOrganization(orgId: string, fields: {
  name?: string;
  chapter?: string;
  role?: string;
  join_date?: string;
  end_date?: string | null;
}) {
  const { data, error } = await supabase
    .from('student_organizations')
    .update(fields)
    .eq('id', orgId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteStudentOrganization(orgId: string) {
  const { error } = await supabase
    .from('student_organizations')
    .delete()
    .eq('id', orgId);
  if (error) throw error;
}

// ---- Events ----

export async function getEventById(eventId: string) {
  const { data, error } = await supabase
    .from('university_events')
    .select('*, university:universities(name, logo_url)')
    .eq('id', eventId)
    .single();
  if (error || !data) return null;
  return data;
}

export async function getEventRegistrationCount(eventId: string) {
  const { count, error } = await supabase
    .from('event_registrations')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', eventId);
  if (error) return 0;
  return count ?? 0;
}

export async function registerForEvent(eventId: string, studentId: string) {
  const { data, error } = await supabase
    .from('event_registrations')
    .insert({ event_id: eventId, student_id: studentId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function unregisterFromEvent(eventId: string, studentId: string) {
  const { error } = await supabase
    .from('event_registrations')
    .delete()
    .eq('event_id', eventId)
    .eq('student_id', studentId);
  if (error) throw error;
}

export async function isRegisteredForEvent(eventId: string, studentId: string) {
  const { data, error } = await supabase
    .from('event_registrations')
    .select('id')
    .eq('event_id', eventId)
    .eq('student_id', studentId)
    .maybeSingle();
  if (error) return false;
  return !!data;
}

// ---- University Partner Listings ----

export async function getUniversityPartnerListings(
  universityId: string,
  page = 1,
  pageSize = 20,
  industry?: string
) {
  const { data: partnerships } = await supabase
    .from('university_employer_partnerships')
    .select('employer_id')
    .eq('university_id', universityId)
    .eq('status', 'active');

  if (!partnerships || partnerships.length === 0) {
    return { data: [], totalCount: 0 };
  }

  const employerIds = partnerships.map(p => p.employer_id);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('internship_listings')
    .select('*, employers(company_name, logo_url)', { count: 'exact' })
    .eq('status', 'active')
    .in('employer_id', employerIds);

  if (industry) {
    query = query.eq('industry', industry);
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) return { data: [], totalCount: 0 };
  return { data: data ?? [], totalCount: count ?? 0 };
}

export async function updateListing(listingId: string, fields: {
  title?: string;
  description?: string;
  location?: string;
  is_remote?: boolean;
  compensation?: string;
  requirements?: string;
  industry?: string;
  status?: string;
  application_deadline?: string | null;
}) {
  const { data, error } = await supabase
    .from('internship_listings')
    .update(fields)
    .eq('id', listingId)
    .select()
    .single();
  if (error) throw error;
  return data;
}
