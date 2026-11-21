import { useMemo, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { auth, db } from '../../firebase/firebase';
import { ADMIN_UID } from '../../config/roles';
import { POLISH_FIXED_HOLIDAYS } from '../../data/polishHolidays';
import { UNUSUAL_HOLIDAYS } from '../../data/unusualHolidays';
import ConfirmDialog from '../shared/ConfirmDialog';
import SharedDatePicker from '../shared/SharedDatePicker';

const WEEK_DAYS = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'];
const MONTHS = [
  'Styczeń',
  'Luty',
  'Marzec',
  'Kwiecień',
  'Maj',
  'Czerwiec',
  'Lipiec',
  'Sierpień',
  'Wrzesień',
  'Październik',
  'Listopad',
  'Grudzień',
];
const TYPES = [
  { id: 'meeting', label: 'Spotkanie', emoji: '🤝' },
  { id: 'birthday', label: 'Urodziny', emoji: '🎂' },
  { id: 'vacation', label: 'Urlop', emoji: '🏖️' },
  { id: 'holiday', label: 'Święto', emoji: '🎉' },
  { id: 'other', label: 'Inne', emoji: '📌' },
  { id: 'special', label: 'Nietypowe', emoji: '✨' },
];
const EMOJIS = [
  '📅',
  '🤝',
  '🎂',
  '🎉',
  '❤️',
  '🎁',
  '🎓',
  '🏖️',
  '✈️',
  '🏠',
  '💼',
  '📌',
  '💡',
  '🏆',
  '⚽',
  '🎵',
  '🎭',
  '🎬',
  '🍰',
  '🍕',
  '🌸',
  '🌞',
  '❄️',
  '🎄',
  '🛒',
  '💊',
  '🚗',
  '🐾',
  '⭐',
  '🔥',
  '🥳',
  '💐',
];
const UNITS = [
  { id: 'minute', label: 'minut' },
  { id: 'hour', label: 'godzin' },
  { id: 'day', label: 'dni' },
  { id: 'week', label: 'tygodni' },
  { id: 'month', label: 'miesięcy' },
  { id: 'year', label: 'lat' },
];
const MAX_OCCURRENCES = 500;
const DAY_MS = 86400000;
const keyOf = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    '0'
  )}-${String(date.getDate()).padStart(2, '0')}`;

function parseDate(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return parseDate(value.toDate());
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    const result = new Date(y, m - 1, d);
    return result.getFullYear() === y &&
      result.getMonth() === m - 1 &&
      result.getDate() === d
      ? result
      : null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime())
    ? null
    : new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addMonthsClamped(date, count) {
  const target = new Date(date.getFullYear(), date.getMonth() + count, 1);
  const last = new Date(
    target.getFullYear(),
    target.getMonth() + 1,
    0
  ).getDate();
  target.setDate(Math.min(date.getDate(), last));
  return target;
}

function nextOccurrence(start, index, unit, interval) {
  if (unit === 'month') return addMonthsClamped(start, index * interval);
  if (unit === 'year') return addMonthsClamped(start, index * interval * 12);
  const delta = unit === 'week' ? 7 * interval : unit === 'day' ? interval : 0;
  if (delta)
    return new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate() + delta * index
    );
  const minutes = unit === 'hour' ? 60 * interval : interval;
  return new Date(start.getTime() + minutes * 60000 * index);
}

function recurrenceOf(event) {
  const r = event.recurrence;
  if (
    r &&
    r.enabled &&
    Number(r.interval) > 0 &&
    UNITS.some((u) => u.id === r.unit)
  )
    return r;
  return null;
}

function formFor(date) {
  const key = keyOf(date);
  return {
    title: '',
    description: '',
    location: '',
    date: key,
    endDate: key,
    time: '',
    endTime: '',
    type: 'meeting',
    emoji: '🤝',
    recurring: false,
    interval: 1,
    unit: 'week',
    until: '',
    count: '',
  };
}

function dateLabel(value) {
  return value.toLocaleDateString('pl-PL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function holidayEvents(year) {
  return [...POLISH_FIXED_HOLIDAYS, ...UNUSUAL_HOLIDAYS].map((h, i) => {
    const date = new Date(year, h.month - 1, h.day);
    return {
      id: `holiday-${year}-${i}`,
      date,
      endDate: date,
      title: h.title,
      type: h.type,
      emoji: h.emoji,
      systemHoliday: true,
      publicHoliday: h.publicHoliday ?? false,
    };
  });
}

function buildEventMap(events, year) {
  const map = {};
  const minDate = new Date(year - 1, 0, 1);
  const maxDate = new Date(year + 2, 0, 0);
  const put = (date, event, occurrenceId) => {
    const key = keyOf(date);
    if (!map[key]) map[key] = [];
    if (!map[key].some((e) => e._occurrenceId === occurrenceId))
      map[key].push({ ...event, _occurrenceId: occurrenceId });
  };
  const addRange = (start, end, event, id) => {
    const cursor = new Date(Math.max(start.getTime(), minDate.getTime()));
    const last = Math.min(end.getTime(), maxDate.getTime());
    for (
      let n = 0;
      cursor.getTime() <= last && n < 1200;
      n++, cursor.setDate(cursor.getDate() + 1)
    )
      put(cursor, event, id);
  };
  [...events, ...[year - 1, year, year + 1].flatMap(holidayEvents)].forEach(
    (event, idx) => {
      const start = parseDate(event.date);
      if (!start) return;
      const end = parseDate(event.endDate) || start;
      const duration = Math.max(
        0,
        Math.round((end.getTime() - start.getTime()) / DAY_MS)
      );
      const r = !event.systemHoliday && recurrenceOf(event);
      if (!r) {
        addRange(
          start,
          new Date(
            start.getFullYear(),
            start.getMonth(),
            start.getDate() + duration
          ),
          event,
          `${event.id || idx}-0`
        );
        return;
      }
      const count = Math.min(
        MAX_OCCURRENCES,
        r.count === null || r.count === undefined || r.count === ''
          ? MAX_OCCURRENCES
          : Math.max(1, Number(r.count) || MAX_OCCURRENCES)
      );
      const until = parseDate(r.until);
      const interval = Number(r.interval);
      const unit = r.unit;
      let firstIndex = 0;
      const windowStart = new Date(minDate);
      windowStart.setDate(windowStart.getDate() - duration);
      if (start < windowStart) {
        if (unit === 'year')
          firstIndex = Math.max(
            0,
            Math.floor(
              (windowStart.getFullYear() - start.getFullYear()) / interval
            ) - 2
          );
        else if (unit === 'month')
          firstIndex = Math.max(
            0,
            Math.floor(
              ((windowStart.getFullYear() - start.getFullYear()) * 12 +
                windowStart.getMonth() -
                start.getMonth()) /
                interval
            ) - 2
          );
        else if (unit === 'week' || unit === 'day')
          firstIndex = Math.max(
            0,
            Math.floor(
              (windowStart.getTime() - start.getTime()) /
                (DAY_MS * interval * (unit === 'week' ? 7 : 1))
            ) - 2
          );
        else if (unit === 'hour' || unit === 'minute')
          firstIndex = Math.max(
            0,
            Math.floor(
              (windowStart.getTime() - start.getTime()) /
                (60000 * interval * (unit === 'hour' ? 60 : 1))
            ) - 2
          );
      }
      for (let i = firstIndex; i < count && i < firstIndex + 20000; i++) {
        const timeParts = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(event.time || '');
        const timedStart = new Date(start);
        if (timeParts)
          timedStart.setHours(Number(timeParts[1]), Number(timeParts[2]), 0, 0);
        const occurrence = nextOccurrence(
          timedStart,
          i,
          r.unit,
          Number(r.interval)
        );
        if (until && keyOf(occurrence) > keyOf(until)) break;
        if (occurrence > maxDate) break;
        const occurrenceDay = new Date(
          occurrence.getFullYear(),
          occurrence.getMonth(),
          occurrence.getDate()
        );
        const occurrenceTime =
          (r.unit === 'minute' || r.unit === 'hour') && timeParts
            ? `${String(occurrence.getHours()).padStart(2, '0')}:${String(
                occurrence.getMinutes()
              ).padStart(2, '0')}`
            : event.time;
        addRange(
          occurrenceDay,
          new Date(
            occurrenceDay.getFullYear(),
            occurrenceDay.getMonth(),
            occurrenceDay.getDate() + duration
          ),
          { ...event, time: occurrenceTime },
          `${event.id || idx}-${i}`
        );
      }
    }
  );
  return map;
}

export default function AdminCalendar({ events = [], permissions = {} }) {
  const [currentMonth, setCurrentMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(() => formFor(new Date()));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [eventToDelete, setEventToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const uid = auth.currentUser?.uid || '';
  const isAdmin = uid === ADMIN_UID;
  const canCreate = isAdmin || Boolean(permissions.create);
  const canEdit = isAdmin || Boolean(permissions.editOwn || permissions.edit);
  const canDelete = isAdmin;
  const month = currentMonth.getMonth();
  const year = currentMonth.getFullYear();
  const eventMap = useMemo(() => buildEventMap(events, year), [events, year]);
  const days = useMemo(() => {
    const first = new Date(year, month, 1);
    const offset = (first.getDay() + 6) % 7;
    const start = new Date(year, month, 1 - offset);
    return Array.from(
      { length: 42 },
      (_, i) =>
        new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    );
  }, [year, month]);
  const selectedEvents = eventMap[keyOf(selectedDate)] || [];
  const setField = (field, value) =>
    setForm((previous) => ({
      ...previous,
      [field]: value,
      ...(field === 'date' && previous.endDate < value
        ? { endDate: value }
        : {}),
    }));

  function selectDate(date) {
    setSelectedDate(date);
    if (date.getMonth() !== month || date.getFullYear() !== year)
      setCurrentMonth(new Date(date.getFullYear(), date.getMonth(), 1));
  }

  function openCreate() {
    if (!canCreate) return;
    setEditing(null);
    setForm(formFor(selectedDate));
    setEmojiOpen(false);
    setShowMore(false);
    setError('');
    setFormOpen(true);
  }

  function openEdit(event) {
    if (
      event.systemHoliday ||
      !canEdit ||
      (!isAdmin && event.createdBy !== uid)
    )
      return;
    const start = parseDate(event.date) || selectedDate;
    const end = parseDate(event.endDate) || start;
    const r = recurrenceOf(event);
    setEditing(event);
    setForm({
      title: event.title || '',
      description: event.description || '',
      location: event.location || '',
      date: keyOf(start),
      endDate: keyOf(end),
      time: event.time || '',
      endTime: event.endTime || '',
      type: event.type || 'other',
      emoji: event.emoji || '📅',
      recurring: Boolean(r),
      interval: r?.interval || 1,
      unit: r?.unit || 'week',
      until: r?.until || '',
      count: r?.count || 20,
    });
    setEmojiOpen(false);
    setShowMore(Boolean(event.description || event.location));
    setError('');
    setFormOpen(true);
  }

  async function save(event) {
    event.preventDefault();
    if (saving) return;
    const user = auth.currentUser;
    if (!user || user.isAnonymous)
      return setError('Zaloguj się, aby zapisać wydarzenie.');
    if (!form.title.trim()) return setError('Wpisz nazwę wydarzenia.');
    if (
      !parseDate(form.date) ||
      !parseDate(form.endDate) ||
      form.endDate < form.date
    )
      return setError('Sprawdź datę rozpoczęcia i zakończenia.');
    if (
      form.recurring &&
      (form.unit === 'minute' || form.unit === 'hour') &&
      !form.time
    )
      return setError(
        'Dla powtarzania co minuty lub godziny podaj godzinę rozpoczęcia.'
      );
    if (
      form.recurring &&
      (!Number.isInteger(Number(form.interval)) ||
        Number(form.interval) < 1 ||
        Number(form.interval) > 9999)
    )
      return setError('Podaj poprawną częstotliwość powtarzania.');
    if (
      form.recurring &&
      (!Number.isInteger(Number(form.count)) ||
        Number(form.count) < 1 ||
        Number(form.count) > MAX_OCCURRENCES)
    )
      return setError(
        `Liczba powtórzeń musi wynosić od 1 do ${MAX_OCCURRENCES}.`
      );
    if (
      form.recurring &&
      form.until &&
      (!parseDate(form.until) || form.until < form.date)
    )
      return setError('Data końca powtarzania musi być poprawna.');
    if (editing && (!canEdit || (!isAdmin && editing.createdBy !== uid)))
      return setError('Nie możesz edytować tego wydarzenia.');
    if (!editing && !canCreate)
      return setError('Nie masz uprawnień do dodawania.');
    setSaving(true);
    setError('');
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      location: form.location.trim(),
      date: form.date,
      endDate: form.endDate,
      time: form.time,
      endTime: form.endTime,
      type: form.type,
      emoji: form.emoji || '📅',
      recurring: form.recurring,
      recurrence: form.recurring
        ? {
            enabled: true,
            interval: Number(form.interval),
            unit: form.unit,
            count: Number(form.count),
            until: form.until || '',
          }
        : { enabled: false },
      updatedAt: serverTimestamp(),
    };
    try {
      if (editing) await updateDoc(doc(db, 'events', editing.id), payload);
      else
        await addDoc(collection(db, 'events'), {
          ...payload,
          createdBy: uid,
          createdAt: serverTimestamp(),
        });
      setMessage(
        editing ? 'Zapisano zmiany wydarzenia.' : 'Dodano nowe wydarzenie.'
      );
      setFormOpen(false);
    } catch (e) {
      console.error('Błąd zapisu wydarzenia:', e);
      setError(
        e.code === 'permission-denied'
          ? 'Firestore odrzucił zapis. Sprawdź uprawnienia kalendarza.'
          : 'Nie udało się zapisać wydarzenia.'
      );
    } finally {
      setSaving(false);
    }
  }

  function requestDelete(event) {
    if (!canDelete || event.systemHoliday || !event.id || deleting) return;
    setDeleteError('');
    setEventToDelete(event);
  }

  function cancelDelete() {
    if (deleting) return;
    setEventToDelete(null);
    setDeleteError('');
  }

  async function confirmDelete() {
    if (!eventToDelete || !canDelete || eventToDelete.systemHoliday || deleting)
      return;
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteDoc(doc(db, 'events', eventToDelete.id));
      setEventToDelete(null);
      setMessage('Usunięto wydarzenie.');
    } catch (e) {
      console.error('Błąd usuwania wydarzenia:', e);
      setDeleteError(
        e?.code === 'permission-denied'
          ? 'Nie masz uprawnień do usunięcia tego wydarzenia.'
          : 'Nie udało się usunąć wydarzenia. Spróbuj ponownie.'
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="calendar-wrapper acm">
      <div className="acm-toolbar">
        <div className="acm-heading">
          <span className="acm-kicker">KALENDARZ WYDARZEŃ</span>
          <h2>
            {MONTHS[month]} <span>{year}</span>
          </h2>
        </div>
        <div className="acm-toolbar-actions">
          <div className="acm-nav">
            <button
              type="button"
              onClick={() => setCurrentMonth(new Date(year, month - 1, 1))}
              aria-label="Poprzedni miesiąc"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => {
                const d = new Date();
                selectDate(d);
              }}
              className="acm-today"
            >
              Dzisiaj
            </button>
            <button
              type="button"
              onClick={() => setCurrentMonth(new Date(year, month + 1, 1))}
              aria-label="Następny miesiąc"
            >
              ›
            </button>
          </div>
          {canCreate && (
            <button type="button" className="acm-primary" onClick={openCreate}>
              <span>＋</span> Nowe wydarzenie
            </button>
          )}
        </div>
      </div>
      {message && (
        <div className="acm-message" role="status">
          {message}
          <button type="button" onClick={() => setMessage('')}>
            ×
          </button>
        </div>
      )}
      <div className="react-calendar acm-grid">
        <div className="react-calendar__month-view">
          <div className="react-calendar__month-view__weekdays">
            {WEEK_DAYS.map((day) => (
              <div
                key={day}
                className="react-calendar__month-view__weekdays__weekday"
              >
                <abbr>{day}</abbr>
              </div>
            ))}
          </div>
          <div className="react-calendar__month-view__days">
            {days.map((date) => {
              const items = eventMap[keyOf(date)] || [];
              const holiday = items.filter((e) => e.systemHoliday);
              const personal = items.filter((e) => !e.systemHoliday);
              const classes = [
                'react-calendar__tile',
                date.toDateString() === new Date().toDateString()
                  ? 'react-calendar__tile--now'
                  : '',
                date.toDateString() === selectedDate.toDateString()
                  ? 'react-calendar__tile--active'
                  : '',
                date.getMonth() !== month
                  ? 'react-calendar__tile--neighboringMonth'
                  : '',
                [0, 6].includes(date.getDay())
                  ? 'react-calendar__tile--weekend'
                  : '',
                holiday.length ? 'calendar-tile-holiday' : '',
              ]
                .filter(Boolean)
                .join(' ');
              return (
                <button
                  key={keyOf(date)}
                  type="button"
                  className={classes}
                  onClick={() => selectDate(date)}
                >
                  <abbr>{date.getDate()}</abbr>
                  {items.length > 0 && (
                    <div className="acm-day-agenda">
                      <span
                        className={`acm-agenda-item acm-agenda-item--${
                          items[0].systemHoliday ? 'holiday' : 'event'
                        } acm-agenda-item--${items[0].type || 'other'}`}
                        title={items
                          .map(
                            (item) =>
                              `${item.title || 'Wydarzenie'}${
                                item.time ? ` · ${item.time}` : ''
                              }`
                          )
                          .join('\n')}
                      >
                        <span
                          className="acm-agenda-accent"
                          aria-hidden="true"
                        />
                        <span className="acm-agenda-emoji" aria-hidden="true">
                          {items[0].emoji ||
                            TYPES.find((type) => type.id === items[0].type)
                              ?.emoji ||
                            '📅'}
                        </span>
                        <span className="acm-agenda-title">
                          {items[0].title ||
                            TYPES.find((type) => type.id === items[0].type)
                              ?.label ||
                            'Wydarzenie'}
                        </span>
                        {items.length > 1 ? (
                          <span className="acm-agenda-count">
                            +{items.length - 1}
                          </span>
                        ) : (
                          !items[0].systemHoliday &&
                          items[0].time && (
                            <span className="acm-agenda-time">
                              {items[0].time}
                            </span>
                          )
                        )}
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <aside className="calendar-events acm-events">
        <div className="calendar-events-header">
          <div>
            <h3>{dateLabel(selectedDate)}</h3>
            <p>Wydarzenia na wybrany dzień</p>
          </div>
          <div className="acm-events-actions">
            <span className="calendar-events-count">
              {selectedEvents.length}
            </span>
            {canCreate && (
              <button
                type="button"
                onClick={openCreate}
                className="acm-small-add"
              >
                ＋ Dodaj
              </button>
            )}
          </div>
        </div>
        {selectedEvents.length === 0 ? (
          <div className="calendar-empty">
            <div className="calendar-empty-icon">📅</div>
            <h3>Brak wydarzeń</h3>
            <p>Wybierz inny dzień lub dodaj wydarzenie.</p>
          </div>
        ) : (
          selectedEvents.map((event) => {
            const originalStart = parseDate(event.date);
            const originalEnd = parseDate(event.endDate) || originalStart;
            const isRecurring = Boolean(recurrenceOf(event));
            const start = isRecurring ? selectedDate : originalStart;
            const end = isRecurring ? selectedDate : originalEnd;
            const type = TYPES.find((t) => t.id === event.type);
            const editable =
              !event.systemHoliday &&
              canEdit &&
              (isAdmin || event.createdBy === uid);
            return (
              <article
                key={event._occurrenceId}
                className={`calendar-event-card ${
                  event.systemHoliday ? 'calendar-event-card--system' : ''
                }`}
              >
                <div className="calendar-event-bar" />
                <div className="calendar-event-time">
                  <strong>{event.time || 'Cały dzień'}</strong>
                  {event.endTime && <span>– {event.endTime}</span>}
                  {start && (
                    <span>
                      {start.toLocaleDateString('pl-PL', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </span>
                  )}
                  {start && end && keyOf(start) !== keyOf(end) && (
                    <span>
                      →{' '}
                      {end.toLocaleDateString('pl-PL', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </span>
                  )}
                </div>
                <div className="calendar-event-content">
                  <div className="calendar-event-category">
                    {type?.label || event.type || 'Wydarzenie'}
                    {event.systemHoliday && (
                      <span>
                        {event.publicHoliday
                          ? ' · dzień wolny'
                          : ' · kalendarz'}
                      </span>
                    )}
                  </div>
                  <h4>
                    {event.emoji || '📅'} {event.title}
                  </h4>
                  {event.location && <p>📍 {event.location}</p>}
                  {event.description && <p>{event.description}</p>}
                  {recurrenceOf(event) && (
                    <small>
                      🔁 Co {event.recurrence.interval}{' '}
                      {UNITS.find((u) => u.id === event.recurrence.unit)
                        ?.label || ''}
                    </small>
                  )}
                </div>
                {(editable || (!event.systemHoliday && canDelete)) && (
                  <div className="calendar-event-actions">
                    {editable && (
                      <button
                        type="button"
                        className="calendar-event-action"
                        onClick={() => openEdit(event)}
                        aria-label="Edytuj wydarzenie"
                      >
                        ✏️
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        className="calendar-event-action"
                        onClick={() => requestDelete(event)}
                        aria-label="Usuń wydarzenie"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                )}
              </article>
            );
          })
        )}
      </aside>
      <ConfirmDialog
        open={Boolean(eventToDelete)}
        variant="danger"
        title="Usunąć wydarzenie?"
        message={
          <>
            Czy na pewno chcesz usunąć wydarzenie{' '}
            <strong>„{eventToDelete?.title || 'Bez nazwy'}”</strong>?
            <p style={{ marginTop: 10 }}>
              {eventToDelete?.recurrence?.enabled
                ? 'Usunięte zostaną również wszystkie wystąpienia tego wydarzenia. Tej operacji nie można cofnąć.'
                : 'Tej operacji nie można cofnąć.'}
            </p>
          </>
        }
        confirmText="Usuń wydarzenie"
        cancelText="Anuluj"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      >
        {deleteError && (
          <p role="alert" style={{ marginTop: 12, color: '#ff9297' }}>
            {deleteError}
          </p>
        )}
      </ConfirmDialog>
      {formOpen && (
        <div
          className="acm-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !saving) setFormOpen(false);
          }}
        >
          <section
            className="acm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="acm-dialog-title"
          >
            <header className="acm-dialog-header">
              <div>
                <span className="acm-kicker">
                  {editing ? 'EDYCJA WYDARZENIA' : 'NOWE WYDARZENIE'}
                </span>
                <h2 id="acm-dialog-title">
                  {editing ? 'Edytuj wydarzenie' : 'Dodaj wydarzenie'}
                </h2>
              </div>
              <button
                type="button"
                className="acm-close"
                aria-label="Zamknij"
                onClick={() => setFormOpen(false)}
                disabled={saving}
              >
                ×
              </button>
            </header>
            <form onSubmit={save} className="acm-form">
              <label className="acm-field">
                <span>
                  Nazwa wydarzenia <b>*</b>
                </span>
                <input
                  autoFocus
                  value={form.title}
                  onChange={(e) => setField('title', e.target.value)}
                  maxLength={150}
                  placeholder="Np. Spotkanie zespołu"
                  required
                />
              </label>
              <div className="acm-section-label">Rodzaj wydarzenia</div>
              <div className="acm-type-grid">
                {TYPES.map((type) => (
                  <button
                    type="button"
                    key={type.id}
                    className={`acm-type ${
                      form.type === type.id ? 'selected' : ''
                    }`}
                    onClick={() => {
                      setForm((p) => ({
                        ...p,
                        type: type.id,
                        emoji: type.emoji,
                      }));
                    }}
                  >
                    {type.emoji}
                    <span>{type.label}</span>
                  </button>
                ))}
              </div>
              <div className="acm-form-row">
                <SharedDatePicker
                  label="Od"
                  name="date"
                  value={form.date}
                  onChange={(value) => setField('date', value)}
                  required
                  disabled={saving}
                />
                <SharedDatePicker
                  label="Do"
                  name="endDate"
                  value={form.endDate}
                  onChange={(value) => setField('endDate', value)}
                  min={form.date}
                  required
                  disabled={saving}
                />
              </div>
              <div className="acm-form-row">
                <label className="acm-field">
                  <span>Godzina od</span>
                  <input
                    type="time"
                    value={form.time}
                    onChange={(e) => setField('time', e.target.value)}
                  />
                </label>
                <label className="acm-field">
                  <span>Godzina do</span>
                  <input
                    type="time"
                    value={form.endTime}
                    onChange={(e) => setField('endTime', e.target.value)}
                  />
                </label>
              </div>
              <div className="acm-emoji-row">
                <div>
                  <span className="acm-section-label">Ikona wydarzenia</span>
                  <small>Wybierz emoji z palety</small>
                </div>
                <button
                  type="button"
                  className="acm-emoji-trigger"
                  onClick={() => setEmojiOpen((v) => !v)}
                  aria-expanded={emojiOpen}
                >
                  {form.emoji || '📅'}{' '}
                  <span>{emojiOpen ? 'Zamknij' : 'Zmień'}</span>
                </button>
              </div>
              {emojiOpen && (
                <div className="acm-emoji-grid">
                  {EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      className={form.emoji === emoji ? 'selected' : ''}
                      onClick={() => {
                        setField('emoji', emoji);
                        setEmojiOpen(false);
                      }}
                    >
                      {emoji}
                    </button>
                  ))}
                  <input
                    aria-label="Własne emoji"
                    placeholder="Własne emoji"
                    maxLength={12}
                    value={EMOJIS.includes(form.emoji) ? '' : form.emoji}
                    onChange={(e) => setField('emoji', e.target.value)}
                  />
                </div>
              )}
              <div className="acm-repeat">
                <label className="acm-switch-row">
                  <span>
                    <strong>🔁 Powtarzaj wydarzenie</strong>
                    <small>Ustaw częstotliwość i liczbę wystąpień</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={form.recurring}
                    onChange={(e) => setField('recurring', e.target.checked)}
                  />
                  <span className="acm-switch" />
                </label>
                {form.recurring && (
                  <div className="acm-repeat-details">
                    <div className="acm-repeat-line">
                      <span>Powtarzaj co</span>
                      <input
                        type="number"
                        min="1"
                        max="9999"
                        value={form.interval}
                        onChange={(e) => setField('interval', e.target.value)}
                      />
                      <div className="acm-unit-picker">
                        {UNITS.map((unit) => (
                          <button
                            key={unit.id}
                            type="button"
                            className={form.unit === unit.id ? 'selected' : ''}
                            onClick={() => setField('unit', unit.id)}
                          >
                            {unit.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="acm-form-row">
                      <label className="acm-field">
                        <span>Liczba wystąpień</span>
                        <input
                          type="number"
                          min="1"
                          max={MAX_OCCURRENCES}
                          value={form.count}
                          onChange={(e) => setField('count', e.target.value)}
                        />
                      </label>
                      <SharedDatePicker
                        label="Nie później niż (opcjonalnie)"
                        name="until"
                        value={form.until}
                        onChange={(value) => setField('until', value)}
                        min={form.date}
                        disabled={saving}
                      />
                    </div>
                    <p className="acm-hint">
                      Powtórzenia będą widoczne w kalendarzu. Minuty i godziny
                      dotyczą odstępu między wystąpieniami.
                    </p>
                  </div>
                )}
              </div>
              <button
                type="button"
                className="acm-more-toggle"
                onClick={() => setShowMore((v) => !v)}
              >
                {showMore ? '⌃ Ukryj szczegóły' : '⌄ Dodaj miejsce i opis'}
              </button>
              {showMore && (
                <div className="acm-more-fields">
                  <label className="acm-field">
                    <span>Miejsce</span>
                    <input
                      value={form.location}
                      onChange={(e) => setField('location', e.target.value)}
                      maxLength={200}
                      placeholder="Np. Sala konferencyjna"
                    />
                  </label>
                  <label className="acm-field">
                    <span>Opis</span>
                    <textarea
                      value={form.description}
                      onChange={(e) => setField('description', e.target.value)}
                      maxLength={2000}
                      rows={3}
                      placeholder="Dodatkowe informacje"
                    />
                  </label>
                </div>
              )}
              {error && (
                <p role="alert" className="acm-error">
                  {error}
                </p>
              )}
              <footer className="acm-dialog-footer">
                <button
                  type="button"
                  className="acm-secondary"
                  disabled={saving}
                  onClick={() => setFormOpen(false)}
                >
                  Anuluj
                </button>
                <button type="submit" className="acm-primary" disabled={saving}>
                  {saving
                    ? 'Zapisywanie…'
                    : editing
                    ? 'Zapisz zmiany'
                    : 'Dodaj wydarzenie'}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}
