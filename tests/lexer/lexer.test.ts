import { describe, it, expect } from 'vitest'
import { Source } from '../../src/common/source.ts'
import { Lexer, TokenType } from '../../src/lexer/index.ts'
import type { Token } from '../../src/lexer/index.ts'

/** Helper: tokenize a string and return the tokens (excluding EOF). */
function lex(input: string): Token[] {
  const source = new Source('test.hal', input)
  const result = Lexer.tokenize(source)
  expect(result.errors).toEqual([])
  return result.tokens.filter((t) => t.type !== TokenType.EOF)
}

/** Helper: tokenize and return token types (excluding EOF). */
function lexTypes(input: string): TokenType[] {
  return lex(input).map((t) => t.type)
}

/** Helper: tokenize expecting errors, return the result. */
function lexWithErrors(input: string) {
  const source = new Source('test.hal', input)
  return Lexer.tokenize(source)
}

// ─── Empty source ──────────────────────────────────────────────

describe('Lexer', () => {
  describe('empty source', () => {
    it('produces only EOF for empty input', () => {
      const source = new Source('test.hal', '')
      const result = Lexer.tokenize(source)
      expect(result.tokens).toHaveLength(1)
      expect(result.tokens[0].type).toBe(TokenType.EOF)
      expect(result.errors).toEqual([])
    })

    it('produces only EOF for whitespace-only input', () => {
      const source = new Source('test.hal', '   \n\t\r\n  ')
      const result = Lexer.tokenize(source)
      expect(result.tokens).toHaveLength(1)
      expect(result.tokens[0].type).toBe(TokenType.EOF)
    })
  })

  // ─── Keywords ──────────────────────────────────────────────────

  describe('keywords', () => {
    it('lexes a single keyword', () => {
      expect(lexTypes('let')).toEqual([TokenType.Let])
    })

    it('lexes all keywords correctly', () => {
      const keywords: [string, TokenType][] = [
        ['let', TokenType.Let],
        ['mut', TokenType.Mut],
        ['const', TokenType.Const],
        ['fn', TokenType.Fn],
        ['pub', TokenType.Pub],
        ['return', TokenType.Return],
        ['struct', TokenType.Struct],
        ['enum', TokenType.Enum],
        ['trait', TokenType.Trait],
        ['impl', TokenType.Impl],
        ['if', TokenType.If],
        ['else', TokenType.Else],
        ['match', TokenType.Match],
        ['case', TokenType.Case],
        ['for', TokenType.For],
        ['in', TokenType.In],
        ['while', TokenType.While],
        ['break', TokenType.Break],
        ['continue', TokenType.Continue],
        ['import', TokenType.Import],
        ['as', TokenType.As],
        ['test', TokenType.Test],
        ['suite', TokenType.Suite],
        ['assert', TokenType.Assert],
        ['assert_eq', TokenType.AssertEq],
        ['assert_ne', TokenType.AssertNe],
        ['effect', TokenType.Effect],
        ['effects', TokenType.Effects],
        ['forbids', TokenType.Forbids],
        ['concurrent', TokenType.Concurrent],
        ['ffi', TokenType.Ffi],
        ['maps_to', TokenType.MapsTo],
        ['true', TokenType.True],
        ['false', TokenType.False],
        ['and', TokenType.And],
        ['or', TokenType.Or],
        ['not', TokenType.Not],
        ['Self', TokenType.SelfType],
        ['type', TokenType.Type],
        ['where', TokenType.Where],
        ['precondition', TokenType.Precondition],
        ['postcondition', TokenType.Postcondition],
        ['invariant', TokenType.Invariant],
        ['derive', TokenType.Derive],
      ]

      for (const [keyword, expectedType] of keywords) {
        const tokens = lex(keyword)
        expect(tokens).toHaveLength(1)
        expect(tokens[0].type).toBe(expectedType)
        expect(tokens[0].lexeme).toBe(keyword)
      }
    })
  })

  // ─── Integer literals ──────────────────────────────────────────

  describe('integer literals', () => {
    it('lexes zero', () => {
      const tokens = lex('0')
      expect(tokens).toHaveLength(1)
      expect(tokens[0].type).toBe(TokenType.IntLit)
      expect(tokens[0].lexeme).toBe('0')
    })

    it('lexes simple integer', () => {
      const tokens = lex('42')
      expect(tokens).toHaveLength(1)
      expect(tokens[0].type).toBe(TokenType.IntLit)
      expect(tokens[0].lexeme).toBe('42')
    })

    it('lexes integer with underscores', () => {
      const tokens = lex('1_000_000')
      expect(tokens).toHaveLength(1)
      expect(tokens[0].type).toBe(TokenType.IntLit)
      expect(tokens[0].lexeme).toBe('1_000_000')
    })
  })

  // ─── Float literals ────────────────────────────────────────────

  describe('float literals', () => {
    it('lexes 0.0', () => {
      const tokens = lex('0.0')
      expect(tokens).toHaveLength(1)
      expect(tokens[0].type).toBe(TokenType.FloatLit)
      expect(tokens[0].lexeme).toBe('0.0')
    })

    it('lexes 3.14', () => {
      const tokens = lex('3.14')
      expect(tokens).toHaveLength(1)
      expect(tokens[0].type).toBe(TokenType.FloatLit)
      expect(tokens[0].lexeme).toBe('3.14')
    })

    it('lexes float with exponent', () => {
      const tokens = lex('1.0e10')
      expect(tokens).toHaveLength(1)
      expect(tokens[0].type).toBe(TokenType.FloatLit)
      expect(tokens[0].lexeme).toBe('1.0e10')
    })

    it('lexes float with negative exponent', () => {
      const tokens = lex('1.0E-5')
      expect(tokens).toHaveLength(1)
      expect(tokens[0].type).toBe(TokenType.FloatLit)
      expect(tokens[0].lexeme).toBe('1.0E-5')
    })

    it('lexes float with positive exponent', () => {
      const tokens = lex('2.5e+3')
      expect(tokens).toHaveLength(1)
      expect(tokens[0].type).toBe(TokenType.FloatLit)
      expect(tokens[0].lexeme).toBe('2.5e+3')
    })

    it('does not confuse integer followed by range as float', () => {
      const tokens = lex('1..10')
      expect(tokens).toHaveLength(3)
      expect(tokens[0].type).toBe(TokenType.IntLit)
      expect(tokens[0].lexeme).toBe('1')
      expect(tokens[1].type).toBe(TokenType.DotDot)
      expect(tokens[2].type).toBe(TokenType.IntLit)
      expect(tokens[2].lexeme).toBe('10')
    })
  })

  // ─── String literals ──────────────────────────────────────────

  describe('string literals', () => {
    it('lexes simple string', () => {
      const tokens = lex('"hello"')
      expect(tokens).toHaveLength(1)
      expect(tokens[0].type).toBe(TokenType.StringLit)
      expect(tokens[0].lexeme).toBe('"hello"')
    })

    it('lexes empty string', () => {
      const tokens = lex('""')
      expect(tokens).toHaveLength(1)
      expect(tokens[0].type).toBe(TokenType.StringLit)
      expect(tokens[0].lexeme).toBe('""')
    })

    it('lexes string with escape sequences', () => {
      const tokens = lex('"hello\\nworld"')
      expect(tokens).toHaveLength(1)
      expect(tokens[0].type).toBe(TokenType.StringLit)
      expect(tokens[0].lexeme).toBe('"hello\\nworld"')
    })

    it('lexes string with tab escape', () => {
      const tokens = lex('"a\\tb"')
      expect(tokens).toHaveLength(1)
      expect(tokens[0].type).toBe(TokenType.StringLit)
    })

    it('lexes string with escaped backslash', () => {
      const tokens = lex('"a\\\\b"')
      expect(tokens).toHaveLength(1)
      expect(tokens[0].type).toBe(TokenType.StringLit)
    })

    it('lexes string with escaped quote', () => {
      const tokens = lex('"say \\"hi\\""')
      expect(tokens).toHaveLength(1)
      expect(tokens[0].type).toBe(TokenType.StringLit)
    })

    it('lexes string with escaped brace', () => {
      const tokens = lex('"\\{ok}"')
      expect(tokens).toHaveLength(1)
      expect(tokens[0].type).toBe(TokenType.StringLit)
    })

    it('lexes string with unicode escape', () => {
      const tokens = lex('"\\u{0041}"')
      expect(tokens).toHaveLength(1)
      expect(tokens[0].type).toBe(TokenType.StringLit)
    })
  })

  // ─── String interpolation ─────────────────────────────────────

  describe('string interpolation', () => {
    it('lexes string with interpolation', () => {
      const source = new Source('test.hal', '"Hello, {name}"')
      const result = Lexer.tokenize(source)
      expect(result.errors).toEqual([])

      // Should produce: StringStart, Ident(name), StringEnd, EOF
      const types = result.tokens.map((t) => t.type)
      expect(types).toContain(TokenType.StringStart)
      expect(types).toContain(TokenType.Ident)
      expect(types).toContain(TokenType.StringEnd)
      expect(types).toContain(TokenType.EOF)
    })

    it('lexes string with multiple interpolations', () => {
      const source = new Source('test.hal', '"{a} and {b}"')
      const result = Lexer.tokenize(source)
      expect(result.errors).toEqual([])

      const types = result.tokens.map((t) => t.type)
      expect(types).toContain(TokenType.StringStart)
      expect(types).toContain(TokenType.StringMiddle)
      expect(types).toContain(TokenType.StringEnd)
    })
  })

  // ─── Multi-line strings ────────────────────────────────────────

  describe('multi-line strings', () => {
    it('lexes multi-line string', () => {
      const tokens = lex('"""hello\nworld"""')
      expect(tokens).toHaveLength(1)
      expect(tokens[0].type).toBe(TokenType.StringLit)
      expect(tokens[0].lexeme).toBe('"""hello\nworld"""')
    })

    it('lexes empty multi-line string', () => {
      const tokens = lex('""""""')
      expect(tokens).toHaveLength(1)
      expect(tokens[0].type).toBe(TokenType.StringLit)
    })
  })

  // ─── Operators ─────────────────────────────────────────────────

  describe('operators', () => {
    it('lexes all single-character operators', () => {
      const ops: [string, TokenType][] = [
        ['+', TokenType.Plus],
        ['-', TokenType.Minus],
        ['*', TokenType.Star],
        ['/', TokenType.Slash],
        ['%', TokenType.Percent],
        ['<', TokenType.Lt],
        ['>', TokenType.Gt],
        ['=', TokenType.Eq],
        ['?', TokenType.Question],
        ['.', TokenType.Dot],
        [':', TokenType.Colon],
      ]

      for (const [op, expectedType] of ops) {
        const tokens = lex(op)
        expect(tokens).toHaveLength(1)
        expect(tokens[0].type).toBe(expectedType)
        expect(tokens[0].lexeme).toBe(op)
      }
    })

    it('lexes all multi-character operators', () => {
      const ops: [string, TokenType][] = [
        ['==', TokenType.EqEq],
        ['!=', TokenType.BangEq],
        ['<=', TokenType.LtEq],
        ['>=', TokenType.GtEq],
        ['..', TokenType.DotDot],
        ['..=', TokenType.DotDotEq],
        ['=>', TokenType.FatArrow],
        ['->', TokenType.Arrow],
        ['...', TokenType.Spread],
      ]

      for (const [op, expectedType] of ops) {
        const tokens = lex(op)
        expect(tokens).toHaveLength(1)
        expect(tokens[0].type).toBe(expectedType)
        expect(tokens[0].lexeme).toBe(op)
      }
    })
  })

  // ─── Delimiters ────────────────────────────────────────────────

  describe('delimiters', () => {
    it('lexes all delimiters', () => {
      const delims: [string, TokenType][] = [
        ['(', TokenType.LParen],
        [')', TokenType.RParen],
        ['{', TokenType.LBrace],
        ['}', TokenType.RBrace],
        ['[', TokenType.LBracket],
        [']', TokenType.RBracket],
        ['#{', TokenType.HashBrace],
        [',', TokenType.Comma],
        ['#', TokenType.Hash],
      ]

      for (const [delim, expectedType] of delims) {
        const tokens = lex(delim)
        expect(tokens).toHaveLength(1)
        expect(tokens[0].type).toBe(expectedType)
        expect(tokens[0].lexeme).toBe(delim)
      }
    })
  })

  // ─── Identifiers ──────────────────────────────────────────────

  describe('identifiers', () => {
    it('lexes simple identifier', () => {
      const tokens = lex('foo')
      expect(tokens).toHaveLength(1)
      expect(tokens[0].type).toBe(TokenType.Ident)
      expect(tokens[0].lexeme).toBe('foo')
    })

    it('lexes identifier with underscores', () => {
      const tokens = lex('my_var')
      expect(tokens).toHaveLength(1)
      expect(tokens[0].type).toBe(TokenType.Ident)
      expect(tokens[0].lexeme).toBe('my_var')
    })

    it('lexes identifier starting with underscore', () => {
      const tokens = lex('_private')
      expect(tokens).toHaveLength(1)
      expect(tokens[0].type).toBe(TokenType.Ident)
      expect(tokens[0].lexeme).toBe('_private')
    })

    it('lexes PascalCase identifier', () => {
      const tokens = lex('MyType')
      expect(tokens).toHaveLength(1)
      expect(tokens[0].type).toBe(TokenType.Ident)
      expect(tokens[0].lexeme).toBe('MyType')
    })

    it('lexes identifier with digits', () => {
      const tokens = lex('x1')
      expect(tokens).toHaveLength(1)
      expect(tokens[0].type).toBe(TokenType.Ident)
      expect(tokens[0].lexeme).toBe('x1')
    })

    it('does not confuse keyword prefix with keyword', () => {
      const tokens = lex('letter')
      expect(tokens).toHaveLength(1)
      expect(tokens[0].type).toBe(TokenType.Ident)
      expect(tokens[0].lexeme).toBe('letter')
    })
  })

  // ─── Comments ─────────────────────────────────────────────────

  describe('comments', () => {
    it('skips single-line comments', () => {
      const tokens = lex('// this is a comment')
      expect(tokens).toHaveLength(0)
    })

    it('skips single-line comment before token', () => {
      const tokens = lex('// comment\n42')
      expect(tokens).toHaveLength(1)
      expect(tokens[0].type).toBe(TokenType.IntLit)
      expect(tokens[0].lexeme).toBe('42')
    })

    it('skips block comments', () => {
      const tokens = lex('/* block comment */')
      expect(tokens).toHaveLength(0)
    })

    it('skips block comment between tokens', () => {
      const tokens = lex('a /* comment */ b')
      expect(tokens).toHaveLength(2)
      expect(tokens[0].lexeme).toBe('a')
      expect(tokens[1].lexeme).toBe('b')
    })

    it('handles nested block comments', () => {
      const tokens = lex('/* outer /* inner */ still outer */')
      expect(tokens).toHaveLength(0)
    })

    it('handles multi-line block comments', () => {
      const tokens = lex('/* line 1\n   line 2\n   line 3 */')
      expect(tokens).toHaveLength(0)
    })
  })

  // ─── Mixed tokens (realistic code) ────────────────────────────

  describe('mixed tokens', () => {
    it('lexes a let declaration', () => {
      const types = lexTypes('let x = 5')
      expect(types).toEqual([
        TokenType.Let,
        TokenType.Ident,
        TokenType.Eq,
        TokenType.IntLit,
      ])
    })

    it('lexes a mutable let with type annotation', () => {
      const types = lexTypes('let mut x: Int = 42')
      expect(types).toEqual([
        TokenType.Let,
        TokenType.Mut,
        TokenType.Ident,
        TokenType.Colon,
        TokenType.Ident,
        TokenType.Eq,
        TokenType.IntLit,
      ])
    })

    it('lexes a function declaration', () => {
      const types = lexTypes('fn add(a: Int, b: Int) -> Int { return a + b }')
      expect(types).toEqual([
        TokenType.Fn,
        TokenType.Ident,
        TokenType.LParen,
        TokenType.Ident,
        TokenType.Colon,
        TokenType.Ident,
        TokenType.Comma,
        TokenType.Ident,
        TokenType.Colon,
        TokenType.Ident,
        TokenType.RParen,
        TokenType.Arrow,
        TokenType.Ident,
        TokenType.LBrace,
        TokenType.Return,
        TokenType.Ident,
        TokenType.Plus,
        TokenType.Ident,
        TokenType.RBrace,
      ])
    })

    it('lexes a struct declaration', () => {
      const types = lexTypes('struct User { name: String, age: Int }')
      expect(types).toEqual([
        TokenType.Struct,
        TokenType.Ident,
        TokenType.LBrace,
        TokenType.Ident,
        TokenType.Colon,
        TokenType.Ident,
        TokenType.Comma,
        TokenType.Ident,
        TokenType.Colon,
        TokenType.Ident,
        TokenType.RBrace,
      ])
    })

    it('lexes an if/else expression', () => {
      const types = lexTypes('if x > 0 { x } else { 0 }')
      expect(types).toEqual([
        TokenType.If,
        TokenType.Ident,
        TokenType.Gt,
        TokenType.IntLit,
        TokenType.LBrace,
        TokenType.Ident,
        TokenType.RBrace,
        TokenType.Else,
        TokenType.LBrace,
        TokenType.IntLit,
        TokenType.RBrace,
      ])
    })

    it('lexes a match expression', () => {
      const types = lexTypes('match x { case 1 => "one" case _ => "other" }')
      expect(types).toEqual([
        TokenType.Match,
        TokenType.Ident,
        TokenType.LBrace,
        TokenType.Case,
        TokenType.IntLit,
        TokenType.FatArrow,
        TokenType.StringLit,
        TokenType.Case,
        TokenType.Ident,
        TokenType.FatArrow,
        TokenType.StringLit,
        TokenType.RBrace,
      ])
    })

    it('lexes a for loop', () => {
      const types = lexTypes('for item in list { x }')
      expect(types).toEqual([
        TokenType.For,
        TokenType.Ident,
        TokenType.In,
        TokenType.Ident,
        TokenType.LBrace,
        TokenType.Ident,
        TokenType.RBrace,
      ])
    })

    it('lexes method calls and field access', () => {
      const types = lexTypes('user.name.len()')
      expect(types).toEqual([
        TokenType.Ident,
        TokenType.Dot,
        TokenType.Ident,
        TokenType.Dot,
        TokenType.Ident,
        TokenType.LParen,
        TokenType.RParen,
      ])
    })

    it('lexes set literal', () => {
      const types = lexTypes('#{1, 2, 3}')
      expect(types).toEqual([
        TokenType.HashBrace,
        TokenType.IntLit,
        TokenType.Comma,
        TokenType.IntLit,
        TokenType.Comma,
        TokenType.IntLit,
        TokenType.RBrace,
      ])
    })

    it('lexes boolean operators', () => {
      const types = lexTypes('a and b or not c')
      expect(types).toEqual([
        TokenType.Ident,
        TokenType.And,
        TokenType.Ident,
        TokenType.Or,
        TokenType.Not,
        TokenType.Ident,
      ])
    })

    it('lexes error propagation', () => {
      const types = lexTypes('result?')
      expect(types).toEqual([TokenType.Ident, TokenType.Question])
    })

    it('lexes range expressions', () => {
      expect(lexTypes('1..10')).toEqual([
        TokenType.IntLit,
        TokenType.DotDot,
        TokenType.IntLit,
      ])
      expect(lexTypes('1..=10')).toEqual([
        TokenType.IntLit,
        TokenType.DotDotEq,
        TokenType.IntLit,
      ])
    })

    it('lexes effects clause', () => {
      const types = lexTypes('effects [Network, FileSystem]')
      expect(types).toEqual([
        TokenType.Effects,
        TokenType.LBracket,
        TokenType.Ident,
        TokenType.Comma,
        TokenType.Ident,
        TokenType.RBracket,
      ])
    })

    it('lexes import statement', () => {
      const types = lexTypes('import auth.password.{ hash, verify }')
      expect(types).toEqual([
        TokenType.Import,
        TokenType.Ident,
        TokenType.Dot,
        TokenType.Ident,
        TokenType.Dot,
        TokenType.LBrace,
        TokenType.Ident,
        TokenType.Comma,
        TokenType.Ident,
        TokenType.RBrace,
      ])
    })

    it('lexes concurrent block', () => {
      const types = lexTypes('concurrent { a() }')
      expect(types).toEqual([
        TokenType.Concurrent,
        TokenType.LBrace,
        TokenType.Ident,
        TokenType.LParen,
        TokenType.RParen,
        TokenType.RBrace,
      ])
    })
  })

  // ─── Span tracking ────────────────────────────────────────────

  describe('span tracking', () => {
    it('tracks correct positions for tokens', () => {
      const tokens = lex('let x = 5')
      expect(tokens[0].span.start.line).toBe(1)
      expect(tokens[0].span.start.column).toBe(1)
      expect(tokens[0].span.end.column).toBe(4)

      // x
      expect(tokens[1].span.start.column).toBe(5)
      expect(tokens[1].span.end.column).toBe(6)
    })

    it('tracks positions across lines', () => {
      const tokens = lex('a\nb')
      expect(tokens[0].span.start.line).toBe(1)
      expect(tokens[1].span.start.line).toBe(2)
      expect(tokens[1].span.start.column).toBe(1)
    })

    it('records correct file in span', () => {
      const source = new Source('my/file.hal', 'x')
      const result = Lexer.tokenize(source)
      expect(result.tokens[0].span.file).toBe('my/file.hal')
    })
  })

  // ─── Error cases ──────────────────────────────────────────────

  describe('errors', () => {
    it('reports unterminated string', () => {
      const result = lexWithErrors('"hello')
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].code).toBe('E0103')
      expect(result.errors[0].message).toContain('Unterminated string')
      expect(result.errors[0].line).toBe(1)
      expect(result.errors[0].column).toBe(1)
      expect(result.errors[0].suggestion).toBeDefined()
    })

    it('reports unterminated string at newline', () => {
      const result = lexWithErrors('"hello\nworld"')
      expect(result.errors.length).toBeGreaterThanOrEqual(1)
      expect(result.errors[0].code).toBe('E0103')
    })

    it('reports invalid escape sequence', () => {
      const result = lexWithErrors('"hello\\q"')
      expect(result.errors.length).toBeGreaterThanOrEqual(1)
      expect(result.errors[0].code).toBe('E0104')
      expect(result.errors[0].message).toContain('Invalid escape sequence')
      expect(result.errors[0].suggestion).toBeDefined()
    })

    it('reports unexpected character', () => {
      const result = lexWithErrors('`')
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].code).toBe('E0105')
      expect(result.errors[0].message).toContain('Unexpected character')
    })

    it('reports unterminated block comment', () => {
      const result = lexWithErrors('/* unclosed')
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].code).toBe('E0101')
      expect(result.errors[0].message).toContain('Unterminated block comment')
    })

    it('reports unterminated multi-line string', () => {
      const result = lexWithErrors('"""hello')
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].code).toBe('E0103')
      expect(result.errors[0].message).toContain('multi-line string')
    })

    it('reports error with correct file path', () => {
      const source = new Source('src/main.hal', '`')
      const result = Lexer.tokenize(source)
      expect(result.errors[0].file).toBe('src/main.hal')
    })

    it('reports ! without = as error', () => {
      const result = lexWithErrors('!')
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].code).toBe('E0105')
      expect(result.errors[0].suggestion).toContain('not')
    })

    it('continues lexing after error', () => {
      const result = lexWithErrors('` 42')
      expect(result.errors).toHaveLength(1)
      const nonEof = result.tokens.filter((t) => t.type !== TokenType.EOF)
      expect(nonEof).toHaveLength(1)
      expect(nonEof[0].type).toBe(TokenType.IntLit)
    })
  })
})
