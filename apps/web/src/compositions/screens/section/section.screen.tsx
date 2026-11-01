import cl from 'clsx';
import Link from 'next/link';
import type { JSX } from 'react';
import { getKnowledgeIndex } from 'domains/reference/server';
import { protocolPath, referenceMessages } from 'domains/reference';
import { SectionBrowser } from 'compositions/screens/section/ui/section-browser/client';
import type { SectionScreenProps } from './types/section-screen-props.type';
import styles from './styles/section.module.css';

/**
 * Открывает самостоятельный раздел материалов выбранного протокола.
 *
 * Используется для:
 *  - поиска и постраничного просмотра статей, сценариев и пакетов
 */
export const SectionScreen = (props: SectionScreenProps): JSX.Element => {
  const { protocol, locale, kind, className, ...rootAttrs } = props;
  const labels = referenceMessages[locale];
  const documentItems = getKnowledgeIndex(protocol, locale).filter(
    (document) => document.kind === kind,
  );

  return (
    <section {...rootAttrs} className={cl(styles.root, className)}>
      <p className={styles.breadcrumb}>
        <Link href={protocolPath(locale, protocol)}>{protocol}</Link>
        <span aria-hidden="true"> / </span>
        {labels.sections[kind]}
      </p>
      <h1 className={styles.title}>{labels.sections[kind]}</h1>
      <p className={styles.description}>{labels.sectionDescriptions[kind]}</p>
      <SectionBrowser
        key={`${protocol}:${kind}:${locale}`}
        documents={documentItems}
        locale={locale}
        kind={kind}
      />
    </section>
  );
};
