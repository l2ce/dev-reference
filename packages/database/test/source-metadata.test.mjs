import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { sourceMetadata, sourceSchema } from '../dist/source.js';
import { convertSourceV14 } from '../scripts/source-v14.mjs';

const commit = '0123456789abcdef0123456789abcdef01234567';

test('единый Source содержит только UUID, HTTP(S)-URL, заголовок и необязательный summary', () => {
  const source = {
    id: randomUUID(),
    url: 'https://example.org/reference',
    title: 'Источник',
  };
  assert.deepEqual(sourceSchema.parse(source), source);
  for (const extra of [
    { method: 'implementation' },
    { locator: 'line 1' },
    { description: [] },
    { revision: null },
    { commit },
    { summary: null },
    { summary: ' ' },
    { url: 'javascript:alert(1)' },
  ]) {
    assert.equal(
      sourceSchema.safeParse({ ...source, ...extra }).success,
      false,
    );
  }
});

test('из закреплённых GitHub, raw GitHub и GitLab URL извлекаются репозиторий, файл, commit и строки', () => {
  assert.deepEqual(
    sourceMetadata(
      `https://github.com/owner/project/blob/${commit}/src/KeyPacket.ts#L3-L19`,
    ),
    {
      host: 'github.com',
      provider: 'github',
      repository: 'owner/project',
      project: 'project',
      repositoryUrl: 'https://github.com/owner/project',
      commit,
      filePath: 'src/KeyPacket.ts',
      fileName: 'KeyPacket.ts',
      lineStart: 3,
      lineEnd: 19,
    },
  );
  const gitlab = sourceMetadata(
    `https://gitlab.com/group/subgroup/project/-/blob/${commit}/src/%D1%84%D0%B0%D0%B9%D0%BB.ts#L7-11`,
  );
  assert.equal(gitlab.repository, 'group/subgroup/project');
  assert.equal(gitlab.fileName, 'файл.ts');
  assert.equal(gitlab.lineEnd, 11);
  const raw = sourceMetadata(
    `https://raw.githubusercontent.com/owner/project/${commit}/src/KeyPacket.ts`,
  );
  assert.equal(raw.repositoryUrl, 'https://github.com/owner/project');
  assert.equal(raw.commit, commit);
  assert.equal(raw.lineStart, null);
  const sha256 = sourceMetadata(
    `https://github.com/owner/project/blob/${'a'.repeat(64)}/file#L1`,
  );
  assert.equal(sha256.commit, 'a'.repeat(64));
  assert.equal(sha256.lineEnd, 1);
});

test('ветки, короткие SHA, неизвестные хостинги и обычные страницы не получают выдуманных метаданных', () => {
  for (const ref of [
    'main',
    'master',
    'feature/with/slashes',
    'v1.0',
    commit.slice(0, 7),
  ]) {
    const metadata = sourceMetadata(
      `https://github.com/owner/project/blob/${ref}/file.ts`,
    );
    assert.equal(metadata.repository, 'owner/project');
    assert.equal(metadata.commit, null);
    assert.equal(metadata.filePath, null);
  }
  const external = sourceMetadata(
    `https://git.example.org/group/repo/-/blob/${commit}/file.ts`,
  );
  assert.equal(external.host, 'git.example.org');
  assert.equal(external.provider, null);
  assert.equal(external.filePath, null);
  assert.equal(
    sourceMetadata('https://github.com/features/actions').repository,
    null,
  );
  assert.equal(
    sourceMetadata('https://la2kings.ru/la2bot/packets.html').fileName,
    null,
  );
  assert.equal(sourceMetadata('not a URL'), null);
  assert.equal(sourceMetadata('file:///etc/passwd'), null);
  assert.equal(
    sourceMetadata(
      `https://github.com/owner/project/blob/${commit}/file#L19-L3`,
    ).lineStart,
    null,
  );
  assert.equal(
    sourceMetadata(`https://github.com/owner/project/blob/${commit}/%FF`)
      .commit,
    null,
  );
});

test('конверсия источника сохраняет UUID и пояснения, переносит однозначные строки в URL', () => {
  const original = {
    id: randomUUID(),
    title: 'Источник',
    summary: 'Краткое описание',
    description: ['  Дополнение  ', '', '{{literal}}'],
    locator: 'KeyPacket, строки 3–19: поля ответа.',
    method: 'implementation',
    revision: commit,
    url: `https://gitlab.com/owner/project/-/blob/${commit}/file.ts`,
  };
  const before = structuredClone(original);
  const source = convertSourceV14(original);
  assert.equal(source.id, original.id);
  assert.equal(source.url, `${original.url}#L3-19`);
  assert.equal(
    source.summary,
    'Краткое описание\n\nKeyPacket, строки 3–19: поля ответа.\n\n  Дополнение  \n\n{{literal}}',
  );
  assert.deepEqual(original, before);
  const multiple = convertSourceV14({
    ...original,
    locator: 'lines 1–2; lines 7–8',
  });
  assert.equal(multiple.url, original.url);
  const anchored = convertSourceV14({
    ...original,
    url: `${original.url}#L22`,
  });
  assert.equal(anchored.url, `${original.url}#L22`);
  const unknown = convertSourceV14({
    ...original,
    url: 'https://example.org/file',
    revision: 'release-tag',
  });
  assert.ok(unknown.summary.includes('Revision: release-tag'));
  assert.ok(
    convertSourceV14({ ...original, revision: 'release-tag' }).summary.includes(
      'Revision: release-tag',
    ),
  );
  assert.throws(
    () => convertSourceV14({ ...original, revision: 'a'.repeat(40) }),
    /conflicts/,
  );
});
