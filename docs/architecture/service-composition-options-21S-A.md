# Service Composition Options - Phase 21S-A

> [!IMPORTANT]
> This is a design-only document for Phase 21S-A. No runtime implementation is performed in this phase.

## Comparison of Dependency Management Options

### Option 1: Explicit Dependency Injection (DI)
*   **Description**: Dependencies are passed explicitly to constructors or functions during instantiation (e.g., `constructor(logger: SecurityAuditLogger, policy: PolicyService)`).
*   **Benefits**: Clear dependency tree, compile-time type safety, zero runtime overhead.
*   **Risks**: Boilerplate code scales poorly as the dependency graph grows, resulting in long constructor signatures.
*   **Impact on Testability**: High. Mock dependencies are easily injected during test setup.
*   **Impact on Security**: Outstanding. Object references are passed locally; no global registry exists to leak handles.
*   **Impact on Auditability**: High. Callers and dependencies are statically traceable.
*   **Migration Cost**: Moderate. Requires refactoring static `new` calls into constructor arguments.
*   **Failure Modes**: Compile-time errors due to missing arguments.
*   **Recommended Use Cases**: Core utility services and stateless domain logic.

---

### Option 2: Controlled Composition Root
*   **Description**: A single entry point in the application (the composition root) instantiates all services, wires them together, and starts the runtime.
*   **Benefits**: Centralized dependency management, no global service locator pollution, high maintainability.
*   **Risks**: The boot module can become large; requires careful separation of concern during setup.
*   **Impact on Testability**: High. Tests can instantiate subsets of the graph from custom sub-roots.
*   **Impact on Security**: High. Object boundaries are fully maintained; no runtime modification of the graph is possible.
*   **Impact on Auditability**: High. All services are initialized in a single file, making the dependency graph auditable.
*   **Migration Cost**: Moderate to High. Requires moving all initialization logic to a centralized boot phase.
*   **Failure Modes**: Startup failures due to initialization order issues.
*   **Recommended Use Cases**: Highly recommended for the main application startup phase.

---

### Option 3: Limited Service Registry
*   **Description**: A localized, read-only registry where services are registered explicitly with unique, known names, and can be retrieved by core modules.
*   **Benefits**: Reduces dependency wiring boilerplate while keeping registration controlled and auditable.
*   **Risks**: Introduces runtime lookups; potential for name clashes if keys are not managed properly.
*   **Impact on Testability**: Very High. Tests can reset the registry or load mocked instances for isolated runs.
*   **Impact on Security**: Good. Explicit registration prevents runtime tampering, and secret-bearing objects can be filtered.
*   **Impact on Auditability**: Good. Registration events can be verified at boot time.
*   **Migration Cost**: Low. Minimal changes are needed for existing callers.
*   **Failure Modes**: Runtime errors if a service is requested before registration.
*   **Recommended Use Cases**: Highly recommended for modular platform services.

---

### Option 4: Full Service Locator (Global / Uncontrolled)
*   **Description**: A global singleton registry that allows any class to register, overwrite, or retrieve any service instance dynamically at runtime.
*   **Benefits**: Maximum flexibility; zero wiring boilerplate.
*   **Risks**: Hides dependencies, risks silent overwrites, exposes sensitive objects, and introduces concurrency bugs.
*   **Impact on Testability**: High risk of state leaks across tests unless carefully reset.
*   **Impact on Security**: Poor. Unchecked runtime mutations could allow a malicious extension to hijack a core service.
*   **Impact on Auditability**: Poor. Hard to audit who registered or modified a service at runtime.
*   **Migration Cost**: Low.
*   **Failure Modes**: Silent hijacking, runtime resolution errors, state contamination.
*   **Recommended Use Cases**: Not recommended.

---

## Architectural Recommendation

Zavorth recommends a combination of a **Controlled Composition Root** for startup initialization and a **Limited Service Registry** for modular runtime services. We explicitly avoid a global, uncontrolled Service Locator.

The future Limited Service Registry must satisfy these safety invariants:
1.  **Explicit Registration**: Services must be registered programmatically during the boot phase; auto-discovery of untrusted classes is forbidden.
2.  **Known Service Names**: Keys must use typed strings or symbols (no arbitrary string keys).
3.  **Test Reset/Isolation**: The registry must support a clean `.reset()` hook to wipe state between test runs.
4.  **No Silent Overwrites**: Attempting to register a service under an existing key will trigger a boot error instead of silently replacing the instance.
5.  **No Runtime Mutation**: The registry is locked after boot; no runtime registration is allowed.
6.  **No Secret Exposure**: Secret-bearing or critical host-executing services must not be exposed to untrusted capabilities or extensions.
