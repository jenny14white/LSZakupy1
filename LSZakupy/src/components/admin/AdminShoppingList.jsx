import { useEffect, useMemo, useState } from 'react';
import { auth } from '../../firebase/firebase';
import { ADMIN_UIDS, PERMISSIONS } from '../../config/roles';
import {
  assignOrder,
  getAssignableEmployees,
  takeOrder,
} from '../../services/ordersService';
import EmptyState from '../shared/EmptyState';
import SharedDropdown from '../shared/SharedDropdown';
import AdminOrderCard from './AdminOrderCard';
import { ORDER_STATUS } from '../../utils/constants';
import '../../styles/admin-shopping.css';

const TABS = {
  ALL: 'all',
  MINE: 'mine',
  UNASSIGNED: 'unassigned',
};

const STATUS_FILTERS = {
  ALL: 'all',
  PENDING: ORDER_STATUS.PENDING,
  ACCEPTED: ORDER_STATUS.ACCEPTED,
  COMPLETED: ORDER_STATUS.COMPLETED,
  CANCELLED: ORDER_STATUS.CANCELLED || 'cancelled',
};

const STATUS_ITEMS = [
  {
    key: STATUS_FILTERS.PENDING,
    label: 'Oczekujące',
    shortLabel: 'Oczekujące',
    icon: '🟡',
    className: 'pending',
  },
  {
    key: STATUS_FILTERS.ACCEPTED,
    label: 'Przyjęte do realizacji',
    shortLabel: 'Przyjęte',
    icon: '🟢',
    className: 'accepted',
  },
  {
    key: STATUS_FILTERS.COMPLETED,
    label: 'Zrealizowane',
    shortLabel: 'Zrealizowane',
    icon: '🟣',
    className: 'completed',
  },
  {
    key: STATUS_FILTERS.CANCELLED,
    label: 'Anulowane',
    shortLabel: 'Anulowane',
    icon: '🔴',
    className: 'cancelled',
  },
];

function hasAction(permissions, action) {
  if (!action) {
    return false;
  }

  if (permissions?.[action] === true) {
    return true;
  }

  const shopping = permissions?.shopping;

  if (Array.isArray(shopping)) {
    return shopping.includes(action);
  }

  if (shopping && typeof shopping === 'object') {
    return shopping[action] === true;
  }

  return false;
}

function normalizeStatus(status) {
  const value = String(status || '')
    .trim()
    .toLowerCase();

  if (value === 'canceled') {
    return STATUS_FILTERS.CANCELLED;
  }

  return value;
}

function isClosedOrder(order) {
  const status = normalizeStatus(order?.status);

  return (
    status === STATUS_FILTERS.COMPLETED || status === STATUS_FILTERS.CANCELLED
  );
}

export default function AdminShoppingList({ orders = [], permissions = {} }) {
  const [activeTab, setActiveTab] = useState(TABS.ALL);
  const [statusFilter, setStatusFilter] = useState(STATUS_FILTERS.ALL);
  const [employees, setEmployees] = useState([]);
  const [employeeError, setEmployeeError] = useState('');
  const [busyOrderId, setBusyOrderId] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const currentUid = auth.currentUser?.uid || '';
  const admin = ADMIN_UIDS.includes(currentUid);

  const canAssign = admin || hasAction(permissions, PERMISSIONS.ASSIGN);

  const canTakeOwn =
    admin || canAssign || hasAction(permissions, PERMISSIONS.TAKE_OWN);

  useEffect(() => {
    if (!canAssign) {
      setEmployees([]);
      setEmployeeError('');
      return undefined;
    }

    let active = true;

    async function loadEmployees() {
      try {
        const result = await getAssignableEmployees();

        if (active) {
          setEmployees(Array.isArray(result) ? result : []);
          setEmployeeError('');
        }
      } catch (error) {
        console.error('Employee loading error:', error);

        if (active) {
          setEmployees([]);
          setEmployeeError('Nie udało się pobrać listy pracowników.');
        }
      }
    }

    loadEmployees();

    return () => {
      active = false;
    };
  }, [canAssign, currentUid]);

  const allOrders = useMemo(() => {
    if (!Array.isArray(orders)) {
      return [];
    }

    return orders
      .filter((order) => order && order.id)
      .map((order) => ({
        ...order,
        status: normalizeStatus(order.status),
      }));
  }, [orders]);

  const counts = useMemo(() => {
    return {
      all: allOrders.length,
      pending: allOrders.filter(
        (order) => order.status === STATUS_FILTERS.PENDING
      ).length,
      accepted: allOrders.filter(
        (order) => order.status === STATUS_FILTERS.ACCEPTED
      ).length,
      completed: allOrders.filter(
        (order) => order.status === STATUS_FILTERS.COMPLETED
      ).length,
      cancelled: allOrders.filter(
        (order) => order.status === STATUS_FILTERS.CANCELLED
      ).length,
    };
  }, [allOrders]);

  const myOrdersCount = useMemo(() => {
    return allOrders.filter(
      (order) => currentUid && order.assignedToUid === currentUid
    ).length;
  }, [allOrders, currentUid]);

  const unassignedCount = useMemo(() => {
    return allOrders.filter((order) => !order.assignedToUid).length;
  }, [allOrders]);

  const tabOrders = useMemo(() => {
    if (activeTab === TABS.MINE) {
      return allOrders.filter(
        (order) => currentUid && order.assignedToUid === currentUid
      );
    }

    if (activeTab === TABS.UNASSIGNED) {
      return allOrders.filter((order) => !order.assignedToUid);
    }

    return allOrders;
  }, [allOrders, activeTab, currentUid]);

  const ordersByStatus = useMemo(() => {
    return {
      [STATUS_FILTERS.PENDING]: tabOrders.filter(
        (order) => order.status === STATUS_FILTERS.PENDING
      ),
      [STATUS_FILTERS.ACCEPTED]: tabOrders.filter(
        (order) => order.status === STATUS_FILTERS.ACCEPTED
      ),
      [STATUS_FILTERS.COMPLETED]: tabOrders.filter(
        (order) => order.status === STATUS_FILTERS.COMPLETED
      ),
      [STATUS_FILTERS.CANCELLED]: tabOrders.filter(
        (order) => order.status === STATUS_FILTERS.CANCELLED
      ),
    };
  }, [tabOrders]);

  const employeeOptions = useMemo(() => {
    const uniqueEmployees = new Map();

    employees.forEach((employee) => {
      if (!employee?.uid) {
        return;
      }

      uniqueEmployees.set(employee.uid, {
        value: employee.uid,
        label:
          employee.name ||
          employee.displayName ||
          employee.email ||
          'Pracownik',
      });
    });

    if (admin && currentUid) {
      uniqueEmployees.set(currentUid, {
        value: currentUid,
        label: 'Administrator (ja)',
      });
    }

    return Array.from(uniqueEmployees.values()).sort((a, b) =>
      a.label.localeCompare(b.label, 'pl')
    );
  }, [employees, admin, currentUid]);

  function showSuccess(message) {
    setFeedback({
      type: 'success',
      message,
    });
  }

  function showError(error) {
    setFeedback({
      type: 'error',
      message: error?.message || 'Nie udało się wykonać operacji.',
    });
  }

  function handleStatClick(status) {
    setActiveTab(TABS.ALL);
    setStatusFilter(status);
    setFeedback(null);
  }

  async function handleTakeOrder(order) {
    if (
      !canTakeOwn ||
      busyOrderId !== null ||
      !order?.id ||
      !currentUid ||
      order.assignedToUid ||
      isClosedOrder(order)
    ) {
      return;
    }

    setBusyOrderId(order.id);
    setFeedback(null);

    try {
      await takeOrder(order);

      showSuccess(`Przejęto zgłoszenie: ${order.product}`);
    } catch (error) {
      console.error('Take order error:', error);
      showError(error);
    } finally {
      setBusyOrderId(null);
    }
  }

  async function handleAssignOrder(order, employeeUid) {
    if (
      !canAssign ||
      busyOrderId !== null ||
      !order?.id ||
      !employeeUid ||
      employeeUid === order.assignedToUid ||
      isClosedOrder(order)
    ) {
      return;
    }

    const employeeExists = employeeOptions.some(
      (employee) => employee.value === employeeUid
    );

    if (!employeeExists) {
      showError(new Error('Wybrany pracownik nie jest dostępny.'));
      return;
    }

    setBusyOrderId(order.id);
    setFeedback(null);

    try {
      await assignOrder(order, employeeUid);

      showSuccess(
        `Zgłoszenie ${order.product} zostało ${
          order.assignedToUid ? 'przekazane' : 'przypisane'
        }.`
      );
    } catch (error) {
      console.error('Assign order error:', error);
      showError(error);
    } finally {
      setBusyOrderId(null);
    }
  }

  function renderAssignmentActions(order) {
    const isAssigned = Boolean(order.assignedToUid);
    const isBusy = busyOrderId === order.id;
    const anyBusy = busyOrderId !== null;

    if (isClosedOrder(order) || (!canTakeOwn && !canAssign)) {
      return null;
    }

    const availableEmployees = employeeOptions.filter(
      (employee) => employee.value !== order.assignedToUid
    );

    return (
      <div className="shopping-assignment-inline">
        <div className="shopping-assignment-actions">
          {!isAssigned && canTakeOwn && (
            <button
              type="button"
              className="shopping-action-button"
              disabled={anyBusy}
              onClick={() => handleTakeOrder(order)}
            >
              {isBusy ? 'Przejmowanie...' : '🙋 Przejmij zgłoszenie'}
            </button>
          )}

          {canAssign && (
            <div
              className={`shopping-assign-select ${isBusy ? 'is-busy' : ''}`}
              aria-busy={isBusy}
            >
              <SharedDropdown
                label={
                  isAssigned ? 'Przekaż zgłoszenie' : 'Przypisz pracownikowi'
                }
                icon="👥"
                value=""
                options={availableEmployees}
                onChange={(employeeUid) =>
                  handleAssignOrder(order, employeeUid)
                }
                disabled={anyBusy || availableEmployees.length === 0}
                loading={isBusy}
                searchable
                searchPlaceholder="Wyszukaj pracownika..."
                emptyMessage="Brak dostępnych pracowników"
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderSection(title, icon, items, emptyMessage) {
    return (
      <section className="admin-section" key={title}>
        <div className="section-header">
          <h3>
            <span aria-hidden="true">{icon}</span>

            <span>{title}</span>

            <span className="section-count">({items.length})</span>
          </h3>
        </div>

        {items.length === 0 ? (
          <EmptyState>{emptyMessage}</EmptyState>
        ) : (
          <div className="admin-orders">
            {items.map((order) => (
              <AdminOrderCard
                key={order.id}
                order={order}
                permissions={permissions}
                assignmentActions={renderAssignmentActions(order)}
              />
            ))}
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="admin-shopping-list">
      <div
        className="shopping-status-overview"
        aria-label="Statystyki zamówień"
      >
        <button
          type="button"
          className={`shopping-stat-card shopping-stat-all ${
            statusFilter === STATUS_FILTERS.ALL ? 'is-active' : ''
          }`}
          onClick={() => handleStatClick(STATUS_FILTERS.ALL)}
        >
          <span className="shopping-stat-icon">📋</span>

          <strong className="shopping-stat-number">{counts.all}</strong>

          <span className="shopping-stat-label">Wszystkie zgłoszenia</span>
        </button>

        {STATUS_ITEMS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`shopping-stat-card shopping-stat-${item.className} ${
              statusFilter === item.key ? 'is-active' : ''
            }`}
            onClick={() => handleStatClick(item.key)}
          >
            <span className="shopping-stat-icon">{item.icon}</span>

            <strong className="shopping-stat-number">{counts[item.key]}</strong>

            <span className="shopping-stat-label">{item.label}</span>
          </button>
        ))}
      </div>

      <div className="shopping-tabs" role="tablist" aria-label="Filtr zamówień">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === TABS.ALL}
          className={`shopping-tab ${activeTab === TABS.ALL ? 'active' : ''}`}
          onClick={() => setActiveTab(TABS.ALL)}
        >
          Wszystkie ({allOrders.length})
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === TABS.MINE}
          className={`shopping-tab ${activeTab === TABS.MINE ? 'active' : ''}`}
          onClick={() => setActiveTab(TABS.MINE)}
        >
          👤 Moje zamówienia ({myOrdersCount})
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === TABS.UNASSIGNED}
          className={`shopping-tab ${
            activeTab === TABS.UNASSIGNED ? 'active' : ''
          }`}
          onClick={() => setActiveTab(TABS.UNASSIGNED)}
        >
          Nieprzypisane ({unassignedCount})
        </button>
      </div>

      <div
        className="shopping-tabs"
        role="group"
        aria-label="Filtr statusów zamówień"
      >
        <button
          type="button"
          aria-pressed={statusFilter === STATUS_FILTERS.ALL}
          className={`shopping-tab ${
            statusFilter === STATUS_FILTERS.ALL ? 'active' : ''
          }`}
          onClick={() => setStatusFilter(STATUS_FILTERS.ALL)}
        >
          Wszystkie statusy ({tabOrders.length})
        </button>

        {STATUS_ITEMS.map((item) => (
          <button
            key={item.key}
            type="button"
            aria-pressed={statusFilter === item.key}
            className={`shopping-tab ${
              statusFilter === item.key ? 'active' : ''
            }`}
            onClick={() => setStatusFilter(item.key)}
          >
            {item.icon} {item.shortLabel} ({ordersByStatus[item.key].length})
          </button>
        ))}
      </div>

      {feedback && (
        <div
          className={`shopping-feedback ${feedback.type}`}
          role={feedback.type === 'error' ? 'alert' : 'status'}
        >
          <span>{feedback.message}</span>

          <button
            type="button"
            className="shopping-feedback-close"
            aria-label="Zamknij komunikat"
            onClick={() => setFeedback(null)}
          >
            ×
          </button>
        </div>
      )}

      {employeeError && (
        <div className="shopping-feedback error" role="alert">
          {employeeError}
        </div>
      )}

      {STATUS_ITEMS.filter(
        (item) =>
          statusFilter === STATUS_FILTERS.ALL || statusFilter === item.key
      ).map((item) =>
        renderSection(
          item.label,
          item.icon,
          ordersByStatus[item.key],
          activeTab === TABS.MINE
            ? `Nie masz zamówień w kategorii: ${item.label.toLowerCase()}.`
            : `Brak zamówień w kategorii: ${item.label.toLowerCase()}.`
        )
      )}
    </section>
  );
}
