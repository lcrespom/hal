# Foreign Function Interface (FFI)

This section defines HAL's FFI — the explicit boundary between HAL and the target
platform.

## Design Principle

FFI is the **only** place where target-specific details appear. Regular HAL code never
sees the compilation target. FFI declarations are isolated in dedicated modules.

## FFI Blocks

An `ffi` block declares bindings to target-specific functions:

```rust
ffi "typescript" {
  fn fetch(url: String, options: FetchOptions) -> Response
    maps_to "globalThis.fetch"

  fn set_timeout(callback: fn() -> Void, delay_ms: Int) -> Int
    maps_to "setTimeout"
}
```

### Syntax

```rust
ffi "<target>" {
  fn <name>(<params>) -> <ReturnType>
    maps_to "<target_function>"
    effects [<Effect>, ...]    // optional
}
```

- `<target>` — the compilation target name (e.g., `"typescript"`, `"rust"`, `"wasm"`)
- `maps_to` — the target-language expression that this function maps to
- Effects are declared as usual

### Type Mapping

FFI functions must use HAL types in their signatures. The transpiler handles the mapping:

| HAL Type       | TypeScript          | Rust            |
| -------------- | ------------------- | --------------- |
| `Int`          | `number`            | `i64`           |
| `Float`        | `number`            | `f64`           |
| `Bool`         | `boolean`           | `bool`          |
| `String`       | `string`            | `String`        |
| `Void`         | `void`              | `()`            |
| `List<T>`      | `Array<T>`          | `Vec<T>`        |
| `Map<K, V>`    | `Map<K, V>`         | `HashMap<K, V>` |
| `Optional<T>`  | `T \| null`         | `Option<T>`     |
| `Result<T, E>` | (try/catch wrapper) | `Result<T, E>`  |

### FFI Functions are Effectful

All FFI functions are inherently effectful (they cross the platform boundary). If no
explicit effects are declared, the compiler treats them as having an implicit `FFI`
effect.

## FFI Modules

FFI declarations live in dedicated modules under the `ffi/` directory:

```
project/
  ffi/
    typescript/
      dom.hal           // DOM bindings
      fetch.hal          // Fetch API bindings
      timers.hal         // Timer bindings
    rust/
      tokio.hal          // Tokio bindings
```

### Conditional Compilation

FFI modules are target-specific. The compiler includes only the FFI modules for the
current target:

```rust
// ffi/typescript/dom.hal — only compiled when target is TypeScript
ffi "typescript" {
  fn query_selector(selector: String) -> Optional<Element>
    maps_to "document.querySelector"
    effects [FFI]
}
```

## Using FFI Functions

FFI functions are imported and called like any other HAL function:

```rust
import ffi.typescript.dom.query_selector

fn find_button() -> Optional<Element>
  effects [FFI]
{
  return query_selector("#submit-button")
}
```

## FFI Types

For types that exist only on the target platform, declare opaque types in the FFI module:

```rust
ffi "typescript" {
  type Element           // opaque — HAL code cannot inspect its internals
  type Event
  type HTMLElement

  fn query_selector(selector: String) -> Optional<Element>
    maps_to "document.querySelector"

  fn add_event_listener(element: Element, event: String, handler: fn(Event) -> Void) -> Void
    maps_to "addEventListener"
}
```

Opaque FFI types can only be:

- Passed to and returned from FFI functions
- Stored in HAL data structures
- Compared for equality (if the target supports it)

They cannot be pattern-matched, have fields accessed, or have methods called directly
(except through other FFI bindings).

## FFI Safety

FFI is inherently unsafe — it bypasses HAL's type system and effect system at the
boundary. The compiler provides these guardrails:

1. FFI functions must declare their effects (or get an implicit `FFI` effect).
2. FFI types are opaque — no accidental misuse of target-specific internals.
3. FFI modules are isolated — regular HAL code does not directly depend on the target.
4. The compiler warns if an FFI function is called from non-FFI code without going through
   a HAL wrapper function.

## Best Practice

Wrap FFI functions in HAL functions that provide proper HAL types, error handling, and
contracts:

```rust
// ffi/typescript/fetch.hal
ffi "typescript" {
  type RawResponse

  fn raw_fetch(url: String) -> RawResponse
    maps_to "fetch"

  fn raw_json(response: RawResponse) -> String
    maps_to "response.json"
}

// src/http/client.hal — the HAL wrapper
import ffi.typescript.fetch.{ raw_fetch, raw_json, RawResponse }

pub fn get_json(url: String) -> Result<String, NetworkError>
  effects [Network.External]
{
  let response = raw_fetch(url)
  let body = raw_json(response)
  return Result.ok(body)
}
```

Application code imports `http.client.get_json`, never the FFI module directly.
