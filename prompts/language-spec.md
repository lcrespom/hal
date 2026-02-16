# HAL Language Specification

**Version:** 0.1.0 (Draft)

This is the formal specification for HAL (High-level Agentic coding Language). It defines
the syntax, semantics, and behavior of every language construct. The
[design principles](design-principles.md) and [high-level design](high-level-design.md)
inform this specification.

## Notation

This specification uses EBNF notation for grammar rules. The full formal grammar is
collected in [spec/grammar.md](spec/grammar.md).

In prose, `monospace` denotes syntax or keywords. **Bold** denotes defined terms on first
use. _Italic_ denotes emphasis.

## Language Overview

HAL is a statically typed, high-level language that compiles to target languages
(initially TypeScript). Agents write business logic, data models, contracts, and effects.
The transpiler handles all low-level concerns.

Key properties:

- **Statically typed** with full type inference where unambiguous.
- **Pure by default** — side effects require explicit declaration.
- **Immutable by default** — mutation requires explicit opt-in.
- **No null/nil** — `Optional<T>` for nullable values, `Result<T, E>` for fallible
  operations.
- **No exceptions** — all errors flow through `Result<T, E>` and the `?` operator.
- **No async/await** — the effect system drives async compilation transparently.
- **No manual memory management** — the transpiler decides GC, reference counting, etc.
- **Contract-based** — preconditions, postconditions, and invariants are first-class.
- **Effect-tracked** — every side effect is declared and compiler-verified.

## Specification Sections

Each section is a self-contained document. Read only what you need.

| Section          | File                                             | Contents                                                       |
| ---------------- | ------------------------------------------------ | -------------------------------------------------------------- |
| Types            | [spec/types.md](spec/types.md)                   | Primitive types, composite types, generics, type inference     |
| Functions        | [spec/functions.md](spec/functions.md)           | Function declarations, closures, contracts, purity             |
| Control Flow     | [spec/control-flow.md](spec/control-flow.md)     | `if`, `match`, `for`, `while`, expressions vs statements       |
| Structs & Enums  | [spec/structs-enums.md](spec/structs-enums.md)   | Struct declarations, enum declarations, invariants, methods    |
| Traits           | [spec/traits.md](spec/traits.md)                 | Trait definitions, `impl` blocks, trait bounds                 |
| Modules          | [spec/modules.md](spec/modules.md)               | Module system, visibility, imports, interface files            |
| Effects          | [spec/effects.md](spec/effects.md)               | Effect declarations, propagation, `forbids`, effect hierarchy  |
| Concurrency      | [spec/concurrency.md](spec/concurrency.md)       | `concurrent` blocks, independence semantics                    |
| Testing          | [spec/testing.md](spec/testing.md)               | `test` blocks, `test suite`, assertions, contract verification |
| Error Handling   | [spec/error-handling.md](spec/error-handling.md) | `Result<T, E>`, `Optional<T>`, `?` operator, error types       |
| Standard Library | [spec/stdlib.md](spec/stdlib.md)                 | Abstract capabilities, built-in traits, collection operations  |
| FFI              | [spec/ffi.md](spec/ffi.md)                       | Foreign function interface, `ffi` blocks, type mapping         |
| Grammar          | [spec/grammar.md](spec/grammar.md)               | Complete formal grammar in EBNF                                |

## Source Encoding

All HAL source files are UTF-8 encoded. The file extension is `.hal`. Interface files use
`.hali`. External package binding files use `.halx`.

## Comments

```rust
// Single-line comment

/* Multi-line comment
   Can span multiple lines */
```

Comments do not nest. There are no doc-comment annotations — documentation is extracted
from interface files (`.hali`) and contract declarations.

## Keywords

The following identifiers are reserved keywords:

```rust
let, mut, const, fn, pub, return,
struct, enum, trait, impl,
if, else, match, case, for, in, while, break, continue,
import, as,
test, suite, assert,
effect, effects, forbids,
concurrent,
ffi, maps_to,
true, false,
and, or, not,
Self
```

## Operators

### Arithmetic

`+`, `-`, `*`, `/`, `%`

### Comparison

`==`, `!=`, `<`, `>`, `<=`, `>=`

### Logical

`and`, `or`, `not` (keywords, not symbols — avoids ambiguity with bitwise operators)

### Assignment

`=`

### Error Propagation

`?` (propagates `Result` and `Optional` errors to the caller)

### Member Access

`.` (field access, method call)

### Range

`..` (exclusive range), `..=` (inclusive range)

There is no operator overloading. Each operator has exactly one meaning for each type it
applies to.

## Operator Precedence (highest to lowest)

| Precedence | Operators                                    | Associativity |
| ---------- | -------------------------------------------- | ------------- |
| 1          | `.` (member access), `?` (error propagation) | Left          |
| 2          | `not` (unary), `-` (unary)                   | Right         |
| 3          | `*`, `/`, `%`                                | Left          |
| 4          | `+`, `-`                                     | Left          |
| 5          | `..`, `..=`                                  | None          |
| 6          | `==`, `!=`, `<`, `>`, `<=`, `>=`             | None          |
| 7          | `and`                                        | Left          |
| 8          | `or`                                         | Left          |
| 9          | `=`                                          | Right         |
