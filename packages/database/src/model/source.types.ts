/**
 * Производные сведения из ссылки; не сохраняются в JSON и не требуют сетевого доступа.
 * Файл и commit известны только для распознанной ссылки с полным SHA, без угадывания ветки.
 */
export interface SourceMetadata {
  /* Домен URL, включая домен собственного хостинга. */
  readonly host: string
  /* Распознанный публичный хостинг; null для неизвестного домена. */
  readonly provider: 'github' | 'gitlab' | null
  /* Путь владельца и репозитория, включая вложенные группы GitLab; null для обычной страницы. */
  readonly repository: string | null
  /* Название репозитория из последнего сегмента его пути. */
  readonly project: string | null
  /* URL главной страницы репозитория либо null. */
  readonly repositoryUrl: string | null
  /* Полный SHA-1 или SHA-256 из закреплённой ссылки, иначе null. */
  readonly commit: string | null
  /* Путь файла в репозитории; null при неоднозначной или неизвестной ссылке. */
  readonly filePath: string | null
  /* Последняя часть пути файла, без каталогов. */
  readonly fileName: string | null
  /* Первая выделенная строка, начиная с 1; null для неизвестного якоря. */
  readonly lineStart: number | null
  /* Последняя выделенная строка; для одной строки совпадает с lineStart. */
  readonly lineEnd: number | null
}

/**
 * Распознанное положение репозитория и его файла в сегментах URL.
 */
export interface RepositoryRoute {
  /* Хостинг с известной структурой URL. */
  readonly provider: 'github' | 'gitlab'
  /* Сегменты пути репозитория без префикса /. */
  readonly repository: readonly string[]
  /* Базовый URL хостинга репозитория. */
  readonly origin: string
  /* Позиция commit в пути, если URL ведёт на содержимое файла. */
  readonly commitIndex: number | null
}
