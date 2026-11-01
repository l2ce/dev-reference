import assert from 'node:assert/strict'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import { COLOR_PREFERENCE_SCRIPT, COLOR_PREFERENCE_SHEET } from '../src/ui/themes/config/color-preference'

test('сохранённая тема применяется bootstrap до React без изменения DOM-атрибутов', () => {
  for (const value of ['light', 'dark']) {
    const calls: unknown[] = []
    runInNewContext(COLOR_PREFERENCE_SCRIPT, {
      localStorage: { getItem: () => value },
      document: {
        getElementById: (id: string) => {
          assert.equal(id, COLOR_PREFERENCE_SHEET)
          return {
            sheet: {
              cssRules: [
                {
                  style: {
                    setProperty: (...args: unknown[]) => calls.push(args)
                  }
                }
              ]
            }
          }
        }
      }
    })
    assert.deepEqual(calls, [['color-scheme', value, 'important']])
  }
})

test('недоступный storage и неизвестная тема сохраняют системную палитру', () => {
  for (const value of [null, 'auto', 'invalid']) {
    let touched = false
    runInNewContext(COLOR_PREFERENCE_SCRIPT, {
      localStorage: { getItem: () => value },
      document: {
        getElementById: () => {
          touched = true
          return null
        }
      }
    })
    assert.equal(touched, false)
  }
  assert.doesNotThrow(() =>
    runInNewContext(COLOR_PREFERENCE_SCRIPT, {
      localStorage: {
        getItem: () => {
          throw new Error('Storage disabled')
        }
      }
    })
  )
})
