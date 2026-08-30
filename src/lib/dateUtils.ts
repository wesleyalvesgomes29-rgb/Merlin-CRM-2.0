/**
 * Merlin CRM - Standardized Date Utilities
 * Handles timezone coherence, safe parsing, and localized formatting.
 */

/**
 * Returns today's date formatted as YYYY-MM-DD in the user's local timezone.
 */
export function getLocalTodayStr(referenceDate = new Date()): string {
  const year = referenceDate.getFullYear();
  const month = String(referenceDate.getMonth() + 1).padStart(2, '0');
  const day = String(referenceDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Safely parses any date representation (ISO string, YYYY-MM-DD, timestamp, Date object)
 * preventing UTC shift issues on date-only strings.
 */
export function parseDateSafe(input: string | number | Date | null | undefined): Date | null {
  if (!input) return null;
  if (input instanceof Date) {
    return isNaN(input.getTime()) ? null : input;
  }

  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) return null;

    // Pattern for YYYY-MM-DD (date only, avoid UTC midnight drift)
    const matchYMD = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
    if (matchYMD) {
      const year = parseInt(matchYMD[1], 10);
      const month = parseInt(matchYMD[2], 10) - 1;
      const day = parseInt(matchYMD[3], 10);
      // Instantiate at midday in local time to avoid any timezone day boundary crossing
      const localDate = new Date(year, month, day, 12, 0, 0);
      return isNaN(localDate.getTime()) ? null : localDate;
    }

    const parsed = new Date(trimmed);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(input);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Checks if two dates fall on the exact same calendar day in the local timezone.
 */
export function isSameDay(
  d1: Date | string | null | undefined,
  d2: Date | string | null | undefined
): boolean {
  const date1 = parseDateSafe(d1);
  const date2 = parseDateSafe(d2);
  if (!date1 || !date2) return false;

  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * Checks if a given date string or Date is today in the local timezone.
 */
export function isToday(dateInput: string | Date | null | undefined): boolean {
  if (!dateInput) return false;
  return isSameDay(dateInput, new Date());
}

/**
 * Checks if a given date string or Date is tomorrow in the local timezone.
 */
export function isTomorrow(dateInput: string | Date | null | undefined): boolean {
  if (!dateInput) return false;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return isSameDay(dateInput, tomorrow);
}

/**
 * Formats date into pt-BR localized format (DD/MM/YYYY or DD/MM/YYYY HH:mm).
 */
export function formatDateBRL(
  dateInput: string | Date | null | undefined,
  includeTime = false
): string {
  const d = parseDateSafe(dateInput);
  if (!d) return '—';

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();

  if (!includeTime) {
    return `${day}/${month}/${year}`;
  }

  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} às ${hours}:${minutes}`;
}
