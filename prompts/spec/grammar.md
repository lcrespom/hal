# Formal Grammar

This section defines the complete formal grammar for HAL using EBNF notation.

## Notation Conventions

```ebnf
rule        = definition ;
"keyword"   = terminal (literal text)
( ... )     = grouping
[ ... ]     = optional (zero or one)
{ ... }     = repetition (zero or more)
|           = alternation
```

## Program Structure

```ebnf
Program         = { TopLevelDecl } ;

TopLevelDecl    = ImportDecl
                | FnDecl
                | StructDecl
                | EnumDecl
                | TraitDecl
                | ImplBlock
                | EffectDecl
                | TypeAlias
                | ConstDecl
                | TestDecl
                | TestSuiteDecl
                | FfiBlock ;
```

## Imports

```ebnf
ImportDecl      = "import" ModulePath [ "." ImportList ] ;
ModulePath      = Ident { "." Ident } ;
ImportList      = Ident [ "as" Ident ]
                | "{" Ident [ "as" Ident ] { "," Ident [ "as" Ident ] } "}" ;
```

## Declarations

### Variables and Constants

```ebnf
LetDecl         = "let" [ "mut" ] Ident [ ":" Type ] "=" Expr ;
ConstDecl       = [ "pub" ] "const" Ident ":" Type "=" Expr ;
```

### Functions

```ebnf
FnDecl          = [ "pub" ] "fn" Ident [ GenericParams ] "(" [ ParamList ] ")"
                  [ "->" Type ]
                  [ WhereClause ]
                  { ContractClause }
                  [ EffectsClause ]
                  [ ForbidsClause ]
                  Block ;

ParamList       = Param { "," Param } ;
Param           = [ "mut" ] Ident ":" Type ;

ContractClause  = "precondition" Block
                | "postcondition" "(" Ident ")" Block ;

EffectsClause   = "effects" "[" EffectRef { "," EffectRef } "]" ;
ForbidsClause   = "forbids" "[" EffectRef { "," EffectRef } "]" ;
EffectRef       = Ident [ "." Ident ] ;
```

### Structs

```ebnf
StructDecl      = [ "pub" ] "struct" Ident [ GenericParams ]
                  "{" { StructField } { InvariantClause } [ DeriveClause ] "}" ;

StructField     = Ident ":" Type ;

InvariantClause = "invariant" Block ;

DeriveClause    = "derive" "[" Ident { "," Ident } "]" ;
```

### Enums

```ebnf
EnumDecl        = [ "pub" ] "enum" Ident [ GenericParams ]
                  "{" EnumVariant { EnumVariant } { InvariantClause } "}" ;

EnumVariant     = Ident [ "(" VariantFields ")" ] ;
VariantFields   = VariantField { "," VariantField } ;
VariantField    = Ident ":" Type ;
```

### Traits

```ebnf
TraitDecl       = [ "pub" ] "trait" Ident [ GenericParams ]
                  [ ":" TraitBounds ]
                  "{" { TraitMethod } "}" ;

TraitMethod     = "fn" Ident [ GenericParams ] "(" [ ParamList ] ")"
                  [ "->" Type ]
                  [ WhereClause ]
                  { ContractClause }
                  [ EffectsClause ]
                  [ Block ] ;         // optional body = default implementation
```

### Impl Blocks

```ebnf
ImplBlock       = "impl" [ TraitRef "for" ] Type [ WhereClause ]
                  "{" { FnDecl } "}" ;

TraitRef        = Ident [ GenericArgs ] ;
```

### Effects

```ebnf
EffectDecl      = [ "pub" ] "effect" Ident "{" { Ident } "}" ;
```

### Type Aliases

```ebnf
TypeAlias       = [ "pub" ] "type" Ident [ GenericParams ] "=" Type ;
```

### FFI

```ebnf
FfiBlock        = "ffi" StringLit "{" { FfiDecl } "}" ;

FfiDecl         = FfiTypeDecl | FfiFnDecl ;

FfiTypeDecl     = "type" Ident ;

FfiFnDecl       = "fn" Ident "(" [ ParamList ] ")" [ "->" Type ]
                  "maps_to" StringLit
                  [ EffectsClause ] ;
```

## Testing

```ebnf
TestDecl        = "test" StringLit Block ;

TestSuiteDecl   = "test" "suite" StringLit "{" { TestDecl | TestSuiteDecl } "}" ;
```

## Types

```ebnf
Type            = PrimitiveType
                | NamedType
                | GenericType
                | FnType ;

PrimitiveType   = "Int" | "Float" | "Bool" | "String" | "Void" | "Never" ;

NamedType       = Ident ;

GenericType     = Ident "<" Type { "," Type } ">" ;

FnType          = "fn" "(" [ TypeList ] ")" "->" Type ;

TypeList        = Type { "," Type } ;
```

## Generics

```ebnf
GenericParams   = "<" GenericParam { "," GenericParam } ">" ;
GenericParam    = Ident [ ":" TraitBounds ] ;
TraitBounds     = Ident { "+" Ident } ;

GenericArgs     = "<" Type { "," Type } ">" ;

WhereClause     = "where" WherePred { "," WherePred } ;
WherePred       = Ident ":" TraitBounds ;
```

## Statements

```ebnf
Statement       = LetDecl
                | Assignment
                | ReturnStmt
                | BreakStmt
                | ContinueStmt
                | ForLoop
                | WhileLoop
                | IfStmt
                | MatchStmt
                | ExprStmt ;

Assignment      = Expr "=" Expr ;

ReturnStmt      = "return" [ Expr ] ;

BreakStmt       = "break" ;

ContinueStmt    = "continue" ;
```

## Expressions

```ebnf
Expr            = OrExpr ;

OrExpr          = AndExpr { "or" AndExpr } ;
AndExpr         = CompExpr { "and" CompExpr } ;
CompExpr        = RangeExpr [ CompOp RangeExpr ] ;
RangeExpr       = AddExpr [ ( ".." | "..=" ) AddExpr ] ;
AddExpr         = MulExpr { ( "+" | "-" ) MulExpr } ;
MulExpr         = UnaryExpr { ( "*" | "/" | "%" ) UnaryExpr } ;
UnaryExpr       = [ "not" | "-" ] PostfixExpr ;
PostfixExpr     = PrimaryExpr { PostfixOp } ;
PostfixOp       = "." Ident [ "(" [ ArgList ] ")" ]
                | "[" Expr "]"
                | "?" ;

CompOp          = "==" | "!=" | "<" | ">" | "<=" | ">=" ;

PrimaryExpr     = Literal
                | Ident
                | "(" Expr ")"
                | FnCall
                | StructLit
                | ListLit
                | MapLit
                | SetLit
                | ClosureLit
                | IfExpr
                | MatchExpr
                | BlockExpr
                | ConcurrentBlock ;

FnCall          = ( Ident | QualifiedName ) [ GenericArgs ] "(" [ ArgList ] ")" ;
QualifiedName   = Ident { "." Ident } ;
ArgList         = Arg { "," Arg } ;
Arg             = [ Ident ":" ] Expr ;       // named arguments optional
```

## Control Flow

```ebnf
IfStmt          = "if" Expr Block { "else" "if" Expr Block } [ "else" Block ] ;
IfExpr          = "if" Expr Block { "else" "if" Expr Block } "else" Block ;

MatchStmt       = "match" Expr "{" { MatchArm } "}" ;
MatchExpr       = "match" Expr "{" { MatchArm } "}" ;
MatchArm        = "case" Pattern [ "if" Expr ] "=>" ( Expr | Block ) ;

ForLoop         = "for" ForPattern "in" Expr Block ;
ForPattern      = Ident
                | "(" Ident "," Ident ")" ;

WhileLoop       = "while" Expr Block ;

ConcurrentBlock = "concurrent" "{" Expr { Expr } "}" ;
```

## Patterns

```ebnf
Pattern         = LiteralPattern
                | WildcardPattern
                | BindingPattern
                | EnumPattern
                | StructPattern ;

LiteralPattern  = IntLit | FloatLit | StringLit | BoolLit ;
WildcardPattern = "_" ;
BindingPattern  = Ident ;
EnumPattern     = QualifiedName [ "(" PatternFields ")" ] ;
StructPattern   = Ident "{" PatternFields "}" ;
PatternFields   = PatternField { "," PatternField } ;
PatternField    = Ident [ ":" Pattern ] ;
```

## Literals

```ebnf
Literal         = IntLit
                | FloatLit
                | StringLit
                | BoolLit
                | ListLit
                | MapLit
                | SetLit ;

IntLit          = Digit { Digit | "_" } ;
FloatLit        = Digit { Digit } "." Digit { Digit } [ ( "e" | "E" ) [ "+" | "-" ] Digit { Digit } ] ;
StringLit       = '"' { StringChar | Interpolation } '"'
                | '"""' { StringChar | Interpolation } '"""' ;
BoolLit         = "true" | "false" ;

StringChar      = <any character except '"' and '\'>
                | EscapeSeq ;
EscapeSeq       = "\n" | "\t" | "\\" | '\"' | "\{" | "\u{" HexDigit { HexDigit } "}" ;
Interpolation   = "{" Expr "}" ;

ListLit         = "[" [ Expr { "," Expr } [ "," ] ] "]" ;
MapLit          = "{" [ MapEntry { "," MapEntry } [ "," ] ] "}" ;
MapEntry        = Expr ":" Expr ;
SetLit          = "#{" [ Expr { "," Expr } [ "," ] ] "}" ;

StructLit       = Ident "{" [ StructFieldInit { "," StructFieldInit } [ "," ] ]
                  [ "..." Expr ] "}" ;
StructFieldInit = Ident ":" Expr ;

ClosureLit      = "fn" "(" [ ClosureParams ] ")" [ "->" Type ] Block ;
ClosureParams   = ClosureParam { "," ClosureParam } ;
ClosureParam    = Ident [ ":" Type ] ;
```

## Blocks

```ebnf
Block           = "{" { Statement } [ Expr ] "}" ;
BlockExpr       = Block ;
```

## Assertions (in tests)

```ebnf
AssertStmt      = "assert" Expr
                | "assert_eq" "(" Expr "," Expr ")"
                | "assert_ne" "(" Expr "," Expr ")" ;
```

## Identifiers and Lexical Elements

```ebnf
Ident           = Letter { Letter | Digit | "_" } ;
Letter          = "a".."z" | "A".."Z" | "_" ;
Digit           = "0".."9" ;
HexDigit        = Digit | "a".."f" | "A".."F" ;

Whitespace      = " " | "\t" | "\n" | "\r" ;
LineComment     = "//" { <any character except newline> } ;
BlockComment    = "/*" { <any character> } "*/" ;
```

## Naming Conventions (Enforced by Formatter)

| Element | Convention | Example |
| ------- | ---------- | ------- |
| Variables, functions, parameters | snake_case | `user_name`, `get_user` |
| Types, traits, enums | PascalCase | `User`, `Serializable`, `Shape` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_SIZE`, `PI` |
| Modules (files) | snake_case | `user_auth.hal` |
| Enum variants | PascalCase | `Shape.Circle` |
| Effects | PascalCase | `FileSystem.Read` |
