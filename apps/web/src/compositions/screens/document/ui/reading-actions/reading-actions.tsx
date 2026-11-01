import { Button } from '@mantine/core';
import Link from 'next/link';
import { useState } from 'react';
import type { JSX } from 'react';
import { useLocationQuery } from 'infra/browser-location/client';
import { readingMessages } from './config/messages';
import type { ReadingActionsProps } from './types/reading-actions-props.type';
import styles from './styles/reading-actions.module.css';

/**
 * Возвращает к сохранённому поиску и позволяет поделиться текущим документом.
 *
 * Используется для:
 *  - продолжения просмотра списка после чтения
 *  - копирования канонической ссылки без служебных параметров списка
 */
export const ReadingActions = ({
  locale,
  sectionHref,
}: ReadingActionsProps): JSX.Element => {
  const search = useLocationQuery();
  const [feedback, setFeedback] = useState('');
  const messages = readingMessages[locale];
  const list = new URLSearchParams(
    new URLSearchParams(search).get('list') ?? '',
  );
  const safeParams = new URLSearchParams();
  for (const key of ['q', 'server', 'direction', 'page']) {
    const value = list.get(key);
    if (value !== null) {
      safeParams.set(key, value);
    }
  }
  const listQuery = safeParams.toString();
  const href = listQuery === '' ? sectionHref : `${sectionHref}?${listQuery}`;

  /**
   * Копирует текущий URL с basePath и якорем, сообщая результат пользователю.
   */
  const handleCopy = async (): Promise<void> => {
    try {
      const url = new URL(window.location.href);
      url.search = '';
      await navigator.clipboard.writeText(url.href);
      setFeedback(messages.copied);
    } catch {
      setFeedback(messages.failed);
    }
  };

  return (
    <div className={styles.root}>
      <div className={styles.actions}>
        <Link href={href}>← {messages.back}</Link>
        <Button variant="subtle" size="xs" onClick={handleCopy}>
          {messages.copy}
        </Button>
      </div>
      <p className={styles.feedback} role="status">
        {feedback}
      </p>
    </div>
  );
};
