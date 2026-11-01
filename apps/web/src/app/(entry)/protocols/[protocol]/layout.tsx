import type { ReactElement } from 'react'
import { KnowledgeLayout } from 'compositions/layouts/knowledge/server'
import type { EnglishProtocolPageProps, LayoutChildren } from '../../../types/route-props.type'

/**
 * Подключает постоянный каркас к английской ветке протокола.
 */
export default async function ProtocolLayout({
  children,
  params
}: EnglishProtocolPageProps & LayoutChildren): Promise<ReactElement> {
  return (
    <KnowledgeLayout locale="en" protocol={(await params).protocol}>
      {children}
    </KnowledgeLayout>
  )
}
