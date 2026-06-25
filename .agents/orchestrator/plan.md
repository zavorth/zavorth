# Plan: Implement `/loop` command

## Milestones

### Milestone 1: Command Registration and Parsing
- Update `src/contracts/ZavorthSmartCommandSurfaceContract.ts` to include `'loop'` in `ZavorthSmartCommandId`.
- Update `src/services/ZavorthSmartCommandSurfaceService.ts` to recognize `/loop` and parse `--auto` and `--grill` flags.
- Register `/loop` alias and routing in `src/cli/ZavorthCliRegistry.ts` (routing both `/loop` and `loop`).

### Milestone 2: Loop State Machine and Service
- Create `src/services/LoopEngineeringService.ts` to handle:
  - State storage (in-memory per session or registry-based).
  - Transitions: `IDLE -> WAITING_FOR_LOOP_MODE -> GRILLING -> EXECUTING_LOOP -> IDLE`.
  - Question generation & collection.
  - Rubric generation.
  - Sandbox execution & Evaluation Loop (up to 5 iterations).
  - Memory persistence via `MemoryPlaneService`.

### Milestone 3: LLM Integration (LlmRuntimeService)
- Design and implement LLM prompts:
  - Question generator (2-5 questions depending on task complexity).
  - Rubric generator (JSON with 3 criteria).
  - Evaluator/Judge (grade 1-10, construct JSON with scores, average, ponto_mais_fraco, critique).
  - Executor (refining code based on previous result and critique).

### Milestone 4: Test Suite and Verification
- Implement `tests/services/LoopEngineeringService.test.ts` covering:
  - Command parsing and flag extraction.
  - State machine transitions.
  - Interactive message interception and choices.
  - Correct iteration counting and early stopping (avg >= 8.0).
  - Mocks for LLM calls.

## Verification Command
`npm test tests/services/LoopEngineeringService.test.ts`
