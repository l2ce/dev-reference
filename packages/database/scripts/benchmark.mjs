import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, statfs, writeFile } from 'node:fs/promises';
import { cpus } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const root = fileURLToPath(new URL('../', import.meta.url));
const worker = fileURLToPath(
  new URL('./benchmark-worker.mjs', import.meta.url),
);

/**
 * Проверяет целый числовой параметр до создания файлов бенчмарка.
 */
function integer(value, minimum) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < minimum) {
    throw new Error(`Expected an integer >= ${minimum}, received ${value}`);
  }
  return number;
}

/**
 * Выполняет одну операцию отдельным процессом и фиксирует время вместе с запуском Node.js.
 */
function run(operation, options) {
  const startedAt = performance.now();
  const child = spawnSync(
    process.execPath,
    [worker, operation, JSON.stringify(options)],
    {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit'],
      maxBuffer: 4 * 1024 * 1024,
    },
  );
  const wallMs = performance.now() - startedAt;
  if (child.error || child.status !== 0) {
    throw new Error(
      `Benchmark step failed: ${operation} (exit ${child.status}, signal ${child.signal})`,
      { cause: child.error },
    );
  }
  return { ...JSON.parse(child.stdout), wallMs };
}

/**
 * Формирует отчёт одного цикла экспорта и импорта с длительностями этапов.
 */
function markdown(report) {
  return [
    '# SQLite benchmark',
    '',
    `Date: ${report.createdAt}`,
    '',
    `Records: ${report.config.records}; generated description: ${report.config.descriptionBytes} bytes.`,
    `Node ${report.environment.node}, ${report.environment.platform}/${report.environment.arch}, ${report.environment.cpu}.`,
    '',
    '| Operation | Time, seconds |',
    '| --- | ---: |',
    `| Export | ${(report.export.durationMs / 1000).toFixed(3)} |`,
    `| Import | ${(report.import.durationMs / 1000).toFixed(3)} |`,
    '',
    `Round-trip: ${report.verification.equal ? 'OK' : 'FAILED'}.`,
    `Seed (validated API write): ${(report.seed.durationMs / 1000).toFixed(3)} s.`,
    '',
    '## Method',
    '',
    '- Exactly one export and one import per benchmark invocation.',
    '- Existing canonical records plus synthetic records across both languages and all declared collections.',
    '- A fresh export directory and a fresh destination SQLite file.',
    '- Each operation uses a separate Node.js process and the normal progress renderer.',
    `- Progress mode: export ${report.export.progressMode}, import ${report.import.progressMode}.`,
    '- API duration includes validation, I/O, commit and progress; wallMs also includes process startup.',
    '- OS caches are not cleared. Import immediately follows export.',
    '- Semantic hashes, SQLite quick_check and foreign_key_check are verified after measurement in a separate process.',
    '',
    '## Phases, seconds',
    '',
    '| Phase | Export | Import |',
    '| --- | ---: | ---: |',
    ...['scan', 'read', 'validate', 'write', 'commit'].map(
      (phase) =>
        `| ${phase} | ${((report.export.phasesMs[phase] ?? 0) / 1000).toFixed(3)} | ${((report.import.phasesMs[phase] ?? 0) / 1000).toFixed(3)} |`,
    ),
    '',
    'The validate phase also includes preparation before the first record write.',
    '',
  ].join('\n');
}

const { values } = parseArgs({
  options: {
    records: { type: 'string', default: '50000' },
    'description-bytes': { type: 'string', default: '1024' },
  },
});
const config = {
  records: integer(values.records, 100),
  descriptionBytes: integer(values['description-bytes'], 512),
};
const parent = join(root, '.local/benchmarks');
await mkdir(parent, { recursive: true });
const directory = await mkdtemp(join(parent, `sqlite-${config.records}-`));
const filesystem = await statfs(directory);
const source = join(directory, 'source.sqlite');
const output = join(directory, 'data');
const destination = join(directory, 'restored.sqlite');
const report = {
  createdAt: new Date().toISOString(),
  directory,
  config,
  environment: {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    cpu: cpus()[0]?.model,
    logicalCpus: cpus().length,
    filesystemType: `0x${filesystem.type.toString(16)}`,
    filesystemBlockSize: filesystem.bsize,
  },
};
process.stdout.write(
  `Benchmark directory: ${directory}\nPreparing ${config.records} records...\n`,
);
report.seed = run('seed', { database: source, ...config });
process.stdout.write('Exporting...\n');
report.export = run('export', {
  database: source,
  directory: output,
  records: config.records,
});
process.stdout.write('Importing...\n');
report.import = run('import', {
  database: destination,
  directory: output,
  records: config.records,
});
process.stdout.write('Verifying round-trip...\n');
report.verification = run('verify', {
  source,
  database: destination,
  records: config.records,
});
await writeFile(
  join(directory, 'results.json'),
  JSON.stringify(report, null, 2) + '\n',
);
await writeFile(join(directory, 'REPORT.md'), markdown(report));
process.stdout.write(
  `Export: ${(report.export.durationMs / 1000).toFixed(3)} seconds\nImport: ${(report.import.durationMs / 1000).toFixed(3)} seconds\nRound-trip: OK\nReport: ${join(directory, 'REPORT.md')}\n`,
);
