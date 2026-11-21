export function getDateObject(value) {
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

  return new Date(date.getTime());
}

export function formatDate(value) {
  const date = getDateObject(value);

  if (!date) {
    return '';
  }

  return date.toLocaleString('pl-PL');
}

export function getMonthYear(value) {
  const date = getDateObject(value);

  if (!date) {
    return 'Bez daty';
  }

  return date.toLocaleDateString('pl-PL', {
    month: 'long',
    year: 'numeric',
  });
}

export function sortByDateDesc(items = [], fieldName) {
  if (!Array.isArray(items)) {
    return [];
  }

  return [...items].sort((a, b) => {
    const dateA = getDateObject(a?.[fieldName])?.getTime() ?? 0;

    const dateB = getDateObject(b?.[fieldName])?.getTime() ?? 0;

    return dateB - dateA;
  });
}
