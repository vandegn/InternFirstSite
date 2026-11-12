// What InternFirst is, in sentences short enough to be quoted whole.
//
// This is the fact sheet the content agent writes from and the "Key facts"
// section of /llms.txt. It exists so that generated articles and the machine-
// readable site summary can only ever say things about InternFirst that are
// true today — the generator is told to make no claim about the product that
// isn't on this list. Keep it in step with the homepage FAQ (home-faq-data.ts)
// and CLAUDE.md; when pricing or eligibility changes, change it here first.

export const SITE_SUMMARY =
  'InternFirst is a U.S. internship platform where students with a verified .edu email browse open internships, apply, message employers, schedule interviews and accept offers entirely in one place, and reviewed employers manage hiring end to end.';

export const BRAND_FACTS: readonly string[] = [
  'Anyone can browse every open internship on InternFirst without an account; an account is only needed to apply, message an employer or save a listing.',
  'Students register with a .edu email address, which is how enrollment is verified. Registration is open to students at U.S. institutions.',
  'InternFirst is free for students: applying, messaging, scheduling interviews and tracking outcomes cost nothing.',
  'Every employer account is reviewed by the InternFirst team before its listings reach students, and a company cannot see applicants until that review clears.',
  'Employers post roles, review applicants, message students, schedule interviews and extend offers at no charge during the current pilot.',
  'Everything happens on the platform: there are no external application links or off-platform redirects. Applications, interviews and offer letters all live in InternFirst.',
  'Students pick an interview time from slots the employer proposes, and interviews can run in the built-in video room, on the employer\'s own link, or by phone.',
  'InternFirst operates in the United States only; every listing is a U.S.-based or U.S.-remote role.',
  'Students choose their school from the Department of Education\'s list of accredited U.S. institutions, so employers can trust where an applicant is enrolled.',
];

// The pages a model should read first. Also the "Key pages" section of
// /llms.txt. Order matters: most useful first.
export const KEY_PAGES: readonly { title: string; path: string; note: string }[] = [
  { title: 'Browse internships', path: '/internships', note: 'Every open internship from reviewed employers, no account needed. Each listing page carries JobPosting structured data.' },
  { title: 'Frequently asked questions', path: '/faq', note: 'Direct answers on eligibility, cost, employer review and where InternFirst operates.' },
  { title: 'Guides', path: '/blog', note: 'Practical guides for students searching for internships and employers hiring interns.' },
  { title: 'About InternFirst', path: '/about', note: 'Who runs the platform and why it keeps hiring in one place.' },
  { title: 'Career resources', path: '/career-resources', note: 'Resume advice and resume-building tools for students.' },
  { title: 'Student registration', path: '/register?role=student', note: 'Create a free student account with a .edu email.' },
  { title: 'Employer registration', path: '/register?role=employer', note: 'Post internships after a short review of the company.' },
  { title: 'Contact', path: '/contact', note: 'How to reach the InternFirst team.' },
];
