/** Normalization is intentionally conservative: display values stay unchanged. */
export function normalizePhone(value?: string | null): string | null {
  if (!value) return null;
  const digits = value.replace(/[^0-9+]/g, '');
  if (!digits) return null;
  if (digits.startsWith('+66')) return `0${digits.slice(3)}`;
  return digits;
}

export function normalizeHn(value?: string | null): string | null {
  const normalized = value?.trim().replace(/\s+/g, '').toUpperCase();
  return normalized || null;
}
