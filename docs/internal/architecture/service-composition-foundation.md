# Service Composition Foundation

Zavorth uses a limited service composition foundation to decouple service instantiation from service usage, enabling clean boundary testing and structured startup sequences.

---

## Why the Registry Exists
As Zavorth grows, direct instantiation of singletons within constructors or lifecycle boot modules makes the codebase tightly coupled and difficult to test in isolation. The `ServiceRegistry` provides a central, type-safe registry to store and resolve stable core services, enabling mock injection during automated testing without affecting global state.

---

## Why It Is Limited (Not a Service Locator)
To prevent the registry from becoming an anti-pattern (such as an uncontrolled, globally-exposed Service Locator that encourages spaghetti dependency passing), the composition design enforces strict boundaries:
1.  **Controlled Bootstrapping**: Services are registered only during the system bootstrap phase inside `ServiceCompositionRoot`. Component classes must not dynamically register instances during runtime execution.
2.  **Explicit Typed Tokens**: Arbitrary string keys are prohibited. Resolution is restricted to explicit `ServiceToken<T>` instances defined in `ServiceTokens.ts`.
3.  **No Dynamic Token Creation**: Extension scripts or external packages cannot construct tokens dynamically to register/request arbitrary objects.

---

## Service Registration Rules

### Allowed Services
Only stable, non-secret-bearing, and low-risk singleton utility services are allowed to be registered.
*   **Example**: `SecurityAuditLogger` (stable, local, stateless logging manager).

### Forbidden Services
The following types of services must **never** be registered in the service container:
*   **Provider Secret Stores**: Any service that decrypts, stores, or manages raw provider keys (e.g. OpenAI/Anthropic API keys).
*   **Active Databases**: Database clients carrying live credentials or active network streams.
*   **Ephemeral Runtime State**: Live PTY sessions, HPM executors, and active command execution states.
*   **Cloud/Remote Clients**: S3/R2 synchronizers or remote deployment adapters that connect to external services during initialization.

---

## Known Token Policy
Every registered service must map to a unique symbol defined strictly within `ServiceTokens.ts`. At runtime, the registry validates each incoming token object against this known list. Any forged, fake, or dynamically created token object is immediately rejected to prevent unauthorized service exposure or registration spoofing.

---

## Test Reset Behavior
To prevent state leakage between separate unit tests, the registry and composition root expose a `resetForTests()` helper. To prevent misuse in production:
*   `resetForTests()` verifies the environment variables and throws an error if `process.env.NODE_ENV !== 'test'`.
*   In test suites, `resetForTests()` must be called in `beforeEach` or `afterEach` hooks to guarantee container isolation.

---

## Future Migration Rules
When migrating existing legacy singletons to this composition foundation:
1.  Define a new token inside `ServiceTokens.ts` with its corresponding TypeScript interface type.
2.  Add its constructor validation checks to ensure it does not import raw secrets or trigger asynchronous side effects at boot.
3.  Register it inside `ServiceCompositionRoot.ts`.
4.  Update the resolution path in consumers from direct instantiation (`new Service()`) to `ServiceRegistry.get(...)`.
