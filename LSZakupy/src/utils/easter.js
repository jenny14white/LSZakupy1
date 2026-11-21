export function getEasterDate(year) {
  const numericYear = Number(year);

  if (
    !Number.isInteger(numericYear) ||
    numericYear < 1583 ||
    numericYear > 9999
  ) {
    throw new Error('Nieprawidłowy rok.');
  }

  const a = numericYear % 19;
  const b = Math.floor(numericYear / 100);
  const c = numericYear % 100;

  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);

  const h = (19 * a + b - d - g + 15) % 30;

  const i = Math.floor(c / 4);
  const k = c % 4;

  const l = (32 + 2 * e + 2 * i - h - k) % 7;

  const m = Math.floor((a + 11 * h + 22 * l) / 451);

  const result = h + l - 7 * m + 114;

  const month = Math.floor(result / 31);
  const day = (result % 31) + 1;

  return new Date(numericYear, month - 1, day);
}

export function addDays(date, days) {
  const sourceDate =
    date instanceof Date ? new Date(date.getTime()) : new Date(date);

  const numberOfDays = Number(days);

  if (Number.isNaN(sourceDate.getTime())) {
    throw new Error('Nieprawidłowa data.');
  }

  if (!Number.isInteger(numberOfDays)) {
    throw new Error('Liczba dni musi być liczbą całkowitą.');
  }

  sourceDate.setDate(sourceDate.getDate() + numberOfDays);

  return sourceDate;
}
