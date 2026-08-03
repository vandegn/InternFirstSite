import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// The card talks to Supabase through these two helpers; everything else in
// lib/supabase.ts pulls in a browser client we don't want in jsdom.
const getAvailabilityRequest = vi.fn();
const submitStudentAvailability = vi.fn();
vi.mock('@/lib/supabase', () => ({
  getAvailabilityRequest: (...args: unknown[]) => getAvailabilityRequest(...args),
  submitStudentAvailability: (...args: unknown[]) => submitStudentAvailability(...args),
}));

import RequestTimesModal from './RequestTimesModal';
import AvailabilityRequestCard from './AvailabilityRequestCard';
import SelectInterviewTimeModal from './SelectInterviewTimeModal';
import {
  buildSlot,
  formatDayLabel,
  formatTime,
  enumerateStartTimes,
  type AvailabilityRequest,
} from '@/lib/interview-availability';

// Fixed "now" so the date defaults and the not-in-the-past rule are stable.
const NOW = new Date('2026-09-01T12:00:00');

type LoadedRequest = AvailabilityRequest & {
  listing: { id: string; title: string } | null;
  employer: { id: string; company_name: string; logo_url: string | null } | null;
};

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
    window_end: '2026-09-09',
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
    slots: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ shouldAdvanceTime: true, now: NOW });
});

// ============================================
// Step 1 — employer: button click through date-range submission
// ============================================
describe('Step 1 — RequestTimesModal', () => {
  it('submits the interviewing window the employer picked', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <RequestTimesModal
        open
        onClose={() => {}}
        onSubmit={onSubmit}
        candidateName="Casey Rivera"
        listingTitle="Data Analyst Intern"
      />,
    );

    expect(screen.getByText('Request Interview Times')).toBeInTheDocument();
    expect(screen.getByText('Casey Rivera · Data Analyst Intern')).toBeInTheDocument();

    // The employer narrows the default week to a three-day window.
    const start = screen.getByLabelText('Start date');
    const end = screen.getByLabelText('End date');
    await user.clear(start);
    await user.type(start, '2026-09-07');
    await user.clear(end);
    await user.type(end, '2026-09-09');

    await user.click(screen.getByRole('button', { name: 'Send Request' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      windowStart: '2026-09-07',
      windowEnd: '2026-09-09',
      durationMinutes: 30,
      note: '',
    });
  });

  it('carries the interview length and note through', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(<RequestTimesModal open onClose={() => {}} onSubmit={onSubmit} />);

    await user.click(screen.getByRole('button', { name: '45 min' }));
    await user.type(screen.getByPlaceholderText(/who they’ll meet with/i), 'Panel of three.');
    await user.click(screen.getByRole('button', { name: 'Send Request' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      durationMinutes: 45,
      note: 'Panel of three.',
    });
  });

  it('refuses to submit a window that starts in the past', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onSubmit = vi.fn();

    render(<RequestTimesModal open onClose={() => {}} onSubmit={onSubmit} />);

    const start = screen.getByLabelText('Start date');
    await user.clear(start);
    await user.type(start, '2026-08-01');

    expect(await screen.findByRole('alert')).toHaveTextContent(/cannot start in the past/i);
    expect(screen.getByRole('button', { name: 'Send Request' })).toBeDisabled();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

// ============================================
// Step 2 — student: availability submission
// ============================================
describe('Step 2 — AvailabilityRequestCard', () => {
  it('lets the student pick day/time frames and submits them inside the window', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    getAvailabilityRequest.mockResolvedValue(baseRequest());
    submitStudentAvailability.mockResolvedValue(baseRequest({ status: 'awaiting_employer' }));

    render(<AvailabilityRequestCard requestId="request-1" canRespond />);

    await screen.findByText('Interview availability');
    expect(screen.getByText(/You’ll meet with the data team/)).toBeInTheDocument();

    // Every day in the employer's window is offered, and only those days.
    expect(screen.getByText(formatDayLabel('2026-09-07'))).toBeInTheDocument();
    expect(screen.getByText(formatDayLabel('2026-09-09'))).toBeInTheDocument();
    expect(screen.queryByText(formatDayLabel('2026-09-10'))).not.toBeInTheDocument();

    await user.click(screen.getByLabelText(`${formatDayLabel('2026-09-07')} Morning`));
    await user.click(screen.getByLabelText(`${formatDayLabel('2026-09-09')} Afternoon`));
    await user.type(screen.getByPlaceholderText(/anything they should know/i), 'Prefer mornings.');

    await user.click(screen.getByRole('button', { name: /Send 2 times/i }));

    await waitFor(() => expect(submitStudentAvailability).toHaveBeenCalledTimes(1));
    const [requestId, payload] = submitStudentAvailability.mock.calls[0];
    expect(requestId).toBe('request-1');
    expect(payload.note).toBe('Prefer mornings.');
    expect(payload.slots).toHaveLength(2);
    // Frames come back as real instants on the days the student picked.
    expect(payload.slots.map((s: { slot_date: string }) => s.slot_date)).toEqual([
      '2026-09-07',
      '2026-09-09',
    ]);
    expect(payload.slots[0]).toEqual(buildSlot('2026-09-07', 9 * 60, 12 * 60));
    expect(payload.slots[1]).toEqual(buildSlot('2026-09-09', 13 * 60, 17 * 60));

    // The card flips to the sent state rather than staying interactive.
    await screen.findByText('Availability sent');
  });

  it('deselects a frame that was tapped twice', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    getAvailabilityRequest.mockResolvedValue(baseRequest());

    render(<AvailabilityRequestCard requestId="request-1" canRespond />);
    await screen.findByText('Interview availability');

    const morning = screen.getByLabelText(`${formatDayLabel('2026-09-07')} Morning`);
    await user.click(morning);
    expect(morning).toHaveAttribute('aria-pressed', 'true');
    await user.click(morning);
    expect(morning).toHaveAttribute('aria-pressed', 'false');

    // Nothing selected means nothing to send.
    expect(screen.getByRole('button', { name: /^Send time/i })).toBeDisabled();
  });

  // ---- edge case: no availability in the window ----
  it('submits "none of these days work" as an explicit outcome', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    getAvailabilityRequest.mockResolvedValue(baseRequest());
    submitStudentAvailability.mockResolvedValue(baseRequest({ status: 'no_availability' }));

    render(<AvailabilityRequestCard requestId="request-1" canRespond />);
    await screen.findByText('Interview availability');

    await user.type(screen.getByPlaceholderText(/anything they should know/i), 'I’m abroad that week.');
    await user.click(screen.getByRole('button', { name: /none of these days work/i }));

    // Confirmed rather than fired on the first click — it closes the door on
    // the whole window.
    expect(screen.getByText(/we’ll tell northwind labs that nothing in this window works/i)).toBeInTheDocument();
    expect(submitStudentAvailability).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /yes, none work/i }));

    await waitFor(() => expect(submitStudentAvailability).toHaveBeenCalledTimes(1));
    expect(submitStudentAvailability.mock.calls[0][1]).toMatchObject({
      noneWork: true,
      slots: [],
      note: 'I’m abroad that week.',
    });

    await screen.findByText(/none of these dates worked/i);
  });

  it('backs out of the "none work" confirmation without submitting', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    getAvailabilityRequest.mockResolvedValue(baseRequest());

    render(<AvailabilityRequestCard requestId="request-1" canRespond />);
    await screen.findByText('Interview availability');

    await user.click(screen.getByRole('button', { name: /none of these days work/i }));
    await user.click(screen.getByRole('button', { name: /go back/i }));

    expect(screen.queryByRole('button', { name: /yes, none work/i })).not.toBeInTheDocument();
    expect(submitStudentAvailability).not.toHaveBeenCalled();
  });

  it('shows the employer the same card read-only', async () => {
    getAvailabilityRequest.mockResolvedValue(baseRequest());

    render(<AvailabilityRequestCard requestId="request-1" canRespond={false} />);
    await screen.findByText('Interview availability');

    expect(screen.queryByLabelText(`${formatDayLabel('2026-09-07')} Morning`)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /none of these days work/i })).not.toBeInTheDocument();
  });

  it('explains itself when the request has been withdrawn', async () => {
    getAvailabilityRequest.mockResolvedValue(null);

    render(<AvailabilityRequestCard requestId="request-1" canRespond />);

    expect(await screen.findByText(/no longer available/i)).toBeInTheDocument();
  });
});

// ============================================
// Step 3 — employer: final time selection
// ============================================
describe('Step 3 — SelectInterviewTimeModal', () => {
  const offered = [
    buildSlot('2026-09-07', 9 * 60, 12 * 60),
    buildSlot('2026-09-09', 13 * 60, 17 * 60),
  ];
  const respondedRequest = baseRequest({
    status: 'awaiting_employer',
    student_note: 'Wednesdays are easier for me.',
    student_timezone: 'America/New_York',
    slots: offered,
  });

  it('offers only times inside the frames the student gave, and confirms one', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onConfirm = vi.fn().mockResolvedValue(undefined);

    render(
      <SelectInterviewTimeModal
        open
        onClose={() => {}}
        request={respondedRequest}
        candidateName="Casey Rivera"
        listingTitle="Data Analyst Intern"
        onConfirm={onConfirm}
        onRequestNewWindow={() => {}}
      />,
    );

    expect(screen.getByText('Pick an Interview Time')).toBeInTheDocument();
    expect(screen.getByText(/Wednesdays are easier for me/)).toBeInTheDocument();

    // Both offered days are shown with their frame boundaries.
    expect(screen.getByText(formatDayLabel('2026-09-07'))).toBeInTheDocument();
    expect(
      screen.getByText(`Offered ${formatTime(offered[0].starts_at)} – ${formatTime(offered[0].ends_at)}`),
    ).toBeInTheDocument();

    // Every start time listed fits a 30 minute interview inside a frame.
    const expected = [
      ...enumerateStartTimes(offered[0], 30),
      ...enumerateStartTimes(offered[1], 30),
    ];
    const lastStart = expected[enumerateStartTimes(offered[0], 30).length - 1];
    // 11:30 is the last 30-minute start that still ends by noon.
    expect(formatTime(lastStart)).toBe(formatTime(new Date(Date.parse(offered[0].ends_at) - 30 * 60_000).toISOString()));

    const chosen = expected[2];
    await user.click(screen.getByRole('button', { name: formatTime(chosen) }));
    await user.type(screen.getByPlaceholderText(/anything to prepare/i), 'Bring a portfolio.');
    await user.click(screen.getByRole('button', { name: 'Confirm Interview' }));

    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
    expect(onConfirm).toHaveBeenCalledWith({
      scheduledAt: chosen,
      durationMinutes: 30,
      notes: 'Bring a portfolio.',
    });
  });

  it('will not confirm until a time is picked', async () => {
    render(
      <SelectInterviewTimeModal
        open
        onClose={() => {}}
        request={respondedRequest}
        onConfirm={vi.fn()}
        onRequestNewWindow={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Confirm Interview' })).toBeDisabled();
  });

  // ---- edge case: employer re-requests when nothing works ----
  it('lets the employer ask again when none of the offered times work', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onRequestNewWindow = vi.fn().mockResolvedValue(undefined);

    render(
      <SelectInterviewTimeModal
        open
        onClose={() => {}}
        request={respondedRequest}
        onConfirm={vi.fn()}
        onRequestNewWindow={onRequestNewWindow}
      />,
    );

    await user.click(screen.getByRole('button', { name: /none work — ask again/i }));
    await waitFor(() => expect(onRequestNewWindow).toHaveBeenCalledTimes(1));
  });

  // ---- edge case: the student had no availability at all ----
  it('offers only a re-request when the student reported no availability', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onRequestNewWindow = vi.fn().mockResolvedValue(undefined);

    render(
      <SelectInterviewTimeModal
        open
        onClose={() => {}}
        request={baseRequest({ status: 'no_availability', slots: [] })}
        candidateName="Casey Rivera"
        onConfirm={vi.fn()}
        onRequestNewWindow={onRequestNewWindow}
      />,
    );

    expect(screen.getByText('No availability in this window')).toBeInTheDocument();
    // Nothing to confirm, so that button isn't offered at all.
    expect(screen.queryByRole('button', { name: 'Confirm Interview' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /request a new window/i }));
    await waitFor(() => expect(onRequestNewWindow).toHaveBeenCalledTimes(1));
  });

  it('renders nothing without a request', () => {
    const { container } = render(
      <SelectInterviewTimeModal
        open
        onClose={() => {}}
        request={null}
        onConfirm={vi.fn()}
        onRequestNewWindow={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

// ============================================
// The handshake read end to end through the UI
// ============================================
describe('the three steps agree on the same data', () => {
  it('a window picked in step 1 bounds the days offered in step 2 and the times in step 3', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    // Step 1: the employer picks the window.
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { unmount } = render(<RequestTimesModal open onClose={() => {}} onSubmit={onSubmit} />);
    const start = screen.getByLabelText('Start date');
    const end = screen.getByLabelText('End date');
    await user.clear(start);
    await user.type(start, '2026-09-07');
    await user.clear(end);
    await user.type(end, '2026-09-09');
    await user.click(screen.getByRole('button', { name: 'Send Request' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const window = onSubmit.mock.calls[0][0];
    unmount();

    // Step 2: the student's picker is bounded by exactly that window.
    getAvailabilityRequest.mockResolvedValue(
      baseRequest({ window_start: window.windowStart, window_end: window.windowEnd }),
    );
    submitStudentAvailability.mockResolvedValue(baseRequest({ status: 'awaiting_employer' }));
    const { unmount: unmount2 } = render(<AvailabilityRequestCard requestId="request-1" canRespond />);
    await screen.findByText('Interview availability');
    await user.click(screen.getByLabelText(`${formatDayLabel('2026-09-08')} Morning`));
    await user.click(screen.getByRole('button', { name: /Send 1 time/i }));
    await waitFor(() => expect(submitStudentAvailability).toHaveBeenCalled());
    const submitted = submitStudentAvailability.mock.calls[0][1].slots;
    expect(submitted[0].slot_date >= window.windowStart).toBe(true);
    expect(submitted[0].slot_date <= window.windowEnd).toBe(true);
    unmount2();

    // Step 3: every time the employer can pick sits inside what was submitted.
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(
      <SelectInterviewTimeModal
        open
        onClose={() => {}}
        request={baseRequest({ status: 'awaiting_employer', slots: submitted })}
        onConfirm={onConfirm}
        onRequestNewWindow={vi.fn()}
      />,
    );

    const frame = within(screen.getByText(formatDayLabel('2026-09-08')).parentElement!);
    const times = enumerateStartTimes(submitted[0], 30);
    await user.click(frame.getByRole('button', { name: formatTime(times[0]) }));
    await user.click(screen.getByRole('button', { name: 'Confirm Interview' }));

    await waitFor(() => expect(onConfirm).toHaveBeenCalled());
    const picked = Date.parse(onConfirm.mock.calls[0][0].scheduledAt);
    expect(picked).toBeGreaterThanOrEqual(Date.parse(submitted[0].starts_at));
    expect(picked + 30 * 60_000).toBeLessThanOrEqual(Date.parse(submitted[0].ends_at));
  });
});
