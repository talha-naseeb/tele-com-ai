/**
 * Normalizes caller/account lines to a single form (+digits) so the same SIM
 * matches across sessions whether the user said spaces, omitted +, etc.
 */
export function canonicalInternationalPhone(raw) {
  if (raw == null || raw === '') return '';
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length < 8) return String(raw).trim();
  return `+${digits}`;
}
