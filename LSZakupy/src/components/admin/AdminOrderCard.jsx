import { useEffect, useState } from 'react';
import { auth } from '../../firebase/firebase';
import { ADMIN_UIDS, PERMISSIONS } from '../../config/roles';
import { changeOrderStatus, deleteOrder } from '../../services/ordersService';
import { ORDER_STATUS } from '../../utils/constants';
import { formatDate } from '../../utils/dateUtils';
import AdminOrderEditForm from './AdminOrderEditForm';
import ConfirmDialog from '../shared/ConfirmDialog';
import SharedDropdown from '../shared/SharedDropdown';
import '../../styles/admin-shopping.css';

const CANCELLED_STATUS = ORDER_STATUS.CANCELLED || 'cancelled';

const STATUS_OPTIONS = [
  {
    value: ORDER_STATUS.PENDING,
    label: '🟡 Oczekujące',
  },
  {
    value: ORDER_STATUS.ACCEPTED,
    label: '🟢 Przyjęte',
  },
  {
    value: ORDER_STATUS.COMPLETED,
    label: '🟣 Zrealizowane',
  },
  {
    value: CANCELLED_STATUS,
    label: '🔴 Anulowane',
  },
];

function hasModulePermission(permissions, moduleId, action) {
  if (!action) {
    return false;
  }

  if (permissions?.[action] === true) {
    return true;
  }

  const modulePermissions = permissions?.[moduleId];

  if (Array.isArray(modulePermissions)) {
    return modulePermissions.includes(action);
  }

  if (modulePermissions && typeof modulePermissions === 'object') {
    return modulePermissions[action] === true;
  }

  return false;
}

function getStatusPermission(permissions) {
  return hasModulePermission(
    permissions,
    'shopping',
    PERMISSIONS.CHANGE_STATUS
  );
}

function getOrderStatus(order) {
  if (order.status === ORDER_STATUS.PENDING) {
    return {
      className: 'pending',
      label: 'Oczekujące',
    };
  }

  if (order.status === ORDER_STATUS.ACCEPTED) {
    return {
      className: 'progress',
      label: 'Przyjęte',
    };
  }

  if (order.status === ORDER_STATUS.COMPLETED) {
    return {
      className: 'done',
      label: 'Zrealizowane',
    };
  }

  if (order.status === CANCELLED_STATUS) {
    return {
      className: 'cancelled',
      label: 'Anulowane',
    };
  }

  return {
    className: '',
    label: 'Nieznany status',
  };
}

export default function AdminOrderCard({
  order,
  selected = false,
  onSelect,
  canOrder = true,
  expanded = false,
  onToggle,
  permissions = {},
  assignmentActions = null,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [internalExpanded, setInternalExpanded] = useState(false);
  const [error, setError] = useState('');

  const currentUid = auth.currentUser?.uid || '';
  const isAdmin = ADMIN_UIDS.includes(currentUid);

  const isMyOrder = Boolean(currentUid && order?.assignedToUid === currentUid);

  const hasEditPermission = hasModulePermission(
    permissions,
    'shopping',
    PERMISSIONS.EDIT
  );

  const hasStatusPermission = getStatusPermission(permissions);

  const hasDeletePermission =
    hasModulePermission(permissions, 'shopping', PERMISSIONS.DELETE) ||
    hasModulePermission(permissions, 'completed', PERMISSIONS.DELETE);

  const canEdit = isAdmin || (isMyOrder && hasEditPermission);

  const canChangeStatus = isAdmin || (isMyOrder && hasStatusPermission);

  const canDelete = isAdmin || (isMyOrder && hasDeletePermission);

  const hasAssignedOwner = Boolean(order?.assignedToUid);

  const assignedOwnerName = hasAssignedOwner
    ? isMyOrder
      ? 'Ty'
      : order?.assignedToName || 'Pracownik'
    : 'Nieprzypisane';

  useEffect(() => {
    setError('');
  }, [order?.id, order?.adminComment, order?.status]);

  useEffect(() => {
    setInternalExpanded(false);
    setShowDeleteDialog(false);
    setDeleteError('');
    setIsEditing(false);
  }, [order?.id]);

  if (!order) {
    return null;
  }

  const isPending = order.status === ORDER_STATUS.PENDING;

  const isAccepted = order.status === ORDER_STATUS.ACCEPTED;

  const isCompleted = order.status === ORDER_STATUS.COMPLETED;

  const isCancelled = order.status === CANCELLED_STATUS;

  const isClosed = isCompleted || isCancelled;

  const status = getOrderStatus(order);

  const isExpanded =
    typeof onToggle === 'function' ? expanded : internalExpanded;

  function handleToggle(event) {
    event?.stopPropagation();

    if (typeof onToggle === 'function') {
      onToggle(order.id);
    } else {
      setInternalExpanded((previous) => !previous);
    }
  }

  function openDeleteDialog() {
    if (loading) {
      return;
    }

    if (!canDelete) {
      setError('Nie masz uprawnień do usunięcia tego zamówienia.');
      return;
    }

    setError('');
    setDeleteError('');
    setShowDeleteDialog(true);
  }

  function closeDeleteDialog() {
    if (loading) {
      return;
    }

    setShowDeleteDialog(false);
    setDeleteError('');
  }

  function openEditForm() {
    if (loading) {
      return;
    }

    if (!canEdit) {
      setError('Nie masz uprawnień do edycji tego zamówienia.');
      return;
    }

    if (isClosed) {
      setError('Nie można edytować zakończonego lub anulowanego zamówienia.');
      return;
    }

    setError('');
    setIsEditing(true);
  }

  async function handleStatusChange(newStatus) {
    if (loading || newStatus === order.status) {
      return;
    }

    if (!canChangeStatus) {
      setError('Nie masz uprawnień do zmiany statusu tego zamówienia.');
      return;
    }

    if (isClosed) {
      setError(
        'Nie można zmienić statusu zakończonego lub anulowanego zamówienia.'
      );
      return;
    }

    if (!STATUS_OPTIONS.some((option) => option.value === newStatus)) {
      setError('Wybrano nieprawidłowy status zamówienia.');
      return;
    }

    try {
      setLoading(true);
      setError('');

      await changeOrderStatus(order, newStatus, order.adminComment || '');
    } catch (caught) {
      console.error('Order status update error:', caught);

      setError(caught?.message || 'Nie udało się zmienić statusu zamówienia.');
    } finally {
      setLoading(false);
    }
  }

  async function confirmDelete() {
    if (loading) {
      return;
    }

    if (!canDelete) {
      setDeleteError('Nie masz uprawnień do usunięcia tego zamówienia.');
      return;
    }

    try {
      setLoading(true);
      setDeleteError('');

      await deleteOrder(order);

      setShowDeleteDialog(false);
    } catch (caught) {
      console.error('Order delete error:', caught);

      setDeleteError(caught?.message || 'Nie udało się usunąć zamówienia.');
    } finally {
      setLoading(false);
    }
  }

  const deleteDialog = (
    <ConfirmDialog
      open={showDeleteDialog}
      variant="danger"
      title="Usunąć zamówienie?"
      message={
        <>
          Czy na pewno chcesz usunąć zamówienie{' '}
          <strong>„{order.product || 'Bez nazwy'}”</strong>?
          <p className="shopping-delete-warning">
            Tej operacji nie można cofnąć.
          </p>
        </>
      }
      confirmText="Usuń zamówienie"
      cancelText="Anuluj"
      loading={loading}
      onConfirm={confirmDelete}
      onCancel={closeDeleteDialog}
    >
      {deleteError && (
        <p className="shopping-status-error" role="alert">
          {deleteError}
        </p>
      )}
    </ConfirmDialog>
  );

  if (isEditing) {
    return (
      <>
        <AdminOrderEditForm
          order={order}
          onCancel={() => setIsEditing(false)}
          onSaved={() => setIsEditing(false)}
        />

        {deleteDialog}
      </>
    );
  }

  return (
    <>
      <article
        className={`shopping-card ${status.className} ${
          selected ? 'selected' : ''
        } ${isExpanded ? 'expanded' : ''}`}
      >
        <div className="shopping-main">
          <div className="shopping-status-summary">
            <span className="shopping-status-dot" aria-hidden="true" />

            <strong>{status.label}</strong>
          </div>

          <div className="shopping-summary">
            <div className="shopping-summary-product">
              {typeof onSelect === 'function' && (
                <input
                  type="checkbox"
                  className="shopping-select"
                  checked={selected}
                  onChange={() => onSelect(order.id)}
                  aria-label={`Zaznacz zamówienie ${order.product || ''}`}
                />
              )}

              <span>{order.product || 'Brak nazwy'}</span>
            </div>

            <div className="shopping-summary-meta">
              <span>
                📦 {order.quantity ?? 0} {order.unit || ''}
              </span>

              <span>👤 {order.requestedBy || '—'}</span>

              <span>🕐 {formatDate(order.createdAt)}</span>
            </div>
          </div>

          <button
            type="button"
            className="shopping-expand"
            onClick={handleToggle}
            aria-expanded={isExpanded}
          >
            <span>{isExpanded ? 'Zwiń' : 'Szczegóły'}</span>

            <span
              className={`shopping-chevron ${isExpanded ? 'open' : ''}`}
              aria-hidden="true"
            >
              ↓
            </span>
          </button>
        </div>

        {isExpanded && (
          <div className="shopping-details">
            <div className="shopping-details-grid">
              <div className="shopping-detail">
                <span className="shopping-detail-label">Produkt</span>

                <strong>{order.product || 'Brak nazwy'}</strong>
              </div>

              <div className="shopping-detail">
                <span className="shopping-detail-label">Ilość</span>

                <strong>
                  {order.quantity ?? 0} {order.unit || ''}
                </strong>
              </div>

              <div className="shopping-detail">
                <span className="shopping-detail-label">Dodane przez</span>

                <strong>{order.requestedBy || '—'}</strong>
              </div>

              <div className="shopping-detail">
                <span className="shopping-detail-label">
                  Opiekun zgłoszenia
                </span>

                <strong>{assignedOwnerName}</strong>
              </div>

              <div className="shopping-detail">
                <span className="shopping-detail-label">Przypisano</span>

                <strong>
                  {order.assignedAt ? formatDate(order.assignedAt) : '—'}
                </strong>
              </div>

              <div className="shopping-detail">
                <span className="shopping-detail-label">Przypisał</span>

                <strong>{order.assignedByName || '—'}</strong>
              </div>

              <div className="shopping-detail">
                <span className="shopping-detail-label">Zgłoszono</span>

                <strong>{formatDate(order.createdAt)}</strong>
              </div>

              <div className="shopping-detail">
                <span className="shopping-detail-label">Przyjęto</span>

                <strong>
                  {order.acceptedAt ? formatDate(order.acceptedAt) : '—'}
                </strong>
              </div>

              <div className="shopping-detail">
                <span className="shopping-detail-label">Zrealizowano</span>

                <strong>
                  {order.completedAt ? formatDate(order.completedAt) : '—'}
                </strong>
              </div>

              {isCancelled && (
                <div className="shopping-detail">
                  <span className="shopping-detail-label">Anulowano</span>

                  <strong>
                    {order.cancelledAt
                      ? formatDate(order.cancelledAt)
                      : 'Anulowane'}
                  </strong>
                </div>
              )}
            </div>

            {!isClosed && (canChangeStatus || assignmentActions) && (
              <div className="shopping-order-actions-row">
                {canChangeStatus && (
                  <SharedDropdown
                    label="Zmień status"
                    icon="⇄"
                    value={order.status}
                    options={STATUS_OPTIONS}
                    onChange={handleStatusChange}
                    disabled={loading}
                    loading={loading}
                    searchable
                  />
                )}

                {assignmentActions}
              </div>
            )}

            {(canEdit || canDelete || order.adminComment) && (
              <div className="shopping-details-bottom shopping-card-readonly-footer">
                <div className="shopping-card-footer-left">
                  <div className="shopping-admin-comment-view">
                    <span className="shopping-admin-comment-label">
                      Komentarz administratora
                    </span>

                    <div className="shopping-admin-comment-content">
                      {order.adminComment?.trim() ||
                        'Brak komentarza administratora.'}
                    </div>
                  </div>
                </div>

                {(canEdit || canDelete) && (
                  <div className="shopping-actions">
                    {canEdit && !isClosed && (
                      <button
                        type="button"
                        className="admin-button info"
                        disabled={loading}
                        onClick={openEditForm}
                      >
                        ✏️ Edytuj
                      </button>
                    )}

                    {canDelete && (
                      <button
                        type="button"
                        className="admin-button danger"
                        disabled={loading}
                        onClick={openDeleteDialog}
                      >
                        🗑 Usuń
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {error && (
              <p className="shopping-status-error" role="alert">
                {error}
              </p>
            )}
          </div>
        )}
      </article>

      {deleteDialog}
    </>
  );
}
