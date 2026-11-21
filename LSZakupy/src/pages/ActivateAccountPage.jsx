import { useEffect, useState } from 'react';

import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';

import {
  getInvitation,
  registerInvitedUser,
  activateVerifiedUser,
  refreshEmailVerification,
  sendVerificationEmail,
  validatePassword,
} from '../firebase/auth';

import { auth, authReady } from '../firebase/firebase';

import Logo from '../components/shared/Logo';
import LiquidEther from '../components/shared/effects/LiquidEther';

import '../styles/activate-account.css';

const LIQUID_COLORS = ['#0353a4', '#023e7d', '#002855'];

const INVITATION_BLOCKING_ERRORS = {
  'activation/invitation-not-started': {
    icon: '⌛',
    title: 'To zaproszenie nie jest jeszcze ważne',
    description:
      'Rejestracja za pomocą tego linku nie jest jeszcze dostępna. Spróbuj ponownie później.',
  },
  'activation/invitation-expired': {
    icon: '⌛',
    title: 'Termin ważności zaproszenia minął',
    description: 'To zaproszenie wygasło. Poproś administratora o nowy link.',
  },
  'activation/invitation-inactive': {
    icon: '!',
    title: 'Zaproszenie jest nieaktywne',
    description:
      'Nie można już użyć tego zaproszenia. Skontaktuj się z administratorem.',
  },
  'activation/invitation-used': {
    icon: '!',
    title: 'Brak wolnych miejsc',
    description:
      'Limit wykorzystań tego zaproszenia został wyczerpany. Poproś administratora o nowe zaproszenie.',
  },
  'activation/invitation-missing': {
    icon: '!',
    title: 'Nie znaleziono zaproszenia',
    description:
      'Ten link jest nieaktualny lub nieprawidłowy. Poproś administratora o nowy link.',
  },
  'activation/invitation-invalid': {
    icon: '!',
    title: 'Zaproszenie jest nieprawidłowe',
    description:
      'Nie można rozpocząć rejestracji. Skontaktuj się z administratorem.',
  },
};

function normalizeEmail(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function normalizeName(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ');
}

function isPermissionError(error) {
  return (
    error?.code === 'permission-denied' ||
    error?.code === 'firestore/permission-denied'
  );
}

function getActivationError(error) {
  const messages = {
    'auth/email-already-in-use':
      'Konto z tym adresem już istnieje. Wybierz dokończenie aktywacji.',

    'auth/invalid-credential': 'Nieprawidłowy adres e-mail lub hasło.',

    'auth/wrong-password': 'Nieprawidłowy adres e-mail lub hasło.',

    'auth/user-not-found': 'Nieprawidłowy adres e-mail lub hasło.',

    'auth/weak-password': 'Hasło jest zbyt słabe.',

    'auth/invalid-email': 'Nieprawidłowy adres e-mail.',

    'auth/operation-not-allowed': 'Rejestracja kont jest obecnie niedostępna.',

    'auth/network-request-failed': 'Brak połączenia z internetem.',

    'auth/too-many-requests': 'Zbyt wiele prób. Spróbuj ponownie później.',

    'auth/requires-recent-login':
      'Zaloguj się ponownie i spróbuj dokończyć aktywację.',

    'auth/user-disabled': 'To konto zostało wyłączone.',

    'activation/batch-permission-denied':
      'Reguły Firestore blokują zapis prośby o rejestrację. Administrator musi sprawdzić reguły users i userInvitations.',

    'activation/invitation-used':
      'Limit wykorzystań zaproszenia został wyczerpany.',

    'activation/invitation-expired': 'Termin ważności zaproszenia minął.',

    'activation/invitation-not-started':
      'To zaproszenie nie jest jeszcze ważne.',

    'activation/invitation-inactive': 'To zaproszenie nie jest już aktywne.',

    'activation/invitation-missing':
      'Zaproszenie nie istnieje lub zostało usunięte.',

    'activation/invitation-invalid': 'Zaproszenie ma nieprawidłowe dane.',

    'activation/email-mismatch':
      'To zaproszenie jest przypisane do innego adresu e-mail.',

    'activation/profile-exists':
      'Dla tego konta istnieje już profil. Skontaktuj się z administratorem.',

    'activation/name-missing':
      'Na koncie brakuje imienia i nazwiska. Skontaktuj się z administratorem.',

    'permission-denied':
      'Firestore odmówił dostępu. Sprawdź reguły bezpieczeństwa.',

    'firestore/permission-denied':
      'Firestore odmówił dostępu. Sprawdź reguły bezpieczeństwa.',
  };

  return (
    messages[error?.code] || error?.message || 'Nie udało się aktywować konta.'
  );
}

function toDate(value) {
  if (!value) return null;

  const date =
    typeof value.toDate === 'function'
      ? value.toDate()
      : value instanceof Date
      ? value
      : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value) {
  const date = toDate(value);

  if (!date) return '';

  return date.toLocaleString('pl-PL', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function Requirement({ valid, children }) {
  return (
    <div className={`activation-requirement ${valid ? 'valid' : ''}`}>
      <span className="activation-requirement-icon" aria-hidden="true">
        {valid ? '✓' : '○'}
      </span>

      <span>{children}</span>
    </div>
  );
}

export default function ActivateAccountPage({ goToLogin }) {
  const invitationId = new URLSearchParams(window.location.search).get(
    'invite'
  );

  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState('');
  const [invitationErrorCode, setInvitationErrorCode] = useState('');
  const [notice, setNotice] = useState('');

  const [stage, setStage] = useState('register');

  const [invitation, setInvitation] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    let active = true;

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!active) return;

      const signedIn = user && !user.isAnonymous ? user : null;

      setCurrentUser(signedIn);

      if (signedIn) {
        setEmail((previous) => {
          return previous || signedIn.email || '';
        });

        setStage((previous) => {
          if (
            previous === 'completed' ||
            previous === 'pending_approval' ||
            previous === 'verification'
          ) {
            return previous;
          }

          return 'finish';
        });
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function initialize() {
      setChecking(true);
      setError('');
      setInvitationErrorCode('');
      setNotice('');

      if (!invitationId || invitationId.includes('/')) {
        setError('Nieprawidłowy link zaproszenia.');
        setChecking(false);
        return;
      }

      try {
        await authReady;

        if (!active) return;

        const user = auth.currentUser;

        if (user && !user.isAnonymous) {
          setEmail(user.email || '');
          setStage('finish');
        }

        try {
          const data = await getInvitation(invitationId);

          if (!active) return;

          setInvitation(data);

          if (data.email) {
            setEmail((previous) => {
              return previous || data.email;
            });
          }
        } catch (invitationError) {
          if (!active) return;

          if (isPermissionError(invitationError)) {
            setNotice(
              'Nie udało się odczytać zaproszenia z powodu reguł Firestore. Jeśli konto zostało już utworzone, możesz spróbować dokończyć aktywację.'
            );

            return;
          }

          if (INVITATION_BLOCKING_ERRORS[invitationError?.code]) {
            setInvitationErrorCode(invitationError.code);
            setError('');
            setNotice('');
            return;
          }

          if (user && !user.isAnonymous) {
            setNotice(
              'Nie udało się odczytać aktywnego zaproszenia. Jeśli konto zostało już utworzone, spróbuj dokończyć aktywację.'
            );

            return;
          }

          throw invitationError;
        }
      } catch (initializationError) {
        if (active) {
          setError(getActivationError(initializationError));
        }
      } finally {
        if (active) {
          setChecking(false);
        }
      }
    }

    initialize();

    return () => {
      active = false;
    };
  }, [invitationId]);

  const normalizedName = normalizeName(name);

  const hasFullName = normalizedName.split(' ').filter(Boolean).length >= 2;

  const passwordChecks = validatePassword(password);

  const passwordsMatch = Boolean(
    confirmPassword.length > 0 && password === confirmPassword
  );

  const canRegister = Boolean(
    invitationId &&
      !checking &&
      !invitationErrorCode &&
      !submitting &&
      normalizeEmail(email) &&
      hasFullName &&
      passwordChecks.valid &&
      passwordsMatch
  );

  const canFinish = Boolean(
    invitationId &&
      !checking &&
      !invitationErrorCode &&
      !submitting &&
      normalizeEmail(email) &&
      password
  );

  function clearMessages() {
    setError('');
    setNotice('');
  }

  function switchToFinish() {
    clearMessages();

    setPassword('');
    setConfirmPassword('');

    setStage('finish');
  }

  function switchToRegister() {
    clearMessages();

    setPassword('');
    setConfirmPassword('');

    setStage('register');
  }

  async function handleRegister(event) {
    event.preventDefault();

    if (!canRegister) return;

    setSubmitting(true);
    clearMessages();

    try {
      await registerInvitedUser({
        invitationId,
        email: normalizeEmail(email),
        name: normalizedName,
        password,
        confirmPassword,
      });

      setPassword('');
      setConfirmPassword('');

      setStage('verification');

      setNotice(
        'Konto zostało utworzone. Sprawdź pocztę i potwierdź adres e-mail. Następnie wróć do tego linku, zaloguj się i wyślij prośbę o dostęp. Konto nie otrzyma żadnych uprawnień bez zgody administratora.'
      );
    } catch (activationError) {
      console.error('Błąd rejestracji konta:', activationError);

      setError(getActivationError(activationError));

      if (activationError?.code === 'auth/email-already-in-use') {
        setStage('finish');
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleFinish(event) {
    event.preventDefault();

    if (!canFinish) return;

    setSubmitting(true);
    clearMessages();

    try {
      await authReady;

      const normalizedEmail = normalizeEmail(email);

      let user = auth.currentUser;

      if (
        !user ||
        user.isAnonymous ||
        normalizeEmail(user.email) !== normalizedEmail
      ) {
        const credential = await signInWithEmailAndPassword(
          auth,
          normalizedEmail,
          password
        );

        user = credential.user;
      }

      const verified = await refreshEmailVerification(user);

      if (!verified) {
        setStage('verification');

        setNotice(
          'Adres e-mail nie został jeszcze potwierdzony. Sprawdź wiadomość od Firebase, kliknij link weryfikacyjny, a następnie wróć tutaj.'
        );

        return;
      }

      setNotice(
        'Adres e-mail został potwierdzony. Trwa sprawdzanie konta i wysyłanie prośby do administratora...'
      );

      const result = await activateVerifiedUser(invitationId, password);

      if (!result?.success) {
        throw new Error('Nie udało się zakończyć aktywacji.');
      }

      setPassword('');
      setConfirmPassword('');
      setError('');

      if (result.pendingApproval) {
        setStage('pending_approval');

        setNotice(
          'Prośba o rejestrację została zapisana. Administrator musi ją zatwierdzić i przydzielić Ci uprawnienia. Do tego czasu konto nie ma dostępu do modułów systemu.'
        );

        return;
      }

      if (result.alreadyActive) {
        setStage('completed');

        setNotice(
          'Twoje konto jest już zatwierdzone i aktywne. Możesz przejść do logowania.'
        );

        return;
      }

      setStage('completed');

      setNotice(
        'Konto zostało pomyślnie aktywowane. Możesz przejść do logowania.'
      );
    } catch (activationError) {
      console.error('Błąd aktywacji konta:', activationError);

      setNotice('');
      setError(getActivationError(activationError));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCheckVerification() {
    setSubmitting(true);
    clearMessages();

    try {
      await authReady;

      const user = auth.currentUser;

      if (!user || user.isAnonymous) {
        setStage('finish');

        setNotice(
          'Jeśli potwierdziłaś już adres e-mail, wpisz adres i hasło ustawione podczas rejestracji, aby wysłać prośbę o dostęp.'
        );

        return;
      }

      const verified = await refreshEmailVerification(user);

      if (!verified) {
        setNotice(
          'Adres e-mail nie jest jeszcze potwierdzony. Sprawdź pocztę i folder spam.'
        );

        return;
      }

      setStage('finish');

      setNotice(
        'Adres e-mail został potwierdzony. Wpisz hasło i kliknij „Zakończ aktywację konta”, aby wysłać prośbę do administratora.'
      );
    } catch (verificationError) {
      console.error('Błąd sprawdzania weryfikacji:', verificationError);

      setError(getActivationError(verificationError));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResendVerification() {
    setSubmitting(true);
    clearMessages();

    try {
      await sendVerificationEmail();

      setNotice('Wysłano ponownie wiadomość weryfikacyjną.');
    } catch (verificationError) {
      console.error('Błąd wysyłania weryfikacji:', verificationError);

      setError(getActivationError(verificationError));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSwitchAccount() {
    setSubmitting(true);
    clearMessages();

    try {
      await signOut(auth);

      setCurrentUser(null);

      setEmail('');
      setPassword('');
      setConfirmPassword('');

      setStage('finish');

      setNotice('Możesz teraz zalogować się na inne konto.');
    } catch (logoutError) {
      setError(getActivationError(logoutError));
    } finally {
      setSubmitting(false);
    }
  }

  function handleGoToLogin() {
    if (typeof goToLogin === 'function') {
      goToLogin();
      return;
    }

    window.location.assign('/');
  }

  function renderContent() {
    if (checking) {
      return (
        <div className="activation-state">
          <div className="activation-spinner" />

          <h1>Sprawdzanie aktywacji</h1>

          <p>Proszę czekać...</p>
        </div>
      );
    }

    if (!invitationId || invitationId.includes('/')) {
      return (
        <div className="activation-state">
          <div className="activation-state-icon">!</div>

          <h1>Nieprawidłowe zaproszenie</h1>

          <p>Poproś administratora o prawidłowy link.</p>
        </div>
      );
    }

    const blockedInvitation = INVITATION_BLOCKING_ERRORS[invitationErrorCode];

    if (blockedInvitation) {
      return (
        <div className="activation-state">
          <div className="activation-state-icon" aria-hidden="true">
            {blockedInvitation.icon}
          </div>
          <h1>{blockedInvitation.title}</h1>
          <p>{blockedInvitation.description}</p>
          {invitationErrorCode === 'activation/invitation-not-started' && (
            <p>
              Jeśli problem będzie się powtarzał, skontaktuj się z
              administratorem.
            </p>
          )}
          <button
            type="button"
            className="activation-primary-button"
            onClick={() => window.location.reload()}
          >
            Sprawdź ponownie
          </button>
        </div>
      );
    }

    if (stage === 'pending_approval') {
      return (
        <div className="activation-state">
          <div className="activation-state-icon">⌛</div>

          <h1>Oczekiwanie na zatwierdzenie</h1>

          <p>
            Twój adres e-mail został potwierdzony, a prośba o rejestrację
            została przekazana do administratora.
          </p>

          <p>
            Administrator musi zatwierdzić konto i przydzielić Ci odpowiednie
            uprawnienia.
          </p>

          <p>Do tego czasu nie możesz korzystać z modułów LS Zakupy.</p>

          <button
            type="button"
            className="activation-primary-button"
            onClick={handleGoToLogin}
            disabled={submitting}
          >
            Przejdź do logowania
          </button>
        </div>
      );
    }

    if (stage === 'completed') {
      return (
        <div className="activation-state">
          <div className="activation-state-icon success">✓</div>

          <h1>Konto aktywowane</h1>

          <p>
            Twoje konto LS Zakupy jest gotowe. Możesz zalogować się do systemu.
          </p>

          <button
            type="button"
            className="activation-primary-button"
            onClick={handleGoToLogin}
            disabled={submitting}
          >
            Przejdź do panelu
          </button>
        </div>
      );
    }

    if (stage === 'verification') {
      return (
        <div className="activation-state">
          <div className="activation-state-icon">✉</div>

          <h1>Potwierdź adres e-mail</h1>

          <p>
            Sprawdź pocztę i kliknij link weryfikacyjny przesłany przez
            Firebase.
          </p>

          <p>
            Po potwierdzeniu adresu wróć tutaj, aby wysłać prośbę o dostęp do
            systemu.
          </p>

          <button
            type="button"
            className="activation-primary-button"
            onClick={handleCheckVerification}
            disabled={submitting}
          >
            {submitting ? 'Sprawdzanie...' : 'Sprawdź weryfikację'}
          </button>

          {currentUser && (
            <button
              type="button"
              className="activation-secondary-button"
              onClick={handleResendVerification}
              disabled={submitting}
            >
              Wyślij e-mail ponownie
            </button>
          )}

          <button
            type="button"
            className="activation-text-button"
            onClick={switchToFinish}
            disabled={submitting}
          >
            Mam już potwierdzony e-mail
          </button>
        </div>
      );
    }

    if (stage === 'finish') {
      return (
        <form className="activation-form" onSubmit={handleFinish}>
          <div className="activation-heading">
            <span className="activation-eyebrow">OSTATNI KROK</span>

            <h1>Dokończ aktywację</h1>

            <p>
              Zaloguj się adresem e-mail i hasłem ustawionym podczas
              rejestracji. Po potwierdzeniu e-maila wyślemy prośbę o dostęp do
              administratora.
            </p>
          </div>

          {currentUser && (
            <div className="activation-invitation">
              <span>Aktualnie zalogowane konto</span>

              <strong>{currentUser.email}</strong>
            </div>
          )}

          <div className="activation-field">
            <label htmlFor="finish-email">Adres e-mail</label>

            <input
              id="finish-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              disabled={submitting}
              required
            />
          </div>

          <div className="activation-field">
            <label htmlFor="finish-password">Hasło</label>

            <input
              id="finish-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              disabled={submitting}
              required
            />
          </div>

          <label className="activation-checkbox">
            <input
              type="checkbox"
              checked={showPassword}
              onChange={(event) => setShowPassword(event.target.checked)}
            />

            <span>Pokaż hasło</span>
          </label>

          <button
            type="submit"
            className="activation-primary-button"
            disabled={!canFinish}
          >
            {submitting ? 'Sprawdzanie konta...' : 'Zakończ aktywację konta'}
          </button>

          {currentUser && (
            <button
              type="button"
              className="activation-secondary-button"
              onClick={handleSwitchAccount}
              disabled={submitting}
            >
              Użyj innego konta
            </button>
          )}

          <button
            type="button"
            className="activation-text-button"
            onClick={switchToRegister}
            disabled={submitting}
          >
            Wróć do rejestracji
          </button>
        </form>
      );
    }

    return (
      <form className="activation-form" onSubmit={handleRegister}>
        <div className="activation-heading">
          <span className="activation-eyebrow">ZAPROSZENIE DO SYSTEMU</span>

          <h1>Aktywacja konta</h1>

          <p>
            Podaj swoje imię, nazwisko i adres e-mail, a następnie ustaw hasło.
          </p>

          <p>
            Po potwierdzeniu adresu e-mail administrator będzie musiał
            zatwierdzić Twoją rejestrację.
          </p>
        </div>

        {invitation && (
          <div className="activation-invitation">
            <span>Dostępne zaproszenie</span>

            <strong>
              {invitation.maxUses == null
                ? 'Bez limitu osób'
                : `${Math.max(
                    0,
                    Number(invitation.maxUses) -
                      Number(invitation.usedCount || 0)
                  )} z ${invitation.maxUses} miejsc`}
            </strong>

            {invitation.expiresAt && (
              <span>Ważne do: {formatDate(invitation.expiresAt)}</span>
            )}
          </div>
        )}

        <div className="activation-field">
          <label htmlFor="activation-name">Imię i nazwisko</label>

          <input
            id="activation-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="name"
            disabled={submitting}
            required
          />
        </div>

        <div className="activation-field">
          <label htmlFor="activation-email">Adres e-mail</label>

          <input
            id="activation-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            disabled={submitting}
            required
          />
        </div>

        <div className="activation-field">
          <label htmlFor="activation-password">Nowe hasło</label>

          <input
            id="activation-password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            disabled={submitting}
            required
          />
        </div>

        <div className="activation-field">
          <label htmlFor="activation-confirm-password">Powtórz hasło</label>

          <input
            id="activation-confirm-password"
            type={showPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
            disabled={submitting}
            required
          />
        </div>

        <label className="activation-checkbox">
          <input
            type="checkbox"
            checked={showPassword}
            onChange={(event) => setShowPassword(event.target.checked)}
          />

          <span>Pokaż hasło</span>
        </label>

        <div className="activation-password-rules">
          <strong>Wymagania dotyczące hasła</strong>

          <Requirement valid={passwordChecks.minLength}>
            Minimum 8 znaków
          </Requirement>

          <Requirement valid={passwordChecks.uppercase}>
            Co najmniej jedna wielka litera
          </Requirement>

          <Requirement valid={passwordChecks.specialCharacter}>
            Co najmniej jeden znak specjalny
          </Requirement>

          <Requirement valid={passwordsMatch}>Hasła są identyczne</Requirement>
        </div>

        <button
          type="submit"
          className="activation-primary-button"
          disabled={!canRegister}
        >
          {submitting
            ? 'Tworzenie konta...'
            : 'Utwórz konto i wyślij weryfikację'}
        </button>

        <button
          type="button"
          className="activation-text-button"
          onClick={switchToFinish}
          disabled={submitting}
        >
          Mam już konto — dokończ aktywację
        </button>
      </form>
    );
  }

  return (
    <main className="activation-page">
      <div className="activation-background" aria-hidden="true">
        <LiquidEther
          colors={LIQUID_COLORS}
          mouseForce={20}
          cursorSize={60}
          isViscous
          viscous={18}
          iterationsViscous={16}
          iterationsPoisson={16}
          resolution={0.35}
          isBounce={false}
          autoDemo
          autoSpeed={0.35}
          autoIntensity={1.4}
          takeoverDuration={0.25}
          autoResumeDelay={3000}
          autoRampDuration={0.6}
        />
      </div>

      <section className="activation-card">
        <div className="activation-logo">
          <Logo className="admin-logo" />
        </div>

        {renderContent()}

        {notice && (
          <div className="activation-notice" role="status">
            {notice}
          </div>
        )}

        {error && !invitationErrorCode && (
          <div className="activation-error" role="alert">
            {error}
          </div>
        )}

        <div className="activation-footer">
          <button
            type="button"
            className="activation-text-button"
            onClick={handleGoToLogin}
            disabled={submitting}
          >
            ← Powrót do logowania
          </button>
        </div>
      </section>
    </main>
  );
}
