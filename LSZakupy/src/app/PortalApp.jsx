import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

import { ADMIN_UID, USER_ROLES, getAccessibleModules } from '../config/roles';

import { auth, db } from '../firebase/firebase';
import { logoutAdmin } from '../firebase/auth';

import AccessPage from '../pages/AccessPage';
import HomePage from '../pages/HomePage';
import PublicShoppingPage from '../pages/PublicShoppingPage';
import AdminLoginPage from '../pages/AdminLoginPage';
import AdminDashboardPage from '../pages/AdminDashboardPage';
import CalendarPage from '../pages/CalendarPage';
import AdminEventsPage from '../pages/AdminEventsPage';
import ActivateAccountPage from '../pages/ActivateAccountPage';

import SessionGuard from '../components/shared/SessionGuard';
import ScrollTopButton from '../components/shared/ScrollTopButton';

function hasPortalAccess() {
  return sessionStorage.getItem('lsAccess') === 'true';
}

function getInitialPage() {
  if (window.location.pathname === '/activate') {
    return 'activate';
  }

  return hasPortalAccess() ? 'home' : 'access';
}

function normalizeEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
}

async function checkManagementAccess(user) {
  if (!user || user.isAnonymous) {
    return false;
  }

  if (user.uid === ADMIN_UID) {
    return true;
  }

  try {
    await user.reload();
    await user.getIdToken(true);

    if (!user.emailVerified) {
      return false;
    }

    const snapshot = await getDoc(doc(db, 'users', user.uid));

    if (!snapshot.exists()) {
      return false;
    }

    const profile = snapshot.data();

    if (profile.uid && profile.uid !== user.uid) {
      return false;
    }

    if (profile.role !== USER_ROLES.USER) {
      return false;
    }

    if (profile.status !== 'active') {
      return false;
    }

    if (
      typeof profile.invitationId !== 'string' ||
      !profile.invitationId.trim()
    ) {
      return false;
    }

    const profileEmail = normalizeEmail(profile.email);
    const authEmail = normalizeEmail(user.email);

    if (!profileEmail || profileEmail !== authEmail) {
      return false;
    }

    const access = {
      uid: user.uid,
      role: USER_ROLES.USER,
      status: 'active',
      permissions: profile.permissions || {},
    };

    return getAccessibleModules(access).length > 0;
  } catch (error) {
    console.error('Nie udało się sprawdzić dostępu do panelu:', error);

    return false;
  }
}

export default function App() {
  const [page, setPage] = useState(getInitialPage);
  const [hasAccess, setHasAccess] = useState(hasPortalAccess);
  const [firebaseReady, setFirebaseReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let version = 0;

    const unsubscribe = onAuthStateChanged(
      auth,
      async (user) => {
        const currentVersion = ++version;

        setHasAccess(hasPortalAccess());

        const allowed = await checkManagementAccess(user);

        if (currentVersion !== version) {
          return;
        }

        setIsAdmin(allowed);
        setFirebaseReady(true);
      },
      (error) => {
        console.error('Błąd sprawdzania sesji Firebase:', error);

        version += 1;
        setIsAdmin(false);
        setFirebaseReady(true);
      }
    );

    return () => {
      version += 1;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    function handlePopState() {
      if (window.location.pathname === '/activate') {
        setPage('activate');
        return;
      }

      setPage(hasPortalAccess() ? 'home' : 'access');
    }

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  function navigate(nextPage, path = null) {
    if (path !== null) {
      window.history.pushState({}, '', path);
    }

    setPage(nextPage);
  }

  function goHome() {
    if (!hasPortalAccess()) {
      navigate('access', '/');
      return;
    }

    navigate('home', '/');
  }

  function handleAccessLogout() {
    sessionStorage.removeItem('lsAccess');
    sessionStorage.removeItem('lsLastActivity');

    setHasAccess(false);
    setIsAdmin(false);

    navigate('access', '/');
  }

  async function handleLogout() {
    try {
      await logoutAdmin();
    } catch (error) {
      console.error('Błąd wylogowania:', error);
    }

    setIsAdmin(false);
    goHome();
  }

  async function handleLogin(user) {
    if (!user) {
      return;
    }

    const allowed = await checkManagementAccess(user);

    setIsAdmin(allowed);

    if (allowed) {
      navigate('admin', '/');
    }
  }

  function handleAccessSuccess() {
    sessionStorage.setItem('lsAccess', 'true');
    sessionStorage.setItem('lsLastActivity', String(Date.now()));

    setHasAccess(true);
    navigate('home', '/');
  }

  function renderPage() {
    switch (page) {
      case 'activate':
        return <ActivateAccountPage goToLogin={() => navigate('admin', '/')} />;

      case 'access':
        return <AccessPage onSuccess={handleAccessSuccess} />;

      case 'home':
        return (
          <HomePage
            goToShopping={() => navigate('shopping')}
            goToCalendar={() => navigate('calendar')}
            goToAdmin={() => navigate('admin')}
          />
        );

      case 'shopping':
        return <PublicShoppingPage goBack={goHome} />;

      case 'calendar':
        return <CalendarPage goBack={goHome} />;

      case 'admin':
        return isAdmin ? (
          <AdminDashboardPage
            goBack={goHome}
            logout={handleLogout}
            goToEvents={() => navigate('admin-events')}
          />
        ) : (
          <AdminLoginPage goBack={goHome} onLogin={handleLogin} />
        );

      case 'admin-events':
        return isAdmin ? (
          <AdminEventsPage goBack={() => navigate('admin')} />
        ) : (
          <AdminLoginPage
            goBack={goHome}
            onLogin={async (user) => {
              if (!user) {
                return;
              }

              const allowed = await checkManagementAccess(user);

              setIsAdmin(allowed);

              if (allowed) {
                navigate('admin-events');
              }
            }}
          />
        );

      default:
        return <AccessPage onSuccess={handleAccessSuccess} />;
    }
  }

  if (!firebaseReady) {
    return null;
  }

  return (
    <>
      {hasAccess && page !== 'activate' && (
        <SessionGuard onLogout={handleAccessLogout} />
      )}

      {renderPage()}

      <ScrollTopButton />
    </>
  );
}
