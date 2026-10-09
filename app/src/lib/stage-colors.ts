/**
 * Pipeline stages store their pill colors in the database. Stages created
 * from PIPELINE_STAGE_PRESETS store theme tokens (`var(--chip-…)`), but the
 * default Applied / Interviewing / Offered columns seeded by the database
 * trigger store literal light-mode hex, which renders as pastel blocks in dark
 * mode. This maps those seeded literals to the token with the identical light
 * value, so light mode is unchanged and dark mode gets the matching chip.
 * Anything else (tokens, unknown values) passes through untouched.
 */
const SEEDED_STAGE_COLORS: Record<string, string> = {
  '#e0e7ff': 'var(--chip-indigo-bg)',
  '#3730a3': 'var(--chip-indigo-ink)',
  '#ede9fe': 'var(--chip-purple-bg)',
  '#5b21b6': 'var(--chip-purple-ink)',
  '#d1fae5': 'var(--chip-green-bg)',
  '#065f46': 'var(--chip-green-ink)',
};

export function stageColor(value: string): string;
export function stageColor(value: string | null | undefined): string | undefined;
export function stageColor(value: string | null | undefined): string | undefined {
  if (!value) return value ?? undefined;
  return SEEDED_STAGE_COLORS[value.trim().toLowerCase()] ?? value;
}
