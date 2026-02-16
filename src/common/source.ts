import type { Position } from './position.ts'

/**
 * Represents a source file loaded into the compiler.
 * Provides efficient offset-to-position lookups via precomputed line starts.
 */
export class Source {
  readonly file: string
  readonly content: string
  private lineStarts: number[]

  constructor(file: string, content: string) {
    this.file = file
    this.content = content
    this.lineStarts = computeLineStarts(content)
  }

  /** Total length of the source content. */
  get length(): number {
    return this.content.length
  }

  /** Number of lines in the source. */
  get lineCount(): number {
    return this.lineStarts.length
  }

  /** Convert a 0-based offset to a Position (1-based line and column). */
  positionAt(offset: number): Position {
    if (offset < 0) offset = 0
    if (offset > this.content.length) offset = this.content.length

    // Binary search for the line containing this offset
    let low = 0
    let high = this.lineStarts.length - 1
    while (low < high) {
      const mid = (low + high + 1) >> 1
      if (this.lineStarts[mid] <= offset) {
        low = mid
      } else {
        high = mid - 1
      }
    }

    return {
      line: low + 1,
      column: offset - this.lineStarts[low] + 1,
      offset,
    }
  }

  /** Convert a 1-based line and column to a 0-based offset. */
  offsetAt(line: number, column: number): number {
    if (line < 1) line = 1
    if (line > this.lineStarts.length) line = this.lineStarts.length
    const lineStart = this.lineStarts[line - 1]
    return lineStart + (column - 1)
  }

  /** Get the text of a specific line (1-based). */
  lineText(line: number): string {
    if (line < 1 || line > this.lineStarts.length) return ''
    const start = this.lineStarts[line - 1]
    const end =
      line < this.lineStarts.length ? this.lineStarts[line] : this.content.length
    // Strip trailing newline
    let endTrimmed = end
    if (endTrimmed > start && this.content[endTrimmed - 1] === '\n') {
      endTrimmed--
    }
    if (endTrimmed > start && this.content[endTrimmed - 1] === '\r') {
      endTrimmed--
    }
    return this.content.slice(start, endTrimmed)
  }
}

/** Compute the starting offset of each line. */
function computeLineStarts(content: string): number[] {
  const starts: number[] = [0]
  for (let i = 0; i < content.length; i++) {
    if (content[i] === '\n') {
      starts.push(i + 1)
    } else if (
      content[i] === '\r' &&
      (i + 1 >= content.length || content[i + 1] !== '\n')
    ) {
      starts.push(i + 1)
    }
  }
  return starts
}
