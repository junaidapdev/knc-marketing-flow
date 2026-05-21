// Saudi WhatsApp number normalization for wa.me deep links.
//   05XXXXXXXX  →  9665XXXXXXXX
//   +966...     →  966...
//   5XXXXXXXX   →  9665XXXXXXXX (rare: typed without leading 0)
// Anything else is passed through digits-only as a best effort.
export function toWaNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("0") && digits.length === 10) return `966${digits.slice(1)}`;
  if (digits.startsWith("966")) return digits;
  if (digits.startsWith("5") && digits.length === 9) return `966${digits}`;
  return digits;
}

export function toWaUrl(raw: string): string {
  return `https://wa.me/${toWaNumber(raw)}`;
}
