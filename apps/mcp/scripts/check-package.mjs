import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Client } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'
import { releasePackages, root, registry } from '../../../scripts/release/packages.mjs'

const packages = await releasePackages()
const directory = await mkdtemp(join(tmpdir(), 'l2ce-release-'))
const client = new Client({ name: 'package-check', version: '1.0.0' })
let diagnostics = ''
try {
  await writeFile(
    join(directory, 'package.json'),
    JSON.stringify({
      name: 'l2ce-release-check',
      private: true,
      type: 'module'
    })
  )
  execFileSync(
    'npm',
    ['install', '--no-audit', '--no-fund', '--registry', registry, ...packages.map(({ archive }) => archive)],
    { cwd: directory, stdio: 'inherit', timeout: 180_000 }
  )
  for (const { manifest } of packages) {
    const installed = JSON.parse(await readFile(join(directory, 'node_modules', manifest.name, 'package.json'), 'utf8'))
    assert.equal(installed.version, manifest.version)
    assert.deepEqual(installed.bundledDependencies.slice().sort(), ['@l2ce/core', '@l2ce/database'])
    for (const name of installed.bundledDependencies) {
      const bundled = JSON.parse(
        await readFile(join(directory, 'node_modules', manifest.name, 'node_modules', name, 'package.json'), 'utf8')
      )
      assert.equal(bundled.private, true)
      assert.equal(bundled.version, installed.dependencies[name])
    }
    for (const [name, version] of Object.entries(installed.dependencies ?? {})) {
      assert.doesNotMatch(version, /^(workspace:|file:|link:)/)
      const dependency = packages.find((entry) => entry.manifest.name === name)
      if (dependency) assert.equal(version, dependency.manifest.version)
    }
  }
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [
      join(directory, 'node_modules/@l2ce/dev-reference-mcp/dist/index.js'),
      '--data-dir',
      join(root, 'packages/database/data'),
      '--cache-dir',
      join(directory, 'cache')
    ],
    cwd: directory,
    stderr: 'pipe'
  })
  transport.stderr?.on('data', (chunk) => {
    diagnostics += chunk.toString()
  })
  await client.connect(transport, { timeout: 30_000 })
  const { tools } = await client.listTools()
  assert.deepEqual(
    tools.map((tool) => tool.name).sort(),
    [
      'get_project_info',
      'get_dataset_status',
      'list_catalog',
      'list_protocols',
      'get_protocol',
      'get_catalog_record',
      'search_knowledge',
      'read_knowledge'
    ].sort()
  )
  assert.ok(tools.every((tool) => tool.annotations.readOnlyHint === true))
  const project = await client.callTool({
    name: 'get_project_info',
    arguments: {}
  })
  assert.notEqual(project.isError, true)
  assert.equal(project.structuredContent.version, packages.at(-1).manifest.version)
  const status = await client.callTool({
    name: 'get_dataset_status',
    arguments: {}
  })
  assert.notEqual(status.isError, true)
  assert.equal(status.structuredContent.loaded, true)
  const protocols = await client.callTool({
    name: 'list_protocols',
    arguments: { limit: 1 }
  })
  assert.notEqual(protocols.isError, true)
  assert.ok(protocols.structuredContent.total > 0)
  const contexts = await client.callTool({
    name: 'list_catalog',
    arguments: { collection: 'release-contexts', limit: 1 }
  })
  assert.notEqual(contexts.isError, true)
  for (const context of contexts.structuredContent.items) {
    const record = await client.callTool({
      name: 'get_catalog_record',
      arguments: { key: context.key }
    })
    assert.notEqual(record.isError, true)
    assert.equal(record.structuredContent.key, context.key)
    assert.equal(record.structuredContent.revision, status.structuredContent.dataRevision)
    assert.equal(record.structuredContent.releaseKey, context.releaseKey)
    assert.equal(record.structuredContent.regionKey, context.regionKey)
  }
  console.log('MCP-архив: локальные пакеты включены, установка вне workspace, SQLite и stdio проверены.')
} catch (error) {
  if (diagnostics) console.error(diagnostics)
  throw error
} finally {
  await client.close()
  await rm(directory, { recursive: true, force: true })
}
