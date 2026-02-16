import type { OutputFormat } from '../errors/index.ts'

export type Command =
  | { kind: 'build'; file: string; output?: string; format: OutputFormat }
  | {
      kind: 'test'
      file?: string
      suite?: string
      name?: string
      generateContractTests: boolean
      format: OutputFormat
    }
  | { kind: 'interface'; file: string; format: OutputFormat }
  | { kind: 'help' }
  | { kind: 'version' }

export interface ParseError {
  message: string
}

export type ParseResult =
  | { ok: true; command: Command }
  | { ok: false; error: ParseError }

/** Parse CLI arguments into a structured command. */
export function parseArgs(argv: string[]): ParseResult {
  // argv typically starts after "node" and script path
  if (argv.length === 0) {
    return { ok: true, command: { kind: 'help' } }
  }

  const subcommand = argv[0]

  if (subcommand === '--help' || subcommand === '-h') {
    return { ok: true, command: { kind: 'help' } }
  }

  if (subcommand === '--version' || subcommand === '-v') {
    return { ok: true, command: { kind: 'version' } }
  }

  const format = extractFormat(argv)

  switch (subcommand) {
    case 'build':
      return parseBuild(argv.slice(1), format)
    case 'test':
      return parseTest(argv.slice(1), format)
    case 'interface':
      return parseInterface(argv.slice(1), format)
    default:
      return {
        ok: false,
        error: {
          message: `Unknown command: '${subcommand}'. Run 'hal --help' for usage.`,
        },
      }
  }
}

function extractFormat(argv: string[]): OutputFormat {
  const idx = argv.indexOf('--format')
  if (idx !== -1 && idx + 1 < argv.length) {
    const value = argv[idx + 1]
    if (value === 'json' || value === 'human' || value === 'both') {
      return value
    }
  }
  return 'human'
}

function parseBuild(args: string[], format: OutputFormat): ParseResult {
  const positional: string[] = []
  let output: string | undefined

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--format') {
      i++
      continue
    }
    if (args[i] === '--output' || args[i] === '-o') {
      if (i + 1 < args.length) {
        output = args[++i]
      } else {
        return { ok: false, error: { message: '--output requires a directory path' } }
      }
      continue
    }
    positional.push(args[i])
  }

  if (positional.length === 0) {
    return {
      ok: false,
      error: { message: 'hal build requires a file or directory argument' },
    }
  }

  return { ok: true, command: { kind: 'build', file: positional[0], output, format } }
}

function parseTest(args: string[], format: OutputFormat): ParseResult {
  let file: string | undefined
  let suite: string | undefined
  let name: string | undefined
  let generateContractTests = false

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--format') {
      i++
      continue
    }
    if (args[i] === '--suite') {
      if (i + 1 < args.length) suite = args[++i]
      continue
    }
    if (args[i] === '--name') {
      if (i + 1 < args.length) name = args[++i]
      continue
    }
    if (args[i] === '--generate-contract-tests') {
      generateContractTests = true
      continue
    }
    if (!file) file = args[i]
  }

  return {
    ok: true,
    command: { kind: 'test', file, suite, name, generateContractTests, format },
  }
}

function parseInterface(args: string[], format: OutputFormat): ParseResult {
  const positional: string[] = []

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--format') {
      i++
      continue
    }
    positional.push(args[i])
  }

  if (positional.length === 0) {
    return { ok: false, error: { message: 'hal interface requires a file argument' } }
  }

  return { ok: true, command: { kind: 'interface', file: positional[0], format } }
}

/** Generate usage help text. */
export function helpText(): string {
  return `HAL Compiler v0.1.0

Usage: hal <command> [options]

Commands:
  build <file|dir>     Compile HAL to TypeScript
  test [file]          Run tests
  interface <file>     Generate .hali interface file

Options:
  --format <mode>      Output format: human, json, or both (default: human)
  --help, -h           Show this help
  --version, -v        Show version

Build options:
  --output, -o <dir>   Output directory (default: dist/)

Test options:
  --suite <name>               Run tests matching suite name
  --name <pattern>             Run tests matching name pattern
  --generate-contract-tests    Include auto-generated contract tests`
}
