import { Readable } from 'node:stream'
import { createCliProgram, runCli } from '../../dist/commands/program.js'

/** Выполняет настоящий runCli без стоимости отдельного процесса для каждого шага примера. */
export async function invokeCli(args, stdin = '', cwd = process.cwd()) {
  const originalOut = process.stdout.write
  const originalErr = process.stderr.write
  const originalInput = Object.getOwnPropertyDescriptor(process, 'stdin')
  const originalExit = process.exitCode
  const originalCwd = process.cwd()
  let stdout = ''
  let stderr = ''
  try {
    process.chdir(cwd)
    process.exitCode = 0
    process.stdout.write = (chunk, encoding, callback) => {
      stdout += chunk.toString()
      if (typeof encoding === 'function') encoding()
      else callback?.()
      return true
    }
    process.stderr.write = (chunk, encoding, callback) => {
      stderr += chunk.toString()
      if (typeof encoding === 'function') encoding()
      else callback?.()
      return true
    }
    Object.defineProperty(process, 'stdin', { configurable: true, value: Readable.from([Buffer.from(stdin)]) })
    const output = { stdout: '', stderr: '' }
    await runCli(createCliProgram(output), output, args)
    return { code: process.exitCode ?? 0, stdout, stderr }
  } finally {
    process.stdout.write = originalOut
    process.stderr.write = originalErr
    if (originalInput) Object.defineProperty(process, 'stdin', originalInput)
    process.exitCode = originalExit
    process.chdir(originalCwd)
  }
}
