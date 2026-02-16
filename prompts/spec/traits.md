# Traits

This section defines HAL's trait system — the mechanism for shared behavior across types.

## Trait Definition

A **trait** defines a set of methods that types can implement:

```rust
trait Displayable {
  fn display(self) -> String
}
```

Traits can have multiple methods:

```rust
trait Serializable {
  fn serialize(self) -> String
  fn deserialize(data: String) -> Result<Self, SerializeError>
}
```

### Default Implementations

Trait methods can have default implementations that types inherit unless they override:

```rust
trait Printable {
  fn to_string(self) -> String

  fn print(self) -> Void
    effects [Console.Write]
  {
    Console.write(self.to_string())
  }
}
```

Types implementing `Printable` must provide `to_string`, but get `print` for free.

### Trait Effects

Trait methods can declare effects:

```rust
trait Repository<T> {
  fn find(id: String) -> Result<Optional<T>, DbError>
    effects [Database.Read]

  fn save(entity: T) -> Result<Void, DbError>
    effects [Database.Write]

  fn delete(id: String) -> Result<Void, DbError>
    effects [Database.Write]
}
```

A type implementing this trait must honor these effect declarations.

## Implementing Traits

Types implement traits using `impl Trait for Type` blocks:

```rust
impl Displayable for User {
  fn display(self) -> String {
    return "{self.name} <{self.email}>"
  }
}

impl Displayable for Shape {
  fn display(self) -> String {
    return match self {
      case Shape.Circle(r) => "Circle(radius={r})"
      case Shape.Rectangle(w, h) => "Rectangle({w}x{h})"
      case Shape.Triangle(a, b, c) => "Triangle({a},{b},{c})"
      case Shape.Point => "Point"
    }
  }
}
```

### Rules

1. **Explicit implementation only** — there is no structural typing. A type satisfies a
   trait only if there is an explicit `impl` block.
2. **Orphan rule** — a trait can only be implemented for a type in the module that defines
   either the trait or the type (not in a third module). This prevents action at a
   distance.
3. **No partial implementation** — all required methods (those without defaults) must be
   provided.

## Inherent `impl` Blocks

Types can have methods that are not part of any trait:

```rust
impl User {
  fn is_adult(self) -> Bool {
    return self.age >= 18
  }

  fn with_email(self, new_email: String) -> User {
    return User { ...self, email: new_email }
  }
}
```

These methods are called with dot notation: `user.is_adult()`.

### The `self` Parameter

Methods receive the instance as the first parameter, named `self`:

- `self` — immutable access to the instance
- `mut self` — mutable access (consumes the value)

```rust
impl Counter {
  fn count(self) -> Int {
    return self.value
  }

  fn increment(mut self) -> Counter {
    self.value = self.value + 1
    return self
  }
}
```

### Static Methods

Methods without a `self` parameter are static — called on the type, not an instance:

```rust
impl User {
  fn new(name: String, email: String, age: Int) -> Result<User, ValidationError> {
    // validates invariants and returns Result
  }
}

let user = User.new("Alice", "alice@example.com", 30)?
```

## Trait Bounds

Generic type parameters can be constrained to require trait implementations:

```rust
fn print_all<T: Displayable>(items: List<T>) -> Void
  effects [Console.Write]
{
  for item in items {
    Console.write(item.display())
  }
}
```

### Multiple Bounds

Use `+` for multiple trait requirements:

```rust
fn process<T: Serializable + Displayable>(item: T) -> String {
  return item.serialize()
}
```

### Where Clauses

For complex bounds, use `where`:

```rust
fn merge_and_display<K, V>(a: Map<K, V>, b: Map<K, V>) -> String
  where K: Hashable + Eq + Displayable,
        V: Displayable
{
  // ...
}
```

## Trait Inheritance

Traits can require other traits as prerequisites:

```rust
trait Comparable: Eq {
  fn compare(self, other: Self) -> Ordering
}
```

Any type implementing `Comparable` must also implement `Eq`.

## Built-in Traits

The standard library defines these fundamental traits:

| Trait           | Methods                                                                     | Purpose                             |
| --------------- | --------------------------------------------------------------------------- | ----------------------------------- |
| `Eq`            | `fn eq(self, other: Self) -> Bool`                                          | Equality comparison                 |
| `Comparable`    | `fn compare(self, other: Self) -> Ordering`                                 | Ordering (extends `Eq`)             |
| `Hashable`      | `fn hash(self) -> Int`                                                      | Hash computation (for Map/Set keys) |
| `Displayable`   | `fn display(self) -> String`                                                | Human-readable representation       |
| `Serializable`  | `fn serialize(self) -> String`, `fn deserialize(String) -> Result<Self, E>` | Serialization/deserialization       |
| `ToString`      | `fn to_string(self) -> String`                                              | String conversion                   |
| `Into<T>`       | `fn into(self) -> T`                                                        | Infallible type conversion          |
| `TryInto<T, E>` | `fn try_into(self) -> Result<T, E>`                                         | Fallible type conversion            |
| `Default`       | `fn default() -> Self`                                                      | Default value construction          |
| `Clone`         | `fn clone(self) -> Self`                                                    | Explicit deep copy                  |
| `Iterator<T>`   | `fn next(mut self) -> Optional<T>`                                          | Iteration protocol                  |

### Auto-derived Traits

The compiler can automatically derive implementations of certain traits for structs and
enums when all fields/variants satisfy the trait:

```rust
struct Point {
  x: Float
  y: Float
  derive [Eq, Hashable, Displayable, Clone]
}
```

The `derive` directive generates standard implementations. Derivable traits: `Eq`,
`Hashable`, `Displayable`, `Clone`, `Serializable`, `Default`.

## No Inheritance

HAL has no class inheritance. The only mechanism for shared behavior is traits (horizontal
composition), not class hierarchies (vertical inheritance). This is deliberate — it
eliminates the complexity of method resolution order, super calls, diamond inheritance,
and other patterns that make code hard for agents to reason about.
