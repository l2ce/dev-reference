/**
 * Ошибка API со стабильным кодом, деталями и сохранённой исходной причиной.
 */
export class DatabaseError extends Error {
  /* Машинный код; потребители не должны разбирать локализованный message. */
  readonly code: string;
  /* Адрес, поле, ревизия или другие сведения для исправления запроса. */
  readonly details: unknown;

  /**
   * Создаёт предметную ошибку; cause сохраняет исходный сбой декодирования или I/O.
   */
  constructor(
    code: string,
    message: string,
    details?: unknown,
    cause?: unknown,
  ) {
    super(message, { cause });
    this.name = 'DatabaseError';
    this.code = code;
    this.details = details;
  }
}

/**
 * Проверяет код системного сбоя без утверждения типа непроверенного исключения.
 */
export function hasErrorCode(error: unknown, code: string): boolean {
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    error.code === code
  );
}
