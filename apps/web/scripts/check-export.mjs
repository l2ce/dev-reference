import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../out', import.meta.url))
const { basePath } = JSON.parse(readFileSync(resolve(root, '_site.json'), 'utf8'))

/**
 * Перечисляет готовые HTML-страницы артефакта.
 */
function htmlFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = resolve(directory, entry.name)
    if (entry.isDirectory()) return htmlFiles(file)
    return entry.name.endsWith('.html') ? [file] : []
  })
}

const files = htmlFiles(root)
assert.ok(existsSync(resolve(root, '404.html')), 'Экспорт должен содержать 404.html')
for (const file of files) {
  assert.ok(!file.includes('/__empty__/'), `${file}: технический маршрут не должен публиковаться`)
  const source = readFileSync(file, 'utf8')
  assert.ok(
    source.indexOf('id="l2ce-theme-bootstrap"') < source.indexOf('<body'),
    `${file}: тема должна восстанавливаться до body`
  )
  assert.match(source, /id="l2ce-color-preference"/, `${file}: отсутствует раннее правило темы`)
  const html = readFileSync(file, 'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '')
  assert.match(html, /<h1[ >]/, `${file}: отсутствует содержимое первого рендера`)
  assert.match(html, /<meta name="color-scheme" content="light dark"/, `${file}: нет раннего объявления системной темы`)
  assert.doesNotMatch(
    html.match(/<html\b[^>]*>/)?.[0] ?? '',
    /data-mantine-color-scheme="light"/,
    `${file}: начальный HTML принудительно включает светлую схему`
  )
  for (const match of html.matchAll(/(?:href|src)="(\/[^"#?]*)/g)) {
    const url = match[1]
    assert.ok(url.startsWith(`${basePath}/`), `${file}: URL вне basePath: ${url}`)
    const target = resolve(root, `.${decodeURIComponent(url.slice(basePath.length))}`)
    assert.ok(existsSync(target), `${file}: ссылка на отсутствующий файл ${url}`)
  }
}
assert.doesNotMatch(
  readFileSync(resolve(root, 'sitemap.xml'), 'utf8'),
  /__empty__/,
  'Технический маршрут попал в sitemap'
)
for (const locale of ['ru', 'en']) {
  const directory = locale === 'en' ? root : resolve(root, locale)
  const html = readFileSync(resolve(directory, 'index.html'), 'utf8')
  assert.ok(html.includes(`lang="${locale}"`), `Неверный html lang: ${locale}`)
  assert.ok(existsSync(resolve(directory, 'index.txt')), `Нет статических данных навигации: ${locale}`)
}
console.log(`Статический экспорт: проверено HTML-страниц — ${files.length}, basePath — ${basePath || '/'}.`)
