# Zavorth Product Experience Principles

This document defines design and usability guidance for Zavorth interfaces, keeping Desktop UI, CLI, and agent outputs consistent.

## Core Principles

### 1. Safe by default

Dangerous privileges such as Developer Mode, Host Power Mode, PTY, Temporary Directory Trust, and risky fallbacks must be disabled by default.

The interface must never encourage unsafe activation automatically or without friction.

### 2. Clarity before execution power

The user should know what is happening. Prefer legible explanations of the agent's current operating limit over complex decision logs.

Readiness and risk assessment should be visible and current in the dashboard.

### 3. Risk stays visible

Any flow involving HPM, PTY, or writes outside the trusted workspace requires prominent approval cards that describe the command/action, scope, and time boundary.

### 4. No exposed secrets

API tokens, HTTP auth headers, local database passwords, and raw provider request headers must never appear in the GUI, CLI, or error logs.

Stored credentials must be represented only by configured status.

### 5. Friendly errors with recovery

Unhandled exceptions and raw network/database errors must not be shown to end users. Captured errors pass through unified normalization and provide:

- identifier: readable friendly code, such as `missing_key`;
- explanation: human-readable description;
- recommended action: clear recovery guidance.

### 6. Onboarding cockpit and next steps

The initial interface should welcome new users and guide onboarding without forcing dangerous automatic commands:

1. Choose a workspace.
2. Connect providers and channels.
3. Choose the default model/provider route.
4. Check agent readiness.
