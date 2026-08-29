# Zavorth Agent Rules

Permanent invariants for every AI session working in this repository.

## 1. Wiring Verification Gate (mandatory)

No component may be considered "connected" until its **full execution path** is
verified, not just its construction.

Required checks for any newly added pack, tool, or service:

1. **Construction**: the component is instantiated (assembly/factory/bootstrap).
2. **Return**: the instance is returned by the composition/assembly (not only
   constructed inside an unused branch).
3. **Dispatch (the step that was historically skipped)**: the production entry
   point actually passes the component to its dispatcher. A dispatch function
   accepting an optional field does NOT mean the caller provides it.

Concrete invariant: every `*CommandPack` returned by
`SharedSurfaceCommandServiceAssembly` must be passed to
`dispatchSharedSurfaceCommandPacks` / `dispatchSharedSurfaceBuiltinCommand` in
`SharedSurfaceCommandService.maybeHandle`. This is enforced by
`tests/services/SharedSurfaceCommandDispatchWiring.test.ts` — do not bypass it.

## 2. No Test-Only Reachability

A feature is not implemented if it only works when invoked directly from its
unit test. Trace the production caller:

- `SharedSurfaceCommandService.maybeHandle` is the funnel for all shared-surface
  slash commands (every channel/surface, current and future).
- The main conversational agent (`ConversationalAgent`) uses the bootstrap
  `ToolRegistry`/`ToolRuntimeService`; the Echo pipeline
  (`ZavorthEchoService`/`ZavorthEchoOrchestrator`) is a separate tool ecosystem
  used by zavorthControl and voice. Tools registered only in one runtime are not
  available in the other.

## 3. Localization

- The single i18n system is `ZavorthLocalizationService` + catalogs + on-demand
  AI translation. No parallel localization modules.
- User locale flows through `IMessageContext.locale`, resolved canonically by
  `ZavorthUserLocalePreferenceService` at `SharedSurfaceCommandService`.
  Surface-agnostic: gateways feed the signal, the shared system resolves it.

## 4. Honesty

- No simulated, faked, or imaginary results. Verified claims only, based on
  source inspection.
- No dead code: components registered in a runtime that is never instantiated
  are dead code.
