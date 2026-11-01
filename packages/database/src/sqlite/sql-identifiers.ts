/**
 * Экранирует физическое имя из каталога SQLite для служебного SQL и табличного обмена.
 * Предметные запросы используют типизированные колонки Drizzle вместо строковых имён.
 */
export function identifier(name: string): string {
  return `"${name.replaceAll('"', '""')}"`
}
