# HAL — High-level Agentic coding Language

HAL is a programming language designed specifically for coding agents. It aims to make
agentic coding as reliable, accurate, and productive as possible — while remaining
readable and reviewable by humans.

## What is HAL?

HAL is a statically typed, high-level language that compiles to target languages (initially
TypeScript). Agents write business logic, data models, contracts, and effects. The
transpiler handles all low-level concerns: memory management, async mechanics, concurrency
primitives, and platform APIs.

Key features:

- **Contract-based design** — preconditions, postconditions, and invariants are first-class
  language constructs
- **Effect system** — side effects are explicitly declared and compiler-verified
- **Pure by default** — mutation and effects require explicit opt-in
- **No null/nil** — `Optional<T>` and `Result<T, E>` with the `?` operator
- **First-class testing** — `test` and `test suite` are language keywords, not library
  conventions
- **Target-independent** — agents write HAL; the transpiler maps to TypeScript, Rust, etc.
- **Machine-friendly diagnostics** — structured JSON error output alongside human-readable
  messages

## Project Status

This project is in the design phase. The language specification is complete and the
compiler implementation plan is next.

## Repository Structure

```
prompts/
  aopl.md                  # Project roadmap and approach
  design-principles.md     # 12 design principles guiding all decisions
  high-level-design.md     # Exploratory design sketch
  language-spec.md         # Language specification (summary + index)
  spec/                    # Detailed specification sections
    types.md               # Primitive types, composites, generics
    functions.md           # Functions, closures, contracts, purity
    control-flow.md        # if, match, for, while
    structs-enums.md       # Structs, enums, invariants
    traits.md              # Traits, impl blocks, derive
    modules.md             # Module system, visibility, imports
    effects.md             # Effect system, propagation, forbids
    concurrency.md         # concurrent blocks
    testing.md             # Test blocks, suites, assertions
    error-handling.md      # Result, Optional, ? operator
    stdlib.md              # Standard library capabilities
    ffi.md                 # Foreign function interface
    grammar.md             # Complete formal grammar (EBNF)
```

## Example

```
struct User {
  name: String
  email: String
  age: Int

  invariant { age >= 0 and age <= 200 }
  invariant { name.length() > 0 }
}

fn create_user(name: String, email: String, age: Int) -> Result<User, UserError>
  effects [Database.Write, Logging.Info]
{
  let user = User.new(name, email, age)?
  save_to_database(user)?
  Logging.info("Created user: {user.name}")
  return Result.ok(user)
}

test "rejects negative age" {
  let result = User.new("Alice", "alice@example.com", -1)
  assert result.is_err()
}
```

## License

TBD
