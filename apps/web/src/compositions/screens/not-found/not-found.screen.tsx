import cl from 'clsx';
import Link from 'next/link';
import type { JSX } from 'react';
import { notFoundMessages as messages } from './config/messages';
import type { NotFoundScreenProps } from './types/not-found-screen-props.type';
import styles from './styles/not-found.module.css';

/**
 * Помогает продолжить чтение после неизвестного URL.
 *
 * Используется для:
 *  - возврата к каталогу со статической страницы 404
 */
export const NotFoundScreen = (props: NotFoundScreenProps): JSX.Element => {
  const { className, ...rootAttrs } = props;

  return (
    <section {...rootAttrs} className={cl(styles.root, className)}>
      <span className={styles.code}>404</span>
      <h1>{messages.title}</h1>
      <p>{messages.description}</p>
      <Link href="/protocols/">{messages.action}</Link>
      <Link href="/ru/" lang="ru">
        {messages.english}
      </Link>
    </section>
  );
};
