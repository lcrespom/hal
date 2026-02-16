# Standard Library

This section defines HAL's standard library — the abstract capabilities and built-in
operations available to all HAL programs.

## Design Principle

The standard library provides **abstract capabilities**. Agents call high-level operations
like `FileSystem.read(path)` or `Network.get(url)`. The transpiler maps these to
platform-specific implementations. Agents never see the target platform.

## Collections

Collections are covered in [types.md](types.md). This section covers additional operations.

### List\<T\>

```rust
// Construction
List.empty<T>() -> List<T>
List.of<T>(items: T...) -> List<T>          // variadic construction
List.repeat<T>(value: T, count: Int) -> List<T>
List.range(start: Int, end: Int) -> List<Int>  // exclusive end

// Query
list.length() -> Int
list.is_empty() -> Bool
list.contains(value: T) -> Bool              // requires T: Eq
list.index_of(value: T) -> Optional<Int>     // requires T: Eq
list.first() -> Optional<T>
list.last() -> Optional<T>
list[index] -> T                              // panics if out of bounds
list.get(index: Int) -> Optional<T>           // safe access

// Transformation (return new lists — immutable)
list.map<U>(fn(T) -> U) -> List<U>
list.filter(fn(T) -> Bool) -> List<T>
list.fold<U>(initial: U, fn(U, T) -> U) -> U
list.flat_map<U>(fn(T) -> List<U>) -> List<U>
list.zip<U>(other: List<U>) -> List<(T, U)>
list.enumerate() -> List<(Int, T)>
list.take(n: Int) -> List<T>
list.skip(n: Int) -> List<T>
list.reverse() -> List<T>
list.sort() -> List<T>                        // requires T: Comparable
list.unique() -> List<T>                      // requires T: Eq + Hashable
list.join(separator: String) -> String        // requires T: ToString
list.chunk(size: Int) -> List<List<T>>
list.any(fn(T) -> Bool) -> Bool
list.all(fn(T) -> Bool) -> Bool
list.find(fn(T) -> Bool) -> Optional<T>

// Mutation (only on let mut bindings)
list.push(value: T) -> Void
list.pop() -> Optional<T>
list.insert(index: Int, value: T) -> Void
list.remove(index: Int) -> T
list.clear() -> Void
```

### Map\<K, V\>

```rust
// Construction
Map.empty<K, V>() -> Map<K, V>
Map.from_entries<K, V>(entries: List<(K, V)>) -> Map<K, V>

// Query
map.length() -> Int
map.is_empty() -> Bool
map.contains_key(key: K) -> Bool
map.get(key: K) -> Optional<V>
map[key] -> Optional<V>                      // same as .get()
map.keys() -> List<K>
map.values() -> List<V>
map.entries() -> List<(K, V)>

// Transformation
map.map_values<U>(fn(V) -> U) -> Map<K, U>
map.filter(fn(K, V) -> Bool) -> Map<K, V>
map.merge(other: Map<K, V>) -> Map<K, V>     // other's values win on conflict

// Mutation (only on let mut bindings)
map.insert(key: K, value: V) -> Optional<V>  // returns previous value
map.remove(key: K) -> Optional<V>
map.clear() -> Void
```

### Set\<T\>

```rust
// Construction
Set.empty<T>() -> Set<T>
Set.from_list<T>(items: List<T>) -> Set<T>

// Query
set.length() -> Int
set.is_empty() -> Bool
set.contains(value: T) -> Bool

// Set operations
set.union(other: Set<T>) -> Set<T>
set.intersection(other: Set<T>) -> Set<T>
set.difference(other: Set<T>) -> Set<T>
set.symmetric_difference(other: Set<T>) -> Set<T>
set.is_subset(other: Set<T>) -> Bool
set.is_superset(other: Set<T>) -> Bool

// Conversion
set.to_list() -> List<T>

// Mutation (only on let mut bindings)
set.add(value: T) -> Bool                    // returns true if newly added
set.remove(value: T) -> Bool                 // returns true if was present
set.clear() -> Void
```

## String Operations

```rust
// Query
str.length() -> Int
str.is_empty() -> Bool
str.contains(substring: String) -> Bool
str.starts_with(prefix: String) -> Bool
str.ends_with(suffix: String) -> Bool
str.index_of(substring: String) -> Optional<Int>

// Transformation
str.to_uppercase() -> String
str.to_lowercase() -> String
str.trim() -> String
str.trim_start() -> String
str.trim_end() -> String
str.replace(old: String, new: String) -> String
str.split(separator: String) -> List<String>
str.substring(start: Int, end: Int) -> String
str.repeat(count: Int) -> String
str.pad_start(length: Int, pad: String) -> String
str.pad_end(length: Int, pad: String) -> String
str.chars() -> List<String>                  // each element is a single character

// Parsing
Int.parse(str: String) -> Result<Int, ParseError>
Float.parse(str: String) -> Result<Float, ParseError>
Bool.parse(str: String) -> Result<Bool, ParseError>
```

## Math Operations

```rust
// On Int
Int.abs(value: Int) -> Int
Int.min(a: Int, b: Int) -> Int
Int.max(a: Int, b: Int) -> Int
Int.clamp(value: Int, min: Int, max: Int) -> Int

// On Float
Float.abs(value: Float) -> Float
Float.min(a: Float, b: Float) -> Float
Float.max(a: Float, b: Float) -> Float
Float.clamp(value: Float, min: Float, max: Float) -> Float
Float.floor(value: Float) -> Int
Float.ceil(value: Float) -> Int
Float.round(value: Float) -> Int
Float.sqrt(value: Float) -> Float
Float.pow(base: Float, exp: Float) -> Float
Float.PI -> Float
Float.E -> Float
Float.INFINITY -> Float
Float.NAN -> Float
Float.is_nan(value: Float) -> Bool
Float.is_infinite(value: Float) -> Bool
```

## FileSystem Capability

All operations require the corresponding `FileSystem.*` effect.

```rust
FileSystem.read(path: String) -> Result<String, IoError>
  effects [FileSystem.Read]

FileSystem.read_bytes(path: String) -> Result<List<Int>, IoError>
  effects [FileSystem.Read]

FileSystem.write(path: String, content: String) -> Result<Void, IoError>
  effects [FileSystem.Write]

FileSystem.append(path: String, content: String) -> Result<Void, IoError>
  effects [FileSystem.Write]

FileSystem.delete(path: String) -> Result<Void, IoError>
  effects [FileSystem.Delete]

FileSystem.exists(path: String) -> Result<Bool, IoError>
  effects [FileSystem.Read]

FileSystem.list_dir(path: String) -> Result<List<String>, IoError>
  effects [FileSystem.Read]

FileSystem.create_dir(path: String) -> Result<Void, IoError>
  effects [FileSystem.Write]

FileSystem.copy(from: String, to: String) -> Result<Void, IoError>
  effects [FileSystem.Read, FileSystem.Write]

FileSystem.move(from: String, to: String) -> Result<Void, IoError>
  effects [FileSystem.Write, FileSystem.Delete]
```

## Network Capability

```rust
struct HttpRequest {
  method: HttpMethod
  url: String
  headers: Map<String, String>
  body: Optional<String>
}

enum HttpMethod { Get, Post, Put, Patch, Delete, Head, Options }

struct HttpResponse {
  status: Int
  headers: Map<String, String>
  body: String
}

Network.request(request: HttpRequest) -> Result<HttpResponse, NetworkError>
  effects [Network.External]

// Convenience methods
Network.get(url: String) -> Result<HttpResponse, NetworkError>
  effects [Network.External]

Network.post(url: String, body: String) -> Result<HttpResponse, NetworkError>
  effects [Network.External]

Network.put(url: String, body: String) -> Result<HttpResponse, NetworkError>
  effects [Network.External]

Network.delete(url: String) -> Result<HttpResponse, NetworkError>
  effects [Network.External]
```

## Database Capability

```rust
struct QueryResult {
  rows: List<Map<String, String>>
  affected_rows: Int
}

Database.query(sql: String, params: List<String>) -> Result<QueryResult, DbError>
  effects [Database.Read]

Database.execute(sql: String, params: List<String>) -> Result<Int, DbError>
  effects [Database.Write]

Database.transaction<T>(operation: fn() -> Result<T, DbError>) -> Result<T, DbError>
  effects [Database.Read, Database.Write]
```

## Crypto Capability

```rust
Crypto.hash_sha256(data: String) -> String
  effects [Crypto.Hash]

Crypto.hash_bcrypt(data: String, rounds: Int) -> String
  effects [Crypto.Hash]

Crypto.verify_bcrypt(data: String, hash: String) -> Bool
  effects [Crypto.Hash]

Crypto.random_bytes(length: Int) -> List<Int>
  effects [Crypto.Encrypt]

Crypto.uuid() -> String
  effects [Crypto.Encrypt]
```

## Time Capability

```rust
struct DateTime {
  year: Int
  month: Int
  day: Int
  hour: Int
  minute: Int
  second: Int
  millisecond: Int
}

struct Duration {
  milliseconds: Int
}

Time.now() -> DateTime
  effects [Time.Read]

Time.unix_ms() -> Int
  effects [Time.Read]

Duration.from_ms(ms: Int) -> Duration
Duration.from_seconds(s: Int) -> Duration
Duration.from_minutes(m: Int) -> Duration
Duration.from_hours(h: Int) -> Duration
```

## Logging Capability

```rust
Logging.debug(message: String) -> Void
  effects [Logging.Debug]

Logging.info(message: String) -> Void
  effects [Logging.Info]

Logging.warn(message: String) -> Void
  effects [Logging.Warn]

Logging.error(message: String) -> Void
  effects [Logging.Error]
```

All logging functions accept string interpolation for structured data:

```rust
Logging.info("User {user.id} logged in from {ip_address}")
```

## Console Capability

```rust
Console.write(message: String) -> Void
  effects [Console.Write]

Console.write_line(message: String) -> Void
  effects [Console.Write]

Console.read_line() -> Result<String, IoError>
  effects [Console.Read]
```

## Serialization

```rust
Json.stringify<T: Serializable>(value: T) -> String
Json.parse<T: Serializable>(json: String) -> Result<T, JsonError>
```
