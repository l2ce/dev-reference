import Link from 'next/link';
import type { JSX } from 'react';
import {
  KNOWLEDGE_SECTIONS,
  sectionPath,
  referenceMessages,
} from 'domains/reference';
import type { KnowledgeSectionsProps } from './types/knowledge-sections-props.type';
import styles from './styles/knowledge-sections.module.css';

/**
 * Предлагает читателю самостоятельно выбрать вид знаний в обзоре протокола.
 *
 * Используется для:
 *  - перехода к самостоятельным каталогам статей, сценариев и пакетов
 */
export const KnowledgeSections = ({
  documents,
  protocol,
  locale,
}: KnowledgeSectionsProps): JSX.Element => {
  const messages = referenceMessages[locale];
  return (
    <div className={styles.root}>
      {KNOWLEDGE_SECTIONS.map((section) => (
        <Link
          key={section.kind}
          className={styles.card}
          href={sectionPath(locale, protocol, section.kind)}
        >
          <span className={styles.top}>
            <span className={styles.count}>
              {documents
                .filter((document) => document.kind === section.kind)
                .length.toString()
                .padStart(2, '0')}
            </span>
            <span aria-hidden="true">↗</span>
          </span>
          <h3>{messages.sections[section.kind]}</h3>
          <p>{messages.sectionDescriptions[section.kind]}</p>
        </Link>
      ))}
    </div>
  );
};
