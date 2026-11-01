import cl from 'clsx';
import type { JSX } from 'react';
import {
  getKnowledgeIndex,
  getProtocolTargets,
} from 'domains/reference/server';
import { KnowledgeNavigation } from 'compositions/layouts/knowledge/ui/knowledge-navigation/client';
import type { KnowledgeLayoutProps } from './types/knowledge-layout-props.type';
import styles from './styles/knowledge.module.css';

/**
 * Собирает постоянную навигацию протокола и серверное содержимое маршрута.
 *
 * Используется для:
 *  - чтения обзора, самостоятельных разделов и документов одного профиля
 */
export const KnowledgeLayout = (props: KnowledgeLayoutProps): JSX.Element => {
  const { children, protocol, locale, className, ...rootAttrs } = props;
  const documents = getKnowledgeIndex(protocol, locale, false);
  const targets = getProtocolTargets(locale);

  return (
    <div {...rootAttrs} className={cl(styles.root, className)}>
      <KnowledgeNavigation
        documents={documents}
        targets={targets}
        protocol={protocol}
        locale={locale}
      />
      <div className={styles.content}>{children}</div>
    </div>
  );
};
