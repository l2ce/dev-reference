import { chmod, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

await rm(new URL('../dist/', import.meta.url), {
  recursive: true,
  force: true,
});
const require = createRequire(import.meta.url);
const result = spawnSync(
  process.execPath,
  [require.resolve('typescript/bin/tsc'), '-p', 'tsconfig.json'],
  { stdio: 'inherit' },
);
if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
await chmod(new URL('../dist/index.js', import.meta.url), 0o755);
