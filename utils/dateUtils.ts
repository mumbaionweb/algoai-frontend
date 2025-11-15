/**
 * Safely format a date string to locale string
 * @param date Date string, null, or undefined
 * @param options Optional Intl.DateTimeFormatOptions
 * @returns Formatted date string or 'N/A' if date is null/undefined/invalid
 */
export function formatDate(
  date: string | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!date) return 'N/A';
  
  try {
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      return 'Invalid date';
    }
    
    if (options) {
      return dateObj.toLocaleString('en-US', options);
    }
    
    return dateObj.toLocaleString();
  } catch (error) {
    console.error('Error formatting date:', error, date);
    return 'Invalid date';
  }
}

/**
 * Format date with default options (short format)
 */
export function formatDateShort(date: string | null | undefined): string {
  return formatDate(date, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

