import { useEffect, useMemo, useState } from 'react';
import AdminOrderCard from './AdminOrderCard';
import EmptyState from '../shared/EmptyState';
import '../../styles/admin-shopping.css';

const PAGE_SIZE = 10;

const completedStyles = `
.admin-page .admin-completed-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  min-width: 0;
  margin: 0;
  padding: 0;
}

.admin-page .admin-completed-list *,
.admin-page .admin-completed-list *::before,
.admin-page .admin-completed-list *::after {
  box-sizing: border-box;
}

.admin-page .admin-completed-list .completed-list-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  box-shadow: none;
}

.admin-page .admin-completed-list .completed-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  width: 100%;
  min-width: 0;
  min-height: 76px;
  margin: 0;
  padding: 16px 20px;
  border: 1px solid color-mix(
    in srgb,
    var(--accent, #ff718f) 20%,
    #58404b
  );
  border-radius: 16px;
  background: color-mix(
    in srgb,
    var(--primary, #581d2b) 30%,
    #21151e
  );
  color: #ffffff;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.2s ease, background 0.2s ease;
}

.admin-page .admin-completed-list .completed-toggle:hover,
.admin-page .admin-completed-list .completed-toggle.open {
  border-color: var(--accent, #ff718f);
  background: color-mix(
    in srgb,
    var(--primary, #581d2b) 42%,
    #21151e
  );
}

.admin-page .admin-completed-list .completed-toggle:focus-visible,
.admin-page .admin-completed-list .completed-load-more:focus-visible,
.admin-page .admin-completed-list .completed-collapse:focus-visible {
  outline: 2px solid var(--accent, #ff718f);
  outline-offset: 3px;
}

.admin-page .admin-completed-list .completed-toggle-left {
  display: flex;
  align-items: center;
  gap: 13px;
  min-width: 0;
}

.admin-page .admin-completed-list .completed-toggle-icon {
  display: flex;
  flex: 0 0 42px;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border: 1px solid rgba(167, 139, 250, 0.35);
  border-radius: 12px;
  background: rgba(167, 139, 250, 0.12);
  font-size: 20px;
}

.admin-page .admin-completed-list .completed-toggle-text {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}

.admin-page .admin-completed-list .completed-toggle-title {
  color: #ffffff !important;
  -webkit-text-fill-color: #ffffff !important;
  font-size: 0.95rem;
  font-weight: 850;
  line-height: 1.3;
}

.admin-page .admin-completed-list .completed-toggle-description {
  color: #d7c4cc !important;
  -webkit-text-fill-color: #d7c4cc !important;
  font-size: 0.76rem;
  font-weight: 500;
  line-height: 1.4;
}

.admin-page .admin-completed-list .completed-toggle-right {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 12px;
}

.admin-page .admin-completed-list .completed-count {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 38px;
  height: 36px;
  padding: 0 10px;
  border: 1px solid color-mix(
    in srgb,
    var(--accent, #ff718f) 30%,
    transparent
  );
  border-radius: 11px;
  background: color-mix(
    in srgb,
    var(--accent, #ff718f) 12%,
    transparent
  );
  color: #ffffff !important;
  -webkit-text-fill-color: #ffffff !important;
  font-size: 0.85rem;
  font-weight: 900;
}

.admin-page .admin-completed-list .completed-chevron {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: 1px solid color-mix(
    in srgb,
    var(--accent, #ff718f) 25%,
    transparent
  );
  border-radius: 9px;
  color: #ffffff;
  font-size: 16px;
  transition: transform 0.2s ease;
}

.admin-page .admin-completed-list .completed-chevron.open {
  transform: rotate(180deg);
}

.admin-page .admin-completed-list .completed-list-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 100%;
  min-width: 0;
  margin: 0;
  padding: 0;
}

.admin-page .admin-completed-list .completed-list-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  padding: 2px 4px;
  color: #d7c4cc;
  font-size: 0.78rem;
  line-height: 1.4;
}

.admin-page .admin-completed-list .completed-orders {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  min-width: 0;
  margin: 0;
  padding: 0;
}

.admin-page .admin-completed-list .completed-orders > * {
  width: 100%;
  min-width: 0;
  margin-top: 0;
  margin-bottom: 0;
}

.admin-page .admin-completed-list .completed-list-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 10px;
  width: 100%;
  margin: 6px 0 0;
}

.admin-page .admin-completed-list .completed-load-more,
.admin-page .admin-completed-list .completed-collapse {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 42px;
  margin: 0;
  padding: 10px 18px;
  border-radius: 12px;
  font-family: inherit;
  font-size: 0.8rem;
  font-weight: 800;
  line-height: 1.3;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease;
}

.admin-page .admin-completed-list .completed-load-more {
  border: 1px solid var(--accent, #ff718f);
  background: color-mix(
    in srgb,
    var(--accent, #ff718f) 18%,
    #21151e
  );
  color: #ffffff !important;
  -webkit-text-fill-color: #ffffff !important;
}

.admin-page .admin-completed-list .completed-load-more:hover {
  background: color-mix(
    in srgb,
    var(--accent, #ff718f) 30%,
    #21151e
  );
}

.admin-page .admin-completed-list .completed-collapse {
  border: 1px solid color-mix(
    in srgb,
    var(--accent, #ff718f) 20%,
    #58404b
  );
  background: color-mix(
    in srgb,
    var(--primary, #581d2b) 25%,
    #21151e
  );
  color: #ffffff !important;
  -webkit-text-fill-color: #ffffff !important;
}

.admin-page .admin-completed-list .completed-collapse:hover {
  background: color-mix(
    in srgb,
    var(--primary, #581d2b) 45%,
    #21151e
  );
}

@media (max-width: 600px) {
  .admin-page .admin-completed-list .completed-toggle {
    min-height: 70px;
    padding: 13px;
  }

  .admin-page .admin-completed-list .completed-toggle-icon {
    flex-basis: 36px;
    width: 36px;
    height: 36px;
    font-size: 17px;
  }

  .admin-page .admin-completed-list .completed-toggle-title {
    font-size: 0.85rem;
  }

  .admin-page .admin-completed-list .completed-toggle-description {
    font-size: 0.69rem;
  }

  .admin-page .admin-completed-list .completed-toggle-right {
    gap: 7px;
  }

  .admin-page .admin-completed-list .completed-count {
    min-width: 32px;
    height: 32px;
    padding: 0 7px;
  }

  .admin-page .admin-completed-list .completed-orders {
    gap: 10px;
  }

  .admin-page .admin-completed-list .completed-list-info {
    font-size: 0.72rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .admin-page .admin-completed-list *,
  .admin-page .admin-completed-list *::before,
  .admin-page .admin-completed-list *::after {
    transition: none !important;
  }
}
`;

export default function AdminCompletedList({ orders = [], permissions = {} }) {
  const [listOpen, setListOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [expandedOrderId, setExpandedOrderId] = useState(null);

  const totalCount = orders.length;

  const visibleOrders = useMemo(
    () => (listOpen ? orders.slice(0, visibleCount) : []),
    [orders, listOpen, visibleCount]
  );

  const hasMore = visibleCount < totalCount;

  useEffect(() => {
    if (
      expandedOrderId !== null &&
      !visibleOrders.some((order) => order.id === expandedOrderId)
    ) {
      setExpandedOrderId(null);
    }
  }, [visibleOrders, expandedOrderId]);

  function handleToggleList() {
    if (listOpen) {
      setListOpen(false);
      setVisibleCount(PAGE_SIZE);
      setExpandedOrderId(null);
      return;
    }

    setVisibleCount(PAGE_SIZE);
    setListOpen(true);
  }

  function handleToggleOrder(orderId) {
    setExpandedOrderId((previousId) =>
      previousId === orderId ? null : orderId
    );
  }

  function handleLoadMore() {
    setVisibleCount((previousCount) =>
      Math.min(previousCount + PAGE_SIZE, totalCount)
    );
  }

  return (
    <>
      <style>{completedStyles}</style>

      <section className="admin-completed-list">
        <section className="completed-list-panel">
          <button
            type="button"
            className={`completed-toggle ${listOpen ? 'open' : ''}`}
            onClick={handleToggleList}
            aria-expanded={listOpen}
            aria-controls="completed-orders-content"
          >
            <span className="completed-toggle-left">
              <span className="completed-toggle-icon" aria-hidden="true">
                🟣
              </span>

              <span className="completed-toggle-text">
                <strong className="completed-toggle-title">
                  Zrealizowane zamówienia
                </strong>

                <span className="completed-toggle-description">
                  {listOpen
                    ? 'Kliknij, aby zwinąć listę zamówień.'
                    : 'Kliknij, aby wyświetlić historię zamówień.'}
                </span>
              </span>
            </span>

            <span className="completed-toggle-right">
              <span
                className="completed-count"
                aria-label={`Liczba zamówień: ${totalCount}`}
              >
                {totalCount}
              </span>

              <span
                className={`completed-chevron ${listOpen ? 'open' : ''}`}
                aria-hidden="true"
              >
                ↓
              </span>
            </span>
          </button>

          {listOpen && (
            <div id="completed-orders-content" className="completed-list-body">
              {totalCount === 0 ? (
                <EmptyState>Brak zrealizowanych zamówień.</EmptyState>
              ) : (
                <>
                  <div className="completed-list-info">
                    <span>
                      Wyświetlono {visibleOrders.length} z {totalCount} zamówień
                    </span>
                  </div>

                  <div className="shopping-category-body completed-orders">
                    {visibleOrders.map((order) => (
                      <AdminOrderCard
                        key={order.id}
                        order={order}
                        canOrder={false}
                        permissions={permissions}
                        expanded={expandedOrderId === order.id}
                        onToggle={handleToggleOrder}
                      />
                    ))}
                  </div>

                  <div className="completed-list-actions">
                    {hasMore && (
                      <button
                        type="button"
                        className="completed-load-more"
                        onClick={handleLoadMore}
                      >
                        Pokaż kolejne{' '}
                        {Math.min(PAGE_SIZE, totalCount - visibleCount)}{' '}
                        zamówień
                        <span aria-hidden="true">↓</span>
                      </button>
                    )}

                    <button
                      type="button"
                      className="completed-collapse"
                      onClick={handleToggleList}
                    >
                      <span aria-hidden="true">↑</span>
                      Zwiń listę
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </section>
      </section>
    </>
  );
}
