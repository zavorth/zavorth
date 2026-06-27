# Zavorth Gap Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the concrete product-readiness gaps found during repository analysis: empty MCP manifest, catalog/runtime mismatch, documentation/license inconsistency, and stale readiness signals.

**Architecture:** Keep Zavorth's existing governed model: catalog entries may be discoverable, but executable MCP routes must be explicit manifest entries and disabled until reviewed. Use existing manifest loading, registry projection, and docs instead of introducing new runtime abstractions.

**Tech Stack:** TypeScript, Jest, JSON manifests, Markdown docs, PowerShell/npm scripts.

---

## File Structure

- Modify `tests/mcp/McpManifest.test.ts`: add a regression test that loads the real `config/mcp-servers.json` and proves the local catalog has explicit MCP candidates.
- Modify `config/mcp-servers.json`: add governed MCP candidates for filesystem, reasoning, and Playwright with `enabled: false` by default.
- Modify `config/platform-registry.json`: align MCP entries from `planned/partial` discovery wording to local manifest-backed review wording.
- Modify `config/marketplace-index.json`: stop reporting every marketplace category as empty by reflecting current native/workspace skill sources as a seeded local catalog.
- Modify `README.md`: remove the proprietary claim and align with MIT package/license metadata.
- Modify `docs/capabilities-and-plugins.md`: document the new distinction between catalogued, manifest-backed disabled, and enabled MCP tools.

## Tasks

### Task 1: MCP Manifest Regression

**Files:**
- Modify: `tests/mcp/McpManifest.test.ts`
- Verify: `npx jest tests/mcp/McpManifest.test.ts --runInBand`

- [ ] **Step 1: Write the failing test**

Add a test that loads `config/mcp-servers.json` through `McpManifestLoader` and expects `filesystem`, `reasoning`, and `playwright` to exist as disabled candidates.

- [ ] **Step 2: Run test to verify it fails**

Run `npx jest tests/mcp/McpManifest.test.ts --runInBand`.

Expected before the manifest change: the test fails because the real manifest is empty.

- [ ] **Step 3: Add governed manifest entries**

Add disabled MCP candidates with explicit command, args, capability, env, and allowed env keys. Keep `enabled: false` so no external MCP executes by default.

- [ ] **Step 4: Run test to verify it passes**

Run `npx jest tests/mcp/McpManifest.test.ts --runInBand`.

Expected after the manifest change: both manifest tests pass.

### Task 2: Registry And Marketplace Alignment

**Files:**
- Modify: `config/platform-registry.json`
- Modify: `config/marketplace-index.json`
- Verify: `node -e "JSON.parse(require('fs').readFileSync('config/platform-registry.json','utf8')); JSON.parse(require('fs').readFileSync('config/marketplace-index.json','utf8')); console.log('ok')"`

- [ ] **Step 1: Align MCP registry text**

Update MCP entries so the registry no longer implies there is no local manifest. Use `partial` readiness for disabled-but-declared entries and `review` trust for candidates that need an operator decision.

- [ ] **Step 2: Seed marketplace counts**

Update category `skillCount` values from zero to reflect the local skill surface that already exists in `skill-library` and `.agents/skills`.

- [ ] **Step 3: Validate JSON**

Run the JSON parse command above.

### Task 3: License And Product-Readiness Docs

**Files:**
- Modify: `README.md`
- Modify: `docs/capabilities-and-plugins.md`
- Verify: `Select-String -LiteralPath README.md -Pattern 'proprietary'`

- [ ] **Step 1: Fix README license wording**

Replace the proprietary runtime claim with MIT/open local-first wording consistent with `package.json` and `LICENSE`.

- [ ] **Step 2: Document MCP readiness lifecycle**

Explain that catalogued means discoverable, manifest-backed disabled means configured but not executable, and enabled means allowed by manifest plus policy/approval.

- [ ] **Step 3: Verify no stale proprietary claim remains**

Run `Select-String -LiteralPath README.md -Pattern 'proprietary'`; expected output is empty.

### Task 4: Verification And Residual Gap Triage

**Files:**
- Read: `tsc-errors.txt`
- Verify: `node .\bin\zavorth.js --version`
- Verify: `node .\bin\zavorth.js --help`
- Verify: targeted Jest command from Task 1

- [ ] **Step 1: Run targeted tests**

Run `npx jest tests/mcp/McpManifest.test.ts --runInBand`.

- [ ] **Step 2: Run CLI smoke**

Run `node .\bin\zavorth.js --version` and `node .\bin\zavorth.js --help`.

- [ ] **Step 3: Triage typecheck gap**

Inspect whether `tsc-errors.txt` is stale or still reproducible with the repo's intended check command. Report exact residual status without claiming full release readiness if broad checks still fail.
