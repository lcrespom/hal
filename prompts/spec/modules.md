# Modules

This section defines HAL's module system: file-to-module mapping, visibility, imports, and
interface files.

## File-to-Module Mapping

Each `.hal` file is a module. The file's path relative to `src/` determines the module
name. Directory separators become dots.

```
src/
  main.hal              → module: main         (entry point)
  lib.hal               → module: lib          (library root)
  auth/
    mod.hal             → module: auth         (directory module)
    password.hal        → module: auth.password
    token.hal           → module: auth.token
  http/
    mod.hal             → module: http
    router.hal          → module: http.router
    middleware.hal       → module: http.middleware
```

### Rules

1. Each directory that is a module must contain a `mod.hal` file.
2. `mod.hal` defines the directory module and controls what submodules are visible.
3. The entry point for applications is `src/main.hal` (must contain a `main` function).
4. The root for libraries is `src/lib.hal`.

## Visibility

All declarations are **private by default**. The `pub` keyword makes a declaration part of
the module's public API.

```
pub struct User { ... }         // visible to other modules
pub fn create_user() { ... }   // visible to other modules
fn helper() { ... }            // private to this module
```

`pub` can be applied to:

- `struct` declarations
- `enum` declarations
- `fn` declarations
- `trait` declarations
- `type` aliases
- `const` declarations
- `effect` declarations

### Module-Level Visibility

There is no `pub(crate)` or `pub(super)` — only fully private or fully public. This
simplifies the mental model for agents.

## Imports

Modules import declarations from other modules using `import`:

```
import auth.password.hash
import auth.password.verify
import http.router.Router
```

### Grouped Imports

Multiple imports from the same module can be grouped:

```
import auth.password.{ hash, verify }
import http.{ Router, Request, Response }
```

### Aliased Imports

Use `as` to rename an import:

```
import auth.token.Token as AuthToken
import crypto.hash as crypto_hash
```

### Rules

1. **No wildcard imports** — `import foo.*` is not allowed. Every imported name must be
   listed explicitly. This ensures agents can always trace where a name comes from.
2. **No re-exports** — importing a name does not make it part of the current module's
   public API. To expose something from a submodule, use `pub import`:

```
// In auth/mod.hal
pub import auth.password.{ hash, verify }
// Now auth.hash and auth.verify are available to importers of auth
```

3. **No implicit prelude** — nothing is auto-imported except the built-in types (`Int`,
   `Float`, `Bool`, `String`, `Void`, `Never`, `List`, `Map`, `Set`, `Optional`, `Result`).
4. **No circular imports** — the module dependency graph must be a DAG. The compiler
   reports an error if circular dependencies are detected.

## Interface Files

Each module can have a corresponding **interface file** (`.hali`) that declares its public
API without implementation details.

```
// auth/password.hali
pub fn hash(password: String) -> String
  effects [Crypto.Hash]

pub fn verify(password: String, hash: String) -> Bool
  effects [Crypto.Hash]
```

### Purpose

Interface files serve two goals:

1. **Agent efficiency** — an agent can read the `.hali` file to understand a module's API
   without loading the full implementation. This is critical for large codebases.
2. **Separate compilation** — the compiler can type-check callers against the interface
   without needing the implementation.

### Rules

1. Interface files are optional. If absent, the compiler extracts the public API from the
   `.hal` file.
2. If an interface file exists, the compiler verifies that the `.hal` implementation
   matches the `.hali` declarations.
3. Interface files contain only signatures — no function bodies, no private declarations.
4. Interface files include contracts (`precondition`, `postcondition`) and effect
   declarations — these are part of the public API.

### Auto-generation

The toolchain can auto-generate `.hali` files from `.hal` files:

```
hal interface src/auth/password.hal
```

This extracts all `pub` declarations into a `.hali` file.

## Module Initialization

Modules have no initialization code. There is no "module-level execution" — no top-level
statements that run on import. The only code that runs is explicit function calls from
`main`.

This prevents import-order dependencies and makes module loading deterministic.

## Package System

### Project Manifest

Each HAL project has a `hal.toml` file at its root:

```toml
[package]
name = "my-app"
version = "1.0.0"

[dependencies]
http-server = "2.1.0"
json = "1.3.0"

[targets]
typescript = { output = "dist/" }
```

### Dependencies

Dependencies are versioned packages from a registry. They are imported by their package
name:

```
import http_server.{ Server, Route }
import json.{ parse, stringify }
```

### Workspace

For multi-package projects, a workspace groups related packages:

```toml
[workspace]
members = ["core", "api", "web"]
```
