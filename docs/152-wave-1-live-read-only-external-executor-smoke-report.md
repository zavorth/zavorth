# Wave 1 Live Read-Only External Executor Smoke Report

Status: wave-1-live-read-only-external-executor-smoke-degraded

Source plan: docs/151-wave-1-live-read-only-external-executor-probe.md

Historical WSL path observed: `/home/grey/.local/bin/external-executor`

Observed version: ExternalExecutor 2026.4.26 (c7d77f8)

Result summary: `help:ok`, `version:ok`, `status:timeout`, `health:failed`, `capabilities:unavailable`

| Check | Value |
| --- | --- |
| Health status | `degraded` |
| capabilities plural is unavailable and was not executed | true |
| sidecarProcessStarted: false | true |
| mutableHttpOrWebSocketOpened: false | true |
| externalToolExecuted: false | true |
| sourceModulesCopied: false | true |
| adapterRemoved: false | true |

Conclusion: no real adapter is authorized. This evidence does not grant live event stream or mutation execution.

