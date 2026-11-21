import { POLISH_FIXED_HOLIDAYS } from '../data/polishHolidays';
import { UNUSUAL_HOLIDAYS } from '../data/unusualHolidays';
import { addDays, getEasterDate } from './easter';

const RECURRENCE_UNITS = ['minute', 'hour', 'day', 'week', 'month', 'year'];

function normalizeDate(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  let date;

  if (value instanceof Date) {
    date = new Date(value.getTime());
  } else if (typeof value?.toDate === 'function') {
    date = value.toDate();
  } else if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);

    date = new Date(year, month - 1, day);

    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }
  } else {
    date = new Date(value);
  }

  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function normalizeDay(value) {
  const date = normalizeDate(value);

  if (!date) return null;

  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dayNumber(value) {
  const date = normalizeDay(value);

  if (!date) return null;

  return Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000
  );
}

function addCalendarDays(date, days) {
  const result = new Date(date.getTime());
  result.setDate(result.getDate() + days);
  return result;
}

function addMonthsClamped(date, months) {
  const result = new Date(
    date.getFullYear(),
    date.getMonth() + months,
    1,
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds()
  );

  const lastDay = new Date(
    result.getFullYear(),
    result.getMonth() + 1,
    0
  ).getDate();

  result.setDate(Math.min(date.getDate(), lastDay));

  return result;
}

function createEvent(
  date,
  title,
  emoji,
  type = 'holiday',
  publicHoliday = false
) {
  return {
    date: normalizeDay(date),
    title: title || '',
    emoji: emoji || '📅',
    type: type || 'holiday',
    publicHoliday: Boolean(publicHoliday),
  };
}

function fixedHolidayToEvent(year, holiday) {
  return createEvent(
    new Date(year, holiday.month - 1, holiday.day),
    holiday.title,
    holiday.emoji,
    holiday.type,
    holiday.publicHoliday
  );
}

export function getFixedHolidays(year) {
  return POLISH_FIXED_HOLIDAYS.map((holiday) =>
    fixedHolidayToEvent(year, holiday)
  );
}

export function getMovableHolidays(year) {
  const easter = getEasterDate(year);

  return [
    createEvent(easter, 'Wielkanoc', '🐣', 'holiday', true),
    createEvent(
      addDays(easter, 1),
      'Poniedziałek Wielkanocny',
      '🐣',
      'holiday',
      true
    ),
    createEvent(addDays(easter, 49), 'Zielone Świątki', '🌿', 'holiday', true),
    createEvent(addDays(easter, 60), 'Boże Ciało', '✝️', 'holiday', true),
  ];
}

export function getUnusualHolidays(year) {
  return UNUSUAL_HOLIDAYS.map((holiday) =>
    createEvent(
      new Date(year, holiday.month - 1, holiday.day),
      holiday.title,
      holiday.emoji,
      holiday.type,
      false
    )
  );
}

export function getAllCalendarEvents(year) {
  return [
    ...getFixedHolidays(year),
    ...getMovableHolidays(year),
    ...getUnusualHolidays(year),
  ]
    .filter((event) => event.date instanceof Date)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

function getRecurrence(event) {
  if (!event || typeof event !== 'object') return null;

  const rule = event.recurrence;

  if (!rule || rule.enabled !== true) return null;

  const interval = Number(rule.interval);

  if (
    !Number.isInteger(interval) ||
    interval < 1 ||
    !RECURRENCE_UNITS.includes(rule.unit)
  ) {
    return null;
  }

  const count =
    rule.count === null || rule.count === undefined || rule.count === ''
      ? null
      : Number(rule.count);

  return {
    unit: rule.unit,
    interval,
    count:
      count === null
        ? null
        : Number.isInteger(count) && count > 0
        ? count
        : null,
    until: normalizeDay(rule.until),
  };
}

function getOccurrenceDate(start, index, unit, interval) {
  const step = index * interval;

  if (unit === 'year') {
    return addMonthsClamped(start, step * 12);
  }

  if (unit === 'month') {
    return addMonthsClamped(start, step);
  }

  if (unit === 'week') {
    return addCalendarDays(start, step * 7);
  }

  if (unit === 'day') {
    return addCalendarDays(start, step);
  }

  if (unit === 'hour') {
    return new Date(start.getTime() + step * 3600000);
  }

  if (unit === 'minute') {
    return new Date(start.getTime() + step * 60000);
  }

  return null;
}

function getEventDurationDays(event) {
  const start = dayNumber(event.date);
  const end = dayNumber(event.endDate ?? event.date);

  if (start === null || end === null || end < start) {
    return null;
  }

  return end - start;
}

function getEventStart(event) {
  const start = normalizeDate(event.date);

  if (!start) return null;

  if (
    typeof event.time === 'string' &&
    /^([01]\d|2[0-3]):([0-5]\d)$/.test(event.time)
  ) {
    const [hours, minutes] = event.time.split(':').map(Number);
    start.setHours(hours, minutes, 0, 0);
  }

  return start;
}

function isDateInEventRange(date, event) {
  if (!event || typeof event !== 'object') return false;

  const current = dayNumber(date);
  const start = dayNumber(event.date);
  const end = dayNumber(event.endDate ?? event.date);

  if (current === null || start === null || end === null || end < start) {
    return false;
  }

  return current >= start && current <= end;
}

function getOccurrenceForDate(date, event) {
  const rule = getRecurrence(event);
  const start = getEventStart(event);
  const duration = getEventDurationDays(event);
  const targetDay = dayNumber(date);

  if (!rule || !start || duration === null || targetDay === null) {
    return null;
  }

  const startDay = dayNumber(start);

  if (targetDay < startDay) return null;

  const targetDate = normalizeDay(date);
  const earliestDay = addCalendarDays(targetDate, -duration);
  const earliestTime = earliestDay.getTime();
  const latestTime = addCalendarDays(targetDate, 1).getTime();

  let firstIndex = 0;

  if (rule.unit === 'year') {
    const years = earliestDay.getFullYear() - start.getFullYear();

    firstIndex = Math.max(0, Math.floor(years / rule.interval) - 1);
  } else if (rule.unit === 'month') {
    const months =
      (earliestDay.getFullYear() - start.getFullYear()) * 12 +
      earliestDay.getMonth() -
      start.getMonth();

    firstIndex = Math.max(0, Math.floor(months / rule.interval) - 1);
  } else if (rule.unit === 'week' || rule.unit === 'day') {
    const difference = dayNumber(earliestDay) - dayNumber(start);

    const stepDays = rule.unit === 'week' ? rule.interval * 7 : rule.interval;

    firstIndex = Math.max(0, Math.floor(difference / stepDays) - 1);
  } else {
    const stepMs =
      rule.unit === 'hour' ? rule.interval * 3600000 : rule.interval * 60000;

    firstIndex = Math.max(
      0,
      Math.floor((earliestTime - start.getTime()) / stepMs) - 1
    );
  }

  if (rule.count !== null && firstIndex >= rule.count) {
    return null;
  }

  const maxChecks = 10000;

  for (
    let index = firstIndex, checks = 0;
    checks < maxChecks && (rule.count === null || index < rule.count);
    index++, checks++
  ) {
    const occurrence = getOccurrenceDate(
      start,
      index,
      rule.unit,
      rule.interval
    );

    if (!occurrence) return null;

    const occurrenceDay = normalizeDay(occurrence);

    if (rule.until && occurrenceDay > rule.until) {
      return null;
    }

    if (occurrence.getTime() >= latestTime) {
      return null;
    }

    if (occurrence.getTime() < earliestTime) {
      continue;
    }

    const occurrenceDayNumber = dayNumber(occurrence);

    if (
      targetDay >= occurrenceDayNumber &&
      targetDay <= occurrenceDayNumber + duration
    ) {
      const occurrenceStart = normalizeDay(occurrence);
      const occurrenceEnd = addCalendarDays(occurrenceStart, duration);

      return {
        ...event,
        date: occurrenceStart,
        endDate: occurrenceEnd,
        time:
          rule.unit === 'minute' || rule.unit === 'hour'
            ? `${String(occurrence.getHours()).padStart(2, '0')}:${String(
                occurrence.getMinutes()
              ).padStart(2, '0')}`
            : event.time || '',
        recurring: true,
        recurrence: event.recurrence,
        originalDate: event.date,
        occurrenceIndex: index,
        occurrenceId: `${event.id ?? event.title}-${index}`,
      };
    }
  }

  return null;
}

export function getEventsForDate(date, events = []) {
  if (!Array.isArray(events) || !normalizeDay(date)) {
    return [];
  }

  const result = [];

  for (const event of events) {
    const rule = getRecurrence(event);

    if (rule) {
      const occurrence = getOccurrenceForDate(date, event);

      if (occurrence) {
        result.push(occurrence);
      }
    } else if (isDateInEventRange(date, event)) {
      result.push(event);
    }
  }

  return result.sort((first, second) =>
    String(first.time || '').localeCompare(String(second.time || ''))
  );
}

export function hasEvents(date, events = []) {
  return getEventsForDate(date, events).length > 0;
}

export function isSameDay(first, second) {
  const firstDate = normalizeDay(first);
  const secondDate = normalizeDay(second);

  if (!firstDate || !secondDate) return false;

  return (
    firstDate.getFullYear() === secondDate.getFullYear() &&
    firstDate.getMonth() === secondDate.getMonth() &&
    firstDate.getDate() === secondDate.getDate()
  );
}

export function isToday(date) {
  return isSameDay(date, new Date());
}

export function isCurrentMonth(date, currentDate) {
  const value = normalizeDate(date);
  const current = normalizeDate(currentDate);

  if (!value || !current) return false;

  return (
    value.getFullYear() === current.getFullYear() &&
    value.getMonth() === current.getMonth()
  );
}

export function generateCalendarDays(currentDate) {
  const normalized = normalizeDate(currentDate);

  if (!normalized) return [];

  const year = normalized.getFullYear();
  const month = normalized.getMonth();

  const firstDay = new Date(year, month, 1);
  const offset = (firstDay.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - offset);

  return Array.from(
    { length: 42 },
    (_, index) =>
      new Date(start.getFullYear(), start.getMonth(), start.getDate() + index)
  );
}

export function formatDate(date) {
  const value = normalizeDate(date);

  if (!value) return '';

  return value.toLocaleDateString('pl-PL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
