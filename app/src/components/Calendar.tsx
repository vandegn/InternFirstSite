'use client';

import { useState, useMemo } from 'react';

/* ── Types ── */
export type CalendarEvent = {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  type: string; // 'interview' | 'career_fair' | 'info_session' | 'deadline' | 'appointment' | 'event'
  time?: string; // HH:MM
  location?: string;
  color?: string; // override dot color
};

export type CalendarProps = {
  events: CalendarEvent[];
  onDateSelect?: (date: string) => void;
  onEventClick?: (event: CalendarEvent) => void;
};

/* ── Constants ── */
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const EVENT_TYPE_COLORS: Record<string, string> = {
  interview: '#2563eb',
  career_fair: '#9FC63C',
  info_session: '#f59e0b',
  deadline: '#ef4444',
  appointment: '#8b5cf6',
  event: '#1A2D49',
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  interview: 'Interview',
  career_fair: 'Career Fair',
  info_session: 'Info Session',
  deadline: 'Deadline',
  appointment: 'Appointment',
  event: 'Event',
};

/* ── Helpers ── */
function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function toDateKey(year: number, month: number, day: number): string {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function todayKey(): string {
  const d = new Date();
  return toDateKey(d.getFullYear(), d.getMonth(), d.getDate());
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 || 12;
  return `${hr}:${pad(m)} ${ampm}`;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/* ── Component ── */
export default function Calendar({ events, onDateSelect, onEventClick }: CalendarProps) {
  const today = todayKey();
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  /* Build a map: dateKey -> CalendarEvent[] */
  const eventMap = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const ev of events) {
      if (!map[ev.date]) map[ev.date] = [];
      map[ev.date].push(ev);
    }
    // sort each day's events by time
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''));
    }
    return map;
  }, [events]);

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfWeek(viewYear, viewMonth);
  const prevMonthDays = getDaysInMonth(
    viewMonth === 0 ? viewYear - 1 : viewYear,
    viewMonth === 0 ? 11 : viewMonth - 1,
  );

  /* Navigation */
  function goToPrevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }
  function goToNextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }
  function goToToday() {
    const d = new Date();
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    handleDateClick(todayKey());
  }

  function handleDateClick(dateKey: string) {
    setSelectedDate(dateKey);
    onDateSelect?.(dateKey);
  }

  function dotColor(ev: CalendarEvent): string {
    return ev.color ?? EVENT_TYPE_COLORS[ev.type] ?? EVENT_TYPE_COLORS.event;
  }

  /* Build grid cells */
  const cells: { day: number; dateKey: string; inMonth: boolean }[] = [];

  // leading days from previous month
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = prevMonthDays - i;
    const m = viewMonth === 0 ? 11 : viewMonth - 1;
    const y = viewMonth === 0 ? viewYear - 1 : viewYear;
    cells.push({ day: d, dateKey: toDateKey(y, m, d), inMonth: false });
  }
  // current month
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, dateKey: toDateKey(viewYear, viewMonth, d), inMonth: true });
  }
  // trailing days from next month
  const remaining = 7 - (cells.length % 7);
  if (remaining < 7) {
    const m = viewMonth === 11 ? 0 : viewMonth + 1;
    const y = viewMonth === 11 ? viewYear + 1 : viewYear;
    for (let d = 1; d <= remaining; d++) {
      cells.push({ day: d, dateKey: toDateKey(y, m, d), inMonth: false });
    }
  }

  const selectedEvents = selectedDate ? (eventMap[selectedDate] ?? []) : [];

  return (
    <div style={{
      width: '100%',
      background: '#fff',
      borderRadius: 'var(--radius)',
      border: '1px solid var(--border)',
      boxShadow: 'var(--shadow)',
      overflow: 'hidden',
    }}>
      {/* ── Header ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 20px',
        borderBottom: '1px solid var(--border)',
      }}>
        <button onClick={goToPrevMonth} aria-label="Previous month" style={navBtnStyle}>
          <ChevronLeft />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{
            fontSize: 18,
            fontWeight: 600,
            color: 'var(--primary)',
          }}>
            {MONTH_NAMES[viewMonth]} {viewYear}
          </span>
          <button onClick={goToToday} style={{
            fontSize: 12,
            fontWeight: 500,
            padding: '3px 10px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
            background: 'var(--bg)',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            transition: 'var(--transition)',
          }}>
            Today
          </button>
        </div>

        <button onClick={goToNextMonth} aria-label="Next month" style={navBtnStyle}>
          <ChevronRight />
        </button>
      </div>

      {/* ── Day-of-week headers ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        borderBottom: '1px solid var(--border)',
      }}>
        {DAY_LABELS.map(label => (
          <div key={label} style={{
            textAlign: 'center',
            padding: '10px 0',
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            {label}
          </div>
        ))}
      </div>

      {/* ── Calendar grid ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
      }}>
        {cells.map((cell, idx) => {
          const isToday = cell.dateKey === today;
          const isSelected = cell.dateKey === selectedDate;
          const dayEvents = eventMap[cell.dateKey] ?? [];
          const hasEvents = dayEvents.length > 0;

          return (
            <button
              key={idx}
              onClick={() => handleDateClick(cell.dateKey)}
              style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-start',
                paddingTop: 10,
                paddingBottom: 6,
                minHeight: 64,
                border: 'none',
                borderRight: (idx + 1) % 7 !== 0 ? '1px solid var(--border)' : 'none',
                borderBottom: idx < cells.length - 7 ? '1px solid var(--border)' : 'none',
                background: isSelected
                  ? 'var(--primary-light)'
                  : isToday
                    ? 'rgba(159,198,60,0.08)'
                    : '#fff',
                cursor: 'pointer',
                transition: 'var(--transition)',
                outline: 'none',
              }}
              onMouseEnter={e => {
                if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'var(--bg)';
              }}
              onMouseLeave={e => {
                if (!isSelected) (e.currentTarget as HTMLElement).style.background =
                  isToday ? 'rgba(159,198,60,0.08)' : '#fff';
              }}
            >
              <span style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 30,
                height: 30,
                borderRadius: '50%',
                fontSize: 14,
                fontWeight: isToday ? 700 : cell.inMonth ? 500 : 400,
                color: isToday
                  ? '#fff'
                  : isSelected
                    ? 'var(--primary)'
                    : cell.inMonth
                      ? 'var(--text)'
                      : 'var(--text-light)',
                background: isToday ? 'var(--accent)' : 'transparent',
              }}>
                {cell.day}
              </span>

              {/* Event dots */}
              {hasEvents && (
                <div style={{
                  display: 'flex',
                  gap: 3,
                  marginTop: 4,
                  flexWrap: 'wrap',
                  justifyContent: 'center',
                  maxWidth: '100%',
                  overflow: 'hidden',
                }}>
                  {dayEvents.slice(0, 4).map((ev, i) => (
                    <span key={i} style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: dotColor(ev),
                      flexShrink: 0,
                    }} />
                  ))}
                  {dayEvents.length > 4 && (
                    <span style={{
                      fontSize: 9,
                      color: 'var(--text-secondary)',
                      lineHeight: '6px',
                      fontWeight: 600,
                    }}>
                      +{dayEvents.length - 4}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Event detail panel ── */}
      {selectedDate && selectedEvents.length > 0 && (
        <div style={{
          borderTop: '1px solid var(--border)',
          padding: '16px 20px',
          background: 'var(--bg)',
        }}>
          <h4 style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: 12,
          }}>
            {formatSelectedDate(selectedDate)}
            <span style={{ fontWeight: 400, marginLeft: 8 }}>
              {selectedEvents.length} event{selectedEvents.length !== 1 ? 's' : ''}
            </span>
          </h4>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {selectedEvents.map(ev => (
              <button
                key={ev.id}
                onClick={() => onEventClick?.(ev)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  padding: '12px 14px',
                  background: '#fff',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  cursor: onEventClick ? 'pointer' : 'default',
                  textAlign: 'left',
                  width: '100%',
                  transition: 'var(--transition)',
                }}
                onMouseEnter={e => {
                  if (onEventClick) (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-md)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                }}
              >
                {/* Color bar */}
                <span style={{
                  width: 4,
                  minHeight: 36,
                  borderRadius: 2,
                  background: dotColor(ev),
                  flexShrink: 0,
                  marginTop: 1,
                }} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: 'var(--text)',
                    marginBottom: 2,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {ev.title}
                  </div>
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '4px 14px',
                    fontSize: 12,
                    color: 'var(--text-secondary)',
                  }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '1px 8px',
                      borderRadius: 9999,
                      background: `${dotColor(ev)}18`,
                      color: dotColor(ev),
                      fontWeight: 600,
                      fontSize: 11,
                    }}>
                      {EVENT_TYPE_LABELS[ev.type] ?? ev.type}
                    </span>
                    {ev.time && <span>{formatTime(ev.time)}</span>}
                    {ev.location && <span>{ev.location}</span>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Tiny inline SVG icons ── */
function ChevronLeft() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

/* ── Shared styles ── */
const navBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 34,
  height: 34,
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border)',
  background: '#fff',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  transition: 'var(--transition)',
};

function formatSelectedDate(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}
