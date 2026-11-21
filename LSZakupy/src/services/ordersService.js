import { ADMIN_UIDS, PERMISSIONS } from '../config/roles';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { auth, db, signInAnonymouslyForOrder } from '../firebase/firebase';
import { ORDER_STATUS } from '../utils/constants';
import { sortByDateDesc } from '../utils/dateUtils';
import { addLog } from './logsService';

const ORDERS_COLLECTION = 'orders';
const USERS_COLLECTION = 'users';
const NOTIFICATIONS_COLLECTION = 'notifications';

const STATUS_PERMISSION_KEYS = [
  PERMISSIONS.CHANGE_STATUS,
  PERMISSIONS.CHANGE_ORDER_STATUS,
  PERMISSIONS.UPDATE_STATUS,
  PERMISSIONS.STATUS,
  'changeStatus',
  'change_status',
  'changeOrderStatus',
  'updateStatus',
].filter(Boolean);

const STATUS_LABELS = {
  [ORDER_STATUS.PENDING]: 'Oczekujące',
  [ORDER_STATUS.ACCEPTED]: 'Przyjęte',
  [ORDER_STATUS.COMPLETED]: 'Zrealizowane',
  [ORDER_STATUS.CANCELLED]: 'Anulowane',
};

function cleanText(value = '') {
  return String(value ?? '').trim();
}

function normalizeValue(value) {
  return cleanText(value).toLocaleLowerCase('pl');
}

function isAdmin(user) {
  return Boolean(user && ADMIN_UIDS.includes(user.uid));
}

function checkAdmin() {
  const user = auth.currentUser;

  if (!isAdmin(user)) {
    throw new Error('Brak uprawnień administratora');
  }

  return user;
}

function getSignedInUser() {
  const user = auth.currentUser;

  if (!user || user.isAnonymous) {
    throw new Error('Musisz zalogować się na konto pracownika');
  }

  return user;
}

function isActiveEmployee(profile) {
  if (!profile || typeof profile !== 'object') {
    return false;
  }

  const role = normalizeValue(profile.role);
  const status = normalizeValue(profile.status);

  const validRole = ['user', 'employee', 'pracownik'].includes(role);

  const activeStatus =
    ['active', 'aktywny'].includes(status) ||
    (status === '' && profile.isActive === true);

  return validRole && activeStatus;
}

function getEmployeeName(profile) {
  return (
    cleanText(profile?.name) ||
    cleanText(profile?.displayName) ||
    cleanText(profile?.email) ||
    'Pracownik'
  );
}

function validateOrder(data) {
  const requestedBy = cleanText(data?.requestedBy);
  const product = cleanText(data?.product);
  const unit = cleanText(data?.unit) || 'szt.';
  const quantity = Number(data?.quantity);

  if (!requestedBy || !product) {
    throw new Error('Brak wymaganych danych');
  }

  if (requestedBy.length > 100) {
    throw new Error('Nazwa zgłaszającego jest za długa');
  }

  if (product.length > 200) {
    throw new Error('Nazwa produktu jest za długa');
  }

  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 100000) {
    throw new Error('Nieprawidłowa ilość');
  }

  if (unit.length > 30) {
    throw new Error('Jednostka jest za długa');
  }

  return quantity;
}

async function safeLog(message, type) {
  try {
    await addLog(message, type);
  } catch (error) {
    console.error('Log error:', error);
  }
}

async function getCurrentEmployee() {
  const user = getSignedInUser();

  if (isAdmin(user)) {
    return {
      uid: user.uid,
      name:
        cleanText(user.displayName) || cleanText(user.email) || 'Administrator',
      admin: true,
      permissions: {},
    };
  }

  const snapshot = await getDoc(doc(db, USERS_COLLECTION, user.uid));

  if (!snapshot.exists()) {
    throw new Error('Nie znaleziono profilu pracownika');
  }

  const profile = snapshot.data();

  if (!isActiveEmployee(profile)) {
    throw new Error('Konto pracownika nie jest aktywne');
  }

  return {
    uid: user.uid,
    name: getEmployeeName(profile),
    admin: false,
    permissions: profile.permissions || {},
  };
}

function hasEmployeePermission(employee, moduleId, action) {
  if (employee.admin) {
    return true;
  }

  if (!action) {
    return false;
  }

  const permissions = employee.permissions || {};

  if (permissions[action] === true) {
    return true;
  }

  const modulePermissions = permissions[moduleId];

  if (Array.isArray(modulePermissions)) {
    return modulePermissions.includes(action);
  }

  if (modulePermissions && typeof modulePermissions === 'object') {
    return modulePermissions[action] === true;
  }

  return false;
}

function hasAnyPermission(employee, moduleId, actions) {
  return actions.some((action) =>
    hasEmployeePermission(employee, moduleId, action)
  );
}

function canAssign(employee) {
  return hasEmployeePermission(employee, 'shopping', PERMISSIONS.ASSIGN);
}

function canTakeOwn(employee) {
  return (
    hasEmployeePermission(employee, 'shopping', PERMISSIONS.TAKE_OWN) ||
    canAssign(employee)
  );
}

function canEditOrder(employee) {
  return hasEmployeePermission(employee, 'shopping', PERMISSIONS.EDIT);
}

function canChangeOrderStatus(employee) {
  return hasAnyPermission(employee, 'shopping', STATUS_PERMISSION_KEYS);
}

function canDeleteOrder(employee) {
  return (
    hasEmployeePermission(employee, 'shopping', PERMISSIONS.DELETE) ||
    hasEmployeePermission(employee, 'completed', PERMISSIONS.DELETE)
  );
}

function ensureOrderId(order) {
  if (!order?.id) {
    throw new Error('Nie znaleziono zamówienia');
  }

  return order.id;
}

function ensureAssignedAccess(employee, order, allowed, actionLabel) {
  if (employee.admin) {
    return;
  }

  if (order.assignedToUid !== employee.uid) {
    throw new Error(
      'Możesz wykonywać tę operację tylko na przypisanym sobie zamówieniu'
    );
  }

  if (!allowed) {
    throw new Error(`Nie masz uprawnień do ${actionLabel}`);
  }
}

function isClosedOrder(order) {
  return (
    order.status === ORDER_STATUS.COMPLETED ||
    order.status === ORDER_STATUS.CANCELLED
  );
}

function normalizeOrders(snapshot) {
  return sortByDateDesc(
    snapshot.docs.map((item) => ({
      id: item.id,
      ...item.data(),
    })),
    'createdAt'
  );
}

export async function createOrder(data) {
  const quantity = validateOrder(data);

  await signInAnonymouslyForOrder();

  const order = {
    requestedBy: cleanText(data.requestedBy),
    product: cleanText(data.product),
    quantity,
    unit: cleanText(data.unit) || 'szt.',
    status: ORDER_STATUS.PENDING,
    adminComment: '',
    notificationRead: false,
    notificationReadAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    acceptedAt: null,
    completedAt: null,
    cancelledAt: null,
    orderedAt: null,
  };

  const reference = await addDoc(collection(db, ORDERS_COLLECTION), order);

  await safeLog(
    `${order.requestedBy} dodał/a produkt: ${order.product}, ${order.quantity} ${order.unit}`,
    'created'
  );

  return reference.id;
}

export function listenToOrders(callback, onError) {
  return onSnapshot(
    collection(db, ORDERS_COLLECTION),
    (snapshot) => {
      callback(normalizeOrders(snapshot));
    },
    (error) => {
      console.error('Orders listener error:', error);

      if (typeof onError === 'function') {
        onError(error);
      }
    }
  );
}

export function listenToMyOrders(callback, onError) {
  const user = getSignedInUser();

  return listenToOrders((orders) => {
    callback(orders.filter((order) => order.assignedToUid === user.uid));
  }, onError);
}

export function listenToUnassignedOrders(callback, onError) {
  return listenToOrders((orders) => {
    callback(orders.filter((order) => !cleanText(order.assignedToUid)));
  }, onError);
}

export async function getAssignableEmployees() {
  const actor = await getCurrentEmployee();

  if (!canAssign(actor)) {
    throw new Error('Nie masz uprawnień do przypisywania zgłoszeń');
  }

  const snapshot = await getDocs(collection(db, USERS_COLLECTION));

  const employees = snapshot.docs
    .map((item) => ({
      ...item.data(),
      uid: item.id,
    }))
    .filter(isActiveEmployee)
    .map((employee) => ({
      uid: employee.uid,
      name: getEmployeeName(employee),
      email: cleanText(employee.email),
    }));

  if (
    actor.admin &&
    !employees.some((employee) => employee.uid === actor.uid)
  ) {
    employees.push({
      uid: actor.uid,
      name: actor.name,
      email: cleanText(auth.currentUser?.email),
    });
  }

  return employees.sort((a, b) => a.name.localeCompare(b.name, 'pl'));
}

export async function takeOrder(order) {
  const employee = await getCurrentEmployee();

  if (!canTakeOwn(employee)) {
    throw new Error('Nie masz uprawnień do przejmowania zgłoszeń');
  }

  const orderReference = doc(db, ORDERS_COLLECTION, ensureOrderId(order));

  let productName = cleanText(order.product);

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(orderReference);

    if (!snapshot.exists()) {
      throw new Error('Zgłoszenie już nie istnieje');
    }

    const current = snapshot.data();

    if (current.assignedToUid === employee.uid) {
      throw new Error('Jesteś już opiekunem tego zgłoszenia');
    }

    if (cleanText(current.assignedToUid)) {
      throw new Error(
        'Zgłoszenie ma już opiekuna. Użyj funkcji przypisywania.'
      );
    }

    if (isClosedOrder(current)) {
      throw new Error(
        'Nie można przejąć zakończonego lub anulowanego zgłoszenia'
      );
    }

    productName = cleanText(current.product);

    transaction.update(orderReference, {
      assignedToUid: employee.uid,
      assignedToName: employee.name,
      assignedAt: serverTimestamp(),
      assignedByUid: employee.uid,
      assignedByName: employee.name,
      updatedAt: serverTimestamp(),
    });
  });

  await safeLog(
    `${employee.name} przejął/przejęła zgłoszenie: ${productName}`,
    'assigned'
  );
}

export async function assignOrder(order, employeeUid) {
  const actor = await getCurrentEmployee();

  if (!canAssign(actor)) {
    throw new Error('Nie masz uprawnień do przypisywania zgłoszeń');
  }

  const orderId = ensureOrderId(order);
  const targetUid = cleanText(employeeUid);

  if (!targetUid) {
    throw new Error('Wybierz pracownika');
  }

  const orderReference = doc(db, ORDERS_COLLECTION, orderId);

  const employeeReference = doc(db, USERS_COLLECTION, targetUid);

  const notificationReference = doc(collection(db, NOTIFICATIONS_COLLECTION));

  let targetName = '';
  let productName = cleanText(order.product);

  await runTransaction(db, async (transaction) => {
    const orderSnapshot = await transaction.get(orderReference);

    const assigningToSelfAsAdmin = actor.admin && targetUid === actor.uid;

    let targetProfile = null;

    if (!assigningToSelfAsAdmin) {
      const employeeSnapshot = await transaction.get(employeeReference);

      targetProfile = employeeSnapshot.exists()
        ? employeeSnapshot.data()
        : null;
    }

    if (!orderSnapshot.exists()) {
      throw new Error('Zgłoszenie już nie istnieje');
    }

    if (!assigningToSelfAsAdmin && !isActiveEmployee(targetProfile)) {
      throw new Error('Wybrany pracownik nie ma aktywnego konta');
    }

    const currentOrder = orderSnapshot.data();

    if (currentOrder.assignedToUid === targetUid) {
      throw new Error('Zgłoszenie jest już przypisane do tej osoby');
    }

    if (isClosedOrder(currentOrder)) {
      throw new Error(
        'Nie można przypisać zakończonego lub anulowanego zgłoszenia'
      );
    }

    targetName = assigningToSelfAsAdmin
      ? actor.name
      : getEmployeeName(targetProfile);

    productName = cleanText(currentOrder.product);

    transaction.update(orderReference, {
      assignedToUid: targetUid,
      assignedToName: targetName,
      assignedAt: serverTimestamp(),
      assignedByUid: actor.uid,
      assignedByName: actor.name,
      updatedAt: serverTimestamp(),
    });

    if (targetUid !== actor.uid) {
      transaction.set(notificationReference, {
        recipientUid: targetUid,
        type: 'assignment',
        orderId,
        product: productName,
        title: 'Przypisano Ci zgłoszenie',
        message: `${actor.name} przypisał(a) Ci zgłoszenie: ${productName}`,
        createdByUid: actor.uid,
        createdByName: actor.name,
        read: false,
        readAt: null,
        createdAt: serverTimestamp(),
      });
    }
  });

  await safeLog(
    `${actor.name} przypisał(a) zgłoszenie ${productName} do ${targetName}`,
    'assigned'
  );
}

export async function transferOrder(order, employeeUid) {
  return assignOrder(order, employeeUid);
}

export async function updateOrder(orderId, data) {
  const employee = await getCurrentEmployee();
  const quantity = validateOrder(data);

  const orderReference = doc(db, ORDERS_COLLECTION, orderId);

  let productName = '';

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(orderReference);

    if (!snapshot.exists()) {
      throw new Error('Nie znaleziono zamówienia');
    }

    const current = snapshot.data();

    ensureAssignedAccess(
      employee,
      current,
      canEditOrder(employee),
      'edycji zgłoszenia'
    );

    if (isClosedOrder(current)) {
      throw new Error(
        'Nie można edytować zakończonego lub anulowanego zamówienia'
      );
    }

    productName = cleanText(data.product);

    const changes = {
      requestedBy: cleanText(data.requestedBy),
      product: productName,
      quantity,
      unit: cleanText(data.unit) || 'szt.',
      updatedAt: serverTimestamp(),
    };

    if (employee.admin) {
      changes.adminComment = cleanText(data.adminComment);
    }

    transaction.update(orderReference, changes);
  });

  await safeLog(
    `${employee.name} edytował(a) zamówienie: ${productName}`,
    'edited'
  );
}

export async function markNotificationAsRead(order) {
  const user = checkAdmin();
  const orderId = ensureOrderId(order);

  if (order.notificationRead) {
    return;
  }

  await updateDoc(doc(db, ORDERS_COLLECTION, orderId), {
    notificationRead: true,
    notificationReadAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await safeLog(
    `${
      cleanText(user.displayName) || 'Administrator'
    } oznaczył(a) powiadomienie jako przeczytane: ${order.product}`,
    'read'
  );
}

export async function markNotificationAsUnread(order) {
  const user = checkAdmin();
  const orderId = ensureOrderId(order);

  if (!order.notificationRead) {
    return;
  }

  await updateDoc(doc(db, ORDERS_COLLECTION, orderId), {
    notificationRead: false,
    notificationReadAt: null,
    updatedAt: serverTimestamp(),
  });

  await safeLog(
    `${
      cleanText(user.displayName) || 'Administrator'
    } oznaczył(a) powiadomienie jako nieprzeczytane: ${order.product}`,
    'unread'
  );
}

export async function changeOrderStatus(order, nextStatus, adminComment = '') {
  const employee = await getCurrentEmployee();

  const validStatuses = [
    ORDER_STATUS.PENDING,
    ORDER_STATUS.ACCEPTED,
    ORDER_STATUS.COMPLETED,
    ORDER_STATUS.CANCELLED,
  ];

  if (!validStatuses.includes(nextStatus)) {
    throw new Error('Nieprawidłowy status zamówienia');
  }

  const orderReference = doc(db, ORDERS_COLLECTION, ensureOrderId(order));

  let productName = cleanText(order.product);

  const changed = await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(orderReference);

    if (!snapshot.exists()) {
      throw new Error('Nie znaleziono zamówienia');
    }

    const current = snapshot.data();

    ensureAssignedAccess(
      employee,
      current,
      canChangeOrderStatus(employee),
      'zmiany statusu zamówienia'
    );

    if (current.status === nextStatus) {
      return false;
    }

    if (isClosedOrder(current)) {
      throw new Error(
        'Nie można zmienić statusu zakończonego lub anulowanego zamówienia'
      );
    }

    productName = cleanText(current.product);

    const changes = {
      status: nextStatus,
      updatedAt: serverTimestamp(),
      acceptedAt: null,
      completedAt: null,
      cancelledAt: null,
    };

    if (
      nextStatus === ORDER_STATUS.ACCEPTED ||
      nextStatus === ORDER_STATUS.COMPLETED
    ) {
      changes.acceptedAt = current.acceptedAt || serverTimestamp();
    }

    if (nextStatus === ORDER_STATUS.COMPLETED) {
      changes.completedAt = serverTimestamp();
    }

    if (nextStatus === ORDER_STATUS.CANCELLED) {
      changes.acceptedAt = current.acceptedAt || null;

      changes.cancelledAt = serverTimestamp();
    }

    if (nextStatus !== ORDER_STATUS.PENDING) {
      changes.notificationRead = true;
      changes.notificationReadAt =
        current.notificationReadAt || serverTimestamp();
    }

    if (employee.admin) {
      changes.adminComment = cleanText(adminComment);
    }

    transaction.update(orderReference, changes);

    return true;
  });

  if (!changed) {
    return;
  }

  const type =
    nextStatus === ORDER_STATUS.ACCEPTED
      ? 'accepted'
      : nextStatus === ORDER_STATUS.COMPLETED
      ? 'completed'
      : 'edited';

  await safeLog(
    `${employee.name} zmienił(a) status zamówienia ${productName} na: ${STATUS_LABELS[nextStatus]}`,
    type
  );
}

export async function markOrderAsAccepted(order, adminComment = '') {
  return changeOrderStatus(order, ORDER_STATUS.ACCEPTED, adminComment);
}

export async function markOrderAsCompleted(order, adminComment = '') {
  return changeOrderStatus(order, ORDER_STATUS.COMPLETED, adminComment);
}

export async function deleteOrder(order) {
  const employee = await getCurrentEmployee();

  const orderReference = doc(db, ORDERS_COLLECTION, ensureOrderId(order));

  let productName = cleanText(order.product);

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(orderReference);

    if (!snapshot.exists()) {
      throw new Error('Nie znaleziono zamówienia');
    }

    const current = snapshot.data();

    ensureAssignedAccess(
      employee,
      current,
      canDeleteOrder(employee),
      'usuwania zamówienia'
    );

    productName = cleanText(current.product);

    transaction.delete(orderReference);
  });

  await safeLog(
    `${employee.name} usunął(a) zamówienie: ${productName}`,
    'deleted'
  );
}
