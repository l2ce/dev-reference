import assert from 'node:assert/strict'
import test from 'node:test'
import { referenceMarkdownDirectives, renderReferenceMarkdown } from '../dist/markdown.js'

test('Markdown различает хронику и одноимённый релиз и принимает самостоятельные адреса групп', () => {
  const markdown = [
    '{{link chronicle:the-kamael}}',
    '{{link release:the-kamael}}',
    '{{link branch:main}}',
    '{{link saga:the-chaotic-throne}}',
    '{{link region:na}}',
    '{{link protocol:152-rev-1}}'
  ].join('\n\n')
  const directives = referenceMarkdownDirectives(markdown)
  assert.deepEqual(
    directives.map((item) => `${item.kind}:${item.id}`),
    [
      'chronicle:the-kamael',
      'release:the-kamael',
      'branch:main',
      'saga:the-chaotic-throne',
      'region:na',
      'protocol:152-rev-1'
    ]
  )
  const result = renderReferenceMarkdown(markdown, {
    link: (directive) => `[${directive.kind}:${directive.id}](/${directive.kind}/${directive.id}/)`,
    value: () => assert.fail('Не запрошено поле.'),
    include: () => assert.fail('Не запрошена вставка.')
  })
  assert.match(result, /\[chronicle:the-kamael\]\(\/chronicle\/the-kamael\/\)/)
  assert.match(result, /\[release:the-kamael\]\(\/release\/the-kamael\/\)/)
})

test('новые ссылки не разбираются внутри кода; старые вложенные адреса и атрибуты отвергаются', () => {
  assert.deepEqual(referenceMarkdownDirectives('`{{link release:the-kamael}}`'), [])
  for (const markdown of [
    '{{link chronicle:the-kamael:base}}',
    '{{link release:the-kamael server=game}}',
    '{{include region:na}}',
    '{{value saga:the-chaotic-throne field=title}}'
  ])
    assert.throws(() => referenceMarkdownDirectives(markdown))
})
