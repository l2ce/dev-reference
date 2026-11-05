import { ActionIcon, Checkbox, TextInput, VisuallyHidden } from '@mantine/core'
import { IconSearch, IconX } from '@tabler/icons-react'
import cl from 'clsx'
import type { JSX } from 'react'
import { CONTROLS_MESSAGES } from './config/messages'
import type { CatalogControlsProps } from './types/catalog-controls-props.type'
import styles from './styles/catalog-controls.module.css'

/**
 * Предоставляет компактный поиск и фильтр доступных материалов.
 *
 * Используется для:
 *  - уточнения списка хроник и протоколов
 *  - объявления результатов поиска вспомогательным технологиям
 */
export const CatalogControls = (props: CatalogControlsProps): JSX.Element => {
  const {
    query,
    onlyWithMaterials,
    protocolCount,
    locale,
    onQueryChange,
    onAvailabilityChange,
    className,
    ...rootAttrs
  } = props
  const messages = CONTROLS_MESSAGES[locale]
  const hasQuery = query !== ''

  return (
    <div {...rootAttrs} className={cl(styles.root, className)}>
      <TextInput
        aria-label={messages.search}
        placeholder={messages.placeholder}
        value={query}
        onChange={(event) => onQueryChange(event.currentTarget.value)}
        maxLength={200}
        size="sm"
        classNames={{ input: styles.input }}
        leftSection={<IconSearch size={16} stroke={1.6} aria-hidden="true" />}
        rightSection={
          hasQuery && (
            <ActionIcon variant="subtle" aria-label={messages.clearSearch} onClick={() => onQueryChange('')}>
              <IconX size={16} aria-hidden="true" />
            </ActionIcon>
          )
        }
      />
      <Checkbox
        label={messages.onlyWithMaterials}
        checked={onlyWithMaterials}
        onChange={(event) => onAvailabilityChange(event.currentTarget.checked)}
        size="xs"
        classNames={{ body: styles.checkboxBody, input: styles.checkbox, label: styles.checkboxLabel }}
      />
      <VisuallyHidden role="status" aria-live="polite" aria-atomic="true">
        {messages.protocols}: {protocolCount}
      </VisuallyHidden>
    </div>
  )
}
