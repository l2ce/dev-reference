import cl from 'clsx';
import type { JSX } from 'react';
import { getProtocolCatalog } from 'domains/reference/server';
import { ProtocolBrowser } from 'compositions/widgets/protocol-browser/client';
import { catalogMessages } from './config/messages';
import type { CatalogScreenProps } from './types/catalog-screen-props.type';
import styles from './styles/catalog.module.css';

/**
 * Показывает полный каталог с локальным поиском по подготовленным данным.
 *
 * Используется для:
 *  - выбора профиля из статически отрендеренного каталога
 */
export const CatalogScreen = (props: CatalogScreenProps): JSX.Element => {
  const { locale, className, ...rootAttrs } = props;
  const messages = catalogMessages[locale];
  const protocolsData = getProtocolCatalog(locale);

  return (
    <section {...rootAttrs} className={cl(styles.root, className)}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>{messages.eyebrow}</p>
        <h1 className={styles.title}>{messages.title}</h1>
        <p className={styles.description}>{messages.description}</p>
      </header>
      <ProtocolBrowser locale={locale} protocols={protocolsData} />
    </section>
  );
};
