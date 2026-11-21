import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import '../../styles/confirm-dialog.css';

const icons = {
  danger: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4.5A1.5 1.5 0 0 1 9.5 3h5A1.5 1.5 0 0 1 16 4.5V6" />
      <path d="m5 6 1 14a2 2 0 0 0 2 1.8h8a2 2 0 0 0 2-1.8l1-14" />
      <path d="M10 10v7M14 10v7" />
    </svg>
  ),
  warning: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10.3 3.8 2.4 18a2 2 0 0 0 1.8 3h15.6a2 2 0 0 0 1.8-3L13.7 3.8a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  ),
  info: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </svg>
  ),
  success: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 2.5 2.5L16 9" />
    </svg>
  ),
};

export default function ConfirmDialog({
  open = false,
  title = 'Potwierdź operację',
  message = '',
  children,
  confirmText = 'Potwierdź',
  cancelText = 'Anuluj',
  variant = 'danger',
  loading = false,
  disabled = false,
  closeOnOverlay = true,
  closeOnEscape = true,
  showCancel = true,
  icon,
  onConfirm,
  onCancel,
}) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef(null);
  const cancelButtonRef = useRef(null);
  const confirmButtonRef = useRef(null);
  const previousFocusRef = useRef(null);
  const onCancelRef = useRef(onCancel);
  const loadingRef = useRef(loading);
  const disabledRef = useRef(disabled);

  onCancelRef.current = onCancel;
  loadingRef.current = loading;
  disabledRef.current = disabled;

  const safeVariant = Object.prototype.hasOwnProperty.call(icons, variant)
    ? variant
    : 'info';

  useEffect(() => {
    if (!open) return undefined;

    previousFocusRef.current = document.activeElement;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusFrame = requestAnimationFrame(() => {
      const target = showCancel
        ? cancelButtonRef.current
        : confirmButtonRef.current;

      target?.focus();
    });

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        if (closeOnEscape && !loadingRef.current && !disabledRef.current) {
          event.preventDefault();
          onCancelRef.current?.();
        }
        return;
      }

      if (event.key !== 'Tab') return;

      const focusableElements = dialogRef.current?.querySelectorAll(
        'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
      );

      if (!focusableElements?.length) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      const active = document.activeElement;

      if (
        event.shiftKey &&
        (active === first || !dialogRef.current?.contains(active))
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (active === last || !dialogRef.current?.contains(active))
      ) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;

      if (previousFocusRef.current?.isConnected) {
        previousFocusRef.current.focus();
      }
    };
  }, [open, closeOnEscape, showCancel]);

  if (!open || typeof document === 'undefined') {
    return null;
  }

  const isBusy = loading || disabled;

  function handleCancel() {
    if (isBusy) return;
    onCancel?.();
  }

  function handleConfirm() {
    if (isBusy) return;
    onConfirm?.();
  }

  function handleOverlayClick(event) {
    if (event.target === event.currentTarget && closeOnOverlay && !isBusy) {
      handleCancel();
    }
  }

  return createPortal(
    <div className="ls-confirm-overlay" onMouseDown={handleOverlayClick}>
      <div
        ref={dialogRef}
        className={`ls-confirm-dialog ls-confirm-${safeVariant}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={message || children ? descriptionId : undefined}
        aria-busy={loading}
        tabIndex={-1}
      >
        <div className="ls-confirm-top">
          <div className="ls-confirm-icon">{icon ?? icons[safeVariant]}</div>

          <button
            type="button"
            className="ls-confirm-close"
            onClick={handleCancel}
            disabled={isBusy}
            aria-label="Zamknij okno"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="ls-confirm-content">
          <h2 id={titleId} className="ls-confirm-title">
            {title}
          </h2>

          {(message || children) && (
            <div id={descriptionId} className="ls-confirm-description">
              {message && <p>{message}</p>}
              {children}
            </div>
          )}
        </div>

        <div className="ls-confirm-actions">
          {showCancel && (
            <button
              ref={cancelButtonRef}
              type="button"
              className="ls-confirm-button ls-confirm-cancel"
              onClick={handleCancel}
              disabled={isBusy}
            >
              {cancelText}
            </button>
          )}

          <button
            ref={confirmButtonRef}
            type="button"
            className="ls-confirm-button ls-confirm-submit"
            onClick={handleConfirm}
            disabled={isBusy}
          >
            {loading && (
              <span className="ls-confirm-spinner" aria-hidden="true" />
            )}
            <span>{loading ? 'Przetwarzanie...' : confirmText}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
