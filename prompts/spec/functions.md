# Functions

This section defines function declarations, closures, contracts, and purity rules.

## Function Declarations

Functions are declared with the `fn` keyword:

```rust
fn function_name(param1: Type1, param2: Type2) -> ReturnType {
  // body
}
```

A function declaration has these parts, in order:

1. Optional `pub` visibility modifier
2. `fn` keyword
3. Function name (snake_case by convention)
4. Optional generic parameters: `<T, U>`
5. Parameter list: `(name: Type, ...)`
6. Return type: `-> Type` (omit for `-> Void`)
7. Optional `where` clause for complex generic bounds
8. Optional `precondition` block
9. Optional `postcondition` block
10. Optional `effects` declaration
11. Optional `forbids` declaration
12. Function body: `{ ... }`

Full example:

```rust
pub fn find_user<T: Identifiable>(id: String, source: T) -> Result<User, UserError>
  where T: Queryable
  precondition { id.length() > 0 }
  postcondition(result) { result.is_ok() implies result.unwrap().id == id }
  effects [Database.Read]
  forbids [Database.Write, Network]
{
  // implementation
}
```

## Parameters

Parameters are always passed by value. The transpiler may optimize to pass-by-reference
when it can prove immutability, but this is invisible to the agent.

```rust
fn greet(name: String) -> String {
  return "Hello, {name}!"
}
```

### Mutable Parameters

By default, parameters are immutable within the function body. To mutate a parameter, the
caller passes it explicitly and the function declares it `mut`:

```rust
fn add_item(mut list: List<Int>, item: Int) -> List<Int> {
  list.push(item)
  return list
}
```

Note: this mutates the _local copy_. The caller's binding is not affected. HAL has no
reference or pointer types.

## Return Type

The return type follows `->`. If omitted, the return type is `Void`.

```rust
fn do_work() {              // returns Void
  // ...
}

fn get_count() -> Int {     // returns Int
  return 42
}
```

The `return` keyword is required for returning values. There are no implicit returns — the
last expression is not automatically returned (principle 3: Explicit Over Implicit).

```rust
// CORRECT:
fn add(a: Int, b: Int) -> Int {
  return a + b
}

// WRONG — compile error, missing return:
fn add(a: Int, b: Int) -> Int {
  a + b
}
```

## Contracts

Contracts are machine-verifiable specifications attached to functions. They serve as both
documentation and correctness checks.

### Preconditions

A `precondition` declares what must be true before the function is called. If violated,
the program fails with a contract violation error.

```rust
fn withdraw(account: Account, amount: Float) -> Result<Account, BankError>
  precondition { amount > 0.0 }
  precondition { amount <= account.balance }
{
  // ...
}
```

Multiple `precondition` blocks are allowed — all must hold.

### Postconditions

A `postcondition` declares what is guaranteed after the function returns. The parameter
name in parentheses binds to the return value.

```rust
fn sort<T: Comparable>(items: List<T>) -> List<T>
  postcondition(result) { result.length() == items.length() }
{
  // ...
}
```

Postconditions can reference both parameters and the return value.

### Contract Enforcement

The compiler handles contracts in this priority order:

1. **Compile-time verification** — if the compiler can prove a contract always holds or is
   always violated, it reports this at compile time.
2. **Runtime checks** — otherwise, contracts become runtime assertions. The transpiler
   generates appropriate checks for the target.
3. **Test generation** — the test runner can automatically generate test cases from
   contracts (see [testing.md](testing.md)).

## Purity

Functions are **pure by default**. A pure function:

- Has no side effects
- Returns the same output for the same inputs
- Cannot call impure functions

To perform side effects, a function must declare them with `effects`:

```rust
fn save(user: User) -> Result<Void, DbError>
  effects [Database.Write]
{
  // ...
}
```

A function that calls another function with effects must either:

1. Declare those same effects (or a parent effect)
2. Be inside a context that handles the effect

See [effects.md](effects.md) for the full effect system specification.

## The `forbids` Clause

A function can declare effects it guarantees it will _never_ perform:

```rust
fn compute_score(data: List<Int>) -> Int
  forbids [Network, Database, FileSystem]
{
  // The compiler verifies that no code path in this function
  // (including transitive calls) touches network, database, or filesystem
}
```

`forbids` is complementary to `effects`. A function can have both:

```rust
fn process(input: String) -> Result<String, Error>
  effects [Logging.Info]
  forbids [Network, Database]
{
  // Can log, but cannot access network or database
}
```

## Closures

Closures are anonymous functions. They use the syntax `fn(params) -> ReturnType { body }`:

```rust
let double = fn(x: Int) -> Int { return x * 2 }
let result = double(21)    // 42
```

When passed as arguments, parameter types can be inferred from context:

```rust
let numbers = [1, 2, 3, 4, 5]
let evens = numbers.filter(fn(n) { return n % 2 == 0 })
```

Closures capture variables from their enclosing scope by value (immutable capture). To
capture mutably, the closure must be declared in a mutable binding context.

### Closure Type Syntax

The type of a closure is written as a function type:

```rust
type Predicate<T> = fn(T) -> Bool
type Transform<A, B> = fn(A) -> B

fn apply<A, B>(value: A, transform: fn(A) -> B) -> B {
  return transform(value)
}
```

## Function Overloading

There is no function overloading. Each function name in a scope must be unique. Use
different names or generic functions instead:

```rust
// WRONG — no overloading:
fn process(x: Int) -> String { ... }
fn process(x: String) -> String { ... }

// CORRECT — use different names:
fn process_int(x: Int) -> String { ... }
fn process_string(x: String) -> String { ... }

// CORRECT — use generics:
fn process<T: Processable>(x: T) -> String { ... }
```

## Recursion

Recursion is allowed. The compiler may optimize tail recursion into iteration for targets
that do not support unbounded stack growth.

```rust
fn factorial(n: Int) -> Int
  precondition { n >= 0 }
{
  if n == 0 {
    return 1
  }
  return n * factorial(n - 1)
}
```
