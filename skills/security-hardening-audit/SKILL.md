---
name: security-hardening-audit
description: Audits codebases for security risks, hardcoded secrets, injection vectors, and compliance against MITRE ATT&CK and NIST frameworks.
---

# Security Hardening & Vulnerability Audit Skill

Use this skill when auditing source code, API gateways, dependency chains, or configuration files for security vulnerabilities.

## Core Security Verification Steps

### 1. Hardcoded Secret & Token Detection
- Scan source code for raw API keys, bearer tokens, passwords, and private certificates.
- Ensure all secrets are loaded exclusively via environment variables or secure key vaults.

### 2. Injection Vector Analysis
- Verify that SQL queries, OS command executions, and shell subprocess calls use parameterized inputs.
- Check for unsanitized user inputs passed to `eval()`, `exec()`, or dynamic function invocations.

### 3. Access Control & Authorization Gates
- Ensure API endpoints and gateway routes enforce explicit authentication and role-based access checks.
- Confirm fail-closed behavior on unauthorized requests (HTTP 401/403).

### 4. Dependency & Package Auditing
- Verify third-party dependencies against known CVE databases.
- Ensure lockfiles (`package-lock.json`, `pnpm-lock.yaml`) are pinned to trusted releases.

## Output Format

When performing an audit, output a structured report containing:
- **Risk Rating**: (Critical, High, Medium, Low)
- **Vulnerability Description**
- **Affected File & Line Number**
- **Remediation Code Fix**
