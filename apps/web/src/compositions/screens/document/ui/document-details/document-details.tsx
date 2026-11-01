import cl from 'clsx';
import type { JSX } from 'react';
import { isEmptyArray } from 'shared/lib/value-predicates';
import { documentMessages } from '../../config/messages';
import type { DocumentDetailsProps } from './types/document-details-props.type';
import styles from './styles/document-details.module.css';

/**
 * Показывает источники, на которых основан прочитанный материал.
 *
 * Используется для:
 *  - проверки утверждений по закреплённым источникам
 */
export const DocumentDetails = ({
  document: documentData,
  sources: sourceItems,
  locale,
  className,
  ...rootAttrs
}: DocumentDetailsProps): JSX.Element => {
  const messages = documentMessages[locale];
  const hasNoSources = isEmptyArray(sourceItems);
  return (
    <aside {...rootAttrs} className={cl(styles.root, className)}>
      <h2 className={styles.title} id="sources">
        {messages.sources}
      </h2>
      {hasNoSources && <p className={styles.empty}>{messages.noSources}</p>}
      <ol className={styles.sources}>
        {sourceItems.map((source) => (
          <li key={source.id}>
            <a href={source.url} rel="noreferrer">
              {source.title}
              <span aria-hidden="true"> ↗</span>
            </a>
            <p>{source.summary}</p>
          </li>
        ))}
      </ol>
      <p className={styles.revision}>
        {messages.revision}:{' '}
        <code>{documentData.revisionKey ?? messages.unknown}</code>
      </p>
    </aside>
  );
};
