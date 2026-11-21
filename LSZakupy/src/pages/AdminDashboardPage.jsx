import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';

import {
  ADMIN_UID,
  MODULES,
  MODULE_PERMISSIONS,
  PERMISSIONS,
  canAccessModule,
  normalizePermissions,
  createFullPermissions,
} from '../config/roles';

import { auth, db } from '../firebase/firebase';
import { useAdminOrders } from '../hooks/useAdminOrders';
import { useLogs } from '../hooks/useLogs';
import { useEvents } from '../hooks/useEvents';
import { ORDER_STATUS } from '../utils/constants';

import AdminSidebar from '../components/admin/AdminSidebar';
import AdminShoppingList from '../components/admin/AdminShoppingList';
import AdminNotifications from '../components/admin/AdminNotifications';
import AdminEventLog from '../components/admin/AdminEventLog';
import AdminCalendar from '../components/admin/AdminCalendar';
import UsersPage from './UsersPage';

const TAB_MODULES = {
  lista: MODULES.SHOPPING,
  powiadomienia: MODULES.NOTIFICATIONS,
  dziennik: MODULES.LOGS,
  kalendarz: MODULES.CALENDAR,
  uzytkownicy: MODULES.USERS,
};

const TAB_ORDER = [
  'lista',
  'powiadomienia',
  'dziennik',
  'kalendarz',
  'uzytkownicy',
];

const TAB_HEADINGS = {
  lista: {
    title: 'Zamówienia',
    description:
      'Zarządzaj zgłoszeniami, przejmuj zamówienia i przypisuj je pracownikom.',
  },
  powiadomienia: {
    title: 'Powiadomienia',
    description:
      'Sprawdzaj nowe zgłoszenia i powiadomienia o przypisanych zamówieniach.',
  },
  dziennik: {
    title: 'Dziennik',
    description: 'Przeglądaj zapisane zdarzenia i historię działań w systemie.',
  },
  kalendarz: {
    title: 'Kalendarz',
    description: 'Przeglądaj wydarzenia i zarządzaj harmonogramem.',
  },
  uzytkownicy: {
    title: 'Użytkownicy',
    description: 'Zarządzaj użytkownikami i ich dostępem do systemu.',
  },
};

function normalizeEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
}

function getProfileName(profile, fallback = '') {
  if (!profile) {
    return fallback;
  }

  const firstName = String(profile.firstName || profile.imie || '').trim();

  const lastName = String(profile.lastName || profile.nazwisko || '').trim();

  const fullName = `${firstName} ${lastName}`.trim();

  return (
    fullName ||
    profile.displayName ||
    profile.fullName ||
    profile.name ||
    fallback
  );
}

function buildUserAccess(user, profile) {
  if (!user || user.isAnonymous) {
    return null;
  }

  if (user.uid === ADMIN_UID) {
    return {
      uid: user.uid,
      email: user.email || '',
      name: user.displayName || 'Administrator',
      role: 'admin',
      status: 'active',
      permissions: createFullPermissions(),
      isAdmin: true,
      isSuperAdmin: true,
    };
  }

  if (!profile || !user.emailVerified) {
    return null;
  }

  if (profile.uid !== user.uid) {
    return null;
  }

  if (profile.role !== 'user' || profile.status !== 'active') {
    return null;
  }

  if (normalizeEmail(profile.email) !== normalizeEmail(user.email)) {
    return null;
  }

  if (
    typeof profile.invitationId !== 'string' ||
    !profile.invitationId.trim()
  ) {
    return null;
  }

  return {
    uid: user.uid,
    email: profile.email || '',
    name: getProfileName(profile, user.displayName || 'Pracownik'),
    firstName: profile.firstName || profile.imie || '',
    lastName: profile.lastName || profile.nazwisko || '',
    role: 'user',
    status: 'active',
    permissions: normalizePermissions(profile.permissions),
    invitationId: profile.invitationId,
    isAdmin: false,
    isSuperAdmin: false,
  };
}

function hasAnyModuleAccess(access, moduleId) {
  if (!access) {
    return false;
  }

  if (access.uid === ADMIN_UID) {
    return true;
  }

  if (moduleId === MODULES.USERS) {
    return false;
  }

  if (
    moduleId === MODULES.SHOPPING &&
    canAccessModule(access, MODULES.SHOPPING, PERMISSIONS.CREATE)
  ) {
    return true;
  }

  const actions = MODULE_PERMISSIONS[moduleId] || [];

  return actions.some((action) => canAccessModule(access, moduleId, action));
}

function getAccessibleTabs(access) {
  if (!access) {
    return [];
  }

  return TAB_ORDER.filter((tab) =>
    hasAnyModuleAccess(access, TAB_MODULES[tab])
  );
}

function ModuleHeader({ activeTab }) {
  const heading = TAB_HEADINGS[activeTab];

  if (!heading) {
    return null;
  }

  return (
    <header className="dashboard-header">
      <div>
        <span className="dashboard-eyebrow">
          PANEL ZARZĄDZANIA / {heading.title.toUpperCase()}
        </span>

        <h1>{heading.title}</h1>

        <p className="dashboard-description">{heading.description}</p>
      </div>
    </header>
  );
}

export default function AdminDashboardPage({ goBack, logout, goToEvents }) {
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState('lista');

  const [authorized, setAuthorized] = useState(false);

  const [checking, setChecking] = useState(true);

  const [userUid, setUserUid] = useState(null);

  const [userAccess, setUserAccess] = useState(null);

  const [firebaseUser, setFirebaseUser] = useState(null);

  useEffect(() => {
    let unsubscribeProfile = null;
    let authVersion = 0;

    const unsubscribeAuth = onAuthStateChanged(
      auth,
      async (user) => {
        authVersion += 1;

        const currentVersion = authVersion;

        if (unsubscribeProfile) {
          unsubscribeProfile();
          unsubscribeProfile = null;
        }

        const uid = user?.uid || null;

        setUserUid(uid);
        setFirebaseUser(user || null);
        setChecking(true);

        if (!user || user.isAnonymous) {
          setUserAccess(null);
          setAuthorized(false);
          setChecking(false);
          return;
        }

        if (uid === ADMIN_UID) {
          const access = buildUserAccess(user, null);

          setUserAccess(access);
          setAuthorized(true);
          setChecking(false);
          return;
        }

        try {
          await user.reload();
          await user.getIdToken(true);

          if (currentVersion !== authVersion) {
            return;
          }

          if (!user.emailVerified) {
            setUserAccess(null);
            setAuthorized(false);
            setChecking(false);
            return;
          }

          unsubscribeProfile = onSnapshot(
            doc(db, 'users', uid),
            (snapshot) => {
              if (currentVersion !== authVersion) {
                return;
              }

              const profile = snapshot.exists() ? snapshot.data() : null;

              const access = buildUserAccess(user, profile);

              const tabs = getAccessibleTabs(access);

              setUserAccess(access);
              setAuthorized(tabs.length > 0);
              setChecking(false);
            },
            (error) => {
              if (currentVersion !== authVersion) {
                return;
              }

              console.error('Nie udało się sprawdzić uprawnień:', error);

              setUserAccess(null);
              setAuthorized(false);
              setChecking(false);
            }
          );
        } catch (error) {
          if (currentVersion !== authVersion) {
            return;
          }

          console.error('Błąd weryfikacji użytkownika:', error);

          setUserAccess(null);
          setAuthorized(false);
          setChecking(false);
        }
      },
      (error) => {
        console.error('Błąd sprawdzania sesji:', error);

        setFirebaseUser(null);
        setUserUid(null);
        setUserAccess(null);
        setAuthorized(false);
        setChecking(false);
      }
    );

    return () => {
      authVersion += 1;
      unsubscribeAuth();

      if (unsubscribeProfile) {
        unsubscribeProfile();
      }
    };
  }, []);

  const isAdmin = userUid === ADMIN_UID;

  const can = (moduleId, action = PERMISSIONS.VIEW) =>
    canAccessModule(userAccess, moduleId, action);

  const accessibleTabs = useMemo(
    () => getAccessibleTabs(userAccess),
    [userAccess]
  );

  useEffect(() => {
    if (!authorized || accessibleTabs.length === 0) {
      return;
    }

    if (!accessibleTabs.includes(activeTab)) {
      setActiveTab(accessibleTabs[0]);
    }
  }, [authorized, accessibleTabs, activeTab]);

  const canViewOrders =
    authorized &&
    (hasAnyModuleAccess(userAccess, MODULES.SHOPPING) ||
      hasAnyModuleAccess(userAccess, MODULES.NOTIFICATIONS) ||
      hasAnyModuleAccess(userAccess, MODULES.COMPLETED));

  const canViewEvents =
    authorized && hasAnyModuleAccess(userAccess, MODULES.CALENDAR);

  const canViewLogs = authorized && can(MODULES.LOGS, PERMISSIONS.VIEW);

  const { orders = [], loading: ordersLoading } = useAdminOrders(
    Boolean(canViewOrders)
  );

  const logs = useLogs(Boolean(canViewLogs));

  const { events = [], loading: eventsLoading } = useEvents(
    Boolean(canViewEvents)
  );

  const {
    activeOrders,
    pendingCount,
    acceptedCount,
    cancelledCount,
    completedCount,
    unreadNotifications,
  } = useMemo(() => {
    const active = orders.filter(
      (order) =>
        order.status === ORDER_STATUS.PENDING ||
        order.status === ORDER_STATUS.ACCEPTED
    );

    const completed = orders.filter(
      (order) => order.status === ORDER_STATUS.COMPLETED
    );

    const cancelled = orders.filter(
      (order) =>
        order.status === ORDER_STATUS.CANCELLED ||
        order.status === 'cancelled' ||
        order.status === 'canceled'
    );

    return {
      activeOrders: active,

      pendingCount: active.filter(
        (order) => order.status === ORDER_STATUS.PENDING
      ).length,

      acceptedCount: active.filter(
        (order) => order.status === ORDER_STATUS.ACCEPTED
      ).length,

      completedCount: completed.length,

      cancelledCount: cancelled.length,

      unreadNotifications: active.filter((order) => !order.notificationRead),
    };
  }, [orders]);

  const shoppingPermissions = useMemo(() => {
    const normalized = userAccess?.permissions || {};

    return {
      ...normalized,

      view: canAccessModule(userAccess, MODULES.SHOPPING, PERMISSIONS.VIEW),

      create: canAccessModule(userAccess, MODULES.SHOPPING, PERMISSIONS.CREATE),

      takeOwn: canAccessModule(
        userAccess,
        MODULES.SHOPPING,
        PERMISSIONS.TAKE_OWN
      ),

      assign: canAccessModule(userAccess, MODULES.SHOPPING, PERMISSIONS.ASSIGN),

      edit: canAccessModule(userAccess, MODULES.SHOPPING, PERMISSIONS.EDIT),

      delete: canAccessModule(userAccess, MODULES.SHOPPING, PERMISSIONS.DELETE),

      accept: canAccessModule(userAccess, MODULES.SHOPPING, PERMISSIONS.ACCEPT),

      changeStatus: canAccessModule(
        userAccess,
        MODULES.SHOPPING,
        PERMISSIONS.CHANGE_STATUS
      ),
    };
  }, [userAccess]);

  function handleSetActiveTab(tab) {
    if (!accessibleTabs.includes(tab)) {
      return;
    }

    setActiveTab(tab);
  }

  function renderContent() {
    if (!accessibleTabs.includes(activeTab)) {
      return (
        <div className="empty-admin-box">Nie masz dostępu do tego modułu.</div>
      );
    }

    if (activeTab === 'lista') {
      if (ordersLoading) {
        return (
          <div className="empty-admin-box">
            {t('admin.dashboard.loading', 'Ładowanie...')}
          </div>
        );
      }

      return (
        <section className="dashboard-content">
          <AdminShoppingList
            orders={orders}
            permissions={shoppingPermissions}
          />
        </section>
      );
    }

    if (activeTab === 'powiadomienia') {
      if (ordersLoading) {
        return (
          <div className="empty-admin-box">
            {t('admin.dashboard.loading', 'Ładowanie...')}
          </div>
        );
      }

      return (
        <section className="dashboard-content">
          <AdminNotifications
            orders={activeOrders}
            permissions={{
              view: can(MODULES.NOTIFICATIONS, PERMISSIONS.VIEW_OWN),

              viewOwn: can(MODULES.NOTIFICATIONS, PERMISSIONS.VIEW_OWN),

              receiveAssigned: can(
                MODULES.NOTIFICATIONS,
                PERMISSIONS.RECEIVE_ASSIGNED
              ),

              markRead: can(MODULES.NOTIFICATIONS, PERMISSIONS.MARK_READ),
            }}
          />
        </section>
      );
    }

    if (activeTab === 'dziennik') {
      if (!can(MODULES.LOGS, PERMISSIONS.VIEW)) {
        return (
          <div className="empty-admin-box">Brak dostępu do dziennika.</div>
        );
      }

      return (
        <section className="dashboard-content">
          <AdminEventLog
            logs={logs}
            permissions={{
              view: can(MODULES.LOGS, PERMISSIONS.VIEW),

              create: can(MODULES.LOGS, PERMISSIONS.CREATE),

              edit: can(MODULES.LOGS, PERMISSIONS.EDIT),

              delete: can(MODULES.LOGS, PERMISSIONS.DELETE),
            }}
          />
        </section>
      );
    }

    if (activeTab === 'kalendarz') {
      if (eventsLoading) {
        return <div className="empty-admin-box">Ładowanie kalendarza...</div>;
      }

      return (
        <section className="dashboard-content">
          <AdminCalendar
            events={events}
            onEdit={() => {}}
            onDelete={() => {}}
            permissions={{
              view: can(MODULES.CALENDAR, PERMISSIONS.VIEW),

              create: can(MODULES.CALENDAR, PERMISSIONS.CREATE),

              editOwn: can(MODULES.CALENDAR, PERMISSIONS.EDIT_OWN),

              edit: can(MODULES.CALENDAR, PERMISSIONS.EDIT_OWN),

              delete: isAdmin,
            }}
          />
        </section>
      );
    }

    if (activeTab === 'uzytkownicy') {
      if (!isAdmin) {
        return (
          <div className="empty-admin-box">
            Tylko administrator może zarządzać użytkownikami.
          </div>
        );
      }

      return (
        <section className="dashboard-content">
          <UsersPage />
        </section>
      );
    }

    return null;
  }

  if (checking) {
    return (
      <main className="admin-page">
        <section className="dashboard">
          <div className="empty-admin-box">
            {t(
              'admin.dashboard.checkingPermissions',
              'Sprawdzanie uprawnień...'
            )}
          </div>
        </section>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main className="admin-page login-view">
        <section className="login-card">
          <h1>{t('admin.dashboard.accessDenied.title', 'Brak dostępu')}</h1>

          <p>
            {t(
              'admin.dashboard.accessDenied.description',
              'Nie masz uprawnień do korzystania z panelu.'
            )}
          </p>

          <button type="button" className="admin-button" onClick={goBack}>
            {t('shopping.page.back', 'Powrót')}
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <AdminSidebar
        activeTab={activeTab}
        setActiveTab={handleSetActiveTab}
        pendingCount={pendingCount}
        acceptedCount={acceptedCount}
        completedCount={completedCount}
        cancelledCount={cancelledCount}
        unreadNotificationsCount={unreadNotifications.length}
        goBack={goBack}
        logout={logout}
        goToEvents={goToEvents}
        userUid={userUid}
        userRole={userAccess?.role}
        permissions={userAccess?.permissions || {}}
        accessibleTabs={accessibleTabs}
        isSuperAdmin={isAdmin}
        user={firebaseUser}
        userData={userAccess}
        userName={userAccess?.name || ''}
      />

      <section className="dashboard">
        <ModuleHeader activeTab={activeTab} />

        {renderContent()}
      </section>
    </main>
  );
}
