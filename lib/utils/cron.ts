/**
 * AlgoAI Cron Schedule Formatter
 * Translates standard 5-part cron syntax into human-readable descriptions
 * tailored for Indian stock market operations (IST - UTC+5:30).
 */

const DAYS_OF_WEEK: Record<string, string> = {
  '0': 'Sun',
  '1': 'Mon',
  '2': 'Tue',
  '3': 'Wed',
  '4': 'Thu',
  '5': 'Fri',
  '6': 'Sat',
  '7': 'Sun',
};

function formatHour(hourNum: number, minuteNum: number = 0): string {
  const period = hourNum >= 12 ? 'PM' : 'AM';
  const displayHour = hourNum % 12 === 0 ? 12 : hourNum % 12;
  const displayMinute = minuteNum.toString().padStart(2, '0');
  return `${displayHour}:${displayMinute} ${period}`;
}

export function formatCronSchedule(cron?: string | null): string {
  if (!cron || typeof cron !== 'string') {
    return 'Manual run only';
  }

  const parts = cron.trim().split(/\s+/);
  if (parts.length < 5) {
    return cron;
  }

  const [minute, hour, , , dayOfWeek] = parts;

  // Specific well-known financial patterns
  if (cron === '0 18 * * 1-5') {
    return 'Mon–Fri at 6:00 PM IST (Post-Market Close)';
  }
  if (cron === '30 16 * * 1-5') {
    return 'Mon–Fri at 4:30 PM IST (Market Wrap-up)';
  }
  if (cron === '*/15 9-15 * * 1-5' || cron === '*/15 3-10 * * 1-5') {
    return 'Every 15 mins during market hours (09:15–15:30 IST, Mon–Fri)';
  }
  if (cron === '*/5 9-15 * * 1-5' || cron === '*/5 3-10 * * 1-5') {
    return 'Every 5 mins during market hours (09:15–15:30 IST, Mon–Fri)';
  }
  if (cron === '0 9 * * 1-5') {
    return 'Mon–Fri at 9:00 AM IST (Pre-Market)';
  }

  // Parse Day of Week
  let daysDescription = 'Every day';
  if (dayOfWeek === '1-5') {
    daysDescription = 'Mon–Fri';
  } else if (dayOfWeek === '0,6' || dayOfWeek === '6,0') {
    daysDescription = 'Weekends';
  } else if (dayOfWeek !== '*') {
    const days = dayOfWeek.split(',').map((d) => DAYS_OF_WEEK[d] || d);
    daysDescription = days.join(', ');
  }

  // Parse Frequency / Interval
  if (minute.startsWith('*/')) {
    const step = minute.replace('*/', '');
    if (hour.includes('-')) {
      const [startHour, endHour] = hour.split('-').map(Number);
      return `Every ${step} mins between ${formatHour(startHour)} and ${formatHour(endHour)} IST (${daysDescription})`;
    }
    if (hour === '*') {
      return `Every ${step} mins (${daysDescription})`;
    }
    return `Every ${step} mins during hour ${hour} IST (${daysDescription})`;
  }

  // Parse Fixed Time
  const minuteNum = Number.parseInt(minute, 10);
  const hourNum = Number.parseInt(hour, 10);

  if (!Number.isNaN(hourNum) && !Number.isNaN(minuteNum)) {
    const timeFormatted = formatHour(hourNum, minuteNum);
    return `${daysDescription} at ${timeFormatted} IST`;
  }

  return cron;
}
