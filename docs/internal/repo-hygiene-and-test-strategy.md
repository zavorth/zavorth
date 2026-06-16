# Repository Hygiene & Test Strategy

This document defines the official policies and guidelines for repository hygiene, documentation management, and testing strategy for Zavorth. It serves as the durable reference to prevent file sprawl, protect intellectual property, and maintain codebase quality.

---

## 1. Documentation Hierarchy

To ensure that the repository remains clean and organized, all documentation files are classified into the following four categories:

### A. Public Documentation (User-facing)
*   **Path**: `docs/public/` or `docs/user/`.
*   **Purpose**: Help files, guides, tutorials, command reference sheets, and troubleshooting manuals intended for end-users and operators of Zavorth.
*   **Hygiene Rule**: Must never leak internal phase names, development history, internal beta plans, local testing logs, or raw build manifest details.

### B. Internal Product & Architecture Documentation
*   **Path**: `docs/internal/`, `docs/architecture/`, and `docs/security/`.
*   **Purpose**: Architectural design blueprints, data model specifications, risk classifier designs, security threat models, and repository hygiene strategy guides.
*   **Hygiene Rule**: Focus on durable designs and security boundaries rather than specific delivery phases or temporary development tasks.

### C. Temporary Project Artifacts (Excluded)
*   **Purpose**: Scratch files, daily tasks, test logs, search results, and workspace notes (e.g. `task.md`, `walkthrough.md`, `verification_report.md`, `scratch/`, `tmp/`).
*   **Hygiene Rule**: **Must never be tracked in Git.** They must reside in ignored local paths.

### D. Release & Package Documentation
*   **Path**: Root files (`README.md`, `CHANGELOG.md`) and package-specific docs.
*   **Purpose**: Declaring release versions, installation prerequisites, and library usage guidelines.

---

## 2. Test Strategy

Zavorth's testing strategy relies on code-driven assertions rather than validating documentation text:

*   **Permanent Tests**: Unit tests, integration tests, E2E flow tests, and security/governance tests that validate real codebase behavior (e.g., verifying that the tool gatekeeper correctly blocks a command or that risk evaluation policies are enforced).
*   **Hygiene Tests**: Automated scripts that verify repository hygiene (e.g., ensuring no temporary files are tracked and no phase-specific naming leaks exist in public-facing documentation).
*   **Retired Tests**: Tests checking the presence or exact wording of temporary phase report files are deprecated and retired.

---

## 3. Secret Scanning Strategy

To protect credentials and sensitive tokens, Zavorth uses a structured, automated scanning model:

*   **Configuration**: High-confidence detection rules are defined in `.gitleaks.toml`.
*   **Continuous Integration**: CI runs Gitleaks checks on all pull requests and commits to prevent credential ingestion.
*   **Pre-Commit Hook**: Developers are encouraged to run Gitleaks locally or wire it via a git pre-commit hook (e.g. Husky) to intercept leaks before they reach Git.
*   **Local Grep Fallback**: A script-based fallback using ripgrep or search utilities is maintained for quick local verification when Gitleaks is not available in the local execution environment.

---

## 4. Build/Release Manifest Strategy

Release manifests and artifact details must follow structured, programmatically verifiable strategies:

*   **Structured JSON**: Release metadata, artifact targets, and SHA-256 checksums must be recorded in structured JSON manifests (e.g., `release-manifest.json`), rather than compiled in Markdown checklists.
*   **Automation**: Release scripts must calculate file sizes and cryptographic checksums dynamically during the packaging process, preventing manual documentation drift.

---

## 5. Public Package Exclusion Policy

To prevent internal documents, logs, and development configurations from leaking into npm packages, PyPI distributions, or desktop bundles, the packaging systems must enforce the following exclusions:

*   **Excluded Directories**:
    *   `docs/internal/`
    *   `docs/beta/`
    *   `docs/roadmap/`
    *   `scratch/`
    *   `tmp/`
    *   `.phase/`
*   **Excluded Files**:
    *   `task.md`
    *   `walkthrough.md`
    *   `verification_report.md`
    *   `proof_*.txt`
    *   `grep_*.txt`
    *   `implementation_plan.md`
*   **Enforcement**: Ensure these directories and patterns are defined in `.npmignore`, the `files` array of `package.json`, or the workspace bundle configurations.
