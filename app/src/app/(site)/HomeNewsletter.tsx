'use client';

import { useState } from 'react';

// Split out of page.tsx for the same reason as HomeFaq: the form owns state, the
// page around it doesn't need to. Still a no-op on submit — see the note in
// page.tsx about wiring this up.
export default function HomeNewsletter() {
  const [email, setEmail] = useState('');

  return (
    <form className="newsletter-form" onSubmit={(e) => e.preventDefault()}>
      <input
        type="email"
        placeholder="you@school.edu"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <button type="submit">Subscribe</button>
    </form>
  );
}
