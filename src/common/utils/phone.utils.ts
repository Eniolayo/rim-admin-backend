/**
 * Normalizes Nigerian phone numbers to a canonical LOCAL format.
 *
 * Rules:
 * - Accepts numbers starting with:
 *   - "0"   (e.g. "07030278896")
 *   - "234" (e.g. "2347030278896")
 *   - "+234" (e.g. "+2347030278896")
 * - Returns numbers in local format: "0XXXXXXXXXX" (11 digits)
 * - Strips all non-digit characters.
 *
 * Examples:
 * - "07030278896"      -> "07030278896"
 * - "2347030278896"    -> "07030278896"
 * - "+2347030278896"   -> "07030278896"
 */
export function normalizeNigerianPhone(
  raw: string | null | undefined,
): string | null {
  if (!raw) {
    return null;
  }

  // Keep digits only
  const digits = raw.replace(/\D/g, '');

  if (!digits) {
    return null;
  }

  // Local Nigerian format: 0XXXXXXXXXX (11 digits)
  if (digits.startsWith('0') && digits.length === 11) {
    return digits;
  }

  // International format: 2347XXXXXXXXX -> 0XXXXXXXXXX
  if (digits.startsWith('234') && digits.length >= 13) {
    // Take the next 10 digits after 234 as the local number
    const localPart = digits.slice(3, 13);
    if (localPart.length === 10) {
      return `0${localPart}`;
    }
  }

  // Fallback: if it looks like an 10-digit local number without leading 0
  // (e.g. "7030278896"), treat it as 0XXXXXXXXXX.
  if (!digits.startsWith('0') && digits.length === 10) {
    return `0${digits}`;
  }

  // For anything else, just return the digits so we don't silently break
  return digits;
}


