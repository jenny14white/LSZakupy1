const EVENT_CLASSES = {
  firma: 'company',
  company: 'company',
  święto: 'holiday',
  holiday: 'holiday',
  urodziny: 'birthday',
  birthday: 'birthday',
  spotkanie: 'meeting',
  meeting: 'meeting',
  urlop: 'vacation',
  vacation: 'vacation',
  inne: 'other',
  other: 'other',
};

const IMPORTANT_HOLIDAY_NAMES = [
  'nowy rok',
  'święto trzech króli',
  'objawienie pańskie',
  'wielkanoc',
  'niedziela wielkanocna',
  'poniedziałek wielkanocny',
  'święto pracy',
  'święto konstytucji 3 maja',
  'zielone świątki',
  'zesłanie ducha świętego',
  'boże ciało',
  'wniebowzięcie najświętszej maryi panny',
  'święto wojska polskiego',
  'wszystkich świętych',
  'narodowe święto niepodległości',
  'święto niepodległości',
  'wigilia bożego narodzenia',
  'boże narodzenie',
  'pierwszy dzień świąt bożego narodzenia',
  'drugi dzień świąt bożego narodzenia',
  'drugi dzień bożego narodzenia',
];

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFC')
    .toLocaleLowerCase('pl-PL')
    .trim()
    .replace(/\s+/g, ' ');
}

function getEventClass(type = '') {
  return EVENT_CLASSES[normalizeText(type)] || 'other';
}

function isImportantHoliday(event) {
  if (
    event.isPublicHoliday === true ||
    event.isOfficialHoliday === true ||
    event.isStatutoryHoliday === true ||
    event.isDayOff === true ||
    event.isImportantHoliday === true
  ) {
    return true;
  }

  if (event.isUnusualHoliday === true || event.isUnusual === true) {
    return false;
  }

  const category = normalizeText(
    event.category || event.holidayType || event.source
  );

  if (
    [
      'public',
      'official',
      'statutory',
      'national',
      'fixed',
      'movable',
      'ustawowe',
      'państwowe',
      'oficjalne',
    ].includes(category)
  ) {
    return true;
  }

  if (
    ['unusual', 'nietypowe', 'nietypowe święto', 'special'].includes(category)
  ) {
    return false;
  }

  const title = normalizeText(event.title);

  return IMPORTANT_HOLIDAY_NAMES.some((name) => title === name);
}

function getEventStyleClass(event) {
  const type = getEventClass(event.type);

  if (type !== 'holiday') {
    return type;
  }

  return isImportantHoliday(event)
    ? 'holiday holiday-important'
    : 'holiday holiday-unusual';
}

function getEventPriority(event) {
  const type = getEventClass(event.type);

  if (type === 'holiday' && isImportantHoliday(event)) {
    return 0;
  }

  if (type === 'birthday') {
    return 1;
  }

  if (type === 'company' || type === 'meeting') {
    return 2;
  }

  if (type === 'vacation') {
    return 3;
  }

  if (type === 'holiday') {
    return 4;
  }

  return 5;
}

export default function CalendarDay({
  day,
  isCurrentMonth,
  isToday,
  isSelected,
  isWeekend,
  events = [],
  onClick,
}) {
  const className = [
    'calendar-day',
    !isCurrentMonth && 'outside',
    isToday && 'today',
    isSelected && 'selected',
    isWeekend && 'weekend',
  ]
    .filter(Boolean)
    .join(' ');

  const sortedEvents = [...events].sort(
    (first, second) => getEventPriority(first) - getEventPriority(second)
  );

  const hasImportantHoliday = sortedEvents.some(
    (event) =>
      getEventClass(event.type) === 'holiday' && isImportantHoliday(event)
  );

  const dayClassName = [
    className,
    hasImportantHoliday && 'has-important-holiday',
  ]
    .filter(Boolean)
    .join(' ');

  function handleKeyDown(event) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick(day);
    }
  }

  return (
    <div
      className={dayClassName}
      role="button"
      tabIndex={0}
      onClick={() => onClick(day)}
      onKeyDown={handleKeyDown}
    >
      <div className="calendar-day-number">{day.getDate()}</div>

      {sortedEvents.length > 0 && (
        <>
          <div className="calendar-day-events">
            {sortedEvents.slice(0, 1).map((event, index) => (
              <div
                key={event.id ?? `${event.title}-${index}`}
                className={`calendar-event-bubble ${getEventStyleClass(event)}`}
                title={String(event.title ?? '')}
              >
                <span className="calendar-event-emoji">
                  {event.emoji || '📅'}
                </span>

                <span className="calendar-event-name">{event.title}</span>
              </div>
            ))}

            {sortedEvents.length > 1 && (
              <div className="calendar-event-more">
                +{sortedEvents.length - 1}
              </div>
            )}
          </div>

          <div className="calendar-mobile-dots">
            {sortedEvents.slice(0, 5).map((event, index) => (
              <span
                key={event.id ?? `${event.title}-dot-${index}`}
                className={`calendar-event-dot ${getEventStyleClass(event)}`}
                title={String(event.title ?? '')}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
