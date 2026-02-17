import type { Token } from '../lexer/token.ts'
import { TokenType } from '../lexer/token.ts'
import type { Span } from '../common/span.ts'
import type { HalError } from '../errors/hal-error.ts'
import { createError } from '../errors/hal-error.ts'

/**
 * Base parser class with token navigation, error handling, and shared helpers.
 * All parsing subclasses extend this.
 */
export abstract class ParserBase {
  protected pos = 0
  protected readonly errors: HalError[] = []
  protected readonly tokens: readonly Token[]

  constructor(tokens: readonly Token[]) {
    this.tokens = tokens
  }

  // ─── Token navigation ───────────────────────────────────────

  protected peek(): Token {
    return this.tokens[this.pos]
  }

  protected advance(): Token {
    const token = this.tokens[this.pos]
    if (token.type !== TokenType.EOF) this.pos++
    return token
  }

  protected check(type: TokenType): boolean {
    return this.peek().type === type
  }

  protected match(type: TokenType): Token | undefined {
    if (this.check(type)) return this.advance()
    return undefined
  }

  protected expect(type: TokenType, message: string): Token {
    if (this.check(type)) return this.advance()
    const token = this.peek()
    this.error('E0201', message, token.span)
    return token // return current token to keep going
  }

  protected error(code: string, message: string, span: Span, suggestion?: string): void {
    this.errors.push(createError(code, message, span, suggestion))
  }

  protected spanFrom(start: Span): Span {
    const prev = this.tokens[this.pos - 1] ?? this.peek()
    return { start: start.start, end: prev.span.end, file: start.file }
  }

  // ─── Shared helpers ────────────────────────────────────────

  protected parseBracketedNames(): string[] {
    this.expect(TokenType.LBracket, `Expected '[' after effects/forbids`)
    const names: string[] = []
    while (!this.check(TokenType.RBracket) && !this.check(TokenType.EOF)) {
      const token = this.expect(TokenType.Ident, `Expected effect name`)
      names.push(token.lexeme)
      if (!this.match(TokenType.Comma)) break
    }
    this.expect(TokenType.RBracket, `Expected ']' after effect list`)
    return names
  }
}
