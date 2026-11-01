import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { stripVTControlCharacters } from 'node:util';
import { readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import test from 'node:test';
import {
  cliFile,
  fixture,
  temporaryDirectory,
  tableDirectory,
  fixtureSnapshot,
  articleEntry,
} from './helpers.mjs';

const tableManifest = JSON.parse(
  readFileSync(join(tableDirectory, 'manifest.json'), 'utf8'),
);

/**
 * Запускает собранный мини-CLI в постороннем cwd с раздельными потоками.
 */
function cli(args, cwd) {
  return spawnSync(process.execPath, [cliFile, ...args], {
    cwd,
    encoding: 'utf8',
    timeout: 30_000,
  });
}

test('CLI создаёт базу импортом из другого cwd и отделяет JSON от английского прогресса', async (t) => {
  const directory = await temporaryDirectory(t);
  const database = join(directory, 'database.sqlite');
  const status = cli(['status', '--database', database, '--json'], directory);
  assert.equal(status.status, 0, status.stderr);
  assert.equal(JSON.parse(status.stdout).exists, false);
  const missing = cli(['export', '--database', database], directory);
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /DATABASE_NOT_FOUND/);
  const imported = cli(
    ['import', '--database', database, '--input', tableDirectory, '--json'],
    directory,
  );
  assert.equal(imported.status, 0, imported.stderr);
  assert.equal(
    JSON.parse(imported.stdout).records,
    fixtureSnapshot.entries.length,
  );
  assert.ok(JSON.parse(imported.stdout).durationMs > 0);
  assert.match(imported.stderr, /100%/);
  assert.doesNotMatch(imported.stderr, /\u001b\[/);
  assert.equal(
    imported.stderr.trimEnd().split('\n').length,
    tableManifest.tables.length,
  );
  for (const table of tableManifest.tables) {
    assert.match(
      imported.stderr,
      new RegExp(
        `^${table.name} \\(${table.rows}\\):\\s+\\[#{28}\\] 100%$`,
        'm',
      ),
    );
  }
  assert.doesNotMatch(imported.stderr, /English|Russian|packet-revisions/);
  assert.doesNotMatch(
    imported.stderr,
    /Самый медленный|Общее время|База:|JSON:|\.json/,
  );
  const output = join(directory, 'output');
  const exported = cli(
    ['export', '--database', database, '--output', output, '--json'],
    directory,
  );
  assert.equal(exported.status, 0, exported.stderr);
  assert.equal(
    JSON.parse(exported.stdout).records,
    fixtureSnapshot.entries.length,
  );
  assert.ok(JSON.parse(exported.stdout).durationMs > 0);
  assert.equal(exported.stderr, imported.stderr);
  assert.doesNotMatch(
    imported.stderr + exported.stderr + missing.stderr,
    /[А-Яа-яЁё]/,
  );
});

test('CLI отклоняет неверные команды и параметры без изменения базы', async (t) => {
  const directory = await temporaryDirectory(t);
  for (const args of [
    ['unknown'],
    ['import', '--output', 'data'],
    ['generate', '--json'],
    ['migrate'],
    ['status', '--unknown'],
  ]) {
    const result = cli(args, directory);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /INVALID_ARGUMENT/);
  }
  assert.equal(cli(['--help'], directory).status, 0);
});

test('CLI init создаёт ru/en, apply атомарно сохраняет пакет и защищает ревизию', async (t) => {
  const directory = await temporaryDirectory(t);
  const database = join(directory, 'new.sqlite');
  const initialized = cli(
    ['init', '--database', database, '--json'],
    directory,
  );
  assert.equal(initialized.status, 0, initialized.stderr);
  assert.deepEqual(JSON.parse(initialized.stdout).locales, ['ru', 'en']);
  assert.equal(cli(['init', '--database', database], directory).status, 1);
  const file = join(directory, 'batch.json');
  const entry = articleEntry('from-cli');
  await writeFile(
    file,
    JSON.stringify({ operations: [{ op: 'create', entry }] }),
  );
  const saved = cli(
    ['apply', '--database', database, '--file', file, '--json'],
    directory,
  );
  assert.equal(saved.status, 0, saved.stderr);
  const result = JSON.parse(saved.stdout);
  assert.equal(result.changed, 1);
  const second = articleEntry('rolled-back');
  await writeFile(
    file,
    JSON.stringify({
      ifRevision: result.revision,
      operations: [
        { op: 'create', entry: second },
        { op: 'create', entry },
      ],
    }),
  );
  assert.equal(
    cli(['apply', '--database', database, '--file', file], directory).status,
    1,
  );
  const status = cli(['status', '--database', database, '--json'], directory);
  assert.equal(JSON.parse(status.stdout).entities, 1);
  await writeFile(
    file,
    JSON.stringify({
      ifRevision: '0'.repeat(64),
      operations: [{ op: 'put', entry }],
    }),
  );
  assert.match(
    cli(['apply', '--database', database, '--file', file], directory).stderr,
    /REVISION_CONFLICT/,
  );
});

test(
  'реальный TTY перерисовывает заполняемый прогресс-бар от 0 до 100%',
  { skip: process.platform === 'win32' },
  async (t) => {
    const { directory, path } = await fixture(t);
    const python = `
import fcntl, os, pty, struct, sys, termios
pid, fd = pty.fork()
if pid == 0:
    os.execv(sys.argv[1], sys.argv[1:])
fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack('HHHH', 32, 160, 0, 0))
while True:
    try:
        data = os.read(fd, 65536)
        if not data:
            break
        sys.stdout.buffer.write(data)
    except OSError:
        break
_, status = os.waitpid(pid, 0)
sys.exit(os.waitstatus_to_exitcode(status))
`;
    const probe = spawnSync('python3', ['--version']);
    if (probe.error?.code === 'ENOENT') {
      t.skip('Для интеграционной проверки PTY требуется python3.');
      return;
    }
    for (const args of [
      ['import', '--database', path, '--input', tableDirectory],
      ['export', '--database', path, '--output', join(directory, 'tty-export')],
    ]) {
      const result = spawnSync(
        'python3',
        ['-c', python, process.execPath, cliFile, ...args],
        {
          encoding: 'utf8',
          timeout: 30_000,
          env: {
            ...process.env,
            NO_COLOR: undefined,
            FORCE_COLOR: '1',
            TERM: 'xterm-256color',
          },
        },
      );
      assert.equal(result.status, 0, result.stderr + result.stdout);
      assert.match(result.stdout, /\u001b\[2K/);
      assert.match(result.stdout, /\u001b\[32m/);
      const text = stripVTControlCharacters(result.stdout);
      assert.match(text, /\[-{28}\]\s+0%/);
      assert.match(text, /packets \(4\):\s+\[#{28}\] 100%/);
      assert.doesNotMatch(text, /English|Russian/);
      for (const { name } of tableManifest.tables) {
        assert.match(
          text,
          new RegExp(`${name} \\(\\d+\\):\\s+\\[#{28}\\] 100%`),
        );
      }
      assert.match(
        text,
        /Done: \d+ tables, \d+ rows\.\r?\nCompleted in \d+\.\d{2} seconds\.\r?\n$/,
      );
      assert.doesNotMatch(text, /[А-Яа-яЁё]/);
      assert.doesNotMatch(
        result.stdout,
        /Самый медленный|Общее время|База:|JSON:|\.json/,
      );
      assert.ok((result.stdout.match(/\u001b\[2K/g) ?? []).length > 48);
    }
  },
);
