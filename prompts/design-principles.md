# HAL Design Principles

These principles guide all design decisions for HAL. They capture what makes code easy
for coding agents to reliably generate, understand, and manipulate — while remaining
readable and reviewable by humans.

## 1. Minimal Ambiguity

Every construct should have exactly one meaning. There should be one obvious way to
express a given intent, not multiple alternatives that produce the same result.

- No operator overloading or context-dependent semantics.
- No implicit conversions between types.
- Keywords and syntax should map one-to-one to concepts.
- Avoid features where the meaning depends on surrounding context (e.g., `this` binding
  rules in JavaScript, or Python's mutable default arguments).

## 2. Uniform Syntax

The grammar should be consistent and regular. Agents parse and generate code by pattern
matching — irregular syntax creates edge cases that lead to errors.

- All blocks use the same delimiter style.
- Declarations follow a consistent structure (e.g., `keyword name: Type = value`).
- No special-case syntax for common operations; prefer a small set of composable
  constructs over many specialized ones.
- Function calls, method calls, and constructor calls should look the same.

## 3. Explicit Over Implicit

The code should say what it means. Hidden behavior forces agents to maintain mental models
of invisible state, which is a common source of bugs.

- No implicit imports, injections, or globals.
- No auto-coercion, auto-dereferencing, or implicit returns.
- Dependencies and data flow should be visible in the source text.
- Side effects are governed by the Effect System (principle 5).

## 4. Contract-Based Design

Functions and data types should declare their contracts — preconditions, postconditions,
and invariants — as first-class language constructs. This gives agents a mechanical way to
reason about correctness and enables automatic test generation.

- Functions can declare `precondition` (what must be true before the call) and
  `postcondition` (what is guaranteed after the call).
- Data types can declare `invariant` (properties that must always hold).
- The compiler enforces these contracts at compile time where possible and generates
  runtime checks otherwise.
- Contracts serve as machine-verifiable documentation — agents can read them to understand
  a function's behavior without reading its implementation.

## 5. Effect System

Side effects must be explicitly declared and controlled. An effect system makes it possible
to know exactly what a function can and cannot do, which is critical for agents to reason
about safety and composition.

- Functions declare their effects (e.g., `effects: [Database.Write, Logger.Info]`).
- Functions can also declare what they forbid (e.g., `forbids: [Network.External]`),
  providing strong negative guarantees.
- The compiler verifies that a function does not perform undeclared effects.
- Pure functions (no effects) are the default — effects require explicit opt-in.

## 6. Strong Locality of Reasoning

A developer (human or agent) should be able to understand a piece of code by reading only
that piece and its immediate declarations — without chasing through distant files or
inherited behaviors.

- Prefer composition over inheritance.
- Module interfaces should be self-contained: reading a module's public API should be
  sufficient to use it, without consulting its implementation.
- Avoid action-at-a-distance patterns (e.g., monkey-patching, decorators that silently
  alter behavior, global event buses).
- Error handling should be local and explicit (no unchecked exceptions propagating
  silently).

## 7. Minimal Hidden State

Mutable shared state is the primary source of complexity that agents struggle with. The
language should make state visible and contained.

- Immutable by default; mutation requires explicit opt-in.
- No global mutable state.
- Concurrency primitives should prevent data races by construction (e.g., message passing,
  ownership semantics).
- State changes should be traceable — prefer explicit state transitions over scattered
  mutations.

## 8. Predictable Structure

Agents work best when code follows predictable patterns. The language should encourage (or
enforce) consistent project structure.

- A standard module system with a clear, consistent file-to-module mapping.
- A canonical code formatter built into the toolchain (not optional) — all HAL code
  looks the same.
- A standard project layout convention so agents always know where to find things.

## 9. Machine-Friendly Diagnostics

Error messages and compiler output should be designed for both humans and machines to
consume.

- Errors should include structured data (file, line, column, error code, message) in a
  machine-parseable format (JSON).
- Error messages should be actionable: state what went wrong and suggest how to fix it.
- Warnings should be meaningful and few — avoid warning fatigue.

## 10. Scalability by Design

The language must support building large applications without the design falling apart at
scale.

- A strong module/package system with explicit public APIs and encapsulation.
- Support for separating interface from implementation, facilitating incremental
  discovery. This way, existing APIs can be quickly found, avoiding code duplication.
- Compilation should be incremental — changing one file should not require recompiling
  everything.
- The type system should catch errors at compile time that would otherwise surface only in
  large codebases (e.g., interface mismatches, missing exhaustive handling).

## 11. Target-Independent Semantics

HAL's semantics must not depend on or expose any particular compilation target. The
language should feel self-contained — agents write HAL, and the toolchain handles the
rest.

- No target-specific constructs or escape hatches in the language itself.
- The standard library defines abstract capabilities (I/O, networking, concurrency); the
  backend maps these to the target platform.
- FFI (foreign function interface) is the explicit, well-defined boundary for
  target-specific interop — it is the only place where the compilation target is visible.
- This enables multiple backends (TypeScript, Rust, Zig, WASM, etc.) without
  language-level changes.

## 12. Minimal Core, Extensible Library

Keep the language core small and well-defined. Push functionality into standard libraries
rather than language syntax.

- A small number of built-in types and constructs.
- Rich standard library for common operations (I/O, collections, networking, etc.).
- Avoid magic — library code should be expressible in the language itself.
