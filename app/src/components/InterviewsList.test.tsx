import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InterviewsList, { type InterviewListItem } from './InterviewsList';

const min = (n: number) => n * 60_000;
const item = (over: Partial<InterviewListItem>): InterviewListItem => ({
  id: 'iv1',
  applicationId: 'app1',
  counterpart: 'Acme Corp',
  jobTitle: 'Data Intern',
  meetingType: 'interview',
  scheduledAt: new Date(Date.now() + min(120)).toISOString(),
  durationMinutes: 30,
  format: 'internfirst',
  ...over,
});

afterEach(() => vi.useRealTimers());

describe('InterviewsList — the Join button', () => {
  it('links the InternFirst room with a clear Join button, and says when the room opens', () => {
    render(<InterviewsList role="student" variant="upcoming" interviews={[item({})]} emptyText="none" />);
    const join = screen.getByRole('link', { name: /join interview/i });
    expect(join).toHaveAttribute('href', '/dashboard/student/interviews/iv1');
    expect(screen.getByText(/room opens at/i)).toBeInTheDocument();
    expect(screen.queryByText(/happening now/i)).not.toBeInTheDocument();
  });

  it('goes green and says "now" once the window is open', () => {
    render(
      <InterviewsList
        role="employer"
        variant="upcoming"
        interviews={[item({ meetingType: 'screening', scheduledAt: new Date(Date.now() - min(2)).toISOString() })]}
        emptyText="none"
      />,
    );
    const join = screen.getByRole('link', { name: /join screening now/i });
    expect(join).toHaveAttribute('data-live', 'true');
    expect(join).toHaveAttribute('href', '/dashboard/employer/interviews/iv1');
    expect(screen.getByText(/happening now/i)).toBeInTheDocument();
  });

  it('opens the employer’s own link in a new tab', () => {
    render(
      <InterviewsList
        role="student"
        variant="upcoming"
        interviews={[item({ format: 'external_link', meetingUrl: 'https://meet.example.com/abc' })]}
        emptyText="none"
      />,
    );
    const join = screen.getByRole('link', { name: /join interview/i });
    expect(join).toHaveAttribute('href', 'https://meet.example.com/abc');
    expect(join).toHaveAttribute('target', '_blank');
  });

  it('has no Join button for a phone screen', () => {
    render(<InterviewsList role="student" variant="upcoming" interviews={[item({ format: 'phone' })]} emptyText="none" />);
    expect(screen.queryByRole('link', { name: /join/i })).not.toBeInTheDocument();
    expect(screen.getByText(/phone call/i)).toBeInTheDocument();
  });

  it('past meetings have no Join button, but the employer can still open the application', async () => {
    const onOpen = vi.fn();
    render(
      <InterviewsList
        role="employer"
        variant="past"
        interviews={[item({ scheduledAt: new Date(Date.now() - min(24 * 60)).toISOString() })]}
        onOpenApplication={onOpen}
        emptyText="none"
      />,
    );
    expect(screen.queryByRole('link', { name: /join/i })).not.toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /open application/i }));
    expect(onOpen).toHaveBeenCalledWith('app1');
  });

  it('shows the empty text when there is nothing in the tab', () => {
    render(<InterviewsList role="student" variant="past" interviews={[]} emptyText="No past interviews yet." />);
    expect(screen.getByText('No past interviews yet.')).toBeInTheDocument();
  });
});
