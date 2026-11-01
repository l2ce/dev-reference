import { fileURLToPath } from 'node:url'
import { inspectArchitecture } from './architecture/inspect-architecture.mjs'

const errors = inspectArchitecture(fileURLToPath(new URL('../src', import.meta.url)))
if (errors.length) {
  console.error(errors.join('\n'))
  process.exitCode = 1
} else {
  console.log('Архитектурный граф: фасеты, слои, вложенность, циклы и среды проверены.')
}
