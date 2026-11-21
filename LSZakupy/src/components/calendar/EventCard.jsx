import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
  addToGoogle,
  addToApple,
  addToOutlook,
} from '../../utils/calendarExport';

const EVENT_TYPES = {
  company: 'company',
  firma: 'company',
  holiday: 'holiday',
  święto: 'holiday',
  birthday: 'birthday',
  urodziny: 'birthday',
  meeting: 'meeting',
  spotkanie: 'meeting',
  vacation: 'vacation',
  urlop: 'vacation',
  other: 'other',
  inne: 'other',
};

const MENU_WIDTH = 190;
const MENU_GAP = 10;
const VIEWPORT_GAP = 12;

const MENU_OPTIONS = [
  { label: 'Google Calendar', action: addToGoogle },
  { label: 'Apple Calendar', action: addToApple },
  { label: 'Outlook', action: addToOutlook },
];

function safeText(value, language) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);

  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? ''
      : value.toLocaleDateString(language);
  }

  if (typeof value?.toDate === 'function') {
    const date = value.toDate();

    return date instanceof Date && !Number.isNaN(date.getTime())
      ? date.toLocaleDateString(language)
      : '';
  }

  return '';
}

function normalizeDate(value) {
  if (value == null || value === '') return null;

  let date;

  if (typeof value?.toDate === 'function') {
    date = value.toDate();
  } else if (value instanceof Date) {
    date = new Date(value.getTime());
  } else if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);

    date = new Date(year, month - 1, day);

    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }
  } else {
    date = new Date(value);
  }

  return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
}

function formatDate(value, language) {
  const date = normalizeDate(value);

  if (!date) return '';

  return date.toLocaleDateString(language || 'pl-PL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatTime(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  return '';
}

function getThemeColors() {
  const styles = getComputedStyle(document.documentElement);

  const getColor = (name, fallback) => {
    const value = styles.getPropertyValue(name).trim();
    return value || fallback;
  };

  const card = getColor('--card', '#ffffff');
  const text = getColor('--text', '#172033');
  const accent = getColor('--accent', '#c99a42');
  const hover = getColor('--surface-hover', card);
  const border = getColor('--border', accent);

  return {
    card,
    text,
    accent,
    hover,
    border,
  };
}

export default function EventCard({ event }) {
  const { t, i18n } = useTranslation();

  const language = i18n.language || 'pl-PL';

  const buttonRef = useRef(null);
  const menuRef = useRef(null);

  const [showMenu, setShowMenu] = useState(false);

  const [menuPosition, setMenuPosition] = useState({
    top: 0,
    left: 0,
    visibility: 'hidden',
  });

  const [menuColors, setMenuColors] = useState({
    card: '#ffffff',
    text: '#172033',
    accent: '#c99a42',
    hover: '#f3f4f6',
    border: '#e5e7eb',
  });

  useLayoutEffect(() => {
    if (!showMenu || !buttonRef.current || !menuRef.current) return;

    function updateMenuPosition() {
      const button = buttonRef.current;
      const menu = menuRef.current;

      if (!button || !menu) return;

      const buttonRect = button.getBoundingClientRect();
      const menuRect = menu.getBoundingClientRect();

      const width = menuRect.width || MENU_WIDTH;
      const height = menuRect.height;

      const left = Math.max(
        VIEWPORT_GAP,
        Math.min(
          buttonRect.right - width,
          window.innerWidth - width - VIEWPORT_GAP
        )
      );

      const spaceBelow = window.innerHeight - buttonRect.bottom;
      const spaceAbove = buttonRect.top;

      const openAbove =
        spaceBelow < height + MENU_GAP + VIEWPORT_GAP &&
        spaceAbove > spaceBelow;

      const top = openAbove
        ? Math.max(VIEWPORT_GAP, buttonRect.top - height - MENU_GAP)
        : Math.min(
            buttonRect.bottom + MENU_GAP,
            window.innerHeight - height - VIEWPORT_GAP
          );

      setMenuPosition({
        top: Math.max(VIEWPORT_GAP, top),
        left,
        visibility: 'visible',
      });
    }

    updateMenuPosition();

    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);

    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [showMenu]);

  useEffect(() => {
    if (!showMenu) return;

    function handlePointerDown(e) {
      if (
        !buttonRef.current?.contains(e.target) &&
        !menuRef.current?.contains(e.target)
      ) {
        setShowMenu(false);
      }
    }

    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        setShowMenu(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showMenu]);

  useEffect(() => {
    if (!showMenu) return;

    const updateColors = () => {
      setMenuColors(getThemeColors());
    };

    updateColors();

    const observer = new MutationObserver(updateColors);

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme', 'style'],
    });

    if (document.body) {
      observer.observe(document.body, {
        attributes: true,
        attributeFilter: ['class', 'data-theme', 'style'],
      });
    }

    return () => observer.disconnect();
  }, [showMenu]);

  const title = safeText(event.title, language);

  const type =
    EVENT_TYPES[safeText(event.type, language).toLowerCase()] || 'other';

  const emoji = safeText(event.emoji, language);
  const time = formatTime(event.time);
  const endTime = formatTime(event.endTime);
  const location = safeText(event.location, language);
  const description = safeText(event.description, language);

  const startDate = normalizeDate(event.date);
  const endDate = normalizeDate(event.endDate);

  const formattedStartDate = formatDate(startDate, language);
  const formattedEndDate = formatDate(endDate, language);

  const isMultiDay = Boolean(
    startDate &&
      endDate &&
      (startDate.getFullYear() !== endDate.getFullYear() ||
        startDate.getMonth() !== endDate.getMonth() ||
        startDate.getDate() !== endDate.getDate())
  );

  const formattedDate =
    isMultiDay && formattedEndDate
      ? `${formattedStartDate} – ${formattedEndDate}`
      : formattedStartDate;

  const formattedTime = time && endTime ? `${time} – ${endTime}` : time;

  const badge = t(`calendar.eventTypes.${type}`);

  function handleExport(exportFunction) {
    setShowMenu(false);
    exportFunction(event);
  }

  function toggleMenu() {
    if (!showMenu) {
      setMenuColors(getThemeColors());

      setMenuPosition({
        top: 0,
        left: 0,
        visibility: 'hidden',
      });
    }

    setShowMenu((previous) => !previous);
  }

  const menu = showMenu ? (
    <div
      ref={menuRef}
      className="calendar-add-menu calendar-add-menu-portal"
      role="menu"
      aria-label="Dodaj do kalendarza"
      style={{
        position: 'fixed',
        top: menuPosition.top,
        left: menuPosition.left,
        right: 'auto',
        bottom: 'auto',
        zIndex: 2147483647,
        display: 'flex',
        flexDirection: 'column',
        width: MENU_WIDTH,
        minWidth: 0,
        maxWidth: `calc(100vw - ${VIEWPORT_GAP * 2}px)`,
        margin: 0,
        padding: 6,
        overflow: 'hidden',
        border: `1px solid ${menuColors.accent}`,
        borderRadius: 12,
        background: menuColors.card,
        backgroundImage: 'none',
        color: menuColors.text,
        opacity: 1,
        visibility: menuPosition.visibility,
        backdropFilter: 'none',
        WebkitBackdropFilter: 'none',
        boxShadow: '0 14px 35px rgba(0, 0, 0, 0.35)',
        transform: 'none',
        isolation: 'isolate',
      }}
    >
      {MENU_OPTIONS.map(({ label, action }, index) => (
        <button
          key={label}
          type="button"
          role="menuitem"
          onClick={() => handleExport(action)}
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            width: '100%',
            minHeight: 42,
            padding: '10px 12px',
            border: 0,
            borderTop: index === 0 ? 'none' : `1px solid ${menuColors.border}`,
            borderRadius: 8,
            background: menuColors.card,
            backgroundImage: 'none',
            color: menuColors.text,
            fontFamily: 'inherit',
            fontSize: 13,
            fontWeight: 600,
            lineHeight: 1.4,
            textAlign: 'left',
            whiteSpace: 'normal',
            opacity: 1,
            cursor: 'pointer',
            transition: 'background 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = menuColors.hover;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = menuColors.card;
          }}
          onFocus={(e) => {
            e.currentTarget.style.background = menuColors.hover;
          }}
          onBlur={(e) => {
            e.currentTarget.style.background = menuColors.card;
          }}
        >
          {label}
        </button>
      ))}
    </div>
  ) : null;

  return (
    <article className={`event-card ${type}`}>
      <div className="event-card-header">
        <h3 className="event-title">
          {emoji && <span className="event-emoji">{emoji}</span>}
          {title}
        </h3>

        <div className="event-card-right">
          <span className={`event-badge ${type}`}>{badge}</span>

          <div className="event-card-actions">
            <button
              ref={buttonRef}
              type="button"
              className="calendar-add-button"
              onClick={toggleMenu}
              title="Dodaj do kalendarza"
              aria-label="Dodaj do kalendarza"
              aria-haspopup="menu"
              aria-expanded={showMenu}
            >
              +
            </button>
          </div>
        </div>
      </div>

      <div className="event-divider" />

      <div className="event-card-body">
        {formattedDate && (
          <div className="event-row date">
            <span className="event-icon">📅</span>
            <span className="event-text">{formattedDate}</span>
          </div>
        )}

        {formattedTime && (
          <div className="event-row">
            <span className="event-icon">🕒</span>
            <span className="event-text">{formattedTime}</span>
          </div>
        )}

        {location && (
          <div className="event-row">
            <span className="event-icon">📍</span>
            <span className="event-text">{location}</span>
          </div>
        )}

        {description && <div className="event-description">{description}</div>}
      </div>

      {typeof document !== 'undefined' &&
        menu &&
        createPortal(menu, document.body)}
    </article>
  );
}
