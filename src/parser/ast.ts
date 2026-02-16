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

// ─── Phase 4: Function & Control Flow Expressions ────────────────

export interface FnCall extends BaseNode {
  readonly kind: 'FnCall'
  readonly callee: Expr
  readonly args: readonly CallArg[]
}

export interface CallArg {
  readonly name?: string
  readonly value: Expr
}

export interface MethodCall extends BaseNode {
  readonly kind: 'MethodCall'
  readonly receiver: Expr
  readonly method: string
  readonly args: readonly CallArg[]
}

export interface FieldAccess extends BaseNode {
  readonly kind: 'FieldAccess'
  readonly receiver: Expr
  readonly field: string
}

export interface IndexAccess extends BaseNode {
  readonly kind: 'IndexAccess'
  readonly receiver: Expr
  readonly index: Expr
}

export interface ErrorPropagation extends BaseNode {
  readonly kind: 'ErrorPropagation'
  readonly expr: Expr
}

export interface ClosureLiteral extends BaseNode {
  readonly kind: 'ClosureLiteral'
  readonly params: readonly Param[]
  readonly returnType?: string
  readonly body: Expr
}

export interface IfExpr extends BaseNode {
  readonly kind: 'IfExpr'
  readonly condition: Expr
  readonly then: Expr
  readonly elseIfs: readonly { condition: Expr; body: Expr }[]
  readonly elseBody?: Expr
}

export interface MatchExpr extends BaseNode {
  readonly kind: 'MatchExpr'
  readonly subject: Expr
  readonly arms: readonly MatchArm[]
}

export interface MatchArm {
  readonly pattern: Pattern
  readonly guard?: Expr
  readonly body: Expr
}

export interface ConcurrentBlock extends BaseNode {
  readonly kind: 'ConcurrentBlock'
  readonly exprs: readonly Expr[]
}

// ─── Patterns ────────────────────────────────────────────────────

export interface LiteralPattern extends BaseNode {
  readonly kind: 'LiteralPattern'
  readonly value: Expr
}

export interface WildcardPattern extends BaseNode {
  readonly kind: 'WildcardPattern'
}

export interface BindingPattern extends BaseNode {
  readonly kind: 'BindingPattern'
  readonly name: string
}

export interface EnumPattern extends BaseNode {
  readonly kind: 'EnumPattern'
  readonly name: string
  readonly variant: string
  readonly fields: readonly PatternField[]
}

export interface PatternField {
  readonly name: string
  readonly pattern?: Pattern
}

export interface StructPattern extends BaseNode {
  readonly kind: 'StructPattern'
  readonly name: string
  readonly fields: readonly PatternField[]
}

export type Pattern =
  | LiteralPattern
  | WildcardPattern
  | BindingPattern
  | EnumPattern
  | StructPattern

// ─── All expression node types ───────────────────────────────────

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
  | FnCall
  | MethodCall
  | FieldAccess
  | IndexAccess
  | ErrorPropagation
  | ClosureLiteral
  | IfExpr
  | MatchExpr
  | ConcurrentBlock

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

// ─── Phase 4: Function & Control Flow Statements ─────────────────

export interface Param {
  readonly mutable: boolean
  readonly name: string
  readonly type?: string
}

export interface FnDecl extends BaseNode {
  readonly kind: 'FnDecl'
  readonly pub: boolean
  readonly name: string
  readonly params: readonly Param[]
  readonly returnType?: string
  readonly effects?: readonly string[]
  readonly forbids?: readonly string[]
  readonly preconditions: readonly Expr[]
  readonly postconditions: readonly { name?: string; body: Expr }[]
  readonly body: Expr
}

export interface ReturnStmt extends BaseNode {
  readonly kind: 'ReturnStmt'
  readonly value?: Expr
}

export interface ForLoop extends BaseNode {
  readonly kind: 'ForLoop'
  readonly pattern: string | readonly string[]
  readonly iterable: Expr
  readonly body: Expr
}

export interface WhileLoop extends BaseNode {
  readonly kind: 'WhileLoop'
  readonly condition: Expr
  readonly body: Expr
}

export interface BreakStmt extends BaseNode {
  readonly kind: 'BreakStmt'
}

export interface ContinueStmt extends BaseNode {
  readonly kind: 'ContinueStmt'
}

/** All statement node types. */
export type Stmt =
  | LetDecl
  | ConstDecl
  | Assignment
  | ExprStatement
  | FnDecl
  | ReturnStmt
  | ForLoop
  | WhileLoop
  | BreakStmt
  | ContinueStmt

/** Result of parsing: a list of statements. */
export interface ParseResult {
  readonly statements: readonly Stmt[]
  readonly errors: readonly import('../errors/hal-error.ts').HalError[]
}
