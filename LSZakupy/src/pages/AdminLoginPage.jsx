import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { sendPasswordResetEmail } from 'firebase/auth';
import { loginAdmin } from '../firebase/auth';
import { auth } from '../firebase/firebase';
import Logo from '../components/shared/Logo';
import LiquidEther from '../components/shared/effects/LiquidEther';

const LIQUID_COLORS = ['#0353a4', '#023e7d', '#002855'];

function normalizeEmail(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function getLoginError(error) {
  const code = error?.code;
  const message = error?.message || '';

  if (code === 'auth/too-many-requests') {
    return 'Zbyt wiele prób logowania. Spróbuj ponownie później.';
  }

  if (code === 'auth/network-request-failed') {
    return 'Brak połączenia z internetem.';
  }

  if (code === 'auth/invalid-email') {
    return 'Podany adres e-mail jest nieprawidłowy.';
  }

  if (
    code === 'auth/invalid-credential' ||
    code === 'auth/wrong-password' ||
    code === 'auth/user-not-found'
  ) {
    return 'Nieprawidłowy adres e-mail lub hasło.';
  }

  if (message.includes('oczekuje na zatwierdzenie')) {
    return 'Twoje konto oczekuje na zatwierdzenie przez administratora. Po zatwierdzeniu i przydzieleniu uprawnień uzyskasz dostęp do Panelu Zarządzania.';
  }

  if (message.includes('odrzucił')) {
    return 'Twoja prośba o rejestrację została odrzucona przez administratora.';
  }

  if (message.includes('Potwierdź adres e-mail')) {
    return 'Potwierdź adres e-mail przed pierwszym logowaniem.';
  }

  if (
    message.includes('nie zostało jeszcze aktywowane') ||
    message.includes('nie ma aktywnego profilu')
  ) {
    return 'Twoje konto nie zostało jeszcze aktywowane. Wróć do linku zaproszenia i dokończ rejestrację.';
  }

  if (message.includes('zablokowane')) {
    return 'Twoje konto zostało zablokowane przez administratora.';
  }

  if (message.includes('uprawnień') || message.includes('dostępu')) {
    return message;
  }

  return 'Nie udało się zalogować. Sprawdź dane i spróbuj ponownie.';
}

function getResetError(error) {
  const code = error?.code;

  if (code === 'auth/invalid-email') {
    return 'Podany adres e-mail jest nieprawidłowy.';
  }

  if (code === 'auth/network-request-failed') {
    return 'Brak połączenia z internetem.';
  }

  if (code === 'auth/too-many-requests') {
    return 'Zbyt wiele prób. Spróbuj ponownie później.';
  }

  if (code === 'auth/operation-not-allowed') {
    return 'Resetowanie hasła jest obecnie niedostępne.';
  }

  return 'Nie udało się wysłać wiadomości. Spróbuj ponownie później.';
}

export default function AdminLoginPage({ goBack, onLogin }) {
  const { t } = useTranslation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);

  const [view, setView] = useState('login');
  const [resetEmail, setResetEmail] = useState('');

  async function handleLogin(event) {
    event.preventDefault();

    if (loading) return;

    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !password) {
      setError('Podaj adres e-mail i hasło.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setNotice('');

      const user = await loginAdmin(normalizedEmail, password);

      setEmail('');
      setPassword('');
      setShowPassword(false);

      if (typeof onLogin === 'function') {
        onLogin(user);
      }
    } catch (loginError) {
      console.error('Login error:', loginError);
      setError(getLoginError(loginError));
    } finally {
      setLoading(false);
    }
  }

  async function handleResetRequest(event) {
    event.preventDefault();

    if (loading) return;

    const normalizedEmail = normalizeEmail(resetEmail);

    if (!normalizedEmail) {
      setError('Podaj adres e-mail.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setNotice('');

      await sendPasswordResetEmail(auth, normalizedEmail);

      setNotice(
        'Jeżeli konto z podanym adresem e-mail istnieje, otrzymasz wiadomość z linkiem do zresetowania hasła. Sprawdź również folder spam.'
      );

      setResetEmail('');
    } catch (requestError) {
      console.error('Password reset error:', requestError);
      setError(getResetError(requestError));
    } finally {
      setLoading(false);
    }
  }

  function openResetView() {
    setResetEmail(email);
    setError('');
    setNotice('');
    setView('reset');
  }

  function openLoginView() {
    setError('');
    setNotice('');
    setView('login');
  }

  return (
    <main className="admin-page login-view">
      <div className="admin-background" aria-hidden="true">
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

      <form
        className="login-card"
        onSubmit={view === 'login' ? handleLogin : handleResetRequest}
      >
        <button
          type="button"
          className="back-button"
          onClick={view === 'login' ? goBack : openLoginView}
          disabled={loading}
        >
          {view === 'login'
            ? t('shopping.page.back', 'Powrót')
            : '← Wróć do logowania'}
        </button>

        <Logo className="admin-logo" />

        {view === 'login' ? (
          <>
            <h1>Panel Zarządzania</h1>

            <p>
              Zaloguj się, aby uzyskać dostęp do modułów i funkcji przypisanych
              do Twojego konta.
            </p>

            <input
              type="email"
              name="email"
              aria-label="Adres e-mail"
              placeholder="Adres e-mail"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoFocus
              autoComplete="username"
              disabled={loading}
              required
            />

            <input
              type={showPassword ? 'text' : 'password'}
              name="password"
              aria-label="Hasło"
              placeholder="Hasło"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              disabled={loading}
              required
            />

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                alignSelf: 'flex-start',
                color: 'var(--text)',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={showPassword}
                onChange={(event) => setShowPassword(event.target.checked)}
                disabled={loading}
                style={{
                  width: 16,
                  height: 16,
                  minHeight: 16,
                  accentColor: 'var(--accent)',
                  cursor: 'pointer',
                }}
              />

              <span>Pokaż hasło</span>
            </label>

            <button
              type="button"
              onClick={openResetView}
              disabled={loading}
              style={{
                alignSelf: 'flex-end',
                border: 'none',
                background: 'transparent',
                color: 'var(--accent)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                padding: '4px 0',
              }}
            >
              Zapomniałem hasła?
            </button>
          </>
        ) : (
          <>
            <h1>Resetowanie hasła</h1>

            <p>
              Podaj adres e-mail przypisany do Twojego konta. Wyślemy link,
              dzięki któremu ustawisz nowe hasło.
            </p>

            <input
              type="email"
              name="resetEmail"
              aria-label="Adres e-mail"
              placeholder="Adres e-mail"
              value={resetEmail}
              onChange={(event) => setResetEmail(event.target.value)}
              autoFocus
              autoComplete="email"
              disabled={loading}
              required
            />
          </>
        )}

        {error && (
          <div className="admin-error" role="alert">
            {error}
          </div>
        )}

        {notice && (
          <div
            role="status"
            style={{
              padding: 14,
              borderRadius: 12,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              fontSize: 13,
              lineHeight: 1.6,
            }}
          >
            {notice}
          </div>
        )}

        <button type="submit" className="admin-button" disabled={loading}>
          {loading
            ? 'Proszę czekać...'
            : view === 'login'
            ? 'Zaloguj się'
            : 'Wyślij link resetujący hasło'}
        </button>
      </form>
    </main>
  );
}
