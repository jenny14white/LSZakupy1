import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Logo from '../shared/Logo';

export default function PublicHeader() {
  const { t } = useTranslation();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkScreen = () => setIsMobile(window.innerWidth <= 768);
    checkScreen();
    window.addEventListener('resize', checkScreen);
    return () => window.removeEventListener('resize', checkScreen);
  }, []);

  const introContent = (
    <>
      <p>
        <strong>🛒 {t('shopping.header.introTitle')}</strong>{' '}
        {t('shopping.header.intro1')}
      </p>
      <p>{t('shopping.header.intro2')}</p>
      <p>{t('shopping.header.intro3')}</p>
      <p>
        <strong>📋 {t('shopping.header.currentListTitle')}</strong>{' '}
        {t('shopping.header.intro4')}
      </p>
      <p className="intro-footer">💙 {t('shopping.header.footer')}</p>
    </>
  );

  return (
    <>
      <Logo />
      <h1>{t('shopping.header.title')}</h1>
      {isMobile ? (
        <details className="intro-box intro-mobile">
          <summary>🛒 {t('shopping.header.summary')}</summary>
          {introContent}
        </details>
      ) : (
        <div className="intro-box">{introContent}</div>
      )}
    </>
  );
}
