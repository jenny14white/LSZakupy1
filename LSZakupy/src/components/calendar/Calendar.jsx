import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import CalendarHeader from './CalendarHeader';
import CalendarDay from './CalendarDay';
import EventCard from './EventCard';
import { listenToEvents } from '../../services/calendarService';
import {
  getAllCalendarEvents,
  getEventsForDate,
} from '../../utils/calendarUtils';

export default function Calendar() {
  const { t, i18n } = useTranslation();

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [companyEvents, setCompanyEvents] = useState([]);

  const weekDays = useMemo(
    () => [
      t('calendar.weekdays.mon'),
      t('calendar.weekdays.tue'),
      t('calendar.weekdays.wed'),
      t('calendar.weekdays.thu'),
      t('calendar.weekdays.fri'),
      t('calendar.weekdays.sat'),
      t('calendar.weekdays.sun'),
    ],
    [t]
  );

  useEffect(() => {
    const unsubscribe = listenToEvents(setCompanyEvents);

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  const events = useMemo(() => {
    const year = currentDate.getFullYear();
    const selectedYear = selectedDate.getFullYear();

    const years = new Set([year - 1, year, year + 1, selectedYear]);

    const calendarEvents = [...years].flatMap((itemYear) =>
      getAllCalendarEvents(itemYear)
    );

    const normalizedCompanyEvents = companyEvents.map((event) => ({
      ...event,
      date:
        typeof event.date?.toDate === 'function'
          ? event.date.toDate()
          : event.date,
      endDate:
        typeof event.endDate?.toDate === 'function'
          ? event.endDate.toDate()
          : event.endDate,
    }));

    return [...calendarEvents, ...normalizedCompanyEvents];
  }, [currentDate, selectedDate, companyEvents]);

  function previousMonth() {
    setCurrentDate(
      (date) => new Date(date.getFullYear(), date.getMonth() - 1, 1)
    );
  }

  function nextMonth() {
    setCurrentDate(
      (date) => new Date(date.getFullYear(), date.getMonth() + 1, 1)
    );
  }

  function today() {
    const now = new Date();

    setCurrentDate(now);
    setSelectedDate(now);
  }

  function handleDayClick(day) {
    if (!(day instanceof Date) || Number.isNaN(day.getTime())) {
      return;
    }

    const selected = new Date(day.getTime());

    setSelectedDate(selected);

    if (
      selected.getMonth() !== currentDate.getMonth() ||
      selected.getFullYear() !== currentDate.getFullYear()
    ) {
      setCurrentDate(new Date(selected.getFullYear(), selected.getMonth(), 1));
    }
  }

  const selectedEvents = useMemo(
    () => getEventsForDate(selectedDate, events),
    [selectedDate, events]
  );

  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const offset = (firstDay.getDay() + 6) % 7;
    const start = new Date(year, month, 1 - offset);

    const todayDate = new Date().toDateString();
    const selectedDateString = selectedDate.toDateString();

    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(
        start.getFullYear(),
        start.getMonth(),
        start.getDate() + index
      );

      const jsDay = day.getDay();

      return {
        date: day,
        events: getEventsForDate(day, events),
        isCurrentMonth: day.getMonth() === month && day.getFullYear() === year,
        isToday: day.toDateString() === todayDate,
        isSelected: day.toDateString() === selectedDateString,
        isWeekend: jsDay === 0 || jsDay === 6,
      };
    });
  }, [currentDate, selectedDate, events]);

  return (
    <div className="calendar-wrapper">
      <div className="calendar-layout">
        <section className="calendar-main">
          <CalendarHeader
            currentDate={currentDate}
            onPrev={previousMonth}
            onNext={nextMonth}
            onToday={today}
          />

          <div className="calendar-weekdays">
            {weekDays.map((day, index) => (
              <div key={index} className="calendar-weekday">
                {day}
              </div>
            ))}
          </div>

          <div className="calendar-grid">
            {calendarDays.map((item) => (
              <CalendarDay
                key={`${item.date.getFullYear()}-${item.date.getMonth()}-${item.date.getDate()}`}
                day={item.date}
                events={item.events}
                isToday={item.isToday}
                isCurrentMonth={item.isCurrentMonth}
                isSelected={item.isSelected}
                isWeekend={item.isWeekend}
                onClick={handleDayClick}
              />
            ))}
          </div>
        </section>

        <aside className="calendar-sidebar">
          <h3 className="selected-day">
            {selectedDate.toLocaleDateString(i18n.language || 'pl-PL', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </h3>

          {selectedEvents.length === 0 ? (
            <div className="calendar-empty">
              <h4>{t('calendar.empty.title')}</h4>
              <p>{t('calendar.empty.description')}</p>
            </div>
          ) : (
            selectedEvents.map((event, index) => (
              <EventCard
                key={event.id ?? `${event.title}-${index}`}
                event={event}
              />
            ))
          )}
        </aside>
      </div>
    </div>
  );
}
