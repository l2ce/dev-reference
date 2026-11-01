'use client';

import { Button, TextInput } from '@mantine/core';
import cl from 'clsx';
import Link from 'next/link';
import { useState } from 'react';
import type { JSX } from 'react';
import { protocolPath, normalizeSearch } from 'domains/reference';
import { isEmptyArray } from 'shared/lib/value-predicates';
import { browserMessages } from './config/messages';
import type { ProtocolBrowserProps } from './types/protocol-browser-props.type';
import styles from './styles/protocol-browser.module.css';

/**
 * Фильтрует готовый каталог без сетевых запросов и скрытого выбора первого профиля.
 *
 * Используется для:
 *  - поиска точной версии по номеру, названию и контексту
 */
export const ProtocolBrowser = (props: ProtocolBrowserProps): JSX.Element => {
  const { protocols, locale, className, ...rootAttrs } = props;
  const [query, setQuery] = useState('');
  const messages = browserMessages[locale];
  const normalizedQuery = normalizeSearch(query.trim());
  const protocolItems = protocols.filter((protocol) =>
    normalizeSearch(
      `${protocol.key} ${protocol.title} ${protocol.summary ?? ''} ${protocol.regions.join(' ')}`,
    ).includes(normalizedQuery),
  );
  const hasNoResults = isEmptyArray(protocolItems);

  return (
    <div {...rootAttrs} className={cl(styles.root, className)}>
      <div className={styles.toolbar}>
        <TextInput
          label={messages.search}
          placeholder={messages.placeholder}
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          size="md"
          className={styles.search}
          classNames={{ input: styles.input }}
        />
        <p className={styles.count} role="status">
          {protocolItems.length} {messages.count}
        </p>
      </div>
      {hasNoResults && (
        <div className={styles.empty}>
          <h3>{messages.empty}</h3>
          <p>{messages.emptyHint}</p>
          <Button variant="light" onClick={() => setQuery('')}>
            {messages.clear}
          </Button>
        </div>
      )}
      <ul className={styles.grid}>
        {protocolItems.map((protocol) => (
          <li key={protocol.key} className={styles.card}>
            <Link
              href={protocolPath(locale, protocol.key)}
              className={styles.link}
            >
              <span className={styles.cardTop}>
                <span className={styles.code}>
                  {messages.protocol} / {protocol.key.replace(/^protocol:/, '')}
                </span>
                <span aria-hidden="true">↗</span>
              </span>
              <h3 className={styles.title}>{protocol.title}</h3>
              <p className={styles.summary}>
                {protocol.summary ?? messages.missing}
              </p>
              <span className={styles.cardBottom}>
                <span>
                  {protocol.documentCount} {messages.documents}
                </span>
                <span className={styles.open}>
                  {messages.open}
                  <span aria-hidden="true"> →</span>
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
};
