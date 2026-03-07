'use client';

import React from 'react';

type Role = 'student' | 'employer' | 'university_admin';

const roles: { value: Role; label: string; icon: React.ReactNode }[] = [
  {
    value: 'student',
    label: 'Student',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
        <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5" />
      </svg>
    ),
  },
  {
    value: 'employer',
    label: 'Employer',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2" />
        <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
        <path d="M12 12h.01" />
      </svg>
    ),
  },
  {
    value: 'university_admin',
    label: 'University',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 20h20" />
        <path d="M5 20V10l7-5 7 5v10" />
        <path d="M9 20v-4h6v4" />
        <path d="M10 10h4v3h-4z" />
      </svg>
    ),
  },
];

export default function RoleSelector({
  selected,
  onChange,
}: {
  selected: Role;
  onChange: (role: Role) => void;
}) {
  return (
    <div className="role-selector">
      {roles.map((role) => (
        <div className="role-option" key={role.value}>
          <input
            type="radio"
            name="role"
            id={`role-${role.value}`}
            value={role.value}
            checked={selected === role.value}
            onChange={() => onChange(role.value)}
          />
          <label htmlFor={`role-${role.value}`}>
            <div className="role-icon">{role.icon}</div>
            <span className="role-label-text">{role.label}</span>
          </label>
        </div>
      ))}
    </div>
  );
}
