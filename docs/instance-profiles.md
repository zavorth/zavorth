# Instance Profiles

Zavorth supports multiple isolated runtime instances, allowing you to run separate configurations for different use cases (e.g., personal vs. work) from the same codebase.

## Concept

Each instance has its own:
- **Database** — SQLite with sessions, memory, and state
- **Config** — provider keys, channel settings, preferences
- **Memory** — MEMORY.md, IDENTITY.md, SOUL.md, USER.md
- **Credentials** — API keys and tokens
- **Logs** — separate log files per instance
- **Skills** — installed skills per instance

Instances share the same codebase but are completely isolated in state.

## Quick Start

```bash
# Create a new instance named "work"
set ZAVORTH_INSTANCE=work
npx zavorth setup
npx zavorth start

# In another terminal, use "personal" instance
set ZAVORTH_INSTANCE=personal
npx zavorth start

# Default instance (no isolation)
npx zavorth start
```

## Environment Variable

```bash
ZAVORTH_INSTANCE=<instance-name>
```

**Rules:**
- Lowercase alphanumeric, hyphens, underscores only
- Max 64 characters
- `default` or empty = standard behavior (no isolation)
- Created automatically on first use

## Directory Structure

When `ZAVORTH_INSTANCE=work` is set, all state resolves to:

```
<homeRoot>/instances/work/
  data/
    zavorth.db           # SQLite database
    memory/              # Vector memory store
    runtime/             # Runtime state files
  .zavorth/
    wiki/                # Semantic wiki pages
    sessions.json        # Session records
    receipts/            # Action receipts
    memory/              # Unified memory output
  memory/                # Daily memory notes (YYYY-MM-DD.md)
  MEMORY.md              # Curated long-term memory
  IDENTITY.md            # Agent identity
  SOUL.md                # Agent personality
  USER.md                # User profile
  credentials/           # API keys and tokens
  logs/                  # Log files
  tmp/                   # Temporary files
  config/                # Instance-specific config
```

## API Usage

### Create an Instance

```typescript
import { createInstance, listInstances } from '../services/ZavorthInstanceService.js';

// Create a new isolated instance
const info = createInstance('/path/to/home', 'work');
console.log(info.homeRoot);  // /path/to/home/instances/work
```

### List Instances

```typescript
import { listInstances } from '../services/ZavorthInstanceService.js';

const instances = listInstances('/path/to/home');
// [
//   { name: 'default', homeRoot: '/path/to/home', exists: true, ... },
//   { name: 'work', homeRoot: '/path/to/home/instances/work', exists: true, ... },
// ]
```

### Delete an Instance

```typescript
import { deleteInstance } from '../services/ZavorthInstanceService.js';

deleteInstance('/path/to/home', 'work');  // Cannot delete 'default'
```

### Get Instance Path

```typescript
import { getInstancePath } from '../services/ZavorthInstanceService.js';

const dbPath = getInstancePath('/path/to/home', 'work', 'data', 'zavorth.db');
// /path/to/home/instances/work/data/zavorth.db
```

## How It Works

1. The `ZavorthHomePathService` reads `ZAVORTH_INSTANCE` at startup
2. If instance name is not `default`, homeRoot resolves to `<baseHomeRoot>/instances/<name>/`
3. All subsequent path resolution (database, memory, config, etc.) uses this instance-scoped homeRoot
4. Process locks are also scoped per instance, preventing conflicts between simultaneous instances

## Use Cases

| Scenario | Instance Name | Description |
|----------|---------------|-------------|
| Personal assistant | `personal` | Private memories, personal preferences |
| Work assistant | `work` | Professional context, company credentials |
| Development | `dev` | Code-focused, developer tools enabled |
| Testing | `test` | Isolated sandbox for experiments |

## Migration

To move existing data into a new instance:

```bash
# Set instance name
set ZAVORTH_INSTANCE=work

# Run setup — creates instance directory
npx zavorth setup

# Copy existing state
cp -r data/ instances/work/data/
cp -r .zavorth/ instances/work/.zavorth/
cp MEMORY.md instances/work/
```

## Testing

```bash
npx jest tests/i18n/ZavorthInstanceService.test.ts
```

25 tests covering creation, deletion, listing, path resolution, and validation.
