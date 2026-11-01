import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { builtinModules } from 'node:module'
import { dirname, relative, resolve, sep } from 'node:path'
import ts from 'typescript'

const markers = new Set(['index.ts', 'server.ts', 'client.ts', 'lazy.ts'])
const matrix = {
  app: ['app', 'compositions', 'domains', 'infra', 'ui', 'shared'],
  compositions: ['compositions', 'domains', 'infra', 'ui', 'shared'],
  domains: ['domains', 'infra', 'ui', 'shared'],
  infra: ['infra', 'ui', 'shared'],
  ui: ['ui', 'shared'],
  shared: ['shared']
}

/**
 * Собирает исходники собственного графа; generated остаётся реализацией владельца.
 */
function filesIn(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name)
    return entry.isDirectory() ? filesIn(path) : [path]
  })
}

/**
 * Извлекает статические, динамические и type-only рёбра из TypeScript AST.
 */
function importsIn(source) {
  const imports = []
  /**
   * Посещает узлы, не теряя import type и реэкспорты.
   */
  function visit(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const clause = node.importClause
      const bindings = clause?.namedBindings ?? node.exportClause
      const isType =
        node.isTypeOnly ||
        clause?.isTypeOnly ||
        (!clause?.name &&
          bindings &&
          (ts.isNamedImports(bindings) || ts.isNamedExports(bindings)) &&
          bindings.elements.length > 0 &&
          bindings.elements.every((item) => item.isTypeOnly))
      imports.push({ name: node.moduleSpecifier.text, runtime: !isType })
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      imports.push({ name: node.arguments[0].text, runtime: true })
    } else if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteral(node.argument.literal)
    ) {
      imports.push({ name: node.argument.literal.text, runtime: false })
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return imports
}

/**
 * Проверяет владельцев, фасеты, матрицу, вложенность, циклы и собственный runtime-граф.
 * Смысл ответственности и внутренний граф сторонних пакетов требуют отдельного ревью.
 */
export function inspectArchitecture(root) {
  const allFiles = filesIn(root)
  const codeFiles = allFiles.filter((file) => /\.[cm]?[jt]sx?$/.test(file) && !file.endsWith('.d.ts'))
  const facets = new Set(
    allFiles.filter((file) => markers.has(file.split(sep).at(-1)) && !file.includes(`${sep}generated${sep}`))
  )
  const units = new Set([...facets].map(dirname))
  const errors = []
  const unitGraph = new Map([...units].map((unit) => [unit, new Set()]))
  const runtimeGraph = new Map()
  const clientFiles = new Set()
  const serverFiles = new Set()
  const options = {
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    baseUrl: root,
    paths: Object.fromEntries(Object.keys(matrix).map((layer) => [`${layer}/*`, [`${layer}/*`]]))
  }

  /**
   * Определяет ближайший юнит или framework-область app.
   */
  function owner(file) {
    let directory = dirname(file)
    while (directory.startsWith(root)) {
      if (units.has(directory)) return directory
      if (directory === resolve(root, 'app')) return directory
      directory = dirname(directory)
    }
    return null
  }

  /**
   * Определяет роль владельца по корню frontend.
   */
  function layer(unit) {
    return relative(root, unit).split(sep)[0]
  }

  /**
   * Добавляет диагностику с физическим путём.
   */
  function report(file, message) {
    errors.push(`${relative(root, file)}: ${message}`)
  }

  for (const file of codeFiles) {
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
    const fromOwner = owner(file)
    if (!fromOwner) {
      report(file, 'Файл не имеет владельца.')
      continue
    }
    const hasClientDirective = source.statements.some(
      (node) =>
        ts.isExpressionStatement(node) && ts.isStringLiteral(node.expression) && node.expression.text === 'use client'
    )
    if (hasClientDirective) clientFiles.add(file)
    const imports = importsIn(source)
    if (imports.some((edge) => edge.name === 'server-only')) serverFiles.add(file)
    if (file.endsWith(`${sep}client.ts`) && !hasClientDirective) report(file, 'У client.ts отсутствует use client.')
    if (file.endsWith(`${sep}server.ts`) && !serverFiles.has(file)) report(file, 'У server.ts отсутствует server-only.')
    if (facets.has(file)) {
      if (!source.statements.some(ts.isExportDeclaration)) report(file, 'Пустой фасет.')
      if (
        source.statements.some(
          (node) => !ts.isExportDeclaration(node) && !ts.isImportDeclaration(node) && !ts.isExpressionStatement(node)
        )
      )
        report(file, 'Фасет содержит реализацию.')
    }
    const runtime = []
    runtimeGraph.set(file, runtime)
    for (const edge of imports) {
      const resolved = ts.resolveModuleName(edge.name, file, options, ts.sys).resolvedModule?.resolvedFileName
      const target = resolved ?? (edge.name.startsWith('.') ? resolve(dirname(file), edge.name) : null)
      const isLocal = target?.startsWith(`${root}${sep}`) && existsSync(target)
      if (!isLocal) {
        if (
          edge.runtime &&
          (edge.name === 'server-only' ||
            edge.name.startsWith('node:') ||
            builtinModules.includes(edge.name) ||
            /^@l2ce\/(database|core)(\/|$)/.test(edge.name))
        )
          serverFiles.add(file)
        if (edge.name.startsWith('.') || Object.keys(matrix).some((name) => edge.name.startsWith(`${name}/`)))
          report(file, `Не разрешён импорт ${edge.name}.`)
        continue
      }
      if (edge.runtime) runtime.push(target)
      if (
        edge.runtime &&
        file.endsWith(`${sep}index.ts`) &&
        (target.endsWith(`${sep}client.ts`) || target.endsWith(`${sep}server.ts`))
      ) {
        report(file, 'Универсальный фасет импортирует средовой фасет.')
      }
      const toOwner = owner(target)
      if (!toOwner) {
        report(file, `У импорта ${edge.name} нет владельца.`)
        continue
      }
      if (fromOwner === toOwner) {
        if (!edge.name.startsWith('.')) report(file, `Внутренний импорт должен быть относительным: ${edge.name}.`)
        continue
      }
      if (!matrix[layer(fromOwner)]?.includes(layer(toOwner)))
        report(file, `Недопустимое направление ${layer(fromOwner)} → ${layer(toOwner)}.`)
      if (layer(toOwner) !== 'app' && !facets.has(target)) report(file, `Глубокий импорт ${edge.name}.`)
      if (edge.name.startsWith('.')) report(file, `Межюнитный импорт требует алиаса: ${edge.name}.`)
      const parent = owner(resolve(toOwner, '..', '_parent.ts'))
      if (parent && layer(toOwner) !== 'app' && fromOwner !== parent)
        report(file, `Вложенный юнит ${relative(root, toOwner)} доступен только родителю.`)
      if (fromOwner.startsWith(`${toOwner}${sep}`)) report(file, 'Вложенный юнит импортирует предка.')
      if (!unitGraph.has(fromOwner)) unitGraph.set(fromOwner, new Set())
      unitGraph.get(fromOwner).add(toOwner)
    }
  }

  /**
   * Проверяет свёрнутый граф, включая type-only рёбра.
   */
  function visitUnit(unit, stack, complete) {
    if (stack.includes(unit)) {
      report(unit, `Цикл юнитов: ${[...stack, unit].map((item) => relative(root, item)).join(' → ')}`)
      return
    }
    if (complete.has(unit)) return
    for (const next of unitGraph.get(unit) ?? []) visitUnit(next, [...stack, unit], complete)
    complete.add(unit)
  }
  const complete = new Set()
  for (const unit of unitGraph.keys()) visitUnit(unit, [], complete)

  /**
   * Проверяет достижимость Node.js и server-only из исполняемого входа.
   */
  function reachesServer(file, seen = new Set()) {
    if (serverFiles.has(file)) return true
    if (seen.has(file)) return false
    seen.add(file)
    return (runtimeGraph.get(file) ?? []).some((target) => reachesServer(target, seen))
  }
  for (const file of clientFiles) {
    if (reachesServer(file)) report(file, 'Клиентский runtime-граф достигает server-only/Node.js.')
  }
  for (const file of facets) {
    if (file.endsWith(`${sep}index.ts`) && reachesServer(file))
      report(file, 'Универсальный фасет достигает серверного runtime.')
  }
  return [...new Set(errors)]
}
