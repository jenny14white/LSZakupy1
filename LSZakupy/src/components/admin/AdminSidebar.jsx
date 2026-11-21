import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot, query, where } from 'firebase/firestore';

import {
  ADMIN_UIDS,
  MODULES,
  canAccessAnyModuleAction,
} from '../../config/roles';

import { auth, db } from '../../firebase/firebase';
import logoLS from '../../assets/logo.png';
import SpotlightCard from '../shared/effects/SpotlightCard';
import '../../styles/admin-sidebar.css';

const NAV_ITEMS = [
  {
    tab: 'lista',
    module: MODULES.SHOPPING,
    icon: '📦',
    label: 'Zamówienia',
  },
  {
    tab: 'powiadomienia',
    module: MODULES.NOTIFICATIONS,
    icon: '🔔',
    label: 'Powiadomienia',
  },
  {
    tab: 'dziennik',
    module: MODULES.LOGS,
    icon: '📜',
    label: 'Dziennik',
  },
  {
    tab: 'kalendarz',
    module: MODULES.CALENDAR,
    icon: '📅',
    label: 'Kalendarz',
  },
  {
    tab: 'uzytkownicy',
    module: MODULES.USERS,
    icon: '👥',
    label: 'Użytkownicy',
  },
];

function cleanText(value) {
  if (typeof value !== 'string') {
    return '';
  }

  const text = value.trim();

  if (
    !text ||
    ['użytkownik', 'user', 'unknown', 'undefined', 'null'].includes(
      text.toLowerCase()
    )
  ) {
    return '';
  }

  return text;
}

function getUserName(user) {
  if (!user) {
    return '';
  }

  if (typeof user === 'string') {
    return cleanText(user);
  }

  const firstName = cleanText(user.firstName || user.imie);
  const lastName = cleanText(user.lastName || user.nazwisko);
  const fullName = `${firstName} ${lastName}`.trim();

  return (
    fullName ||
    cleanText(user.displayName) ||
    cleanText(user.fullName) ||
    cleanText(user.name) ||
    ''
  );
}

function getInitials(value) {
  const text = String(value || '').trim();

  if (!text) {
    return '?';
  }

  if (text.includes('@')) {
    return text.charAt(0).toUpperCase();
  }

  return text
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

function NavButton({ tab, icon, label, counter = 0, onClick, activeTab }) {
  const active = activeTab === tab;

  return (
    <SpotlightCard
      className={`sidebar-card ${active ? 'active' : ''}`}
      spotlightColor="var(--accent)"
    >
      <button
        type="button"
        className={`sidebar-button ${active ? 'active' : ''}`}
        onClick={onClick}
        aria-current={active ? 'page' : undefined}
      >
        {active && <span className="menu-indicator" aria-hidden="true" />}

        <span className="sidebar-button-main">
          <span className="sidebar-icon" aria-hidden="true">
            {icon}
          </span>

          <span className="sidebar-button-label">{label}</span>
        </span>

        {counter > 0 && (
          <span
            className={`sidebar-counter ${
              tab === 'powiadomienia' ? 'notification-counter' : ''
            }`}
          >
            {counter}
          </span>
        )}

        {active && counter === 0 && (
          <span className="sidebar-active-arrow" aria-hidden="true">
            ›
          </span>
        )}
      </button>
    </SpotlightCard>
  );
}

export default function AdminSidebar({
  activeTab,
  setActiveTab,
  pendingCount = 0,
  acceptedCount = 0,
  unreadNotificationsCount = 0,
  goBack,
  logout,
  userUid,
  userRole = 'user',
  permissions = {},
  accessibleTabs,
  isSuperAdmin = false,
  user,
  userData,
  userName,
}) {
  const [authUser, setAuthUser] = useState(auth.currentUser || null);

  const [assignmentUnreadCount, setAssignmentUnreadCount] = useState(0);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setAuthUser(firebaseUser);
    });

    return unsubscribe;
  }, []);

  const effectiveUid = authUser?.uid || userUid || '';

  const isMainAdmin = ADMIN_UIDS.includes(effectiveUid);

  const currentUser = useMemo(
    () => ({
      uid: effectiveUid,
      role: isMainAdmin ? 'admin' : userData?.role || userRole,
      status: isMainAdmin
        ? 'active'
        : userData?.status || user?.status || 'pending',
      permissions: userData?.permissions || permissions,
    }),
    [effectiveUid, isMainAdmin, userData, userRole, user, permissions]
  );

  const permissionTabs = useMemo(
    () =>
      NAV_ITEMS.filter((item) =>
        canAccessAnyModuleAction(currentUser, item.module)
      ).map((item) => item.tab),
    [currentUser]
  );

  const allowedTabs = useMemo(() => {
    if (isMainAdmin) {
      return NAV_ITEMS.map((item) => item.tab);
    }

    if (Array.isArray(accessibleTabs)) {
      return permissionTabs.filter((tab) => accessibleTabs.includes(tab));
    }

    return permissionTabs;
  }, [isMainAdmin, accessibleTabs, permissionTabs]);

  const visibleItems = useMemo(
    () => NAV_ITEMS.filter((item) => allowedTabs.includes(item.tab)),
    [allowedTabs]
  );

  const canSeeNotifications = allowedTabs.includes('powiadomienia');

  useEffect(() => {
    if (!effectiveUid || !canSeeNotifications) {
      setAssignmentUnreadCount(0);
      return undefined;
    }

    const notificationsQuery = query(
      collection(db, 'notifications'),
      where('recipientUid', '==', effectiveUid)
    );

    const unsubscribe = onSnapshot(
      notificationsQuery,
      (snapshot) => {
        const unreadCount = snapshot.docs.filter(
          (item) => item.data().read !== true
        ).length;

        setAssignmentUnreadCount(unreadCount);
      },
      (error) => {
        console.error('Błąd pobierania licznika przypisań:', error);

        setAssignmentUnreadCount(0);
      }
    );

    return unsubscribe;
  }, [effectiveUid, canSeeNotifications]);

  const totalUnreadNotifications = isMainAdmin
    ? Number(unreadNotificationsCount || 0) + assignmentUnreadCount
    : assignmentUnreadCount;

  const displayEmail =
    cleanText(userData?.email) ||
    cleanText(user?.email) ||
    cleanText(authUser?.email) ||
    '';

  const candidateName =
    getUserName(userName) ||
    getUserName(userData) ||
    getUserName(user) ||
    getUserName(authUser);

  const displayName =
    candidateName && !candidateName.includes('@') ? candidateName : '';

  const displayIdentity = displayName || displayEmail || 'Brak danych konta';

  const displayRole = isMainAdmin ? 'Administrator' : 'Pracownik';

  function handleNavigation(tab) {
    if (!allowedTabs.includes(tab)) {
      return;
    }

    if (typeof setActiveTab === 'function') {
      setActiveTab(tab);
    }
  }

  return (
    <aside className="sidebar admin-sidebar">
      <div className="sidebar-top">
        <div className="sidebar-brand">
          <div className="sidebar-brand-logo">
            <img src={logoLS} alt="LS Zakupy" className="sidebar-logo" />
          </div>

          <div className="sidebar-brand-text">
            <span className="sidebar-brand-name">LS ZAKUPY</span>

            <h2>Panel Zarządzania</h2>
          </div>
        </div>

        <div className="sidebar-user">
          <div className="sidebar-user-avatar" aria-hidden="true">
            {getInitials(displayIdentity)}
          </div>

          <div className="sidebar-user-content">
            <div className="sidebar-user-heading">
              <span className="sidebar-user-label">Zalogowany użytkownik</span>

              <span
                className="sidebar-user-status"
                title="Zalogowany"
                aria-label="Zalogowany"
              />
            </div>

            <strong className="sidebar-user-name" title={displayIdentity}>
              {displayIdentity}
            </strong>

            <span className="sidebar-user-role">{displayRole}</span>
          </div>
        </div>
      </div>

      <nav className="admin-nav" aria-label="Nawigacja panelu zarządzania">
        <div className="sidebar-section-heading">
          <span>Nawigacja</span>

          <span className="sidebar-section-line" aria-hidden="true" />
        </div>

        {visibleItems.map((item) => (
          <NavButton
            key={item.tab}
            tab={item.tab}
            icon={item.icon}
            label={item.label}
            counter={
              item.tab === 'powiadomienia' ? totalUnreadNotifications : 0
            }
            activeTab={activeTab}
            onClick={() => handleNavigation(item.tab)}
          />
        ))}

        {visibleItems.length === 0 && (
          <div className="sidebar-no-access">
            Nie masz przypisanego dostępu do żadnego modułu. Skontaktuj się z
            administratorem.
          </div>
        )}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-footer-heading">Twoja sesja</div>

        <button type="button" className="return-button" onClick={goBack}>
          <span aria-hidden="true">←</span>
          <span>Wróć do aplikacji</span>
        </button>

        <button type="button" className="logout-button" onClick={logout}>
          <span aria-hidden="true">↪</span>
          <span>Wyloguj</span>
        </button>
      </div>
    </aside>
  );
}
