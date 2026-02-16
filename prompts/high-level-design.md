# ACOPL High-Level Design

This document is an exploratory sketch of ACOPL — how the language looks, what features it
has, and how the pieces fit together. It is guided by the
[design principles](design-principles.md) and intended to inform the formal language
specification that follows.

## Overview

ACOPL is a **high-level**, statically typed language optimized for coding agents. It
compiles to target languages (initially TypeScript) but its semantics are
target-independent. Agents write business logic, data models, contracts, and effects — the
transpiler handles all low-level concerns (memory management, async mechanics, concurrency
primitives, platform APIs).

The language should feel closer to a **typed, contract-rich specification language** than
to a systems language. If something can be decided by the transpiler, it should not be in
the language.

## Design Philosophy: What the Language Controls vs. What the Transpiler Controls

| Concern            | Language (agent writes)                     | Transpiler (decides automatically)       |
| ------------------ | ------------------------------------------- | ---------------------------------------- |
| Data shapes        | Structs, enums, types                       | Memory layout, allocation strategy       |
| Mutability         | `let` vs `let mut`                          | GC, reference counting, ownership        |
| Error flow         | `Result<T, E>`, `?` operator                | Exception translation, stack unwinding   |
| Side effects       | `effects [...]`, `forbids [...]`            | Async/await, promises, callbacks         |
| Concurrency intent | `concurrent { ... }`                        | Thread pools, event loops, green threads |
| I/O operations     | Abstract capabilities (FileSystem, Network) | Platform-specific APIs                   |
| Data access        | Abstract Database operations                | Connection pooling, driver selection     |

## Type System

### Built-in Types

A small set of primitive types:

```
Int, Float, Bool, String, Char, Void, Never
```

### Composite Types

- **Struct** — product types with named fields.
- **Enum** — sum types (tagged unions) with optional associated data.
- **Tuple** — anonymous product types for lightweight grouping.
- **List\<T\>** — ordered collections.
- **Map\<K, V\>** — key-value collections.
- **Set\<T\>** — unique-value collections.
- **Optional\<T\>** — explicit nullability (no null/nil in the language).
- **Result\<T, E\>** — explicit error handling (no exceptions).

No distinction between fixed-size arrays and growable lists — the transpiler optimizes
based on usage. The agent just works with `List<T>`.

### Generics

Types and functions can be parameterized:

```
struct Stack<T> {
  items: List<T>
}

fn pop<T>(stack: mut Stack<T>) -> Optional<T> { ... }
```

### Traits (Interfaces)

Traits define shared behavior. Types implement traits explicitly — no implicit structural
typing.

```
trait Serializable {
  fn serialize(self) -> String
  fn deserialize(data: String) -> Result<Self, SerializeError>
}

impl Serializable for User {
  fn serialize(self) -> String { ... }
  fn deserialize(data: String) -> Result<User, SerializeError> { ... }
}
```

## Syntax Sketch

### Declarations

All declarations follow a consistent pattern: `keyword name: Type = value`.

```
let count: Int = 0           // immutable binding
let mut total: Int = 0       // mutable binding (explicit opt-in)
const MAX_SIZE: Int = 1024   // compile-time constant
```

### Functions

Functions declare their signature, contracts, and effects up front:

```
fn divide(numerator: Float, denominator: Float) -> Result<Float, MathError>
  precondition { denominator != 0.0 }
  postcondition(result) { result.is_ok() implies result.unwrap() * denominator == numerator }
{
  if denominator == 0.0 {
    return Result.err(MathError.DivisionByZero)
  }
  return Result.ok(numerator / denominator)
}
```

Functions are pure by default. Side effects require explicit declaration:

```
fn save_user(user: User) -> Result<Void, DbError>
  effects [Database.Write]
{
  // ...
}
```

The `forbids` clause provides negative guarantees:

```
fn compute_total(items: List<Item>) -> Float
  forbids [Network, Database]
{
  // compiler guarantees this function never touches network or database
  // ...
}
```

### Control Flow

Standard, predictable control flow — no surprises:

```
// Conditional
if condition {
  // ...
} else if other_condition {
  // ...
} else {
  // ...
}

// Pattern matching (must be exhaustive)
match value {
  case Pattern1(x) => expression1
  case Pattern2(y) => expression2
  case _ => default_expression
}

// Loops
for item in collection {
  // ...
}

while condition {
  // ...
}

// No implicit fallthrough, no do-while, no goto
```

### Error Handling

No exceptions. All errors flow through `Result<T, E>`:

```
fn read_config(path: String) -> Result<Config, ConfigError>
  effects [FileSystem.Read]
{
  let content = FileSystem.read(path)?   // ? propagates errors
  let parsed = parse_config(content)?
  return Result.ok(parsed)
}
```

The `?` operator is the single, consistent way to propagate errors. No try/catch, no
unchecked exceptions, no panics in normal code.

### Structs and Enums

```
struct User {
  name: String
  email: String
  age: Int

  invariant { age >= 0 and age <= 200 }
}

enum Shape {
  Circle(radius: Float)
  Rectangle(width: Float, height: Float)
  Triangle(a: Float, b: Float, c: Float)
}
```

## Testing

Tests are a first-class language construct, not a library convention. This ensures agents
always know exactly how to write and discover tests — no framework choice, no
configuration, no ambiguity.

```
test "division by zero returns error" {
  let result = divide(10.0, 0.0)
  assert result.is_err()
  assert result.unwrap_err() == MathError.DivisionByZero
}

test "division returns correct result" {
  let result = divide(10.0, 2.0)
  assert result.is_ok()
  assert result.unwrap() == 5.0
}
```

Tests can be grouped into suites for organization:

```
test suite "User validation" {
  test "rejects negative age" {
    let result = User.new("Alice", "alice@example.com", -1)
    assert result.is_err()
  }

  test "accepts valid user" {
    let result = User.new("Alice", "alice@example.com", 30)
    assert result.is_ok()
  }
}
```

Key properties:

- Tests live alongside the code they test (in the same file or in the `tests/` directory).
- The compiler can verify contracts automatically — generating test cases from
  `precondition`, `postcondition`, and `invariant` declarations.
- Test output is structured (JSON), so agents can parse results programmatically.

## Module System

### File-to-Module Mapping

Each file is a module. The directory structure defines the module hierarchy:

```
src/
  main.acopl              // module: main
  auth/
    mod.acopl             // module: auth
    password.acopl        // module: auth.password
    token.acopl           // module: auth.token
  http/
    mod.acopl             // module: http
    router.acopl          // module: http.router
```

### Visibility

All declarations are private by default. The `pub` keyword makes them part of the module's
public API:

```
pub struct User { ... }        // public type
pub fn create_user() { ... }   // public function
fn helper() { ... }            // private, module-internal
```

### Imports

Explicit, unambiguous imports:

```
import auth.password.{ hash, verify }
import http.router.Router
import collections.List
```

No wildcard imports (`import foo.*`), no re-exports by default, no implicit prelude beyond
the built-in types.

### Interface Files

Each module can have a separate interface file (`.acopli`) that declares its public API
without implementation details. This supports principle 10 (Scalability by Design) —
agents can read the interface to understand a module without loading the full
implementation.

```
// auth/password.acopli
pub fn hash(password: String) -> String
  effects [Crypto.Hash]

pub fn verify(password: String, hash: String) -> Bool
  effects [Crypto.Hash]
```

## Effect System

Effects are declared as a hierarchy, enabling fine-grained control:

```
effect FileSystem {
  Read
  Write
  Delete
}

effect Network {
  Internal    // internal service calls
  External    // calls to third-party services
}

effect Database {
  Read
  Write
  Schema      // DDL operations
}
```

Effects propagate: if function A calls function B which has `effects [Database.Write]`,
then A must also declare `Database.Write` (or a parent effect that includes it) unless A
explicitly handles or contains the effect.

The effect system also drives transpiler decisions. A function with `effects [Network]`
will be compiled to async code on targets that require it (e.g., TypeScript) — but the
agent never writes `async` or `await`. The transpiler infers this from the declared
effects.

## Concurrency

Agents express **concurrency intent**, not concurrency mechanics:

```
fn fetch_user_data(user_id: String) -> Result<UserData, Error>
  effects [Network.Internal]
{
  // "These two operations are independent — run them concurrently"
  let (profile, orders) = concurrent {
    fetch_profile(user_id)
    fetch_orders(user_id)
  }

  return Result.ok(UserData.new(profile?, orders?))
}
```

The agent says _what_ is independent. The transpiler decides _how_:

- TypeScript backend: `Promise.all`
- Rust backend: `tokio::join!`
- Other backends: whatever is idiomatic

There are no threads, no channels, no mutexes, no atomics in the language. If a future
backend needs fine-grained concurrency control, that goes in FFI.

## Standard Library Capabilities

The standard library provides **abstract capabilities** — high-level operations that
agents use without caring about platform details:

- **FileSystem** — read, write, delete files and directories
- **Network** — HTTP client/server, request/response
- **Database** — queries, transactions, migrations
- **Crypto** — hashing, encryption, signing
- **Time** — current time, durations, scheduling
- **Collections** — List, Map, Set, Queue, Stack, etc.
- **Text** — string manipulation, regex, formatting
- **Serialization** — JSON, XML, binary formats
- **Logging** — structured logging with levels

These are all abstract. The agent writes `FileSystem.read(path)` — the transpiler maps it
to `fs.readFile` (TypeScript), `std::fs::read` (Rust), etc.

## FFI (Foreign Function Interface)

FFI is the explicit boundary between ACOPL and the target platform. It is the **only**
place where target-specific details appear:

```
ffi "typescript" {
  fn fetch(url: String, options: FetchOptions) -> Response
    maps_to "globalThis.fetch"
}
```

FFI declarations are isolated in dedicated modules. Regular ACOPL code never sees the
target platform.

## Project Structure

A canonical project layout that all ACOPL projects follow:

```
project-name/
  acopl.toml              // project manifest (dependencies, targets, metadata)
  src/
    main.acopl            // entry point
    lib.acopl             // library root (for library projects)
    ...                   // application modules
  tests/
    ...                   // test modules (mirror src/ structure)
  ffi/
    ...                   // FFI bindings (target-specific)
```

## Toolchain

The ACOPL toolchain is a single binary that includes:

- **Compiler** — compiles ACOPL to the target (initially TypeScript).
- **Formatter** — canonical formatting, not optional. All ACOPL code looks the same.
- **Linter** — catches common mistakes and enforces idioms.
- **Test runner** — runs tests with contract verification.
- **Package manager** — dependency management.
- **REPL** — interactive evaluation for iterative development.

All tools produce structured output (JSON) alongside human-readable output, so agents can
consume diagnostics programmatically.

## What This Design Does Not Include

Deliberately excluded features, and why:

- **Inheritance** — use composition and traits instead (principle 6).
- **Exceptions** — use Result types instead (principle 6).
- **Null/nil** — use Optional instead (principle 1).
- **Operator overloading** — one meaning per operator (principle 1).
- **Implicit conversions** — all conversions are explicit (principle 3).
- **Macros** — risks violating uniform syntax; if needed, a hygienic macro system may be
  considered later (principle 2).
- **Global mutable state** — by design (principle 7).
- **Decorators/annotations that alter behavior** — no action at a distance (principle 6).
- **Memory management primitives** — no ownership, borrowing, lifetimes, or manual memory
  control. The transpiler handles this entirely based on the target.
- **Async/await keywords** — the effect system tells the transpiler what's async. Agents
  never write async code explicitly.
- **Threads, mutexes, channels, atomics** — agents express concurrency intent with
  `concurrent { ... }`. The transpiler maps to the target's concurrency model.

## Open Questions

These need resolution during the language specification phase:

1. **Macro system** — Should there be one at all? If so, hygienic and heavily restricted
   to preserve uniform syntax.

2. **Metaprogramming** — Compile-time code generation vs. none. If included, it must not
   break predictability.

3. **String interpolation syntax** — Needs to be unambiguous. Something like
   `"Hello, {name}"` or `"Hello, ${name}"`.

4. **Trait-level effects** — Can traits declare that their methods have certain effects?
   E.g., a `Serializable` trait might require `effects [Serialization]` on its methods.
