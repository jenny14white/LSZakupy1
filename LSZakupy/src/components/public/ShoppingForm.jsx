import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createOrder } from '../../services/ordersService';
import { UNITS } from '../../utils/constants';

export default function ShoppingForm() {
  const { t } = useTranslation();
  const [requestedBy, setRequestedBy] = useState('');
  const [product, setProduct] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('szt.');
  const [unitOpen, setUnitOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);
  const triggerRef = useRef(null);
  const messageTimerRef = useRef(null);

  useEffect(() => {
    function handleOutsideClick(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setUnitOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === 'Escape') {
        setUnitOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener('pointerdown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('pointerdown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
      clearTimeout(messageTimerRef.current);
    };
  }, []);

  function changeQuantity(step) {
    setQuantity((previous) => {
      const current = Number(previous);
      const next = Math.max(1, (Number.isFinite(current) ? current : 1) + step);
      return String(next);
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (loading) return;

    const amount = Number(quantity);

    if (
      !requestedBy.trim() ||
      !product.trim() ||
      !Number.isFinite(amount) ||
      amount < 1
    ) {
      setIsError(true);
      setMessage(t('shopping.form.errors.required'));
      return;
    }

    try {
      setLoading(true);
      setIsError(false);
      setUnitOpen(false);

      await createOrder({
        requestedBy: requestedBy.trim(),
        product: product.trim(),
        quantity: amount,
        unit,
      });

      setMessage(`${t('shopping.form.success')} ${product}`);
      setProduct('');
      setQuantity('1');
      setUnit('szt.');
      clearTimeout(messageTimerRef.current);
      messageTimerRef.current = setTimeout(() => setMessage(''), 3500);
    } catch (error) {
      console.error(error);
      setIsError(true);
      setMessage(t('shopping.form.errors.addFailed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="shopping-form" onSubmit={handleSubmit}>
      {message && (
        <div className={isError ? 'error-message' : 'success-message'}>
          {message}
        </div>
      )}

      <label>
        {t('shopping.form.name')} *
        <input
          value={requestedBy}
          onChange={(event) => setRequestedBy(event.target.value)}
          placeholder={t('shopping.form.placeholders.name')}
        />
      </label>

      <label>
        {t('shopping.form.product')} *
        <textarea
          rows="4"
          value={product}
          onChange={(event) => setProduct(event.target.value)}
          placeholder={t('shopping.form.placeholders.product')}
        />
      </label>

      <div className="form-row">
        <label className="shopping-quantity-field">
          {t('shopping.form.quantity')} *
          <span className="shopping-quantity-control">
            <input
              type="number"
              min="1"
              step="1"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
            <span className="shopping-quantity-actions">
              <button
                type="button"
                className="shopping-quantity-button"
                onClick={() => changeQuantity(-1)}
                disabled={loading || Number(quantity) <= 1}
                aria-label="Zmniejsz ilość"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="15"
                  height="15"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M5 12h14" />
                </svg>
              </button>
              <button
                type="button"
                className="shopping-quantity-button"
                onClick={() => changeQuantity(1)}
                disabled={loading}
                aria-label="Zwiększ ilość"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="15"
                  height="15"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </button>
            </span>
          </span>
        </label>

        <div className="shopping-unit-field">
          <label id="shopping-unit-label">{t('shopping.form.unit')}</label>
          <div
            className={`shopping-unit-dropdown${unitOpen ? ' is-open' : ''}`}
            ref={dropdownRef}
          >
            <button
              ref={triggerRef}
              type="button"
              className="shopping-unit-trigger"
              aria-haspopup="listbox"
              aria-expanded={unitOpen}
              aria-labelledby="shopping-unit-label shopping-unit-value"
              onClick={() => setUnitOpen((previous) => !previous)}
            >
              <span id="shopping-unit-value">{unit}</span>
              <svg
                className="shopping-unit-chevron"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            {unitOpen && (
              <div
                className="shopping-unit-menu"
                role="listbox"
                aria-labelledby="shopping-unit-label"
              >
                {UNITS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    role="option"
                    aria-selected={unit === item}
                    className={`shopping-unit-option${
                      unit === item ? ' is-selected' : ''
                    }`}
                    onClick={() => {
                      setUnit(item);
                      setUnitOpen(false);
                      triggerRef.current?.focus();
                    }}
                  >
                    <span>{item}</span>
                    {unit === item && (
                      <svg
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="m5 12 4 4L19 6" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <button type="submit" className="submit-button" disabled={loading}>
        {loading ? t('shopping.form.loading') : t('shopping.form.submit')}
      </button>
    </form>
  );
}
