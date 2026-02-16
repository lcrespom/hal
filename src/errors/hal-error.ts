import type { Span } from '../common/span.ts'

/** Severity level for diagnostics. */
export type Severity = 'error' | 'warning' | 'info'

/** A structured compiler diagnostic. */
export interface HalError {
  readonly severity: Severity
  readonly code: string
  readonly message: string
  readonly file: string
  readonly line: number
  readonly column: number
  readonly span: Span
  readonly suggestion?: string
}

/** Create an error diagnostic. */
export function createError(
  code: string,
  message: string,
  span: Span,
  suggestion?: string
): HalError {
  return {
    severity: 'error',
    code,
    message,
    file: span.file,
    line: span.start.line,
    column: span.start.column,
    span,
    suggestion,
  }
}

/** Create a warning diagnostic. */
export function createWarning(
  code: string,
  message: string,
  span: Span,
  suggestion?: string
): HalError {
  return {
    severity: 'warning',
    code,
    message,
    file: span.file,
    line: span.start.line,
    column: span.start.column,
    span,
    suggestion,
  }
}
