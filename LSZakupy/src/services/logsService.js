import { ADMIN_UIDS } from '../config/roles';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../firebase/firebase';

const LOGS_COLLECTION = 'logs';
const LOG_LIMIT = 200;

const ACTION_ALIASES = {
  create: 'create',
  created: 'create',
  add: 'create',
  added: 'create',
  edit: 'edit',
  edited: 'edit',
  update: 'edit',
  updated: 'edit',
  delete: 'delete',
  deleted: 'delete',
  remove: 'delete',
  removed: 'delete',
  accept: 'accept',
  accepted: 'accept',
  complete: 'complete',
  completed: 'complete',
  assign: 'assign',
  assigned: 'assign',
  read: 'read',
  unread: 'unread',
  cancel: 'cancel',
  cancelled: 'cancel',
  canceled: 'cancel',
};

function cleanText(value = '') {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeAction(value) {
  const key = cleanText(value).toLowerCase();
  return ACTION_ALIASES[key] || key;
}

function normalizeModule(value) {
  const key = cleanText(value).toLowerCase();

  if (
    ['orders', 'order', 'shopping', 'zamowienia', 'zamówienia'].includes(key)
  ) {
    return 'orders';
  }

  if (['calendar', 'kalendarz', 'events'].includes(key)) {
    return 'calendar';
  }

  if (['users', 'user', 'uzytkownicy', 'użytkownicy'].includes(key)) {
    return 'users';
  }

  if (['notifications', 'notification', 'powiadomienia'].includes(key)) {
    return 'notifications';
  }

  return key;
}

function detectModule(message, type) {
  const text = cleanText(message).toLowerCase();
  const actionType = cleanText(type).toLowerCase();

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

  if (
    /użytkownik|uzytkownik|pracownik|konto użytkownika|konto pracownika/.test(
      text
    )
  ) {
    return 'users';
  }

  if (/powiadomieni/.test(text) || ['read', 'unread'].includes(actionType)) {
    return 'notifications';
  }

  return '';
}

function detectAction(message) {
  const text = cleanText(message).toLowerCase();

  if (/usunął|usunęła|usunięt|usunięto|usunal|usunela/.test(text)) {
    return 'delete';
  }

  if (/edytował|edytowała|edytowano|zmodyfikował|zmodyfikowano/.test(text)) {
    return 'edit';
  }

  if (/przypisał|przypisała|przejął|przejęła/.test(text)) {
    return 'assign';
  }

  if (/zrealizował|zrealizowano|zrealizowane/.test(text)) {
    return 'complete';
  }

  if (/przyjął|przyjęła|przyjęto/.test(text)) {
    return 'accept';
  }

  if (/anulował|anulowała|anulowano/.test(text)) {
    return 'cancel';
  }

  if (/dodał|dodała|dodano|utworzył|utworzono/.test(text)) {
    return 'create';
  }

  if (/zmienił|zmieniła|zmieniono/.test(text)) {
    return 'edit';
  }

  return '';
}

function checkAdmin() {
  const user = auth.currentUser;

  if (!user || !ADMIN_UIDS.includes(user.uid)) {
    throw new Error('Brak uprawnień administratora');
  }
}

function getAuthUserName(user) {
  if (!user) return '';

  const displayName = cleanText(user.displayName);

  if (displayName) return displayName;

  const email = cleanText(user.email);

  if (email) return email.split('@')[0];

  return '';
}

async function getCurrentActor() {
  const user = auth.currentUser;

  if (!user) {
    return {
      userId: '',
      userName: 'Nieznany użytkownik',
      userEmail: '',
    };
  }

  let userName = getAuthUserName(user);

  try {
    const userSnapshot = await getDoc(doc(db, 'users', user.uid));

    if (userSnapshot.exists()) {
      const profile = userSnapshot.data();

      userName =
        cleanText(profile.name) || cleanText(profile.displayName) || userName;
    }
  } catch (error) {
    console.error('Log actor loading error:', error);
  }

  if (!userName && ADMIN_UIDS.includes(user.uid)) {
    userName = 'Administrator';
  }

  return {
    userId: user.uid,
    userName: userName || 'Nieznany użytkownik',
    userEmail: cleanText(user.email),
  };
}

export async function addLog(message, type = 'info', details = {}) {
  const cleanMessage = cleanText(message);

  if (!cleanMessage) return;

  const user = auth.currentUser;

  if (!user) {
    console.error('Log save error: Brak zalogowanego użytkownika.');
    return;
  }

  try {
    const actor = await getCurrentActor();

    const extra =
      details && typeof details === 'object' && !Array.isArray(details)
        ? details
        : {};

    const rawType = cleanText(type) || 'info';

    const action =
      normalizeAction(extra.action || rawType) ||
      detectAction(cleanMessage) ||
      'other';

    const module =
      normalizeModule(extra.module) ||
      detectModule(cleanMessage, rawType) ||
      'other';

    const logData = {
      message: cleanMessage,
      type: rawType,
      action,
      module,
      userId: actor.userId,
      userName: actor.userName,
      userEmail: actor.userEmail,
      actorUid: actor.userId,
      actorName: actor.userName,
      createdAt: serverTimestamp(),
    };

    if (cleanText(extra.orderId)) {
      logData.orderId = cleanText(extra.orderId);
    }

    if (cleanText(extra.orderName)) {
      logData.orderName = cleanText(extra.orderName);
    }

    if (cleanText(extra.product)) {
      logData.product = cleanText(extra.product);
    }

    await addDoc(collection(db, LOGS_COLLECTION), logData);
  } catch (error) {
    console.error('Log save error:', error);
  }
}

export function listenToLogs(callback) {
  checkAdmin();

  const logsQuery = query(
    collection(db, LOGS_COLLECTION),
    orderBy('createdAt', 'desc'),
    limit(LOG_LIMIT)
  );

  return onSnapshot(
    logsQuery,
    (snapshot) => {
      const logs = snapshot.docs.map((document) => {
        const data = document.data();

        const message = cleanText(data.message);
        const type = cleanText(data.type);

        const action =
          normalizeAction(data.action || type) ||
          detectAction(message) ||
          'other';

        const module =
          normalizeModule(data.module) ||
          detectModule(message, type) ||
          'other';

        return {
          ...data,
          id: document.id,
          action,
          module,
          userId: cleanText(
            data.userId || data.actorUid || data.uid || data.createdByUid
          ),
          userName: cleanText(
            data.userName ||
              data.actorName ||
              data.createdByName ||
              data.displayName
          ),
          userEmail: cleanText(data.userEmail || data.actorEmail),
        };
      });

      if (typeof callback === 'function') {
        callback(logs);
      }
    },
    (error) => {
      console.error('Log listener error:', error);
    }
  );
}
