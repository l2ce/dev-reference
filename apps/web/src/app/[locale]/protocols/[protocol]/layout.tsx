import type { ReactElement } from 'react';
import { KnowledgeLayout } from 'compositions/layouts/knowledge/server';
import { requireLocale } from '../../../helpers/route-metadata';
import type {
  ProtocolPageProps,
  LayoutChildren,
} from '../../../types/route-props.type';

/**
 * Подключает постоянный каркас к локализованной ветке протокола.
 */
export default async function ProtocolLayout({
  children,
  params,
}: ProtocolPageProps & LayoutChildren): Promise<ReactElement> {
  const { protocol, locale } = await params;
  return (
    <KnowledgeLayout locale={requireLocale(locale)} protocol={protocol}>
      {children}
    </KnowledgeLayout>
  );
}
