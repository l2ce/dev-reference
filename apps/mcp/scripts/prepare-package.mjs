import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const app = join(root, 'apps/mcp');
const destination = join(app, 'build/package');
execFileSync(
  process.execPath,
  [
    join(root, 'scripts/turbo.mjs'),
    'run',
    'build',
    '--filter=@l2ce/dev-reference-mcp',
  ],
  { cwd: root, stdio: 'inherit' },
);

const manifest = JSON.parse(await readFile(join(app, 'package.json'), 'utf8'));
const locals = await Promise.all(
  ['database', 'core'].map(async (name) => {
    const directory = join(root, 'packages', name);
    return {
      directory,
      manifest: JSON.parse(
        await readFile(join(directory, 'package.json'), 'utf8'),
      ),
    };
  }),
);
const versions = new Map(
  locals.map(({ manifest }) => [manifest.name, manifest.version]),
);
const dependencies = {};
for (const source of [manifest, ...locals.map((entry) => entry.manifest)]) {
  for (const [name, specifier] of Object.entries(source.dependencies ?? {})) {
    const version = versions.get(name) ?? specifier;
    assert.ok(
      !version.startsWith('workspace:'),
      `Неизвестный workspace-пакет: ${name}`,
    );
    if (dependencies[name])
      assert.equal(dependencies[name], version, `Конфликт версии ${name}`);
    dependencies[name] = version;
  }
}

await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
await cp(join(app, 'dist'), join(destination, 'dist'), { recursive: true });
await cp(join(app, 'README.md'), join(destination, 'README.md'));

for (const { directory, manifest: local } of locals) {
  assert.equal(
    local.private,
    true,
    `${local.name} должен оставаться приватным.`,
  );
  const target = join(destination, 'node_modules', local.name);
  await mkdir(target, { recursive: true });
  await cp(join(directory, 'dist'), join(target, 'dist'), { recursive: true });
  await cp(join(directory, 'README.md'), join(target, 'README.md'));
  const files = ['dist'];
  if (local.name === '@l2ce/database') {
    await cp(join(directory, 'schema.sql'), join(target, 'schema.sql'));
    files.push('schema.sql');
  }
  // Внешние зависимости устанавливает корневой MCP: нативные модули не входят в bundle.
  const { scripts: _scripts, devDependencies: _dev, ...metadata } = local;
  await writeFile(
    join(target, 'package.json'),
    JSON.stringify(
      {
        ...metadata,
        files,
        dependencies: Object.fromEntries(
          Object.keys(local.dependencies ?? {})
            .filter((name) => versions.has(name))
            .map((name) => [name, versions.get(name)]),
        ),
      },
      null,
      2,
    ) + '\n',
  );
}

const {
  scripts: _scripts,
  devDependencies: _dev,
  publishConfig,
  ...metadata
} = manifest;
const {
  directory: _directory,
  linkDirectory: _linkDirectory,
  ...publication
} = publishConfig;
await writeFile(
  join(destination, 'package.json'),
  JSON.stringify(
    {
      ...metadata,
      publishConfig: publication,
      dependencies,
      bundledDependencies: [...versions.keys()],
    },
    null,
    2,
  ) + '\n',
);
