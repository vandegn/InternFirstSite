'use client';

import { useCallback } from 'react';

// Textarea that grows to fit its content. Extracted from the new-listing page
// so the listing editors can share it.
export default function AutoResizeTextarea({ id, placeholder, required, rows, value, onChange, style }: {
  id?: string;
  placeholder: string;
  required?: boolean;
  rows: number;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  style?: React.CSSProperties;
}) {
  const ref = useCallback((node: HTMLTextAreaElement | null) => {
    if (node) {
      node.style.height = 'auto';
      node.style.height = node.scrollHeight + 2 + 'px';
    }
  }, [value]);

  return (
    <textarea
      ref={ref}
      id={id}
      placeholder={placeholder}
      required={required}
      rows={rows}
      value={value}
      onChange={onChange}
      style={style}
    />
  );
}
