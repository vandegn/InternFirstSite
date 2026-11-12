'use client';

import { useState } from 'react';
import { HOME_FAQ as faqData } from './home-faq-data';

// Split out of page.tsx so the homepage itself can be a server component and
// export metadata. The accordion needs client state, but the questions AND
// answers still ship in the initial HTML — Next server-renders client
// components too, so a crawler reads the full Q&A without running any JS.
// That's deliberate: FAQ text is some of the most quotable content we have for
// AI answer engines, and it would be invisible if we fetched or gated it.

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
