export const ADMIN_UID = 'kRulgEcxNed8aYacTWq3j9GgP4J2';

export const ADMIN_UIDS = [ADMIN_UID];

export const isAdminUid = (uid) => Boolean(uid && ADMIN_UIDS.includes(uid));

export const isSuperAdminUid = (uid) => Boolean(uid && uid === ADMIN_UID);

export const USER_ROLES = Object.freeze({
  ADMIN: 'admin',
  USER: 'user',
});

export const ROLE_LABELS = Object.freeze({
  [USER_ROLES.ADMIN]: 'Administrator',
  [USER_ROLES.USER]: 'Użytkownik',
});

export const MODULES = Object.freeze({
  SHOPPING: 'shopping',
  NOTIFICATIONS: 'notifications',
  COMPLETED: 'completed',
  CALENDAR: 'calendar',
  LOGS: 'logs',
  USERS: 'users',
});

export const MODULE_LABELS = Object.freeze({
  [MODULES.SHOPPING]: 'Lista zakupów',
  [MODULES.NOTIFICATIONS]: 'Powiadomienia',
  [MODULES.COMPLETED]: 'Zrealizowane',
  [MODULES.CALENDAR]: 'Kalendarz',
  [MODULES.LOGS]: 'Dziennik zdarzeń',
  [MODULES.USERS]: 'Użytkownicy',
});

export const PERMISSIONS = Object.freeze({
  VIEW: 'view',
  CREATE: 'create',
  EDIT: 'edit',
  DELETE: 'delete',
  ASSIGN: 'assign',
  TAKE_OWN: 'takeOwn',
  ACCEPT: 'accept',
  CHANGE_STATUS: 'changeStatus',
  VIEW_OWN: 'viewOwn',
  RECEIVE_ASSIGNED: 'receiveAssigned',
  MARK_READ: 'markRead',
  VIEW_DETAILS: 'viewDetails',
  EDIT_OWN: 'editOwn',
  DELETE_OWN: 'deleteOwn',
});

export const MODULE_PERMISSIONS = Object.freeze({
  [MODULES.SHOPPING]: [
    PERMISSIONS.VIEW,
    PERMISSIONS.TAKE_OWN,
    PERMISSIONS.ASSIGN,
    PERMISSIONS.EDIT,
    PERMISSIONS.DELETE,
    PERMISSIONS.CHANGE_STATUS,
  ],

  [MODULES.NOTIFICATIONS]: [PERMISSIONS.VIEW_OWN],

  [MODULES.COMPLETED]: [
    PERMISSIONS.VIEW,
    PERMISSIONS.VIEW_DETAILS,
    PERMISSIONS.CHANGE_STATUS,
    PERMISSIONS.DELETE,
  ],

  [MODULES.CALENDAR]: [
    PERMISSIONS.VIEW,
    PERMISSIONS.CREATE,
    PERMISSIONS.EDIT_OWN,
    PERMISSIONS.DELETE_OWN,
    PERMISSIONS.DELETE,
  ],

  [MODULES.LOGS]: [PERMISSIONS.VIEW],
});

export const PERMISSION_LABELS = Object.freeze({
  [PERMISSIONS.VIEW]: 'Podgląd',
  [PERMISSIONS.CREATE]: 'Dodawanie',
  [PERMISSIONS.EDIT]: 'Edycja zgłoszeń',
  [PERMISSIONS.DELETE]: 'Usuwanie',
  [PERMISSIONS.TAKE_OWN]: 'Przejmowanie zgłoszeń',
  [PERMISSIONS.ASSIGN]: 'Przypisywanie i przekazywanie zgłoszeń',
  [PERMISSIONS.ACCEPT]: 'Zmiana statusu zamówień',
  [PERMISSIONS.CHANGE_STATUS]: 'Zmiana statusu zamówień',
  [PERMISSIONS.VIEW_OWN]: 'Podgląd własnych powiadomień',
  [PERMISSIONS.RECEIVE_ASSIGNED]: 'Podgląd własnych powiadomień',
  [PERMISSIONS.MARK_READ]: 'Podgląd własnych powiadomień',
  [PERMISSIONS.VIEW_DETAILS]: 'Podgląd szczegółów',
  [PERMISSIONS.EDIT_OWN]: 'Edycja własnych wydarzeń',
  [PERMISSIONS.DELETE_OWN]: 'Usuwanie własnych wydarzeń',
});

export const ALL_PERMISSIONS = [
  ...new Set(Object.values(MODULE_PERMISSIONS).flat()),
];

export const MANAGED_MODULES = [
  MODULES.SHOPPING,
  MODULES.NOTIFICATIONS,
  MODULES.COMPLETED,
  MODULES.CALENDAR,
  MODULES.LOGS,
];

export const ORDER_STATUSES = Object.freeze({
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
});

export const ORDER_STATUS_LABELS = Object.freeze({
  [ORDER_STATUSES.PENDING]: 'Oczekujące',
  [ORDER_STATUSES.ACCEPTED]: 'Przyjęte do realizacji',
  [ORDER_STATUSES.COMPLETED]: 'Zrealizowane',
  [ORDER_STATUSES.CANCELLED]: 'Anulowane',
});

export function getModulePermissions(moduleId) {
  return MODULE_PERMISSIONS[moduleId] || [];
}

export function createEmptyPermissions() {
  return Object.fromEntries(MANAGED_MODULES.map((moduleId) => [moduleId, []]));
}

export function createFullPermissions() {
  return Object.fromEntries(
    MANAGED_MODULES.map((moduleId) => [
      moduleId,
      [...getModulePermissions(moduleId)],
    ])
  );
}

export function createDefaultPermissions() {
  return createEmptyPermissions();
}

export function normalizePermissions(permissions = {}) {
  const source =
    permissions &&
    typeof permissions === 'object' &&
    !Array.isArray(permissions)
      ? permissions
      : {};

  return Object.fromEntries(
    MANAGED_MODULES.map((moduleId) => {
      const selected = Array.isArray(source[moduleId]) ? source[moduleId] : [];

      const allowed = getModulePermissions(moduleId);

      const normalized = allowed.filter((permission) =>
        selected.includes(permission)
      );

      if (
        moduleId === MODULES.NOTIFICATIONS &&
        !normalized.includes(PERMISSIONS.VIEW_OWN) &&
        (selected.includes(PERMISSIONS.MARK_READ) ||
          selected.includes(PERMISSIONS.RECEIVE_ASSIGNED))
      ) {
        normalized.push(PERMISSIONS.VIEW_OWN);
      }

      if (
        moduleId === MODULES.SHOPPING &&
        selected.includes(PERMISSIONS.ACCEPT) &&
        !normalized.includes(PERMISSIONS.CHANGE_STATUS)
      ) {
        normalized.push(PERMISSIONS.CHANGE_STATUS);
      }

      return [moduleId, normalized];
    })
  );
}

export function hasPermission(
  permissions,
  moduleId,
  action = PERMISSIONS.VIEW
) {
  if (moduleId === MODULES.USERS || !MANAGED_MODULES.includes(moduleId)) {
    return false;
  }

  if (moduleId === MODULES.SHOPPING && action === PERMISSIONS.CREATE) {
    return true;
  }

  const normalized = normalizePermissions(permissions);

  if (moduleId === MODULES.SHOPPING && action === PERMISSIONS.ACCEPT) {
    return normalized[moduleId].includes(PERMISSIONS.CHANGE_STATUS);
  }

  if (
    moduleId === MODULES.NOTIFICATIONS &&
    (action === PERMISSIONS.MARK_READ ||
      action === PERMISSIONS.RECEIVE_ASSIGNED)
  ) {
    return normalized[moduleId].includes(PERMISSIONS.VIEW_OWN);
  }

  const allowed = getModulePermissions(moduleId);

  if (!allowed.includes(action)) {
    return false;
  }

  return normalized[moduleId].includes(action);
}

export function hasFullAccess(permissions, moduleId) {
  const allowed = getModulePermissions(moduleId);

  if (allowed.length === 0) {
    return false;
  }

  return allowed.every((action) =>
    hasPermission(permissions, moduleId, action)
  );
}

export function canAccessModule(user, moduleId, action = PERMISSIONS.VIEW) {
  if (!user || !user.uid) {
    return false;
  }

  if (isAdminUid(user.uid)) {
    return true;
  }

  if (
    moduleId === MODULES.USERS ||
    user.status !== 'active' ||
    user.role !== USER_ROLES.USER
  ) {
    return false;
  }

  if (moduleId === MODULES.SHOPPING && action === PERMISSIONS.CREATE) {
    return true;
  }

  if (moduleId === MODULES.SHOPPING && action === PERMISSIONS.TAKE_OWN) {
    return (
      hasPermission(user.permissions, moduleId, PERMISSIONS.TAKE_OWN) ||
      hasPermission(user.permissions, moduleId, PERMISSIONS.ASSIGN)
    );
  }

  return hasPermission(user.permissions, moduleId, action);
}

export function canAccessAnyModuleAction(user, moduleId) {
  if (!user) {
    return false;
  }

  if (isAdminUid(user.uid)) {
    return true;
  }

  if (moduleId === MODULES.USERS) {
    return false;
  }

  return getModulePermissions(moduleId).some((action) =>
    canAccessModule(user, moduleId, action)
  );
}

export function getAccessibleModules(user) {
  if (!user) {
    return [];
  }

  return Object.values(MODULES).filter((moduleId) =>
    canAccessAnyModuleAction(user, moduleId)
  );
}
