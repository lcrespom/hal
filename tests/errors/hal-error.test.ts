import { describe, it, expect } from 'vitest'
import { createError, createWarning } from '../../src/errors/hal-error.ts'
import type { Span } from '../../src/common/span.ts'

function makeSpan(
  file: string,
  startLine: number,
  startCol: number,
  endLine: number,
  endCol: number
): Span {
  return {
    file,
    start: { line: startLine, column: startCol, offset: 0 },
    end: { line: endLine, column: endCol, offset: 0 },
  }
}

describe('HalError', () => {
  it('createError produces an error with correct fields', () => {
    const span = makeSpan('src/main.hal', 12, 5, 12, 10)
    const err = createError('E0101', 'Unexpected token', span)

    expect(err.severity).toBe('error')
    expect(err.code).toBe('E0101')
    expect(err.message).toBe('Unexpected token')
    expect(err.file).toBe('src/main.hal')
    expect(err.line).toBe(12)
    expect(err.column).toBe(5)
    expect(err.suggestion).toBeUndefined()
  })

  it('createError includes suggestion when provided', () => {
    const span = makeSpan('src/main.hal', 5, 1, 5, 5)
    const err = createError('E0201', 'Expected expression', span, "Add a value after '='")

    expect(err.suggestion).toBe("Add a value after '='")
  })

  it('createWarning produces a warning', () => {
    const span = makeSpan('src/lib.hal', 3, 1, 3, 20)
    const warn = createWarning('W0001', 'Unused variable', span)

    expect(warn.severity).toBe('warning')
    expect(warn.code).toBe('W0001')
    expect(warn.message).toBe('Unused variable')
  })
})
