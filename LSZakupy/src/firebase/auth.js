import {
  signInWithEmailAndPassword,
  signInAnonymously,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  updatePassword,
  updateProfile,
  signOut,
  reload,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from 'firebase/auth';

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';

import {
  ADMIN_UID,
  MODULES,
  MANAGED_MODULES,
  MODULE_PERMISSIONS,
  PERMISSIONS,
  normalizePermissions,
  createFullPermissions,
  createEmptyPermissions,
  hasPermission,
  canAccessModule,
} from '../config/roles';

import { auth, db, authReady } from './firebase';

const PASSWORD_MIN_LENGTH = 8;

function normalizeEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
}

function normalizeName(name) {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizeInvitationId(invitationId) {
  const id = String(invitationId || '').trim();

  if (!id || id.includes('/')) {
    throw new Error('Nieprawidłowy identyfikator zaproszenia.');
  }

  return id;
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

function createActivationError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function isPermissionError(error) {
  return (
    error?.code === 'permission-denied' ||
    error?.code === 'firestore/permission-denied'
  );
}

function hasAnyModulePermission(permissions) {
  const normalized = normalizePermissions(permissions);

  return MANAGED_MODULES.some((moduleId) => normalized[moduleId]?.length > 0);
}

function isProfileEmailValid(user, profile) {
  return Boolean(
    normalizeEmail(user?.email) &&
      normalizeEmail(user?.email) === normalizeEmail(profile?.email)
  );
}

function isActiveInvitedProfile(user, profile) {
  return Boolean(
    user &&
      !user.isAnonymous &&
      user.emailVerified &&
      profile &&
      profile.uid === user.uid &&
      profile.role === 'user' &&
      profile.status === 'active' &&
      typeof profile.invitationId === 'string' &&
      profile.invitationId.trim() &&
      isProfileEmailValid(user, profile)
  );
}

export function validatePassword(password) {
  const value = String(password || '');

  const checks = {
    minLength: value.length >= PASSWORD_MIN_LENGTH,
    uppercase: /[A-ZĄĆĘŁŃÓŚŹŻ]/.test(value),
    specialCharacter: /[^a-zA-Z0-9ĄĆĘŁŃÓŚŹŻąćęłńóśźż]/.test(value),
  };

  return {
    ...checks,
    valid: Object.values(checks).every(Boolean),
  };
}

export function getPasswordError(password) {
  const validation = validatePassword(password);

  if (!validation.minLength) {
    return 'Hasło musi mieć minimum 8 znaków.';
  }

  if (!validation.uppercase) {
    return 'Hasło musi zawierać co najmniej jedną wielką literę.';
  }

  if (!validation.specialCharacter) {
    return 'Hasło musi zawierać co najmniej jeden znak specjalny.';
  }

  return null;
}

export function isLegacyAdmin(uid) {
  return uid === ADMIN_UID;
}

export async function getUserProfile(uid) {
  if (!uid) return null;

  const snapshot = await getDoc(doc(db, 'users', uid));

  if (!snapshot.exists()) return null;

  return {
    ...snapshot.data(),
    uid: snapshot.id,
  };
}

function checkInvitation(invitation) {
  if (invitation.status !== 'pending') {
    throw createActivationError(
      'To zaproszenie nie jest już aktywne.',
      'activation/invitation-inactive'
    );
  }

  if (
    invitation.role !== 'user' ||
    !invitation.permissions ||
    typeof invitation.permissions !== 'object' ||
    Array.isArray(invitation.permissions)
  ) {
    throw createActivationError(
      'Zaproszenie ma nieprawidłowe dane.',
      'activation/invitation-invalid'
    );
  }

  const now = Date.now();
  const start = toDate(invitation.startsAt);
  const end = toDate(invitation.expiresAt);

  if (start && now < start.getTime()) {
    throw createActivationError(
      'Zaproszenie nie jest jeszcze ważne.',
      'activation/invitation-not-started'
    );
  }

  if (end && now >= end.getTime()) {
    throw createActivationError(
      'Termin ważności zaproszenia minął.',
      'activation/invitation-expired'
    );
  }

  const used = Number(invitation.usedCount ?? 0);

  const max = invitation.maxUses == null ? null : Number(invitation.maxUses);

  if (
    !Number.isSafeInteger(used) ||
    used < 0 ||
    (max !== null && (!Number.isSafeInteger(max) || max < 1))
  ) {
    throw createActivationError(
      'Zaproszenie ma nieprawidłowy limit wykorzystań.',
      'activation/invitation-invalid'
    );
  }

  if (max !== null && used >= max) {
    throw createActivationError(
      'Limit wykorzystań zaproszenia został wyczerpany.',
      'activation/invitation-used'
    );
  }

  return { used, max };
}

export async function getInvitation(invitationId) {
  const id = normalizeInvitationId(invitationId);

  const snapshot = await getDoc(doc(db, 'userInvitations', id));

  if (!snapshot.exists()) {
    throw createActivationError(
      'Zaproszenie nie istnieje lub zostało usunięte.',
      'activation/invitation-missing'
    );
  }

  const invitation = snapshot.data();

  checkInvitation(invitation);

  return {
    ...invitation,
    id,
  };
}

export async function saveLastLogin(user) {
  if (!user || user.isAnonymous) return;

  try {
    if (user.uid === ADMIN_UID) {
      await setDoc(
        doc(db, 'users', user.uid),
        {
          uid: user.uid,
          email: user.email || '',
          name: 'Administrator',
          role: 'admin',
          lastLoginAt: serverTimestamp(),
        },
        { merge: true }
      );

      return;
    }

    const profile = await getUserProfile(user.uid);

    if (isActiveInvitedProfile(user, profile)) {
      await updateDoc(doc(db, 'users', user.uid), {
        lastLoginAt: serverTimestamp(),
      });
    }
  } catch (error) {
    console.error('Nie udało się zapisać ostatniego logowania:', error);
  }
}

export async function loginAdmin(email, password) {
  await authReady;

  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !password) {
    throw new Error('Podaj adres e-mail i hasło.');
  }

  const credential = await signInWithEmailAndPassword(
    auth,
    normalizedEmail,
    password
  );

  const user = credential.user;

  try {
    if (user.uid !== ADMIN_UID) {
      await reload(user);
      await user.getIdToken(true);

      const profile = await getUserProfile(user.uid);

      if (!profile) {
        throw new Error(
          'Konto istnieje, ale nie ma aktywnego profilu. Wróć do linku zaproszenia i dokończ aktywację.'
        );
      }

      if (profile.status === 'pending_approval') {
        throw new Error(
          'Konto oczekuje na zatwierdzenie przez administratora.'
        );
      }

      if (profile.status === 'rejected') {
        throw new Error('Administrator odrzucił prośbę o rejestrację.');
      }

      if (profile.status === 'blocked') {
        throw new Error('To konto zostało zablokowane przez administratora.');
      }

      if (!user.emailVerified) {
        throw new Error('Potwierdź adres e-mail przed zalogowaniem.');
      }

      if (!isActiveInvitedProfile(user, profile)) {
        throw new Error('Konto nie zostało jeszcze prawidłowo aktywowane.');
      }

      if (!hasAnyModulePermission(profile.permissions)) {
        throw new Error('Nie masz przydzielonego dostępu do żadnego modułu.');
      }
    }

    await saveLastLogin(user);

    return user;
  } catch (error) {
    await signOut(auth).catch(() => {});
    throw error;
  }
}

export async function loginPortal() {
  await authReady;

  if (auth.currentUser) {
    return auth.currentUser;
  }

  const credential = await signInAnonymously(auth);

  return credential.user;
}

export async function logoutAdmin() {
  await authReady;
  await signOut(auth);
}

export async function logoutPortal() {
  await authReady;
  await signOut(auth);
}

export async function sendVerificationEmail(user = auth.currentUser) {
  if (!user || user.isAnonymous) {
    throw new Error('Musisz być zalogowany, aby potwierdzić adres e-mail.');
  }

  await reload(user);

  if (user.emailVerified) {
    await user.getIdToken(true);

    return {
      success: true,
      alreadyVerified: true,
    };
  }

  await sendEmailVerification(user);

  return {
    success: true,
    alreadyVerified: false,
  };
}

export async function refreshEmailVerification(user = auth.currentUser) {
  if (!user || user.isAnonymous) return false;

  await reload(user);

  if (!user.emailVerified) return false;

  const token = await user.getIdTokenResult(true);

  return user.emailVerified === true && token.claims.email_verified === true;
}

export async function registerInvitedUser({
  invitationId,
  email,
  password,
  confirmPassword,
  name,
}) {
  await authReady;

  const id = normalizeInvitationId(invitationId);
  const normalizedEmail = normalizeEmail(email);
  const normalizedName = normalizeName(name);

  if (!normalizedEmail || !normalizedName) {
    throw new Error('Uzupełnij imię i nazwisko oraz adres e-mail.');
  }

  if (normalizedName.split(' ').length < 2) {
    throw new Error('Podaj imię i nazwisko.');
  }

  if (password !== confirmPassword) {
    throw new Error('Podane hasła nie są identyczne.');
  }

  const passwordError = getPasswordError(password);

  if (passwordError) throw new Error(passwordError);

  if (auth.currentUser && !auth.currentUser.isAnonymous) {
    throw new Error(
      'Wyloguj się z obecnego konta przed aktywacją zaproszenia.'
    );
  }

  const invitation = await getInvitation(id);

  if (
    invitation.email &&
    normalizeEmail(invitation.email) !== normalizedEmail
  ) {
    throw createActivationError(
      'To starsze zaproszenie jest przypisane do innego adresu e-mail.',
      'activation/email-mismatch'
    );
  }

  const credential = await createUserWithEmailAndPassword(
    auth,
    normalizedEmail,
    password
  );

  const user = credential.user;

  try {
    await updateProfile(user, {
      displayName: normalizedName,
    });

    await sendEmailVerification(user);

    return {
      success: true,
      uid: user.uid,
      email: user.email,
      invitationId: id,
      verificationSent: true,
      profileActivated: false,
    };
  } finally {
    await signOut(auth).catch(() => {});
  }
}

export async function activateVerifiedUser(invitationId, password) {
  await authReady;

  const id = normalizeInvitationId(invitationId);
  const user = auth.currentUser;

  if (!user || user.isAnonymous) {
    throw new Error('Zaloguj się na konto utworzone z zaproszenia.');
  }

  if (!(await refreshEmailVerification(user))) {
    throw new Error('Adres e-mail nie jest jeszcze potwierdzony.');
  }

  if (password) {
    await reauthenticateWithCredential(
      user,
      EmailAuthProvider.credential(user.email, password)
    );

    await user.getIdToken(true);
  }

  const userRef = doc(db, 'users', user.uid);
  const invitationRef = doc(db, 'userInvitations', id);

  let result;

  try {
    result = await runTransaction(db, async (transaction) => {
      const [profileSnapshot, invitationSnapshot] = await Promise.all([
        transaction.get(userRef),
        transaction.get(invitationRef),
      ]);

      if (profileSnapshot.exists()) {
        const profile = {
          ...profileSnapshot.data(),
          uid: user.uid,
        };

        if (
          profile.invitationId === id &&
          profile.status === 'pending_approval'
        ) {
          return {
            success: true,
            pendingApproval: true,
            alreadyActive: false,
            uid: user.uid,
            invitationId: id,
          };
        }

        if (
          isActiveInvitedProfile(user, profile) &&
          profile.invitationId === id
        ) {
          return {
            success: true,
            alreadyActive: true,
            uid: user.uid,
            invitationId: id,
          };
        }

        throw createActivationError(
          'Dla tego konta istnieje już profil. Skontaktuj się z administratorem.',
          'activation/profile-exists'
        );
      }

      if (!invitationSnapshot.exists()) {
        throw createActivationError(
          'Zaproszenie nie istnieje lub zostało usunięte.',
          'activation/invitation-missing'
        );
      }

      const invitation = invitationSnapshot.data();
      const { used, max } = checkInvitation(invitation);

      if (
        invitation.email &&
        normalizeEmail(invitation.email) !== normalizeEmail(user.email)
      ) {
        throw createActivationError(
          'To starsze zaproszenie jest przypisane do innego adresu e-mail.',
          'activation/email-mismatch'
        );
      }

      const fullName = normalizeName(user.displayName);

      if (!fullName || fullName.split(' ').length < 2) {
        throw createActivationError(
          'Brakuje imienia i nazwiska na koncie. Skontaktuj się z administratorem.',
          'activation/name-missing'
        );
      }

      const nextUsed = used + 1;

      transaction.set(userRef, {
        uid: user.uid,
        email: normalizeEmail(user.email),
        name: fullName,
        firstName: fullName.split(' ')[0],
        lastName: fullName.split(' ').slice(1).join(' '),
        role: 'user',
        status: 'pending_approval',
        invitationId: id,
        permissions: createEmptyPermissions(),
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
      });

      transaction.update(invitationRef, {
        usedCount: nextUsed,
        status: max !== null && nextUsed >= max ? 'accepted' : 'pending',
        acceptedAt: serverTimestamp(),
        acceptedBy: user.uid,
      });

      return {
        success: true,
        pendingApproval: true,
        alreadyActive: false,
        uid: user.uid,
        invitationId: id,
      };
    });
  } catch (error) {
    if (isPermissionError(error)) {
      throw createActivationError(
        'Reguły Firestore nie zezwalają na atomową aktywację konta. Należy dostosować reguły users i userInvitations do zaproszeń wielokrotnego użytku.',
        'activation/batch-permission-denied'
      );
    }

    throw error;
  }

  return result;
}

export async function changeUserPassword({
  currentPassword,
  newPassword,
  confirmPassword,
}) {
  await authReady;

  const user = auth.currentUser;

  if (!user || user.isAnonymous || !user.email) {
    throw new Error('Musisz być zalogowany.');
  }

  if (newPassword !== confirmPassword) {
    throw new Error('Nowe hasła nie są identyczne.');
  }

  const passwordError = getPasswordError(newPassword);

  if (passwordError) throw new Error(passwordError);

  if (!currentPassword) {
    throw new Error('Podaj obecne hasło.');
  }

  const credential = EmailAuthProvider.credential(user.email, currentPassword);

  await reauthenticateWithCredential(user, credential);
  await updatePassword(user, newPassword);

  return { success: true };
}

export async function requestPasswordReset(email) {
  await authReady;

  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    throw new Error('Podaj adres e-mail.');
  }

  await sendPasswordResetEmail(auth, normalizedEmail);

  return {
    success: true,
    message:
      'Jeżeli konto istnieje, wiadomość resetująca hasło zostanie wysłana.',
  };
}

export async function getCurrentUserAccess() {
  await authReady;

  const user = auth.currentUser;

  if (!user || user.isAnonymous) return null;

  if (user.uid === ADMIN_UID) {
    return {
      uid: user.uid,
      email: user.email || '',
      name: user.displayName || 'Administrator',
      role: 'admin',
      isAdmin: true,
      status: 'active',
      permissions: createFullPermissions(),
    };
  }

  await reload(user);

  if (user.emailVerified) {
    await user.getIdToken(true);
  }

  const profile = await getUserProfile(user.uid);

  if (!isActiveInvitedProfile(user, profile)) {
    return null;
  }

  return {
    uid: user.uid,
    email: profile.email,
    name: profile.name,
    role: 'user',
    isAdmin: false,
    status: 'active',
    permissions: normalizePermissions(profile.permissions),
    invitationId: profile.invitationId,
  };
}

export async function hasModulePermission(moduleId, action = PERMISSIONS.VIEW) {
  const access = await getCurrentUserAccess();

  if (!access) return false;

  if (access.isAdmin) return true;

  if (moduleId === MODULES.SHOPPING && action === PERMISSIONS.CREATE) {
    return hasPermission(access.permissions, moduleId, PERMISSIONS.CREATE);
  }

  if (moduleId === MODULES.NOTIFICATIONS && action === PERMISSIONS.MARK_READ) {
    return hasPermission(access.permissions, moduleId, PERMISSIONS.VIEW_OWN);
  }

  if (
    !MANAGED_MODULES.includes(moduleId) ||
    !MODULE_PERMISSIONS[moduleId]?.includes(action)
  ) {
    return false;
  }

  return canAccessModule(access, moduleId, action);
}
