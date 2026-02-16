import type { Source } from '../common/source.ts'
import type { HalError, Severity } from './hal-error.ts'

export type OutputFormat = 'human' | 'json' | 'both'

/** Formats and outputs compiler diagnostics. */
export class DiagnosticReporter {
  private diagnostics: HalError[] = []
  private sources = new Map<string, Source>()
  private format: OutputFormat

  constructor(format: OutputFormat = 'human') {
    this.format = format
  }

  /** Register a source file for context display in human-readable output. */
  addSource(source: Source): void {
    this.sources.set(source.file, source)
  }

  /** Report a diagnostic. */
  report(error: HalError): void {
    this.diagnostics.push(error)
  }

  /** Get all reported diagnostics. */
  getAll(): readonly HalError[] {
    return this.diagnostics
  }

  /** Get diagnostics filtered by severity. */
  getBySeverity(severity: Severity): readonly HalError[] {
    return this.diagnostics.filter(d => d.severity === severity)
  }

  /** Whether any errors (not warnings) have been reported. */
  hasErrors(): boolean {
    return this.diagnostics.some(d => d.severity === 'error')
  }

  /** Number of diagnostics. */
  get count(): number {
    return this.diagnostics.length
  }

  /** Format a single diagnostic as a JSON object. */
  formatJson(error: HalError): object {
    const obj: Record<string, unknown> = {
      severity: error.severity,
      error: error.code,
      message: error.message,
      file: error.file,
      line: error.line,
      column: error.column,
    }
    if (error.suggestion) {
      obj.suggestion = error.suggestion
    }
    return obj
  }

  /** Format a single diagnostic as a human-readable string. */
  formatHuman(error: HalError): string {
    const severityLabel = error.severity.toUpperCase()
    const location = `${error.file}:${error.line}:${error.column}`
    let output = `${severityLabel} [${error.code}]: ${error.message}\n`
    output += `  --> ${location}\n`

    // Show source line with pointer if available
    const source = this.sources.get(error.file)
    if (source) {
      const line = source.lineText(error.line)
      const lineNum = String(error.line)
      const padding = ' '.repeat(lineNum.length)
      output += `${padding} |\n`
      output += `${lineNum} | ${line}\n`
      output += `${padding} | ${' '.repeat(error.column - 1)}^\n`
    }

    if (error.suggestion) {
      output += `  = suggestion: ${error.suggestion}\n`
    }
    return output
  }

  /** Render all diagnostics to a string in the configured format. */
  render(): string {
    if (this.diagnostics.length === 0) return ''

    switch (this.format) {
      case 'json':
        return JSON.stringify(
          this.diagnostics.map(d => this.formatJson(d)),
          null,
          2
        )
      case 'human':
        return this.diagnostics.map(d => this.formatHuman(d)).join('\n')
      case 'both': {
        const human = this.diagnostics.map(d => this.formatHuman(d)).join('\n')
        const json = JSON.stringify(
          this.diagnostics.map(d => this.formatJson(d)),
          null,
          2
        )
        return `${human}\n${json}`
      }
    }
  }
}
