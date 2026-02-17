import { describe, it, expect } from 'vitest'
import { Source } from '../../src/common/source.ts'
import { Lexer } from '../../src/lexer/index.ts'
import { Parser } from '../../src/parser/index.ts'
import type {
  Expr,
  Stmt,
  IntLiteral,
  FloatLiteral,
  StringLiteral,
  BoolLiteral,
  Identifier,
  StringInterpolation,
  BinaryExpr,
  UnaryExpr,
  GroupExpr,
  ListLiteral,
  MapLiteral,
  SetLiteral,
  BlockExpr,
  LetDecl,
  ConstDecl,
  Assignment,
  ExprStatement,
  ParseResult,
  FnDecl,
  FnCall,
  MethodCall,
  FieldAccess,
  IndexAccess,
  ErrorPropagation,
  ClosureLiteral,
  IfExpr,
  MatchExpr,
  ConcurrentBlock,
  ReturnStmt,
  ForLoop,
  WhileLoop,
  BreakStmt,
  ContinueStmt,
  // Phase 5
  TypeExpr,
  NamedType,
  GenericType,
  FnType,
  StructDecl,
  EnumDecl,
  TypeAlias,
  ImplBlock,
  StructLiteral,
} from '../../src/parser/index.ts'

/** Helper: lex then parse a string. */
function parse(input: string): ParseResult {
  const source = new Source('test.hal', input)
  const lexResult = Lexer.tokenize(source)
  expect(lexResult.errors).toEqual([])
  return Parser.parse(lexResult.tokens)
}

/** Parse and return the first statement. */
function parseStmt(input: string): Stmt {
  const result = parse(input)
  expect(result.errors).toEqual([])
  expect(result.statements.length).toBeGreaterThanOrEqual(1)
  return result.statements[0]
}

/** Parse an expression statement and return the expression. */
function parseExpr(input: string): Expr {
  const stmt = parseStmt(input)
  expect(stmt.kind).toBe('ExprStatement')
  return (stmt as ExprStatement).expr
}

/** Parse expecting errors, return the result. */
function parseWithErrors(input: string): ParseResult {
  const source = new Source('test.hal', input)
  const lexResult = Lexer.tokenize(source)
  return Parser.parse(lexResult.tokens)
}

// ─── Tests ──────────────────────────────────────────────────────

describe('Parser', () => {
  // ─── Literals ─────────────────────────────────────────────

  describe('integer literals', () => {
    it('parses integer literal', () => {
      const expr = parseExpr('42')
      expect(expr.kind).toBe('IntLiteral')
      expect((expr as IntLiteral).value).toBe(42)
    })

    it('parses zero', () => {
      const expr = parseExpr('0')
      expect(expr.kind).toBe('IntLiteral')
      expect((expr as IntLiteral).value).toBe(0)
    })

    it('parses integer with underscores', () => {
      const expr = parseExpr('1_000_000')
      expect(expr.kind).toBe('IntLiteral')
      expect((expr as IntLiteral).value).toBe(1000000)
    })
  })

  describe('float literals', () => {
    it('parses float literal', () => {
      const expr = parseExpr('3.14')
      expect(expr.kind).toBe('FloatLiteral')
      expect((expr as FloatLiteral).value).toBeCloseTo(3.14)
    })

    it('parses float with exponent', () => {
      const expr = parseExpr('1.0e10')
      expect(expr.kind).toBe('FloatLiteral')
      expect((expr as FloatLiteral).value).toBe(1.0e10)
    })
  })

  describe('string literals', () => {
    it('parses simple string', () => {
      const expr = parseExpr('"hello"')
      expect(expr.kind).toBe('StringLiteral')
      expect((expr as StringLiteral).value).toBe('hello')
    })

    it('parses empty string', () => {
      const expr = parseExpr('""')
      expect(expr.kind).toBe('StringLiteral')
      expect((expr as StringLiteral).value).toBe('')
    })
  })

  describe('bool literals', () => {
    it('parses true', () => {
      const expr = parseExpr('true')
      expect(expr.kind).toBe('BoolLiteral')
      expect((expr as BoolLiteral).value).toBe(true)
    })

    it('parses false', () => {
      const expr = parseExpr('false')
      expect(expr.kind).toBe('BoolLiteral')
      expect((expr as BoolLiteral).value).toBe(false)
    })
  })

  describe('identifiers', () => {
    it('parses identifier', () => {
      const expr = parseExpr('x')
      expect(expr.kind).toBe('Identifier')
      expect((expr as Identifier).name).toBe('x')
    })

    it('parses multi-char identifier', () => {
      const expr = parseExpr('my_var')
      expect(expr.kind).toBe('Identifier')
      expect((expr as Identifier).name).toBe('my_var')
    })
  })

  // ─── Binary expressions ───────────────────────────────────

  describe('binary expressions', () => {
    it('parses 1 + 2', () => {
      const expr = parseExpr('1 + 2') as BinaryExpr
      expect(expr.kind).toBe('BinaryExpr')
      expect(expr.op).toBe('+')
      expect(expr.left.kind).toBe('IntLiteral')
      expect((expr.left as IntLiteral).value).toBe(1)
      expect(expr.right.kind).toBe('IntLiteral')
      expect((expr.right as IntLiteral).value).toBe(2)
    })

    it('respects precedence: 1 + 2 * 3', () => {
      const expr = parseExpr('1 + 2 * 3') as BinaryExpr
      expect(expr.kind).toBe('BinaryExpr')
      expect(expr.op).toBe('+')
      expect(expr.left.kind).toBe('IntLiteral')
      // Right side should be 2 * 3
      const right = expr.right as BinaryExpr
      expect(right.kind).toBe('BinaryExpr')
      expect(right.op).toBe('*')
      expect((right.left as IntLiteral).value).toBe(2)
      expect((right.right as IntLiteral).value).toBe(3)
    })

    it('parses (1 + 2) * 3 with grouping', () => {
      const expr = parseExpr('(1 + 2) * 3') as BinaryExpr
      expect(expr.kind).toBe('BinaryExpr')
      expect(expr.op).toBe('*')
      // Left side should be grouped (1 + 2)
      const left = expr.left as GroupExpr
      expect(left.kind).toBe('GroupExpr')
      const inner = left.expr as BinaryExpr
      expect(inner.op).toBe('+')
    })

    it('parses a == b', () => {
      const expr = parseExpr('a == b') as BinaryExpr
      expect(expr.kind).toBe('BinaryExpr')
      expect(expr.op).toBe('==')
    })

    it('parses a != b', () => {
      const expr = parseExpr('a != b') as BinaryExpr
      expect(expr.op).toBe('!=')
    })

    it('parses comparison operators', () => {
      for (const op of ['<', '>', '<=', '>=']) {
        const expr = parseExpr(`a ${op} b`) as BinaryExpr
        expect(expr.op).toBe(op)
      }
    })

    it('parses 1..10 as range', () => {
      const expr = parseExpr('1..10') as BinaryExpr
      expect(expr.kind).toBe('BinaryExpr')
      expect(expr.op).toBe('..')
      expect((expr.left as IntLiteral).value).toBe(1)
      expect((expr.right as IntLiteral).value).toBe(10)
    })

    it('parses 1..=10 as inclusive range', () => {
      const expr = parseExpr('1..=10') as BinaryExpr
      expect(expr.op).toBe('..=')
    })

    it('parses a and b or c with correct precedence', () => {
      const expr = parseExpr('a and b or c') as BinaryExpr
      // `and` binds tighter than `or`, so: (a and b) or c
      expect(expr.op).toBe('or')
      const left = expr.left as BinaryExpr
      expect(left.op).toBe('and')
    })

    it('parses arithmetic left-to-right: 1 - 2 - 3', () => {
      const expr = parseExpr('1 - 2 - 3') as BinaryExpr
      // Left-associative: (1 - 2) - 3
      expect(expr.op).toBe('-')
      const left = expr.left as BinaryExpr
      expect(left.op).toBe('-')
      expect((left.left as IntLiteral).value).toBe(1)
      expect((left.right as IntLiteral).value).toBe(2)
      expect((expr.right as IntLiteral).value).toBe(3)
    })
  })

  // ─── Unary expressions ───────────────────────────────────

  describe('unary expressions', () => {
    it('parses -x', () => {
      const expr = parseExpr('-x') as UnaryExpr
      expect(expr.kind).toBe('UnaryExpr')
      expect(expr.op).toBe('-')
      expect(expr.operand.kind).toBe('Identifier')
      expect((expr.operand as Identifier).name).toBe('x')
    })

    it('parses not flag', () => {
      const expr = parseExpr('not flag') as UnaryExpr
      expect(expr.kind).toBe('UnaryExpr')
      expect(expr.op).toBe('not')
      expect((expr.operand as Identifier).name).toBe('flag')
    })

    it('unary binds tighter than binary: -a + b', () => {
      const expr = parseExpr('-a + b') as BinaryExpr
      expect(expr.op).toBe('+')
      expect(expr.left.kind).toBe('UnaryExpr')
    })
  })

  // ─── String interpolation ────────────────────────────────

  describe('string interpolation', () => {
    it('parses "hello {name}"', () => {
      const expr = parseExpr('"hello {name}"')
      expect(expr.kind).toBe('StringInterpolation')
      const interp = expr as StringInterpolation
      // Segments: "hello " + name
      expect(interp.segments.length).toBeGreaterThanOrEqual(2)
      // First segment should be a string
      expect(typeof interp.segments[0]).toBe('string')
      // One of the segments should be an Identifier expression
      const exprSegment = interp.segments.find(
        (s) => typeof s !== 'string'
      ) as Expr
      expect(exprSegment).toBeDefined()
      expect(exprSegment.kind).toBe('Identifier')
    })
  })

  // ─── Collection literals ──────────────────────────────────

  describe('list literals', () => {
    it('parses [1, 2, 3]', () => {
      const expr = parseExpr('[1, 2, 3]') as ListLiteral
      expect(expr.kind).toBe('ListLiteral')
      expect(expr.elements).toHaveLength(3)
      expect((expr.elements[0] as IntLiteral).value).toBe(1)
      expect((expr.elements[1] as IntLiteral).value).toBe(2)
      expect((expr.elements[2] as IntLiteral).value).toBe(3)
    })

    it('parses empty list []', () => {
      const expr = parseExpr('[]') as ListLiteral
      expect(expr.kind).toBe('ListLiteral')
      expect(expr.elements).toHaveLength(0)
    })
  })

  describe('map literals', () => {
    it('parses {"a": 1, "b": 2}', () => {
      const expr = parseExpr('{"a": 1, "b": 2}') as MapLiteral
      expect(expr.kind).toBe('MapLiteral')
      expect(expr.entries).toHaveLength(2)
      expect((expr.entries[0].key as StringLiteral).value).toBe('a')
      expect((expr.entries[0].value as IntLiteral).value).toBe(1)
    })
  })

  describe('set literals', () => {
    it('parses #{1, 2, 3}', () => {
      const expr = parseExpr('#{1, 2, 3}') as SetLiteral
      expect(expr.kind).toBe('SetLiteral')
      expect(expr.elements).toHaveLength(3)
    })

    it('parses empty set #{}', () => {
      const expr = parseExpr('#{}') as SetLiteral
      expect(expr.kind).toBe('SetLiteral')
      expect(expr.elements).toHaveLength(0)
    })
  })

  // ─── Declarations ─────────────────────────────────────────

  describe('let declarations', () => {
    it('parses let x = 5', () => {
      const stmt = parseStmt('let x = 5') as LetDecl
      expect(stmt.kind).toBe('LetDecl')
      expect(stmt.mutable).toBe(false)
      expect(stmt.name).toBe('x')
      expect(stmt.typeAnnotation).toBeUndefined()
      expect(stmt.initializer.kind).toBe('IntLiteral')
      expect((stmt.initializer as IntLiteral).value).toBe(5)
    })

    it('parses let mut x: Int = 5', () => {
      const stmt = parseStmt('let mut x: Int = 5') as LetDecl
      expect(stmt.kind).toBe('LetDecl')
      expect(stmt.mutable).toBe(true)
      expect(stmt.name).toBe('x')
      expect(stmt.typeAnnotation).toBeDefined()
      expect(stmt.typeAnnotation!.kind).toBe('NamedType')
      expect((stmt.typeAnnotation as import('../../src/parser/index.ts').NamedType).name).toBe('Int')
      expect((stmt.initializer as IntLiteral).value).toBe(5)
    })

    it('parses let with expression initializer', () => {
      const stmt = parseStmt('let y = 1 + 2') as LetDecl
      expect(stmt.initializer.kind).toBe('BinaryExpr')
    })
  })

  describe('const declarations', () => {
    it('parses const MAX: Int = 100', () => {
      const stmt = parseStmt('const MAX: Int = 100') as ConstDecl
      expect(stmt.kind).toBe('ConstDecl')
      expect(stmt.name).toBe('MAX')
      expect(stmt.typeAnnotation).toBeDefined()
      expect((stmt.typeAnnotation as import('../../src/parser/index.ts').NamedType).name).toBe('Int')
      expect((stmt.initializer as IntLiteral).value).toBe(100)
    })

    it('parses const without type annotation', () => {
      const stmt = parseStmt('const PI = 3.14') as ConstDecl
      expect(stmt.kind).toBe('ConstDecl')
      expect(stmt.name).toBe('PI')
      expect(stmt.typeAnnotation).toBeUndefined()
    })
  })

  // ─── Assignment ───────────────────────────────────────────

  describe('assignment', () => {
    it('parses x = 10', () => {
      const stmt = parseStmt('x = 10') as Assignment
      expect(stmt.kind).toBe('Assignment')
      expect(stmt.target).toBe('x')
      expect((stmt.value as IntLiteral).value).toBe(10)
    })

    it('parses assignment with expression', () => {
      const stmt = parseStmt('x = a + b') as Assignment
      expect(stmt.kind).toBe('Assignment')
      expect(stmt.value.kind).toBe('BinaryExpr')
    })
  })

  // ─── Blocks ───────────────────────────────────────────────

  describe('blocks', () => {
    it('parses block with trailing expression (from plan test case)', () => {
      // Plan says: `{ let x = 1; x + 1 }` but HAL has no semicolons.
      // Newlines are stripped by the lexer, so we rely on the parser
      // to separate `let x = 1` from `x + 1` by recognizing the
      // `let` keyword ends when the next expression starts.
      // This is already covered by 'parses block with let and trailing expression'.
      const expr = parseExpr('{ let x = 1\nx + 1 }')
      expect(expr.kind).toBe('BlockExpr')
      const block = expr as BlockExpr
      expect(block.statements).toHaveLength(1)
      expect(block.trailing).toBeDefined()
    })

    it('parses block with let and trailing expression', () => {
      const expr = parseExpr('{ let x = 1\nx + 1 }')
      // The block is parsed via parseMapOrBlock -> parseBlock
      // Actually newlines are whitespace and skipped by lexer
      // So tokens are: { let x = 1 x + 1 }
      // The parser sees: { let x = 1 (then encounters `x` as next expression) x + 1 }
      // Let's verify the structure
      expect(expr.kind).toBe('BlockExpr')
      const block = expr as BlockExpr
      expect(block.statements).toHaveLength(1)
      expect(block.statements[0].kind).toBe('LetDecl')
      expect(block.trailing).toBeDefined()
      expect(block.trailing!.kind).toBe('BinaryExpr')
    })

    it('parses empty block', () => {
      const expr = parseExpr('{}')
      expect(expr.kind).toBe('BlockExpr')
      const block = expr as BlockExpr
      expect(block.statements).toHaveLength(0)
      expect(block.trailing).toBeUndefined()
    })

    it('block as expression with just a value', () => {
      const expr = parseExpr('{ 42 }')
      expect(expr.kind).toBe('BlockExpr')
      const block = expr as BlockExpr
      expect(block.statements).toHaveLength(0)
      expect(block.trailing).toBeDefined()
      expect((block.trailing as IntLiteral).value).toBe(42)
    })
  })

  // ─── Error cases ──────────────────────────────────────────

  describe('parse errors', () => {
    it('reports error for missing expression', () => {
      // Unexpected EOF when expecting an expression
      const result = parseWithErrors('let x =')
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors[0].code).toMatch(/^E02/)
    })

    it('reports error for missing = in let', () => {
      const result = parseWithErrors('let x 5')
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors[0].message).toContain("'='")
    })
  })

  // ─── Span tracking ───────────────────────────────────────

  describe('span tracking', () => {
    it('tracks span for integer literal', () => {
      const expr = parseExpr('42')
      expect(expr.span.start.line).toBe(1)
      expect(expr.span.start.column).toBe(1)
      expect(expr.span.file).toBe('test.hal')
    })

    it('tracks span for binary expression', () => {
      const expr = parseExpr('1 + 2') as BinaryExpr
      expect(expr.span.start.line).toBe(1)
      expect(expr.span.start.column).toBe(1)
      // Span should extend to the end of '2'
      expect(expr.span.end.column).toBeGreaterThan(1)
    })
  })

  // ═══════════════════════════════════════════════════════════════
  // Phase 4: Functions & Control Flow
  // ═══════════════════════════════════════════════════════════════

  // ─── Function declarations ────────────────────────────────

  describe('function declarations', () => {
    it('parses fn add(a: Int, b: Int) -> Int { return a + b }', () => {
      const stmt = parseStmt('fn add(a: Int, b: Int) -> Int { return a + b }') as FnDecl
      expect(stmt.kind).toBe('FnDecl')
      expect(stmt.pub).toBe(false)
      expect(stmt.name).toBe('add')
      expect(stmt.params).toHaveLength(2)
      expect(stmt.params[0].name).toBe('a')
      expect(stmt.params[0].type).toBeDefined()
      expect((stmt.params[0].type as import('../../src/parser/index.ts').NamedType).name).toBe('Int')
      expect(stmt.params[1].name).toBe('b')
      expect((stmt.params[1].type as import('../../src/parser/index.ts').NamedType).name).toBe('Int')
      expect(stmt.returnType).toBeDefined()
      expect((stmt.returnType as import('../../src/parser/index.ts').NamedType).name).toBe('Int')
    })

    it('parses function with precondition and postcondition', () => {
      const input = `fn divide(a: Int, b: Int) -> Int
        precondition { b != 0 }
        postcondition(result) { result * b == a }
        { return a / b }`
      const stmt = parseStmt(input) as FnDecl
      expect(stmt.kind).toBe('FnDecl')
      expect(stmt.preconditions).toHaveLength(1)
      expect(stmt.postconditions).toHaveLength(1)
      expect(stmt.postconditions[0].name).toBe('result')
    })

    it('parses function with effects clause', () => {
      const input = 'fn read_file(path: String) -> String effects [Io] { return path }'
      const stmt = parseStmt(input) as FnDecl
      expect(stmt.effects).toEqual(['Io'])
    })

    it('parses function with forbids clause', () => {
      const input = 'fn pure_fn(x: Int) -> Int forbids [Network] { return x }'
      const stmt = parseStmt(input) as FnDecl
      expect(stmt.forbids).toEqual(['Network'])
    })

    it('parses function with effects + forbids + contracts', () => {
      const input = `fn process(x: Int) -> Int
        effects [Io]
        forbids [Network]
        precondition { x > 0 }
        postcondition(r) { r > 0 }
        { return x }`
      const stmt = parseStmt(input) as FnDecl
      expect(stmt.effects).toEqual(['Io'])
      expect(stmt.forbids).toEqual(['Network'])
      expect(stmt.preconditions).toHaveLength(1)
      expect(stmt.postconditions).toHaveLength(1)
    })

    it('parses pub fn', () => {
      const stmt = parseStmt('pub fn greet() { return 1 }') as FnDecl
      expect(stmt.kind).toBe('FnDecl')
      expect(stmt.pub).toBe(true)
      expect(stmt.name).toBe('greet')
    })
  })

  // ─── Closures ─────────────────────────────────────────────

  describe('closures', () => {
    it('parses closure fn(x) { x + 1 }', () => {
      const expr = parseExpr('fn(x) { x + 1 }') as ClosureLiteral
      expect(expr.kind).toBe('ClosureLiteral')
      expect(expr.params).toHaveLength(1)
      expect(expr.params[0].name).toBe('x')
      expect(expr.body.kind).toBe('BlockExpr')
    })

    it('parses closure with typed params and return type', () => {
      const expr = parseExpr('fn(x: Int) -> Int { x + 1 }') as ClosureLiteral
      expect((expr.params[0].type as import('../../src/parser/index.ts').NamedType).name).toBe('Int')
      expect((expr.returnType as import('../../src/parser/index.ts').NamedType).name).toBe('Int')
    })
  })

  // ─── Function calls ──────────────────────────────────────

  describe('function calls', () => {
    it('parses add(1, 2)', () => {
      const expr = parseExpr('add(1, 2)') as FnCall
      expect(expr.kind).toBe('FnCall')
      expect((expr.callee as Identifier).name).toBe('add')
      expect(expr.args).toHaveLength(2)
      expect((expr.args[0].value as IntLiteral).value).toBe(1)
      expect((expr.args[1].value as IntLiteral).value).toBe(2)
    })

    it('parses named arguments create(name: "Alice", age: 30)', () => {
      const expr = parseExpr('create(name: "Alice", age: 30)') as FnCall
      expect(expr.kind).toBe('FnCall')
      expect(expr.args).toHaveLength(2)
      expect(expr.args[0].name).toBe('name')
      expect((expr.args[0].value as StringLiteral).value).toBe('Alice')
      expect(expr.args[1].name).toBe('age')
      expect((expr.args[1].value as IntLiteral).value).toBe(30)
    })
  })

  // ─── Method calls & field access ──────────────────────────

  describe('method calls and field access', () => {
    it('parses method call list.push(item)', () => {
      const expr = parseExpr('list.push(item)') as MethodCall
      expect(expr.kind).toBe('MethodCall')
      expect((expr.receiver as Identifier).name).toBe('list')
      expect(expr.method).toBe('push')
      expect(expr.args).toHaveLength(1)
    })

    it('parses chained calls a.b().c(d)', () => {
      const expr = parseExpr('a.b().c(d)') as MethodCall
      expect(expr.kind).toBe('MethodCall')
      expect(expr.method).toBe('c')
      // The receiver should be a.b() which is a MethodCall
      const inner = expr.receiver as MethodCall
      expect(inner.kind).toBe('MethodCall')
      expect(inner.method).toBe('b')
      expect((inner.receiver as Identifier).name).toBe('a')
    })

    it('parses field access user.name', () => {
      const expr = parseExpr('user.name') as FieldAccess
      expect(expr.kind).toBe('FieldAccess')
      expect((expr.receiver as Identifier).name).toBe('user')
      expect(expr.field).toBe('name')
    })
  })

  // ─── Index access ─────────────────────────────────────────

  describe('index access', () => {
    it('parses list[0]', () => {
      const expr = parseExpr('list[0]') as IndexAccess
      expect(expr.kind).toBe('IndexAccess')
      expect((expr.receiver as Identifier).name).toBe('list')
      expect((expr.index as IntLiteral).value).toBe(0)
    })
  })

  // ─── Error propagation ────────────────────────────────────

  describe('error propagation', () => {
    it('parses result?', () => {
      const expr = parseExpr('result?') as ErrorPropagation
      expect(expr.kind).toBe('ErrorPropagation')
      expect((expr.expr as Identifier).name).toBe('result')
    })
  })

  // ─── If / else ────────────────────────────────────────────

  describe('if expressions', () => {
    it('parses if x > 0 { 1 }', () => {
      const expr = parseExpr('if x > 0 { 1 }') as IfExpr
      expect(expr.kind).toBe('IfExpr')
      expect(expr.condition.kind).toBe('BinaryExpr')
      expect(expr.then.kind).toBe('BlockExpr')
      expect(expr.elseBody).toBeUndefined()
    })

    it('parses if x > 0 { 1 } else { 2 }', () => {
      const expr = parseExpr('if x > 0 { 1 } else { 2 }') as IfExpr
      expect(expr.kind).toBe('IfExpr')
      expect(expr.elseBody).toBeDefined()
      expect(expr.elseBody!.kind).toBe('BlockExpr')
    })

    it('parses if as expression (with else, produces value)', () => {
      const expr = parseExpr('if true { 1 } else { 2 }') as IfExpr
      expect(expr.kind).toBe('IfExpr')
      const thenBlock = expr.then as BlockExpr
      expect((thenBlock.trailing as IntLiteral).value).toBe(1)
      const elseBlock = expr.elseBody as BlockExpr
      expect((elseBlock.trailing as IntLiteral).value).toBe(2)
    })

    it('parses else if chains', () => {
      const expr = parseExpr('if a { 1 } else if b { 2 } else { 3 }') as IfExpr
      expect(expr.elseIfs).toHaveLength(1)
      expect(expr.elseBody).toBeDefined()
    })
  })

  // ─── Match ────────────────────────────────────────────────

  describe('match expressions', () => {
    it('parses match x { case 1 => "one" case _ => "other" }', () => {
      const expr = parseExpr('match x { case 1 => "one" case _ => "other" }') as MatchExpr
      expect(expr.kind).toBe('MatchExpr')
      expect((expr.subject as Identifier).name).toBe('x')
      expect(expr.arms).toHaveLength(2)
      expect(expr.arms[0].pattern.kind).toBe('LiteralPattern')
      expect(expr.arms[1].pattern.kind).toBe('WildcardPattern')
    })

    it('parses match with enum patterns', () => {
      const expr = parseExpr('match shape { case Shape.Circle(r) => r case Shape.Rect(w, h) => w }') as MatchExpr
      expect(expr.arms).toHaveLength(2)
      expect(expr.arms[0].pattern.kind).toBe('EnumPattern')
      const enumPat = expr.arms[0].pattern as import('../../src/parser/index.ts').EnumPattern
      expect(enumPat.name).toBe('Shape')
      expect(enumPat.variant).toBe('Circle')
      expect(enumPat.fields).toHaveLength(1)
    })

    it('parses match with struct patterns', () => {
      const expr = parseExpr('match user { case User { name, age } => name }') as MatchExpr
      expect(expr.arms[0].pattern.kind).toBe('StructPattern')
      const structPat = expr.arms[0].pattern as import('../../src/parser/index.ts').StructPattern
      expect(structPat.name).toBe('User')
      expect(structPat.fields).toHaveLength(2)
    })

    it('parses match with guard: case x if x > 0 => x', () => {
      const expr = parseExpr('match n { case x if x > 0 => x case _ => 0 }') as MatchExpr
      expect(expr.arms[0].guard).toBeDefined()
      expect(expr.arms[0].guard!.kind).toBe('BinaryExpr')
      expect(expr.arms[0].pattern.kind).toBe('BindingPattern')
    })
  })

  // ─── For loop ─────────────────────────────────────────────

  describe('for loops', () => {
    it('parses for item in list { item }', () => {
      const stmt = parseStmt('for item in list { item }') as ForLoop
      expect(stmt.kind).toBe('ForLoop')
      expect(stmt.pattern).toBe('item')
      expect((stmt.iterable as Identifier).name).toBe('list')
      expect(stmt.body.kind).toBe('BlockExpr')
    })

    it('parses for (key, value) in map { key }', () => {
      const stmt = parseStmt('for (key, value) in map { key }') as ForLoop
      expect(stmt.kind).toBe('ForLoop')
      expect(stmt.pattern).toEqual(['key', 'value'])
    })
  })

  // ─── While loop ───────────────────────────────────────────

  describe('while loops', () => {
    it('parses while condition { body }', () => {
      const stmt = parseStmt('while x > 0 { x }') as WhileLoop
      expect(stmt.kind).toBe('WhileLoop')
      expect(stmt.condition.kind).toBe('BinaryExpr')
      expect(stmt.body.kind).toBe('BlockExpr')
    })
  })

  // ─── Break / Continue ─────────────────────────────────────

  describe('break and continue', () => {
    it('parses break', () => {
      const stmt = parseStmt('break') as BreakStmt
      expect(stmt.kind).toBe('BreakStmt')
    })

    it('parses continue', () => {
      const stmt = parseStmt('continue') as ContinueStmt
      expect(stmt.kind).toBe('ContinueStmt')
    })
  })

  // ─── Return ───────────────────────────────────────────────

  describe('return statement', () => {
    it('parses return value', () => {
      const stmt = parseStmt('return 42') as ReturnStmt
      expect(stmt.kind).toBe('ReturnStmt')
      expect(stmt.value).toBeDefined()
      expect((stmt.value as IntLiteral).value).toBe(42)
    })

    it('parses return with expression', () => {
      const stmt = parseStmt('return a + b') as ReturnStmt
      expect(stmt.value!.kind).toBe('BinaryExpr')
    })
  })

  // ─── Concurrent ───────────────────────────────────────────

  describe('concurrent blocks', () => {
    it('parses concurrent { a() b() }', () => {
      const expr = parseExpr('concurrent { a() b() }') as ConcurrentBlock
      expect(expr.kind).toBe('ConcurrentBlock')
      expect(expr.exprs).toHaveLength(2)
      expect(expr.exprs[0].kind).toBe('FnCall')
      expect(expr.exprs[1].kind).toBe('FnCall')
    })
  })

  // ─── Phase 4 error cases ──────────────────────────────────

  describe('phase 4 parse errors', () => {
    it('reports error for missing function body', () => {
      const result = parseWithErrors('fn bad()')
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors.some(e => e.code === 'E0204')).toBe(true)
    })

    it('reports error for missing => in match arm', () => {
      const result = parseWithErrors('match x { case 1 "one" }')
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors.some(e => e.message.includes("'=>'"))).toBe(true)
    })
  })

  // ═══════════════════════════════════════════════════════════════
  // Phase 5: Types & Data Structures
  // ═══════════════════════════════════════════════════════════════

  // ─── Type annotations ──────────────────────────────────────

  describe('type annotations', () => {
    it('parses generic type annotation List<Int>', () => {
      const stmt = parseStmt('let x: List<Int> = y') as LetDecl
      expect(stmt.typeAnnotation).toBeDefined()
      const ta = stmt.typeAnnotation as GenericType
      expect(ta.kind).toBe('GenericType')
      expect(ta.name).toBe('List')
      expect(ta.args).toHaveLength(1)
      expect((ta.args[0] as NamedType).name).toBe('Int')
    })

    it('parses nested generic Result<List<User>, Error>', () => {
      const stmt = parseStmt('let x: Result<List<User>, Error> = y') as LetDecl
      const ta = stmt.typeAnnotation as GenericType
      expect(ta.kind).toBe('GenericType')
      expect(ta.name).toBe('Result')
      expect(ta.args).toHaveLength(2)
      const inner = ta.args[0] as GenericType
      expect(inner.kind).toBe('GenericType')
      expect(inner.name).toBe('List')
      expect((inner.args[0] as NamedType).name).toBe('User')
      expect((ta.args[1] as NamedType).name).toBe('Error')
    })

    it('parses function type fn(Int) -> Bool', () => {
      const stmt = parseStmt('let f: fn(Int) -> Bool = g') as LetDecl
      const ta = stmt.typeAnnotation as FnType
      expect(ta.kind).toBe('FnType')
      expect(ta.params).toHaveLength(1)
      expect((ta.params[0] as NamedType).name).toBe('Int')
      expect((ta.returnType as NamedType).name).toBe('Bool')
    })

    it('parses function type with multiple params fn(Int, String) -> Void', () => {
      const stmt = parseStmt('let f: fn(Int, String) -> Void = g') as LetDecl
      const ta = stmt.typeAnnotation as FnType
      expect(ta.kind).toBe('FnType')
      expect(ta.params).toHaveLength(2)
      expect((ta.params[0] as NamedType).name).toBe('Int')
      expect((ta.params[1] as NamedType).name).toBe('String')
      expect((ta.returnType as NamedType).name).toBe('Void')
    })
  })

  // ─── Struct declarations ────────────────────────────────────

  describe('struct declarations', () => {
    it('parses struct User { name: String, age: Int }', () => {
      const stmt = parseStmt('struct User { name: String, age: Int }') as StructDecl
      expect(stmt.kind).toBe('StructDecl')
      expect(stmt.pub).toBe(false)
      expect(stmt.name).toBe('User')
      expect(stmt.fields).toHaveLength(2)
      expect(stmt.fields[0].name).toBe('name')
      expect((stmt.fields[0].type as NamedType).name).toBe('String')
      expect(stmt.fields[1].name).toBe('age')
      expect((stmt.fields[1].type as NamedType).name).toBe('Int')
    })

    it('parses struct with invariant', () => {
      const stmt = parseStmt('struct User { age: Int invariant { age > 0 } }') as StructDecl
      expect(stmt.fields).toHaveLength(1)
      expect(stmt.invariants).toHaveLength(1)
    })

    it('parses struct with derive [Eq, Hashable]', () => {
      const stmt = parseStmt('struct Point { x: Int, y: Int derive [Eq, Hashable] }') as StructDecl
      expect(stmt.derive).toEqual(['Eq', 'Hashable'])
    })

    it('parses pub struct', () => {
      const stmt = parseStmt('pub struct Config { debug: Bool }') as StructDecl
      expect(stmt.kind).toBe('StructDecl')
      expect(stmt.pub).toBe(true)
      expect(stmt.name).toBe('Config')
    })

    it('parses generic struct', () => {
      const stmt = parseStmt('struct Pair<A, B> { first: A, second: B }') as StructDecl
      expect(stmt.genericParams).toHaveLength(2)
      expect(stmt.genericParams[0].name).toBe('A')
      expect(stmt.genericParams[1].name).toBe('B')
    })
  })

  // ─── Enum declarations ──────────────────────────────────────

  describe('enum declarations', () => {
    it('parses enum Color { Red, Green, Blue }', () => {
      const stmt = parseStmt('enum Color { Red, Green, Blue }') as EnumDecl
      expect(stmt.kind).toBe('EnumDecl')
      expect(stmt.pub).toBe(false)
      expect(stmt.name).toBe('Color')
      expect(stmt.variants).toHaveLength(3)
      expect(stmt.variants[0].name).toBe('Red')
      expect(stmt.variants[0].fields).toHaveLength(0)
      expect(stmt.variants[1].name).toBe('Green')
      expect(stmt.variants[2].name).toBe('Blue')
    })

    it('parses enum Shape with data variants', () => {
      const stmt = parseStmt('enum Shape { Circle(radius: Float), Rect(w: Float, h: Float) }') as EnumDecl
      expect(stmt.kind).toBe('EnumDecl')
      expect(stmt.variants).toHaveLength(2)
      expect(stmt.variants[0].name).toBe('Circle')
      expect(stmt.variants[0].fields).toHaveLength(1)
      expect(stmt.variants[0].fields[0].name).toBe('radius')
      expect((stmt.variants[0].fields[0].type as NamedType).name).toBe('Float')
      expect(stmt.variants[1].name).toBe('Rect')
      expect(stmt.variants[1].fields).toHaveLength(2)
    })

    it('parses pub enum', () => {
      const stmt = parseStmt('pub enum Direction { Up, Down }') as EnumDecl
      expect(stmt.kind).toBe('EnumDecl')
      expect(stmt.pub).toBe(true)
    })

    it('parses generic enum', () => {
      const stmt = parseStmt('enum Option<T> { Some(value: T), None }') as EnumDecl
      expect(stmt.genericParams).toHaveLength(1)
      expect(stmt.genericParams[0].name).toBe('T')
      expect(stmt.variants).toHaveLength(2)
    })
  })

  // ─── Type aliases ────────────────────────────────────────────

  describe('type aliases', () => {
    it('parses type UserId = Int', () => {
      const stmt = parseStmt('type UserId = Int') as TypeAlias
      expect(stmt.kind).toBe('TypeAlias')
      expect(stmt.pub).toBe(false)
      expect(stmt.name).toBe('UserId')
      expect((stmt.type as NamedType).name).toBe('Int')
    })

    it('parses generic type alias type Pair<A, B> = Map<A, B>', () => {
      const stmt = parseStmt('type Pair<A, B> = Map<A, B>') as TypeAlias
      expect(stmt.kind).toBe('TypeAlias')
      expect(stmt.genericParams).toHaveLength(2)
      expect(stmt.genericParams[0].name).toBe('A')
      expect(stmt.genericParams[1].name).toBe('B')
      const target = stmt.type as GenericType
      expect(target.kind).toBe('GenericType')
      expect(target.name).toBe('Map')
    })

    it('parses pub type alias', () => {
      const stmt = parseStmt('pub type Id = Int') as TypeAlias
      expect(stmt.pub).toBe(true)
    })
  })

  // ─── Impl blocks ────────────────────────────────────────────

  describe('impl blocks', () => {
    it('parses impl User { fn name(self) -> String { ... } }', () => {
      const stmt = parseStmt('impl User { fn name(self) -> String { return self } }') as ImplBlock
      expect(stmt.kind).toBe('ImplBlock')
      expect(stmt.traitName).toBeUndefined()
      expect(stmt.targetType).toBe('User')
      expect(stmt.methods).toHaveLength(1)
      expect(stmt.methods[0].name).toBe('name')
      expect(stmt.methods[0].params[0].name).toBe('self')
    })

    it('parses impl Display for User { ... }', () => {
      const stmt = parseStmt('impl Display for User { fn to_string(self) -> String { return self } }') as ImplBlock
      expect(stmt.kind).toBe('ImplBlock')
      expect(stmt.traitName).toBe('Display')
      expect(stmt.targetType).toBe('User')
      expect(stmt.methods).toHaveLength(1)
    })

    it('parses where clause: where T: Eq + Hashable', () => {
      const stmt = parseStmt('impl<T> Container for Box<T> where T: Eq + Hashable { fn contains(self) -> Bool { return true } }') as ImplBlock
      expect(stmt.genericParams).toHaveLength(1)
      expect(stmt.genericParams[0].name).toBe('T')
      expect(stmt.whereClause).toHaveLength(1)
      expect(stmt.whereClause[0].typeName).toBe('T')
      expect(stmt.whereClause[0].bounds).toEqual(['Eq', 'Hashable'])
    })
  })

  // ─── Struct literals ────────────────────────────────────────

  describe('struct literals', () => {
    it('parses struct literal User { name: "Alice", age: 30 }', () => {
      const expr = parseExpr('User { name: "Alice", age: 30 }') as StructLiteral
      expect(expr.kind).toBe('StructLiteral')
      expect(expr.name).toBe('User')
      expect(expr.fields).toHaveLength(2)
      expect(expr.fields[0].name).toBe('name')
      expect((expr.fields[0].value as StringLiteral).value).toBe('Alice')
      expect(expr.fields[1].name).toBe('age')
      expect((expr.fields[1].value as IntLiteral).value).toBe(30)
    })

    it('parses struct update User { ...old, name: "Bob" }', () => {
      const expr = parseExpr('User { ...old, name: "Bob" }') as StructLiteral
      expect(expr.kind).toBe('StructLiteral')
      expect(expr.name).toBe('User')
      expect(expr.spread).toBeDefined()
      expect((expr.spread as Identifier).name).toBe('old')
      expect(expr.fields).toHaveLength(1)
      expect(expr.fields[0].name).toBe('name')
    })
  })

  // ─── Generic parameters ────────────────────────────────────

  describe('generic parameters', () => {
    it('parses function with generic parameters', () => {
      const stmt = parseStmt('fn identity<T>(x: T) -> T { return x }') as FnDecl
      expect(stmt.genericParams).toHaveLength(1)
      expect(stmt.genericParams[0].name).toBe('T')
      expect(stmt.genericParams[0].bounds).toHaveLength(0)
    })

    it('parses generic with trait bounds <T: Eq>', () => {
      const stmt = parseStmt('fn compare<T: Eq>(a: T, b: T) -> Bool { return true }') as FnDecl
      expect(stmt.genericParams).toHaveLength(1)
      expect(stmt.genericParams[0].name).toBe('T')
      expect(stmt.genericParams[0].bounds).toEqual(['Eq'])
    })

    it('parses generic with multiple bounds <T: Eq + Hashable>', () => {
      const stmt = parseStmt('fn hash_eq<T: Eq + Hashable>(x: T) -> Int { return 0 }') as FnDecl
      expect(stmt.genericParams[0].bounds).toEqual(['Eq', 'Hashable'])
    })
  })

  // ─── Phase 5 error cases ──────────────────────────────────

  describe('phase 5 parse errors', () => {
    it('reports error for missing field type in struct', () => {
      const result = parseWithErrors('struct Bad { name }')
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors.some(e => e.message.includes("':'"))).toBe(true)
    })

    it('reports error for duplicate variant name', () => {
      const result = parseWithErrors('enum Bad { A, A }')
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors.some(e => e.code === 'E0206')).toBe(true)
    })
  })
})
