import { Button, Drawer } from '@mantine/core';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import type { JSX } from 'react';
import {
  KNOWLEDGE_SECTIONS,
  sectionPath,
  referenceMessages,
  getReferenceLocation,
} from 'domains/reference';
import { useLocationQuery } from 'infra/browser-location/client';
import { navigationMessages } from './config/messages';
import { NavigationContent } from './ui/navigation-content/navigation-content';
import type { KnowledgeNavigationProps } from './types/knowledge-navigation-props.type';
import styles from './styles/knowledge-navigation.module.css';

/**
 * Делает три раздела доступными на любой странице профиля и ширине экрана.
 *
 * Используется для:
 *  - постоянной боковой навигации на компьютере
 *  - мобильного меню и быстрого переключения разделов
 */
export const KnowledgeNavigation = (
  props: KnowledgeNavigationProps,
): JSX.Element => {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const location = getReferenceLocation(pathname);
  const search = useLocationQuery();
  const isUnmapped = new URLSearchParams(search).has('unavailable');
  const messages = navigationMessages[props.locale];
  const labels = referenceMessages[props.locale];
  return (
    <aside className={styles.root}>
      <div className={styles.desktop}>
        <NavigationContent {...props} pathname={pathname} />
      </div>
      <div className={styles.mobile}>
        <Button
          variant="default"
          size="compact-sm"
          onClick={() => setIsOpen(true)}
        >
          {messages.open} <span aria-hidden="true">≡</span>
        </Button>
        <nav className={styles.tabs} aria-label={messages.sections}>
          {KNOWLEDGE_SECTIONS.map((section) => (
            <Link
              key={section.kind}
              href={sectionPath(props.locale, props.protocol, section.kind)}
              data-active={location.kind === section.kind}
            >
              {labels.sections[section.kind]}
            </Link>
          ))}
        </nav>
      </div>
      {isUnmapped && (
        <p className={styles.mobileNotice} role="status">
          {messages.unavailable}
        </p>
      )}
      <Drawer
        opened={isOpen}
        onClose={() => setIsOpen(false)}
        title={messages.protocol}
        size="20rem"
        closeButtonProps={{ 'aria-label': messages.close }}
      >
        <NavigationContent
          {...props}
          pathname={pathname}
          onNavigate={() => setIsOpen(false)}
        />
      </Drawer>
    </aside>
  );
};
