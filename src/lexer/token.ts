import type { Span } from '../common/span.ts'

/** All token types in the HAL language. */
export const TokenType = {
  // Keywords
  Let: 'Let',
  Mut: 'Mut',
  Const: 'Const',
  Fn: 'Fn',
  Pub: 'Pub',
  Return: 'Return',
  Struct: 'Struct',
  Enum: 'Enum',
  Trait: 'Trait',
  Impl: 'Impl',
  If: 'If',
  Else: 'Else',
  Match: 'Match',
  Case: 'Case',
  For: 'For',
  In: 'In',
  While: 'While',
  Break: 'Break',
  Continue: 'Continue',
  Import: 'Import',
  As: 'As',
  Test: 'Test',
  Suite: 'Suite',
  Assert: 'Assert',
  AssertEq: 'AssertEq',
  AssertNe: 'AssertNe',
  Effect: 'Effect',
  Effects: 'Effects',
  Forbids: 'Forbids',
  Concurrent: 'Concurrent',
  Ffi: 'Ffi',
  MapsTo: 'MapsTo',
  True: 'True',
  False: 'False',
  And: 'And',
  Or: 'Or',
  Not: 'Not',
  SelfType: 'SelfType',
  Type: 'Type',
  Where: 'Where',
  Precondition: 'Precondition',
  Postcondition: 'Postcondition',
  Invariant: 'Invariant',
  Derive: 'Derive',

  // Operators
  Plus: 'Plus',
  Minus: 'Minus',
  Star: 'Star',
  Slash: 'Slash',
  Percent: 'Percent',
  EqEq: 'EqEq',
  BangEq: 'BangEq',
  Lt: 'Lt',
  Gt: 'Gt',
  LtEq: 'LtEq',
  GtEq: 'GtEq',
  Eq: 'Eq',
  DotDot: 'DotDot',
  DotDotEq: 'DotDotEq',
  Question: 'Question',
  Dot: 'Dot',
  Arrow: 'Arrow',
  FatArrow: 'FatArrow',
  Colon: 'Colon',

  // Delimiters
  LParen: 'LParen',
  RParen: 'RParen',
  LBrace: 'LBrace',
  RBrace: 'RBrace',
  LBracket: 'LBracket',
  RBracket: 'RBracket',
  HashBrace: 'HashBrace',
  Comma: 'Comma',
  Hash: 'Hash',

  // Literals
  IntLit: 'IntLit',
  FloatLit: 'FloatLit',
  StringLit: 'StringLit',

  // String interpolation
  StringStart: 'StringStart',
  StringMiddle: 'StringMiddle',
  StringEnd: 'StringEnd',

  // Identifiers
  Ident: 'Ident',

  // Special
  Spread: 'Spread',
  EOF: 'EOF',
} as const

export type TokenType = (typeof TokenType)[keyof typeof TokenType]

/** A single token produced by the lexer. */
export interface Token {
  readonly type: TokenType
  readonly lexeme: string
  readonly span: Span
}

/** Map of keyword strings to their TokenTypes. */
export const KEYWORDS: ReadonlyMap<string, TokenType> = new Map([
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
])
