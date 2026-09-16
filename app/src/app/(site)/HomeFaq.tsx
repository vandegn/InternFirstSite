'use client';

import { useState } from 'react';

// Split out of page.tsx so the homepage itself can be a server component and
// export metadata. The accordion needs client state, but the questions AND
// answers still ship in the initial HTML — Next server-renders client
// components too, so a crawler reads the full Q&A without running any JS.
// That's deliberate: FAQ text is some of the most quotable content we have for
// AI answer engines, and it would be invisible if we fetched or gated it.

const faqData = [
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

export default function HomeFaq() {
  const [activeFaq, setActiveFaq] = useState<number | null>(0);

  return (
    <div className="faq-list">
      {faqData.map((faq, index) => (
        <div key={index} className={`faq-item${activeFaq === index ? ' active' : ''}`}>
          <button
            className="faq-question"
            onClick={() => setActiveFaq(activeFaq === index ? null : index)}
          >
            <span>{faq.question}</span>
            <svg
              className="faq-icon"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <div className="faq-answer">
            <p>{faq.answer}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
