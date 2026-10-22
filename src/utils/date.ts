/**
 * Science of Gifts CMS - Shared Date Utility
 * Canonical Date Model: YYYY-MM-DD
 *
 * Provides safe date normalization, formatting, and defaults
 * without timezone-induced day shifting.
 */

const MONTH_NAMES: Record<string, string> = {
  january: '01',
  jan: '01',
  february: '02',
  feb: '02',
  march: '03',
  mar: '03',
  april: '04',
  apr: '04',
  may: '05',
  june: '06',
  jun: '06',
  july: '07',
  jul: '07',
  august: '08',
  aug: '08',
  september: '09',
  sep: '09',
  sept: '09',
  october: '10',
  oct: '10',
  november: '11',
  nov: '11',
  december: '12',
  dec: '12'
};

const MONTH_DISPLAY = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
];

/**
 * Returns whether a year is a leap year.
 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

/**
 * Validates whether a year, month, and day form a genuine calendar date.
 */
export function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return false;
  }
  if (year < 1000 || year > 9999) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1) return false;

  const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= daysInMonth[month - 1];
}

/**
 * Returns today's calendar date in local time as YYYY-MM-DD.
 * Strictly date-only; avoids UTC conversion shifting.
 */
export function getTodayIsoDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Checks if a value is strictly a valid YYYY-MM-DD calendar date string.
 */
export function isValidIsoDate(value?: any): boolean {
  if (!value) return false;
  const str = typeof value === 'string' ? value.trim() : '';
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  return isValidCalendarDate(parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10));
}

/**
 * Normalizes an incoming date value into a canonical YYYY-MM-DD string.
 *
 * Handles:
 * - YYYY-MM-DD strings
 * - Quoted YYYY-MM-DD strings
 * - ISO timestamp strings (YYYY-MM-DDTHH:mm:ss...)
 * - Legacy human-readable date strings (e.g. "September 18, 2026", "18 September 2026", "09/18/2026")
 * - JavaScript Date objects (e.g., produced by js-yaml)
 * - Numeric timestamps
 * - Rejects unparseable or seasonal labels (e.g., "Autumn 2026", "Fall 2026") -> returns ""
 * - Rejects invalid calendar dates (e.g., "2026-02-31", "February 31, 2026") -> returns ""
 */
export function normalizeToIsoDate(rawDate?: any): string {
  if (rawDate === null || rawDate === undefined) {
    return '';
  }

  // Handle JavaScript Date objects (e.g., from js-yaml)
  if (rawDate instanceof Date || Object.prototype.toString.call(rawDate) === '[object Date]') {
    if (isNaN(rawDate.getTime())) return '';
    const year = rawDate.getUTCFullYear();
    const month = rawDate.getUTCMonth() + 1;
    const day = rawDate.getUTCDate();
    if (isValidCalendarDate(year, month, day)) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    return '';
  }

  // Handle numeric timestamps
  if (typeof rawDate === 'number') {
    const d = new Date(rawDate);
    if (isNaN(d.getTime())) return '';
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth() + 1;
    const day = d.getUTCDate();
    if (isValidCalendarDate(year, month, day)) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    return '';
  }

  if (typeof rawDate !== 'string') {
    return '';
  }

  let trimmed = rawDate.trim();
  // Strip surrounding quotes if present
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    trimmed = trimmed.slice(1, -1).trim();
  }

  if (!trimmed) {
    return '';
  }

  // Canonical YYYY-MM-DD
  const ymdMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10);
    const day = parseInt(ymdMatch[3], 10);
    if (isValidCalendarDate(year, month, day)) {
      return `${ymdMatch[1]}-${ymdMatch[2]}-${ymdMatch[3]}`;
    }
    return '';
  }

  // ISO timestamp string e.g., 2026-09-18T00:00:00Z or 2026-09-18 12:00:00
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})[T\s]/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);
    if (isValidCalendarDate(year, month, day)) {
      return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    }
    return '';
  }

  // Match: "September 18, 2026" or "Sep 18 2026"
  const mdYMatch = trimmed.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (mdYMatch) {
    const monthKey = mdYMatch[1].toLowerCase();
    const monthNumStr = MONTH_NAMES[monthKey];
    if (monthNumStr) {
      const year = parseInt(mdYMatch[3], 10);
      const month = parseInt(monthNumStr, 10);
      const day = parseInt(mdYMatch[2], 10);
      if (isValidCalendarDate(year, month, day)) {
        return `${mdYMatch[3]}-${monthNumStr}-${String(day).padStart(2, '0')}`;
      }
    }
  }

  // Match: "18 September 2026"
  const dmYMatch = trimmed.match(/^(\d{1,2})\s+([A-Za-z]+),?\s+(\d{4})$/);
  if (dmYMatch) {
    const monthKey = dmYMatch[2].toLowerCase();
    const monthNumStr = MONTH_NAMES[monthKey];
    if (monthNumStr) {
      const year = parseInt(dmYMatch[3], 10);
      const month = parseInt(monthNumStr, 10);
      const day = parseInt(dmYMatch[1], 10);
      if (isValidCalendarDate(year, month, day)) {
        return `${dmYMatch[3]}-${monthNumStr}-${String(day).padStart(2, '0')}`;
      }
    }
  }

  // Match slash/dash numeric dates: YYYY/MM/DD or MM/DD/YYYY
  const slashYmd = trimmed.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (slashYmd) {
    const year = parseInt(slashYmd[1], 10);
    const month = parseInt(slashYmd[2], 10);
    const day = parseInt(slashYmd[3], 10);
    if (isValidCalendarDate(year, month, day)) {
      return `${slashYmd[1]}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  const slashMdy = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (slashMdy) {
    const month = parseInt(slashMdy[1], 10);
    const day = parseInt(slashMdy[2], 10);
    const year = parseInt(slashMdy[3], 10);
    if (isValidCalendarDate(year, month, day)) {
      return `${slashMdy[3]}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // Return empty string for seasonal or unparseable inputs
  return '';
}

/**
 * Formats a canonical YYYY-MM-DD string into a human-readable editorial date.
 * E.g., "2026-09-18" -> "September 18, 2026".
 *
 * Avoids Date constructor timezone shifting by parsing year, month, day directly.
 * If given a non-ISO legacy string (e.g. "Autumn 2026"), returns the string as fallback.
 */
export function formatIsoToHuman(rawDate?: any, fallback: string = ''): string {
  if (rawDate === null || rawDate === undefined) {
    return fallback;
  }

  const normalized = normalizeToIsoDate(rawDate);
  if (normalized) {
    const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      const year = match[1];
      const monthIndex = parseInt(match[2], 10) - 1;
      const day = parseInt(match[3], 10);
      if (monthIndex >= 0 && monthIndex < 12) {
        return `${MONTH_DISPLAY[monthIndex]} ${day}, ${year}`;
      }
    }
  }

  // Fallback to raw string if it is already human-readable text e.g. "Autumn 2026"
  if (typeof rawDate === 'string' && rawDate.trim()) {
    return rawDate.trim();
  }

  return fallback;
}
