import { ActionIcon, Menu, Tooltip } from '@mantine/core'
import { IconCheck, IconDeviceDesktop, IconMoon, IconSun } from '@tabler/icons-react'
import { useState } from 'react'
import type { JSX } from 'react'
import { useThemeControls } from 'ui/themes/client'
import { themeMenuMessages } from './config/messages'
import type { ThemeMenuProps } from './types/theme-menu-props.type'
import styles from './styles/theme-menu.module.css'

/**
 * Предлагает явный выбор светлой, тёмной или системной цветовой схемы.
 *
 * Используется для:
 *  - настройки оформления с понятными иконками и отметкой сохранённого режима
 */
export const ThemeMenu = ({ locale }: ThemeMenuProps): JSX.Element => {
  const [isOpen, setIsOpen] = useState(false)
  const { colorScheme, setColorScheme } = useThemeControls()
  const messages = themeMenuMessages[locale]
  const optionItems = [
    { value: 'light', label: messages.light, icon: IconSun },
    { value: 'dark', label: messages.dark, icon: IconMoon },
    { value: 'auto', label: messages.auto, icon: IconDeviceDesktop }
  ] as const
  const ThemeIcon = optionItems.find((option) => option.value === colorScheme)?.icon ?? IconDeviceDesktop

  /**
   * Применяет поддерживаемое значение из радио-группы Mantine.
   */
  const handleThemeChange = (value: string): void => {
    if (value === 'light' || value === 'dark' || value === 'auto') {
      setColorScheme(value)
    }
  }

  return (
    <Menu
      withinPortal={false}
      withInitialFocusPlaceholder={false}
      position="bottom-end"
      width={216}
      offset={8}
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
          <ActionIcon className={styles.root} variant="subtle" color="gray" size={40} aria-label={messages.hint}>
            <ThemeIcon size={20} stroke={1.8} aria-hidden="true" />
          </ActionIcon>
        </Menu.Target>
      </Tooltip>
      <Menu.Dropdown className={styles.dropdown}>
        <Menu.Label className={styles.caption}>{messages.title}</Menu.Label>
        <Menu.RadioGroup value={colorScheme} onChange={handleThemeChange}>
          {optionItems.map((option) => {
            const OptionIcon = option.icon
            const isSelected = colorScheme === option.value
            const autoFocus = isSelected ? true : undefined
            return (
              <Menu.RadioItem
                key={option.value}
                value={option.value}
                className={styles.item}
                classNames={{ itemIndicator: styles.indicator }}
                data-selected={isSelected}
                data-autofocus={autoFocus}
                closeMenuOnClick
                rightSection={isSelected && <IconCheck size={16} stroke={2} aria-hidden="true" />}
              >
                <span className={styles.itemContent}>
                  <OptionIcon size={20} stroke={1.8} aria-hidden="true" />
                  {option.label}
                </span>
              </Menu.RadioItem>
            )
          })}
        </Menu.RadioGroup>
        <p className={styles.note}>{messages.systemNote}</p>
      </Menu.Dropdown>
    </Menu>
  )
}
