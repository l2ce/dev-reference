import type { ReactElement } from 'react'
import { HomeScreen } from 'compositions/screens/home/server'

/**
 * Показывает стартовую страницу справочника.
 */
export default function HomePage(): ReactElement {
  return <HomeScreen locale="en" />
}
