// The public FAQ, as plain data so both the client accordion (HomeFaq.tsx)
// and the server-rendered FAQPage structured data on /faq can read it. It
// lives outside the 'use client' file because a server component importing a
// client module gets client references, not the array.
//
// This text is some of the most quotable content InternFirst has for AI answer
// engines: each entry is a direct question with a direct answer. Keep answers
// self-contained — an engine may quote one without the others.
export type FaqEntry = { question: string; answer: string };

export const HOME_FAQ: FaqEntry[] = [
  {
    question: 'Do I need an account to browse internships?',
    answer:
      'No. Anyone can browse open internships on InternFirst without signing up. You only need to create an account when you want to apply, message an employer, or save listings to your profile.',
  },
  {
    question: 'Who can apply on InternFirst?',
    answer:
      'Students with a valid .edu email address can register and apply. We verify every student account to keep the platform high-signal for employers and universities.',
  },
  {
    question: 'How long does the application process take?',
    answer:
      'Most students complete their first application in under five minutes once their profile is set up. Employers respond inside the platform — no external emails, no off-platform redirects.',
  },
  {
    question: 'Is InternFirst free for students?',
    answer:
      'Yes. Students apply, message, schedule interviews, and track outcomes at no cost.',
  },
  {
    question: 'How are employers verified?',
    answer:
      'Our team reviews every employer account before its listings reach students. Until that review clears, a company cannot see applicants or their information.',
  },
  {
    question: 'Where does InternFirst operate?',
    answer:
      'The United States only, for now. Every listing on the platform is a U.S.-based or U.S.-remote role, and registration is open to students at U.S. institutions. We are not accepting international students or employers yet.',
  },
  {
    question: 'What if my school email is not a .edu address?',
    answer:
      'A .edu email is required to register as a student today, because it is how we verify enrollment. If your institution issues a different domain, contact us and we will look at your account individually — but we cannot promise an exception yet.',
  },
  {
    question: 'What does InternFirst cost employers?',
    answer:
      'Nothing during the current pilot. Employers post roles, review applicants, message students, schedule interviews and extend offers at no charge while the pilot runs. We will give existing employers notice before any of that changes.',
  },
];
