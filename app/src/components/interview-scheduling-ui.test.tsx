import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// The components talk to Supabase through these helpers; everything else in
// lib/supabase.ts pulls in a browser client we don't want in jsdom.
const getAvailabilityRequest = vi.fn();
const selectInterviewSlot = vi.fn();
const getApplicationForReview = vi.fn();
const getApplicationScheduling = vi.fn();
const requestInterviewTimes = vi.fn();
const confirmInterviewTime = vi.fn();
const withdrawInterviewRequest = vi.fn();
vi.mock('@/lib/supabase', () => ({
  getAvailabilityRequest: (...args: unknown[]) => getAvailabilityRequest(...args),
  selectInterviewSlot: (...args: unknown[]) => selectInterviewSlot(...args),
  getApplicationForReview: (...args: unknown[]) => getApplicationForReview(...args),
  getApplicationScheduling: (...args: unknown[]) => getApplicationScheduling(...args),
  requestInterviewTimes: (...args: unknown[]) => requestInterviewTimes(...args),
  confirmInterviewTime: (...args: unknown[]) => confirmInterviewTime(...args),
  withdrawInterviewRequest: (...args: unknown[]) => withdrawInterviewRequest(...args),
}));

import RequestTimesModal from './RequestTimesModal';
import AvailabilityRequestCard from './AvailabilityRequestCard';
import ConfirmMeetingModal from './ConfirmMeetingModal';
import CandidateApplicationModal from './CandidateApplicationModal';
import {
  slotsForRange,
  formatMeetingWhen,
  localTimeZone,
  type AvailabilityRequest,
  type AvailabilitySlot,
} from '@/lib/interview-availability';

// Fixed "now" so the date defaults and the not-in-the-past rule are stable.
const NOW = new Date('2026-09-01T12:00:00');

type LoadedRequest = AvailabilityRequest & {
  listing: { id: string; title: string } | null;
  employer: { id: string; company_name: string; logo_url: string | null } | null;
};

// 1:00–3:00 PM on Sep 7 at 30 minutes, plus 10:00 on Sep 9.
function offeredSlots(): AvailabilitySlot[] {
  return [
    ...slotsForRange({ date: '2026-09-07', startMinute: 13 * 60, endMinute: 15 * 60 }, 30),
    ...slotsForRange({ date: '2026-09-09', startMinute: 10 * 60, endMinute: 10 * 60 + 30 }, 30),
  ].map((s, i) => ({ ...s, id: `slot-${i}` }));
}

function baseRequest(overrides: Partial<LoadedRequest> = {}): LoadedRequest {
  return {
    listing: { id: 'listing-1', title: 'Data Analyst Intern' },
    employer: { id: 'employer-1', company_name: 'Northwind Labs', logo_url: null },
    id: 'request-1',
    application_id: 'application-1',
    employer_id: 'employer-1',
    student_id: 'student-1',
    listing_id: 'listing-1',
    window_start: '2026-09-07',
    window_end: '2026-09-11',
    status: 'awaiting_student',
    duration_minutes: 30,
    employer_note: 'You’ll meet with the data team.',
    student_note: null,
    student_timezone: null,
    message_id: 'message-1',
    interview_id: null,
    requested_at: '2026-09-01T00:00:00.000Z',
    responded_at: null,
    scheduled_at_confirmed: null,
    meeting_type: 'interview',
    selected_slot_id: null,
    slots: offeredSlots(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ shouldAdvanceTime: true, now: NOW });
});

// ============================================
// Step 1 — employer: specific time slots
// ============================================
describe('Step 1 — RequestTimesModal', () => {
  it('cuts the availability into meeting-length slots and sends them', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <RequestTimesModal
        open
        onClose={() => {}}
        onSubmit={onSubmit}
        candidateName="Casey Rivera"
        listingTitle="Data Analyst Intern"
        meetingType="screening"
      />,
    );

    expect(screen.getByText('Request Time — Screening')).toBeInTheDocument();
    expect(screen.getByText('Casey Rivera · Data Analyst Intern')).toBeInTheDocument();
    // The zone is always on screen.
    expect(screen.getByTestId('request-timezone')).toHaveTextContent(localTimeZone());
    // No broad Morning / Afternoon / Evening buckets any more.
    expect(screen.queryByText(/^Morning$|^Afternoon$|^Early evening$/)).not.toBeInTheDocument();

    // The default availability is 1:00–3:00 PM: four 30-minute slots.
    await user.click(screen.getByRole('button', { name: 'Send 4 times' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const payload = onSubmit.mock.calls[0][0];
    expect(payload.durationMinutes).toBe(30);
    expect(payload.windowStart).toBe('2026-09-02');
    expect(payload.slots).toHaveLength(4);
    expect(payload.slots.map((s: AvailabilitySlot) => new Date(s.starts_at).getHours() * 60 + new Date(s.starts_at).getMinutes()))
      .toEqual([780, 810, 840, 870]);
  });

  it('re-cuts the slots when the meeting length changes', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<RequestTimesModal open onClose={() => {}} onSubmit={onSubmit} />);

    await user.click(screen.getByRole('button', { name: '60 min' }));
    await user.click(screen.getByRole('button', { name: 'Send 2 times' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0].durationMinutes).toBe(60);
    expect(onSubmit.mock.calls[0][0].slots).toHaveLength(2);
  });

  it('lets the employer untick individual slots', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<RequestTimesModal open onClose={() => {}} onSubmit={onSubmit} />);

    const chips = screen.getAllByRole('button', { pressed: true }).filter(b => /to/.test(b.getAttribute('aria-label') ?? ''));
    expect(chips).toHaveLength(4);
    await user.click(chips[1]);
    expect(chips[1]).toHaveAttribute('aria-pressed', 'false');

    await user.click(screen.getByRole('button', { name: 'Send 3 times' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0].slots).toHaveLength(3);
  });

  it('refuses to submit a window that starts in the past', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onSubmit = vi.fn();
    render(<RequestTimesModal open onClose={() => {}} onSubmit={onSubmit} />);

    const start = screen.getByLabelText('Start date');
    await user.clear(start);
    await user.type(start, '2026-08-01');

    expect(await screen.findByRole('alert')).toHaveTextContent(/cannot start in the past/i);
    expect(screen.getByRole('button', { name: /^Send/ })).toBeDisabled();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

// ============================================
// Step 2 — student: pick one slot (tentative)
// ============================================
describe('Step 2 — AvailabilityRequestCard', () => {
  it('lets the student pick one offered slot', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    getAvailabilityRequest.mockResolvedValue(baseRequest());
    const slots = offeredSlots();
    selectInterviewSlot.mockResolvedValue(baseRequest({ status: 'awaiting_employer', selected_slot_id: slots[1].id }));

    render(<AvailabilityRequestCard requestId="request-1" canRespond />);

    await screen.findByText('Interview time');
    expect(screen.getByText(/Times shown in your time zone/)).toHaveTextContent(localTimeZone());

    const options = screen.getAllByRole('radio');
    expect(options).toHaveLength(5);
    await user.click(options[1]);
    expect(options[1]).toHaveAttribute('aria-checked', 'true');
    // Picking another replaces the first — one slot only.
    await user.click(options[2]);
    expect(options[1]).toHaveAttribute('aria-checked', 'false');
    await user.click(options[1]);

    await user.click(screen.getByRole('button', { name: 'Select this time' }));

    await waitFor(() => expect(selectInterviewSlot).toHaveBeenCalledTimes(1));
    expect(selectInterviewSlot.mock.calls[0]).toEqual(['request-1', { slotId: slots[1].id, note: '' }]);

    // Tentative until the employer confirms.
    expect(await screen.findByText(`Selected ${formatMeetingWhen(slots[1].starts_at, localTimeZone())}`)).toBeInTheDocument();
    expect(screen.getByText(/Tentative — Northwind Labs still needs to confirm it/)).toBeInTheDocument();
  });

  it('submits "none of these work" as an explicit outcome', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    getAvailabilityRequest.mockResolvedValue(baseRequest());
    selectInterviewSlot.mockResolvedValue(baseRequest({ status: 'no_availability' }));

    render(<AvailabilityRequestCard requestId="request-1" canRespond />);
    await screen.findByText('Interview time');

    await user.type(screen.getByPlaceholderText(/anything they should know/i), 'I’m abroad that week.');
    await user.click(screen.getByRole('button', { name: /none of these work/i }));
    expect(selectInterviewSlot).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /yes, none work/i }));

    await waitFor(() => expect(selectInterviewSlot).toHaveBeenCalledTimes(1));
    expect(selectInterviewSlot.mock.calls[0][1]).toMatchObject({ noneWork: true, note: 'I’m abroad that week.' });
    await screen.findByText(/none of these times work/i);
  });

  it('shows the employer the same card read-only', async () => {
    getAvailabilityRequest.mockResolvedValue(baseRequest());
    render(<AvailabilityRequestCard requestId="request-1" canRespond={false} />);
    await screen.findByText('Interview time');
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(screen.getByText(/awaiting the candidate’s selection/i)).toBeInTheDocument();
  });

  it('explains itself when the request has been withdrawn', async () => {
    getAvailabilityRequest.mockResolvedValue(null);
    render(<AvailabilityRequestCard requestId="request-1" canRespond />);
    expect(await screen.findByText(/no longer available/i)).toBeInTheDocument();
  });
});

// ============================================
// Step 3 — employer: confirm
// ============================================
describe('Step 3 — ConfirmMeetingModal', () => {
  it('shows the selected time prominently and confirms with a format', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const slot = offeredSlots()[1];
    const request = baseRequest({ status: 'awaiting_employer', selected_slot_id: slot.id });
    const onConfirm = vi.fn().mockResolvedValue(undefined);

    render(
      <ConfirmMeetingModal
        open
        onClose={() => {}}
        request={request}
        slot={slot}
        meetingType="screening"
        onConfirm={onConfirm}
        onWithdraw={() => {}}
      />,
    );

    expect(screen.getByText(`Selected ${formatMeetingWhen(slot.starts_at, localTimeZone())}`)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Confirm Screening' }));

    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
    expect(onConfirm.mock.calls[0][0]).toMatchObject({ format: 'internfirst', meetingUrl: null, meetingType: 'screening' });
  });

  it('withdraws when the employer can no longer make the pick', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const slot = offeredSlots()[0];
    const onWithdraw = vi.fn().mockResolvedValue(undefined);
    render(
      <ConfirmMeetingModal
        open
        onClose={() => {}}
        request={baseRequest({ status: 'awaiting_employer', selected_slot_id: slot.id })}
        slot={slot}
        meetingType="interview"
        onConfirm={() => {}}
        onWithdraw={onWithdraw}
      />,
    );
    await user.click(screen.getByRole('button', { name: /withdraw & send new times/i }));
    await waitFor(() => expect(onWithdraw).toHaveBeenCalledTimes(1));
  });
});

// ============================================
// The expanded application modal — scheduling visibility rules
// ============================================
function reviewApp(stage: { stage_type: string; label: string }) {
  return {
    id: 'application-1',
    status: stage.label,
    stage_id: 'stage-1',
    match_score: 82,
    flagged_knockout: false,
    applied_at: '2026-08-20T00:00:00Z',
    updated_at: '2026-08-20T00:00:00Z',
    resume: { id: 'resume-1', name: 'casey.pdf' },
    answers: [{
      id: 'answer-1', answer_text: 'Because I love data.', answer_options: null, storage_path: null,
      question: { id: 'q1', prompt: 'Why this role?', question_type: 'text', position: 0 },
    }],
    listing: { id: 'listing-1', title: 'Data Analyst Intern', employer_id: 'employer-1', industry: 'Technology', preferred_skills: ['SQL', 'Python'] },
    stage: { id: 'stage-1', listing_id: 'listing-1', label: stage.label, color_bg: '#eee', color_text: '#333', position: 1, stage_type: stage.stage_type, locked: false },
    student: { id: 'student-1', user_id: 'user-student' },
    profile: {
      id: 'student-1', major: 'Statistics', minor: null, school_name: 'State University', school_state: 'NC',
      graduation_year: 2027, gpa: 3.8, bio: 'Numbers person.', linkedin_url: null, portfolio_url: null,
      profile: { full_name: 'Casey Rivera', email: 'casey@state.edu', avatar_url: null },
      skills: [{ id: 'k1', name: 'SQL' }, { id: 'k2', name: 'Excel' }],
      experiences: [{ id: 'e1', type: 'internship', title: 'Analyst Intern', organization: 'Acme', location: null, description: 'Built dashboards.', technologies: null, link: null, start_date: '2025-06-01', end_date: '2025-08-01', is_current: false }],
      organizations: [],
      certifications: [],
    },
  };
}

describe('CandidateApplicationModal', () => {
  it('shows the full application in clear sections', async () => {
    getApplicationForReview.mockResolvedValue(reviewApp({ stage_type: 'interviewing', label: 'Interview 1' }));
    getApplicationScheduling.mockResolvedValue({ request: null, interview: null });

    render(<CandidateApplicationModal applicationId="application-1" onClose={() => {}} />);

    expect(await screen.findByRole('dialog', { name: "Casey Rivera's application" })).toBeInTheDocument();
    for (const heading of ['Match', 'Profile & education', 'Experience', 'Skills', 'Resume & documents', 'Screening & application questions']) {
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
    }
    expect(screen.getByText('82%')).toBeInTheDocument();
    expect(screen.getByText(/1 of 2/)).toBeInTheDocument();
    expect(screen.getByText('Why this role?')).toBeInTheDocument();
    expect(screen.getByText('Resume — casey.pdf')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('closes from the close button', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    getApplicationForReview.mockResolvedValue(reviewApp({ stage_type: 'interviewing', label: 'Interview 1' }));
    getApplicationScheduling.mockResolvedValue({ request: null, interview: null });
    const onClose = vi.fn();
    render(<CandidateApplicationModal applicationId="application-1" onClose={onClose} />);
    await screen.findByText('Profile & education');
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('hides scheduling outside Screening and Interview stages', async () => {
    getApplicationForReview.mockResolvedValue(reviewApp({ stage_type: 'reviewing', label: 'Under Review' }));
    getApplicationScheduling.mockResolvedValue({ request: null, interview: null });
    render(<CandidateApplicationModal applicationId="application-1" onClose={() => {}} />);
    await screen.findByText('Profile & education');
    expect(screen.queryByRole('button', { name: 'Request Time' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Confirm/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /schedule interview/i })).not.toBeInTheDocument();
  });

  it('Screening stage, nothing requested: Request Time is the one action', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    getApplicationForReview.mockResolvedValue(reviewApp({ stage_type: 'screening', label: 'Phone Screening' }));
    getApplicationScheduling.mockResolvedValue({ request: null, interview: null });
    requestInterviewTimes.mockResolvedValue(baseRequest());

    render(<CandidateApplicationModal applicationId="application-1" onClose={() => {}} />);
    await user.click(await screen.findByRole('button', { name: 'Request Time' }));
    expect(screen.queryByRole('button', { name: /^Confirm/ })).not.toBeInTheDocument();

    // Opens the slot picker over the application.
    expect(await screen.findByText('Request Time — Screening')).toBeInTheDocument();
    getApplicationScheduling.mockResolvedValue({ request: baseRequest({ meeting_type: 'screening' }), interview: null });
    await user.click(screen.getByRole('button', { name: 'Send 4 times' }));

    await waitFor(() => expect(requestInterviewTimes).toHaveBeenCalledTimes(1));
    expect(requestInterviewTimes.mock.calls[0][0]).toMatchObject({ applicationId: 'application-1', durationMinutes: 30 });
    // Back on the application: the status is now Awaiting Student Selection.
    expect((await screen.findAllByText('Awaiting Student Selection')).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Request Time' })).not.toBeInTheDocument();
  });

  it('after the student picks: shows "Selected …" at the top and Confirm Interview instead of Request Time', async () => {
    const slot = offeredSlots()[2];
    getApplicationForReview.mockResolvedValue(reviewApp({ stage_type: 'interviewing', label: 'Interview 1' }));
    getApplicationScheduling.mockResolvedValue({
      request: baseRequest({ status: 'awaiting_employer', selected_slot_id: slot.id }),
      interview: null,
    });

    render(<CandidateApplicationModal applicationId="application-1" onClose={() => {}} />);

    const banner = await screen.findByTestId('selected-banner');
    expect(banner).toHaveTextContent(`Selected ${formatMeetingWhen(slot.starts_at, localTimeZone())}`);
    expect(screen.getByRole('button', { name: 'Confirm Interview' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Request Time' })).not.toBeInTheDocument();
  });

  it('after confirmation: shows the confirmed meeting details', async () => {
    getApplicationForReview.mockResolvedValue(reviewApp({ stage_type: 'interviewing', label: 'Interview 1' }));
    getApplicationScheduling.mockResolvedValue({
      request: baseRequest({ status: 'scheduled' }),
      interview: {
        id: 'interview-1', status: 'accepted', scheduled_at: offeredSlots()[0].starts_at, duration_minutes: 30,
        format: 'external_link', meeting_url: 'https://zoom.us/j/1', meeting_type: 'interview',
      },
    });

    render(<CandidateApplicationModal applicationId="application-1" onClose={() => {}} />);
    const banner = await screen.findByTestId('confirmed-banner');
    expect(banner).toHaveTextContent('Interview confirmed');
    expect(banner).toHaveTextContent('30 min');
    expect(banner).toHaveTextContent('https://zoom.us/j/1');
    expect(screen.queryByRole('button', { name: 'Request Time' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Confirm/ })).not.toBeInTheDocument();
  });
});
