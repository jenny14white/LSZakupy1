import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import '../../styles/shared-dropdown.css';

export default function SharedDropdown({
  label,
  icon = '⇄',
  options = [],
  value,
  onChange,
  disabled = false,
  loading = false,
  searchable = true,
  searchPlaceholder = 'Wyszukaj...',
  emptyMessage = 'Brak wyników',
  className = '',
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [position, setPosition] = useState(null);

  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const searchRef = useRef(null);
  const menuId = useId();

  const filteredOptions = options.filter((option) =>
    String(option.label || '')
      .toLocaleLowerCase('pl')
      .includes(search.trim().toLocaleLowerCase('pl'))
  );

  function closeMenu() {
    setOpen(false);
    setSearch('');
  }

  function updatePosition() {
    if (!triggerRef.current || !menuRef.current) return;

    const trigger = triggerRef.current.getBoundingClientRect();
    const menu = menuRef.current.getBoundingClientRect();
    const margin = 8;
    const viewportPadding = 8;

    const spaceBelow = window.innerHeight - trigger.bottom;
    const spaceAbove = trigger.top;
    const openUp = spaceBelow < menu.height + margin && spaceAbove > spaceBelow;

    const availableHeight = Math.max(
      100,
      (openUp ? spaceAbove : spaceBelow) - margin - viewportPadding
    );

    const width = Math.min(220, window.innerWidth - viewportPadding * 2);

    const left = Math.max(
      viewportPadding,
      Math.min(trigger.left, window.innerWidth - width - viewportPadding)
    );

    const top = openUp
      ? Math.max(
          viewportPadding,
          trigger.top - Math.min(menu.height, availableHeight) - margin
        )
      : trigger.bottom + margin;

    setPosition({
      top,
      left,
      width,
      maxHeight: availableHeight,
    });
  }

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, search, filteredOptions.length]);

  useEffect(() => {
    if (!open) return;

    searchRef.current?.focus();

    function handlePointerDown(event) {
      if (
        !triggerRef.current?.contains(event.target) &&
        !menuRef.current?.contains(event.target)
      ) {
        closeMenu();
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        closeMenu();
        triggerRef.current?.focus();
      }
    }

    function handleViewportChange() {
      closeMenu();
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [open]);

  function handleSelect(option) {
    if (option.disabled || disabled || loading) return;

    closeMenu();

    if (option.value !== value) {
      onChange?.(option.value, option);
    }
  }

  return (
    <div className={`shared-dropdown ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        className={`shared-dropdown-trigger ${open ? 'is-open' : ''}`}
        disabled={disabled || loading}
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-haspopup="listbox"
        onClick={() => {
          if (open) {
            closeMenu();
          } else {
            setSearch('');
            setPosition(null);
            setOpen(true);
          }
        }}
      >
        <span className="shared-dropdown-trigger-icon" aria-hidden="true">
          {icon}
        </span>
        <span>{loading ? 'Zapisywanie...' : label}</span>
        <span className="shared-dropdown-chevron" aria-hidden="true">
          {open ? '⌃' : '⌄'}
        </span>
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            id={menuId}
            className="shared-dropdown-menu"
            role="group"
            aria-label={label}
            style={
              position
                ? {
                    top: position.top,
                    left: position.left,
                    width: position.width,
                    maxHeight: position.maxHeight,
                    visibility: 'visible',
                  }
                : {
                    top: 0,
                    left: 0,
                    width: 220,
                    visibility: 'hidden',
                  }
            }
          >
            {searchable && (
              <div className="shared-dropdown-search">
                <span
                  className="shared-dropdown-search-icon"
                  aria-hidden="true"
                >
                  ⌕
                </span>
                <input
                  ref={searchRef}
                  type="search"
                  value={search}
                  placeholder={searchPlaceholder}
                  aria-label={`Wyszukaj: ${label}`}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
            )}

            <div
              className="shared-dropdown-options"
              role="listbox"
              aria-label={label}
            >
              {filteredOptions.length ? (
                filteredOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={option.value === value}
                    disabled={option.disabled}
                    className={`shared-dropdown-option ${
                      option.value === value ? 'is-selected' : ''
                    }`}
                    onClick={() => handleSelect(option)}
                  >
                    <span>{option.label}</span>
                    {option.value === value && (
                      <span
                        className="shared-dropdown-check"
                        aria-hidden="true"
                      >
                        ✓
                      </span>
                    )}
                  </button>
                ))
              ) : (
                <div className="shared-dropdown-empty">{emptyMessage}</div>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
