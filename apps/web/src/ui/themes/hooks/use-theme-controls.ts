import { useMantineColorScheme } from '@mantine/core';

/**
 * Открывает управление общей темой без раскрытия конфигурации провайдера.
 */
export function useThemeControls(): ReturnType<typeof useMantineColorScheme> {
  return useMantineColorScheme();
}
