import { TokenType } from '../lexer/token.ts'
import type { Token } from '../lexer/token.ts'
import type { Stmt, ParseResult, TypeExpr } from './ast.ts'
import { TypeParser } from './parse-types.ts'

// ─── Parser ─────────────────────────────────────────────────────

export class Parser extends TypeParser {

  static parse(tokens: readonly Token[]): ParseResult {
    const parser = new Parser(tokens)
    return parser.parseProgram()
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

  protected parseStatement(): Stmt {
    if (this.check(TokenType.Let)) return this.parseLetDecl()
    if (this.check(TokenType.Const)) return this.parseConstDecl()
    if (this.check(TokenType.Pub)) return this.parsePubDecl()
    if (this.check(TokenType.Fn) && this.isFnDecl()) return this.parseFnDecl(false)
    if (this.check(TokenType.Struct)) return this.parseStructDecl(false)
    if (this.check(TokenType.Enum)) return this.parseEnumDecl(false)
    if (this.check(TokenType.Type)) return this.parseTypeAlias(false)
    if (this.check(TokenType.Impl)) return this.parseImplBlock()
    if (this.check(TokenType.Return)) return this.parseReturnStmt()
    if (this.check(TokenType.For)) return this.parseForLoop()
    if (this.check(TokenType.While)) return this.parseWhileLoop()
    if (this.check(TokenType.Break)) return this.parseBreakStmt()
    if (this.check(TokenType.Continue)) return this.parseContinueStmt()

    return this.parseExprOrAssignment()
  }

  /** Distinguish `fn name(...)` (declaration) from `fn(...)` (closure expression). */
  private isFnDecl(): boolean {
    const next = this.tokens[this.pos + 1]
    return next !== undefined && next.type === TokenType.Ident
  }

  private parseLetDecl(): Stmt {
    const start = this.advance() // consume 'let'
    const mutable = !!this.match(TokenType.Mut)
    const nameToken = this.expect(TokenType.Ident, `Expected variable name after 'let'`)
    const name = nameToken.lexeme

    let typeAnnotation: TypeExpr | undefined
    if (this.match(TokenType.Colon)) {
      typeAnnotation = this.parseTypeAnnotation()
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

    let typeAnnotation: TypeExpr | undefined
    if (this.match(TokenType.Colon)) {
      typeAnnotation = this.parseTypeAnnotation()
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

  private parsePubDecl(): Stmt {
    const start = this.peek()
    this.advance() // consume 'pub'
    if (this.check(TokenType.Fn)) return this.parseFnDecl(true, start.span)
    if (this.check(TokenType.Struct)) return this.parseStructDecl(true, start.span)
    if (this.check(TokenType.Enum)) return this.parseEnumDecl(true, start.span)
    if (this.check(TokenType.Type)) return this.parseTypeAlias(true, start.span)
    this.error('E0201', `Expected 'fn', 'struct', 'enum', or 'type' after 'pub'`, this.peek().span)
    return this.parseFnDecl(true, start.span)
  }

  private parseExprOrAssignment(): Stmt {
    const expr = this.parseExpression()

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

  // ─── Statement detection ──────────────────────────────────

  protected isStatementStart(): boolean {
    const t = this.peek().type
    return (
      t === TokenType.Let ||
      t === TokenType.Const ||
      t === TokenType.Return ||
      t === TokenType.For ||
      t === TokenType.While ||
      t === TokenType.Break ||
      t === TokenType.Continue ||
      t === TokenType.Pub ||
      t === TokenType.Struct ||
      t === TokenType.Enum ||
      t === TokenType.Type ||
      t === TokenType.Impl ||
      (t === TokenType.Fn && this.isFnDecl())
    )
  }
}
