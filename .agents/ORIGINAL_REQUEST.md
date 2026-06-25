# Original User Request

## 2026-06-23T23:19:39Z

Implement a robust, integrated, and highly efficient `/loop` command for Zavorth that applies Loop Engineering to refine tasks dynamically and interactively.

Working directory: c:\TESTES DEV\1_PROJETOS_ATIVOS\Zavorth
Integrity mode: development

## Requirements

### R1. Command Parsing & Interactive Session Flow
- **Parser**: Parse inputs starting with `/loop` or routed as `loop` to extract the task description, and check for the presence of `--auto` or `--grill` flags.
- **Menu State**: If no flags are provided, temporarily save the task in the session context, change the session state to `WAITING_FOR_LOOP_MODE`, and prompt the user with a menu to select the mode:
  1️⃣ Automático (`--auto`)
  2️⃣ Guiado (`--grill`)
- **State Interception**: Intercept subsequent messages when the session status is `WAITING_FOR_LOOP_MODE` or `GRILLING`. Respond to `quit`, `exit`, `/reset` by resetting the state.

### R2. Dynamic Guided Intake (`--grill`)
- **Dynamic Questions**: Call `LlmRuntimeService` to generate a dynamic list of questions (between 2 and 5, depending on complexity) to clarify the task's success criteria.
- **Interactive Collection**: Ask the generated questions sequentially (one at a time) and collect responses from the user.
- **Rubric Generation**: Compile all answers and use the LLM to generate a Rubric JSON containing 3 technical success criteria.

### R3. Sandbox Execution & Loop Engine
- **Auto Intake**: If `--auto` is used, generate the 3-criteria Rubric JSON directly from the task description using the LLM.
- **Sandbox Execution**: Execute the task inside a temporary/sandbox file path or environment. If the task involves code, perform a compilation or syntax check.
- **Evaluation (Judge)**: Run the Evaluator (Judge) LLM. It must read the sandbox execution output and the Rubric JSON, giving a grade (1-10) for each criterion, calculating the average, and outputting a structured JSON:
  `{ "notas": { "criterio1": 8, "criterio2": 5 }, "media": 6.5, "ponto_mais_fraco": "criterio2", "critica_construtiva": "..." }`
- **Pivoting & Stop Condition**: If the average is >= 8.0 or iterations hit 5, stop the loop. Otherwise, run the next iteration by feeding the executor the previous result and the critique on the `ponto_mais_fraco`.

### R4. Unified Final Handoff & Memory
- **Single Mutation Plan**: Generate a single, unified Mutation Plan/diff proposal at the very end of the loop, preventing multiple intermediate approval prompts.
- **History Logs**: Print the refined task result along with a history log detailing how the grades evolved iteration-by-iteration.
- **Long-term Memory**: Persist the approved loops and criteria in long-term memory via the `MemoryPlaneService` to prevent future regression.

## Acceptance Criteria

### Execution & Logic Flow
- [ ] Command `/loop` parses flags `--auto` and `--grill` correctly.
- [ ] Guided mode dynamically asks questions one-by-one and transitions cleanly.
- [ ] The Loop Engine runs up to 5 iterations, pivoting focus to the `ponto_mais_fraco`.
- [ ] If average grade is >= 8.0, the loop stops early.
- [ ] The command uses `LlmRuntimeService` to run LLM prompts under the active provider/model.
- [ ] A final evolution summary is logged, showing iteration-by-iteration scores.

---
## Verification Resources

### Automated Tests
- We must implement and pass the test suite: `tests/services/LoopEngineeringService.test.ts`
- Tests must cover:
  1. Parsing of command string and extraction of flags.
  2. State machine transitions from IDLE -> WAITING_FOR_LOOP_MODE -> GRILLING -> EXECUTING_LOOP -> IDLE.
  3. Interactive message interceptions and choices.
  4. Correct iteration count (up to 5) and stop conditions (average >= 8.0).
  5. Mocking of `LlmRuntimeService` output responses.
