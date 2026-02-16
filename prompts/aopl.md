Let's build **HAL** (High-level Agentic coding Language) — a programming language designed
specifically for coding agents. The purpose of this language is:

- To make agentic coding as reliable, accurate and productive as possible for coding
  agents.
- To let humans provide high level functional specifications, so coding agents can
  generate the ideal source code for them to understand and manipulate.
- This language should also be scalable, i.e., should allow building large applications,
  and support both back-end (e.g. API servers) and front-end (e.g. Web apps) applications.

This will be the approach: we will progress interactively one step at a time, so I can
review and provide feedback.

1. Establish a set of design principles that guide all subsequent decisions. These
   principles should capture what makes code easy for agents to manipulate: minimal
   ambiguity, uniform syntax, explicit over implicit, strong locality of reasoning, and
   minimal hidden state. Document these in `prompts/design-principles.md`.

2. Create a brief document in `prompts/high-level-design.md`, that describes how this
   programming language would look like, how you would design it and what features would
   you give it.

3. The language is called **HAL** (High-level Agentic coding Language). File extension:
   `.hal`. Interface files: `.hali`.

4. Create a complete language specification document in `prompts/language-spec.md`.

5. Create a `prompts/plan.md` document with a multi-step plan to implement a "compiler"
   from HAL to TypeScript. Let's choose TypeScript initially because it is very portable,
   can run on the web, and has a very large ecosystem / package support.
   - The plan should have multiple incremental phases, implementing different aspects of
     the language. Each phase will have a list of tasks marked using the markdown [ ] /
     [x] notation.
   - We will then follow the plan one phase at a time, stopping at each phase so I can
     validate if it's working and also review the code, potentially requesting some
     changes.
   - Each phase should have extensive code tests to validate it is working as designed.
     Let's use TDD, so for each feature you build the tests first and implement later.
   - The compiler should produce extremely clear, actionable error messages — possibly
     even structured error output (JSON) that agents can parse programmatically, not just
     human-readable text. This should be considered from the earliest phases.

6. We will create an agent-oriented language documentation, so agents learn how to use it
   to generate code with it.

7. Implement a REPL or incremental compilation mode, so agents can test snippets quickly
   and work iteratively, which matches how agentic coding typically operates.

8. At a certain point, we will decide that the HAL to TypeScript compiler is mature enough
   to be self-hosted, i.e., written in its own programming language. Thus, version 2 of
   this HAL to typescript compiler will be implemented in HAL, which will be a great way
   to test the language design. We will then evaluate any issues and potential
   improvements of the language and update its documentation and design if necessary, then
   implement them.

9. Implement a Language Server Protocol (LSP) server for HAL, enabling code intelligence
   (autocomplete, go-to-definition, diagnostics) in editors and for agents that leverage
   LSP.
