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

```rust
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

```rust
import auth.password.hash
import auth.password.verify
import http.router.Router
```

### Grouped Imports

Multiple imports from the same module can be grouped:

```rust
import auth.password.{ hash, verify }
import http.{ Router, Request, Response }
```

### Aliased Imports

Use `as` to rename an import:

```rust
import auth.token.Token as AuthToken
import crypto.hash as crypto_hash
```

### Rules

1. **No wildcard imports** — `import foo.*` is not allowed. Every imported name must be
   listed explicitly. This ensures agents can always trace where a name comes from.
2. **No re-exports** — importing a name does not make it part of the current module's
   public API. To expose something from a submodule, use `pub import`:

```rust
// In auth/mod.hal
pub import auth.password.{ hash, verify }
// Now auth.hash and auth.verify are available to importers of auth
```

3. **No implicit prelude** — nothing is auto-imported except the built-in types (`Int`,
   `Float`, `Bool`, `String`, `Void`, `Never`, `List`, `Map`, `Set`, `Optional`,
   `Result`).
4. **No circular imports** — the module dependency graph must be a DAG. The compiler
   reports an error if circular dependencies are detected.

## Interface Files

Each module can have a corresponding **interface file** (`.hali`) that declares its public
API without implementation details.

```rust
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

```sh
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
hal-http = "2.1.0"            # HAL-native package
hal-json = "1.3.0"            # HAL-native package

[dependencies.external]
express = { version = "4.18.0", registry = "npm" }
zod = { version = "3.22.0", registry = "npm" }
hono = { version = "4.0.0", registry = "jsr" }

[targets]
typescript = { output = "dist/" }
```

### HAL-Native Dependencies

HAL-native packages are written in HAL and live in a HAL package registry. They are
imported directly:

```rust
import hal_http.{ Server, Route }
import hal_json.{ parse, stringify }
```

### External Dependencies (npm, JSR, etc.)

External packages are target-platform packages (e.g., npm or JSR packages for TypeScript).
They require **binding files** to be usable from HAL code. See the
[External Packages](#external-packages) section below.

### Workspace

For multi-package projects, a workspace groups related packages:

```toml
[workspace]
members = ["core", "api", "web"]
```

## External Packages

External packages let HAL code use the vast existing ecosystem (npm, JSR, etc.) while
maintaining full isolation from the target platform. This is what makes HAL practical from
day one.

### How It Works

1. Declare the external dependency in `hal.toml` under `[dependencies.external]`.
2. Provide a **binding file** (`.halx`) that defines the HAL-facing API for the package.
3. Import and use the binding in HAL code as if it were a native HAL module.

The agent never sees TypeScript, JavaScript, or any target-specific code. The binding file
is the contract between HAL and the external package.

### Binding Files (`.halx`)

A binding file declares the HAL API that an external package exposes. It lives in the
`bindings/` directory:

```
project/
  hal.toml
  bindings/
    express.halx
    zod.halx
    hono.halx
  src/
    main.hal
```

A binding file looks like a HAL interface file but maps to external package exports:

```rust
// bindings/zod.halx
// Binding for: zod@3.22.0 (npm)

pub struct Schema<T> {
  _opaque: True
}

pub fn string() -> Schema<String>
  maps_to "z.string()"

pub fn number() -> Schema<Int>
  maps_to "z.number()"

pub fn object<T>(shape: Map<String, Schema<T>>) -> Schema<T>
  maps_to "z.object"

pub fn parse<T>(schema: Schema<T>, data: String) -> Result<T, ValidationError>
  maps_to "schema.parse"
  effects [Validation]

pub enum ValidationError {
  InvalidType(expected: String, received: String)
  InvalidValue(message: String)
}
```

```rust
// bindings/express.halx
// Binding for: express@4.18.0 (npm)

pub struct App {
  _opaque: True
}

pub struct Request {
  method: String
  path: String
  headers: Map<String, String>
  body: Optional<String>
  params: Map<String, String>
  query: Map<String, String>
}

pub struct Response {
  _opaque: True
}

pub fn create_app() -> App
  maps_to "express()"
  effects [Network.Internal]

pub fn get(app: App, path: String, handler: fn(Request, Response) -> Void) -> Void
  maps_to "app.get"
  effects [Network.Internal]

pub fn post(app: App, path: String, handler: fn(Request, Response) -> Void) -> Void
  maps_to "app.post"
  effects [Network.Internal]

pub fn send(response: Response, body: String) -> Void
  maps_to "res.send"
  effects [Network.Internal]

pub fn json(response: Response, data: String) -> Void
  maps_to "res.json"
  effects [Network.Internal]

pub fn listen(app: App, port: Int) -> Void
  maps_to "app.listen"
  effects [Network.Internal]
```

### Using External Packages in HAL Code

Once a binding exists, the agent imports it like any HAL module:

```rust
import express.{ create_app, get, send, listen, Request, Response }

fn main() -> Void
  effects [Network.Internal]
{
  let app = create_app()

  get(app, "/hello", fn(req: Request, res: Response) {
    send(res, "Hello, {req.query.get("name").unwrap_or("world")}!")
  })

  listen(app, 3000)
}
```

The agent writes pure HAL. The transpiler:

1. Reads the `.halx` binding to understand the type mapping.
2. Generates the appropriate `import` / `require` for the target.
3. Maps HAL calls to the target-specific expressions defined in `maps_to`.

### Binding Generation

Writing bindings by hand is feasible but tedious for large packages. The toolchain can
auto-generate bindings from TypeScript type definitions:

```sh
hal bind express --registry npm --version 4.18.0
```

This reads the package's `.d.ts` files and generates a `.halx` binding with:

- Opaque types for classes and complex objects
- Function signatures mapped to HAL types
- Effect annotations inferred from the API (e.g., network, filesystem)

Auto-generated bindings can be reviewed and refined by the agent or human.

### Binding Quality Levels

Bindings can range from minimal to comprehensive:

1. **Auto-generated (minimal)** — opaque types, basic function signatures. Usable but
   limited.
2. **Curated** — hand-refined bindings with proper HAL types, contracts, and effect
   annotations. These provide the best agent experience.
3. **Community** — shared bindings published to the HAL package registry. Once a binding
   is published, any HAL project can use it without writing their own.

### Registry Priority

When multiple registries provide a package, the order of resolution is:

1. Local `bindings/` directory (project-specific)
2. HAL package registry (community-published bindings)
3. Auto-generated from target registry (npm, JSR)

### Binding vs FFI

| Concern     | External Packages (`.halx`)        | FFI (`ffi` blocks)                     |
| ----------- | ---------------------------------- | -------------------------------------- |
| Purpose     | Use ecosystem packages             | Access platform primitives             |
| Scope       | Entire package APIs                | Individual functions                   |
| Location    | `bindings/` directory              | `ffi/` directory                       |
| Types       | Mix of HAL types and opaque        | Primarily opaque                       |
| Generation  | Can be auto-generated from `.d.ts` | Always hand-written                    |
| Typical use | Express, Zod, Prisma, React        | `document.querySelector`, `setTimeout` |
