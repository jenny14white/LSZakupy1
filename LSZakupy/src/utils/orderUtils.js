import { ORDER_STATUS } from './constants';
import { getDateObject, getMonthYear, sortByDateDesc } from './dateUtils';

export function getPendingOrders(orders = []) {
  if (!Array.isArray(orders)) {
    return [];
  }

  return orders.filter(
    (order) =>
      order &&
      (order.status === ORDER_STATUS.PENDING ||
        order.status === ORDER_STATUS.ACCEPTED ||
        order.status === ORDER_STATUS.ORDERED)
  );
}

export function getCompletedOrders(orders = []) {
  if (!Array.isArray(orders)) {
    return [];
  }

  return orders.filter((order) => order?.status === ORDER_STATUS.COMPLETED);
}

function groupOrdersByMonth(orders = [], dateField = 'completedAt') {
  if (!Array.isArray(orders)) {
    return [];
  }

  const groups = new Map();

  orders.forEach((order) => {
    if (!order) {
      return;
    }

    const date = getDateObject(order[dateField]);

    if (!date) {
      return;
    }

    const month = getMonthYear(date);

    if (!groups.has(month)) {
      groups.set(month, []);
    }

    groups.get(month).push(order);
  });

  return Array.from(groups.entries())
    .map(([month, items]) => ({
      month,
      items: sortByDateDesc(items, dateField),
    }))
    .sort((a, b) => {
      const dateA = getDateObject(a.items[0]?.[dateField])?.getTime() ?? 0;

      const dateB = getDateObject(b.items[0]?.[dateField])?.getTime() ?? 0;

      return dateB - dateA;
    });
}

export function groupOrdersByCompletedMonth(orders = []) {
  return groupOrdersByMonth(orders, 'completedAt');
}

export function groupOrdersByOrderedMonth(orders = []) {
  return groupOrdersByMonth(orders, 'orderedAt');
}
