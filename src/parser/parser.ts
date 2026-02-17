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
  CallArg,
  MatchArm,
  Pattern,
  PatternField,
  Param,
  TypeExpr,
  GenericParam,
  StructField,
  EnumVariant,
  WherePredicate,
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
  Postfix = 10,     // . () [] ?
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
    // Postfix operators handled separately
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
    // fn <ident> => declaration; fn ( => closure
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

  private parseFnDecl(pub: boolean, startSpan?: Span): Stmt {
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
        // Optional result binding: postcondition(result) { ... }
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
      // Return a minimal FnDecl to keep parsing
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

  private parseParamList(): Param[] {
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

  private parseBracketedNames(): string[] {
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

  private parseReturnStmt(): Stmt {
    const start = this.advance() // consume 'return'
    let value: Expr | undefined
    // If the next token could start an expression, parse it
    if (!this.check(TokenType.RBrace) && !this.check(TokenType.EOF)) {
      value = this.parseExpression()
    }
    return { kind: 'ReturnStmt', value, span: this.spanFrom(start.span) }
  }

  private parseForLoop(): Stmt {
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

  private parseWhileLoop(): Stmt {
    const start = this.advance() // consume 'while'
    const condition = this.parseExpression()
    const body = this.parseBlockExpr()
    return { kind: 'WhileLoop', condition, body, span: this.spanFrom(start.span) }
  }

  private parseBreakStmt(): Stmt {
    const token = this.advance()
    return { kind: 'BreakStmt', span: token.span }
  }

  private parseContinueStmt(): Stmt {
    const token = this.advance()
    return { kind: 'ContinueStmt', span: token.span }
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
      // Check postfix operators first (highest precedence)
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
      case TokenType.Fn:
        return this.parseClosureLiteral()
      case TokenType.If:
        return this.parseIfExpr()
      case TokenType.Match:
        return this.parseMatchExpr()
      case TokenType.Concurrent:
        return this.parseConcurrentBlock()
      default: {
        this.advance() // skip the bad token
        this.error('E0202', `Unexpected token '${token.lexeme}', expected expression`, token.span)
        return { kind: 'IntLiteral', value: 0, span: token.span }
      }
    }
  }

  private parseInfixExpr(left: Expr, prec: Prec): Expr {
    const opToken = this.advance()
    const op = opToken.lexeme
    const right = this.parseExpression(prec)
    return {
      kind: 'BinaryExpr',
      left,
      op,
      right,
      span: this.spanFrom(left.span),
    }
  }

  // ─── Postfix operators ──────────────────────────────────────

  private parsePostfixExpr(left: Expr): Expr {
    const token = this.peek()

    switch (token.type) {
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

    // If followed by '(', it's a method call
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

  private parseArgList(): CallArg[] {
    const args: CallArg[] = []
    while (!this.check(TokenType.RParen) && !this.check(TokenType.EOF)) {
      // Check for named argument: `name: value`
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
    const qToken = this.advance() // consume '?'
    return {
      kind: 'ErrorPropagation',
      expr,
      span: this.spanFrom(expr.span),
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

  private parseIdentifier(): Expr {
    const token = this.advance()

    // Struct literal: UpperCaseName { field: value }
    // Only treat as struct literal if name starts with uppercase
    if (
      this.check(TokenType.LBrace) &&
      token.lexeme[0] >= 'A' && token.lexeme[0] <= 'Z' &&
      this.isStructLiteral()
    ) {
      return this.parseStructLiteral(token.lexeme, token.span)
    }

    return { kind: 'Identifier', name: token.lexeme, span: token.span }
  }

  /**
   * Lookahead to distinguish struct literal `Name { field: value }` from
   * block following an identifier. We look for `{ ident : ` or `{ ... ` patterns.
   */
  private isStructLiteral(): boolean {
    // Look ahead: { <ident> : or { ...
    const bracePos = this.pos // pointing at '{'
    if (bracePos + 1 >= this.tokens.length) return false
    const afterBrace = this.tokens[bracePos + 1]
    if (afterBrace.type === TokenType.Spread) return true
    if (afterBrace.type === TokenType.RBrace) return true // empty struct
    if (bracePos + 2 >= this.tokens.length) return false
    return afterBrace.type === TokenType.Ident && this.tokens[bracePos + 2].type === TokenType.Colon
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

  // ─── Closures ───────────────────────────────────────────────

  private parseClosureLiteral(): Expr {
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

  // ─── If / Else ──────────────────────────────────────────────

  private parseIfExpr(): Expr {
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

  private parseMatchExpr(): Expr {
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

  private parsePattern(): Pattern {
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

  // ─── Type Annotations ───────────────────────────────────────

  private parseTypeAnnotation(): TypeExpr {
    const token = this.peek()

    // Function type: fn(Int, Int) -> Int
    if (this.check(TokenType.Fn)) {
      return this.parseFnType()
    }

    const nameToken = this.expect(TokenType.Ident, `Expected type name`)
    const name = nameToken.lexeme

    // Generic type: List<Int>, Map<String, Int>
    if (this.check(TokenType.Lt)) {
      return this.parseGenericType(name, nameToken.span)
    }

    // Named/Primitive type
    return { kind: 'NamedType', name, span: nameToken.span }
  }

  private parseFnType(): TypeExpr {
    const start = this.advance() // consume 'fn'
    this.expect(TokenType.LParen, `Expected '(' in function type`)
    const params: TypeExpr[] = []
    while (!this.check(TokenType.RParen) && !this.check(TokenType.EOF)) {
      params.push(this.parseTypeAnnotation())
      if (!this.match(TokenType.Comma)) break
    }
    this.expect(TokenType.RParen, `Expected ')' in function type`)
    this.expect(TokenType.Arrow, `Expected '->' in function type`)
    const returnType = this.parseTypeAnnotation()
    return {
      kind: 'FnType',
      params,
      returnType,
      span: this.spanFrom(start.span),
    }
  }

  private parseGenericType(name: string, startSpan: Span): TypeExpr {
    this.advance() // consume '<'
    const args: TypeExpr[] = []
    while (!this.check(TokenType.Gt) && !this.check(TokenType.EOF)) {
      args.push(this.parseTypeAnnotation())
      if (!this.match(TokenType.Comma)) break
    }
    this.expect(TokenType.Gt, `Expected '>' after generic type arguments`)
    return {
      kind: 'GenericType',
      name,
      args,
      span: this.spanFrom(startSpan),
    }
  }

  // ─── Generic Parameters ───────────────────────────────────

  private parseGenericParams(): GenericParam[] {
    this.advance() // consume '<'
    const params: GenericParam[] = []
    while (!this.check(TokenType.Gt) && !this.check(TokenType.EOF)) {
      const nameToken = this.expect(TokenType.Ident, `Expected generic parameter name`)
      const bounds: string[] = []
      if (this.match(TokenType.Colon)) {
        bounds.push(this.expect(TokenType.Ident, `Expected trait bound`).lexeme)
        while (this.match(TokenType.Plus)) {
          bounds.push(this.expect(TokenType.Ident, `Expected trait bound after '+'`).lexeme)
        }
      }
      params.push({ name: nameToken.lexeme, bounds })
      if (!this.match(TokenType.Comma)) break
    }
    this.expect(TokenType.Gt, `Expected '>' after generic parameters`)
    return params
  }

  /** Skip over generic type arguments like `<T>` or `<A, B>` without building AST. */
  private skipGenericArgs(): void {
    this.advance() // consume '<'
    let depth = 1
    while (depth > 0 && !this.check(TokenType.EOF)) {
      if (this.check(TokenType.Lt)) depth++
      else if (this.check(TokenType.Gt)) depth--
      if (depth > 0) this.advance()
    }
    if (this.check(TokenType.Gt)) this.advance()
  }

  private parseWhereClause(): WherePredicate[] {
    const predicates: WherePredicate[] = []
    this.advance() // consume 'where'
    while (this.check(TokenType.Ident) && !this.check(TokenType.LBrace) && !this.check(TokenType.EOF)) {
      const typeName = this.expect(TokenType.Ident, `Expected type name in where clause`).lexeme
      this.expect(TokenType.Colon, `Expected ':' in where clause`)
      const bounds: string[] = []
      bounds.push(this.expect(TokenType.Ident, `Expected trait bound`).lexeme)
      while (this.match(TokenType.Plus)) {
        bounds.push(this.expect(TokenType.Ident, `Expected trait bound after '+'`).lexeme)
      }
      predicates.push({ typeName, bounds })
      if (!this.match(TokenType.Comma)) break
    }
    return predicates
  }

  // ─── Struct Declaration ─────────────────────────────────────

  private parseStructDecl(pub: boolean, startSpan?: Span): Stmt {
    const structToken = this.advance() // consume 'struct'
    const start = startSpan ?? structToken.span
    const nameToken = this.expect(TokenType.Ident, `Expected struct name after 'struct'`)
    const name = nameToken.lexeme

    const genericParams = this.check(TokenType.Lt) ? this.parseGenericParams() : []

    this.expect(TokenType.LBrace, `Expected '{' after struct name`)

    const fields: StructField[] = []
    const invariants: Expr[] = []
    let derive: string[] = []

    while (!this.check(TokenType.RBrace) && !this.check(TokenType.EOF)) {
      if (this.match(TokenType.Invariant)) {
        invariants.push(this.parseBlockExpr())
      } else if (this.match(TokenType.Derive)) {
        derive = this.parseBracketedNames()
      } else {
        // Field: name: Type
        const fieldName = this.expect(TokenType.Ident, `Expected field name`)
        this.expect(TokenType.Colon, `Expected ':' after field name`)
        const fieldType = this.parseTypeAnnotation()
        fields.push({ name: fieldName.lexeme, type: fieldType })
        this.match(TokenType.Comma) // optional comma
      }
    }

    this.expect(TokenType.RBrace, `Expected '}' after struct body`)
    return {
      kind: 'StructDecl',
      pub,
      name,
      genericParams,
      fields,
      invariants,
      derive,
      span: this.spanFrom(start),
    }
  }

  // ─── Enum Declaration ──────────────────────────────────────

  private parseEnumDecl(pub: boolean, startSpan?: Span): Stmt {
    const enumToken = this.advance() // consume 'enum'
    const start = startSpan ?? enumToken.span
    const nameToken = this.expect(TokenType.Ident, `Expected enum name after 'enum'`)
    const name = nameToken.lexeme

    const genericParams = this.check(TokenType.Lt) ? this.parseGenericParams() : []

    this.expect(TokenType.LBrace, `Expected '{' after enum name`)

    const variants: EnumVariant[] = []
    const seenNames = new Set<string>()

    while (!this.check(TokenType.RBrace) && !this.check(TokenType.EOF)) {
      const variantName = this.expect(TokenType.Ident, `Expected variant name`)

      if (seenNames.has(variantName.lexeme)) {
        this.error('E0206', `Duplicate variant name '${variantName.lexeme}'`, variantName.span)
      }
      seenNames.add(variantName.lexeme)

      const variantFields: StructField[] = []
      if (this.match(TokenType.LParen)) {
        while (!this.check(TokenType.RParen) && !this.check(TokenType.EOF)) {
          const fieldName = this.expect(TokenType.Ident, `Expected field name`)
          this.expect(TokenType.Colon, `Expected ':' after field name`)
          const fieldType = this.parseTypeAnnotation()
          variantFields.push({ name: fieldName.lexeme, type: fieldType })
          if (!this.match(TokenType.Comma)) break
        }
        this.expect(TokenType.RParen, `Expected ')' after variant fields`)
      }

      variants.push({ name: variantName.lexeme, fields: variantFields })
      this.match(TokenType.Comma) // optional comma
    }

    this.expect(TokenType.RBrace, `Expected '}' after enum body`)
    return {
      kind: 'EnumDecl',
      pub,
      name,
      genericParams,
      variants,
      span: this.spanFrom(start),
    }
  }

  // ─── Type Alias ────────────────────────────────────────────

  private parseTypeAlias(pub: boolean, startSpan?: Span): Stmt {
    const typeToken = this.advance() // consume 'type'
    const start = startSpan ?? typeToken.span
    const nameToken = this.expect(TokenType.Ident, `Expected type name after 'type'`)
    const name = nameToken.lexeme

    const genericParams = this.check(TokenType.Lt) ? this.parseGenericParams() : []

    this.expect(TokenType.Eq, `Expected '=' in type alias`)
    const type = this.parseTypeAnnotation()
    return {
      kind: 'TypeAlias',
      pub,
      name,
      genericParams,
      type,
      span: this.spanFrom(start),
    }
  }

  // ─── Impl Block ────────────────────────────────────────────

  private parseImplBlock(): Stmt {
    const start = this.advance() // consume 'impl'

    const genericParams = this.check(TokenType.Lt) ? this.parseGenericParams() : []

    const firstName = this.expect(TokenType.Ident, `Expected type name after 'impl'`).lexeme

    let traitName: string | undefined
    let targetType: string

    // Skip generic type args on first name (e.g., impl<T> Foo<T> or impl Trait for Foo<T>)
    if (this.check(TokenType.Lt)) {
      // Skip past the generic args — they're for the impl target type
      this.skipGenericArgs()
    }

    // impl Trait for Type { ... } vs impl Type { ... }
    if (this.match(TokenType.For)) {
      traitName = firstName
      targetType = this.expect(TokenType.Ident, `Expected type name after 'for'`).lexeme
      // Skip generic args on target type
      if (this.check(TokenType.Lt)) {
        this.skipGenericArgs()
      }
    } else {
      targetType = firstName
    }

    const whereClause = this.check(TokenType.Where) ? this.parseWhereClause() : []

    this.expect(TokenType.LBrace, `Expected '{' after impl header`)

    const methods: import('./ast.ts').FnDecl[] = []
    while (!this.check(TokenType.RBrace) && !this.check(TokenType.EOF)) {
      const pub = !!this.match(TokenType.Pub)
      if (this.check(TokenType.Fn)) {
        methods.push(this.parseFnDecl(pub) as import('./ast.ts').FnDecl)
      } else {
        this.error('E0201', `Expected 'fn' in impl block`, this.peek().span)
        this.advance() // skip bad token
      }
    }

    this.expect(TokenType.RBrace, `Expected '}' after impl block`)
    return {
      kind: 'ImplBlock',
      traitName,
      targetType,
      genericParams,
      whereClause,
      methods,
      span: this.spanFrom(start.span),
    }
  }

  // ─── Struct Literal Parsing ─────────────────────────────────

  /**
   * When we see `Ident {`, it could be a struct literal.
   * This is called from parseIdentifier when followed by `{`.
   */
  private parseStructLiteral(name: string, startSpan: Span): Expr {
    this.advance() // consume '{'
    const fields: import('./ast.ts').StructFieldInit[] = []
    let spread: Expr | undefined

    while (!this.check(TokenType.RBrace) && !this.check(TokenType.EOF)) {
      // Spread: ...existing
      if (this.match(TokenType.Spread)) {
        spread = this.parseExpression()
        this.match(TokenType.Comma) // optional comma
        continue
      }

      const fieldName = this.expect(TokenType.Ident, `Expected field name in struct literal`)
      this.expect(TokenType.Colon, `Expected ':' after field name`)
      const value = this.parseExpression()
      fields.push({ name: fieldName.lexeme, value })
      if (!this.match(TokenType.Comma)) break
    }

    this.expect(TokenType.RBrace, `Expected '}' after struct literal`)
    return {
      kind: 'StructLiteral',
      name,
      fields,
      spread,
      span: this.spanFrom(startSpan),
    }
  }

  // ─── Concurrent ─────────────────────────────────────────────

  private parseConcurrentBlock(): Expr {
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

  // ─── Blocks ─────────────────────────────────────────────────

  /** Parse a block expression `{ ... }` — used when we know it's a block. */
  private parseBlockExpr(): Expr {
    return this.parseBlock()
  }

  private parseBlock(): Expr {
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

  /** Check if current position starts a statement keyword. */
  private isStatementStart(): boolean {
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
