import type { Span } from '../common/span.ts'

// ─── Base ────────────────────────────────────────────────────────

/** Every AST node carries a span for error reporting. */
export interface BaseNode {
  readonly span: Span
}

// ─── Expressions ─────────────────────────────────────────────────

export interface IntLiteral extends BaseNode {
  readonly kind: 'IntLiteral'
  readonly value: number
}

export interface FloatLiteral extends BaseNode {
  readonly kind: 'FloatLiteral'
  readonly value: number
}

export interface StringLiteral extends BaseNode {
  readonly kind: 'StringLiteral'
  readonly value: string
}

export interface BoolLiteral extends BaseNode {
  readonly kind: 'BoolLiteral'
  readonly value: boolean
}

export interface Identifier extends BaseNode {
  readonly kind: 'Identifier'
  readonly name: string
}

/** String interpolation: `"Hello, {name}!"` */
export interface StringInterpolation extends BaseNode {
  readonly kind: 'StringInterpolation'
  readonly segments: readonly (string | Expr)[]
}

export interface BinaryExpr extends BaseNode {
  readonly kind: 'BinaryExpr'
  readonly left: Expr
  readonly op: string
  readonly right: Expr
}

export interface UnaryExpr extends BaseNode {
  readonly kind: 'UnaryExpr'
  readonly op: string
  readonly operand: Expr
}

export interface GroupExpr extends BaseNode {
  readonly kind: 'GroupExpr'
  readonly expr: Expr
}

export interface ListLiteral extends BaseNode {
  readonly kind: 'ListLiteral'
  readonly elements: readonly Expr[]
}

export interface MapLiteral extends BaseNode {
  readonly kind: 'MapLiteral'
  readonly entries: readonly MapEntry[]
}

export interface MapEntry {
  readonly key: Expr
  readonly value: Expr
}

export interface SetLiteral extends BaseNode {
  readonly kind: 'SetLiteral'
  readonly elements: readonly Expr[]
}

export interface StructLiteral extends BaseNode {
  readonly kind: 'StructLiteral'
  readonly name: string
  readonly fields: readonly StructFieldInit[]
  readonly spread?: Expr
}

export interface StructFieldInit {
  readonly name: string
  readonly value: Expr
}

export interface BlockExpr extends BaseNode {
  readonly kind: 'BlockExpr'
  readonly statements: readonly Stmt[]
  readonly trailing?: Expr
}

/** All expression node types. */
export type Expr =
  | IntLiteral
  | FloatLiteral
  | StringLiteral
  | BoolLiteral
  | Identifier
  | StringInterpolation
  | BinaryExpr
  | UnaryExpr
  | GroupExpr
  | ListLiteral
  | MapLiteral
  | SetLiteral
  | StructLiteral
  | BlockExpr

// ─── Statements ──────────────────────────────────────────────────

export interface LetDecl extends BaseNode {
  readonly kind: 'LetDecl'
  readonly mutable: boolean
  readonly name: string
  readonly typeAnnotation?: string
  readonly initializer: Expr
}

export interface ConstDecl extends BaseNode {
  readonly kind: 'ConstDecl'
  readonly name: string
  readonly typeAnnotation?: string
  readonly initializer: Expr
}

export interface Assignment extends BaseNode {
  readonly kind: 'Assignment'
  readonly target: string
  readonly value: Expr
}

export interface ExprStatement extends BaseNode {
  readonly kind: 'ExprStatement'
  readonly expr: Expr
}

/** All statement node types. */
export type Stmt = LetDecl | ConstDecl | Assignment | ExprStatement

/** Result of parsing: a list of statements. */
export interface ParseResult {
  readonly statements: readonly Stmt[]
  readonly errors: readonly import('../errors/hal-error.ts').HalError[]
}
