import { ADMIN_UIDS } from '../config/roles';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { auth, db } from '../firebase/firebase';

const EVENTS_COLLECTION = 'events';

const RECURRENCE_UNITS = ['minute', 'hour', 'day', 'week', 'month', 'year'];

function checkAdmin() {
  const user = auth.currentUser;

  if (!user || !ADMIN_UIDS.includes(user.uid)) {
    throw new Error('Brak uprawnień administratora');
  }
}

function cleanText(value = '') {
  return String(value ?? '').trim();
}

function normalizeDate(value) {
  if (!value) return null;

  if (typeof value?.toDate === 'function') {
    return normalizeDate(value.toDate());
  }

  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);

    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }

    return date;
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function normalizeRecurrence(value) {
  if (!value || typeof value !== 'object' || !value.enabled) {
    return { enabled: false };
  }

  const interval = Number(value.interval);
  const count =
    value.count === '' || value.count === null || value.count === undefined
      ? null
      : Number(value.count);

  const unit = RECURRENCE_UNITS.includes(value.unit) ? value.unit : 'week';

  return {
    enabled: true,
    interval: Number.isInteger(interval) && interval > 0 ? interval : 1,
    unit,
    count:
      count === null
        ? null
        : Number.isInteger(count) && count > 0
        ? count
        : null,
    until: cleanText(value.until),
  };
}

function getRecurrence(data) {
  if (data.recurrence?.enabled) {
    return normalizeRecurrence(data.recurrence);
  }

  if (data.recurring && !data.recurrence) {
    return normalizeRecurrence({
      enabled: true,
      interval: data.interval ?? 1,
      unit: data.unit ?? 'week',
      count: data.count ?? null,
      until: data.until ?? '',
    });
  }

  return { enabled: false };
}

function getEventDate(event) {
  return normalizeDate(event.date) || new Date(0);
}

function getEventEndDate(event) {
  return normalizeDate(event.endDate) || getEventDate(event);
}

function normalizeEvent(event) {
  const recurrence = getRecurrence(event);

  return {
    ...event,
    id: event.id,
    title: event.title || '',
    description: event.description || '',
    type: event.type || 'other',
    date: event.date || null,
    endDate: event.endDate || event.date || null,
    time: event.time || '',
    endTime: event.endTime || '',
    location: event.location || '',
    emoji: event.emoji || '📅',
    recurring: recurrence.enabled,
    recurrence,
    createdBy: event.createdBy || '',
    createdAt: event.createdAt || null,
    updatedAt: event.updatedAt || null,
  };
}

function sortEvents(events) {
  return events.sort((a, b) => getEventDate(a) - getEventDate(b));
}

function prepareEvent(data) {
  const title = cleanText(data.title);

  if (!title) {
    throw new Error('Tytuł wydarzenia jest wymagany');
  }

  if (!data.date) {
    throw new Error('Data wydarzenia jest wymagana');
  }

  const startDate = normalizeDate(data.date);

  if (!startDate) {
    throw new Error('Nieprawidłowa data rozpoczęcia wydarzenia');
  }

  const endDate = data.endDate ? normalizeDate(data.endDate) : startDate;

  if (!endDate) {
    throw new Error('Nieprawidłowa data zakończenia wydarzenia');
  }

  if (endDate.getTime() < startDate.getTime()) {
    throw new Error(
      'Data zakończenia nie może być wcześniejsza niż data rozpoczęcia'
    );
  }

  const time = cleanText(data.time);
  const endTime = cleanText(data.endTime);

  if (
    startDate.toDateString() === endDate.toDateString() &&
    time &&
    endTime &&
    endTime < time
  ) {
    throw new Error(
      'Godzina zakończenia nie może być wcześniejsza niż godzina rozpoczęcia'
    );
  }

  const recurrence = getRecurrence(data);

  if (recurrence.enabled) {
    if (
      !Number.isInteger(recurrence.interval) ||
      recurrence.interval < 1 ||
      recurrence.interval > 9999
    ) {
      throw new Error('Nieprawidłowy odstęp powtarzania');
    }

    if (recurrence.until) {
      const untilDate = normalizeDate(recurrence.until);

      if (!untilDate) {
        throw new Error('Nieprawidłowa data końca powtarzania');
      }

      const startDay = new Date(
        startDate.getFullYear(),
        startDate.getMonth(),
        startDate.getDate()
      );

      const untilDay = new Date(
        untilDate.getFullYear(),
        untilDate.getMonth(),
        untilDate.getDate()
      );

      if (untilDay < startDay) {
        throw new Error(
          'Data końca powtarzania nie może być wcześniejsza niż początek wydarzenia'
        );
      }
    }
  }

  return {
    title,
    description: cleanText(data.description),
    type: cleanText(data.type) || 'other',
    date: startDate,
    endDate,
    time,
    endTime,
    location: cleanText(data.location),
    emoji: cleanText(data.emoji) || '📅',
    recurring: recurrence.enabled,
    recurrence,
  };
}

export function listenToEvents(callback) {
  return onSnapshot(
    collection(db, EVENTS_COLLECTION),
    (snapshot) => {
      const events = snapshot.docs.map((document) =>
        normalizeEvent({
          id: document.id,
          ...document.data(),
        })
      );

      callback(sortEvents(events));
    },
    (error) => {
      console.error('Błąd nasłuchiwania wydarzeń:', error);
    }
  );
}

export async function getAllCalendarEvents() {
  const snapshot = await getDocs(collection(db, EVENTS_COLLECTION));

  const events = snapshot.docs.map((document) =>
    normalizeEvent({
      id: document.id,
      ...document.data(),
    })
  );

  return sortEvents(events);
}

function isDateInEventRange(date, event) {
  const currentDate = normalizeDate(date);

  if (!currentDate) return false;

  const startDate = normalizeDate(event.date);

  if (!startDate) return false;

  const endDate = getEventEndDate(event);

  const current = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    currentDate.getDate()
  );

  const start = new Date(
    startDate.getFullYear(),
    startDate.getMonth(),
    startDate.getDate()
  );

  const end = new Date(
    endDate.getFullYear(),
    endDate.getMonth(),
    endDate.getDate()
  );

  return current >= start && current <= end;
}

export function getEventsForDate(events, date) {
  if (!Array.isArray(events)) return [];

  return events.filter((event) => isDateInEventRange(date, event));
}

export async function createEvent(data) {
  checkAdmin();

  const event = prepareEvent(data);
  const uid = auth.currentUser.uid;

  await addDoc(collection(db, EVENTS_COLLECTION), {
    ...event,
    createdBy: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateEvent(id, data) {
  checkAdmin();

  const event = prepareEvent(data);

  await updateDoc(doc(db, EVENTS_COLLECTION, id), {
    ...event,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteEvent(id) {
  checkAdmin();

  await deleteDoc(doc(db, EVENTS_COLLECTION, id));
}
