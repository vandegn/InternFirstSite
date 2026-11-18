// Rules for the company icon (employers.icon_url) — the square mark beside the
// company name on every job card. Shared by the Account page and the
// CompanyIconPrompt nudge so both accept exactly the same files.

// Checked in code, not just via the input's accept attribute, so a
// drag-and-dropped SVG or GIF can't slip through.
export const ICON_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
export const ICON_ACCEPT = 'image/png,image/jpeg,image/webp';
export const ICON_MAX_BYTES = 2 * 1024 * 1024;
const ICON_EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

/** Returns a user-facing error, or null when the file is acceptable. */
export function validateIconFile(file: { type: string; size: number }): string | null {
  if (!ICON_TYPES.has(file.type)) return 'Please choose a PNG, JPG, or WebP image.';
  if (file.size > ICON_MAX_BYTES) return 'Please choose an image under 2 MB.';
  return null;
}

/**
 * Storage path in the public `images` bucket. A fresh path per upload so
 * browsers and the CDN can't keep serving the previous icon after a replace.
 */
export function iconStoragePath(employerId: string, fileType: string, now: number = Date.now()): string {
  return `icons/${employerId}-${now}.${ICON_EXT[fileType] ?? 'png'}`;
}
