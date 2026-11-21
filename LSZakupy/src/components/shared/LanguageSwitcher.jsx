import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import '../../styles/switchers.css';

const LANGUAGES = [
  { id: 'pl', name: 'Polski', flag: '🇵🇱' },
  { id: 'en', name: 'English', flag: '🇬🇧' },
  { id: 'uk', name: 'Українська', flag: '🇺🇦' },
];

export default function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const current =
    LANGUAGES.find((item) => item.id === language) || LANGUAGES[0];

  function handleLanguageChange(id) {
    setLanguage(id);
    setOpen(false);
  }

  return (
    <div className="language-switcher" ref={menuRef}>
      <button
        type="button"
        className="language-button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-label="Wybierz język"
      >
        <span>{current.flag}</span>
        <span>{current.id === 'uk' ? 'UA' : current.id.toUpperCase()}</span>
        <span>▼</span>
      </button>
      {open && (
        <div className="language-menu">
          {LANGUAGES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`language-option${
                item.id === language ? ' active' : ''
              }`}
              onClick={() => handleLanguageChange(item.id)}
            >
              <span>{item.flag}</span>
              <span>{item.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
