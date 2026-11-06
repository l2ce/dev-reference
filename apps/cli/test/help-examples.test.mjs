import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import test from 'node:test'
import { createCliProgram } from '../dist/commands/program.js'
import { COMMAND_SPECS } from '../dist/help/catalog.js'
import { commandExamples, workflowExamples } from '../dist/help/examples.js'
import { commandPath, LEGACY_ROOTS, legacyExamples } from '../dist/help/legacy.js'
import { invokeCli } from './support/help-runner.mjs'

const collect = (command) => [command, ...command.commands.flatMap(collect)]

/** Выполняет те же args/stdin/files, которые печатает справка, без отдельного конвертера входа. */
async function executeExample(example, mode, parent) {
  const directory = await mkdtemp(join(parent, `${example.id}-`))
  const database = join(directory, 'example.sqlite')
  const bindings = new Map()
  try {
    for (const [path, content] of Object.entries(example.files ?? {})) {
      await mkdir(dirname(join(directory, path)), { recursive: true })
      await writeFile(join(directory, path), content)
    }
    for (const step of [...example.setup, ...example.steps]) {
      const args = step.args.map((argument) => bindings.get(argument) ?? argument)
      assert.equal(
        args.some((argument) => /^<(version|cursor)>$/.test(argument)),
        false,
        `${example.id}: не получена подстановка`
      )
      const invocation = ['--database', database, ...args, ...(mode === 'json' ? ['--format', 'json'] : [])]
      const result = await invokeCli(invocation, step.stdin, directory)
      assert.equal(
        result.code,
        step.exitCode ?? 0,
        `${example.id}: ${args.join(' ')}\n${result.stderr}\n${result.stdout}`
      )
      if ((step.exitCode ?? 0) === 0) {
        assert.equal(result.stderr, '', `${example.id}: stderr успешного вызова`)
        if (mode === 'json') {
          const envelope = JSON.parse(result.stdout)
          assert.equal(envelope.ok, true)
          for (const [path, expected] of Object.entries(step.expect ?? {})) {
            const actual = path.split('.').reduce((current, part) => current?.[part], envelope)
            assert.deepEqual(actual, bindings.get(expected) ?? expected, `${example.id}: ${path}`)
          }
          if (step.captureVersion) bindings.set('<version>', envelope.meta.version)
          if (step.captureCursor) bindings.set('<cursor>', envelope.meta.page.nextCursor)
          if (step.content !== undefined) assert.equal(envelope.data.content, step.content)
        } else {
          if (step.captureVersion) bindings.set('<version>', /Версия: (v1:[a-f0-9]{64})/.exec(result.stdout)?.[1])
          if (step.captureCursor) bindings.set('<cursor>', /--after ([\w-]+)/.exec(result.stdout)?.[1])
          if (step.content !== undefined) assert.equal(result.stdout, step.content)
        }
      } else if (mode === 'json') assert.equal(JSON.parse(result.stderr).ok, false)
    }
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

test('каждый опубликованный пример нового интерфейса, совместимости и workflow выполняется в text и JSON', async (t) => {
  await mkdir('/tmp/opencode', { recursive: true })
  const parent = await mkdtemp('/tmp/opencode/help-examples-')
  t.after(() => rm(parent, { recursive: true, force: true }))
  const program = createCliProgram({ stdout: '', stderr: '' })
  const examples = COMMAND_SPECS.flatMap((command) =>
    commandExamples(command.id).map((example) => ({ owner: command.id, example }))
  )
  for (const command of collect(program).filter((command) => LEGACY_ROOTS.includes(commandPath(command)[0]))) {
    examples.push(...legacyExamples(command).map((example) => ({ owner: commandPath(command).join('.'), example })))
  }
  for (const name of ['catalog', 'translate', 'research'])
    examples.push(...workflowExamples(name).map((example) => ({ owner: `workflow.${name}`, example })))
  for (const { owner, example } of examples) {
    await t.test(`${owner}/${example.id}`, async () => {
      for (const mode of ['text', 'json']) await executeExample(example, mode, parent)
    })
  }
})

test('типовые примеры create/update/replace и вложенных действий выполняются для всех допустимых типов', async (t) => {
  const { TYPES } = await import('../dist/commands/model.js')
  const { supportsCommandType } = await import('../dist/help/document.js')
  const parent = await mkdtemp('/tmp/opencode/help-types-')
  t.after(() => rm(parent, { recursive: true, force: true }))
  const operations = [
    'create',
    'update',
    'replace',
    'delete',
    'link',
    'unlink',
    'translation.set',
    'translation.delete',
    'source.add',
    'source.update',
    'source.remove',
    'source.clear',
    'question.add',
    'question.remove',
    'question.clear',
    'revision.add'
  ]
  for (const operation of operations)
    for (const collection of Object.keys(TYPES)) {
      if (!supportsCommandType(operation, collection)) continue
      await t.test(`${operation}/${collection}`, async () => {
        for (const example of commandExamples(operation, collection)) await executeExample(example, 'text', parent)
      })
    }
})
