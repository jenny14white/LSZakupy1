import { useId, useState } from 'react';
import { auth } from '../../firebase/firebase';
import { ADMIN_UIDS } from '../../config/roles';
import { updateOrder } from '../../services/ordersService';
import { UNITS } from '../../utils/constants';
import CustomSelect from './CustomSelect';
import '../../styles/admin-shopping.css';

export default function AdminOrderEditForm({ order, onCancel, onSaved }) {
  const generatedId = useId();

  const [product, setProduct] = useState(order?.product || '');

  const [quantity, setQuantity] = useState(order?.quantity ?? '');

  const [unit, setUnit] = useState(order?.unit || UNITS[0] || 'szt.');

  const [requestedBy, setRequestedBy] = useState(order?.requestedBy || '');

  const [adminComment, setAdminComment] = useState(order?.adminComment || '');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!order) {
    return null;
  }

  const currentUid = auth.currentUser?.uid || '';

  const isAdmin = ADMIN_UIDS.includes(currentUid);

  const isMyOrder = Boolean(currentUid) && order.assignedToUid === currentUid;

  const assignedOwner = order.assignedToUid
    ? isMyOrder
      ? 'Ty'
      : order.assignedToName || 'Pracownik'
    : 'Nieprzypisane';

  const unitOptions = UNITS.map((item) => ({
    value: item,
    label: item,
  }));

  const hasChanges =
    product !== (order.product || '') ||
    String(quantity) !== String(order.quantity ?? '') ||
    unit !== (order.unit || UNITS[0] || 'szt.') ||
    requestedBy !== (order.requestedBy || '') ||
    (isAdmin && adminComment !== (order.adminComment || ''));

  function clearError() {
    if (error) {
      setError('');
    }
  }

  async function handleSave(event) {
    event.preventDefault();

    if (loading) {
      return;
    }

    const cleanedProduct = product.trim();
    const cleanedRequestedBy = requestedBy.trim();
    const cleanedUnit = String(unit || '').trim();
    const cleanedComment = adminComment.trim();
    const numericQuantity = Number(quantity);

    if (!isAdmin && !isMyOrder) {
      setError('Możesz edytować tylko zamówienia przypisane do Ciebie.');
      return;
    }

    if (!cleanedProduct) {
      setError('Podaj nazwę produktu.');
      return;
    }

    if (cleanedProduct.length > 200) {
      setError('Nazwa produktu może mieć maksymalnie 200 znaków.');
      return;
    }

    if (!cleanedRequestedBy) {
      setError('Podaj osobę zgłaszającą.');
      return;
    }

    if (cleanedRequestedBy.length > 100) {
      setError('Nazwa zgłaszającego może mieć maksymalnie 100 znaków.');
      return;
    }

    if (
      !Number.isFinite(numericQuantity) ||
      numericQuantity <= 0 ||
      numericQuantity > 100000
    ) {
      setError('Podaj ilość większą od zera i nie większą niż 100000.');
      return;
    }

    if (!cleanedUnit) {
      setError('Wybierz jednostkę.');
      return;
    }

    if (cleanedUnit.length > 30) {
      setError('Jednostka może mieć maksymalnie 30 znaków.');
      return;
    }

    if (!hasChanges) {
      onCancel?.();
      return;
    }

    try {
      setLoading(true);
      setError('');

      const updatedData = {
        product: cleanedProduct,
        quantity: numericQuantity,
        unit: cleanedUnit,
        requestedBy: cleanedRequestedBy,
      };

      if (isAdmin) {
        updatedData.adminComment = cleanedComment;
      }

      await updateOrder(order.id, updatedData);

      onSaved?.();
    } catch (saveError) {
      console.error('Order update error:', saveError);

      setError(
        saveError?.message || 'Nie udało się zapisać zmian. Spróbuj ponownie.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <article className="shopping-card shopping-edit-card expanded">
      <div className="shopping-main shopping-edit-main">
        <div className="shopping-status-summary">
          <span className="shopping-status-dot progress" />
          <strong>Edycja zamówienia</strong>
        </div>

        <div className="shopping-summary">
          <div className="shopping-summary-product">
            <span>{order.product || 'Brak nazwy'}</span>
          </div>

          <div className="shopping-summary-meta">
            <span>
              📦 {order.quantity || 0} {order.unit || ''}
            </span>

            <span>👤 {order.requestedBy || '—'}</span>
          </div>

          <div className="shopping-edit-owner">
            <span>👨‍💼 Opiekun zgłoszenia:</span>
            <strong>{assignedOwner}</strong>
          </div>
        </div>

        <div className="shopping-expand">
          <span>Edytowanie</span>
          <span className="shopping-chevron open">↓</span>
        </div>
      </div>

      <form
        className="shopping-details shopping-edit-details"
        onSubmit={handleSave}
      >
        <div className="shopping-details-grid">
          <label className="shopping-detail shopping-edit-detail">
            <span className="shopping-detail-label">Produkt</span>

            <input
              type="text"
              value={product}
              maxLength={200}
              onChange={(event) => {
                setProduct(event.target.value);
                clearError();
              }}
              placeholder="Nazwa produktu..."
              autoFocus
              disabled={loading}
              required
            />
          </label>

          <label className="shopping-detail shopping-edit-detail">
            <span className="shopping-detail-label">Osoba zgłaszająca</span>

            <input
              type="text"
              value={requestedBy}
              maxLength={100}
              onChange={(event) => {
                setRequestedBy(event.target.value);
                clearError();
              }}
              placeholder="Imię i nazwisko..."
              disabled={loading}
              required
            />
          </label>

          <label className="shopping-detail shopping-edit-detail">
            <span className="shopping-detail-label">Ilość</span>

            <input
              type="number"
              min="0.01"
              max="100000"
              step="any"
              value={quantity}
              onChange={(event) => {
                setQuantity(event.target.value);
                clearError();
              }}
              placeholder="Podaj ilość..."
              disabled={loading}
              required
            />
          </label>

          <div className="shopping-detail shopping-edit-detail shopping-edit-unit">
            <label
              className="shopping-detail-label"
              htmlFor={`${generatedId}-unit`}
            >
              Jednostka
            </label>

            <CustomSelect
              id={`${generatedId}-unit`}
              value={unit}
              options={unitOptions}
              onChange={(nextUnit) => {
                setUnit(nextUnit);
                clearError();
              }}
              placeholder="Wybierz jednostkę..."
              searchable={false}
              disabled={loading}
            />
          </div>

          {isAdmin && (
            <label className="shopping-detail shopping-edit-detail shopping-edit-comment">
              <span className="shopping-detail-label">
                Komentarz administratora
              </span>

              <textarea
                rows={4}
                value={adminComment}
                onChange={(event) => {
                  setAdminComment(event.target.value);
                  clearError();
                }}
                placeholder="Komentarz administratora..."
                disabled={loading}
              />
            </label>
          )}

          {error && (
            <p className="shopping-edit-error" role="alert">
              {error}
            </p>
          )}
        </div>

        <div className="shopping-details-actions">
          <button
            type="submit"
            className="admin-button"
            disabled={loading || !hasChanges}
          >
            {loading ? 'Zapisywanie...' : '✓ Zapisz zmiany'}
          </button>

          <button
            type="button"
            className="admin-button secondary"
            onClick={onCancel}
            disabled={loading}
          >
            Anuluj
          </button>
        </div>
      </form>
    </article>
  );
}
