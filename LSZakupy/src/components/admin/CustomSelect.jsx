import { useEffect, useId, useRef, useState } from 'react';

const customSelectStyles = `
.ls-custom-select {
  --ls-select-bg: color-mix(in srgb, var(--primary, #581d2b) 20%, #210e17);
  --ls-select-surface: color-mix(in srgb, var(--primary, #581d2b) 25%, #29131c);
  --ls-select-hover: color-mix(in srgb, var(--primary, #581d2b) 38%, #43232c);
  --ls-select-accent: var(--accent, #c99b56);
  --ls-select-border: color-mix(in srgb, var(--ls-select-accent) 24%, #684c53);
  --ls-select-text: #fff7f8;
  --ls-select-muted: #cdb9c0;

  position: relative !important;
  display: block !important;
  width: 100% !important;
  min-width: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  font-family: inherit !important;
  color: var(--ls-select-text) !important;
  text-align: left !important;
  isolation: isolate;
}

.ls-custom-select,
.ls-custom-select *,
.ls-custom-select *::before,
.ls-custom-select *::after {
  box-sizing: border-box !important;
}

.ls-custom-select .ls-custom-select-trigger {
  position: relative !important;
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  gap: 12px !important;
  width: 100% !important;
  min-width: 0 !important;
  height: 43px !important;
  min-height: 43px !important;
  margin: 0 !important;
  padding: 0 13px !important;
  border: 1px solid var(--ls-select-border) !important;
  border-radius: 11px !important;
  background: var(--ls-select-bg) !important;
  color: var(--ls-select-text) !important;
  -webkit-text-fill-color: var(--ls-select-text) !important;
  box-shadow: none !important;
  outline: none !important;
  font-family: inherit !important;
  font-size: 0.8rem !important;
  font-weight: 700 !important;
  line-height: 1.3 !important;
  text-align: left !important;
  text-transform: none !important;
  letter-spacing: normal !important;
  cursor: pointer !important;
  transition:
    border-color 0.18s ease,
    background 0.18s ease !important;
}

.ls-custom-select .ls-custom-select-trigger:hover {
  border-color: var(--ls-select-accent) !important;
  background: var(--ls-select-surface) !important;
}

.ls-custom-select.is-open .ls-custom-select-trigger,
.ls-custom-select .ls-custom-select-trigger:focus-visible {
  border-color: var(--ls-select-accent) !important;
  background: var(--ls-select-surface) !important;
  box-shadow: 0 0 0 2px
    color-mix(in srgb, var(--ls-select-accent) 12%, transparent) !important;
}

.ls-custom-select .ls-custom-select-value {
  display: block !important;
  flex: 1 1 auto !important;
  min-width: 0 !important;
  overflow: hidden !important;
  color: var(--ls-select-text) !important;
  -webkit-text-fill-color: var(--ls-select-text) !important;
  text-overflow: ellipsis !important;
  white-space: nowrap !important;
}

.ls-custom-select .ls-custom-select-arrow {
  display: block !important;
  flex: 0 0 15px !important;
  width: 15px !important;
  height: 15px !important;
  color: var(--ls-select-accent) !important;
  transition: transform 0.18s ease !important;
}

.ls-custom-select.is-open .ls-custom-select-arrow {
  transform: rotate(180deg) !important;
}

.ls-custom-select .ls-custom-select-dropdown {
  position: absolute !important;
  top: calc(100% + 7px) !important;
  right: 0 !important;
  left: 0 !important;
  z-index: 9999 !important;
  display: flex !important;
  flex-direction: column !important;
  gap: 7px !important;
  width: 100% !important;
  min-width: 0 !important;
  max-height: min(330px, 65vh) !important;
  margin: 0 !important;
  padding: 7px !important;
  overflow: hidden !important;
  border: 1px solid var(--ls-select-border) !important;
  border-radius: 13px !important;
  background: var(--ls-select-surface) !important;
  box-shadow: 0 15px 40px rgba(0, 0, 0, 0.32) !important;
  outline: none !important;
}

.ls-custom-select.open-up .ls-custom-select-dropdown {
  top: auto !important;
  bottom: calc(100% + 7px) !important;
}

.ls-custom-select .ls-custom-select-search-wrap {
  position: relative !important;
  display: flex !important;
  flex: 0 0 39px !important;
  align-items: center !important;
  gap: 8px !important;
  width: 100% !important;
  min-width: 0 !important;
  height: 39px !important;
  min-height: 39px !important;
  margin: 0 !important;
  padding: 0 11px !important;
  overflow: hidden !important;
  border: 1px solid var(--ls-select-border) !important;
  border-radius: 9px !important;
  background: var(--ls-select-bg) !important;
  box-shadow: none !important;
  outline: none !important;
  transform: none !important;
}

.ls-custom-select .ls-custom-select-search-wrap:focus-within {
  border-color: var(--ls-select-accent) !important;
  box-shadow: none !important;
  outline: none !important;
}

.ls-custom-select .ls-custom-select-search-icon {
  display: flex !important;
  flex: 0 0 15px !important;
  align-items: center !important;
  justify-content: center !important;
  width: 15px !important;
  height: 15px !important;
  color: var(--ls-select-accent) !important;
  -webkit-text-fill-color: var(--ls-select-accent) !important;
  font-size: 17px !important;
  line-height: 1 !important;
}

.ls-custom-select .ls-custom-select-search-wrap input.ls-custom-select-search {
  display: block !important;
  flex: 1 1 auto !important;
  width: 100% !important;
  min-width: 0 !important;
  height: 35px !important;
  min-height: 0 !important;
  max-height: 35px !important;
  margin: 0 !important;
  padding: 0 !important;
  border: 0 !important;
  border-radius: 0 !important;
  background: transparent !important;
  color: var(--ls-select-text) !important;
  -webkit-text-fill-color: var(--ls-select-text) !important;
  box-shadow: none !important;
  outline: none !important;
  appearance: none !important;
  -webkit-appearance: none !important;
  font-family: inherit !important;
  font-size: 0.77rem !important;
  font-weight: 500 !important;
  line-height: normal !important;
  letter-spacing: normal !important;
  text-align: left !important;
  transform: none !important;
}

.ls-custom-select .ls-custom-select-search-wrap input.ls-custom-select-search:focus,
.ls-custom-select .ls-custom-select-search-wrap input.ls-custom-select-search:focus-visible,
.ls-custom-select .ls-custom-select-search-wrap input.ls-custom-select-search:hover {
  border: 0 !important;
  border-radius: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
  outline: none !important;
}

.ls-custom-select .ls-custom-select-search::placeholder {
  color: var(--ls-select-muted) !important;
  -webkit-text-fill-color: var(--ls-select-muted) !important;
  opacity: 0.8 !important;
}

.ls-custom-select .ls-custom-select-search::-webkit-search-decoration,
.ls-custom-select .ls-custom-select-search::-webkit-search-cancel-button {
  -webkit-appearance: none !important;
}

.ls-custom-select .ls-custom-select-search-wrap::before,
.ls-custom-select .ls-custom-select-search-wrap::after {
  content: none !important;
  display: none !important;
}

.ls-custom-select .ls-custom-select-options {
  display: flex !important;
  flex-direction: column !important;
  gap: 3px !important;
  width: 100% !important;
  min-width: 0 !important;
  min-height: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  overflow-x: hidden !important;
  overflow-y: auto !important;
  scrollbar-width: thin;
  scrollbar-color: var(--ls-select-border) transparent;
  overscroll-behavior: contain;
}

.ls-custom-select .ls-custom-select-option {
  position: relative !important;
  display: flex !important;
  flex: 0 0 auto !important;
  align-items: center !important;
  justify-content: space-between !important;
  gap: 10px !important;
  width: 100% !important;
  min-width: 0 !important;
  min-height: 37px !important;
  height: auto !important;
  margin: 0 !important;
  padding: 9px 11px !important;
  border: 0 !important;
  border-radius: 8px !important;
  background: transparent !important;
  color: var(--ls-select-text) !important;
  -webkit-text-fill-color: var(--ls-select-text) !important;
  box-shadow: none !important;
  outline: none !important;
  font-family: inherit !important;
  font-size: 0.78rem !important;
  font-weight: 650 !important;
  line-height: 1.35 !important;
  text-align: left !important;
  text-transform: none !important;
  letter-spacing: normal !important;
  cursor: pointer !important;
  transition: background 0.15s ease !important;
}

.ls-custom-select .ls-custom-select-option > span {
  display: block !important;
  flex: 1 1 auto !important;
  min-width: 0 !important;
  overflow-wrap: anywhere !important;
  color: inherit !important;
  -webkit-text-fill-color: inherit !important;
}

.ls-custom-select .ls-custom-select-option:hover,
.ls-custom-select .ls-custom-select-option.is-highlighted {
  background: var(--ls-select-hover) !important;
}

.ls-custom-select .ls-custom-select-option.is-selected {
  background: color-mix(
    in srgb,
    var(--ls-select-accent) 19%,
    var(--ls-select-surface)
  ) !important;
  color: #ffffff !important;
  -webkit-text-fill-color: #ffffff !important;
}

.ls-custom-select .ls-custom-select-option.is-selected svg {
  flex: 0 0 15px !important;
  color: var(--ls-select-accent) !important;
}

.ls-custom-select .ls-custom-select-option:focus-visible {
  outline: 1px solid var(--ls-select-accent) !important;
  outline-offset: -1px !important;
}

.ls-custom-select .ls-custom-select-empty {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  min-height: 48px !important;
  padding: 12px !important;
  color: var(--ls-select-muted) !important;
  -webkit-text-fill-color: var(--ls-select-muted) !important;
  font-size: 0.78rem !important;
  text-align: center !important;
}

@media (max-width: 600px) {
  .ls-custom-select .ls-custom-select-trigger {
    height: 42px !important;
    min-height: 42px !important;
  }

  .ls-custom-select .ls-custom-select-dropdown {
    max-height: min(280px, 55vh) !important;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ls-custom-select *,
  .ls-custom-select *::before,
  .ls-custom-select *::after {
    transition: none !important;
    animation: none !important;
  }
}
`;

export default function CustomSelect({
  id,
  value,
  options = [],
  onChange,
  placeholder = 'Wybierz...',
  searchable = true,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [openUp, setOpenUp] = useState(false);

  const wrapperRef = useRef(null);
  const triggerRef = useRef(null);
  const searchRef = useRef(null);
  const optionsRef = useRef(null);
  const optionRefs = useRef([]);

  const generatedId = useId();
  const listId = `${id || generatedId}-options`;

  const safeOptions = Array.isArray(options) ? options : [];

  const selected = safeOptions.find((option) => option.value === value);

  const filteredOptions = safeOptions.filter((option) =>
    String(option.label ?? '')
      .toLocaleLowerCase('pl-PL')
      .includes(search.trim().toLocaleLowerCase('pl-PL'))
  );

  useEffect(() => {
    function handleOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setOpen(false);
        setSearch('');
      }
    }

    document.addEventListener('pointerdown', handleOutside);

    return () => {
      document.removeEventListener('pointerdown', handleOutside);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const rect = wrapperRef.current?.getBoundingClientRect();

    if (rect) {
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;

      setOpenUp(spaceBelow < 350 && spaceAbove > spaceBelow);
    }

    if (searchable) {
      searchRef.current?.focus();
    }
  }, [open, searchable]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const selectedIndex = filteredOptions.findIndex(
      (option) => option.value === value
    );

    setHighlightedIndex(
      selectedIndex >= 0 ? selectedIndex : filteredOptions.length ? 0 : -1
    );
  }, [open, search, value, options]);

  useEffect(() => {
    if (!open || highlightedIndex < 0) {
      return;
    }

    optionRefs.current[highlightedIndex]?.scrollIntoView({
      block: 'nearest',
      behavior: 'auto',
    });
  }, [open, highlightedIndex]);

  function closeSelect(restoreFocus = false) {
    setOpen(false);
    setSearch('');
    setHighlightedIndex(-1);

    if (restoreFocus) {
      requestAnimationFrame(() => triggerRef.current?.focus());
    }
  }

  function chooseOption(nextValue) {
    onChange?.(nextValue);
    closeSelect(true);
  }

  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      if (open) {
        event.preventDefault();
        event.stopPropagation();
        closeSelect(true);
      }
      return;
    }

    if (event.key === 'Tab') {
      if (open) {
        closeSelect();
      }
      return;
    }

    if (!open) {
      if (
        event.key === 'ArrowDown' ||
        event.key === 'ArrowUp' ||
        event.key === 'Enter' ||
        event.key === ' '
      ) {
        event.preventDefault();
        setOpen(true);
      }
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();

      setHighlightedIndex((current) =>
        Math.min(current + 1, filteredOptions.length - 1)
      );
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();

      setHighlightedIndex((current) => Math.max(current - 1, 0));
    }

    if (event.key === 'Enter') {
      event.preventDefault();

      if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
        chooseOption(filteredOptions[highlightedIndex].value);
      }
    }
  }

  function handleTriggerClick() {
    if (open) {
      closeSelect();
    } else {
      setSearch('');
      setOpen(true);
    }
  }

  return (
    <>
      <style>{customSelectStyles}</style>

      <div
        ref={wrapperRef}
        className={`ls-custom-select ${open ? 'is-open' : ''} ${
          openUp ? 'open-up' : ''
        }`}
        onKeyDown={handleKeyDown}
      >
        <button
          ref={triggerRef}
          id={id}
          type="button"
          className="ls-custom-select-trigger"
          onClick={handleTriggerClick}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
        >
          <span className="ls-custom-select-value">
            {selected?.label ?? placeholder}
          </span>

          <svg
            className="ls-custom-select-arrow"
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

        {open && (
          <div className="ls-custom-select-dropdown">
            {searchable && (
              <div className="ls-custom-select-search-wrap">
                <span
                  className="ls-custom-select-search-icon"
                  aria-hidden="true"
                >
                  ⌕
                </span>

                <input
                  ref={searchRef}
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Wyszukaj..."
                  className="ls-custom-select-search"
                  aria-label="Wyszukaj opcję"
                  autoComplete="off"
                />
              </div>
            )}

            <div
              id={listId}
              ref={optionsRef}
              className="ls-custom-select-options"
              role="listbox"
              aria-label="Dostępne opcje"
            >
              {filteredOptions.length === 0 ? (
                <div className="ls-custom-select-empty">Brak wyników</div>
              ) : (
                filteredOptions.map((option, index) => {
                  const active = option.value === value;
                  const highlighted = index === highlightedIndex;

                  return (
                    <button
                      key={option.value}
                      ref={(element) => {
                        optionRefs.current[index] = element;
                      }}
                      type="button"
                      role="option"
                      aria-selected={active}
                      className={`ls-custom-select-option ${
                        active ? 'is-selected' : ''
                      } ${highlighted ? 'is-highlighted' : ''}`}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      onClick={() => chooseOption(option.value)}
                    >
                      <span>{option.label}</span>

                      {active && (
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
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
