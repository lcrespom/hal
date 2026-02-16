import { describe, it, expect } from 'vitest'
import { DiagnosticReporter } from '../../src/errors/reporter.ts'
import { createError, createWarning } from '../../src/errors/hal-error.ts'
import { Source } from '../../src/common/source.ts'
import type { Span } from '../../src/common/span.ts'

function makeSpan(file: string, startLine: number, startCol: number): Span {
  return {
    file,
    start: { line: startLine, column: startCol, offset: 0 },
    end: { line: startLine, column: startCol + 1, offset: 1 },
  }
}

describe('DiagnosticReporter', () => {
  it('starts with zero diagnostics', () => {
    const reporter = new DiagnosticReporter()
    expect(reporter.count).toBe(0)
    expect(reporter.hasErrors()).toBe(false)
  })

  it('tracks reported diagnostics', () => {
    const reporter = new DiagnosticReporter()
    const err = createError('E0101', 'bad token', makeSpan('test.hal', 1, 1))
    reporter.report(err)

    expect(reporter.count).toBe(1)
    expect(reporter.hasErrors()).toBe(true)
    expect(reporter.getAll()).toHaveLength(1)
  })

  it('distinguishes errors from warnings', () => {
    const reporter = new DiagnosticReporter()
    reporter.report(createError('E0101', 'error', makeSpan('test.hal', 1, 1)))
    reporter.report(createWarning('W0001', 'warning', makeSpan('test.hal', 2, 1)))

    expect(reporter.getBySeverity('error')).toHaveLength(1)
    expect(reporter.getBySeverity('warning')).toHaveLength(1)
    expect(reporter.hasErrors()).toBe(true)
  })

  it('hasErrors is false when only warnings', () => {
    const reporter = new DiagnosticReporter()
    reporter.report(createWarning('W0001', 'warning', makeSpan('test.hal', 1, 1)))

    expect(reporter.hasErrors()).toBe(false)
  })

  describe('formatJson', () => {
    it('produces correct JSON structure', () => {
      const reporter = new DiagnosticReporter('json')
      const err = createError(
        'E0101',
        "Unexpected token '}'",
        makeSpan('src/main.hal', 12, 5),
        "Add an expression before '}'"
      )

      const json = reporter.formatJson(err)
      expect(json).toEqual({
        severity: 'error',
        error: 'E0101',
        message: "Unexpected token '}'",
        file: 'src/main.hal',
        line: 12,
        column: 5,
        suggestion: "Add an expression before '}'",
      })
    })

    it('omits suggestion when not present', () => {
      const reporter = new DiagnosticReporter('json')
      const err = createError('E0101', 'bad', makeSpan('test.hal', 1, 1))

      const json = reporter.formatJson(err) as Record<string, unknown>
      expect(json).not.toHaveProperty('suggestion')
    })
  })

  describe('formatHuman', () => {
    it('includes severity, code, message, and location', () => {
      const reporter = new DiagnosticReporter('human')
      const err = createError('E0101', 'Unexpected token', makeSpan('src/main.hal', 5, 3))

      const output = reporter.formatHuman(err)
      expect(output).toContain('ERROR [E0101]')
      expect(output).toContain('Unexpected token')
      expect(output).toContain('src/main.hal:5:3')
    })

    it('shows source line and pointer when source is registered', () => {
      const reporter = new DiagnosticReporter('human')
      const source = new Source('test.hal', 'let x = 5\nlet y = ')
      reporter.addSource(source)

      const err = createError('E0201', 'Expected expression', makeSpan('test.hal', 2, 9))
      const output = reporter.formatHuman(err)

      expect(output).toContain('let y = ')
      expect(output).toContain('^')
    })

    it('includes suggestion when present', () => {
      const reporter = new DiagnosticReporter('human')
      const err = createError('E0101', 'Error', makeSpan('test.hal', 1, 1), 'Try this')

      const output = reporter.formatHuman(err)
      expect(output).toContain('suggestion: Try this')
    })
  })

  describe('render', () => {
    it('returns empty string when no diagnostics', () => {
      const reporter = new DiagnosticReporter('json')
      expect(reporter.render()).toBe('')
    })

    it('renders JSON format', () => {
      const reporter = new DiagnosticReporter('json')
      reporter.report(createError('E0101', 'bad', makeSpan('test.hal', 1, 1)))

      const output = reporter.render()
      const parsed = JSON.parse(output)
      expect(parsed).toHaveLength(1)
      expect(parsed[0].error).toBe('E0101')
    })

    it('renders human format', () => {
      const reporter = new DiagnosticReporter('human')
      reporter.report(createError('E0101', 'bad', makeSpan('test.hal', 1, 1)))

      const output = reporter.render()
      expect(output).toContain('ERROR [E0101]')
    })

    it('renders both formats', () => {
      const reporter = new DiagnosticReporter('both')
      reporter.report(createError('E0101', 'bad', makeSpan('test.hal', 1, 1)))

      const output = reporter.render()
      expect(output).toContain('ERROR [E0101]')
      expect(output).toContain('"error": "E0101"')
    })
  })
})
