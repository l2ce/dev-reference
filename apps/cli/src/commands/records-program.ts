import { Command, Option } from 'commander'
import { argumentSchema, groupSchema } from '../input/schema.js'
import { cliMessages as messages } from '../locales/ru.js'
import { writeSuccess } from '../output/writer.js'
import { positiveInteger, nonnegativeInteger, showCommandHelp } from './options.js'
import { runCommand } from './run.js'

/**
 * Проверяет все параметры до открытия базы и выполняет предметное действие.
 */
async function executeAction(this: Command): Promise<void> {
  const group = groupSchema.safeParse(this.parent?.name())
  const args = argumentSchema.parse({
    command: this.name(),
    group: group.success ? group.data : undefined,
    operands: this.processedArgs.flat(),
    ...this.optsWithGlobals()
  })
  writeSuccess(await runCommand(args), {
    json: args.json,
    pretty: args.pretty
  })
}

/**
 * Добавляет ограниченную пагинацию и поиск.
 */
function pageOptions(command: Command): Command {
  return command
    .option('--query <text>', messages.flags.query)
    .option('--limit <number>', messages.flags.limit, positiveInteger)
    .option('--offset <number>', messages.flags.offset, nonnegativeInteger)
}

/**
 * Добавляет параметры протокольного поиска знаний.
 */
function knowledgeOptions(command: Command, direction = true): Command {
  command
    .option('--protocol <key>', messages.flags.protocol)
    .addOption(new Option('--server <server>', messages.flags.server).choices(['login', 'game']))
  if (direction) {
    command.addOption(
      new Option('--direction <direction>', messages.flags.direction).choices(['client-to-server', 'server-to-client'])
    )
  }
  return command
}

/**
 * Добавляет предсказуемые параметры записи и предварительной проверки.
 */
function writeOptions(command: Command, input = true): Command {
  command.option('--if-revision <hash>', messages.flags.ifRevision).option('--dry-run', messages.flags.dryRun)
  if (input) {
    command.option('-f, --file <path>', messages.flags.file)
  }
  return command
}

/**
 * Добавляет редактирование выбранного языкового текста.
 */
function textOptions(command: Command): Command {
  return command
    .option('--title <text>', messages.flags.title)
    .option('--summary <text>', messages.flags.summary)
    .option('--markdown <path>', messages.flags.markdown)
}

/**
 * Регистрирует предметные группы с одинаковыми правилами адресации и вывода.
 */
export function registerRecordCommands(program: Command): void {
  for (const group of groupSchema.options) {
    const knowledge = ['packets', 'scenarios', 'articles'].includes(group)
    const parent = program.command(group).description(messages.groups[group]).action(showCommandHelp)
    const list = pageOptions(parent.command('list').description(messages.commands.list))
    if (group === 'protocols') {
      list
        .option('--number <number>', messages.flags.number, nonnegativeInteger)
        .option('--branch <code>', messages.flags.branch)
        .option('--chronicle <code>', messages.flags.chronicle)
        .option('--release <key>', messages.flags.release)
    } else if (group === 'chronicles') {
      list.option('--branch <code>', messages.flags.branch)
    } else if (group === 'releases') {
      list.option('--chronicle <code>', messages.flags.chronicle)
    }
    if (knowledge) {
      knowledgeOptions(list, group === 'packets')
    }
    list.action(executeAction)
    const get = parent.command('get <keys...>').description(messages.commands.get)
    if (knowledge) {
      get.requiredOption('--protocol <key>', messages.flags.protocol)
    }
    get.action(executeAction)
    const inspect = parent.command('inspect <keys...>').description(messages.commands.inspect)
    const schema = parent.command('schema').description(messages.commands.schema)
    if (knowledge) {
      inspect.option('--rev <number>', messages.flags.rev, positiveInteger)
      schema.option('--rev <number>', messages.flags.rev, positiveInteger)
    }
    inspect.action(executeAction)
    schema.action(executeAction)
    for (const action of ['create', 'update'] as const) {
      const command = writeOptions(parent.command(`${action} <key>`).description(messages.commands[action]))
      if (!knowledge) {
        textOptions(command)
      }
      if (group === 'packets') {
        command
          .option('--name <text>', messages.flags.name)
          .addOption(new Option('--server <server>', messages.flags.server).choices(['login', 'game']))
          .addOption(
            new Option('--direction <direction>', messages.flags.direction).choices([
              'client-to-server',
              'server-to-client'
            ])
          )
      }
      if (group === 'chronicles') {
        command.option('--branch <code>', messages.flags.branch)
      }
      if (group === 'releases') {
        command
          .option('--chronicle <code>', messages.flags.chronicle)
          .option('--protocols <keys>', messages.flags.protocols)
      }
      command.action(executeAction)
    }
    const deletion = writeOptions(parent.command('delete <key>').description(messages.commands.delete), false)
    if (knowledge) {
      deletion.option('--rev <number>', messages.flags.rev, positiveInteger)
    }
    deletion.action(executeAction)
    const translate = textOptions(
      writeOptions(parent.command('translate <key>').description(messages.commands.translate))
    )
    if (knowledge) {
      translate.requiredOption('--rev <number>', messages.flags.rev, positiveInteger)
    }
    translate.action(executeAction)
    if (knowledge) {
      parent.command('revisions <key>').description(messages.commands.revisions).action(executeAction)
      for (const [action, description] of [
        ['add-revision', messages.commands.addRevision],
        ['update-revision', messages.commands.updateRevision]
      ]) {
        textOptions(writeOptions(parent.command(`${action} <key>`).description(description)))
          .requiredOption('--rev <number>', messages.flags.rev, positiveInteger)
          .option('--protocols <keys>', messages.flags.protocols)
          .addOption(
            new Option('--status <status>', messages.flags.status).choices(['missing', 'partial', 'documented'])
          )
          .action(executeAction)
      }
    }
  }
  for (const name of ['status', 'init', 'validate'] as const) {
    program.command(name).description(messages.commands[name]).action(executeAction)
  }
  program
    .command('import')
    .description(messages.commands.import)
    .option('--input <directory>', messages.flags.input)
    .action(executeAction)
  program
    .command('export')
    .description(messages.commands.export)
    .option('--output <directory>', messages.flags.output)
    .action(executeAction)
  writeOptions(program.command('batch').description(messages.commands.batch)).action(executeAction)
  pageOptions(knowledgeOptions(program.command('search').description(messages.commands.search)))
    .addOption(new Option('--status <status>', messages.flags.status).choices(['missing', 'partial', 'documented']))
    .addOption(new Option('--kind <kind>', messages.flags.kind).choices(['packet', 'scenario', 'article']))
    .action(executeAction)
  program
    .command('read <keys...>')
    .description(messages.commands.read)
    .requiredOption('--protocol <key>', messages.flags.protocol)
    .action(executeAction)
}
