import { describe, it, expect } from 'vitest'
import { parseArgs, helpText } from '../../src/cli/args.ts'

describe('parseArgs', () => {
  describe('help and version', () => {
    it('shows help with no arguments', () => {
      const result = parseArgs([])
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.command.kind).toBe('help')
    })

    it('shows help with --help', () => {
      const result = parseArgs(['--help'])
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.command.kind).toBe('help')
    })

    it('shows help with -h', () => {
      const result = parseArgs(['-h'])
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.command.kind).toBe('help')
    })

    it('shows version with --version', () => {
      const result = parseArgs(['--version'])
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.command.kind).toBe('version')
    })

    it('shows version with -v', () => {
      const result = parseArgs(['-v'])
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.command.kind).toBe('version')
    })
  })

  describe('build command', () => {
    it('parses basic build command', () => {
      const result = parseArgs(['build', 'src/main.hal'])
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.command.kind).toBe('build')
        if (result.command.kind === 'build') {
          expect(result.command.file).toBe('src/main.hal')
          expect(result.command.format).toBe('human')
        }
      }
    })

    it('parses build with --output', () => {
      const result = parseArgs(['build', 'src/main.hal', '--output', 'dist/'])
      expect(result.ok).toBe(true)
      if (result.ok && result.command.kind === 'build') {
        expect(result.command.output).toBe('dist/')
      }
    })

    it('parses build with -o shorthand', () => {
      const result = parseArgs(['build', 'src/main.hal', '-o', 'out/'])
      expect(result.ok).toBe(true)
      if (result.ok && result.command.kind === 'build') {
        expect(result.command.output).toBe('out/')
      }
    })

    it('parses build with --format json', () => {
      const result = parseArgs(['build', 'src/main.hal', '--format', 'json'])
      expect(result.ok).toBe(true)
      if (result.ok && result.command.kind === 'build') {
        expect(result.command.format).toBe('json')
      }
    })

    it('fails without file argument', () => {
      const result = parseArgs(['build'])
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toContain('requires a file')
      }
    })

    it('fails when --output has no value', () => {
      const result = parseArgs(['build', 'src/main.hal', '--output'])
      expect(result.ok).toBe(false)
    })
  })

  describe('test command', () => {
    it('parses test with no arguments', () => {
      const result = parseArgs(['test'])
      expect(result.ok).toBe(true)
      if (result.ok && result.command.kind === 'test') {
        expect(result.command.file).toBeUndefined()
        expect(result.command.generateContractTests).toBe(false)
      }
    })

    it('parses test with file', () => {
      const result = parseArgs(['test', 'src/math.hal'])
      expect(result.ok).toBe(true)
      if (result.ok && result.command.kind === 'test') {
        expect(result.command.file).toBe('src/math.hal')
      }
    })

    it('parses test with --suite', () => {
      const result = parseArgs(['test', '--suite', 'User'])
      expect(result.ok).toBe(true)
      if (result.ok && result.command.kind === 'test') {
        expect(result.command.suite).toBe('User')
      }
    })

    it('parses test with --name', () => {
      const result = parseArgs(['test', '--name', 'rejects'])
      expect(result.ok).toBe(true)
      if (result.ok && result.command.kind === 'test') {
        expect(result.command.name).toBe('rejects')
      }
    })

    it('parses test with --generate-contract-tests', () => {
      const result = parseArgs(['test', '--generate-contract-tests'])
      expect(result.ok).toBe(true)
      if (result.ok && result.command.kind === 'test') {
        expect(result.command.generateContractTests).toBe(true)
      }
    })

    it('parses test with --format json', () => {
      const result = parseArgs(['test', '--format', 'json'])
      expect(result.ok).toBe(true)
      if (result.ok && result.command.kind === 'test') {
        expect(result.command.format).toBe('json')
      }
    })
  })

  describe('interface command', () => {
    it('parses interface with file', () => {
      const result = parseArgs(['interface', 'src/auth.hal'])
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.command.kind).toBe('interface')
        if (result.command.kind === 'interface') {
          expect(result.command.file).toBe('src/auth.hal')
        }
      }
    })

    it('fails without file argument', () => {
      const result = parseArgs(['interface'])
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toContain('requires a file')
      }
    })
  })

  describe('unknown command', () => {
    it('returns error for unknown command', () => {
      const result = parseArgs(['foo'])
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toContain("Unknown command: 'foo'")
      }
    })
  })
})

describe('helpText', () => {
  it('includes key commands', () => {
    const text = helpText()
    expect(text).toContain('build')
    expect(text).toContain('test')
    expect(text).toContain('interface')
    expect(text).toContain('--format')
  })
})
