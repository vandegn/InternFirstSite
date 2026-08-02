export const INDUSTRIES = [
  'Technology',
  'Finance',
  'Healthcare',
  'Marketing',
  'Legal',
  'Engineering',
  'Education',
  'Media',
  'Nonprofit',
  'Government',
  'Retail',
  'Other',
] as const;

export type Industry = (typeof INDUSTRIES)[number];

// The career survey offers a broader, student-facing industry vocabulary than
// the values employers pick from above ("Finance & Banking" vs. "Finance").
// Anything a student selects has to be translated before it can be compared to
// a listing's `industry`, or it silently matches nothing.
//
// Picks with no counterpart (e.g. Consulting) map to nothing on purpose.
export const SURVEY_INDUSTRY_TO_LISTING: Record<string, string> = {
  'Technology': 'Technology',
  'Finance & Banking': 'Finance',
  'Healthcare': 'Healthcare',
  'Marketing & Advertising': 'Marketing',
  'Media & Entertainment': 'Media',
  'Education': 'Education',
  'Government & Policy': 'Government',
  'Engineering': 'Engineering',
  'Nonprofit & Social Impact': 'Nonprofit',
  'Real Estate': 'Finance',
  'Energy & Sustainability': 'Engineering',
};

// Translate survey industry labels to listing industries, dropping unmapped
// picks and duplicates (two survey picks can share one listing industry).
export function surveyIndustriesToListingIndustries(industries: string[]): string[] {
  return [...new Set(
    industries
      .map((i) => SURVEY_INDUSTRY_TO_LISTING[i])
      .filter((i): i is string => Boolean(i)),
  )];
}

export const DURATIONS = [
  'Summer',
  'Fall Semester',
  'Spring Semester',
  'Year-round',
  '1-3 months',
  '3-6 months',
  '6+ months',
] as const;

export type Duration = (typeof DURATIONS)[number];

// ============================================
// Listing customization
// ============================================

// Custom screening questions employers can attach to a listing.
export const QUESTION_TYPES = [
  { value: 'short_text', label: 'Short answer', hint: 'One line of text' },
  { value: 'long_text', label: 'Long answer', hint: 'A paragraph' },
  { value: 'single_select', label: 'Multiple choice', hint: 'Pick one option' },
  { value: 'multi_select', label: 'Checkboxes', hint: 'Pick any number of options' },
  { value: 'yes_no', label: 'Yes / No', hint: 'Can flag a disqualifying answer' },
  { value: 'file', label: 'File upload', hint: 'Portfolio, writing sample, etc.' },
] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number]['value'];

// Question types whose answers come from an employer-defined option list.
export const OPTION_QUESTION_TYPES: QuestionType[] = ['single_select', 'multi_select'];

// Accent colors an employer can brand a listing with. Seeded from the brand
// palette, plus a custom hex input in the picker.
export const ACCENT_PRESETS = [
  '#1A2D49', // brand navy (--primary)
  '#9FC63C', // brand green (--accent)
  '#2563eb',
  '#7c3aed',
  '#db2777',
  '#ea580c',
  '#0d9488',
] as const;

// ============================================
// Structured compensation
// ============================================
// Listings store both the structured comp_* columns and a derived display
// string in `compensation`. The string is what listing cards render and what
// getActiveListings' paid/unpaid filter matches against, so `unpaid` MUST keep
// producing exactly 'Unpaid'.

export const COMP_TYPES = [
  { value: 'hourly', label: 'Hourly', suffix: '/hr', unit: 'per hour' },
  { value: 'salary', label: 'Salary', suffix: '/yr', unit: 'per year' },
  { value: 'stipend', label: 'Stipend', suffix: ' stipend', unit: 'total' },
  { value: 'unpaid', label: 'Unpaid', suffix: '', unit: '' },
  { value: 'other', label: 'Other', suffix: '', unit: '' },
] as const;

export type CompType = (typeof COMP_TYPES)[number]['value'];

// Render cents as a whole-dollar amount, dropping trailing '.00' and adding
// thousands separators: 4500000 -> "$45,000", 1550 -> "$15.50".
function formatDollars(cents: number): string {
  const dollars = cents / 100;
  const hasCents = cents % 100 !== 0;
  return `$${dollars.toLocaleString('en-US', {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  })}`;
}

export type CompensationInput = {
  comp_type?: CompType | null;
  comp_min_cents?: number | null;
  comp_max_cents?: number | null;
  comp_note?: string | null;
};

// Build the display string stored in internship_listings.compensation.
// Returns null when there's nothing to show, which reads as "not specified"
// everywhere the column is rendered.
export function formatCompensation(comp: CompensationInput): string | null {
  const { comp_type, comp_min_cents, comp_max_cents, comp_note } = comp;
  if (!comp_type) return null;

  if (comp_type === 'unpaid') return 'Unpaid';
  if (comp_type === 'other') return comp_note?.trim() || 'Other';

  const type = COMP_TYPES.find((t) => t.value === comp_type)!;
  const min = comp_min_cents ?? null;
  const max = comp_max_cents ?? null;

  let amount: string | null = null;
  if (min != null && max != null && max > min) {
    // Only repeat the '$' when the range crosses a formatting boundary.
    amount = `${formatDollars(min)}-${formatDollars(max).replace('$', '')}`;
  } else if (min != null) {
    amount = formatDollars(min);
  } else if (max != null) {
    amount = formatDollars(max);
  }

  if (!amount) {
    // Stipend with no figure is still meaningful on its own; hourly/salary is not.
    return comp_type === 'stipend' ? 'Stipend' : null;
  }

  const base = `${amount}${type.suffix}`;
  const note = comp_note?.trim();
  return note ? `${base}${COMP_NOTE_SEPARATOR}${note}` : base;
}

// formatCompensation joins the figure and the employer's free-text note into
// one stored string. Compact surfaces (the browse sidebar) only have room for
// the figure — a two-line note there wrecks the card — so they split it back
// apart and show a "more details" affordance instead.
export const COMP_NOTE_SEPARATOR = ' · ';

export function splitCompensation(compensation: string | null | undefined): {
  summary: string | null;
  note: string | null;
} {
  if (!compensation) return { summary: null, note: null };
  const idx = compensation.indexOf(COMP_NOTE_SEPARATOR);
  if (idx === -1) return { summary: compensation, note: null };
  return {
    summary: compensation.slice(0, idx),
    note: compensation.slice(idx + COMP_NOTE_SEPARATOR.length),
  };
}

// ============================================
// Employer payment plans (PPJ / PPA)
// ============================================
// All prices are in US cents. CPA (Cost-Per-Application) is the per–occupation-
// group benchmark that anchors both paid tiers; it is the single source of
// truth here. Tiers, anchored to a listing's `industry`:
//   PPA (Pay-Per-Application): billed the group CPA for each *completed,
//        qualifying* application (match >= PPA_MATCH_THRESHOLD), invoiced
//        monthly, no ceiling.
//   PPJ (Pay-Per-Job): employer picks an estimated application range; the
//        median of that range × the group CPA is one fixed upfront fee,
//        regardless of how many applications actually arrive (no cap).
// Both sit above the free "organic" tier (a listing with pricing_model = null).
//
// Benchmarks are recalibrated monthly via exponential smoothing
//   Updated CPA = Old CPA + α(Observed CPA − Old CPA), α ∈ [0.1, 0.3]
// which is an ops/admin process, not performed in this code.

// How long a posting stays live, in days. Does NOT affect price — PPJ pricing is
// driven solely by the application-range estimate and the group CPA.
export const POSTING_DURATIONS = [
  { days: 30, label: '30 days' },
  { days: 60, label: '60 days' },
  { days: 90, label: '90 days' },
] as const;

export type PricingModel = 'ppj' | 'ppa';

// Blended weighted-average CPA across all occupation groups (fallback default).
export const BLENDED_CPA_CENTS = 1609; // $16.09

// Real CPA benchmark table (Appendix D.2): median CPA per occupation group, in
// cents. This is the verbatim source of truth from the InternFirst pricing doc.
export const CPA_BY_OCCUPATION_GROUP: Record<string, number> = {
  'Administration': 1188,                 // $11.88
  'Business and Consumer Services': 1017, // $10.17
  'Construction and Skilled Trades': 1737,// $17.37
  'Consulting': 1297,                     // $12.97
  'Customer Services': 1167,              // $11.67
  'Education': 2236,                       // $22.36
  'Finance': 1487,                         // $14.87
  'Food Service': 1174,                    // $11.74
  'Healthcare': 3500,                      // $35.00
  'Hospitality': 1316,                     // $13.16
  'Human Resources': 1229,                 // $12.29
  'Insurance': 1474,                       // $14.74
  'Legal': 1682,                           // $16.82
  'Management': 1506,                      // $15.06
  'Manufacturing': 1426,                   // $14.26
  'Marketing and Advertising': 1453,       // $14.53
  'Real Estate': 1298,                     // $12.98
  'Retail': 1393,                          // $13.93
  'Sales': 1382,                           // $13.82
  'Science and Engineering': 2079,         // $20.79
  'Security': 1202,                        // $12.02
  'Technology': 1555,                      // $15.55
  'Transportation': 1151,                  // $11.51
  'Warehousing and Logistics': 1478,       // $14.78
};

// Listings are categorized by `industry` (12 values) while pricing is defined
// per occupation group (24). Each industry maps to the closest group's CPA;
// the four with no clean match fall back to the blended average ($16.09).
// TODO: add a true occupation-group field on listings for exact 1:1 parity.
export const CPA_BY_INDUSTRY: Record<string, number> = {
  Technology: CPA_BY_OCCUPATION_GROUP['Technology'],                // $15.55
  Finance: CPA_BY_OCCUPATION_GROUP['Finance'],                      // $14.87
  Healthcare: CPA_BY_OCCUPATION_GROUP['Healthcare'],                // $35.00
  Marketing: CPA_BY_OCCUPATION_GROUP['Marketing and Advertising'],  // $14.53
  Legal: CPA_BY_OCCUPATION_GROUP['Legal'],                          // $16.82
  Engineering: CPA_BY_OCCUPATION_GROUP['Science and Engineering'],  // $20.79
  Education: CPA_BY_OCCUPATION_GROUP['Education'],                  // $22.36
  Retail: CPA_BY_OCCUPATION_GROUP['Retail'],                        // $13.93
  // No clean occupation-group match → blended weighted average:
  Media: BLENDED_CPA_CENTS,
  Nonprofit: BLENDED_CPA_CENTS,
  Government: BLENDED_CPA_CENTS,
  Other: BLENDED_CPA_CENTS,
};

// CPA for a listing's industry, falling back to the blended average.
export function cpaForIndustry(industry?: string | null): number {
  return (industry && CPA_BY_INDUSTRY[industry]) || BLENDED_CPA_CENTS;
}

// PPA only bills applications scoring at or above this match percentage.
export const PPA_MATCH_THRESHOLD = 70;

// Max number of skills a student can attach to their profile. Enforced in the
// UI, in addStudentSkill, and by an enforce_skill_limit DB trigger — keep these
// in sync (see supabase/migrations/20260731_student_skill_limit.sql).
export const MAX_STUDENT_SKILLS = 10;

// Max preferred skills an employer can attach to a listing. Drawn from the same
// catalog students pick from, so the two sides are directly comparable. Also
// enforced by a check constraint on internship_listings.preferred_skills.
export const MAX_LISTING_SKILLS = 10;

// PPJ application-range bands the employer picks from. The band's median drives
// the fixed fee (no cap on actual applications).
export const PPJ_APPLICATION_RANGES = [
  { label: '5–10 applications', min: 5, max: 10 },
  { label: '10–20 applications', min: 10, max: 20 },
  { label: '20–35 applications', min: 20, max: 35 },
  { label: '35–50 applications', min: 35, max: 50 },
  { label: '50–75 applications', min: 50, max: 75 },
] as const;

export type ApplicationRange = { min: number; max: number };

export function rangeMedian(range: ApplicationRange): number {
  return (range.min + range.max) / 2;
}

// Fixed upfront PPJ fee: median of the chosen range × the group CPA.
export function computePpjPriceCents(industry: string | null | undefined, range: ApplicationRange): number {
  return Math.round(rangeMedian(range) * cpaForIndustry(industry));
}

// Format cents as a USD string, e.g. 1487 -> "$14.87".
export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export const MAJOR_TO_INDUSTRIES: Record<string, string[]> = {
  'Accounting': ['Finance', 'Government'],
  'Actuarial Science': ['Finance', 'Technology'],
  'Advertising': ['Marketing', 'Media'],
  'Aerospace Engineering': ['Engineering', 'Technology', 'Government'],
  'African American Studies': ['Education', 'Nonprofit', 'Government'],
  'Agricultural Science': ['Healthcare', 'Government'],
  'American Studies': ['Education', 'Government'],
  'Animal Science': ['Healthcare'],
  'Anthropology': ['Education', 'Nonprofit'],
  'Applied Mathematics': ['Technology', 'Finance', 'Engineering'],
  'Architecture': ['Engineering'],
  'Art History': ['Education', 'Media'],
  'Astronomy': ['Technology', 'Education'],
  'Biochemistry': ['Healthcare', 'Technology'],
  'Biomedical Engineering': ['Healthcare', 'Engineering', 'Technology'],
  'Biology': ['Healthcare', 'Education'],
  'Business Administration': ['Finance', 'Marketing', 'Retail'],
  'Chemical Engineering': ['Engineering', 'Healthcare'],
  'Chemistry': ['Healthcare', 'Engineering'],
  'Civil Engineering': ['Engineering', 'Government'],
  'Classics': ['Education'],
  'Cognitive Science': ['Technology', 'Healthcare'],
  'Communications': ['Media', 'Marketing'],
  'Computer Engineering': ['Technology', 'Engineering'],
  'Computer Science': ['Technology', 'Finance', 'Engineering'],
  'Construction Management': ['Engineering'],
  'Criminal Justice': ['Government', 'Legal'],
  'Cybersecurity': ['Technology', 'Government'],
  'Dance': ['Media', 'Education'],
  'Data Science': ['Technology', 'Finance', 'Healthcare'],
  'Dentistry (Pre-Dental)': ['Healthcare'],
  'Early Childhood Education': ['Education'],
  'Earth Science': ['Engineering', 'Government'],
  'Economics': ['Finance', 'Government'],
  'Education': ['Education', 'Nonprofit'],
  'Electrical Engineering': ['Engineering', 'Technology'],
  'Elementary Education': ['Education'],
  'English': ['Media', 'Education'],
  'Entrepreneurship': ['Technology', 'Finance', 'Marketing'],
  'Environmental Engineering': ['Engineering', 'Government'],
  'Environmental Science': ['Government', 'Nonprofit'],
  'Exercise Science': ['Healthcare'],
  'Fashion Design': ['Retail', 'Media'],
  'Film Studies': ['Media'],
  'Finance': ['Finance'],
  'Food Science': ['Healthcare', 'Retail'],
  'Foreign Languages': ['Education', 'Government'],
  'Forensic Science': ['Legal', 'Government'],
  'Forestry': ['Government', 'Nonprofit'],
  'Gender Studies': ['Nonprofit', 'Education'],
  'Genetics': ['Healthcare', 'Technology'],
  'Geography': ['Government', 'Education'],
  'Geology': ['Engineering', 'Government'],
  'Graphic Design': ['Media', 'Marketing', 'Technology'],
  'Health Administration': ['Healthcare', 'Government'],
  'Health Sciences': ['Healthcare'],
  'History': ['Education', 'Government'],
  'Hospitality Management': ['Retail'],
  'Human Resources': ['Finance', 'Retail'],
  'Industrial Engineering': ['Engineering', 'Technology'],
  'Information Systems': ['Technology', 'Finance'],
  'Information Technology': ['Technology'],
  'Interior Design': ['Retail', 'Media'],
  'International Business': ['Finance', 'Government'],
  'International Relations': ['Government', 'Nonprofit'],
  'Journalism': ['Media'],
  'Kinesiology': ['Healthcare'],
  'Law (Pre-Law)': ['Legal', 'Government'],
  'Liberal Arts': ['Education'],
  'Linguistics': ['Technology', 'Education'],
  'Management': ['Finance', 'Retail'],
  'Marine Biology': ['Healthcare', 'Government'],
  'Marketing': ['Marketing', 'Media', 'Retail'],
  'Materials Science': ['Engineering', 'Technology'],
  'Mathematics': ['Technology', 'Finance', 'Education'],
  'Mechanical Engineering': ['Engineering', 'Technology'],
  'Media Studies': ['Media', 'Marketing'],
  'Medicine (Pre-Med)': ['Healthcare'],
  'Meteorology': ['Government', 'Media'],
  'Microbiology': ['Healthcare'],
  'Military Science': ['Government'],
  'Music': ['Media', 'Education'],
  'Music Education': ['Education'],
  'Neuroscience': ['Healthcare', 'Technology'],
  'Nuclear Engineering': ['Engineering', 'Government'],
  'Nursing': ['Healthcare'],
  'Nutrition': ['Healthcare'],
  'Occupational Therapy': ['Healthcare'],
  'Oceanography': ['Government'],
  'Operations Management': ['Finance', 'Retail'],
  'Optometry (Pre-Optometry)': ['Healthcare'],
  'Pharmacy (Pre-Pharmacy)': ['Healthcare'],
  'Philosophy': ['Education', 'Legal'],
  'Photography': ['Media'],
  'Physical Therapy': ['Healthcare'],
  'Physics': ['Technology', 'Engineering'],
  'Political Science': ['Government', 'Legal', 'Nonprofit'],
  'Psychology': ['Healthcare', 'Education'],
  'Public Health': ['Healthcare', 'Government', 'Nonprofit'],
  'Public Policy': ['Government', 'Nonprofit'],
  'Public Relations': ['Marketing', 'Media'],
  'Real Estate': ['Finance'],
  'Religious Studies': ['Education', 'Nonprofit'],
  'Social Work': ['Nonprofit', 'Healthcare', 'Government'],
  'Sociology': ['Nonprofit', 'Education', 'Government'],
  'Software Engineering': ['Technology'],
  'Spanish': ['Education'],
  'Special Education': ['Education'],
  'Speech Pathology': ['Healthcare', 'Education'],
  'Sports Management': ['Marketing', 'Media'],
  'Statistics': ['Technology', 'Finance'],
  'Studio Art': ['Media'],
  'Supply Chain Management': ['Retail', 'Finance'],
  'Theater': ['Media', 'Education'],
  'Urban Planning': ['Government'],
  'Veterinary Science (Pre-Vet)': ['Healthcare'],
  'Web Development': ['Technology'],
  'Zoology': ['Healthcare', 'Education'],
  'Undecided': [],
  'Other': [],
};

export const SKILLS = [
  // Programming Languages
  'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 'C', 'Go', 'Rust', 'Ruby',
  'PHP', 'Swift', 'Kotlin', 'R', 'MATLAB', 'SQL', 'Scala', 'Perl', 'Dart', 'Shell/Bash',
  // Web & Frameworks
  'React', 'Next.js', 'Angular', 'Vue.js', 'Node.js', 'Express.js', 'Django', 'Flask',
  'Spring Boot', '.NET', 'Ruby on Rails', 'Laravel', 'Svelte', 'Tailwind CSS',
  // Mobile
  'React Native', 'Flutter', 'iOS Development', 'Android Development',
  // Data & ML
  'Machine Learning', 'Data Analysis', 'Data Visualization', 'Pandas', 'NumPy',
  'TensorFlow', 'PyTorch', 'Scikit-learn', 'Tableau', 'Power BI', 'Excel (Advanced)',
  'Jupyter Notebooks', 'Natural Language Processing', 'Computer Vision',
  // Cloud & DevOps
  'AWS', 'Azure', 'Google Cloud', 'Docker', 'Kubernetes', 'CI/CD', 'Git',
  'Linux', 'Terraform', 'Jenkins',
  // Databases
  'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Firebase', 'Supabase', 'GraphQL',
  // Design
  'Figma', 'Adobe Photoshop', 'Adobe Illustrator', 'Adobe InDesign', 'Sketch',
  'UI/UX Design', 'Wireframing', 'Prototyping',
  // Business & Finance
  'Financial Modeling', 'Financial Analysis', 'Project Management', 'Market Research',
  'Business Development', 'Consulting', 'Accounting', 'Budgeting',
  'Strategic Planning', 'Sales',
  // Marketing
  'Digital Marketing', 'SEO/SEM', 'Social Media Marketing', 'Content Writing',
  'Google Analytics', 'Email Marketing', 'Copywriting',
  // Soft Skills
  'Public Speaking', 'Leadership', 'Teamwork', 'Problem Solving',
  'Written Communication', 'Critical Thinking', 'Time Management',
  'Adaptability', 'Conflict Resolution', 'Mentoring',
  // Other Technical
  'AutoCAD', 'SolidWorks', 'SPSS', 'Stata', 'LabVIEW', 'Revit',
  'GIS/ArcGIS', 'Blender', '3D Modeling', 'Video Editing',
  'Autodesk Inventor', 'SketchUp',
] as const;

export type Skill = (typeof SKILLS)[number];

export const MAJORS = [
  'Accounting',
  'Actuarial Science',
  'Advertising',
  'Aerospace Engineering',
  'African American Studies',
  'Agricultural Science',
  'American Studies',
  'Animal Science',
  'Anthropology',
  'Applied Mathematics',
  'Architecture',
  'Art History',
  'Astronomy',
  'Biochemistry',
  'Biomedical Engineering',
  'Biology',
  'Business Administration',
  'Chemical Engineering',
  'Chemistry',
  'Civil Engineering',
  'Classics',
  'Cognitive Science',
  'Communications',
  'Computer Engineering',
  'Computer Science',
  'Construction Management',
  'Criminal Justice',
  'Cybersecurity',
  'Dance',
  'Data Science',
  'Dentistry (Pre-Dental)',
  'Early Childhood Education',
  'Earth Science',
  'Economics',
  'Education',
  'Electrical Engineering',
  'Elementary Education',
  'English',
  'Entrepreneurship',
  'Environmental Engineering',
  'Environmental Science',
  'Exercise Science',
  'Fashion Design',
  'Film Studies',
  'Finance',
  'Food Science',
  'Foreign Languages',
  'Forensic Science',
  'Forestry',
  'Gender Studies',
  'Genetics',
  'Geography',
  'Geology',
  'Graphic Design',
  'Health Administration',
  'Health Sciences',
  'History',
  'Hospitality Management',
  'Human Resources',
  'Industrial Engineering',
  'Information Systems',
  'Information Technology',
  'Interior Design',
  'International Business',
  'International Relations',
  'Journalism',
  'Kinesiology',
  'Law (Pre-Law)',
  'Liberal Arts',
  'Linguistics',
  'Management',
  'Marine Biology',
  'Marketing',
  'Materials Science',
  'Mathematics',
  'Mechanical Engineering',
  'Media Studies',
  'Medicine (Pre-Med)',
  'Meteorology',
  'Microbiology',
  'Military Science',
  'Music',
  'Music Education',
  'Neuroscience',
  'Nuclear Engineering',
  'Nursing',
  'Nutrition',
  'Occupational Therapy',
  'Oceanography',
  'Operations Management',
  'Optometry (Pre-Optometry)',
  'Pharmacy (Pre-Pharmacy)',
  'Philosophy',
  'Photography',
  'Physical Therapy',
  'Physics',
  'Political Science',
  'Psychology',
  'Public Health',
  'Public Policy',
  'Public Relations',
  'Real Estate',
  'Religious Studies',
  'Social Work',
  'Sociology',
  'Software Engineering',
  'Spanish',
  'Special Education',
  'Speech Pathology',
  'Sports Management',
  'Statistics',
  'Studio Art',
  'Supply Chain Management',
  'Theater',
  'Urban Planning',
  'Veterinary Science (Pre-Vet)',
  'Web Development',
  'Zoology',
  'Undecided',
  'Other',
] as const;
