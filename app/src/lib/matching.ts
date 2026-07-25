// In-house applicant match scoring.
//
// Produces the 0-100 `applications.match_score` written at apply time. The
// score matters beyond ranking: PPA listings only bill applications scoring
// >= PPA_MATCH_THRESHOLD (the handle_new_application trigger skips the rest),
// so sub-threshold applicants are unbilled by design.
//
// Weighted components (standard ATS-style criteria):
//   - Skills/keyword match ...... 40  student skills vs. skills mentioned in listing text
//   - Industry alignment ........ 25  career-survey industries, then major-to-industry mapping
//   - Experience relevance ...... 20  past experience/bio overlap with listing keywords
//   - Work environment fit ......  7.5 survey preference vs. remote/hybrid/in-person
//   - Duration fit ..............  7.5 survey preference vs. listing duration
//
// Missing data earns neutral partial credit rather than zero, so a student who
// skipped the survey isn't automatically disqualified — but an empty profile
// still lands well under the billing threshold.

import { MAJOR_TO_INDUSTRIES, SKILLS } from './constants';

export type MatchStudentInput = {
  major: string | null;
  bio: string | null;
  skills: string[]; // student_skills names + career-survey skills
  experiences: {
    type: string;
    title: string;
    description: string | null;
    technologies: string | null;
  }[];
  survey: {
    industries: string[];
    work_environment: string;
    preferred_duration: string;
  } | null;
};

export type MatchListingInput = {
  title: string;
  description: string | null;
  requirements: string | null;
  key_responsibilities: string | null;
  industry: string | null;
  is_remote: boolean | null;
  is_hybrid: boolean | null;
  duration: string | null;
};

export type MatchBreakdown = {
  skills: number;
  industry: number;
  experience: number;
  environment: number;
  duration: number;
  total: number;
};

const WEIGHTS = {
  skills: 40,
  industry: 25,
  experience: 20,
  environment: 7.5,
  duration: 7.5,
} as const;

// Career-survey industry labels differ from listing `industry` values; map the
// ones with a clear counterpart. Unmapped survey picks (e.g. Consulting) simply
// never match a listing industry.
const SURVEY_INDUSTRY_TO_LISTING: Record<string, string> = {
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

// Survey duration buckets vs. listing DURATIONS values they satisfy.
const SURVEY_DURATION_TO_LISTING: Record<string, string[]> = {
  '1_month': ['1-3 months', 'Summer'],
  '3_months': ['1-3 months', '3-6 months', 'Summer', 'Fall Semester', 'Spring Semester'],
  '6_months': ['3-6 months', '6+ months', 'Year-round'],
  '12_months': ['6+ months', 'Year-round'],
};

const TITLE_STOPWORDS = new Set([
  'intern', 'internship', 'summer', 'fall', 'spring', 'remote', 'hybrid',
  'with', 'and', 'the', 'for', 'paid', 'unpaid', 'time', 'part', 'full',
  'junior', 'senior', 'assistant', 'associate', 'entry', 'level',
]);

// Word-boundary matcher tolerant of skill names like "C++", "C#", ".NET".
// Short names (C, R, Go) match case-sensitively so prose words don't hit.
function skillPattern(name: string): RegExp {
  const escaped = name.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
  const flags = name.length <= 2 ? '' : 'i';
  return new RegExp(`(?<![a-zA-Z0-9])${escaped}(?![a-zA-Z0-9])`, flags);
}

function listingText(listing: MatchListingInput): string {
  return [listing.title, listing.description, listing.requirements, listing.key_responsibilities]
    .filter(Boolean)
    .join(' ');
}

// Skills the listing text mentions, drawn from the canonical SKILLS list plus
// the student's own (possibly custom) skill names.
function extractListingSkills(text: string, studentSkills: string[]): string[] {
  const seen = new Set<string>();
  const found: string[] = [];
  for (const skill of [...SKILLS, ...studentSkills]) {
    const key = skill.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    if (skillPattern(skill).test(text)) found.push(skill);
  }
  return found;
}

function scoreSkills(student: MatchStudentInput, foundListingSkills: string[]): number {
  // Listing text names no recognizable skills — nothing to grade against.
  if (foundListingSkills.length === 0) return WEIGHTS.skills * 0.5;
  const studentSet = new Set(student.skills.map((s) => s.toLowerCase()));
  const matched = foundListingSkills.filter((s) => studentSet.has(s.toLowerCase()));
  return WEIGHTS.skills * (matched.length / foundListingSkills.length);
}

function scoreIndustry(student: MatchStudentInput, listing: MatchListingInput): number {
  if (!listing.industry) return WEIGHTS.industry * 0.5;
  const surveyIndustries = (student.survey?.industries ?? []).map(
    (i) => SURVEY_INDUSTRY_TO_LISTING[i] ?? i
  );
  if (surveyIndustries.includes(listing.industry)) return WEIGHTS.industry;
  const majorIndustries = student.major ? MAJOR_TO_INDUSTRIES[student.major] ?? [] : [];
  if (majorIndustries.includes(listing.industry)) return WEIGHTS.industry * 0.8;
  // They told us their interests and this listing isn't among them.
  if (student.survey || student.major) return WEIGHTS.industry * 0.2;
  return WEIGHTS.industry * 0.5;
}

function scoreExperience(
  student: MatchStudentInput,
  listing: MatchListingInput,
  foundListingSkills: string[]
): number {
  const hasProfessional = student.experiences.some(
    (e) => e.type === 'internship' || e.type === 'work'
  );
  const baseWeight = WEIGHTS.experience * 0.3;
  const base = hasProfessional ? baseWeight : student.experiences.length > 0 ? baseWeight / 2 : 0;

  const corpus = [
    student.bio,
    ...student.experiences.flatMap((e) => [e.title, e.description, e.technologies]),
  ]
    .filter(Boolean)
    .join(' ');

  const titleKeywords = listing.title
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .filter((w) => w.length >= 4 && !TITLE_STOPWORDS.has(w));
  const keywords = [...new Set([...foundListingSkills, ...titleKeywords])];

  const relevanceWeight = WEIGHTS.experience * 0.7;
  if (keywords.length === 0 || !corpus) return base + relevanceWeight * 0.5;
  const hits = keywords.filter((k) => skillPattern(k).test(corpus)).length;
  return base + relevanceWeight * (hits / keywords.length);
}

function scoreEnvironment(student: MatchStudentInput, listing: MatchListingInput): number {
  const pref = student.survey?.work_environment;
  if (!pref) return WEIGHTS.environment * 0.5;
  if (pref === 'no_preference') return WEIGHTS.environment;
  const listingEnv = listing.is_remote ? 'remote' : listing.is_hybrid ? 'hybrid' : 'in_person';
  if (pref === listingEnv) return WEIGHTS.environment;
  // Hybrid is adjacent to both remote and in-person; remote vs in-person is not.
  if (pref === 'hybrid' || listingEnv === 'hybrid') return WEIGHTS.environment * 0.6;
  return WEIGHTS.environment * 0.2;
}

function scoreDuration(student: MatchStudentInput, listing: MatchListingInput): number {
  const pref = student.survey?.preferred_duration;
  if (!pref || !listing.duration) return WEIGHTS.duration * 0.5;
  const compatible = SURVEY_DURATION_TO_LISTING[pref];
  if (!compatible) return WEIGHTS.duration * 0.5;
  return compatible.includes(listing.duration) ? WEIGHTS.duration : WEIGHTS.duration * 0.2;
}

export function computeMatchBreakdown(
  student: MatchStudentInput,
  listing: MatchListingInput
): MatchBreakdown {
  const foundListingSkills = extractListingSkills(listingText(listing), student.skills);
  const parts = {
    skills: scoreSkills(student, foundListingSkills),
    industry: scoreIndustry(student, listing),
    experience: scoreExperience(student, listing, foundListingSkills),
    environment: scoreEnvironment(student, listing),
    duration: scoreDuration(student, listing),
  };
  const total = Math.min(
    100,
    Math.max(0, Math.round(parts.skills + parts.industry + parts.experience + parts.environment + parts.duration))
  );
  return { ...parts, total };
}

export function computeMatchScore(student: MatchStudentInput, listing: MatchListingInput): number {
  return computeMatchBreakdown(student, listing).total;
}
