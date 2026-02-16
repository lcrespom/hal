Let's build a programming language designed specifically for coding agents. The purpose of
this language is:

- To make agentic coding as reliable, accurate and productive as possible for coding
  agents.
- To let humans provide high level functional specifications, so coding agents can
  generate the ideal source code for them to understand and manipulate.
- This language should also be scalable, i.e., should allow building large applications,
  and support both back-end (e.g. API servers) and front-end (e.g. Web apps) applications.

This will be the approach: we will progress interactively one step at a time, so I can
review and provide feedback.

1. Ceate a brief document in `prompts/high-level-design.md`, that describes how this
   programming language would look like, how you would design it and what features would
   you give it.

2. Let's decide on a catchy name for it. For now, we will call it ACOPL: agentic coding
   oriented programming language.

3. Create a proper formal design document in `prompts/design.md`.

4. Create a `prompts/plan.md` document with a multi-step plan to implement a "compiler"
   from ACOPL to TypeScript. I choose TypeScript initially because it is very portable,
   can run on the web, and has a very large ecosystem / package support. The plan should
   have multiple incremental phases, implementing different aspects of the language. Each
   phase will have a list of tasks marked using the markdown [ ] / [x] notation. We will
   then follow the plan one phase at a time, stopping at each phase so I can validate if
   it's working and also review the code, potentially requesting some changes. Each phase
   should have extensive code tests to validate it is working as designed. Let's use TDD,
   so for each feature you build the tests first and implement later.

5. We will create an agent-oriented language documentation, so agents learn how to use it
   to generate code with it.

6. At a certain point, we will decide that the ACOPL to TypeScript compiler is mature
   enough to be self-hosted, i.e., written in its own programming language. Thus, version
   2 of this ACOPL to typescript compiler will be implemented in ACOPL, which will be a
   great way to test the language design. We will then evaluate any issues and potential
   improvements of the language and update its documentation and design if necessary, then
   implement them.

What do you think of this plan? Would you like to add anything?
