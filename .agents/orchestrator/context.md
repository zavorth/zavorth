# Context: Implementing the `/loop` command

## Objective
Implement a robust, integrated, and highly efficient `/loop` command for Zavorth that applies Loop Engineering to refine tasks dynamically and interactively.

## Key Services and Entities
- `LoopEngineeringService`: A new service in `src/services/llm/LoopEngineeringService.ts` (or `src/services/LoopEngineeringService.ts`) to orchestrate the loop state machine.
- `LlmRuntimeService`: The existing service at `src/services/llm/LlmRuntimeService.ts` used to generate questions, JSON rubrics, evaluate iterations, and critique.
- `MemoryPlaneService`: The existing service at `src/services/ZavorthMemoryPlaneService.ts` to persist loops and criteria.
- `ZavorthSmartCommandSurfaceService`: To parse and route `/loop` inputs and check flags.
- `ZavorthCliRegistry`: To intercept/route `loop` messages from CLI/repl.

## Current State
- No `LoopEngineeringService` exists.
- `/loop` is not in `ZavorthSmartCommandSurfaceService`.
- No tests for LoopEngineeringService.
