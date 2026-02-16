# Concurrency

This section defines HAL's concurrency model — how agents express concurrent intent
without specifying concurrency mechanics.

## Design Principle

Agents express **what is independent**. The transpiler decides **how to run it
concurrently**. There are no threads, channels, mutexes, atomics, or async/await keywords
in HAL.

## The `concurrent` Block

The `concurrent` block declares that multiple operations are independent and may be
executed concurrently:

```rust
fn fetch_user_data(user_id: String) -> Result<UserData, Error>
  effects [Network.Internal]
{
  let (profile, orders) = concurrent {
    fetch_profile(user_id)
    fetch_orders(user_id)
  }

  return Result.ok(UserData {
    profile: profile?,
    orders: orders?,
  })
}
```

### Semantics

1. Each expression in the `concurrent` block is an independent unit of work.
2. The block completes when **all** operations complete.
3. Results are returned as a tuple matching the order of declarations.
4. Each result keeps its original type — if the operation returns `Result<T, E>`, the
   concurrent result is `Result<T, E>`.
5. Operations in a `concurrent` block **must not depend on each other** — the compiler
   verifies that no operation references a variable produced by another operation in the
   same block.

### Transpilation

The transpiler maps `concurrent` to the target's concurrency model:

| Target     | Transpilation                             |
| ---------- | ----------------------------------------- |
| TypeScript | `Promise.all([...])` with `async`/`await` |
| Rust       | `tokio::join!(...)` or similar            |
| Other      | Target-idiomatic concurrent execution     |

### Error Handling in Concurrent Blocks

Each operation in a `concurrent` block produces its own result. Errors are not
automatically propagated — the agent handles them after the block completes:

```rust
let (profile_result, orders_result) = concurrent {
  fetch_profile(user_id)
  fetch_orders(user_id)
}

// Handle results individually
let profile = profile_result?
let orders = orders_result?
```

If any operation in the block fails, the other operations still complete (no automatic
cancellation). The agent decides how to handle partial failures.

### Effects in Concurrent Blocks

All operations in a `concurrent` block must have their effects declared on the enclosing
function:

```rust
fn load_dashboard(user_id: String) -> Result<Dashboard, Error>
  effects [Network.Internal, Database.Read]
{
  let (profile, stats, notifications) = concurrent {
    fetch_profile(user_id)         // effects [Network.Internal]
    load_stats(user_id)            // effects [Database.Read]
    fetch_notifications(user_id)   // effects [Network.Internal]
  }

  // ...
}
```

The enclosing function must declare all effects used by any operation in the block.

## No Other Concurrency Primitives

HAL deliberately excludes:

- **Threads** — no `spawn`, no thread creation
- **Channels** — no message-passing primitives
- **Mutexes / Locks** — no synchronization primitives
- **Atomics** — no atomic operations
- **Async/Await** — no manual async control flow
- **Futures / Promises** — no explicit future types

All of these are transpiler concerns. If a target requires them (e.g., Rust), the
transpiler generates them from the `concurrent` block and effect declarations.

If a use case truly requires fine-grained concurrency control beyond what `concurrent`
provides, that goes in FFI (see [ffi.md](ffi.md)).

## Data Safety

Within a `concurrent` block:

1. Operations cannot share mutable state — the compiler verifies this.
2. Each operation works on its own copy of captured data.
3. There are no data races by construction.

```rust
// COMPILE ERROR — operations share mutable state:
let mut counter = 0
let (a, b) = concurrent {
  increment(counter)    // ERROR: cannot share 'counter' across concurrent operations
  increment(counter)
}
```

## Nested Concurrency

`concurrent` blocks can be nested (the transpiler flattens them appropriately):

```rust
fn load_all(ids: List<String>) -> Result<List<Data>, Error>
  effects [Network.Internal, Database.Read]
{
  let (users, products) = concurrent {
    load_users(ids)
    load_products(ids)
  }

  return Result.ok(combine(users?, products?))
}
```

However, dynamically-sized concurrent operations (e.g., running N operations for N items)
use the `concurrent_map` function:

```rust
fn fetch_all_profiles(user_ids: List<String>) -> Result<List<Profile>, Error>
  effects [Network.Internal]
{
  let results = user_ids.concurrent_map(fn(id) {
    return fetch_profile(id)
  })
  // results: List<Result<Profile, Error>>
  return collect_results(results)
}
```

`concurrent_map` executes the closure concurrently for each element. The transpiler
decides the degree of parallelism.
