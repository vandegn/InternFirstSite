'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, getProfile } from '@/lib/supabase';

// The only interactive part of the listing page, split out so the page itself
// can be a server component. The apply flow is unchanged: work out who the
// visitor is at click time, then route them. Nothing here gates rendering, so
// the listing is fully readable — to a person or a crawler — before this
// component ever hydrates.

export default function ApplyButton({
  listingId,
  className,
  style,
}: {
  listingId: string;
  className: string;
  style?: React.CSSProperties;
}) {
  const router = useRouter();
  const [applying, setApplying] = useState(false);

  async function handleApply() {
    setApplying(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push(`/login?next=${encodeURIComponent(`/internships/${listingId}`)}`);
      return;
    }

    const profile = await getProfile(user.id);
    if (profile?.role === 'student') {
      router.push(`/dashboard/student/internships/${listingId}`);
    } else {
      // Logged in but not a student — send to register (or back home)
      router.push('/register');
    }
  }

  return (
    <button
      onClick={handleApply}
      disabled={applying}
      className={className}
      style={{ border: 'none', cursor: applying ? 'wait' : 'pointer', ...style }}
    >
      {applying ? 'Loading…' : 'Apply Now'}
    </button>
  );
}
