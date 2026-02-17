import { TokenType } from '../lexer/token.ts'
import type { Expr, Stmt, MapEntry, CallArg } from './ast.ts'
import { ParserBase } from './parser-base.ts'

// ─── Precedence levels ──────────────────────────────────────────

export const Prec = {
  None: 0,
  Assignment: 1,   // =
  Or: 2,           // or
  And: 3,          // and
  Equality: 4,     // == !=
  Comparison: 5,   // < > <= >=
  Range: 6,        // .. ..=
  Addition: 7,     // + -
  Multiplication: 8, // * / %
  Unary: 9,        // - not
  Postfix: 10,     // . () [] ?
} as const

export type Prec = (typeof Prec)[keyof typeof Prec]

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

/** Check if a token type starts a postfix operator. */
function isPostfix(type: TokenType): boolean {
  return (
    type === TokenType.Dot ||
    type === TokenType.LParen ||
    type === TokenType.LBracket ||
    type === TokenType.Question
  )
}

/**
 * Expression parsing: Pratt parser, literals, collections, blocks.
 * Declares abstract methods for parsing constructs defined in subclasses.
 */
export abstract class ExpressionParser extends ParserBase {

  // ─── Abstract methods (implemented by subclasses) ──────────

  protected abstract parseClosureLiteral(): Expr
  protected abstract parseIfExpr(): Expr
  protected abstract parseMatchExpr(): Expr
  protected abstract parseConcurrentBlock(): Expr
  protected abstract parseStatement(): Stmt
  protected abstract isStatementStart(): boolean
  protected abstract parseStructLiteral(name: string, startSpan: import('../common/span.ts').Span): Expr

  // ─── Pratt parser core ─────────────────────────────────────

  parseExpression(minPrec: Prec = Prec.None): Expr {
    let left = this.parsePrefixExpr()

    while (true) {
      if (isPostfix(this.peek().type)) {
        left = this.parsePostfixExpr(left)
        continue
      }

      const prec = infixPrecedence(this.peek().type)
      if (prec <= minPrec) break
      left = this.parseInfixExpr(left, prec)
    }

    return left
  }

  protected parsePrefixExpr(): Expr {
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
      case TokenType.Fn:
        return this.parseClosureLiteral()
      case TokenType.If:
        return this.parseIfExpr()
      case TokenType.Match:
        return this.parseMatchExpr()
      case TokenType.Concurrent:
        return this.parseConcurrentBlock()
      default: {
        this.advance()
        this.error('E0202', `Unexpected token '${token.lexeme}', expected expression`, token.span)
        return { kind: 'IntLiteral', value: 0, span: token.span }
      }
    }
  }

  private parseInfixExpr(left: Expr, prec: Prec): Expr {
    const opToken = this.advance()
    const right = this.parseExpression(prec)
    return {
      kind: 'BinaryExpr',
      left,
      op: opToken.lexeme,
      right,
      span: this.spanFrom(left.span),
    }
  }

  // ─── Postfix operators ─────────────────────────────────────

  private parsePostfixExpr(left: Expr): Expr {
    switch (this.peek().type) {
      case TokenType.Dot:
        return this.parseDotAccess(left)
      case TokenType.LParen:
        return this.parseFnCallExpr(left)
      case TokenType.LBracket:
        return this.parseIndexAccessExpr(left)
      case TokenType.Question:
        return this.parseErrorPropagation(left)
      default:
        return left
    }
  }

  private parseDotAccess(receiver: Expr): Expr {
    this.advance() // consume '.'
    const nameToken = this.expect(TokenType.Ident, `Expected field or method name after '.'`)
    const name = nameToken.lexeme

    if (this.check(TokenType.LParen)) {
      this.advance() // consume '('
      const args = this.parseArgList()
      this.expect(TokenType.RParen, `Expected ')' after method arguments`)
      return {
        kind: 'MethodCall',
        receiver,
        method: name,
        args,
        span: this.spanFrom(receiver.span),
      }
    }

    return {
      kind: 'FieldAccess',
      receiver,
      field: name,
      span: this.spanFrom(receiver.span),
    }
  }

  private parseFnCallExpr(callee: Expr): Expr {
    this.advance() // consume '('
    const args = this.parseArgList()
    this.expect(TokenType.RParen, `Expected ')' after arguments`)
    return {
      kind: 'FnCall',
      callee,
      args,
      span: this.spanFrom(callee.span),
    }
  }

  protected parseArgList(): CallArg[] {
    const args: CallArg[] = []
    while (!this.check(TokenType.RParen) && !this.check(TokenType.EOF)) {
      let name: string | undefined
      if (
        this.peek().type === TokenType.Ident &&
        this.pos + 1 < this.tokens.length &&
        this.tokens[this.pos + 1].type === TokenType.Colon
      ) {
        name = this.advance().lexeme
        this.advance() // consume ':'
      }
      const value = this.parseExpression()
      args.push({ name, value })
      if (!this.match(TokenType.Comma)) break
    }
    return args
  }

  private parseIndexAccessExpr(receiver: Expr): Expr {
    this.advance() // consume '['
    const index = this.parseExpression()
    this.expect(TokenType.RBracket, `Expected ']' after index`)
    return {
      kind: 'IndexAccess',
      receiver,
      index,
      span: this.spanFrom(receiver.span),
    }
  }

  private parseErrorPropagation(expr: Expr): Expr {
    this.advance() // consume '?'
    return {
      kind: 'ErrorPropagation',
      expr,
      span: this.spanFrom(expr.span),
    }
  }

  // ─── Literals ──────────────────────────────────────────────

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
    const start = this.advance() // StringStart
    const segments: (string | Expr)[] = []

    const startValue = start.lexeme.slice(1) // strip opening "
    if (startValue.length > 0) segments.push(startValue)

    while (true) {
      const expr = this.parseExpression()
      segments.push(expr)

      if (this.check(TokenType.StringEnd)) {
        const end = this.advance()
        const endValue = end.lexeme.slice(0, -1)
        if (endValue.length > 0) segments.push(endValue)
        break
      } else if (this.check(TokenType.StringMiddle)) {
        const mid = this.advance()
        if (mid.lexeme.length > 0) segments.push(mid.lexeme)
      } else {
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

  protected parseIdentifier(): Expr {
    const token = this.advance()

    // Struct literal: UpperCaseName { field: value }
    if (
      this.check(TokenType.LBrace) &&
      token.lexeme[0] >= 'A' && token.lexeme[0] <= 'Z' &&
      this.isStructLiteralLookahead()
    ) {
      return this.parseStructLiteral(token.lexeme, token.span)
    }

    return { kind: 'Identifier', name: token.lexeme, span: token.span }
  }

  /**
   * Lookahead to distinguish struct literal `Name { field: value }` from
   * block following an identifier.
   */
  private isStructLiteralLookahead(): boolean {
    const bracePos = this.pos
    if (bracePos + 1 >= this.tokens.length) return false
    const afterBrace = this.tokens[bracePos + 1]
    if (afterBrace.type === TokenType.Spread) return true
    if (afterBrace.type === TokenType.RBrace) return true
    if (bracePos + 2 >= this.tokens.length) return false
    return afterBrace.type === TokenType.Ident && this.tokens[bracePos + 2].type === TokenType.Colon
  }

  // ─── Unary ─────────────────────────────────────────────────

  protected parseUnaryExpr(): Expr {
    const opToken = this.advance()
    const operand = this.parseExpression(Prec.Unary)
    return {
      kind: 'UnaryExpr',
      op: opToken.lexeme,
      operand,
      span: this.spanFrom(opToken.span),
    }
  }

  // ─── Grouping ──────────────────────────────────────────────

  private parseGroupExpr(): Expr {
    const start = this.advance() // consume '('
    const expr = this.parseExpression()
    this.expect(TokenType.RParen, `Expected ')' after expression`)
    return { kind: 'GroupExpr', expr, span: this.spanFrom(start.span) }
  }

  // ─── Collections ──────────────────────────────────────────

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
    const next = this.tokens[this.pos + 1]

    if (next && next.type === TokenType.RBrace) {
      return this.parseBlock()
    }

    if (next && (next.type === TokenType.Let || next.type === TokenType.Const)) {
      return this.parseBlock()
    }

    if (this.isMapLiteral()) {
      return this.parseMapLiteral()
    }

    return this.parseBlock()
  }

  private isMapLiteral(): boolean {
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

  // ─── Blocks ────────────────────────────────────────────────

  /** Parse a block expression `{ ... }` — used when we know it's a block. */
  protected parseBlockExpr(): Expr {
    return this.parseBlock()
  }

  protected parseBlock(): Expr {
    const start = this.advance() // consume '{'
    const statements: Stmt[] = []
    let trailing: Expr | undefined

    while (!this.check(TokenType.RBrace) && !this.check(TokenType.EOF)) {
      if (this.isStatementStart()) {
        statements.push(this.parseStatement())
      } else {
        const expr = this.parseExpression()

        if (this.check(TokenType.RBrace)) {
          trailing = expr
        } else if (expr.kind === 'Identifier' && this.match(TokenType.Eq)) {
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
