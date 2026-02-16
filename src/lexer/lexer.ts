import { Source } from '../common/source.ts'
import type { Span } from '../common/span.ts'
import { createError } from '../errors/hal-error.ts'
import type { HalError } from '../errors/hal-error.ts'
import { TokenType, KEYWORDS } from './token.ts'
import type { Token } from './token.ts'

/** Result of lexing: either a list of tokens or a list of errors. */
export interface LexResult {
  readonly tokens: Token[]
  readonly errors: HalError[]
}

/**
 * Lexer for the HAL language.
 * Consumes a Source and produces a stream of typed tokens.
 */
export class Lexer {
  private source: Source
  private pos: number = 0
  private tokens: Token[] = []
  private errors: HalError[] = []

  constructor(source: Source) {
    this.source = source
  }

  /** Tokenize the entire source, returning tokens and any errors. */
  tokenize(): LexResult {
    while (!this.isAtEnd()) {
      this.scanToken()
    }
    this.addToken(TokenType.EOF, '', this.pos, this.pos)
    return { tokens: this.tokens, errors: this.errors }
  }

  /** Static convenience: tokenize a source string. */
  static tokenize(source: Source): LexResult {
    return new Lexer(source).tokenize()
  }

  private isAtEnd(): boolean {
    return this.pos >= this.source.content.length
  }

  private peek(): string {
    if (this.isAtEnd()) return '\0'
    return this.source.content[this.pos]
  }

  private peekNext(): string {
    if (this.pos + 1 >= this.source.content.length) return '\0'
    return this.source.content[this.pos + 1]
  }

  private peekAt(offset: number): string {
    const idx = this.pos + offset
    if (idx >= this.source.content.length) return '\0'
    return this.source.content[idx]
  }

  private advance(): string {
    const ch = this.source.content[this.pos]
    this.pos++
    return ch
  }

  private match(expected: string): boolean {
    if (this.isAtEnd()) return false
    if (this.source.content[this.pos] !== expected) return false
    this.pos++
    return true
  }

  private makeSpan(start: number, end: number): Span {
    return {
      start: this.source.positionAt(start),
      end: this.source.positionAt(end),
      file: this.source.file,
    }
  }

  private addToken(
    type: TokenType,
    lexeme: string,
    start: number,
    end: number
  ): void {
    this.tokens.push({ type, lexeme, span: this.makeSpan(start, end) })
  }

  private addError(
    code: string,
    message: string,
    start: number,
    end: number,
    suggestion?: string
  ): void {
    this.errors.push(
      createError(code, message, this.makeSpan(start, end), suggestion)
    )
  }

  private scanToken(): void {
    const ch = this.peek()

    // Whitespace
    if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
      this.advance()
      return
    }

    // Comments
    if (ch === '/' && this.peekNext() === '/') {
      this.skipLineComment()
      return
    }
    if (ch === '/' && this.peekNext() === '*') {
      this.skipBlockComment()
      return
    }

    // Numbers
    if (isDigit(ch)) {
      this.scanNumber()
      return
    }

    // Strings
    if (ch === '"') {
      this.scanString()
      return
    }

    // Identifiers and keywords
    if (isIdentStart(ch)) {
      this.scanIdentifier()
      return
    }

    // Operators and delimiters
    this.scanOperatorOrDelimiter()
  }

  private skipLineComment(): void {
    // Skip //
    this.pos += 2
    while (!this.isAtEnd() && this.peek() !== '\n') {
      this.advance()
    }
  }

  private skipBlockComment(): void {
    const start = this.pos
    // Skip /*
    this.pos += 2
    let depth = 1
    while (!this.isAtEnd() && depth > 0) {
      if (this.peek() === '/' && this.peekNext() === '*') {
        depth++
        this.pos += 2
      } else if (this.peek() === '*' && this.peekNext() === '/') {
        depth--
        this.pos += 2
      } else {
        this.advance()
      }
    }
    if (depth > 0) {
      this.addError(
        'E0101',
        'Unterminated block comment',
        start,
        this.pos,
        "Add '*/' to close the block comment"
      )
    }
  }

  private scanNumber(): void {
    const start = this.pos

    // Consume integer part (digits and underscores)
    while (!this.isAtEnd() && (isDigit(this.peek()) || this.peek() === '_')) {
      this.advance()
    }

    // Check for float: '.' followed by a digit
    if (
      !this.isAtEnd() &&
      this.peek() === '.' &&
      this.peekNext() !== '.' &&
      isDigit(this.peekNext())
    ) {
      this.advance() // consume '.'
      while (
        !this.isAtEnd() &&
        (isDigit(this.peek()) || this.peek() === '_')
      ) {
        this.advance()
      }

      // Exponent part
      if (!this.isAtEnd() && (this.peek() === 'e' || this.peek() === 'E')) {
        this.advance()
        if (
          !this.isAtEnd() &&
          (this.peek() === '+' || this.peek() === '-')
        ) {
          this.advance()
        }
        if (!this.isAtEnd() && isDigit(this.peek())) {
          while (
            !this.isAtEnd() &&
            (isDigit(this.peek()) || this.peek() === '_')
          ) {
            this.advance()
          }
        } else {
          this.addError(
            'E0102',
            'Expected digits after exponent',
            start,
            this.pos,
            'Add digits after the exponent indicator'
          )
          return
        }
      }

      const lexeme = this.source.content.slice(start, this.pos)
      this.addToken(TokenType.FloatLit, lexeme, start, this.pos)
      return
    }

    const lexeme = this.source.content.slice(start, this.pos)
    this.addToken(TokenType.IntLit, lexeme, start, this.pos)
  }

  private scanString(): void {
    const start = this.pos

    // Check for multi-line string: """
    if (this.peekNext() === '"' && this.peekAt(2) === '"') {
      this.scanMultiLineString()
      return
    }

    // Single-line string
    this.advance() // consume opening "

    let value = ''
    let hasInterpolation = false

    while (!this.isAtEnd() && this.peek() !== '"' && this.peek() !== '\n') {
      if (this.peek() === '\\') {
        const escaped = this.scanEscapeSequence()
        if (escaped === null) return // error already reported
        value += escaped
      } else if (this.peek() === '{') {
        hasInterpolation = true
        // Emit StringStart or StringMiddle for the text so far
        this.emitInterpolatedString(start)
        return
      } else {
        value += this.advance()
      }
    }

    if (this.isAtEnd() || this.peek() === '\n') {
      this.addError(
        'E0103',
        'Unterminated string literal',
        start,
        this.pos,
        'Add a closing \'"\' to terminate the string'
      )
      return
    }

    this.advance() // consume closing "
    const lexeme = this.source.content.slice(start, this.pos)
    this.addToken(TokenType.StringLit, lexeme, start, this.pos)
  }

  private emitInterpolatedString(stringStart: number): void {
    // Back up to emit StringStart from the original " to just before {
    const startLexeme = this.source.content.slice(stringStart, this.pos)
    this.addToken(TokenType.StringStart, startLexeme, stringStart, this.pos)

    // Now scan interpolation segments
    while (!this.isAtEnd() && this.peek() === '{') {
      this.advance() // consume {

      // Scan expression tokens until matching }
      let braceDepth = 1
      while (!this.isAtEnd() && braceDepth > 0) {
        if (this.peek() === '{') {
          braceDepth++
          this.scanToken()
        } else if (this.peek() === '}') {
          braceDepth--
          if (braceDepth === 0) {
            this.advance() // consume closing }
          } else {
            this.scanToken()
          }
        } else {
          this.scanToken()
        }
      }

      // Now scan more string content after the }
      const segmentStart = this.pos
      let moreText = ''
      while (
        !this.isAtEnd() &&
        this.peek() !== '"' &&
        this.peek() !== '{' &&
        this.peek() !== '\n'
      ) {
        if (this.peek() === '\\') {
          const escaped = this.scanEscapeSequence()
          if (escaped === null) return
          moreText += escaped
        } else {
          moreText += this.advance()
        }
      }

      if (!this.isAtEnd() && this.peek() === '{') {
        // More interpolation coming — emit StringMiddle
        const middleLexeme = this.source.content.slice(segmentStart, this.pos)
        this.addToken(
          TokenType.StringMiddle,
          middleLexeme,
          segmentStart,
          this.pos
        )
        continue
      }

      // End of string
      if (this.isAtEnd() || this.peek() === '\n') {
        this.addError(
          'E0103',
          'Unterminated string literal',
          stringStart,
          this.pos,
          'Add a closing \'"\' to terminate the string'
        )
        return
      }

      // Emit StringEnd (includes closing ")
      const endLexeme = this.source.content.slice(segmentStart, this.pos + 1)
      this.addToken(
        TokenType.StringEnd,
        endLexeme,
        segmentStart,
        this.pos + 1
      )
      this.advance() // consume closing "
      return
    }
  }

  private scanMultiLineString(): void {
    const start = this.pos
    // consume opening """
    this.pos += 3

    let value = ''
    while (!this.isAtEnd()) {
      if (
        this.peek() === '"' &&
        this.peekNext() === '"' &&
        this.peekAt(2) === '"'
      ) {
        this.pos += 3 // consume closing """
        const lexeme = this.source.content.slice(start, this.pos)
        this.addToken(TokenType.StringLit, lexeme, start, this.pos)
        return
      }
      if (this.peek() === '\\') {
        const escaped = this.scanEscapeSequence()
        if (escaped === null) return
        value += escaped
      } else {
        value += this.advance()
      }
    }

    this.addError(
      'E0103',
      'Unterminated multi-line string literal',
      start,
      this.pos,
      'Add \'"""\' to close the multi-line string'
    )
  }

  private scanEscapeSequence(): string | null {
    const escStart = this.pos
    this.advance() // consume backslash

    if (this.isAtEnd()) {
      this.addError(
        'E0104',
        'Invalid escape sequence',
        escStart,
        this.pos,
        'Add a valid escape character after \\'
      )
      return null
    }

    const ch = this.advance()
    switch (ch) {
      case 'n':
        return '\n'
      case 't':
        return '\t'
      case '\\':
        return '\\'
      case '"':
        return '"'
      case '{':
        return '{'
      case 'u': {
        if (this.peek() !== '{') {
          this.addError(
            'E0104',
            "Invalid unicode escape sequence, expected '{'",
            escStart,
            this.pos,
            'Use \\u{XXXX} for unicode escapes'
          )
          return null
        }
        this.advance() // consume {
        const hexStart = this.pos
        while (!this.isAtEnd() && this.peek() !== '}') {
          if (!isHexDigit(this.peek())) {
            this.addError(
              'E0104',
              `Invalid hex digit '${this.peek()}' in unicode escape`,
              escStart,
              this.pos + 1,
              'Unicode escapes must contain only hex digits (0-9, a-f, A-F)'
            )
            return null
          }
          this.advance()
        }
        if (this.isAtEnd()) {
          this.addError(
            'E0104',
            'Unterminated unicode escape sequence',
            escStart,
            this.pos,
            "Add '}' to close the unicode escape"
          )
          return null
        }
        const hex = this.source.content.slice(hexStart, this.pos)
        this.advance() // consume }
        const codePoint = parseInt(hex, 16)
        if (isNaN(codePoint) || codePoint > 0x10ffff) {
          this.addError(
            'E0104',
            `Invalid unicode code point: \\u{${hex}}`,
            escStart,
            this.pos,
            'Unicode code points must be between 0 and 10FFFF'
          )
          return null
        }
        return String.fromCodePoint(codePoint)
      }
      default:
        this.addError(
          'E0104',
          `Invalid escape sequence: \\${ch}`,
          escStart,
          this.pos,
          'Valid escape sequences are: \\n, \\t, \\\\, \\", \\{, \\u{XXXX}'
        )
        return null
    }
  }

  private scanIdentifier(): void {
    const start = this.pos
    while (!this.isAtEnd() && isIdentContinue(this.peek())) {
      this.advance()
    }
    const lexeme = this.source.content.slice(start, this.pos)
    const keywordType = KEYWORDS.get(lexeme)
    if (keywordType !== undefined) {
      this.addToken(keywordType, lexeme, start, this.pos)
    } else {
      this.addToken(TokenType.Ident, lexeme, start, this.pos)
    }
  }

  private scanOperatorOrDelimiter(): void {
    const start = this.pos
    const ch = this.advance()

    switch (ch) {
      case '+':
        this.addToken(TokenType.Plus, '+', start, this.pos)
        break
      case '-':
        if (this.match('>')) {
          this.addToken(TokenType.Arrow, '->', start, this.pos)
        } else {
          this.addToken(TokenType.Minus, '-', start, this.pos)
        }
        break
      case '*':
        this.addToken(TokenType.Star, '*', start, this.pos)
        break
      case '/':
        this.addToken(TokenType.Slash, '/', start, this.pos)
        break
      case '%':
        this.addToken(TokenType.Percent, '%', start, this.pos)
        break
      case '=':
        if (this.match('=')) {
          this.addToken(TokenType.EqEq, '==', start, this.pos)
        } else if (this.match('>')) {
          this.addToken(TokenType.FatArrow, '=>', start, this.pos)
        } else {
          this.addToken(TokenType.Eq, '=', start, this.pos)
        }
        break
      case '!':
        if (this.match('=')) {
          this.addToken(TokenType.BangEq, '!=', start, this.pos)
        } else {
          this.addError(
            'E0105',
            `Unexpected character: '!'`,
            start,
            this.pos,
            "Use 'not' for boolean negation"
          )
        }
        break
      case '<':
        if (this.match('=')) {
          this.addToken(TokenType.LtEq, '<=', start, this.pos)
        } else {
          this.addToken(TokenType.Lt, '<', start, this.pos)
        }
        break
      case '>':
        if (this.match('=')) {
          this.addToken(TokenType.GtEq, '>=', start, this.pos)
        } else {
          this.addToken(TokenType.Gt, '>', start, this.pos)
        }
        break
      case '.':
        if (this.match('.')) {
          if (this.match('=')) {
            this.addToken(TokenType.DotDotEq, '..=', start, this.pos)
          } else if (this.match('.')) {
            this.addToken(TokenType.Spread, '...', start, this.pos)
          } else {
            this.addToken(TokenType.DotDot, '..', start, this.pos)
          }
        } else {
          this.addToken(TokenType.Dot, '.', start, this.pos)
        }
        break
      case '?':
        this.addToken(TokenType.Question, '?', start, this.pos)
        break
      case ':':
        this.addToken(TokenType.Colon, ':', start, this.pos)
        break
      case '(':
        this.addToken(TokenType.LParen, '(', start, this.pos)
        break
      case ')':
        this.addToken(TokenType.RParen, ')', start, this.pos)
        break
      case '{':
        this.addToken(TokenType.LBrace, '{', start, this.pos)
        break
      case '}':
        this.addToken(TokenType.RBrace, '}', start, this.pos)
        break
      case '[':
        this.addToken(TokenType.LBracket, '[', start, this.pos)
        break
      case ']':
        this.addToken(TokenType.RBracket, ']', start, this.pos)
        break
      case ',':
        this.addToken(TokenType.Comma, ',', start, this.pos)
        break
      case '#':
        if (this.match('{')) {
          this.addToken(TokenType.HashBrace, '#{', start, this.pos)
        } else {
          this.addToken(TokenType.Hash, '#', start, this.pos)
        }
        break
      default:
        this.addError(
          'E0105',
          `Unexpected character: '${ch}'`,
          start,
          this.pos,
          'Remove or replace this character'
        )
    }
  }
}

function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9'
}

function isHexDigit(ch: string): boolean {
  return (
    (ch >= '0' && ch <= '9') ||
    (ch >= 'a' && ch <= 'f') ||
    (ch >= 'A' && ch <= 'F')
  )
}

function isIdentStart(ch: string): boolean {
  return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_'
}

function isIdentContinue(ch: string): boolean {
  return isIdentStart(ch) || isDigit(ch)
}
