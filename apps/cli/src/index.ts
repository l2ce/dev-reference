#!/usr/bin/env node
import { createCliProgram, outputOptions, runCli } from './commands/program.js'
import { onOutputError } from './output/writer.js'
import type { CommanderOutput } from './output/output.types.js'

const output: CommanderOutput = { stdout: '', stderr: '' }
const program = createCliProgram(output)
process.stdout.on('error', (error: unknown) => onOutputError(error, outputOptions(program)))
await runCli(program, output, process.argv.slice(2))
