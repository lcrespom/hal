# Structs and Enums

This section defines HAL's product types (structs) and sum types (enums).

## Structs

A **struct** is a named product type with named fields.

```rust
struct User {
  name: String
  email: String
  age: Int
}
```

### Field Visibility

All fields follow the struct's visibility. If a struct is `pub`, its fields are accessible
to code that can see the struct. There is no per-field visibility.

```rust
pub struct Point {
  x: Float
  y: Float
}
```

### Construction

Structs are constructed by providing all fields:

```rust
let user = User {
  name: "Alice",
  email: "alice@example.com",
  age: 30,
}
```

All fields must be provided — there are no default values. If a struct has an invariant,
construction goes through `StructName.new(...)` which validates the invariant (see below).

### Field Access

Fields are accessed with dot notation:

```rust
let name = user.name
let age = user.age
```

### Invariants

Structs can declare **invariants** — properties that must always hold for any instance of
the type:

```rust
struct User {
  name: String
  email: String
  age: Int

  invariant { age >= 0 and age <= 200 }
  invariant { name.length() > 0 }
}
```

When a struct has invariants:

1. Direct construction (`User { ... }`) is not available outside the struct's module.
2. Instead, the compiler generates a `StructName.new(...)` constructor that returns
   `Result<StructName, ValidationError>`:

```rust
let user = User.new("Alice", "alice@example.com", 30)?
// Returns Result<User, ValidationError>
// The ? propagates the error if invariants fail
```

3. The order of parameters in `.new()` matches the field declaration order.
4. Mutation of a struct with invariants re-validates after each mutation.

### Struct Update Syntax

To create a new struct based on an existing one with some fields changed:

```rust
let updated_user = User { ...user, age: 31 }
```

The `...existing` syntax copies all fields from `existing`, then overrides the specified
fields. If the struct has invariants, this goes through validation.

### Methods on Structs

Methods are defined in `impl` blocks (see [traits.md](traits.md)):

```rust
impl User {
  fn full_display(self) -> String {
    return "{self.name} ({self.email})"
  }

  fn with_age(self, new_age: Int) -> Result<User, ValidationError> {
    return User.new(self.name, self.email, new_age)
  }
}
```

## Enums

An **enum** is a named sum type (tagged union). Each variant can optionally carry
associated data.

```rust
enum Color {
  Red
  Green
  Blue
  Custom(r: Int, g: Int, b: Int)
}
```

### Variants

Variants can be:

- **Unit variants** — no associated data: `Red`, `Green`, `Blue`
- **Data variants** — carry named fields: `Custom(r: Int, g: Int, b: Int)`

```rust
enum Shape {
  Circle(radius: Float)
  Rectangle(width: Float, height: Float)
  Triangle(a: Float, b: Float, c: Float)
  Point
}
```

### Construction

Enum values are constructed by specifying the variant:

```rust
let color = Color.Red
let custom = Color.Custom(r: 255, g: 128, b: 0)
let shape = Shape.Circle(radius: 5.0)
```

### Pattern Matching

The primary way to work with enums is pattern matching:

```rust
fn area(shape: Shape) -> Float {
  return match shape {
    case Shape.Circle(radius) => 3.14159 * radius * radius
    case Shape.Rectangle(width, height) => width * height
    case Shape.Triangle(a, b, c) => {
      let s = (a + b + c) / 2.0
      return (s * (s - a) * (s - b) * (s - c)).sqrt()
    }
    case Shape.Point => 0.0
  }
}
```

The compiler enforces exhaustive matching — every variant must be handled.

### Methods on Enums

Like structs, enums can have methods via `impl` blocks:

```rust
impl Color {
  fn is_primary(self) -> Bool {
    return match self {
      case Color.Red => true
      case Color.Green => true
      case Color.Blue => true
      case _ => false
    }
  }
}
```

### Enum Invariants

Enums can also declare invariants on their data variants:

```rust
enum Temperature {
  Celsius(degrees: Float)
  Fahrenheit(degrees: Float)
  Kelvin(degrees: Float)

  invariant {
    match self {
      case Temperature.Kelvin(degrees) => degrees >= 0.0
      case _ => true
    }
  }
}
```

### Built-in Enums

`Optional<T>` and `Result<T, E>` are enums defined in the standard library. See
[types.md](types.md) and [error-handling.md](error-handling.md).

## Equality and Comparison

Structs and enums support equality (`==`, `!=`) by default via structural comparison. All
fields must be equal for two struct values to be equal. For enums, the variant and all
associated data must match.

To support ordering (`<`, `>`, `<=`, `>=`), implement the `Comparable` trait explicitly.

## Copying and Cloning

All values in HAL are logically copied on assignment. The transpiler may optimize this
to references or copy-on-write behind the scenes, but the agent always sees value
semantics.

```rust
let a = User { name: "Alice", email: "a@b.com", age: 30 }
let b = a              // b is a copy of a
// modifying b does not affect a
```
