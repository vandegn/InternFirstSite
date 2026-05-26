// Voluntary self-identification options + disclosure text.
// Categories follow the federal EEO-1 / OFCCP / Form CC-305 standards.
// Every question must accept "Decline to answer" — voluntariness is required.

export const ETHNICITY_OPTIONS = [
  { value: 'yes', label: 'Yes, Hispanic or Latino' },
  { value: 'no', label: 'No, not Hispanic or Latino' },
  { value: 'declined', label: 'Decline to answer' },
] as const;

export const RACE_OPTIONS = [
  { value: 'american_indian_alaska_native', label: 'American Indian or Alaska Native' },
  { value: 'asian', label: 'Asian' },
  { value: 'black_african_american', label: 'Black or African American' },
  { value: 'native_hawaiian_pacific_islander', label: 'Native Hawaiian or Other Pacific Islander' },
  { value: 'white', label: 'White' },
] as const;

export const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'non_binary', label: 'Non-binary' },
  { value: 'self_describe', label: 'Prefer to self-describe' },
  { value: 'declined', label: 'Decline to answer' },
] as const;

export const VETERAN_OPTIONS = [
  { value: 'protected_veteran', label: 'I identify as one or more of the classifications of a protected veteran' },
  { value: 'not_veteran', label: 'I am not a protected veteran' },
  { value: 'declined', label: 'I do not wish to answer' },
] as const;

export const DISABILITY_OPTIONS = [
  { value: 'yes', label: 'Yes, I have a disability, or have had one in the past' },
  { value: 'no', label: 'No, I do not have a disability and have not had one in the past' },
  { value: 'declined', label: 'I do not want to answer' },
] as const;

export const YES_NO_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
] as const;

// Standard disclosure shown above the voluntary self-id section.
export const VOLUNTARY_DISCLOSURE = `Completion of the following questions is voluntary. Your answers will not affect any application or hiring decision and are not visible to employers on InternFirst. The information is collected so you do not need to re-enter it on every application.`;

// Statutory text from OFCCP Form CC-305 (OMB Control Number 1250-0005)
// for the disability question. Required to appear verbatim above the question.
export const DISABILITY_DISCLOSURE = `Why are you being asked to complete this form?

We are a federal contractor or subcontractor. The law requires us to provide equal employment opportunity to qualified people with disabilities. We have a goal of having at least 7% of our workers as people with disabilities. The law says we must measure our progress towards this goal. To do this, we must ask applicants and employees if they have a disability or have ever had one. People can become disabled, so we need to ask this question at least every five years.

Completing this form is voluntary, and we hope that you will choose to do so. Your answer is confidential. No one who makes hiring decisions will see it. Your decision to complete the form and your answer will not harm you in any way. If you want to learn more about the law or this form, visit the U.S. Department of Labor's Office of Federal Contract Compliance Programs (OFCCP) website at www.dol.gov/ofccp.`;
