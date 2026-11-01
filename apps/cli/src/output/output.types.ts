/**
 * Выбранный формат вывода; человекочитаемый текст используется по умолчанию.
 */
export interface OutputOptions {
  /* Включить единственный JSON-конверт для успеха или ошибки. */
  readonly json: boolean
  /* Добавить отступы к JSON; допустимо только вместе с json. */
  readonly pretty: boolean
}

/**
 * Буферы стандартного вывода Commander до выбора текстового или JSON-представления.
 */
export interface CommanderOutput {
  /* Текст справки или версии, который Commander направил в stdout. */
  stdout: string
  /* Диагностики и подсказки Commander, предназначенные stderr. */
  stderr: string
}
