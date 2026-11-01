import cl from 'clsx';
import type { JSX } from 'react';
import { footerMessages } from './config/messages';
import type { SiteFooterProps } from './types/site-footer-props.type';
import styles from './styles/site-footer.module.css';

/**
 * Завершает страницу короткой фразой о понимании протокола.
 *
 * Используется для:
 *  - единого локализованного завершения витрины и документации
 */
export const SiteFooter = (props: SiteFooterProps): JSX.Element => {
  const { locale, className, ...rootAttrs } = props;
  const messages = footerMessages[locale];

  return (
    <footer {...rootAttrs} className={cl(styles.root, className)}>
      <p className={styles.message}>{messages.tagline}</p>
    </footer>
  );
};
