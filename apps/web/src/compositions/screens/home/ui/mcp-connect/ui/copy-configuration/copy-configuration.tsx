import { Button } from '@mantine/core'
import { useClipboard } from '@mantine/hooks'
import { IconCheck, IconCopy } from '@tabler/icons-react'
import cl from 'clsx'
import type { JSX } from 'react'
import { isDefined } from 'shared/lib/value-predicates'
import { COPY_MESSAGES } from './config/messages'
import type { CopyConfigurationProps } from './types/copy-configuration-props.type'
import styles from './styles/copy-configuration.module.css'

/**
 * Копирует конфигурацию MCP и сообщает результат действия.
 *
 * Используется для:
 *  - переноса готового JSON в настройки MCP-клиента
 *  - восстановления после отказа доступа к буферу обмена
 */
export const CopyConfiguration = (props: CopyConfigurationProps): JSX.Element => {
  const { configuration, locale, className } = props
  const clipboard = useClipboard()
  const messages = COPY_MESSAGES[locale]
  const hasError = isDefined(clipboard.error)
  const buttonLabel = clipboard.copied ? messages.copied : messages.copy
  const CopyIcon = clipboard.copied ? IconCheck : IconCopy
  const feedback = hasError ? messages.failed : clipboard.copied ? messages.success : ''

  /**
   * Повторяет попытку копирования, очищая результат предыдущей.
   */
  const handleCopy = (): void => {
    clipboard.reset()
    clipboard.copy(configuration)
  }

  return (
    <div className={cl(styles.root, className)}>
      <Button
        className={cl(styles.button, { [styles._copied]: clipboard.copied })}
        variant="subtle"
        size="compact-xs"
        onClick={handleCopy}
        aria-label={messages.label}
        leftSection={<CopyIcon size={15} stroke={1.6} aria-hidden="true" />}
      >
        {buttonLabel}
      </Button>
      <span className={cl(styles.feedback, { [styles._error]: hasError })} role="status">
        {feedback}
      </span>
    </div>
  )
}
