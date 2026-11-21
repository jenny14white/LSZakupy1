const ICS_PRODUCT_ID = '-//LS Zakupy 2.0//Calendar//PL';

function toDate(value) {
  if (!value) {
    return new Date();
  }

  let date;

  if (value instanceof Date) {
    date = new Date(value.getTime());
  } else if (typeof value?.toDate === 'function') {
    date = new Date(value.toDate().getTime());
  } else if (typeof value === 'string') {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

    if (match) {
      const [, year, month, day] = match;

      date = new Date(Number(year), Number(month) - 1, Number(day));

      if (
        date.getFullYear() !== Number(year) ||
        date.getMonth() !== Number(month) - 1 ||
        date.getDate() !== Number(day)
      ) {
        throw new Error('Nieprawidłowa data wydarzenia.');
      }
    } else {
      date = new Date(value);
    }
  } else {
    date = new Date(value);
  }

  if (Number.isNaN(date.getTime())) {
    throw new Error('Nieprawidłowa data wydarzenia.');
  }

  return date;
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function formatICSDate(date) {
  return (
    date.getUTCFullYear() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    'T' +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    'Z'
  );
}

function formatLocalDate(date) {
  return date.getFullYear() + pad(date.getMonth() + 1) + pad(date.getDate());
}

function formatGoogleDate(date, allDay = false) {
  return allDay ? formatLocalDate(date) : formatICSDate(date);
}

function applyTime(date, time) {
  if (!time) {
    return;
  }

  const match = String(time).match(/^(\d{1,2}):(\d{2})$/);

  if (!match) {
    throw new Error('Nieprawidłowa godzina wydarzenia.');
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new Error('Nieprawidłowa godzina wydarzenia.');
  }

  date.setHours(hour, minute, 0, 0);
}

function createDates(event) {
  if (!event || typeof event !== 'object') {
    throw new Error('Brak danych wydarzenia.');
  }

  if (!event.date) {
    throw new Error('Brak daty wydarzenia.');
  }

  const start = toDate(event.date);

  const end = event.endDate ? toDate(event.endDate) : new Date(start.getTime());

  const allDay = !event.time;

  if (allDay) {
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    end.setDate(end.getDate() + 1);
  } else {
    applyTime(start, event.time);

    if (event.endTime) {
      applyTime(end, event.endTime);
    } else if (event.endDate) {
      applyTime(end, event.time);
    } else {
      applyTime(end, event.time);
      end.setHours(end.getHours() + 1);
    }
  }

  if (end.getTime() <= start.getTime()) {
    throw new Error(
      'Data zakończenia musi być późniejsza niż data rozpoczęcia.'
    );
  }

  return {
    start,
    end,
    allDay,
  };
}

function escapeICS(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

function foldICSLine(line) {
  const encoder = new TextEncoder();
  const chunks = [];
  let current = '';

  for (const character of line) {
    const next = current + character;

    if (encoder.encode(next).length > 75) {
      chunks.push(current);
      current = ' ' + character;
    } else {
      current = next;
    }
  }

  if (current) {
    chunks.push(current);
  }

  return chunks.join('\r\n');
}

function createICS(event) {
  const { start, end, allDay } = createDates(event);

  const startValue = allDay
    ? `DTSTART;VALUE=DATE:${formatLocalDate(start)}`
    : `DTSTART:${formatICSDate(start)}`;

  const endValue = allDay
    ? `DTEND;VALUE=DATE:${formatLocalDate(end)}`
    : `DTEND:${formatICSDate(end)}`;

  const uid =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${ICS_PRODUCT_ID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}@ls-zakupy`,
    `DTSTAMP:${formatICSDate(new Date())}`,
    startValue,
    endValue,
    `SUMMARY:${escapeICS(event.title || 'Wydarzenie')}`,
    `DESCRIPTION:${escapeICS(event.description)}`,
    `LOCATION:${escapeICS(event.location)}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return lines.map(foldICSLine).join('\r\n') + '\r\n';
}

function downloadICS(event, fileName = 'event.ics') {
  const ics = createICS(event);

  const blob = new Blob([ics], {
    type: 'text/calendar;charset=utf-8',
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = fileName;

  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

export function addToGoogle(event) {
  const { start, end, allDay } = createDates(event);

  const dates =
    `${formatGoogleDate(start, allDay)}/` + formatGoogleDate(end, allDay);

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title || 'Wydarzenie',
    dates,
    details: event.description || '',
    location: event.location || '',
  });

  const url =
    'https://calendar.google.com/calendar/render?' + params.toString();

  const newWindow = window.open(url, '_blank', 'noopener,noreferrer');

  if (!newWindow) {
    const link = document.createElement('a');

    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';

    document.body.appendChild(link);
    link.click();
    link.remove();
  }
}

export function addToApple(event) {
  downloadICS(event, 'ls-zakupy-apple.ics');
}

export function addToOutlook(event) {
  downloadICS(event, 'ls-zakupy-outlook.ics');
}
