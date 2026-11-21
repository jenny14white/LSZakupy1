import { useEffect, useId, useRef, useState } from 'react';
import '../../styles/shared-datepicker.css';

const MONTHS = [
  'styczeń',
  'luty',
  'marzec',
  'kwiecień',
  'maj',
  'czerwiec',
  'lipiec',
  'sierpień',
  'wrzesień',
  'październik',
  'listopad',
  'grudzień',
];

const WEEKDAYS = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'];

function pad(value) {
  return String(value).padStart(2, '0');
}

function toDateString(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}`;
}

function parseDate(value) {
  if (!value || typeof value !== 'string') {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function formatDate(value) {
  const date = parseDate(value);

  if (!date) {
    return '';
  }

  return `${pad(date.getDate())}.${pad(
    date.getMonth() + 1
  )}.${date.getFullYear()}`;
}

function getCalendarDays(year, month) {
  const firstDay = new Date(year, month, 1);
  const offset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const count = Math.ceil((offset + daysInMonth) / 7) * 7;

  return Array.from({ length: count }, (_, index) => {
    const date = new Date(year, month, index - offset + 1);

    return {
      date,
      value: toDateString(date),
      day: date.getDate(),
      outside: date.getMonth() !== month,
    };
  });
}

export default function SharedDatePicker({
  id,
  name,
  label,
  value = '',
  onChange,
  min,
  max,
  required = false,
  disabled = false,
  placeholder = 'Wybierz datę',
  error = '',
  className = '',
}) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const wrapperRef = useRef(null);
  const selectedDate = parseDate(value);

  const [open, setOpen] = useState(false);
  const [visibleDate, setVisibleDate] = useState(selectedDate || new Date());

  const year = visibleDate.getFullYear();
  const month = visibleDate.getMonth();
  const today = toDateString(new Date());
  const days = getCalendarDays(year, month);

  useEffect(() => {
    if (open) {
      return;
    }

    const nextDate = parseDate(value);

    if (nextDate) {
      setVisibleDate(nextDate);
    }
  }, [value, open]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function handlePointerDown(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  function isDisabledDate(dateValue) {
    return Boolean((min && dateValue < min) || (max && dateValue > max));
  }

  function changeMonth(offset) {
    setVisibleDate(new Date(year, month + offset, 1));
  }

  function changeYear(offset) {
    setVisibleDate(new Date(year + offset, month, 1));
  }

  function selectDate(nextValue) {
    if (disabled || isDisabledDate(nextValue)) {
      return;
    }

    if (typeof onChange === 'function') {
      onChange(nextValue);
    }

    setVisibleDate(parseDate(nextValue) || new Date());
    setOpen(false);
  }

  function clearDate() {
    if (required || disabled) {
      return;
    }

    if (typeof onChange === 'function') {
      onChange('');
    }

    setOpen(false);
  }

  function selectToday() {
    if (isDisabledDate(today)) {
      return;
    }

    selectDate(today);
  }

  function toggleCalendar() {
    if (disabled) {
      return;
    }

    if (!open) {
      setVisibleDate(selectedDate || new Date());
    }

    setOpen((previous) => !previous);
  }

  return (
    <div
      ref={wrapperRef}
      className={`shared-date-picker ${open ? 'is-open' : ''} ${
        disabled ? 'is-disabled' : ''
      } ${error ? 'has-error' : ''} ${className}`}
    >
      {label && (
        <label className="shared-date-picker-label" htmlFor={inputId}>
          {label}
          {required && <span className="shared-date-picker-required"> *</span>}
        </label>
      )}

      <div className="shared-date-picker-control">
        <input
          id={inputId}
          name={name}
          type="text"
          className="shared-date-picker-input"
          value={formatDate(value)}
          placeholder={placeholder}
          readOnly
          required={required}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={toggleCalendar}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              toggleCalendar();
            }
          }}
        />

        <button
          type="button"
          className="shared-date-picker-trigger"
          onClick={toggleCalendar}
          disabled={disabled}
          aria-label="Otwórz kalendarz"
          aria-expanded={open}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M7 3v4M17 3v4M3 10h18" />
          </svg>
        </button>
      </div>

      {error && (
        <span className="shared-date-picker-error" role="alert">
          {error}
        </span>
      )}

      {open && !disabled && (
        <div
          className="shared-date-picker-popover"
          role="dialog"
          aria-label="Wybierz datę"
        >
          <div className="shared-date-picker-header">
            <div className="shared-date-picker-heading">
              <span className="shared-date-picker-month">{MONTHS[month]}</span>
              <span className="shared-date-picker-year">{year}</span>
            </div>

            <div className="shared-date-picker-navigation">
              <button
                type="button"
                onClick={() => changeYear(-1)}
                aria-label="Poprzedni rok"
                title="Poprzedni rok"
              >
                «
              </button>

              <button
                type="button"
                onClick={() => changeMonth(-1)}
                aria-label="Poprzedni miesiąc"
                title="Poprzedni miesiąc"
              >
                ‹
              </button>

              <button
                type="button"
                onClick={() => changeMonth(1)}
                aria-label="Następny miesiąc"
                title="Następny miesiąc"
              >
                ›
              </button>

              <button
                type="button"
                onClick={() => changeYear(1)}
                aria-label="Następny rok"
                title="Następny rok"
              >
                »
              </button>
            </div>
          </div>

          <div className="shared-date-picker-weekdays">
            {WEEKDAYS.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>

          <div className="shared-date-picker-days">
            {days.map((day) => {
              const isSelected = day.value === value;
              const isToday = day.value === today;
              const isUnavailable = isDisabledDate(day.value);

              return (
                <button
                  key={day.value}
                  type="button"
                  className={[
                    'shared-date-picker-day',
                    day.outside ? 'is-outside' : '',
                    isSelected ? 'is-selected' : '',
                    isToday ? 'is-today' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  disabled={isUnavailable}
                  aria-label={formatDate(day.value)}
                  aria-pressed={isSelected}
                  onClick={() => selectDate(day.value)}
                >
                  {day.day}
                </button>
              );
            })}
          </div>

          <div className="shared-date-picker-footer">
            <button
              type="button"
              className="shared-date-picker-clear"
              onClick={clearDate}
              disabled={required}
            >
              Wyczyść
            </button>

            <button
              type="button"
              className="shared-date-picker-today"
              onClick={selectToday}
              disabled={isDisabledDate(today)}
            >
              Dzisiaj
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
