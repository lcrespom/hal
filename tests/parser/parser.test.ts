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
      expect(stmt.typeAnnotation).toBe('Int')
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
      expect(stmt.typeAnnotation).toBe('Int')
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
})
