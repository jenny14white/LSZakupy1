import { initializeApp, getApp, getApps } from 'firebase/app';

import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  signInAnonymously,
  onAuthStateChanged,
} from 'firebase/auth';

import { getFirestore } from 'firebase/firestore';

function getEnvValue(name) {
  const value = import.meta.env[name];

  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().replace(/^["']|["']$/g, '');
}

const firebaseConfig = {
  apiKey: getEnvValue('VITE_FIREBASE_API_KEY'),
  authDomain: getEnvValue('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: getEnvValue('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: getEnvValue('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnvValue('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: getEnvValue('VITE_FIREBASE_APP_ID'),
};

const requiredFields = {
  apiKey: 'VITE_FIREBASE_API_KEY',
  authDomain: 'VITE_FIREBASE_AUTH_DOMAIN',
  projectId: 'VITE_FIREBASE_PROJECT_ID',
  appId: 'VITE_FIREBASE_APP_ID',
};

const missingFields = Object.entries(requiredFields)
  .filter(([key]) => !firebaseConfig[key])
  .map(([, envName]) => envName);

if (missingFields.length > 0) {
  throw new Error(
    `Brak konfiguracji Firebase: ${missingFields.join(
      ', '
    )}. Uzupełnij plik .env i uruchom ponownie Vite.`
  );
}

if (!/^AIza[A-Za-z0-9_-]+$/.test(firebaseConfig.apiKey)) {
  throw new Error(
    'Nieprawidłowy format VITE_FIREBASE_API_KEY. Skopiuj klucz API z Firebase Console.'
  );
}

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);

export const db = getFirestore(app);

export const authReady = setPersistence(auth, browserLocalPersistence).catch(
  (error) => {
    console.error('Nie udało się ustawić trwałości sesji Firebase:', error);
  }
);

function waitForAuthInitialization() {
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        unsubscribe();
        resolve(user);
      },
      (error) => {
        unsubscribe();
        reject(error);
      }
    );
  });
}

let anonymousSignInPromise = null;

export async function signInAnonymouslyForOrder() {
  await authReady;

  const existingUser = await waitForAuthInitialization();

  if (existingUser) {
    return existingUser;
  }

  if (!anonymousSignInPromise) {
    anonymousSignInPromise = signInAnonymously(auth)
      .then((result) => result.user)
      .finally(() => {
        anonymousSignInPromise = null;
      });
  }

  return anonymousSignInPromise;
}
