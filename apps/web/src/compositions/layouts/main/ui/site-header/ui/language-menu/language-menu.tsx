import { Button, Menu, Tooltip, VisuallyHidden } from '@mantine/core'
import { IconCheck, IconChevronDown, IconLanguage } from '@tabler/icons-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import type { JSX } from 'react'
import { useLocationQuery } from 'infra/browser-location/client'
import { changePathLocale } from 'shared/localization'
import { LANGUAGE_OPTIONS, languageMessages } from './config/messages'
import type { LanguageMenuProps } from './types/language-menu-props.type'
import styles from './styles/language-menu.module.css'

/**
 * Переключает язык документации и явно отмечает текущий выбор.
 *
 * Используется для:
 *  - смены языка с сохранением протокола, документа и фильтров
 */
export const LanguageMenu = ({ locale }: LanguageMenuProps): JSX.Element => {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()
  const search = useLocationQuery()
  const messages = languageMessages[locale]
  const optionItems = LANGUAGE_OPTIONS.map((option) => ({
    ...option,
    href: `${changePathLocale(pathname, option.locale)}${search}`,
    isSelected: option.locale === locale,
    autoFocus: option.locale === locale ? true : undefined
  }))

  return (
    <Menu
      withinPortal={false}
      withInitialFocusPlaceholder={false}
      position="bottom-end"
      width={208}
      offset={10}
      opened={isOpen}
      onChange={setIsOpen}
    >
      <Tooltip
        label={messages.hint}
        openDelay={400}
        disabled={isOpen}
        events={{ hover: true, focus: true, touch: false }}
      >
        <Menu.Target>
          <Button className={styles.root} variant="subtle" color="gray" aria-label={messages.hint}>
            <IconLanguage size={18} stroke={1.7} aria-hidden="true" />
            <span className={styles.code}>{locale.toUpperCase()}</span>
            <IconChevronDown className={styles.chevron} size={12} stroke={1.8} aria-hidden="true" />
          </Button>
        </Menu.Target>
      </Tooltip>
      <Menu.Dropdown className={styles.dropdown}>
        <Menu.Label className={styles.caption}>{messages.title}</Menu.Label>
        {optionItems.map((option) => (
          <Menu.Item
            className={styles.item}
            component={Link}
            href={option.href}
            lang={option.locale}
            key={option.locale}
            data-selected={option.isSelected}
            data-autofocus={option.autoFocus}
            leftSection={
              <span className={styles.languageCode} aria-hidden="true">
                {option.code}
              </span>
            }
            rightSection={option.isSelected && <IconCheck size={16} stroke={2} aria-hidden="true" />}
          >
            {option.label}
            {option.isSelected && <VisuallyHidden> · {messages.selected}</VisuallyHidden>}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  )
}
