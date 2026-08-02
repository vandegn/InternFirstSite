// The 25 user-facing industry classifications, from the taxonomy in
// context/industry-list.pdf. The backbone is NAICS 2022 / ISIC Rev. 5, with
// deliberate front-end splits where employers and students search differently
// from how a statistical agency classifies: Healthcare apart from Social
// Services & Nonprofit, Technology apart from Telecommunications and from
// Media, and Environmental Services as its own option.
//
// Order is the taxonomy's own, which runs roughly primary industry → goods →
// services rather than alphabetically. Keep it: it groups related choices
// next to each other in the dropdown.
export const INDUSTRIES = [
  'Agriculture, Forestry, Fishing & Aquaculture',
  'Energy, Mining & Utilities',
  'Environmental Services & Sustainability',
  'Construction & Building Services',
  'Manufacturing & Industrial Production',
  'Transportation, Logistics & Warehousing',
  'Automotive & Mobility',
  'Wholesale & Distribution',
  'Retail & E-commerce',
  'Healthcare',
  'Social Services & Nonprofit',
  'Pharmaceuticals, Biotechnology & Life Sciences',
  'Education & Training',
  'Government & Public Administration',
  'Aerospace, Defense & Public Safety',
  'Financial Services & Insurance',
  'Real Estate, Property & Facilities',
  'Legal',
  'Consulting, Professional & Business Services',
  'Technology, Software & IT Services',
  'Telecommunications & Network Infrastructure',
  'Media, Publishing & Entertainment',
  'Advertising, Marketing & Public Relations',
  'Hospitality, Travel & Tourism',
  'Consumer Services & Personal Services',
] as const;

export type Industry = (typeof INDUSTRIES)[number];

// Maps every industry value that existed before the taxonomy swap onto its
// closest replacement. Read by the data migration that rewrites existing
// listing rows, and kept here so the mapping is reviewable in one place
// alongside the list it targets.
//
// 'Engineering' and 'Other' have no clean single successor: engineering is a
// job category in the new taxonomy rather than an industry, and 'Other' was
// always a catch-all. Both land on Consulting, Professional & Business
// Services, which is where standalone engineering and multi-industry firms
// sit, and affected listings are worth an employer revisiting.
export const LEGACY_INDUSTRY_MAP: Record<string, Industry> = {
  'Technology': 'Technology, Software & IT Services',
  'Finance': 'Financial Services & Insurance',
  'Healthcare': 'Healthcare',
  'Marketing': 'Advertising, Marketing & Public Relations',
  'Legal': 'Legal',
  'Engineering': 'Consulting, Professional & Business Services',
  'Education': 'Education & Training',
  'Media': 'Media, Publishing & Entertainment',
  'Nonprofit': 'Social Services & Nonprofit',
  'Government': 'Government & Public Administration',
  'Retail': 'Retail & E-commerce',
  'Other': 'Consulting, Professional & Business Services',
};

// The career survey offers a broader, student-facing industry vocabulary than
// the values employers pick from above ("Finance & Banking" vs. "Finance").
// Anything a student selects has to be translated before it can be compared to
// a listing's `industry`, or it silently matches nothing.
//
// A survey pick can now map to several listing industries — "Engineering"
// legitimately spans manufacturing, construction and aerospace, and matching
// against only one of them would hide most of what the student asked for.
export const SURVEY_INDUSTRY_TO_LISTING: Record<string, Industry[]> = {
  'Technology': ['Technology, Software & IT Services', 'Telecommunications & Network Infrastructure'],
  'Finance & Banking': ['Financial Services & Insurance'],
  'Healthcare': ['Healthcare', 'Pharmaceuticals, Biotechnology & Life Sciences'],
  'Marketing & Advertising': ['Advertising, Marketing & Public Relations'],
  'Consulting': ['Consulting, Professional & Business Services'],
  'Media & Entertainment': ['Media, Publishing & Entertainment'],
  'Education': ['Education & Training'],
  'Government & Policy': ['Government & Public Administration', 'Aerospace, Defense & Public Safety'],
  'Engineering': [
    'Manufacturing & Industrial Production',
    'Construction & Building Services',
    'Aerospace, Defense & Public Safety',
  ],
  'Nonprofit & Social Impact': ['Social Services & Nonprofit'],
  'Real Estate': ['Real Estate, Property & Facilities'],
  'Energy & Sustainability': ['Energy, Mining & Utilities', 'Environmental Services & Sustainability'],
};

// Translate survey industry labels to listing industries, dropping unmapped
// picks and duplicates (two survey picks can share one listing industry).
export function surveyIndustriesToListingIndustries(industries: string[]): string[] {
  return [...new Set(industries.flatMap((i) => SURVEY_INDUSTRY_TO_LISTING[i] ?? []))];
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
// Posting duration
// ============================================
// How long a listing stays live once published, in days. Drives expires_at.
// Free for the pilot — the paid Pay-Per-Job / Pay-Per-Application tiers and
// their CPA benchmark tables live on the `payments-parked` branch and are not
// part of main while there is no billing.
export const POSTING_DURATIONS = [
  { days: 30, label: '30 days' },
  { days: 60, label: '60 days' },
  { days: 90, label: '90 days' },
] as const;

// Max number of skills a student can attach to their profile. Enforced in the
// UI, in addStudentSkill, and by an enforce_skill_limit DB trigger -- keep these
// in sync (see supabase/migrations/20260731_student_skill_limit.sql).
export const MAX_STUDENT_SKILLS = 10;

// Max preferred skills an employer can attach to a listing. Drawn from the same
// catalog students pick from, so the two sides are directly comparable. Also
// enforced by a check constraint on internship_listings.preferred_skills.
export const MAX_LISTING_SKILLS = 10;

// Shorthand so the ~115 rows below stay scannable — the taxonomy's labels are
// long by design, and spelling each one out turns this map into a wall.
const I = {
  AGRI: 'Agriculture, Forestry, Fishing & Aquaculture',
  ENERGY: 'Energy, Mining & Utilities',
  ENV: 'Environmental Services & Sustainability',
  CONSTR: 'Construction & Building Services',
  MFG: 'Manufacturing & Industrial Production',
  LOGISTICS: 'Transportation, Logistics & Warehousing',
  AUTO: 'Automotive & Mobility',
  WHOLESALE: 'Wholesale & Distribution',
  RETAIL: 'Retail & E-commerce',
  HEALTH: 'Healthcare',
  NONPROFIT: 'Social Services & Nonprofit',
  LIFESCI: 'Pharmaceuticals, Biotechnology & Life Sciences',
  EDU: 'Education & Training',
  GOV: 'Government & Public Administration',
  AERO: 'Aerospace, Defense & Public Safety',
  FIN: 'Financial Services & Insurance',
  REALESTATE: 'Real Estate, Property & Facilities',
  LEGAL: 'Legal',
  CONSULTING: 'Consulting, Professional & Business Services',
  TECH: 'Technology, Software & IT Services',
  TELECOM: 'Telecommunications & Network Infrastructure',
  MEDIA: 'Media, Publishing & Entertainment',
  MARKETING: 'Advertising, Marketing & Public Relations',
  HOSPITALITY: 'Hospitality, Travel & Tourism',
  CONSUMER: 'Consumer Services & Personal Services',
} satisfies Record<string, Industry>;

// A secondary matching signal (see lib/matching.ts) — the career survey's
// stated industries are the primary one. Each major lists industries in
// rough order of how commonly its graduates land there.
export const MAJOR_TO_INDUSTRIES: Record<string, string[]> = {
  'Accounting': [I.FIN, I.CONSULTING, I.GOV],
  'Actuarial Science': [I.FIN, I.CONSULTING],
  'Advertising': [I.MARKETING, I.MEDIA],
  'Aerospace Engineering': [I.AERO, I.MFG, I.GOV],
  'African American Studies': [I.NONPROFIT, I.EDU, I.GOV],
  'Agricultural Science': [I.AGRI, I.GOV, I.ENV],
  'American Studies': [I.EDU, I.GOV, I.NONPROFIT],
  'Animal Science': [I.AGRI, I.HEALTH, I.LIFESCI],
  'Anthropology': [I.EDU, I.NONPROFIT, I.GOV],
  'Applied Mathematics': [I.TECH, I.FIN, I.CONSULTING],
  'Architecture': [I.CONSTR, I.REALESTATE, I.CONSULTING],
  'Art History': [I.MEDIA, I.EDU, I.NONPROFIT],
  'Astronomy': [I.AERO, I.EDU, I.TECH],
  'Biochemistry': [I.LIFESCI, I.HEALTH, I.ENV],
  'Biomedical Engineering': [I.LIFESCI, I.HEALTH, I.MFG],
  'Biology': [I.LIFESCI, I.HEALTH, I.EDU],
  'Business Administration': [I.CONSULTING, I.FIN, I.RETAIL],
  'Chemical Engineering': [I.MFG, I.ENERGY, I.LIFESCI],
  'Chemistry': [I.LIFESCI, I.MFG, I.ENV],
  'Civil Engineering': [I.CONSTR, I.GOV, I.CONSULTING],
  'Classics': [I.EDU, I.MEDIA],
  'Cognitive Science': [I.TECH, I.HEALTH, I.CONSULTING],
  'Communications': [I.MARKETING, I.MEDIA, I.CONSULTING],
  'Computer Engineering': [I.TECH, I.TELECOM, I.MFG],
  'Computer Science': [I.TECH, I.FIN, I.TELECOM],
  'Construction Management': [I.CONSTR, I.REALESTATE],
  'Criminal Justice': [I.AERO, I.GOV, I.LEGAL],
  'Cybersecurity': [I.TECH, I.AERO, I.FIN],
  'Dance': [I.MEDIA, I.EDU, I.HOSPITALITY],
  'Data Science': [I.TECH, I.FIN, I.CONSULTING],
  'Dentistry (Pre-Dental)': [I.HEALTH],
  'Early Childhood Education': [I.EDU, I.CONSUMER],
  'Earth Science': [I.ENERGY, I.ENV, I.GOV],
  'Economics': [I.FIN, I.CONSULTING, I.GOV],
  'Education': [I.EDU, I.NONPROFIT],
  'Electrical Engineering': [I.MFG, I.ENERGY, I.TELECOM],
  'Elementary Education': [I.EDU],
  'English': [I.MEDIA, I.EDU, I.MARKETING],
  'Entrepreneurship': [I.CONSULTING, I.TECH, I.RETAIL],
  'Environmental Engineering': [I.ENV, I.ENERGY, I.CONSTR],
  'Environmental Science': [I.ENV, I.GOV, I.NONPROFIT],
  'Exercise Science': [I.HEALTH, I.CONSUMER],
  'Fashion Design': [I.RETAIL, I.MEDIA, I.MFG],
  'Film Studies': [I.MEDIA],
  'Finance': [I.FIN, I.CONSULTING, I.REALESTATE],
  'Food Science': [I.AGRI, I.MFG, I.RETAIL],
  'Foreign Languages': [I.EDU, I.GOV, I.HOSPITALITY],
  'Forensic Science': [I.AERO, I.GOV, I.LEGAL],
  'Forestry': [I.AGRI, I.ENV, I.GOV],
  'Gender Studies': [I.NONPROFIT, I.EDU, I.GOV],
  'Genetics': [I.LIFESCI, I.HEALTH],
  'Geography': [I.GOV, I.ENV, I.EDU],
  'Geology': [I.ENERGY, I.ENV, I.GOV],
  'Graphic Design': [I.MARKETING, I.MEDIA, I.TECH],
  'Health Administration': [I.HEALTH, I.CONSULTING, I.GOV],
  'Health Sciences': [I.HEALTH, I.LIFESCI],
  'History': [I.EDU, I.GOV, I.NONPROFIT],
  'Hospitality Management': [I.HOSPITALITY, I.CONSUMER, I.RETAIL],
  'Human Resources': [I.CONSULTING, I.RETAIL, I.HEALTH],
  'Industrial Engineering': [I.MFG, I.LOGISTICS, I.CONSULTING],
  'Information Systems': [I.TECH, I.FIN, I.CONSULTING],
  'Information Technology': [I.TECH, I.TELECOM],
  'Interior Design': [I.REALESTATE, I.CONSTR, I.RETAIL],
  'International Business': [I.FIN, I.WHOLESALE, I.CONSULTING],
  'International Relations': [I.GOV, I.NONPROFIT, I.CONSULTING],
  'Journalism': [I.MEDIA, I.MARKETING],
  'Kinesiology': [I.HEALTH, I.CONSUMER],
  'Law (Pre-Law)': [I.LEGAL, I.GOV, I.CONSULTING],
  'Liberal Arts': [I.EDU, I.NONPROFIT, I.MEDIA],
  'Linguistics': [I.TECH, I.EDU, I.MEDIA],
  'Management': [I.CONSULTING, I.RETAIL, I.FIN],
  'Marine Biology': [I.AGRI, I.ENV, I.LIFESCI],
  'Marketing': [I.MARKETING, I.RETAIL, I.MEDIA],
  'Materials Science': [I.MFG, I.AERO, I.ENERGY],
  'Mathematics': [I.TECH, I.FIN, I.EDU],
  'Mechanical Engineering': [I.MFG, I.AUTO, I.AERO],
  'Media Studies': [I.MEDIA, I.MARKETING],
  'Medicine (Pre-Med)': [I.HEALTH, I.LIFESCI],
  'Meteorology': [I.GOV, I.ENV, I.MEDIA],
  'Microbiology': [I.LIFESCI, I.HEALTH],
  'Military Science': [I.AERO, I.GOV],
  'Music': [I.MEDIA, I.EDU],
  'Music Education': [I.EDU, I.MEDIA],
  'Neuroscience': [I.LIFESCI, I.HEALTH, I.TECH],
  'Nuclear Engineering': [I.ENERGY, I.AERO, I.GOV],
  'Nursing': [I.HEALTH],
  'Nutrition': [I.HEALTH, I.CONSUMER, I.AGRI],
  'Occupational Therapy': [I.HEALTH],
  'Oceanography': [I.ENV, I.GOV, I.AGRI],
  'Operations Management': [I.LOGISTICS, I.MFG, I.RETAIL],
  'Optometry (Pre-Optometry)': [I.HEALTH],
  'Pharmacy (Pre-Pharmacy)': [I.LIFESCI, I.HEALTH, I.RETAIL],
  'Philosophy': [I.EDU, I.LEGAL, I.NONPROFIT],
  'Photography': [I.MEDIA, I.MARKETING],
  'Physical Therapy': [I.HEALTH],
  'Physics': [I.AERO, I.TECH, I.ENERGY],
  'Political Science': [I.GOV, I.LEGAL, I.NONPROFIT],
  'Psychology': [I.HEALTH, I.NONPROFIT, I.EDU],
  'Public Health': [I.HEALTH, I.GOV, I.NONPROFIT],
  'Public Policy': [I.GOV, I.NONPROFIT, I.CONSULTING],
  'Public Relations': [I.MARKETING, I.MEDIA],
  'Real Estate': [I.REALESTATE, I.FIN, I.CONSTR],
  'Religious Studies': [I.NONPROFIT, I.EDU],
  'Social Work': [I.NONPROFIT, I.HEALTH, I.GOV],
  'Sociology': [I.NONPROFIT, I.GOV, I.EDU],
  'Software Engineering': [I.TECH, I.TELECOM],
  'Spanish': [I.EDU, I.GOV, I.NONPROFIT],
  'Special Education': [I.EDU, I.NONPROFIT],
  'Speech Pathology': [I.HEALTH, I.EDU],
  'Sports Management': [I.MEDIA, I.MARKETING, I.HOSPITALITY],
  'Statistics': [I.TECH, I.FIN, I.CONSULTING],
  'Studio Art': [I.MEDIA, I.MARKETING],
  'Supply Chain Management': [I.LOGISTICS, I.WHOLESALE, I.MFG],
  'Theater': [I.MEDIA, I.EDU, I.HOSPITALITY],
  'Urban Planning': [I.GOV, I.REALESTATE, I.CONSTR],
  'Veterinary Science (Pre-Vet)': [I.HEALTH, I.AGRI],
  'Web Development': [I.TECH, I.MARKETING],
  'Zoology': [I.AGRI, I.LIFESCI, I.EDU],
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
