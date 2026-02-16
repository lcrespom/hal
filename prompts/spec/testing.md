# Testing

This section defines HAL's first-class testing constructs.

## Design Principle

Testing is a language feature, not a library convention. There is exactly one way to write
tests, discover tests, and run tests. No framework choice, no configuration, no ambiguity.

## Test Blocks

A **test** is declared with the `test` keyword followed by a string name and a body:

```rust
test "addition works" {
  assert 1 + 1 == 2
}

test "division by zero returns error" {
  let result = divide(10.0, 0.0)
  assert result.is_err()
  assert result.unwrap_err() == MathError.DivisionByZero
}
```

### Test Names

Test names are string literals. They should be descriptive — they appear in test output
and serve as documentation.

### Test Body

The test body is a block of statements. If any `assert` fails, the test fails. If the
body executes to completion without assertion failure, the test passes.

## Test Suites

Tests can be grouped into **suites** for organization:

```rust
test suite "User validation" {
  test "rejects negative age" {
    let result = User.new("Alice", "alice@example.com", -1)
    assert result.is_err()
  }

  test "rejects empty name" {
    let result = User.new("", "alice@example.com", 30)
    assert result.is_err()
  }

  test "accepts valid user" {
    let result = User.new("Alice", "alice@example.com", 30)
    assert result.is_ok()
  }
}
```

Suites can be nested:

```rust
test suite "Authentication" {
  test suite "password hashing" {
    test "hashed password differs from original" { ... }
    test "verify returns true for correct password" { ... }
  }

  test suite "token generation" {
    test "generates valid JWT" { ... }
    test "token expires after TTL" { ... }
  }
}
```

## Assertions

### `assert`

The basic assertion — verifies that an expression is `true`:

```rust
assert 1 + 1 == 2
assert user.age >= 0
assert list.contains("item")
```

When an assertion fails, the test runner reports:
- The file and line of the assertion
- The expression that failed
- The actual values of the operands (when possible)

### `assert_eq`

Asserts that two values are equal. Provides better error messages than `assert a == b`
because it shows both values:

```rust
assert_eq(result, 42)
// On failure: "Expected 42, got 37"
```

### `assert_ne`

Asserts that two values are not equal:

```rust
assert_ne(a, b)
// On failure: "Expected values to differ, but both are 42"
```

## Test Location

Tests can live in two places:

### 1. Alongside Code (Same File)

Tests at the bottom of a `.hal` file, after the implementation:

```rust
// src/math.hal

pub fn add(a: Int, b: Int) -> Int {
  return a + b
}

pub fn divide(a: Float, b: Float) -> Result<Float, MathError> {
  if b == 0.0 {
    return Result.err(MathError.DivisionByZero)
  }
  return Result.ok(a / b)
}

test "add works" {
  assert_eq(add(2, 3), 5)
}

test "divide by zero" {
  assert divide(1.0, 0.0).is_err()
}
```

Tests in the same file can access private functions and types in that module.

### 2. Separate Test Files

Test files in the `tests/` directory:

```
tests/
  math_test.hal
  auth_test.hal
```

Test files import the modules they test:

```rust
// tests/math_test.hal
import math.{ add, divide }

test suite "math" {
  test "add" {
    assert_eq(add(2, 3), 5)
  }
}
```

Test files can only access `pub` declarations.

## Effects in Tests

Tests can use effectful functions. The test runner provides mock implementations of
standard effects:

```rust
test "save_user writes to database" {
  let user = User.new("Alice", "alice@example.com", 30).unwrap()
  let result = save_user(user)
  assert result.is_ok()
}
```

The test runner automatically handles effects — no manual mock setup required for standard
capabilities. For custom effects, see Test Fixtures below.

## Test Fixtures

For shared setup and teardown, use helper functions:

```rust
fn create_test_user() -> User {
  return User.new("Test", "test@example.com", 25).unwrap()
}

test suite "User operations" {
  test "can update email" {
    let user = create_test_user()
    let updated = user.with_email("new@example.com")
    assert_eq(updated.email, "new@example.com")
  }

  test "can check adult status" {
    let user = create_test_user()
    assert user.is_adult()
  }
}
```

There is no `beforeEach` / `afterEach` / `beforeAll` / `afterAll` — explicit helper
function calls are clearer and more predictable for agents.

## Contract-Based Test Generation

The compiler can automatically generate test cases from contracts:

```rust
fn withdraw(account: Account, amount: Float) -> Result<Account, BankError>
  precondition { amount > 0.0 }
  precondition { amount <= account.balance }
{
  // ...
}
```

Running `hal test --generate-contract-tests` produces tests that:
1. Verify the function succeeds when preconditions are met.
2. Verify the function fails (or the precondition check triggers) when preconditions are
   violated.
3. Verify postconditions hold for successful results.
4. Verify struct invariants hold after construction.

## Test Output

Test output is structured (JSON) for programmatic consumption by agents:

```json
{
  "summary": {
    "total": 15,
    "passed": 14,
    "failed": 1,
    "duration_ms": 342
  },
  "results": [
    {
      "name": "User validation > rejects negative age",
      "status": "passed",
      "duration_ms": 2,
      "file": "src/user.hal",
      "line": 45
    },
    {
      "name": "User validation > accepts valid user",
      "status": "failed",
      "duration_ms": 3,
      "file": "src/user.hal",
      "line": 51,
      "failure": {
        "assertion": "assert result.is_ok()",
        "message": "Assertion failed: result is Err(ValidationError: email format invalid)",
        "line": 53
      }
    }
  ]
}
```

Human-readable output is also produced alongside the JSON, controlled by the `--format`
flag:

```sh
hal test                         # human-readable (default)
hal test --format json           # JSON only
hal test --format both           # both human-readable and JSON
```

## Running Tests

```sh
hal test                         # run all tests
hal test src/math.hal            # run tests in a specific file
hal test --suite "User"          # run tests matching suite name
hal test --name "rejects"        # run tests matching name pattern
hal test --generate-contract-tests  # include auto-generated contract tests
```
