# Zavorth Developer Guide

This guide explains how to extend Zavorth with new providers, skills, channels, and commands.

## Quick Start

### Adding a Provider (OpenAI-compatible)

If your provider uses the OpenAI API format (most do), just add environment variables:

```bash
# .env
MYPROVIDER_API_KEY=sk-your-key-here
MYPROVIDER_BASE_URL=https://api.myprovider.com/v1
MYPROVIDER_MODEL=default-model-name
```

Then use it:
```bash
zavorth model myprovider
```

No code changes needed. The runtime auto-detects OpenAI-compatible providers from environment variables.

### Adding a Provider (Custom SDK)

For providers with their own SDK or non-standard API:

**Step 1**: Create the plugin file:

```typescript
// src/providers/plugins/myprovider.plugin.ts
import type { ProviderPlugin } from './ProviderPluginManifest.js';

const myproviderPlugin: ProviderPlugin = {
  manifest: {
    name: 'myprovider',
    aliases: ['mp'],
    description: 'My Custom Provider',
    authType: 'api_key',
    envVars: ['MYPROVIDER_API_KEY'],
    baseUrl: 'https://api.myprovider.com/v1',
    defaultModel: 'model-v1',
  },
  create: (target) => {
    // Implement your provider here
    return {
      name: 'myprovider',
      async chat(messages, tools, options) {
        // Call your API and return LlmResponse
        return {
          content: 'response',
          toolCalls: [],
          finishReason: 'stop',
        };
      },
    };
  },
};

export default myproviderPlugin;
```

**Step 2**: Set your API key in `.env`:
```bash
MYPROVIDER_API_KEY=your-key
```

**Step 3**: Restart Zavorth. The plugin is auto-discovered from the `plugins/` directory.

### Adding a Skill

Skills are instruction sets that teach Zavorth how to perform specific tasks.

**Step 1**: Create a directory in `skill-library/`:
```bash
mkdir skill-library/my-skill
```

**Step 2**: Create `SKILL.md` with frontmatter:
```markdown
---
name: my-skill
description: Does something useful
---

# My Skill

## Instructions

When the user asks you to do X, follow these steps:

1. First do this
2. Then do that
3. Finally do this
```

**Step 3**: The skill is auto-discovered. No restart needed.

### Using the Scaffold Command

Zavorth includes built-in scaffolding:

```bash
# Generate a provider plugin
zavorth scaffold provider myprovider --base-url=https://api.example.com/v1 --model=v1

# Generate a skill
zavorth scaffold skill my-skill --description="Does something useful"
```

---

## Provider System

### Architecture

```
ProviderFactory.create("name")
  ├─> ProviderRegistry.resolve("name")
  │    └─> finds plugin by name or alias
  ├─> plugin.create(target)
  │    └─> returns ILlmProvider instance
  └─> wraps with EgressGuard + caches
```

### Provider Plugin Manifest

```typescript
interface ProviderPluginManifest {
  name: string;           // Canonical name (e.g., "deepseek")
  aliases?: string[];     // Alternative names (e.g., ["ds"])
  description?: string;   // Human-readable description
  envVars?: string[];     // Required environment variables
  baseUrl?: string;       // Default API base URL
  authType?: 'api_key' | 'oauth' | 'aws_credentials' | 'none';
  defaultModel?: string;  // Default model name
}
```

### ILlmProvider Interface

Every provider must implement this interface:

```typescript
interface ILlmProvider {
  readonly name: string;

  chat(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
    options?: ProviderChatOptions,
  ): Promise<LlmResponse>;

  streamChat?(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
    options?: ProviderChatOptions,
  ): AsyncIterable<LlmStreamEvent>;
}
```

### Types

```typescript
interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | null;
  toolCallId?: string;
  toolName?: string;
  toolCalls?: ToolCall[];
}

interface LlmResponse {
  content: string | null;
  toolCalls: ToolCall[];
  finishReason: string;
  metadata?: Record<string, unknown>;
}
```

---

## Skill System

### How Skills Work

1. Skills are discovered from `skill-library/` directories
2. Each skill has a `SKILL.md` file with YAML frontmatter
3. The `SkillRouter` matches user requests to skills using heuristics
4. Skills are injected into the agent's context as instructions

### Skill Frontmatter

```yaml
---
name: my-skill
description: Short description of what this skill does
---
```

### Skill Content Structure

```markdown
---
name: code-review
description: Reviews code for security vulnerabilities
---

# Code Review

## When to Use

Activate this skill when the user asks for:
- Code review
- Security audit
- Vulnerability scan

## Instructions

1. Read the target file
2. Check for SQL injection vulnerabilities
3. Check for XSS vulnerabilities
4. Check for authentication bypass
5. Report findings with severity levels
```

---

## Command System

### How Commands Work

Commands are dispatched through a chain of handlers:

```
ZavorthCliRegistry
  ├─> Experience commands (home, ask, run, learn)
  ├─> Dashboard commands (dashboard, control)
  ├─> Connector commands (connectors, start, demo)
  ├─> Command families (ops, sessions, nodes, platform, tasks)
  ├─> Scaffold commands (scaffold provider, scaffold skill)
  └─> Natural language fallback
```

### Adding a Command Family

**Step 1**: Create `ZavorthCliRegistryMyFamily.ts`:

```typescript
import type { ZavorthCliFlags, CliExecutionResult, CliWriter } from './ZavorthCliContract.js';

type RegistryCommandParams = {
  effectiveFlags: ZavorthCliFlags;
  commandName: string | null;
  args: string;
  writer: CliWriter;
};

export async function handleZavorthCliRegistryMyFamilyCommand(
  params: RegistryCommandParams,
): Promise<CliExecutionResult | null> {
  const { commandName, args, writer } = params;

  if (commandName === 'my-command') {
    const body = `Running my command with args: ${args}`;
    writer.line(body);
    return { ok: true, handled: true, output: [body], error: null };
  }

  return null; // Not handled by this family
}
```

**Step 2**: Register in `ZavorthCliRegistry.ts`:

```typescript
import { handleZavorthCliRegistryMyFamilyCommand } from './ZavorthCliRegistryMyFamily.js';

// In the dispatch chain:
const myResult = await handleZavorthCliRegistryMyFamilyCommand({
  effectiveFlags,
  commandName,
  args,
  writer,
});
if (myResult) {
  return myResult;
}
```

---

## SDK

### Public API

The public SDK exports what external developers need:

```typescript
import { version, contracts, capabilities, pluginOs } from 'zavorth/sdk';
```

### Internal API

Internal services are available for Zavorth's own use:

```typescript
import { SomeInternalService } from 'zavorth/sdk/internal';
```

---

## Configuration

### Environment Variables

Key configuration variables:

```bash
# Provider
GEMINI_API_KEY=...
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...

# Channels
TELEGRAM_BOT_TOKEN=...
DISCORD_BOT_TOKEN=...

# Runtime
ZAVORTH_HOME_DIR=~/.zavorth
ZAVORTH_DB_PATH=~/.zavorth/data/zavorth.db
```

### Runtime Profiles

Zavorth supports different runtime profiles:

- `personal` - Simple local setup
- `governed` - Full policy enforcement

---

## Testing

### Running Tests

```bash
npm test                    # All tests
npm test -- --grep "provider"  # Provider tests only
```

### Writing Tests

```typescript
import { ProviderFactory } from '../src/providers/ProviderFactory.js';

describe('MyProvider', () => {
  it('should instantiate from plugin', async () => {
    const provider = await ProviderFactory.create('myprovider');
    expect(provider.name).toBe('myprovider');
  });
});
```

---

## QA Checkers

QA checkers are registered validations that the workspace CI runs to enforce repository standards. The registry lives in `scripts/registry/checks.json`.

### Running the Registry

```bash
npm run qa:check -- --list                  # List all 377 registered checks
npm run qa:check -- <checker-id>            # Run a single check by id
npm run qa:check                            # Run all checks
```

### Adding a New Checker

1. Create a checker script at `scripts/<area>/<name>-check.mjs` (or `.ts`). The script must exit `0` on pass and non-zero on fail.
2. Add an entry to `scripts/registry/checks.json`:
   ```json
   {
     "id": "zavorth:my-checker",
     "name": "My Checker",
     "command": "node scripts/my-check.mjs",
     "category": "quality",
     "severity": "error"
   }
   ```
3. Add a matching `npm` script in `package.json` (e.g. `qa:my-checker`) for direct invocation.
4. Verify the registration: `npm run qa:check -- --list | grep my-checker`.

### Checker Conventions

- One checker = one focused invariant. Do NOT combine multiple concerns in a single script.
- Use descriptive ids prefixed with the owning area (`zavorth:`, `runtime:`, `security:`, `purity:`).
- Output MUST be plain text or JSON — no colored output, no progress bars.
- Exit code `0` = pass, `1` = fail. Other codes are reserved for system errors.
- A checker must be hermetic — no network, no external services, no side effects.

### Maintenance

The registry is the single source of truth for which checkers exist. If you delete a checker script, remove its registry entry in the same commit.

---

## Regex Hygiene Lint

Zavorth enforces that regex literals MUST NOT contain `...` as a sentinel placeholder. The `...` pattern is a known artifact of a defective automated transformation that substituted quantifiers (`.*`, `.*?`, `+`, `?`, `{n,m}`) with `...`. The lint script detects these in `.ts` and `.mjs` files.

### Running the Lint

```bash
node scripts/lib/lint-regex.mjs                    # Scan src/ for corrupted regex
node scripts/lib/lint-regex.mjs && echo "PASS"      # CI-friendly form
```

The script only inspects content inside regex literals (`/.../`) and ignores JavaScript spread syntax (`...`) and ellipsis in user-facing strings.

### Fixing a Flagged Pattern

When the lint flags a regex, replace `...` with the correct quantifier:

| Sentinel | Correct quantifier | Use case |
|---|---|---|
| `(?:\.exe)...\s+` | `(?:\.exe)?\s+` | Optional `.exe` |
| `[a-z]:\...` | `[a-z]:\\.*` | Windows root path |
| `[\s\S]*...` | `[\s\S]*?` | Lazy any-char match |
| `secrets...` | `secrets.*` | Greedy path segment |
| `\r...\n` | `\r?\n` | CRLF normalization |

### When to Skip

The script intentionally does NOT flag:

- Spread syntax (`...spread`) in arrays or function calls.
- Ellipsis in user-facing strings (UI messages, logs).
- Template literal spread (`${...value}`).

If you believe a flagged regex is legitimate, refactor the pattern to avoid `...` rather than suppressing the lint.

### Pre-commit Integration (recommended)

The optional pre-commit hook at `scripts/hooks/pre-commit-check.mjs` runs the lint against staged files only. It is **opt-in** — no automatic installation — to respect the principle that repository configuration changes must be deliberate.

**Install (one of two ways):**

```bash
# Option A: symlink into .git/hooks/
ln -sf ../../scripts/hooks/pre-commit-check.mjs .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

```bash
# Option B: redirect hooksPath
git config core.hooksPath scripts/hooks
# Then rename the file:
mv scripts/hooks/pre-commit-check.mjs scripts/hooks/pre-commit
```

**Bypass when needed:**

```bash
git commit --no-verify
```

**What it checks:**

- Only **staged** `.ts` and `.mjs` source files (skips tests)
- Regex literal sentinel `...` patterns
- Pre-existing corruptions in unstaged files are NOT flagged — run `node scripts/lib/lint-regex.mjs` directly to audit the whole codebase.

## Troubleshooting

### Provider not found

1. Check that your plugin file ends with `.plugin.ts`
2. Verify the `manifest.name` matches what you're passing to `ProviderFactory.create()`
3. Check the logs for plugin loading errors

### Skill not activating

1. Ensure `SKILL.md` has valid YAML frontmatter
2. Check that the skill directory is under `skill-library/`
3. Verify the `name` and `description` fields are set

### Command not working

1. Check that your handler returns `null` when it doesn't handle the command
2. Verify the handler is registered in the dispatch chain
3. Check for typos in `commandName` comparisons
