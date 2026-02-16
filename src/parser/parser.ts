import type { Token } from '../lexer/token.ts'
import { TokenType } from '../lexer/token.ts'
import type { Span } from '../common/span.ts'
import type { HalError } from '../errors/hal-error.ts'
import { createError } from '../errors/hal-error.ts'
import type {
  Expr,
  Stmt,
  ParseResult,
  MapEntry,
  StructFieldInit,
} from './ast.ts'

// ─── Precedence levels (Pratt parser) ───────────────────────────

const enum Prec {
  None = 0,
  Assignment = 1,   // =
  Or = 2,           // or
  And = 3,          // and
  Equality = 4,     // == !=
  Comparison = 5,   // < > <= >=
  Range = 6,        // .. ..=
  Addition = 7,     // + -
  Multiplication = 8, // * / %
  Unary = 9,        // - not
  Member = 10,      // . () []
}

/** Map token types to their binary precedence. */
function infixPrecedence(type: TokenType): Prec {
  switch (type) {
    case TokenType.Or:
      return Prec.Or
    case TokenType.And:
      return Prec.And
    case TokenType.EqEq:
    case TokenType.BangEq:
      return Prec.Equality
    case TokenType.Lt:
    case TokenType.Gt:
    case TokenType.LtEq:
    case TokenType.GtEq:
      return Prec.Comparison
    case TokenType.DotDot:
    case TokenType.DotDotEq:
      return Prec.Range
    case TokenType.Plus:
    case TokenType.Minus:
      return Prec.Addition
    case TokenType.Star:
    case TokenType.Slash:
    case TokenType.Percent:
      return Prec.Multiplication
    default:
      return Prec.None
  }
}

// ─── Parser ─────────────────────────────────────────────────────

export class Parser {
  private pos = 0
  private readonly errors: HalError[] = []

  constructor(private readonly tokens: readonly Token[]) {}

  static parse(tokens: readonly Token[]): ParseResult {
    const parser = new Parser(tokens)
    return parser.parseProgram()
  }

  // ─── Token navigation ───────────────────────────────────────

  private peek(): Token {
    return this.tokens[this.pos]
  }

  private advance(): Token {
    const token = this.tokens[this.pos]
    if (token.type !== TokenType.EOF) this.pos++
    return token
  }

  private check(type: TokenType): boolean {
    return this.peek().type === type
  }

  private match(type: TokenType): Token | undefined {
    if (this.check(type)) return this.advance()
    return undefined
  }

  private expect(type: TokenType, message: string): Token {
    if (this.check(type)) return this.advance()
    const token = this.peek()
    this.error(`E0201`, message, token.span)
    return token // return current token to keep going
  }

  private error(code: string, message: string, span: Span, suggestion?: string): void {
    this.errors.push(createError(code, message, span, suggestion))
  }

  private spanFrom(start: Span): Span {
    const prev = this.tokens[this.pos - 1] ?? this.peek()
    return { start: start.start, end: prev.span.end, file: start.file }
  }

  // ─── Program ────────────────────────────────────────────────

  private parseProgram(): ParseResult {
    const statements: Stmt[] = []
    while (!this.check(TokenType.EOF)) {
      statements.push(this.parseStatement())
    }
    return { statements, errors: this.errors }
  }

  // ─── Statements ─────────────────────────────────────────────

  private parseStatement(): Stmt {
    if (this.check(TokenType.Let)) return this.parseLetDecl()
    if (this.check(TokenType.Const)) return this.parseConstDecl()

    // Could be assignment (ident = expr) or expression statement
    return this.parseExprOrAssignment()
  }

  private parseLetDecl(): Stmt {
    const start = this.advance() // consume 'let'
    const mutable = !!this.match(TokenType.Mut)
    const nameToken = this.expect(TokenType.Ident, `Expected variable name after 'let'`)
    const name = nameToken.lexeme

    let typeAnnotation: string | undefined
    if (this.match(TokenType.Colon)) {
      const typeToken = this.expect(TokenType.Ident, `Expected type name after ':'`)
      typeAnnotation = typeToken.lexeme
    }

    this.expect(TokenType.Eq, `Expected '=' in let declaration`)
    const initializer = this.parseExpression()
    return {
      kind: 'LetDecl',
      mutable,
      name,
      typeAnnotation,
      initializer,
      span: this.spanFrom(start.span),
    }
  }

  private parseConstDecl(): Stmt {
    const start = this.advance() // consume 'const'
    const nameToken = this.expect(TokenType.Ident, `Expected constant name after 'const'`)
    const name = nameToken.lexeme

    let typeAnnotation: string | undefined
    if (this.match(TokenType.Colon)) {
      const typeToken = this.expect(TokenType.Ident, `Expected type name after ':'`)
      typeAnnotation = typeToken.lexeme
    }

    this.expect(TokenType.Eq, `Expected '=' in const declaration`)
    const initializer = this.parseExpression()
    return {
      kind: 'ConstDecl',
      name,
      typeAnnotation,
      initializer,
      span: this.spanFrom(start.span),
    }
  }

  private parseExprOrAssignment(): Stmt {
    const expr = this.parseExpression()

    // Check if this is an assignment: `ident = value`
    if (expr.kind === 'Identifier' && this.match(TokenType.Eq)) {
      const value = this.parseExpression()
      return {
        kind: 'Assignment',
        target: expr.name,
        value,
        span: this.spanFrom(expr.span),
      }
    }

    return { kind: 'ExprStatement', expr, span: expr.span }
  }

  // ─── Expressions (Pratt parser) ─────────────────────────────

  parseExpression(minPrec: Prec = Prec.None): Expr {
    let left = this.parsePrefixExpr()

    while (true) {
      const prec = infixPrecedence(this.peek().type)
      if (prec <= minPrec) break
      left = this.parseInfixExpr(left, prec)
    }

    return left
  }

  private parsePrefixExpr(): Expr {
    const token = this.peek()

    switch (token.type) {
      case TokenType.IntLit:
        return this.parseIntLiteral()
      case TokenType.FloatLit:
        return this.parseFloatLiteral()
      case TokenType.StringLit:
        return this.parseStringLiteral()
      case TokenType.StringStart:
        return this.parseStringInterpolation()
      case TokenType.True:
      case TokenType.False:
        return this.parseBoolLiteral()
      case TokenType.Ident:
        return this.parseIdentifier()
      case TokenType.Minus:
      case TokenType.Not:
        return this.parseUnaryExpr()
      case TokenType.LParen:
        return this.parseGroupExpr()
      case TokenType.LBracket:
        return this.parseListLiteral()
      case TokenType.LBrace:
        return this.parseMapOrBlock()
      case TokenType.HashBrace:
        return this.parseSetLiteral()
      default: {
        this.advance() // skip the bad token
        this.error('E0202', `Unexpected token '${token.lexeme}', expected expression`, token.span)
        // Return a synthetic node to keep parsing
        return { kind: 'IntLiteral', value: 0, span: token.span }
      }
    }
  }

  private parseInfixExpr(left: Expr, prec: Prec): Expr {
    const opToken = this.advance()
    const op = opToken.lexeme
    // All binary ops are left-associative (right operand gets same prec)
    const right = this.parseExpression(prec)
    return {
      kind: 'BinaryExpr',
      left,
      op,
      right,
      span: this.spanFrom(left.span),
    }
  }

  // ─── Literals ───────────────────────────────────────────────

  private parseIntLiteral(): Expr {
    const token = this.advance()
    const raw = token.lexeme.replace(/_/g, '')
    return { kind: 'IntLiteral', value: parseInt(raw, 10), span: token.span }
  }

  private parseFloatLiteral(): Expr {
    const token = this.advance()
    const raw = token.lexeme.replace(/_/g, '')
    return { kind: 'FloatLiteral', value: parseFloat(raw), span: token.span }
  }

  private parseStringLiteral(): Expr {
    const token = this.advance()
    // The lexeme includes quotes; strip them for the value
    const raw = token.lexeme
    let value: string
    if (raw.startsWith('"""')) {
      value = raw.slice(3, -3)
    } else {
      value = raw.slice(1, -1)
    }
    return { kind: 'StringLiteral', value, span: token.span }
  }

  private parseStringInterpolation(): Expr {
    const start = this.advance() // StringStart, e.g. "Hello, "
    const segments: (string | Expr)[] = []

    // Extract string part from StringStart (strip leading quote)
    const startValue = start.lexeme.slice(1) // strip opening "
    if (startValue.length > 0) segments.push(startValue)

    while (true) {
      // Parse the interpolated expression
      const expr = this.parseExpression()
      segments.push(expr)

      if (this.check(TokenType.StringEnd)) {
        const end = this.advance()
        // Strip trailing quote from StringEnd
        const endValue = end.lexeme.slice(0, -1)
        if (endValue.length > 0) segments.push(endValue)
        break
      } else if (this.check(TokenType.StringMiddle)) {
        const mid = this.advance()
        if (mid.lexeme.length > 0) segments.push(mid.lexeme)
      } else {
        // Error recovery
        this.error('E0203', 'Unterminated string interpolation', this.peek().span)
        break
      }
    }

    return {
      kind: 'StringInterpolation',
      segments,
      span: this.spanFrom(start.span),
    }
  }

  private parseBoolLiteral(): Expr {
    const token = this.advance()
    return {
      kind: 'BoolLiteral',
      value: token.type === TokenType.True,
      span: token.span,
    }
  }

  private parseIdentifier(): Expr {
    const token = this.advance()
    return { kind: 'Identifier', name: token.lexeme, span: token.span }
  }

  // ─── Unary ──────────────────────────────────────────────────

  private parseUnaryExpr(): Expr {
    const opToken = this.advance()
    const operand = this.parseExpression(Prec.Unary)
    return {
      kind: 'UnaryExpr',
      op: opToken.lexeme,
      operand,
      span: this.spanFrom(opToken.span),
    }
  }

  // ─── Grouping ───────────────────────────────────────────────

  private parseGroupExpr(): Expr {
    const start = this.advance() // consume '('
    const expr = this.parseExpression()
    this.expect(TokenType.RParen, `Expected ')' after expression`)
    return { kind: 'GroupExpr', expr, span: this.spanFrom(start.span) }
  }

  // ─── Collections ────────────────────────────────────────────

  private parseListLiteral(): Expr {
    const start = this.advance() // consume '['
    const elements: Expr[] = []

    while (!this.check(TokenType.RBracket) && !this.check(TokenType.EOF)) {
      elements.push(this.parseExpression())
      if (!this.match(TokenType.Comma)) break
    }

    this.expect(TokenType.RBracket, `Expected ']' after list literal`)
    return { kind: 'ListLiteral', elements, span: this.spanFrom(start.span) }
  }

  /** Disambiguate `{ ... }` — could be a map literal or a block. */
  private parseMapOrBlock(): Expr {
    // Heuristic: if the brace is followed by a string/expr + colon, it's a map.
    // If it starts with `let`, `const`, or is `{ }`, it's a block.
    // Also, `{ }` empty is a block.
    const next = this.tokens[this.pos + 1]

    if (next && next.type === TokenType.RBrace) {
      // Empty block: `{}`
      return this.parseBlock()
    }

    if (next && (next.type === TokenType.Let || next.type === TokenType.Const)) {
      return this.parseBlock()
    }

    // Look ahead: if we see `expr :` pattern, it's a map
    if (this.isMapLiteral()) {
      return this.parseMapLiteral()
    }

    return this.parseBlock()
  }

  private isMapLiteral(): boolean {
    // Simple lookahead: `{ <string> : ...` or `{ <ident> : ...`
    if (this.pos + 2 >= this.tokens.length) return false
    const first = this.tokens[this.pos + 1]
    const second = this.tokens[this.pos + 2]
    return (
      (first.type === TokenType.StringLit || first.type === TokenType.Ident) &&
      second.type === TokenType.Colon
    )
  }

  private parseMapLiteral(): Expr {
    const start = this.advance() // consume '{'
    const entries: MapEntry[] = []

    while (!this.check(TokenType.RBrace) && !this.check(TokenType.EOF)) {
      const key = this.parseExpression()
      this.expect(TokenType.Colon, `Expected ':' in map entry`)
      const value = this.parseExpression()
      entries.push({ key, value })
      if (!this.match(TokenType.Comma)) break
    }

    this.expect(TokenType.RBrace, `Expected '}' after map literal`)
    return { kind: 'MapLiteral', entries, span: this.spanFrom(start.span) }
  }

  private parseSetLiteral(): Expr {
    const start = this.advance() // consume '#{'
    const elements: Expr[] = []

    while (!this.check(TokenType.RBrace) && !this.check(TokenType.EOF)) {
      elements.push(this.parseExpression())
      if (!this.match(TokenType.Comma)) break
    }

    this.expect(TokenType.RBrace, `Expected '}' after set literal`)
    return { kind: 'SetLiteral', elements, span: this.spanFrom(start.span) }
  }

  // ─── Blocks ─────────────────────────────────────────────────

  private parseBlock(): Expr {
    const start = this.advance() // consume '{'
    const statements: Stmt[] = []
    let trailing: Expr | undefined

    while (!this.check(TokenType.RBrace) && !this.check(TokenType.EOF)) {
      // Try parsing a statement
      if (this.check(TokenType.Let) || this.check(TokenType.Const)) {
        statements.push(this.parseStatement())
      } else {
        // Parse expression; it might be a trailing expression or an expr statement
        const expr = this.parseExpression()

        if (this.check(TokenType.RBrace)) {
          // This expression is the trailing expression of the block
          trailing = expr
        } else if (expr.kind === 'Identifier' && this.match(TokenType.Eq)) {
          // Assignment inside block
          const value = this.parseExpression()
          statements.push({
            kind: 'Assignment',
            target: expr.name,
            value,
            span: this.spanFrom(expr.span),
          })
        } else {
          statements.push({ kind: 'ExprStatement', expr, span: expr.span })
        }
      }
    }

    this.expect(TokenType.RBrace, `Expected '}' after block`)
    return {
      kind: 'BlockExpr',
      statements,
      trailing,
      span: this.spanFrom(start.span),
    }
  }
}
