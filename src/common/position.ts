/** A position in source text (line and column, both 1-based). */
export interface Position {
  readonly line: number
  readonly column: number
  readonly offset: number
}
