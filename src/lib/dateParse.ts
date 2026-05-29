// Best-effort parsers for free-typed dates and times. Used by DatePicker
// and TimePicker so coaches can type a date or time directly instead of
// being forced through a popup picker.

/**
 * Parse a user-typed date into an ISO `YYYY-MM-DD` string.
 *
 * Accepts day-first formats with `.`, `/`, or `-` separators:
 *   15.6.2025, 15/06/2025, 15-06-25, 15.06.2025
 *
 * Two-digit years are mapped to 20YY unless that puts them more than 10
 * years in the future, in which case they fall back to 19YY (so "85"
 * becomes 1985, not 2085).
 *
 * Returns null if the input doesn't parse or describes a non-existent date
 * like Feb 31.
 */
export function parseFlexibleDate(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (!match) return null;

  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  let year = parseInt(match[3], 10);

  if (year < 100) {
    const currentYear = new Date().getFullYear();
    year = year + 2000 <= currentYear + 10 ? year + 2000 : year + 1900;
  }

  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;

  const date = new Date(year, month - 1, day);
  // Guard against JS Date auto-correcting (Feb 31 → Mar 3, etc.)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return (
    String(year).padStart(4, '0') +
    '-' +
    String(month).padStart(2, '0') +
    '-' +
    String(day).padStart(2, '0')
  );
}

/**
 * Format an ISO `YYYY-MM-DD` value back into the day-first display string
 * the input shows (`DD/MM/YYYY`). Returns an empty string for falsy input.
 */
export function formatDateForInput(iso: string | null | undefined): string {
  if (!iso || iso.length < 10) return '';
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

/**
 * Parse a user-typed time into 24-hour `HH:MM` format. Accepts:
 *   9, 9:30, 09:30, 9.30, 14:5, 1430
 */
export function parseFlexibleTime(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // "1430" / "0930" — 4 digits, no separator
  const compact = trimmed.match(/^(\d{1,2})(\d{2})$/);
  // Hour + optional separator + optional minutes
  const split = trimmed.match(/^(\d{1,2})[.:]?(\d{0,2})$/);
  const match = compact || split;
  if (!match) return null;

  const hour = parseInt(match[1], 10);
  const minute = match[2] ? parseInt(match[2], 10) : 0;

  if (isNaN(hour) || hour < 0 || hour > 23) return null;
  if (isNaN(minute) || minute < 0 || minute > 59) return null;

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}
