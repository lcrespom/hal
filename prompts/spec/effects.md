# Effects

This section defines HAL's effect system — how side effects are declared, propagated,
and verified.

## Overview

HAL functions are **pure by default**. A function that performs side effects must declare
them. The compiler verifies that:

1. Every effect performed by a function is declared.
2. Every function calling an effectful function declares (or contains) those effects.
3. `forbids` declarations are never violated.

## Effect Declarations

Effects are declared as named hierarchies:

```rust
effect FileSystem {
  Read
  Write
  Delete
}

effect Network {
  Internal       // calls to internal services
  External       // calls to third-party services
}

effect Database {
  Read
  Write
  Schema         // DDL operations (create/alter/drop tables)
}

effect Logging {
  Debug
  Info
  Warn
  Error
}

effect Console {
  Read           // stdin
  Write          // stdout/stderr
}

effect Crypto {
  Hash
  Encrypt
  Decrypt
  Sign
}

effect Time {
  Read           // reading current time
  Schedule       // scheduling future events
}
```

### Hierarchy

Effects form a hierarchy. Declaring a parent effect includes all child effects:

- `effects [FileSystem]` includes `FileSystem.Read`, `FileSystem.Write`, and
  `FileSystem.Delete`.
- `effects [FileSystem.Read]` includes only `FileSystem.Read`.

### Custom Effects

Modules can define their own effects:

```rust
effect PaymentGateway {
  Charge
  Refund
  Query
}
```

Custom effects follow the same rules as built-in effects.

## Using Effects on Functions

A function declares its effects between the signature and the body:

```rust
fn read_file(path: String) -> Result<String, IoError>
  effects [FileSystem.Read]
{
  return FileSystem.read(path)
}

fn save_user(user: User) -> Result<Void, DbError>
  effects [Database.Write, Logging.Info]
{
  Logging.info("Saving user: {user.name}")
  Database.execute("INSERT INTO users ...")
}
```

### Multiple Effects

A function can declare multiple effects:

```rust
fn sync_data() -> Result<Void, SyncError>
  effects [Network.External, Database.Write, Logging.Info]
{
  let data = fetch_external_data()?
  save_to_database(data)?
  Logging.info("Sync complete")
}
```

## Effect Propagation

Effects propagate through the call graph. If function A calls function B, and B has
`effects [Database.Write]`, then A must also declare `Database.Write` (or its parent
`Database`).

```rust
fn save_user(user: User) -> Result<Void, DbError>
  effects [Database.Write]
{
  // ...
}

fn register_user(name: String, email: String) -> Result<User, RegistrationError>
  effects [Database.Write]          // required because save_user has Database.Write
{
  let user = User.new(name, email, 0)?
  save_user(user)?
  return Result.ok(user)
}
```

### Transitive Propagation

Effects propagate transitively. If A calls B, and B calls C, and C has effects, both B and
A must declare those effects.

### Compiler Error on Missing Effects

If a function calls an effectful function without declaring the effect:

```rust
fn register_user(name: String, email: String) -> Result<User, RegistrationError>
  // Missing: effects [Database.Write]
{
  let user = User.new(name, email, 0)?
  save_user(user)?       // ERROR: save_user requires Database.Write
  return Result.ok(user)
}
```

The compiler produces:

```json
{
  "error": "E0301",
  "message": "Function 'register_user' calls 'save_user' which requires effect 'Database.Write', but 'register_user' does not declare this effect",
  "file": "src/auth.hal",
  "line": 5,
  "suggestion": "Add 'effects [Database.Write]' to the function declaration"
}
```

## The `forbids` Clause

A function can declare effects it guarantees it will *never* perform:

```rust
fn compute_total(items: List<Item>) -> Float
  forbids [Network, Database, FileSystem]
{
  let mut total = 0.0
  for item in items {
    total = total + item.price
  }
  return total
}
```

The compiler verifies that no code path in `compute_total` (including transitive calls)
performs any forbidden effect.

### `effects` and `forbids` Together

A function can have both:

```rust
fn process_order(order: Order) -> Result<Receipt, OrderError>
  effects [Database.Write, Logging.Info]
  forbids [Network.External]
{
  // Can write to database and log
  // Cannot make external network calls
}
```

### `forbids` Propagation

`forbids` is checked transitively. If A forbids `Network` and calls B, then B must not
have `effects [Network]` (or any sub-effect of `Network`).

## Effects and the Transpiler

The effect system drives transpiler decisions:

| Effect | TypeScript transpilation |
| ------ | ----------------------- |
| `FileSystem.*` | `async` function using `fs` API |
| `Network.*` | `async` function using `fetch` / HTTP client |
| `Database.*` | `async` function using database driver |
| `Console.*` | Synchronous `console.*` calls |
| `Crypto.*` | May be sync or async depending on operation |
| `Time.Read` | Synchronous `Date.now()` |
| `Time.Schedule` | `async` with `setTimeout` / scheduling library |
| `Logging.*` | Synchronous logging calls |

The key insight: agents never write `async` or `await`. The transpiler sees `effects
[Network.External]` and generates the appropriate async wrapper for the target.

## Pure Functions

A function with no `effects` declaration is pure. The compiler guarantees it:

- Has no side effects
- Always returns the same output for the same inputs
- Does not call any effectful functions

```rust
fn add(a: Int, b: Int) -> Int {
  return a + b
}
// Pure — no effects declared, compiler verifies no side effects
```

Pure functions are the default and the common case. Effect declarations are the exception,
used only when a function genuinely needs to interact with the outside world.

## Effect Polymorphism

Higher-order functions can be polymorphic over effects. When a function takes a callback,
the callback's effects propagate to the caller:

```rust
fn with_logging<T>(operation: fn() -> T) -> T
  effects [Logging.Info]
{
  Logging.info("Starting operation")
  let result = operation()
  Logging.info("Operation complete")
  return result
}
```

If the callback passed to `with_logging` has additional effects (e.g., `Database.Write`),
the call site must also declare those effects.
