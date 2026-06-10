# Memory Encryption

Zavorth protects learned memory in two layers.

The default layer encrypts memory content before it is written to local storage. Text, metadata, keywords and vectors are stored as encrypted fields. This is the daily safe default because it works without extra native dependencies.

Advanced memory protection is optional. When an SQLCipher-compatible driver is available, Zavorth can also seal the whole SQLite file so the database cannot be opened without the memory key. This protects SQLite pages, indexes and schema-adjacent data better than field encryption alone.

## Check Status

```bash
zavorth memory encryption status
zavorth memory encryption status --json
```

Useful fields:

- `Memory content encryption`: should be `active`.
- `Advanced file encryption`: `active` means the SQLite file itself is sealed.
- `Unkeyed open blocked`: `true` proves the encrypted database cannot be opened without the key.

## Enable Advanced Protection

Preview first:

```bash
zavorth memory encryption preview --mode required
```

Apply when the preview is acceptable:

```bash
zavorth memory encryption apply --mode required
```

Zavorth creates a backup before replacing the current memory database. If the optional encryption driver is not available, `required` mode blocks the unsafe SQLite migration and keeps the protected fallback path instead.

## Rollback

Use the backup path printed by the apply receipt:

```bash
zavorth memory encryption rollback --backup <path>
```

Rollback is explicit because replacing memory storage is a local file mutation.

## Configuration

Environment variables:

- `ZAVORTH_MEMORY_SQLCIPHER_MODE=off|opportunistic|required`
- `ZAVORTH_MEMORY_SQLCIPHER_KEY=<secret>`
- `ZAVORTH_MEMORY_SQLCIPHER_KEY_PATH=<path>`
- `ZAVORTH_MEMORY_FULL_FILE_KEY_STORE=auto|file|os`
- `ZAVORTH_MEMORY_SQLCIPHER_DRIVER_PACKAGES=better-sqlite3-multiple-ciphers,@journeyapps/sqlcipher`
- `ZAVORTH_MEMORY_DB_PATH=<path>`

Recommended daily setup:

```bash
ZAVORTH_MEMORY_SQLCIPHER_MODE=opportunistic
ZAVORTH_MEMORY_FULL_FILE_KEY_STORE=auto
```

Recommended high-privacy setup:

```bash
ZAVORTH_MEMORY_SQLCIPHER_MODE=required
ZAVORTH_MEMORY_FULL_FILE_KEY_STORE=auto
```

On Windows, `auto` prefers an OS-protected key file when available. On other systems, `auto` falls back to a local key file. The key itself is never returned by the status API, desktop panel or receipts.

## Desktop

The Memory panel shows:

- Standard memory protection: field encryption is active.
- Advanced memory protection: full-file encryption is active and proved.
- Preview: checks whether migration can run.
- Enable advanced: migrates with backup and proof.
- Rollback: available only after a migration receipt with a backup path.

## Verification

```bash
npm run zavorth:memory-encryption:check --silent
npm run zavorth:memory-encryption:sqlcipher-smoke --silent
```

The normal check verifies the contract and safe default. The SQLCipher smoke is optional and proves the strong driver when it is installed in the environment.
