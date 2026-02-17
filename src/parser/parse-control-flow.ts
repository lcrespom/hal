import { TokenType } from '../lexer/token.ts'
import type { Expr, Stmt, MatchArm, Pattern, PatternField } from './ast.ts'
import { ExpressionParser } from './parse-expressions.ts'

/**
 * Control flow parsing: if/else, match/case, patterns, loops, concurrent.
 * Declares abstract methods for constructs defined in subclasses.
 */
export abstract class ControlFlowParser extends ExpressionParser {

  // ─── Abstract methods (implemented by subclasses) ──────────

  protected abstract parseFnDecl(pub: boolean, startSpan?: import('../common/span.ts').Span): Stmt
  protected abstract parseParamList(): import('./ast.ts').Param[]

  // ─── If / Else ──────────────────────────────────────────────

  protected parseIfExpr(): Expr {
    const start = this.advance() // consume 'if'
    const condition = this.parseExpression()
    const then = this.parseBlockExpr()

    const elseIfs: { condition: Expr; body: Expr }[] = []
    let elseBody: Expr | undefined

    while (this.match(TokenType.Else)) {
      if (this.check(TokenType.If)) {
        this.advance() // consume 'if'
        const elifCondition = this.parseExpression()
        const elifBody = this.parseBlockExpr()
        elseIfs.push({ condition: elifCondition, body: elifBody })
      } else {
        elseBody = this.parseBlockExpr()
        break
      }
    }

    return {
      kind: 'IfExpr',
      condition,
      then,
      elseIfs,
      elseBody,
      span: this.spanFrom(start.span),
    }
  }

  // ─── Match ──────────────────────────────────────────────────

  protected parseMatchExpr(): Expr {
    const start = this.advance() // consume 'match'
    const subject = this.parseExpression()
    this.expect(TokenType.LBrace, `Expected '{' after match subject`)

    const arms: MatchArm[] = []
    while (this.check(TokenType.Case) && !this.check(TokenType.EOF)) {
      arms.push(this.parseMatchArm())
    }

    this.expect(TokenType.RBrace, `Expected '}' after match arms`)
    return {
      kind: 'MatchExpr',
      subject,
      arms,
      span: this.spanFrom(start.span),
    }
  }

  private parseMatchArm(): MatchArm {
    this.expect(TokenType.Case, `Expected 'case' in match arm`)
    const pattern = this.parsePattern()

    let guard: Expr | undefined
    if (this.match(TokenType.If)) {
      guard = this.parseExpression()
    }

    this.expect(TokenType.FatArrow, `Expected '=>' after match pattern`)
    const body = this.parseExpression()

    return { pattern, guard, body }
  }

  // ─── Patterns ───────────────────────────────────────────────

  protected parsePattern(): Pattern {
    const token = this.peek()

    // Wildcard: _
    if (token.type === TokenType.Ident && token.lexeme === '_') {
      const t = this.advance()
      return { kind: 'WildcardPattern', span: t.span }
    }

    // Literal patterns: int, float, string, bool
    if (
      token.type === TokenType.IntLit ||
      token.type === TokenType.FloatLit ||
      token.type === TokenType.StringLit ||
      token.type === TokenType.True ||
      token.type === TokenType.False
    ) {
      const value = this.parsePrefixExpr()
      return { kind: 'LiteralPattern', value, span: value.span }
    }

    // Negative literal: -42
    if (token.type === TokenType.Minus) {
      const value = this.parseUnaryExpr()
      return { kind: 'LiteralPattern', value, span: value.span }
    }

    // Identifier-based patterns: binding, enum variant, struct
    if (token.type === TokenType.Ident) {
      const name = this.advance().lexeme

      // Enum pattern: Name.Variant or Name.Variant(fields)
      if (this.match(TokenType.Dot)) {
        const variantToken = this.expect(TokenType.Ident, `Expected variant name after '.'`)
        const variant = variantToken.lexeme
        let fields: PatternField[] = []
        if (this.match(TokenType.LParen)) {
          fields = this.parsePatternFields()
          this.expect(TokenType.RParen, `Expected ')' after enum pattern fields`)
        }
        return {
          kind: 'EnumPattern',
          name,
          variant,
          fields,
          span: this.spanFrom(token.span),
        }
      }

      // Struct pattern: Name { fields }
      if (this.check(TokenType.LBrace)) {
        this.advance() // consume '{'
        const fields = this.parsePatternFields()
        this.expect(TokenType.RBrace, `Expected '}' after struct pattern fields`)
        return {
          kind: 'StructPattern',
          name,
          fields,
          span: this.spanFrom(token.span),
        }
      }

      // Simple binding pattern
      return { kind: 'BindingPattern', name, span: token.span }
    }

    // Fallback
    this.advance()
    this.error('E0205', `Unexpected token '${token.lexeme}' in pattern`, token.span)
    return { kind: 'WildcardPattern', span: token.span }
  }

  private parsePatternFields(): PatternField[] {
    const fields: PatternField[] = []
    while (
      !this.check(TokenType.RParen) &&
      !this.check(TokenType.RBrace) &&
      !this.check(TokenType.EOF)
    ) {
      const nameToken = this.expect(TokenType.Ident, `Expected field name in pattern`)
      fields.push({ name: nameToken.lexeme })
      if (!this.match(TokenType.Comma)) break
    }
    return fields
  }

  // ─── Loops ──────────────────────────────────────────────────

  protected parseForLoop(): Stmt {
    const start = this.advance() // consume 'for'

    // Pattern: simple ident or (a, b) tuple destructuring
    let pattern: string | string[]
    if (this.match(TokenType.LParen)) {
      const names: string[] = []
      while (!this.check(TokenType.RParen) && !this.check(TokenType.EOF)) {
        const ident = this.expect(TokenType.Ident, `Expected variable name in for pattern`)
        names.push(ident.lexeme)
        if (!this.match(TokenType.Comma)) break
      }
      this.expect(TokenType.RParen, `Expected ')' after for pattern`)
      pattern = names
    } else {
      const ident = this.expect(TokenType.Ident, `Expected variable name after 'for'`)
      pattern = ident.lexeme
    }

    this.expect(TokenType.In, `Expected 'in' after for pattern`)
    const iterable = this.parseExpression()
    const body = this.parseBlockExpr()
    return { kind: 'ForLoop', pattern, iterable, body, span: this.spanFrom(start.span) }
  }

  protected parseWhileLoop(): Stmt {
    const start = this.advance() // consume 'while'
    const condition = this.parseExpression()
    const body = this.parseBlockExpr()
    return { kind: 'WhileLoop', condition, body, span: this.spanFrom(start.span) }
  }

  protected parseBreakStmt(): Stmt {
    const token = this.advance()
    return { kind: 'BreakStmt', span: token.span }
  }

  protected parseContinueStmt(): Stmt {
    const token = this.advance()
    return { kind: 'ContinueStmt', span: token.span }
  }

  protected parseReturnStmt(): Stmt {
    const start = this.advance() // consume 'return'
    let value: Expr | undefined
    if (!this.check(TokenType.RBrace) && !this.check(TokenType.EOF)) {
      value = this.parseExpression()
    }
    return { kind: 'ReturnStmt', value, span: this.spanFrom(start.span) }
  }

  // ─── Concurrent ─────────────────────────────────────────────

  protected parseConcurrentBlock(): Expr {
    const start = this.advance() // consume 'concurrent'
    this.expect(TokenType.LBrace, `Expected '{' after 'concurrent'`)

    const exprs: Expr[] = []
    while (!this.check(TokenType.RBrace) && !this.check(TokenType.EOF)) {
      exprs.push(this.parseExpression())
    }

    this.expect(TokenType.RBrace, `Expected '}' after concurrent block`)
    return {
      kind: 'ConcurrentBlock',
      exprs,
      span: this.spanFrom(start.span),
    }
  }
}
