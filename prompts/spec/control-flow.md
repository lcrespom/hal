# Control Flow

This section defines HAL's control flow constructs: conditionals, pattern matching, loops,
and the distinction between expressions and statements.

## Expressions vs Statements

In HAL, most constructs are **statements** — they perform an action but do not produce a
value. The following are expressions (produce a value):

- Literals: `42`, `"hello"`, `true`
- Variable references: `x`
- Function calls: `foo(x)`
- Method calls: `x.method()`
- Field access: `x.field`
- Arithmetic/comparison/logical operations: `a + b`, `x == y`
- `match` expressions (when used as an expression)
- `if` expressions (when used as an expression)

The following are statements (do not produce a value):

- `let` / `let mut` / `const` declarations
- `return` statements
- `for` / `while` loops
- `break` / `continue`
- Standalone function calls used for side effects

## Conditional: `if`

### As a Statement

```rust
if condition {
  // ...
} else if other_condition {
  // ...
} else {
  // ...
}
```

Braces are always required — no single-statement form. The condition must be of type
`Bool` — no truthy/falsy coercion.

### As an Expression

`if` can be used as an expression when all branches return a value of the same type:

```rust
let status = if score >= 90 {
  "excellent"
} else if score >= 70 {
  "good"
} else {
  "needs improvement"
}
```

When used as an expression, the `else` branch is required (all cases must be covered). The
last expression in each branch is the value of that branch (this is the one context where
an implicit expression-as-value is allowed, for readability in assignment).

## Pattern Matching: `match`

`match` performs exhaustive pattern matching on a value.

```rust
match value {
  case Pattern1 => expression_or_block
  case Pattern2 => expression_or_block
  case _ => default_expression_or_block
}
```

### Exhaustiveness

The compiler verifies that all possible cases are covered. For enums, every variant must
appear (or a wildcard `_` must be present). For other types, a wildcard is required.

```rust
match shape {
  case Shape.Circle(r) => compute_circle_area(r)
  case Shape.Rectangle(w, h) => w * h
  case Shape.Triangle(a, b, c) => compute_triangle_area(a, b, c)
}
// No wildcard needed — all Shape variants are covered
```

### Pattern Types

| Pattern            | Example                                  | Matches                           |
| ------------------ | ---------------------------------------- | --------------------------------- |
| Literal            | `case 42 =>`                             | Exact value                       |
| Variable binding   | `case x =>`                              | Any value, bound to `x`           |
| Enum variant       | `case Shape.Circle(r) =>`                | Specific variant, fields bound    |
| Wildcard           | `case _ =>`                              | Anything (no binding)             |
| Struct destructure | `case User { name, age } =>`             | Struct fields bound by name       |
| Nested             | `case Optional.Some(Shape.Circle(r)) =>` | Nested pattern                    |
| Guard              | `case x if x > 0 =>`                     | Pattern with additional condition |

### Match as Expression

`match` can be used as an expression:

```rust
let area = match shape {
  case Shape.Circle(r) => 3.14159 * r * r
  case Shape.Rectangle(w, h) => w * h
  case Shape.Triangle(a, b, c) => compute_triangle_area(a, b, c)
}
```

### Match as Statement

When used as a statement, each branch can contain a block:

```rust
match command {
  case Command.Quit => {
    save_state()
    cleanup()
  }
  case Command.Help => {
    print_help()
  }
  case _ => {
    execute_command(command)
  }
}
```

## Loops

### `for` Loop

Iterates over a collection:

```rust
for item in collection {
  // item is immutable by default
}
```

With index:

```rust
for (index, item) in collection.enumerate() {
  // index: Int, item: T
}
```

Range-based:

```rust
for i in 0..10 {
  // i goes from 0 to 9 (exclusive end)
}

for i in 0..=10 {
  // i goes from 0 to 10 (inclusive end)
}
```

### `while` Loop

Repeats while a condition is `true`:

```rust
while condition {
  // ...
}
```

The condition must be of type `Bool`.

### `break` and `continue`

`break` exits the innermost loop. `continue` skips to the next iteration.

```rust
for item in items {
  if item.is_empty() {
    continue
  }
  if item == "stop" {
    break
  }
  process(item)
}
```

There are no labeled breaks or continues — if you need to break out of nested loops,
refactor into a function.

### No Other Loop Forms

HAL does not have:

- `do-while` — use `while` with an initial condition or `loop` with `break`
- `loop` (infinite loop) — use `while true { ... }` for explicit intent
- `goto` — not available
- `for-else` — not available

## Block Expressions

A block `{ ... }` introduces a new scope. Variables declared inside a block are not
visible outside it.

```rust
let result = {
  let x = compute_a()
  let y = compute_b()
  x + y    // last expression is the block's value
}
```

Block expressions are useful for limiting scope and computing intermediate values.

## Early Return

The `return` keyword exits the current function immediately:

```rust
fn find_first_positive(items: List<Int>) -> Optional<Int> {
  for item in items {
    if item > 0 {
      return Optional.some(item)
    }
  }
  return Optional.none()
}
```

`return` is always explicit. There are no implicit returns from the last expression in a
function body (unlike Rust). This prevents subtle bugs where an agent accidentally changes
the return value by adding a new line at the end of a function.

Exception: `if` and `match` when used as expressions on the right side of `let` or
`return` use implicit branch values (see above). This is the only context where the "last
expression is the value" rule applies.
