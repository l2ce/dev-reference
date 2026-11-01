import type { KnowledgeNavigationProps } from '../../../types/knowledge-navigation-props.type'

/**
 * Навигационное содержимое общей боковой панели и мобильного диалога.
 */
export interface NavigationContentProps extends KnowledgeNavigationProps {
  /* Текущий путь Next.js без basePath. */
  readonly pathname: string
  /* Закрывает мобильную панель после выбора ссылки; на desktop отсутствует. */
  readonly onNavigate?: () => void
}
