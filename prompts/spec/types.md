# Types

This section defines HAL's type system: primitive types, composite types, generics, and
type inference rules.

## Primitive Types

| Type | Description | Example Literals |
| ---- | ----------- | ---------------- |
| `Int` | Arbitrary-precision integer. The transpiler chooses the representation. | `0`, `42`, `-7`, `1_000_000` |
| `Float` | IEEE 754 double-precision floating point. | `0.0`, `3.14`, `-0.5`, `1.0e10` |
| `Bool` | Boolean value. | `true`, `false` |
| `String` | UTF-8 encoded text. Immutable. | `"hello"`, `"line\nbreak"` |
| `Void` | The unit type. Used as a return type for functions that produce no value. | (no literal) |
| `Never` | The bottom type. Indicates a function that never returns (e.g., infinite loop, always errors). | (no literal) |

### Int

`Int` represents whole numbers. HAL does not expose fixed-width integer types (`i32`,
`u64`, etc.) — the transpiler chooses the appropriate representation for the target. If a
computation overflows the target's native integer, the transpiler must either use
arbitrary-precision arithmetic or produce a compile-time error.

Underscores are allowed in integer literals for readability: `1_000_000`.

### Float

`Float` follows IEEE 754 double-precision semantics. There is no single-precision float
type — the transpiler may optimize to `f32` when it can prove no precision loss.

### String

Strings are immutable sequences of UTF-8 characters. String interpolation uses `{expr}`
syntax inside double-quoted strings:

```
let name = "world"
let greeting = "Hello, {name}!"       // "Hello, world!"
let computed = "2 + 2 = {2 + 2}"      // "2 + 2 = 4"
```

Escape sequences:

| Escape | Meaning |
| ------ | ------- |
| `\n` | Newline |
| `\t` | Tab |
| `\\` | Backslash |
| `\"` | Double quote |
| `\{` | Literal `{` (escapes interpolation) |
| `\u{XXXX}` | Unicode code point |

Multi-line strings use triple quotes:

```
let sql = """
  SELECT *
  FROM users
  WHERE active = true
"""
```

Leading whitespace is stripped based on the indentation of the closing `"""`.

### Void

`Void` is the type of functions that perform an action but return no meaningful value.
There is no `void` literal — a function with return type `Void` implicitly returns `Void`
at the end of its body.

```
fn log_message(msg: String) -> Void
  effects [Logging.Info]
{
  Logging.info(msg)
  // implicitly returns Void
}
```

### Never

`Never` is the bottom type. A function returning `Never` guarantees it will not return
normally. This is useful for functions that always error or loop forever.

```
fn fatal(msg: String) -> Never {
  // This function never returns — it always produces an error
  panic(msg)  // built-in that terminates the program
}
```

`Never` is a subtype of every type, so it can appear in any position where a value is
expected (this is sound because the code path is unreachable).

## Composite Types

### List\<T\>

An ordered collection of elements of type `T`. Supports O(1) indexed access and O(1)
amortized append. The transpiler chooses the underlying implementation.

```
let numbers: List<Int> = [1, 2, 3, 4, 5]
let first = numbers[0]             // Int: 1
let length = numbers.length()      // Int: 5
```

List literal syntax uses square brackets: `[elem1, elem2, ...]`.

Key operations:

```
numbers.length() -> Int
numbers[index] -> T                       // panics if out of bounds
numbers.get(index) -> Optional<T>         // safe indexed access
numbers.append(value) -> List<T>          // returns new list (immutable)
numbers.map(fn(T) -> U) -> List<U>
numbers.filter(fn(T) -> Bool) -> List<T>
numbers.fold(initial: U, fn(U, T) -> U) -> U
numbers.contains(value) -> Bool
numbers.is_empty() -> Bool
```

When the binding is mutable (`let mut`), mutation methods are available:

```
let mut items: List<Int> = [1, 2, 3]
items.push(4)                             // mutates in place
items.remove(0)                           // removes element at index
```

### Map\<K, V\>

A collection of key-value pairs. Keys must implement the `Hashable` and `Eq` traits.

```
let scores: Map<String, Int> = {
  "alice": 100,
  "bob": 85,
}
let alice_score = scores["alice"]         // Optional<Int>
```

Map literal syntax uses curly braces with `key: value` pairs.

Key operations:

```
scores.get(key) -> Optional<V>
scores.contains_key(key) -> Bool
scores.keys() -> List<K>
scores.values() -> List<V>
scores.entries() -> List<(K, V)>          // internal tuple, not exposed as a type
scores.length() -> Int
scores.is_empty() -> Bool
```

Mutable operations (when `let mut`):

```
let mut scores: Map<String, Int> = {}
scores.insert("alice", 100)
scores.remove("alice")
```

### Set\<T\>

A collection of unique values. Elements must implement `Hashable` and `Eq`.

```
let tags: Set<String> = #{"rust", "hal", "lang"}
```

Set literal syntax uses `#{elem1, elem2, ...}`.

Key operations:

```
tags.contains(value) -> Bool
tags.union(other) -> Set<T>
tags.intersection(other) -> Set<T>
tags.difference(other) -> Set<T>
tags.length() -> Int
tags.is_empty() -> Bool
```

### Optional\<T\>

Represents a value that may or may not be present. This is HAL's replacement for
null/nil/undefined.

```
let name: Optional<String> = Optional.some("Alice")
let missing: Optional<String> = Optional.none()
```

`Optional<T>` is an enum with two variants:

```
enum Optional<T> {
  Some(value: T)
  None
}
```

Operations:

```
opt.is_some() -> Bool
opt.is_none() -> Bool
opt.unwrap() -> T                         // panics if None
opt.unwrap_or(default: T) -> T
opt.map(fn(T) -> U) -> Optional<U>
opt.and_then(fn(T) -> Optional<U>) -> Optional<U>
```

The `?` operator works on `Optional<T>`: if the value is `None`, the function returns
`None` immediately. The enclosing function must return `Optional<U>` for some `U`.

```
fn get_user_email(id: String) -> Optional<String> {
  let user = find_user(id)?               // returns None if user not found
  return Optional.some(user.email)
}
```

### Result\<T, E\>

Represents either a success value or an error. See
[error-handling.md](error-handling.md) for full details.

```
enum Result<T, E> {
  Ok(value: T)
  Err(error: E)
}
```

## Generics

Types and functions can be parameterized with type variables:

```
struct Pair<A, B> {
  first: A
  second: B
}

fn identity<T>(value: T) -> T {
  return value
}
```

### Trait Bounds

Type parameters can be constrained with trait bounds:

```
fn find_max<T: Comparable>(items: List<T>) -> Optional<T> {
  // T must implement the Comparable trait
  // ...
}
```

Multiple bounds use `+`:

```
fn serialize_sorted<T: Serializable + Comparable>(items: List<T>) -> String {
  // ...
}
```

### Where Clauses

For complex bounds, use a `where` clause:

```
fn merge<K, V>(a: Map<K, V>, b: Map<K, V>) -> Map<K, V>
  where K: Hashable + Eq
{
  // ...
}
```

## Type Inference

HAL supports local type inference. The type of a binding can be omitted when the compiler
can infer it from the right-hand side:

```
let count = 42                      // inferred as Int
let name = "Alice"                  // inferred as String
let items = [1, 2, 3]              // inferred as List<Int>
```

Type annotations are **required** in these positions:

- Function parameters: `fn foo(x: Int) -> ...`
- Function return types: `fn foo() -> Int`
- Struct fields: `struct S { x: Int }`
- When the inference would be ambiguous.

Type annotations are **optional** in these positions:

- `let` bindings (when inferable from the right-hand side)
- `const` bindings (when inferable)
- Closure parameters (when inferable from context)

## Type Aliases

Types can be aliased for readability:

```
type UserId = String
type UserResult = Result<User, UserError>
type Handler = fn(Request) -> Result<Response, HttpError>
```

Type aliases are transparent — `UserId` and `String` are fully interchangeable. They exist
only for documentation purposes.

## Type Conversions

There are no implicit conversions. All conversions are explicit via methods or trait
implementations:

```
let x: Int = 42
let f: Float = x.to_float()        // explicit conversion
let s: String = x.to_string()      // explicit conversion

let parsed: Result<Int, ParseError> = Int.parse("42")  // parsing is fallible
```

Standard conversion traits:

- `Into<T>` — infallible conversion (e.g., `Int` into `Float`)
- `TryInto<T, E>` — fallible conversion (returns `Result<T, E>`)
- `ToString` — convert to string representation
