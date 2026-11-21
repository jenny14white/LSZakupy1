import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';

import { auth, db } from '../../firebase/firebase';
import { isAdminUid } from '../../config/roles';
import { formatDate, getDateObject } from '../../utils/dateUtils';
import CustomSelect from './CustomSelect';
import SharedDatePicker from '../shared/SharedDatePicker';

import '../../styles/admin-event-log.css';

const PAGE_SIZE = 20;

const ACTION_CONFIG = {
  create: {
    label: 'Dodano',
    icon: '＋',
    className: 'create',
  },
  edit: {
    label: 'Edytowano',
    icon: '✎',
    className: 'edit',
  },
  delete: {
    label: 'Usunięto',
    icon: '×',
    className: 'delete',
  },
  accept: {
    label: 'Przyjęto do realizacji',
    icon: '✓',
    className: 'accept',
  },
  complete: {
    label: 'Zrealizowano',
    icon: '✓',
    className: 'complete',
  },
  assign: {
    label: 'Przypisano / przejęto',
    icon: '↗',
    className: 'accept',
  },
  cancel: {
    label: 'Anulowano',
    icon: '×',
    className: 'delete',
  },
  read: {
    label: 'Oznaczono jako przeczytane',
    icon: '✓',
    className: 'other',
  },
  unread: {
    label: 'Oznaczono jako nieprzeczytane',
    icon: '•',
    className: 'other',
  },
  other: {
    label: 'Inne zdarzenie',
    icon: '•',
    className: 'other',
  },
};

const MODULE_CONFIG = {
  orders: 'Zamówienia',
  calendar: 'Kalendarz',
  users: 'Użytkownicy',
  notifications: 'Powiadomienia',
  other: 'Pozostałe',
};

const ACTION_ALIASES = {
  created: 'create',
  added: 'create',
  updated: 'edit',
  edited: 'edit',
  deleted: 'delete',
  removed: 'delete',
  accepted: 'accept',
  completed: 'complete',
  assigned: 'assign',
  cancelled: 'cancel',
  canceled: 'cancel',
};

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeAction(value) {
  const action = cleanText(value).toLowerCase();

  return ACTION_ALIASES[action] || action;
}

function normalizeModule(value) {
  const module = cleanText(value).toLowerCase();

  if (['shopping', 'order', 'orders', 'zamówienia'].includes(module)) {
    return 'orders';
  }

  if (['calendar', 'events', 'kalendarz'].includes(module)) {
    return 'calendar';
  }

  if (['user', 'users', 'użytkownicy'].includes(module)) {
    return 'users';
  }

  if (['notification', 'notifications', 'powiadomienia'].includes(module)) {
    return 'notifications';
  }

  return module;
}

function detectModule(message, type) {
  const text = cleanText(message).toLowerCase();
  const rawType = cleanText(type).toLowerCase();

  if (
    /zamówien|zamowien|zamówieni|zamowieni|zgłoszen|zgloszen|zgłoszeni|zgloszeni|produkt/.test(
      text
    )
  ) {
    return 'orders';
  }

  if (/kalendarz|wydarzeni|spotkani|termin|urlop|święt|swiet/.test(text)) {
    return 'calendar';
  }

  if (/użytkownik|uzytkownik|pracownik|konto użytkownika/.test(text)) {
    return 'users';
  }

  if (/powiadomieni/.test(text) || ['read', 'unread'].includes(rawType)) {
    return 'notifications';
  }

  return 'other';
}

function detectAction(message) {
  const text = cleanText(message).toLowerCase();

  if (/usunął|usunęła|usunięt|usunięto|usunal|usunela/.test(text)) {
    return 'delete';
  }

  if (/edytował|edytowała|edytowano|zmodyfikowano/.test(text)) {
    return 'edit';
  }

  if (/przypisał|przypisała|przejął|przejęła/.test(text)) {
    return 'assign';
  }

  if (/zrealizowano|zrealizował|zrealizowane/.test(text)) {
    return 'complete';
  }

  if (/przyjęto|przyjął|przyjęła/.test(text)) {
    return 'accept';
  }

  if (/anulowano|anulował|anulowała/.test(text)) {
    return 'cancel';
  }

  if (/dodał|dodała|dodano|utworzono/.test(text)) {
    return 'create';
  }

  if (/zmienił|zmieniła|zmieniono/.test(text)) {
    return 'edit';
  }

  return 'other';
}

function getAction(log) {
  const explicit = normalizeAction(log.action || log.type);

  if (ACTION_CONFIG[explicit] && explicit !== 'other') {
    return explicit;
  }

  return detectAction(log.message);
}

function getModule(log) {
  const explicit = normalizeModule(log.module);

  if (explicit && explicit !== 'other') {
    return explicit;
  }

  return detectModule(log.message, log.type);
}

function getUserName(log) {
  return (
    cleanText(log.actorName) ||
    cleanText(log.createdByName) ||
    cleanText(log.performedByName) ||
    cleanText(log.displayName) ||
    cleanText(log.userName) ||
    cleanText(log.userDisplayName) ||
    cleanText(log.user?.displayName) ||
    cleanText(log.user?.name) ||
    cleanText(log.user) ||
    cleanText(log.userEmail) ||
    cleanText(log.actorEmail) ||
    cleanText(log.email) ||
    'Nieznany użytkownik'
  );
}

function getUserId(log) {
  return cleanText(
    log.actorUid ||
      log.createdByUid ||
      log.performedByUid ||
      log.userUid ||
      log.userId ||
      log.uid ||
      log.actorId ||
      log.createdBy
  );
}

function getProfileName(profile) {
  const firstName = cleanText(profile.firstName || profile.imie);
  const lastName = cleanText(profile.lastName || profile.nazwisko);

  return (
    `${firstName} ${lastName}`.trim() ||
    cleanText(profile.displayName) ||
    cleanText(profile.fullName) ||
    cleanText(profile.name) ||
    cleanText(profile.email)
  );
}

function getLocalDateKey(value) {
  const date = getDateObject(value);

  if (!date) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function getActionConfig(log) {
  const key = getAction(log);

  return (
    ACTION_CONFIG[key] || {
      label: key || 'Inne zdarzenie',
      icon: '•',
      className: 'other',
    }
  );
}

export default function AdminEventLog({
  logs = [],
  onRefresh,
  permissions = {},
}) {
  const [profiles, setProfiles] = useState([]);
  const [profilesError, setProfilesError] = useState(false);

  const [moduleFilter, setModuleFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    if (!isAdminUid(auth.currentUser?.uid)) {
      setProfiles([]);
      setProfilesError(false);
      return;
    }

    const unsubscribe = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        setProfiles(
          snapshot.docs.map((item) => ({
            ...item.data(),
            id: item.id,
          }))
        );

        setProfilesError(false);
      },
      (error) => {
        console.error('Błąd pobierania użytkowników:', error);
        setProfilesError(true);
      }
    );

    return () => unsubscribe();
  }, []);

  const safeLogs = useMemo(() => (Array.isArray(logs) ? logs : []), [logs]);

  const profileNamesByUid = useMemo(() => {
    const map = new Map();

    profiles.forEach((profile) => {
      const uid = cleanText(profile.uid || profile.id);
      const name = getProfileName(profile);

      if (uid && name) {
        map.set(uid, name);
      }
    });

    return map;
  }, [profiles]);

  const userOptions = useMemo(() => {
    const usersMap = new Map();

    profiles.forEach((profile) => {
      const name = getProfileName(profile);
      const uid = cleanText(profile.uid || profile.id);

      if (!name) return;

      const key = uid ? `uid:${uid}` : `name:${name.toLowerCase()}`;

      usersMap.set(key, {
        value: key,
        label: name,
      });
    });

    safeLogs.forEach((log) => {
      const uid = getUserId(log);
      const name = profileNamesByUid.get(uid) || getUserName(log);

      if (name === 'Nieznany użytkownik') return;

      const key = uid ? `uid:${uid}` : `name:${name.toLowerCase()}`;

      if (!usersMap.has(key)) {
        usersMap.set(key, {
          value: key,
          label: name,
        });
      }
    });

    return Array.from(usersMap.values()).sort((a, b) =>
      a.label.localeCompare(b.label, 'pl')
    );
  }, [profiles, safeLogs, profileNamesByUid]);

  const moduleOptions = useMemo(() => {
    const known = ['orders', 'calendar', 'users', 'notifications', 'other'];

    const values = new Set(known);

    safeLogs.forEach((log) => {
      values.add(getModule(log));
    });

    return Array.from(values)
      .filter(Boolean)
      .map((value) => ({
        value,
        label: MODULE_CONFIG[value] || value,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'pl'));
  }, [safeLogs]);

  const actionOptions = useMemo(() => {
    const known = [
      'create',
      'edit',
      'delete',
      'accept',
      'complete',
      'assign',
      'cancel',
      'read',
      'unread',
      'other',
    ];

    const values = new Set(known);

    safeLogs.forEach((log) => {
      values.add(getAction(log));
    });

    return Array.from(values)
      .filter(Boolean)
      .map((value) => ({
        value,
        label: ACTION_CONFIG[value]?.label || value,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'pl'));
  }, [safeLogs]);

  const filteredLogs = useMemo(() => {
    return safeLogs
      .filter((log) => {
        if (moduleFilter !== 'all' && getModule(log) !== moduleFilter) {
          return false;
        }

        if (userFilter !== 'all') {
          const uid = getUserId(log);
          const rawName = getUserName(log).toLowerCase();
          const profileName = (profileNamesByUid.get(uid) || '').toLowerCase();

          if (userFilter.startsWith('uid:')) {
            if (uid !== userFilter.slice(4)) return false;
          } else if (userFilter.startsWith('name:')) {
            const selectedName = userFilter.slice(5);

            if (rawName !== selectedName && profileName !== selectedName) {
              return false;
            }
          }
        }

        if (actionFilter !== 'all' && getAction(log) !== actionFilter) {
          return false;
        }

        const dateKey = getLocalDateKey(log.createdAt);

        if (dateFrom && (!dateKey || dateKey < dateFrom)) {
          return false;
        }

        if (dateTo && (!dateKey || dateKey > dateTo)) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        const dateA = getDateObject(a.createdAt)?.getTime() ?? 0;
        const dateB = getDateObject(b.createdAt)?.getTime() ?? 0;

        return dateB - dateA;
      });
  }, [
    safeLogs,
    moduleFilter,
    userFilter,
    actionFilter,
    dateFrom,
    dateTo,
    profileNamesByUid,
  ]);

  const visibleLogs = useMemo(
    () => filteredLogs.slice(0, visibleCount),
    [filteredLogs, visibleCount]
  );

  const hasMore = visibleCount < filteredLogs.length;

  const hasFilters =
    moduleFilter !== 'all' ||
    userFilter !== 'all' ||
    actionFilter !== 'all' ||
    Boolean(dateFrom) ||
    Boolean(dateTo);

  function updateFilter(setter, value) {
    setter(value);
    setVisibleCount(PAGE_SIZE);
  }

  function clearFilters() {
    setModuleFilter('all');
    setUserFilter('all');
    setActionFilter('all');
    setDateFrom('');
    setDateTo('');
    setVisibleCount(PAGE_SIZE);
  }

  return (
    <section className="event-log-page">
      <section className="event-log-filter-panel">
        <div className="event-log-filter-heading">
          <div>
            <h2>Filtruj zdarzenia</h2>
            <p>Wybierz moduł, użytkownika, rodzaj operacji i zakres dat.</p>
          </div>

          <div className="event-log-toolbar">
            {hasFilters && (
              <button
                type="button"
                className="event-log-clear"
                onClick={clearFilters}
              >
                × Wyczyść filtry
              </button>
            )}

            {typeof onRefresh === 'function' && (
              <button
                type="button"
                className="event-log-clear"
                onClick={onRefresh}
              >
                ↻ Odśwież
              </button>
            )}
          </div>
        </div>

        <div className="event-log-filters">
          <div className="event-log-filter">
            <label htmlFor="event-module-filter">Moduł</label>

            <div className="event-log-input-wrap">
              <CustomSelect
                id="event-module-filter"
                value={moduleFilter}
                onChange={(value) => updateFilter(setModuleFilter, value)}
                searchable
                options={[
                  {
                    value: 'all',
                    label: 'Wszystkie moduły',
                  },
                  ...moduleOptions,
                ]}
              />
            </div>
          </div>

          <div className="event-log-filter">
            <label htmlFor="event-user-filter">Użytkownik</label>

            <div className="event-log-input-wrap">
              <CustomSelect
                id="event-user-filter"
                value={userFilter}
                onChange={(value) => updateFilter(setUserFilter, value)}
                searchable
                options={[
                  {
                    value: 'all',
                    label: 'Wszyscy użytkownicy',
                  },
                  ...userOptions,
                ]}
              />
            </div>
          </div>

          <div className="event-log-filter">
            <label htmlFor="event-action-filter">Rodzaj operacji</label>

            <div className="event-log-input-wrap">
              <CustomSelect
                id="event-action-filter"
                value={actionFilter}
                onChange={(value) => updateFilter(setActionFilter, value)}
                searchable
                options={[
                  {
                    value: 'all',
                    label: 'Wszystkie operacje',
                  },
                  ...actionOptions,
                ]}
              />
            </div>
          </div>

          <div className="event-log-filter">
            <div className="event-log-input-wrap">
              <SharedDatePicker
                id="event-date-from"
                label="Data od"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={(value) => updateFilter(setDateFrom, value)}
                placeholder="Wybierz datę początkową"
              />
            </div>
          </div>

          <div className="event-log-filter">
            <div className="event-log-input-wrap">
              <SharedDatePicker
                id="event-date-to"
                label="Data do"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(value) => updateFilter(setDateTo, value)}
                placeholder="Wybierz datę końcową"
              />
            </div>
          </div>
        </div>

        <div className="event-log-filter-footer">
          <span>
            Znaleziono <strong>{filteredLogs.length}</strong> z{' '}
            <strong>{safeLogs.length}</strong> zdarzeń
          </span>

          {profilesError && (
            <span>
              Nie udało się pobrać listy użytkowników. Dostępni są autorzy
              zapisani w dzienniku.
            </span>
          )}
        </div>
      </section>

      <section className="event-log-results">
        <div className="event-log-results-heading">
          <h2>Historia aktywności</h2>

          <span className="event-log-results-count">
            {filteredLogs.length} wpisów
          </span>
        </div>

        {!safeLogs.length ? (
          <div className="event-empty">
            <h3>Brak zdarzeń</h3>
            <p>Nie znaleziono zapisanych operacji w dzienniku.</p>
          </div>
        ) : !filteredLogs.length ? (
          <div className="event-empty">
            <h3>Brak wyników</h3>
            <p>Żadne zdarzenie nie pasuje do wybranych filtrów.</p>
          </div>
        ) : (
          <>
            <div className="event-list">
              {visibleLogs.map((log, index) => {
                const action = getActionConfig(log);
                const createdAt = getDateObject(log.createdAt);
                const uid = getUserId(log);

                const userName = profileNamesByUid.get(uid) || getUserName(log);

                const moduleKey = getModule(log);
                const moduleName = MODULE_CONFIG[moduleKey] || moduleKey;

                const message = cleanText(log.message);

                return (
                  <article
                    key={log.id ?? `event-${index}`}
                    className={`event-card event-card-${action.className}`}
                  >
                    <div className="event-card-icon" aria-hidden="true">
                      {action.icon}
                    </div>

                    <div className="event-card-main">
                      <div className="event-card-top">
                        <span
                          className={`event-action-badge event-action-${action.className}`}
                        >
                          {action.label}
                        </span>

                        <span className="event-card-date">
                          ◷ {createdAt ? formatDate(createdAt) : 'Brak daty'}
                        </span>
                      </div>

                      <div className="event-message">
                        <strong>{userName}</strong>
                        {' — '}
                        {message || 'Wykonano operację systemową.'}
                      </div>

                      <div className="event-card-bottom">
                        <span className="event-card-user">
                          <span aria-hidden="true">▦</span>
                          {moduleName}
                        </span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            {hasMore && (
              <div className="event-log-pagination">
                <button
                  type="button"
                  className="event-log-load-more"
                  onClick={() =>
                    setVisibleCount((previous) =>
                      Math.min(previous + PAGE_SIZE, filteredLogs.length)
                    )
                  }
                >
                  Pokaż kolejne{' '}
                  {Math.min(PAGE_SIZE, filteredLogs.length - visibleCount)}{' '}
                  zdarzeń ↓
                </button>
              </div>
            )}

            <div className="event-log-filter-footer">
              Wyświetlono {visibleLogs.length} z {filteredLogs.length} wyników
            </div>
          </>
        )}
      </section>
    </section>
  );
}
