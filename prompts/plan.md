# HAL Compiler Implementation Plan

This document defines the phased implementation plan for the HAL-to-TypeScript transpiler.
Each phase is incremental, self-contained, and testable. We follow **TDD** throughout:
write tests first, then implement until they pass.

The compiler is implemented in **TypeScript** and runs on **Node.js**.

## Architecture Overview

```
Source (.hal) → Lexer → Tokens → Parser → AST → Semantic Analysis → Typed AST → Code Gen → TypeScript (.ts)
```

### Compiler Pipeline

| Stage             | Input        | Output       | Key Responsibilities                                |
| ----------------- | ------------ | ------------ | --------------------------------------------------- |
| Lexer             | Source text  | Token stream | Keywords, operators, literals, identifiers          |
| Parser            | Token stream | AST          | Syntax validation, tree construction                |
| Semantic Analysis | AST          | Typed AST    | Type checking, effect checking, contract validation |
| Code Generation   | Typed AST    | TypeScript   | Emit idiomatic TypeScript                           |

### Error Reporting (from Phase 1)

All errors are structured objects with JSON output:

```json
{
  "error": "E0101",
  "message": "Unexpected token '}', expected expression",
  "file": "src/main.hal",
  "line": 12,
  "column": 5,
  "suggestion": "Add an expression before '}'"
}
```

Error codes follow a numbering scheme:

| Range | Category        |
| ----- | --------------- |
| E01xx | Lexer errors    |
| E02xx | Parser errors   |
| E03xx | Type errors     |
| E04xx | Effect errors   |
| E05xx | Contract errors |
| E06xx | Module errors   |
| E07xx | Import errors   |

---

## Phase 1: Project Setup & Infrastructure

**Goal:** A runnable project with test framework, CLI skeleton, and structured error
reporting foundation. No compiler logic yet — just the scaffolding everything else builds
on.

### Tasks

- [x] Initialize Node.js project with TypeScript (`package.json`, `tsconfig.json`).
      **Notice**: those files already exist, only add and change what's necessary. There
      is no ts => js transpiling, modern node.js can directly run TypeScript.
- [x] Set up test framework (Vitest)
- [x] Set up project directory structure:
  ```
  hal/
    src/
      cli/           # CLI entry point
      lexer/         # Phase 2
      parser/        # Phases 3-6
      checker/       # Phases 7-8
      codegen/       # Phase 9
      errors/        # Error types and reporting
      common/        # Shared types (Source, Position, Span)
    tests/
      lexer/
      parser/
      checker/
      codegen/
      e2e/           # End-to-end: .hal → .ts
  ```
- [x] Implement `Source` type (file path, content, line/column lookup from offset)
- [x] Implement `Span` type (start position, end position, source reference)
- [x] Implement `HalError` base type with structured fields:
  - `code`: string (e.g., `"E0101"`)
  - `message`: string
  - `file`: string
  - `line`: number
  - `column`: number
  - `span`: Span
  - `suggestion`: optional string
- [x] Implement `DiagnosticReporter` with two output modes:
  - Human-readable (colored terminal output)
  - JSON (structured, machine-parseable)
- [x] Implement CLI skeleton (`hal` command) with:
  - `hal build <file>` — placeholder that prints "not implemented"
  - `hal test` — placeholder
  - `--format json|human|both` flag for error output format
  - `--help` flag
- [x] Write tests for `Source` (line/column lookup)
- [x] Write tests for `HalError` (JSON serialization, human-readable formatting)
- [x] Write tests for CLI argument parsing

### Deliverable

`hal build src/main.hal` runs, prints "not implemented", and exits. Error infrastructure
is tested and ready.

---

## Phase 2: Lexer

**Goal:** Tokenize all HAL source text into a stream of typed tokens. This is the
foundation for all parsing.

### Tasks

- [x] Define `TokenType` enum covering all HAL tokens:
  - Keywords: `let`, `mut`, `const`, `fn`, `pub`, `return`, `struct`, `enum`, `trait`,
    `impl`, `if`, `else`, `match`, `case`, `for`, `in`, `while`, `break`, `continue`,
    `import`, `as`, `test`, `suite`, `assert`, `assert_eq`, `assert_ne`, `effect`,
    `effects`, `forbids`, `concurrent`, `ffi`, `maps_to`, `true`, `false`, `and`, `or`,
    `not`, `Self`, `type`, `where`, `precondition`, `postcondition`, `invariant`,
    `derive`, `pub`
  - Operators: `+`, `-`, `*`, `/`, `%`, `==`, `!=`, `<`, `>`, `<=`, `>=`, `=`, `..`,
    `..=`, `?`, `.`, `=>`, `:`
  - Delimiters: `(`, `)`, `{`, `}`, `[`, `]`, `#{`, `,`, `#`
  - Literals: IntLit, FloatLit, StringLit, BoolLit
  - Identifiers: Ident
  - Special: `->`, `//`, `/* */`, Newline, EOF
- [x] Define `Token` type (type, lexeme, span)
- [x] Implement `Lexer` class:
  - Consumes `Source`, produces `Token[]`
  - Handles whitespace and comments (skip, do not emit)
  - Handles single-line comments (`//`)
  - Handles block comments (`/* */`)
- [x] Implement integer literal lexing (digits, underscores: `1_000_000`)
- [x] Implement float literal lexing (`3.14`, `1.0e10`, `1.0E-5`)
- [x] Implement string literal lexing:
  - Simple strings: `"hello"`
  - Escape sequences: `\n`, `\t`, `\\`, `\"`, `\{`, `\u{hex}`
  - String interpolation: `"Hello, {name}"` — lex as StringStart, Expr tokens, StringEnd
    (or lex as a single token with interpolation markers)
  - Multi-line strings: `""" ... """`
- [x] Implement identifier and keyword lexing (identifiers that match keywords → keyword
      token)
- [x] Implement operator lexing (including multi-character: `==`, `!=`, `<=`, `>=`, `..`,
      `..=`, `=>`, `->`)
- [x] Implement set literal opening (`#{`)
- [x] Produce structured errors for invalid tokens (unterminated string, invalid escape,
      etc.)

### Tests (write first)

- [x] Test: empty source → `[EOF]`
- [x] Test: single keyword → correct token type
- [x] Test: all keywords → each produces correct token type
- [x] Test: integer literals (`0`, `42`, `1_000_000`) → IntLit tokens
- [x] Test: float literals (`0.0`, `3.14`, `1.0e10`) → FloatLit tokens
- [x] Test: simple string → StringLit
- [x] Test: string with escapes → correct lexeme
- [x] Test: string interpolation `"Hello, {name}"` → correct token sequence
- [x] Test: multi-line string → StringLit
- [x] Test: all operators → correct token types
- [x] Test: all delimiters → correct token types
- [x] Test: identifiers → Ident
- [x] Test: comments are skipped
- [x] Test: block comments are skipped
- [x] Test: mixed tokens (a realistic code snippet)
- [x] Test: unterminated string → structured error with line/column
- [x] Test: invalid escape sequence → structured error
- [x] Test: unexpected character → structured error

### Deliverable

`Lexer.tokenize(source)` returns a typed token stream for any valid HAL source, or
structured errors for invalid input.

---

## Phase 3: Parser — Expressions & Statements

**Goal:** Parse expressions, variable declarations, assignments, and blocks into an AST.

### Tasks

- [x] Define AST node types for this phase:
  - `IntLiteral`, `FloatLiteral`, `StringLiteral`, `BoolLiteral`
  - `StringInterpolation` (segments: array of literal strings and expressions)
  - `Identifier`
  - `BinaryExpr` (left, op, right)
  - `UnaryExpr` (op, operand)
  - `GroupExpr` (parenthesized expression)
  - `ListLiteral`, `MapLiteral`, `SetLiteral`
  - `StructLiteral` (name, fields, spread)
  - `LetDecl` (mutable flag, name, type annotation, initializer)
  - `ConstDecl` (name, type, initializer)
  - `Assignment` (target, value)
  - `Block` (statements, optional trailing expression)
  - `ExprStatement` (expression used as statement)
- [x] Implement `Parser` class (consumes token stream, produces AST)
- [x] Implement Pratt parser (or recursive descent with precedence) for expressions:
  - Operator precedence per spec (member access > unary > mul > add > range > comparison >
    and > or > assignment)
  - Left/right/none associativity per spec
- [x] Implement literal parsing (int, float, string, bool)
- [x] Implement string interpolation parsing
- [x] Implement list literal: `[1, 2, 3]`
- [x] Implement map literal: `{"key": value}`
- [x] Implement set literal: `#{1, 2, 3}`
- [x] Implement `let` and `const` declarations
- [x] Implement assignment statements
- [x] Implement block parsing: `{ statements; optional_expr }`
- [x] Implement block expressions (block as expression)
- [x] Produce structured parse errors (unexpected token, expected expression, etc.)

### Tests (write first)

- [x] Test: integer literal → `IntLiteral` node
- [x] Test: `1 + 2` → `BinaryExpr(IntLiteral(1), +, IntLiteral(2))`
- [x] Test: `1 + 2 * 3` → correct precedence (mul binds tighter)
- [x] Test: `(1 + 2) * 3` → grouped correctly
- [x] Test: `-x` → `UnaryExpr(-, Identifier(x))`
- [x] Test: `not flag` → `UnaryExpr(not, Identifier(flag))`
- [x] Test: `a and b or c` → correct precedence
- [x] Test: `a == b` → `BinaryExpr` with `==`
- [x] Test: `1..10` → range expression
- [x] Test: `"hello {name}"` → `StringInterpolation`
- [x] Test: `[1, 2, 3]` → `ListLiteral`
- [x] Test: `{"a": 1, "b": 2}` → `MapLiteral`
- [x] Test: `#{1, 2, 3}` → `SetLiteral`
- [x] Test: `let x = 5` → `LetDecl`
- [x] Test: `let mut x: Int = 5` → `LetDecl` with mut and type
- [x] Test: `const MAX: Int = 100` → `ConstDecl`
- [x] Test: `x = 10` → `Assignment`
- [x] Test: `{ let x = 1; x + 1 }` → `Block` with trailing expr
- [x] Test: missing expression → structured error
- [x] Test: missing `=` in let → structured error

### Deliverable

Parser turns token streams into ASTs for all expression and statement forms. Structured
errors for syntax mistakes.

---

## Phase 4: Parser — Functions & Control Flow

**Goal:** Parse function declarations (with contracts and effects), closures, and all
control flow constructs.

### Tasks

- [x] Define AST nodes:
  - `FnDecl` (pub, name, generic params, params, return type, contracts, effects, forbids,
    body)
  - `Param` (mut flag, name, type)
  - `Precondition` (body block)
  - `Postcondition` (result name, body block)
  - `EffectsClause` (effect references)
  - `ForbidsClause` (effect references)
  - `ClosureLiteral` (params, return type, body)
  - `FnCall` (callee, generic args, arguments)
  - `MethodCall` (receiver, method name, generic args, arguments)
  - `FieldAccess` (receiver, field name)
  - `IndexAccess` (receiver, index)
  - `ErrorPropagation` (expr + `?`)
  - `ReturnStmt` (optional expr)
  - `IfStmt` / `IfExpr` (condition, then, else-if chains, else)
  - `MatchStmt` / `MatchExpr` (subject, arms)
  - `MatchArm` (pattern, guard, body)
  - `Pattern` variants: literal, wildcard, binding, enum, struct
  - `ForLoop` (pattern, iterable, body)
  - `WhileLoop` (condition, body)
  - `BreakStmt`, `ContinueStmt`
  - `ConcurrentBlock` (expressions)
- [x] Implement function declaration parsing (full signature with contracts and effects)
- [x] Implement closure parsing: `fn(x: Int) -> Int { x + 1 }`
- [x] Implement function call parsing (positional and named arguments)
- [x] Implement postfix operator parsing (`.field`, `.method()`, `[index]`, `?`)
- [x] Implement `if` / `else if` / `else` (both statement and expression forms)
- [x] Implement `match` with pattern arms (`case Pattern => ...`)
- [x] Implement pattern parsing (literal, wildcard `_`, binding, enum, struct)
- [x] Implement `for` loop (including tuple destructuring pattern)
- [x] Implement `while` loop
- [x] Implement `break` and `continue`
- [x] Implement `return` statement
- [x] Implement `concurrent { ... }` block
- [x] Produce structured parse errors for malformed control flow

### Tests (write first)

- [x] Test: `fn add(a: Int, b: Int) -> Int { return a + b }` → `FnDecl`
- [x] Test: function with precondition and postcondition
- [x] Test: function with effects clause
- [x] Test: function with forbids clause
- [x] Test: function with effects + forbids + contracts combined
- [x] Test: `pub fn` → public function
- [x] Test: closure `fn(x) { x + 1 }`
- [x] Test: function call `add(1, 2)`
- [x] Test: named arguments `create(name: "Alice", age: 30)`
- [x] Test: method call `list.push(item)`
- [x] Test: chained calls `a.b().c(d)`
- [x] Test: field access `user.name`
- [x] Test: index access `list[0]`
- [x] Test: error propagation `result?`
- [x] Test: `if x > 0 { ... }` → `IfStmt`
- [x] Test: `if x > 0 { ... } else { ... }` → with else
- [x] Test: `if` as expression (with else, produces value)
- [x] Test: `match x { case 1 => ... case _ => ... }` → `MatchStmt`
- [x] Test: match with enum patterns
- [x] Test: match with struct patterns
- [x] Test: match with guard: `case x if x > 0 => ...`
- [x] Test: `for item in list { ... }` → `ForLoop`
- [x] Test: `for (key, value) in map { ... }` → tuple destructuring
- [x] Test: `while condition { ... }` → `WhileLoop`
- [x] Test: `break` and `continue`
- [x] Test: `return value`
- [x] Test: `concurrent { a(); b() }` → `ConcurrentBlock`
- [x] Test: missing function body → structured error
- [x] Test: missing `=>` in match arm → structured error

### Deliverable

Full function and control flow parsing. A HAL file with functions,
`if`/`match`/`for`/`while`, and concurrent blocks parses into a complete AST.

---

## Phase 5: Parser — Types & Data Structures

**Goal:** Parse struct declarations, enum declarations, type aliases, generics, and impl
blocks.

### Tasks

- [x] Define AST nodes:
  - `StructDecl` (pub, name, generic params, fields, invariants, derive)
  - `StructField` (name, type)
  - `InvariantClause` (body block)
  - `DeriveClause` (trait names)
  - `EnumDecl` (pub, name, generic params, variants, invariants)
  - `EnumVariant` (name, optional fields)
  - `TypeAlias` (pub, name, generic params, target type)
  - `ImplBlock` (trait ref, target type, where clause, methods)
  - `GenericParams` (params with optional trait bounds)
  - `WhereClause` (predicates)
  - Type AST nodes: `PrimitiveType`, `NamedType`, `GenericType`, `FnType`
- [x] Implement type annotation parsing:
  - Primitive types: `Int`, `Float`, `Bool`, `String`, `Void`, `Never`
  - Named types: `User`, `MyType`
  - Generic types: `List<Int>`, `Map<String, Int>`, `Result<User, Error>`
  - Function types: `fn(Int, Int) -> Int`
- [x] Implement struct declaration parsing (fields, invariants, derive)
- [x] Implement enum declaration parsing (unit and data variants)
- [x] Implement type alias parsing: `type UserId = Int`
- [x] Implement generic parameter parsing: `<T>`, `<T: Eq>`, `<T: Eq + Hashable>`
- [x] Implement where clause parsing: `where T: Serializable`
- [x] Implement impl block parsing: `impl Type { ... }` and `impl Trait for Type { ... }`
- [x] Implement struct literal parsing: `User { name: "Alice", age: 30 }`
- [x] Implement struct update syntax: `User { ...existing, name: "Bob" }`

### Tests (write first)

- [x] Test: `struct User { name: String, age: Int }` → `StructDecl`
- [x] Test: struct with invariant
- [x] Test: struct with derive: `derive [Eq, Hashable]`
- [x] Test: `pub struct` → public struct
- [x] Test: `enum Color { Red, Green, Blue }` → `EnumDecl` with unit variants
- [x] Test: `enum Shape { Circle(radius: Float), Rect(w: Float, h: Float) }` → data
      variants
- [x] Test: `type UserId = Int` → `TypeAlias`
- [x] Test: `type Pair<A, B> = { first: A, second: B }` → generic alias
- [x] Test: generic type annotation `List<Int>`
- [x] Test: nested generic `Result<List<User>, Error>`
- [x] Test: function type `fn(Int) -> Bool`
- [x] Test: `impl User { fn name(self) -> String { ... } }` → `ImplBlock`
- [x] Test: `impl Display for User { ... }` → trait impl
- [x] Test: where clause: `where T: Eq + Hashable`
- [x] Test: struct literal `User { name: "Alice", age: 30 }`
- [x] Test: struct update `User { ...old, name: "Bob" }`
- [x] Test: missing field type → structured error
- [x] Test: duplicate variant name → structured error

### Deliverable

Complete data structure parsing. Structs, enums, type aliases, generics, and impl blocks
all produce correct ASTs.

---

## Phase 6: Parser — Traits, Effects, Tests, Imports & FFI

**Goal:** Parse all remaining top-level declarations: traits, effects, test blocks, import
statements, and FFI blocks. The parser is now complete.

### Tasks

- [ ] Define AST nodes:
  - `TraitDecl` (pub, name, generic params, super traits, methods)
  - `TraitMethod` (signature + optional default body)
  - `EffectDecl` (pub, name, operations)
  - `TestDecl` (name, body)
  - `TestSuiteDecl` (name, nested tests and suites)
  - `AssertStmt` (`assert expr`)
  - `AssertEqStmt` (`assert_eq(a, b)`)
  - `AssertNeStmt` (`assert_ne(a, b)`)
  - `ImportDecl` (module path, imported names, aliases)
  - `FfiBlock` (target, declarations)
  - `FfiTypeDecl` (name)
  - `FfiFnDecl` (name, params, return type, maps_to, effects)
  - `Program` (list of top-level declarations)
- [ ] Implement trait declaration parsing (with super traits, default methods)
- [ ] Implement effect declaration parsing: `effect FileSystem { Read, Write }`
- [ ] Implement test block parsing: `test "name" { ... }`
- [ ] Implement test suite parsing: `test suite "name" { ... }` (with nesting)
- [ ] Implement assert statement parsing (`assert`, `assert_eq`, `assert_ne`)
- [ ] Implement import parsing:
  - Simple: `import auth.password.hash`
  - Grouped: `import auth.password.{ hash, verify }`
  - Aliased: `import auth.token.Token as AuthToken`
  - Pub import: `pub import auth.password.{ hash, verify }`
- [ ] Implement FFI block parsing:
  - `ffi "typescript" { ... }`
  - FFI type declarations: `type Element`
  - FFI function declarations with `maps_to`
- [ ] Implement `Program` node: top-level sequence of declarations
- [ ] Verify parser handles full HAL programs (imports + declarations + tests)

### Tests (write first)

- [ ] Test: `trait Display { fn to_string(self) -> String }` → `TraitDecl`
- [ ] Test: trait with super trait: `trait Ordered: Eq { ... }`
- [ ] Test: trait with default method implementation
- [ ] Test: `effect FileSystem { Read, Write }` → `EffectDecl`
- [ ] Test: `test "works" { assert true }` → `TestDecl`
- [ ] Test: `test suite "math" { test "add" { ... } }` → `TestSuiteDecl`
- [ ] Test: nested test suites
- [ ] Test: `assert 1 + 1 == 2` → `AssertStmt`
- [ ] Test: `assert_eq(a, b)` → `AssertEqStmt`
- [ ] Test: `import auth.password.hash` → `ImportDecl`
- [ ] Test: `import auth.{ hash, verify }` → grouped import
- [ ] Test: `import x.Y as Z` → aliased import
- [ ] Test: `pub import x.{ a, b }` → public re-export
- [ ] Test: FFI block with type and function declarations
- [ ] Test: `maps_to` with effects clause
- [ ] Test: full program (imports + struct + functions + tests)
- [ ] Test: wildcard import `import foo.*` → structured error (not allowed)
- [ ] Test: circular import detection → structured error (deferred to module resolution)

### Deliverable

The parser is **complete**. Any valid HAL source text can be parsed into a full AST.

---

## Phase 7: Type Checker

**Goal:** Implement type inference, type checking, and generic instantiation. Transform
the untyped AST into a typed AST where every expression has a resolved type.

### Tasks

- [ ] Define typed AST (mirrors untyped AST but every node carries a resolved `Type`)
- [ ] Define `Type` representation:
  - Primitive types (Int, Float, Bool, String, Void, Never)
  - Named types (struct, enum references)
  - Generic types with type arguments
  - Function types
  - Type variables (for inference)
- [ ] Implement `TypeEnvironment` (scoped symbol table):
  - Variable bindings with types
  - Function signatures
  - Struct/enum/trait declarations
  - Scope nesting (block scope, function scope, module scope)
- [ ] Implement type inference for `let` declarations (infer from initializer)
- [ ] Implement type checking for:
  - Literals → their natural types
  - Binary operators (arithmetic: Int/Float, comparison: Bool, logical: Bool)
  - Unary operators (`not` → Bool, `-` → Int/Float)
  - Variable references → lookup in environment
  - Function calls → check argument types against parameter types
  - Method calls → resolve impl, check types
  - Field access → resolve struct field type
  - Index access → resolve collection element type
  - String interpolation → all interpolated values must be `Displayable`
- [ ] Implement type checking for control flow:
  - `if` expression branches must have same type
  - `match` arms must have same type (for expressions)
  - `match` must be exhaustive (all enum variants covered, or `_` wildcard present)
  - `for` loop variable type inferred from iterable
- [ ] Implement generic instantiation:
  - Resolve `List<Int>` → concrete type
  - Infer generic args where possible: `List.new()` from context
  - Check trait bounds on type parameters
- [ ] Implement `Result<T, E>` and `Optional<T>` type checking:
  - `?` operator: only valid on `Result` or `Optional`
  - `?` on `Result<T, E>`: expression type is `T`, function must return `Result<_, E>`
  - `?` on `Optional<T>`: expression type is `T`, function must return `Optional<_>`
- [ ] Implement struct invariant validation (ensure invariant body is Bool-typed)
- [ ] Implement struct literal type checking (all fields present and correctly typed)
- [ ] Implement pattern type checking in match arms
- [ ] Produce structured type errors:
  - Type mismatch: "Expected Int, got String"
  - Unknown variable/function/type
  - Wrong number of arguments
  - Non-exhaustive match
  - Invalid `?` usage
  - Trait bound not satisfied

### Tests (write first)

- [ ] Test: `let x = 5` → x inferred as `Int`
- [ ] Test: `let x: String = 5` → type mismatch error
- [ ] Test: `1 + 2` → type `Int`
- [ ] Test: `1 + 2.0` → type mismatch (Int + Float)
- [ ] Test: `true and false` → type `Bool`
- [ ] Test: `1 and 2` → type error (and requires Bool)
- [ ] Test: function call with correct types → passes
- [ ] Test: function call with wrong argument type → error
- [ ] Test: function call with wrong number of args → error
- [ ] Test: `if true { 1 } else { 2 }` → type `Int`
- [ ] Test: `if true { 1 } else { "two" }` → type mismatch in branches
- [ ] Test: match exhaustiveness: missing variant → error
- [ ] Test: match with wildcard → passes
- [ ] Test: `result?` in function returning `Result` → passes
- [ ] Test: `result?` in function not returning `Result` → error
- [ ] Test: generic function instantiation
- [ ] Test: trait bound violation → error
- [ ] Test: struct literal with missing field → error
- [ ] Test: struct literal with wrong field type → error
- [ ] Test: unknown identifier → error with suggestion

### Deliverable

The type checker validates all type constraints and produces a typed AST. Clear,
structured errors for every type violation.

---

## Phase 8: Effect Checker & Contracts

**Goal:** Verify effect declarations, check contract types, and validate `forbids`
clauses.

### Tasks

- [ ] Implement `EffectEnvironment`:
  - Track declared effects per function
  - Track forbidden effects per function
  - Resolve effect hierarchies (e.g., `FileSystem.Read` is a sub-effect of `FileSystem`)
- [ ] Implement effect propagation checking:
  - If function A calls function B, and B has effects, A must declare those effects
  - Transitive propagation through the call graph
- [ ] Implement `forbids` checking:
  - If a function declares `forbids [Network]`, verify it never calls anything with
    Network effects
  - Verify that `forbids` and `effects` don't contradict each other
- [ ] Implement effect checking for `concurrent` blocks:
  - All effects used by operations must be declared on enclosing function
  - No shared mutable state between concurrent operations
- [ ] Implement FFI effect checking:
  - FFI functions have implicit `FFI` effect if no explicit effects declared
  - Verify FFI effects are propagated
- [ ] Implement contract validation:
  - Precondition body must be Bool-typed
  - Postcondition body must be Bool-typed
  - Postcondition parameter name binds to function return type
  - Struct invariant body must be Bool-typed
- [ ] Produce structured effect errors:
  - Missing effect declaration (with suggestion to add it)
  - Forbidden effect violation (which call triggered it)
  - Effect/forbids contradiction

### Tests (write first)

- [ ] Test: function with correct effects → passes
- [ ] Test: calling effectful function without declaring effect → error
- [ ] Test: transitive effect propagation → must declare transitive effects
- [ ] Test: `forbids [Network]` + calling network function → error
- [ ] Test: `effects [Network] + forbids [Network]` → contradiction error
- [ ] Test: pure function calling effectful function → error
- [ ] Test: concurrent block effects match enclosing function → passes
- [ ] Test: concurrent block with undeclared effect → error
- [ ] Test: concurrent block with shared mutable state → error
- [ ] Test: precondition with non-Bool body → error
- [ ] Test: postcondition with non-Bool body → error
- [ ] Test: FFI function gets implicit FFI effect
- [ ] Test: effect hierarchy: declaring `FileSystem` covers `FileSystem.Read`

### Deliverable

Complete effect and contract verification. The semantic analysis pipeline (type checker +
effect checker) catches all static errors before code generation.

---

## Phase 9: TypeScript Code Generation

**Goal:** Emit idiomatic TypeScript from the typed AST. This is where HAL becomes
executable.

### Tasks

- [ ] Implement `CodeGenerator` class (typed AST → TypeScript source string)
- [ ] Implement emission for primitives:
  - `Int` → `number`
  - `Float` → `number`
  - `Bool` → `boolean`
  - `String` → `string`
  - `Void` → `void`
  - `List<T>` → `Array<T>`
  - `Map<K, V>` → `Map<K, V>`
  - `Set<T>` → `Set<T>`
  - `Optional<T>` → `T | null`
  - `Result<T, E>` → tagged union class
- [ ] Implement `Result<T, E>` runtime type:
  - Generate a `Result` class with `ok()`, `err()`, `isOk()`, `isErr()`, `unwrap()`, etc.
  - Emit as part of a runtime prelude
- [ ] Implement `Optional<T>` handling:
  - `Optional.some(x)` → `x`
  - `Optional.none()` → `null`
  - `?` operator on Optional → null check with early return
- [ ] Implement expression emission:
  - Literals → TypeScript literals
  - Binary/unary ops → TypeScript operators (note: `and`→`&&`, `or`→`||`, `not`→`!`)
  - String interpolation → template literals
  - List/Map/Set literals → `[...]`, `new Map([...])`, `new Set([...])`
- [ ] Implement statement emission:
  - `let` → `const` (or `let` for mutable)
  - `const` → `const`
  - Assignment → `=`
  - Return → `return`
- [ ] Implement function emission:
  - `fn` → `function` (or arrow function for closures)
  - Parameters with TypeScript types
  - Contracts → runtime assertion calls (conditional on build mode)
  - `?` operator → early return pattern
- [ ] Implement control flow emission:
  - `if`/`else` → `if`/`else`
  - `match` → `switch` or `if`/`else if` chain (depending on pattern complexity)
  - `for` → `for...of`
  - `while` → `while`
- [ ] Implement struct emission:
  - Struct → TypeScript `class` with readonly fields
  - Invariants → validation in constructor (`.new()` factory method returns `Result`)
  - Struct update → spread syntax
- [ ] Implement enum emission:
  - Unit variants → string union or const enum
  - Data variants → tagged union (discriminated union)
  - Pattern matching on enums → type narrowing
- [ ] Implement trait emission:
  - Trait → TypeScript `interface`
  - Impl block → methods added to class prototype or standalone functions
  - Default methods → default implementation in interface companion
- [ ] Implement `concurrent` block emission:
  - `concurrent { a(); b() }` → `await Promise.all([a(), b()])`
  - `concurrent_map` → `await Promise.all(items.map(...))`
  - Enclosing function becomes `async`
- [ ] Implement effect-driven async:
  - Functions with effects that map to async operations → `async function`
  - Call sites → `await`
  - The agent never writes async/await; the codegen decides based on effects
- [ ] Implement test emission:
  - `test "name" { ... }` → test runner compatible output (e.g., simple `console.assert`
    or a minimal test harness)
  - `assert` → runtime assertion with file/line info
  - `assert_eq` / `assert_ne` → equality check with diff output
  - JSON test output format per spec

### Tests (write first)

- [ ] Test: `let x = 5` → `const x = 5;`
- [ ] Test: `let mut x = 5` → `let x = 5;`
- [ ] Test: `fn add(a: Int, b: Int) -> Int { return a + b }` → TypeScript function
- [ ] Test: string interpolation `"Hello, {name}"` → `` `Hello, ${name}` ``
- [ ] Test: `[1, 2, 3]` → `[1, 2, 3]`
- [ ] Test: `and`/`or`/`not` → `&&`/`||`/`!`
- [ ] Test: `if` expression → ternary or IIFE
- [ ] Test: `match` on enum → switch/if chain with type narrowing
- [ ] Test: `for item in list { ... }` → `for (const item of list) { ... }`
- [ ] Test: struct declaration → class with constructor
- [ ] Test: struct with invariant → constructor returns Result
- [ ] Test: enum with data variants → discriminated union
- [ ] Test: `result?` → early return pattern
- [ ] Test: `concurrent { a(); b() }` → `await Promise.all([a(), b()])`
- [ ] Test: effectful function → `async function`
- [ ] Test: `test "name" { assert true }` → test runner output
- [ ] Test: contract → runtime check
- [ ] Test: full program (imports + types + functions + tests) → valid TypeScript

### Deliverable

The code generator produces valid, idiomatic TypeScript from any typed HAL AST. Generated
code can be compiled by `tsc` and executed by Node.js.

---

## Phase 10: Modules, CLI & Integration

**Goal:** Implement the module system, multi-file compilation, file-to-module mapping, and
the full CLI. Wire everything together for end-to-end compilation.

### Tasks

- [ ] Implement module resolution:
  - File path → module name mapping per spec (e.g., `src/auth/password.hal` →
    `auth.password`)
  - `mod.hal` as directory module
  - `src/main.hal` as application entry point
  - `src/lib.hal` as library root
- [ ] Implement import resolution:
  - Resolve `import auth.password.hash` to the correct module and declaration
  - Verify imported names are `pub`
  - Detect circular imports → structured error
  - Handle `pub import` re-exports
  - Handle aliased imports
- [ ] Implement multi-file compilation:
  - Build dependency graph from imports
  - Topological sort for compilation order
  - Compile each module, carry forward type information
- [ ] Implement visibility checking:
  - Non-pub declarations cannot be imported from other modules
  - Tests in same file can access private declarations
  - Test files in `tests/` can only access pub declarations
- [ ] Implement full CLI:
  - `hal build <file|dir>` — compile to TypeScript
  - `hal build --output <dir>` — output directory
  - `hal test` — run all tests
  - `hal test <file>` — run tests in specific file
  - `hal test --suite "name"` — filter by suite
  - `hal test --name "pattern"` — filter by name
  - `hal test --generate-contract-tests` — auto-generate contract tests
  - `hal test --format json|human|both`
  - `hal interface <file>` — generate `.hali` from `.hal`
  - `--format json|human|both` — error output format (for all commands)
- [ ] Implement `.hali` interface file generation (extract pub declarations)
- [ ] Implement TypeScript project output:
  - Generate `tsconfig.json` for output
  - Generate `package.json` for output (if applicable)
  - Generate runtime prelude (Result class, assertion helpers, etc.)
  - Emit one `.ts` file per `.hal` module
- [ ] Implement `hal.toml` manifest reading:
  - Parse project metadata
  - Read dependencies section
  - Read targets section
- [ ] End-to-end integration tests:
  - Compile a multi-file HAL project → TypeScript
  - Run the generated TypeScript with Node.js
  - Verify output matches expected behavior

### Tests (write first)

- [ ] Test: file path to module name mapping
- [ ] Test: import resolution (simple, grouped, aliased)
- [ ] Test: circular import detection → error
- [ ] Test: importing non-pub declaration → error
- [ ] Test: pub import re-export works
- [ ] Test: multi-file compilation order (topological sort)
- [ ] Test: visibility enforcement across modules
- [ ] Test: `hal build` produces `.ts` files
- [ ] Test: generated TypeScript compiles with `tsc`
- [ ] Test: generated TypeScript runs correctly with Node.js
- [ ] Test: `hal test` runs tests and produces structured output
- [ ] Test: `hal interface` generates correct `.hali`
- [ ] Test: end-to-end: multi-module HAL project → working TypeScript application

### Deliverable

The complete HAL-to-TypeScript compiler. `hal build` compiles HAL projects to TypeScript.
`hal test` runs tests with structured output. The full pipeline works end-to-end.

---

## Phase Summary

| Phase | Focus                            | Key Output                                    |
| ----- | -------------------------------- | --------------------------------------------- |
| 1     | Project Setup & Infrastructure   | CLI skeleton, error reporting, test framework |
| 2     | Lexer                            | Source → tokens                               |
| 3     | Parser: Expressions & Statements | Literals, operators, let/const, blocks        |
| 4     | Parser: Functions & Control Flow | fn, if, match, for, while, concurrent         |
| 5     | Parser: Types & Data Structures  | struct, enum, generics, impl                  |
| 6     | Parser: Traits, Effects, etc.    | trait, effect, test, import, FFI              |
| 7     | Type Checker                     | Type inference and checking                   |
| 8     | Effect Checker & Contracts       | Effect propagation, contract validation       |
| 9     | TypeScript Code Generation       | Typed AST → TypeScript source                 |
| 10    | Modules, CLI & Integration       | Multi-file, full CLI, end-to-end              |
