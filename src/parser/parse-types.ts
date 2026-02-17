import { TokenType } from '../lexer/token.ts'
import type { Span } from '../common/span.ts'
import type {
  Expr,
  Stmt,
  TypeExpr,
  GenericParam,
  StructField,
  EnumVariant,
  WherePredicate,
  StructFieldInit,
} from './ast.ts'
import { FunctionParser } from './parse-functions.ts'

/**
 * Type and data structure parsing: type annotations, generics,
 * struct/enum declarations, type aliases, impl blocks, struct literals.
 */
export abstract class TypeParser extends FunctionParser {

  // ─── Type Annotations ───────────────────────────────────────

  protected parseTypeAnnotation(): TypeExpr {
    const token = this.peek()

    // Function type: fn(Int, Int) -> Int
    if (this.check(TokenType.Fn)) {
      return this.parseFnType()
    }

    const nameToken = this.expect(TokenType.Ident, `Expected type name`)
    const name = nameToken.lexeme

    // Generic type: List<Int>, Map<String, Int>
    if (this.check(TokenType.Lt)) {
      return this.parseGenericTypeExpr(name, nameToken.span)
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

  private parseGenericTypeExpr(name: string, startSpan: Span): TypeExpr {
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

  protected parseGenericParams(): GenericParam[] {
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

  protected parseStructDecl(pub: boolean, startSpan?: Span): Stmt {
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

  protected parseEnumDecl(pub: boolean, startSpan?: Span): Stmt {
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

  protected parseTypeAlias(pub: boolean, startSpan?: Span): Stmt {
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

  protected parseImplBlock(): Stmt {
    const start = this.advance() // consume 'impl'

    const genericParams = this.check(TokenType.Lt) ? this.parseGenericParams() : []

    const firstName = this.expect(TokenType.Ident, `Expected type name after 'impl'`).lexeme

    let traitName: string | undefined
    let targetType: string

    // Skip generic type args on first name
    if (this.check(TokenType.Lt)) {
      this.skipGenericArgs()
    }

    // impl Trait for Type { ... } vs impl Type { ... }
    if (this.match(TokenType.For)) {
      traitName = firstName
      targetType = this.expect(TokenType.Ident, `Expected type name after 'for'`).lexeme
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

  // ─── Struct Literal ───────────────────────────────────────

  protected parseStructLiteral(name: string, startSpan: Span): Expr {
    this.advance() // consume '{'
    const fields: StructFieldInit[] = []
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
}
