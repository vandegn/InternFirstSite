'use client';

import { COMP_TYPES, formatCompensation, type CompType, type CompensationInput } from '@/lib/constants';

// Form state keeps the amounts as typed strings so the inputs behave normally
// ("15.", "1,5" mid-keystroke). They're converted to the integer cents the
// comp_* columns store only at save time, via compToCents().
export type CompensationValue = {
  comp_type: CompType | '';
  comp_min: string;
  comp_max: string;
  comp_note: string;
};

export const EMPTY_COMPENSATION: CompensationValue = {
  comp_type: '',
  comp_min: '',
  comp_max: '',
  comp_note: '',
};

function dollarsToCents(input: string): number | null {
  const cleaned = input.replace(/[^0-9.]/g, '');
  if (!cleaned) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

function centsToDollars(cents: number | null | undefined): string {
  if (cents == null) return '';
  return String(cents % 100 === 0 ? cents / 100 : (cents / 100).toFixed(2));
}

// Form state -> the columns written to internship_listings.
export function compToCents(value: CompensationValue): CompensationInput {
  const unpaid = value.comp_type === 'unpaid';
  return {
    comp_type: value.comp_type || null,
    comp_min_cents: unpaid ? null : dollarsToCents(value.comp_min),
    comp_max_cents: unpaid ? null : dollarsToCents(value.comp_max),
    comp_note: value.comp_note.trim() || null,
  };
}

// A loaded listing row -> form state, for the edit page.
export function compFromListing(listing: {
  comp_type?: string | null;
  comp_min_cents?: number | null;
  comp_max_cents?: number | null;
  comp_note?: string | null;
  compensation?: string | null;
}): CompensationValue {
  if (!listing.comp_type) {
    // Listing predates the structured columns — only the free-text display
    // string exists. Carry it over so an edit-and-save doesn't blank it out.
    const legacy = listing.compensation?.trim();
    if (!legacy) return EMPTY_COMPENSATION;
    if (legacy === 'Unpaid') return { ...EMPTY_COMPENSATION, comp_type: 'unpaid' };
    return { ...EMPTY_COMPENSATION, comp_type: 'other', comp_note: legacy };
  }

  return {
    comp_type: (listing.comp_type as CompType) || '',
    comp_min: centsToDollars(listing.comp_min_cents),
    comp_max: centsToDollars(listing.comp_max_cents),
    comp_note: listing.comp_note || '',
  };
}

// The display string stored in the legacy `compensation` column.
export function compDisplayString(value: CompensationValue): string | null {
  return formatCompensation(compToCents(value));
}

export default function CompensationFields({ value, onChange }: {
  value: CompensationValue;
  onChange: (value: CompensationValue) => void;
}) {
  const showAmounts = value.comp_type !== '' && value.comp_type !== 'unpaid' && value.comp_type !== 'other';
  const preview = compDisplayString(value);
  const selectedType = COMP_TYPES.find((t) => t.value === value.comp_type);

  return (
    <div className="form-group">
      <label htmlFor="compType">Compensation</label>
      <select
        id="compType"
        value={value.comp_type}
        onChange={(e) => onChange({ ...value, comp_type: e.target.value as CompType | '' })}
        style={{ width: '100%' }}
      >
        <option value="">Select compensation...</option>
        {COMP_TYPES.map((t) => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>

      {showAmounts && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '8px' }}>
          <input
            type="text"
            inputMode="decimal"
            placeholder="Min"
            aria-label="Minimum compensation"
            value={value.comp_min}
            onChange={(e) => onChange({ ...value, comp_min: e.target.value })}
            style={{ flex: 1, minWidth: 0 }}
          />
          <span style={{ color: 'var(--text-light)', fontSize: '0.85rem' }}>to</span>
          <input
            type="text"
            inputMode="decimal"
            placeholder="Max (optional)"
            aria-label="Maximum compensation"
            value={value.comp_max}
            onChange={(e) => onChange({ ...value, comp_max: e.target.value })}
            style={{ flex: 1, minWidth: 0 }}
          />
          <span style={{ color: 'var(--text-light)', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
            {selectedType?.unit}
          </span>
        </div>
      )}

      {value.comp_type !== '' && (
        <input
          type="text"
          placeholder={value.comp_type === 'other' ? 'Describe the compensation' : 'Note, e.g. plus housing stipend (optional)'}
          value={value.comp_note}
          onChange={(e) => onChange({ ...value, comp_note: e.target.value })}
          style={{ width: '100%', marginTop: '8px' }}
        />
      )}

      <small style={{ color: 'var(--text-light)', fontSize: '0.78rem', marginTop: '4px', display: 'block' }}>
        {preview ? <>Students will see <strong>{preview}</strong></> : 'Leave blank if you’d rather not list compensation.'}
      </small>
    </div>
  );
}
