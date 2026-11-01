/**
 * Публичный профиль человека, участвующего в развитии справочника.
 */
export type Contributor = {
  /** Постоянный идентификатор GitHub. */
  readonly id: number
  /** Логин участника. */
  readonly login: string
  /** Публичная страница GitHub. */
  readonly profileUrl: string
  /** Аватар с известного хоста GitHub. */
  readonly avatarUrl: string
}
