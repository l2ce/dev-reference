import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseContributors } from '../src/domains/contributors/adapters/parse-contributors'

test('список участников содержит профили людей и доверенные адреса GitHub', () => {
  const contributors = parseContributors([
    { type: 'User', id: 42, login: 'reference-author', html_url: 'https://unrelated.example/' },
    { type: 'Bot', id: 43, login: 'automation[bot]' },
    { type: 'Anonymous', name: 'Anonymous author' }
  ])

  assert.deepEqual(contributors, [
    {
      id: 42,
      login: 'reference-author',
      profileUrl: 'https://github.com/reference-author',
      avatarUrl: 'https://avatars.githubusercontent.com/u/42?s=80'
    }
  ])
})

test('пустой ответ отличается от нарушения контракта GitHub', () => {
  assert.deepEqual(parseContributors([]), [])
  assert.throws(() => parseContributors({ message: 'API rate limit exceeded' }))
  assert.throws(() => parseContributors([null]))
  assert.throws(() => parseContributors([{ id: 42, login: 'author' }]))
})

test('неполный профиль и небезопасный логин не попадают на страницу', () => {
  assert.throws(() => parseContributors([{ type: 'User', login: 'author' }]))
  assert.throws(() => parseContributors([{ type: 'User', id: -1, login: 'author' }]))
  assert.throws(() => parseContributors([{ type: 'User', id: 42, login: '../another/path' }]))
})
