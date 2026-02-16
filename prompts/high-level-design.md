# ACOPL High-Level Design

This document is an exploratory sketch of ACOPL — how the language looks, what features it
has, and how the pieces fit together. It is guided by the
[design principles](design-principles.md) and intended to inform the formal language
specification that follows.

## Overview

ACOPL is a statically typed, compiled language optimized for coding agents. It compiles to
target languages (initially TypeScript) but its semantics are target-independent. The
language prioritizes regularity, explicitness, and machine-verifiable correctness over
brevity or cleverness.

## Type System

### Built-in Types

A small set of primitive types:

```rust
Int, Float, Bool, String, Char, Void, Never
```

### Composite Types

- **Struct** — product types with named fields.
- **Enum** — sum types (tagged unions) with optional associated data.
- **Tuple** — anonymous product types for lightweight grouping.
- **Array\<T\>** — ordered, fixed-size collections.
- **List\<T\>** — ordered, growable collections.
- **Map\<K, V\>** — key-value collections.
- **Set\<T\>** — unique-value collections.
- **Optional\<T\>** — explicit nullability (no null/nil in the language).
- **Result\<T, E\>** — explicit error handling (no exceptions).

### Generics

Types and functions can be parameterized:

```rust
struct Stack<T> {
  items: List<T>
}

fn pop<T>(stack: mut Stack<T>) -> Optional<T> { ... }
```

### Traits (Interfaces)

Traits define shared behavior. Types implement traits explicitly — no implicit structural
typing.

```rust
trait Printable {
  fn to_string(self) -> String
}

impl Printable for User {
  fn to_string(self) -> String { ... }
}
```

## Syntax Sketch

### Declarations

All declarations follow a consistent pattern: `keyword name: Type = value`.

```rust
let count: Int = 0           // immutable binding
let mut total: Int = 0       // mutable binding (explicit opt-in)
const MAX_SIZE: Int = 1024   // compile-time constant
```

### Functions

Functions declare their signature, contracts, and effects up front:

```rust
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

```rust
fn save_user(user: User) -> Result<Void, DbError>
  effects [Database.Write]
{
  // ...
}
```

The `forbids` clause provides negative guarantees:

```rust
fn compute_total(items: List<Item>) -> Float
  forbids [Network, Database]
{
  // compiler guarantees this function never touches network or database
  // ...
}
```

### Control Flow

Standard, predictable control flow — no surprises:

```rust
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

```rust
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

```rust
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

## Module System

### File-to-Module Mapping

Each file is a module. The directory structure defines the module hierarchy:

```rust
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

```rust
pub struct User { ... }        // public type
pub fn create_user() { ... }   // public function
fn helper() { ... }            // private, module-internal
```

### Imports

Explicit, unambiguous imports:

```rust
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

```rust
// auth/password.acopli
pub fn hash(password: String) -> String
  effects [Crypto.Hash]

pub fn verify(password: String, hash: String) -> Bool
  effects [Crypto.Hash]
```

## Effect System

Effects are declared as a hierarchy, enabling fine-grained control:

```rust
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

## Concurrency

Concurrency is built around message passing and structured concurrency — no shared mutable
state across concurrent boundaries.

```rust
fn fetch_user_data(user_id: String) -> Result<UserData, Error>
  effects [Network.Internal]
{
  // Structured concurrency: child tasks are scoped to parent
  let (profile, orders) = concurrent {
    task { fetch_profile(user_id) }
    task { fetch_orders(user_id) }
  }

  return Result.ok(UserData.new(profile?, orders?))
}
```

Key properties:

- No data races by construction — concurrent tasks cannot share mutable references.
- Structured concurrency ensures tasks do not outlive their parent scope.
- Channels for explicit communication between concurrent tasks.

## Standard Library Capabilities

The standard library provides abstract capabilities that the backend maps to the target
platform:

- **FileSystem** — file I/O operations
- **Network** — HTTP client/server, TCP/UDP sockets
- **Database** — connection pools, queries, transactions
- **Crypto** — hashing, encryption, signing
- **Time** — clocks, timers, durations
- **Collections** — List, Map, Set, Queue, Stack, etc.
- **Text** — string manipulation, regex, formatting
- **Serialization** — JSON, XML, binary formats
- **Logging** — structured logging

These are all abstract — the compiler backend provides the concrete implementations for
each target.

## FFI (Foreign Function Interface)

FFI is the explicit boundary between ACOPL and the target platform:

```rust
ffi "typescript" {
  fn fetch(url: String, options: FetchOptions) -> Promise<Response>
    maps_to "globalThis.fetch"
}
```

FFI declarations are isolated in dedicated modules and are the only place where
target-specific details appear. This keeps the rest of the codebase target-independent.

## Project Structure

A canonical project layout that all ACOPL projects follow:

```rust
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

## Open Questions

These need resolution during the language specification phase:

1. **Ownership vs. garbage collection** — Ownership (like Rust) gives more control but
   adds cognitive load for agents. GC is simpler but less predictable. A middle ground
   (e.g., region-based memory, or GC with opt-in ownership for performance-critical code)
   may be ideal.

2. **Async model** — Should async be explicit (async/await keywords) or implicit (all I/O
   is automatically async via the effect system)? The effect system may make async
   transparent.

3. **Macro system** — Should there be one at all? If so, hygienic and heavily restricted
   to preserve uniform syntax.

4. **Metaprogramming** — Compile-time code generation vs. none. If included, it must not
   break predictability.

5. **String interpolation syntax** — Needs to be unambiguous. Something like
   `"Hello, {name}"` or `"Hello, ${name}"`.

6. **Trait-level effects** — Can traits declare that their methods have certain effects?
   E.g., a `Serializable` trait might require `effects [Serialization]` on its methods.

7. **Testing as a language feature** — Should test declarations be a first-class construct
   (`test "description" { ... }`) rather than a library convention?
