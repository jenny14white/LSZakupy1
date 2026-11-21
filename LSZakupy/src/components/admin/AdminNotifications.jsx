import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';

import EmptyState from '../shared/EmptyState';
import { auth, db } from '../../firebase/firebase';
import { ADMIN_UID } from '../../config/roles';
import { formatDate } from '../../utils/dateUtils';

import {
  markNotificationAsRead,
  markNotificationAsUnread,
} from '../../services/ordersService';

import '../../styles/admin-notifications.css';

const notificationStyles = `
.admin-page .admin-notifications {
  display: flex;
  flex-direction: column;
  gap: 22px;
  width: 100%;
  min-width: 0;
  margin: 0;
  padding: 0;
}

.admin-page .admin-notifications *,
.admin-page .admin-notifications *::before,
.admin-page .admin-notifications *::after {
  box-sizing: border-box;
}

.admin-page .admin-notifications .notification-stats,
.admin-page .admin-notifications .dashboard-content {
  width: 100%;
  min-width: 0;
  margin: 0;
  padding: 0;
}

.admin-page .admin-notifications .notification-stats-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  width: 100%;
  margin: 0;
  padding: 0;
}

.admin-page .admin-notifications .notification-stat-card {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  min-width: 0;
  min-height: 90px;
  margin: 0;
  padding: 17px 20px;
  border: 1px solid color-mix(
    in srgb,
    var(--accent, #ff718f) 18%,
    #58404b
  );
  border-radius: 17px;
  background: color-mix(
    in srgb,
    var(--primary, #581d2b) 28%,
    #21151e
  );
  color: #fff;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    background 0.2s ease;
}

.admin-page .admin-notifications .notification-stat-card:hover {
  border-color: var(--accent, #ff718f);
}

.admin-page .admin-notifications .notification-stat-card.selected {
  border-color: var(--accent, #ff718f);
  background: color-mix(
    in srgb,
    var(--primary, #581d2b) 50%,
    #21151e
  );
}

.admin-page .admin-notifications .notification-stat-card:focus-visible,
.admin-page .admin-notifications .notification-action:focus-visible {
  outline: 2px solid var(--accent, #ff718f);
  outline-offset: 3px;
}

.admin-page .admin-notifications .notification-stat-card .stat-icon {
  display: flex;
  flex: 0 0 45px;
  align-items: center;
  justify-content: center;
  width: 45px;
  height: 45px;
  border-radius: 13px;
  background: color-mix(
    in srgb,
    var(--accent, #ff718f) 12%,
    transparent
  );
  font-size: 21px;
}

.admin-page .admin-notifications .notification-stat-content {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.admin-page .admin-notifications .notification-stat-title {
  color: #fff;
  font-size: 0.87rem;
  font-weight: 800;
}

.admin-page .admin-notifications .notification-stat-description {
  color: #d7c4cc;
  font-size: 0.72rem;
}

.admin-page .admin-notifications .notification-stat-count {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 38px;
  height: 38px;
  margin-left: auto;
  padding: 0 9px;
  border-radius: 11px;
  background: color-mix(
    in srgb,
    var(--accent, #ff718f) 15%,
    transparent
  );
  color: #fff;
  font-size: 1.25rem;
  font-weight: 900;
}

.admin-page .admin-notifications .admin-notifications-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
}

.admin-page .admin-notifications .section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.admin-page .admin-notifications .section-header h2 {
  margin: 0;
  color: #fff;
  font-size: 1.05rem;
  font-weight: 850;
}

.admin-page .admin-notifications .section-header p {
  margin: 5px 0 0;
  color: #d7c4cc;
  font-size: 0.78rem;
}

.admin-page .admin-notifications .section-count {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  height: 32px;
  padding: 0 9px;
  border-radius: 10px;
  background: color-mix(
    in srgb,
    var(--accent, #ff718f) 12%,
    transparent
  );
  color: #fff;
  font-size: 0.8rem;
  font-weight: 900;
}

.admin-page .admin-notifications .notifications {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
}

.admin-page .admin-notifications .notification-card {
  width: 100%;
  min-width: 0;
  border-radius: 15px;
  overflow: hidden;
}

.admin-page .admin-notifications .notification-main {
  display: flex;
  align-items: center;
  gap: 16px;
  width: 100%;
  min-height: 64px;
  padding: 12px 17px;
  cursor: pointer;
}

.admin-page .admin-notifications .notification-status {
  display: flex;
  flex: 0 0 155px;
  align-items: center;
  gap: 8px;
}

.admin-page .admin-notifications .notification-status strong {
  color: #fff;
  font-size: 0.76rem;
  font-weight: 800;
}

.admin-page .admin-notifications .notification-summary {
  display: flex;
  flex: 1;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 12px;
  min-width: 0;
}

.admin-page .admin-notifications .notification-summary-product {
  color: #fff;
  font-size: 0.82rem;
  font-weight: 800;
  overflow-wrap: anywhere;
}

.admin-page .admin-notifications .notification-summary-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 7px;
}

.admin-page .admin-notifications .notification-summary-meta span {
  font-size: 0.7rem;
}

.admin-page .admin-notifications .notification-expand {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-left: auto;
  color: #fff;
  font-size: 0.75rem;
  font-weight: 800;
  white-space: nowrap;
}

.admin-page .admin-notifications .notification-chevron {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 9px;
  font-size: 15px;
}

.admin-page .admin-notifications .notification-details {
  padding: 18px;
}

.admin-page .admin-notifications .notification-details-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 15px;
}

.admin-page .admin-notifications .notification-details-actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 18px;
}

.admin-page .admin-notifications .notification-action {
  min-height: 38px;
  padding: 9px 15px;
  border: 1px solid var(--accent, #ff718f);
  border-radius: 10px;
  background: color-mix(
    in srgb,
    var(--accent, #ff718f) 16%,
    #21151e
  );
  color: #fff;
  font: inherit;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
}

.admin-page .admin-notifications .notification-action:disabled {
  opacity: 0.55;
  cursor: wait;
}

.admin-page .admin-notifications .notification-error {
  margin: 12px 0 0;
  color: #ff9aa8;
  font-size: 0.8rem;
}

@media (max-width: 900px) {
  .admin-page .admin-notifications .notification-main {
    flex-wrap: wrap;
  }

  .admin-page .admin-notifications .notification-status {
    flex-basis: auto;
  }

  .admin-page .admin-notifications .notification-summary {
    flex-basis: 100%;
    order: 3;
  }
}

@media (max-width: 600px) {
  .admin-page .admin-notifications {
    gap: 18px;
  }

  .admin-page .admin-notifications .notification-stats-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .admin-page .admin-notifications .notification-stat-card {
    min-height: 75px;
    padding: 12px 14px;
  }

  .admin-page .admin-notifications .notification-details-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
`;

function getTimestampValue(value) {
  if (!value) return 0;

  if (typeof value.toMillis === 'function') {
    return value.toMillis();
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  return 0;
}

export default function AdminNotifications({ orders = [], permissions = {} }) {
  const [view, setView] = useState('unread');
  const [expandedId, setExpandedId] = useState(null);

  const [currentUid, setCurrentUid] = useState(auth.currentUser?.uid || '');

  const [assignedNotifications, setAssignedNotifications] = useState([]);
  const [loadingAssignments, setLoadingAssignments] = useState(true);
  const [assignmentsError, setAssignmentsError] = useState('');

  const isAdmin = currentUid === ADMIN_UID;

  const canReadOwn =
    isAdmin ||
    permissions.viewOwn === true ||
    permissions.receiveAssigned === true;

  const canMarkRead =
    isAdmin ||
    permissions.markRead === true ||
    permissions.viewOwn === true ||
    permissions.receiveAssigned === true;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUid(user?.uid || '');
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!currentUid || !canReadOwn) {
      setAssignedNotifications([]);
      setLoadingAssignments(false);
      return;
    }

    setLoadingAssignments(true);
    setAssignmentsError('');

    const notificationsQuery = query(
      collection(db, 'notifications'),
      where('recipientUid', '==', currentUid)
    );

    const unsubscribe = onSnapshot(
      notificationsQuery,
      (snapshot) => {
        const items = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
          notificationType: 'assignment',
        }));

        items.sort(
          (a, b) =>
            getTimestampValue(b.createdAt) - getTimestampValue(a.createdAt)
        );

        setAssignedNotifications(items);
        setLoadingAssignments(false);
      },
      (error) => {
        console.error('Błąd pobierania przypisań:', error);

        setAssignmentsError('Nie udało się pobrać powiadomień o przypisaniu.');

        setLoadingAssignments(false);
      }
    );

    return unsubscribe;
  }, [currentUid, canReadOwn]);

  const allNotifications = useMemo(() => {
    const orderNotifications = isAdmin
      ? orders.map((order) => ({
          ...order,
          notificationType: 'order',
          notificationId: `order-${order.id}`,
          read: Boolean(order.notificationRead),
        }))
      : [];

    const assignmentItems = assignedNotifications.map((notification) => ({
      ...notification,
      notificationType: 'assignment',
      notificationId: `assignment-${notification.id}`,
      read: Boolean(notification.read),
    }));

    return [...orderNotifications, ...assignmentItems].sort(
      (a, b) => getTimestampValue(b.createdAt) - getTimestampValue(a.createdAt)
    );
  }, [orders, assignedNotifications, isAdmin]);

  const unreadNotifications = useMemo(
    () => allNotifications.filter((notification) => !notification.read),
    [allNotifications]
  );

  const readNotifications = useMemo(
    () => allNotifications.filter((notification) => notification.read),
    [allNotifications]
  );

  const visibleNotifications =
    view === 'unread' ? unreadNotifications : readNotifications;

  function handleViewChange(nextView) {
    setView(nextView);
    setExpandedId(null);
  }

  function toggleNotification(id) {
    setExpandedId((previous) => (previous === id ? null : id));
  }

  return (
    <>
      <style>{notificationStyles}</style>

      <section className="admin-notifications">
        <section className="dashboard-stats notification-stats">
          <div className="stats notification-stats-grid">
            <button
              type="button"
              className={`stat-card notification-stat-card ${
                view === 'unread' ? 'selected' : ''
              }`}
              onClick={() => handleViewChange('unread')}
              aria-pressed={view === 'unread'}
            >
              <span className="stat-icon" aria-hidden="true">
                🔔
              </span>

              <span className="notification-stat-content">
                <span className="notification-stat-title">Nieprzeczytane</span>

                <span className="notification-stat-description">
                  Nowe zgłoszenia i przypisania
                </span>
              </span>

              <strong className="notification-stat-count">
                {unreadNotifications.length}
              </strong>
            </button>

            <button
              type="button"
              className={`stat-card notification-stat-card ${
                view === 'read' ? 'selected' : ''
              }`}
              onClick={() => handleViewChange('read')}
              aria-pressed={view === 'read'}
            >
              <span className="stat-icon" aria-hidden="true">
                ✓
              </span>

              <span className="notification-stat-content">
                <span className="notification-stat-title">Przeczytane</span>

                <span className="notification-stat-description">
                  Historia powiadomień
                </span>
              </span>

              <strong className="notification-stat-count">
                {readNotifications.length}
              </strong>
            </button>
          </div>
        </section>

        <section className="dashboard-content">
          <div className="admin-notifications-list">
            <div className="section-header">
              <div>
                <h2>
                  {view === 'unread' ? '🔔 Nieprzeczytane' : '✓ Przeczytane'}
                </h2>

                <p>
                  {view === 'unread'
                    ? 'Nowe zgłoszenia i przypisania wymagające uwagi.'
                    : 'Historia przeczytanych powiadomień.'}
                </p>
              </div>

              <div className="section-count">{visibleNotifications.length}</div>
            </div>

            {assignmentsError && (
              <p className="notification-error" role="alert">
                {assignmentsError}
              </p>
            )}

            {loadingAssignments && visibleNotifications.length === 0 && (
              <p>Ładowanie powiadomień...</p>
            )}

            {!loadingAssignments && visibleNotifications.length === 0 && (
              <EmptyState>
                {view === 'unread'
                  ? 'Brak nowych nieprzeczytanych powiadomień.'
                  : 'Brak przeczytanych powiadomień.'}
              </EmptyState>
            )}

            {visibleNotifications.length > 0 && (
              <div className="notifications">
                {visibleNotifications.map((notification) => (
                  <NotificationCard
                    key={notification.notificationId}
                    notification={notification}
                    expanded={expandedId === notification.notificationId}
                    onToggle={() =>
                      toggleNotification(notification.notificationId)
                    }
                    canMarkRead={canMarkRead}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </section>
    </>
  );
}

function NotificationCard({ notification, expanded, onToggle, canMarkRead }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isAssignment = notification.notificationType === 'assignment';

  const isRead = Boolean(notification.read);

  async function handleChangeRead(event) {
    event.stopPropagation();

    if (loading || !canMarkRead) return;

    try {
      setLoading(true);
      setError('');

      if (isAssignment) {
        if (isRead) {
          throw new Error(
            'Powiadomienia o przypisaniu można oznaczyć tylko jako przeczytane.'
          );
        }

        await updateDoc(doc(db, 'notifications', notification.id), {
          read: true,
          readAt: serverTimestamp(),
        });
      } else if (notification.notificationRead) {
        await markNotificationAsUnread(notification);
      } else {
        await markNotificationAsRead(notification);
      }
    } catch (caught) {
      console.error('Błąd zmiany statusu powiadomienia:', caught);

      setError(
        caught?.message || 'Nie udało się zmienić statusu powiadomienia.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <article
      className={`notification-card ${isRead ? 'read' : 'unread'} ${
        expanded ? 'expanded' : ''
      }`}
    >
      <div
        className="notification-main"
        onClick={onToggle}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onToggle();
          }
        }}
      >
        <div className="notification-status">
          <span
            className={`notification-status-dot ${
              isRead ? 'read-dot' : 'new-dot'
            }`}
          />

          <strong>
            {isAssignment
              ? isRead
                ? 'Przeczytane przypisanie'
                : 'Nowe przypisanie'
              : isRead
              ? 'Przeczytane'
              : 'Nowe zgłoszenie'}
          </strong>
        </div>

        <div className="notification-summary">
          <div className="notification-summary-product">
            {notification.product || notification.title || 'Powiadomienie'}
          </div>

          <div className="notification-summary-meta">
            {isAssignment ? (
              <>
                <span>👤 Przypisano Tobie</span>
                <span>📨 {notification.createdByName || 'Administrator'}</span>
              </>
            ) : (
              <>
                <span>
                  📦 {notification.quantity} {notification.unit}
                </span>

                <span>👤 {notification.requestedBy}</span>
              </>
            )}

            <span>🕐 {formatDate(notification.createdAt)}</span>
          </div>
        </div>

        <div className="notification-expand">
          <span>{expanded ? 'Zwiń' : 'Szczegóły'}</span>

          <span className={`notification-chevron ${expanded ? 'open' : ''}`}>
            ↓
          </span>
        </div>
      </div>

      {expanded && (
        <div className="notification-details">
          <div className="notification-details-grid">
            <div className="notification-detail">
              <span className="notification-detail-label">Produkt</span>

              <strong>{notification.product || '—'}</strong>
            </div>

            {isAssignment ? (
              <>
                <div className="notification-detail">
                  <span className="notification-detail-label">Typ</span>

                  <strong>Przypisanie zgłoszenia</strong>
                </div>

                <div className="notification-detail">
                  <span className="notification-detail-label">Przypisał</span>

                  <strong>
                    {notification.createdByName || 'Administrator'}
                  </strong>
                </div>

                <div className="notification-detail">
                  <span className="notification-detail-label">Informacja</span>

                  <strong>
                    {notification.message || 'Przypisano Ci nowe zgłoszenie.'}
                  </strong>
                </div>
              </>
            ) : (
              <>
                <div className="notification-detail">
                  <span className="notification-detail-label">Ilość</span>

                  <strong>
                    {notification.quantity} {notification.unit}
                  </strong>
                </div>

                <div className="notification-detail">
                  <span className="notification-detail-label">
                    Dodane przez
                  </span>

                  <strong>{notification.requestedBy}</strong>
                </div>
              </>
            )}

            <div className="notification-detail">
              <span className="notification-detail-label">
                Data powiadomienia
              </span>

              <strong>{formatDate(notification.createdAt)}</strong>
            </div>

            {(notification.readAt || notification.notificationReadAt) && (
              <div className="notification-detail">
                <span className="notification-detail-label">Przeczytano</span>

                <strong>
                  {formatDate(
                    notification.readAt || notification.notificationReadAt
                  )}
                </strong>
              </div>
            )}
          </div>

          {canMarkRead && (!isAssignment || !isRead) && (
            <div className="notification-details-actions">
              <button
                type="button"
                className="notification-action"
                onClick={handleChangeRead}
                disabled={loading}
              >
                {loading
                  ? 'Zapisywanie...'
                  : isRead
                  ? '↩ Oznacz jako nieprzeczytane'
                  : '✓ Oznacz jako przeczytane'}
              </button>
            </div>
          )}

          {error && (
            <p className="notification-error" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </article>
  );
}
