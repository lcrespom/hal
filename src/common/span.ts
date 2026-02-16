import type { Position } from './position.ts'

/** A range in source text, from start (inclusive) to end (exclusive). */
export interface Span {
  readonly start: Position
  readonly end: Position
  readonly file: string
}
