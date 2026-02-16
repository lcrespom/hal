# Error Handling

This section defines HAL's error handling model: `Result<T, E>`, `Optional<T>`, the `?`
operator, and error type conventions.

## Design Principle

There are no exceptions in HAL. All errors are values. Every function that can fail returns
`Result<T, E>`. Every value that might be absent is `Optional<T>`. Error handling is
always explicit, local, and visible.

## Result\<T, E\>

`Result<T, E>` represents either a success or an error:

```
enum Result<T, E> {
  Ok(value: T)
  Err(error: E)
}
```

### Construction

```
let success: Result<Int, String> = Result.ok(42)
let failure: Result<Int, String> = Result.err("something went wrong")
```

### Inspection

```
result.is_ok() -> Bool
result.is_err() -> Bool
result.unwrap() -> T             // panics if Err
result.unwrap_err() -> E         // panics if Ok
result.unwrap_or(default: T) -> T
result.map(fn(T) -> U) -> Result<U, E>
result.map_err(fn(E) -> F) -> Result<T, F>
result.and_then(fn(T) -> Result<U, E>) -> Result<U, E>
```

### Pattern Matching

```
match result {
  case Result.Ok(value) => {
    // use value
  }
  case Result.Err(error) => {
    // handle error
  }
}
```

## The `?` Operator

The `?` operator is the primary way to propagate errors. When applied to a `Result<T, E>`:

- If the result is `Ok(value)`, it extracts `value` and continues.
- If the result is `Err(error)`, it returns `Err(error)` from the current function
  immediately.

```
fn read_config(path: String) -> Result<Config, ConfigError>
  effects [FileSystem.Read]
{
  let content = FileSystem.read(path)?     // returns early if read fails
  let parsed = parse_config(content)?      // returns early if parse fails
  return Result.ok(parsed)
}
```

### Requirements

For `?` to work:

1. The enclosing function must return `Result<T, E>` (or `Optional<T>` — see below).
2. The error type of the expression must be convertible to the error type of the enclosing
   function (via `Into<E>` trait).

### Error Conversion

If the inner error type differs from the outer error type, the `Into` trait performs
automatic conversion:

```
enum ConfigError {
  IoError(message: String)
  ParseError(message: String)
}

impl Into<ConfigError> for IoError {
  fn into(self) -> ConfigError {
    return ConfigError.IoError(message: self.message)
  }
}

fn load_config(path: String) -> Result<Config, ConfigError>
  effects [FileSystem.Read]
{
  let content = FileSystem.read(path)?  // IoError automatically converted to ConfigError
  // ...
}
```

## The `?` Operator on Optional

`?` also works on `Optional<T>`:

- If the value is `Some(value)`, it extracts `value`.
- If the value is `None`, it returns `None` from the current function immediately.

```
fn get_user_city(id: String) -> Optional<String> {
  let user = find_user(id)?          // returns None if user not found
  let address = user.address?        // returns None if no address
  return Optional.some(address.city)
}
```

The enclosing function must return `Optional<U>` for some `U`.

## Error Types

### Defining Error Types

Errors are regular enums. There is no special error trait or base class:

```
enum HttpError {
  NotFound(path: String)
  Unauthorized(message: String)
  ServerError(code: Int, message: String)
  Timeout(url: String, duration_ms: Int)
}
```

### Convention

Error enum variants should carry enough information for actionable error messages:

```
// GOOD — carries context:
enum UserError {
  NotFound(id: String)
  DuplicateEmail(email: String)
  InvalidAge(age: Int, reason: String)
}

// BAD — no context:
enum UserError {
  NotFound
  DuplicateEmail
  InvalidAge
}
```

### The `Displayable` Trait for Errors

Error types should implement `Displayable` to provide human-readable messages:

```
impl Displayable for UserError {
  fn display(self) -> String {
    return match self {
      case UserError.NotFound(id) => "User not found: {id}"
      case UserError.DuplicateEmail(email) => "Email already in use: {email}"
      case UserError.InvalidAge(age, reason) => "Invalid age {age}: {reason}"
    }
  }
}
```

## No Panics in Normal Code

`unwrap()` and similar operations that panic should only appear in:

1. Tests (where a panic is an assertion failure)
2. Situations where failure is provably impossible (and a comment explains why)

In production code, always use `?` or explicit `match` to handle errors.

## Error Propagation Patterns

### Chaining with `and_then`

```
fn process_order(id: String) -> Result<Receipt, OrderError>
  effects [Database.Read, Database.Write, Network.Internal]
{
  return find_order(id)
    .and_then(fn(order) { return validate_order(order) })
    .and_then(fn(order) { return charge_payment(order) })
    .and_then(fn(payment) { return create_receipt(payment) })
}
```

### Combining Multiple Results

```
fn create_report() -> Result<Report, ReportError>
  effects [Database.Read]
{
  let users = fetch_users()?
  let orders = fetch_orders()?
  let products = fetch_products()?

  return Result.ok(Report {
    users: users,
    orders: orders,
    products: products,
  })
}
```

### Converting Between Error Types

Use `map_err` to convert error types when `Into` is not implemented:

```
fn load_user(id: String) -> Result<User, AppError>
  effects [Database.Read]
{
  let user = Database.find_user(id)
    .map_err(fn(e) { return AppError.Database(message: e.display()) })?
  return Result.ok(user)
}
```
