import { TokenType } from '../lexer/token.ts'
import type { Span } from '../common/span.ts'
import type { Expr, Stmt, Param, TypeExpr } from './ast.ts'
import { ControlFlowParser } from './parse-control-flow.ts'

/**
 * Function parsing: fn declarations, closures, parameter lists.
 * Declares abstract methods for type-related constructs defined in subclasses.
 */
export abstract class FunctionParser extends ControlFlowParser {

  // ─── Abstract methods (implemented by subclasses) ──────────

  protected abstract parseTypeAnnotation(): TypeExpr
  protected abstract parseGenericParams(): import('./ast.ts').GenericParam[]

  // ─── Function Declarations ────────────────────────────────

  protected parseFnDecl(pub: boolean, startSpan?: Span): Stmt {
    const fnToken = this.advance() // consume 'fn'
    const start = startSpan ?? fnToken.span
    const nameToken = this.expect(TokenType.Ident, `Expected function name after 'fn'`)
    const name = nameToken.lexeme

    // Generic parameters
    const genericParams = this.check(TokenType.Lt) ? this.parseGenericParams() : []

    // Parameters
    this.expect(TokenType.LParen, `Expected '(' after function name`)
    const params = this.parseParamList()
    this.expect(TokenType.RParen, `Expected ')' after parameters`)

    // Return type
    let returnType: TypeExpr | undefined
    if (this.match(TokenType.Arrow)) {
      returnType = this.parseTypeAnnotation()
    }

    // Effects clause: effects [Io, Network]
    let effects: string[] | undefined
    if (this.match(TokenType.Effects)) {
      effects = this.parseBracketedNames()
    }

    // Forbids clause: forbids [Network]
    let forbids: string[] | undefined
    if (this.match(TokenType.Forbids)) {
      forbids = this.parseBracketedNames()
    }

    // Contracts (before body)
    const preconditions: Expr[] = []
    const postconditions: { name?: string; body: Expr }[] = []
    while (this.check(TokenType.Precondition) || this.check(TokenType.Postcondition)) {
      if (this.match(TokenType.Precondition)) {
        preconditions.push(this.parseBlockExpr())
      } else {
        this.advance() // consume 'postcondition'
        let name: string | undefined
        if (this.match(TokenType.LParen)) {
          const ident = this.expect(TokenType.Ident, `Expected result name in postcondition`)
          name = ident.lexeme
          this.expect(TokenType.RParen, `Expected ')' after postcondition result name`)
        }
        const body = this.parseBlockExpr()
        postconditions.push({ name, body })
      }
    }

    // Body
    if (!this.check(TokenType.LBrace)) {
      this.error('E0204', `Expected '{' for function body`, this.peek().span,
        `Add a function body: { ... }`)
      return {
        kind: 'FnDecl',
        pub,
        name,
        genericParams,
        params,
        returnType,
        effects,
        forbids,
        preconditions,
        postconditions,
        body: { kind: 'BlockExpr', statements: [], span: this.peek().span },
        span: this.spanFrom(start),
      }
    }
    const body = this.parseBlockExpr()

    return {
      kind: 'FnDecl',
      pub,
      name,
      genericParams,
      params,
      returnType,
      effects,
      forbids,
      preconditions,
      postconditions,
      body,
      span: this.spanFrom(start),
    }
  }

  // ─── Parameter List ───────────────────────────────────────

  protected parseParamList(): Param[] {
    const params: Param[] = []
    while (!this.check(TokenType.RParen) && !this.check(TokenType.EOF)) {
      // Handle `self` parameter
      if (this.check(TokenType.Ident) && this.peek().lexeme === 'self') {
        const nameToken = this.advance()
        params.push({ mutable: false, name: nameToken.lexeme })
        if (!this.match(TokenType.Comma)) break
        continue
      }
      const mutable = !!this.match(TokenType.Mut)
      const nameToken = this.expect(TokenType.Ident, `Expected parameter name`)
      let type: TypeExpr | undefined
      if (this.match(TokenType.Colon)) {
        type = this.parseTypeAnnotation()
      }
      params.push({ mutable, name: nameToken.lexeme, type })
      if (!this.match(TokenType.Comma)) break
    }
    return params
  }

  // ─── Closures ─────────────────────────────────────────────

  protected parseClosureLiteral(): Expr {
    const start = this.advance() // consume 'fn'
    this.expect(TokenType.LParen, `Expected '(' after 'fn' in closure`)
    const params = this.parseParamList()
    this.expect(TokenType.RParen, `Expected ')' after closure parameters`)

    let returnType: TypeExpr | undefined
    if (this.match(TokenType.Arrow)) {
      returnType = this.parseTypeAnnotation()
    }

    const body = this.parseBlockExpr()
    return {
      kind: 'ClosureLiteral',
      params,
      returnType,
      body,
      span: this.spanFrom(start.span),
    }
  }
}
