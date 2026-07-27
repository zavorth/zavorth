# File and Document Workflows

Zavorth provides native services for file transfer, document extraction, artifact diffs, and document workflow routing.

## Capabilities

- `file.transfer` copies or moves bytes only within approved workspace or artifact roots. Writes require explicit confirmation; moves also require delete permission.
- `document.extract` reads supported local documents and stores extracted text, metadata, and tables as artifacts.
- `artifact.diff` creates unified diff artifacts for files, stored artifacts, or inline text.
- `prose-workflow` and `document-workflow` select the appropriate extraction, diff, or review route and retain the required approval information.

Free-text intent is interpreted by the agent's semantic router. The workflow service accepts the resulting structured capability route instead of matching words in a particular language. Missing or invalid structured routes stop at `manual-review`.

## Readiness

The configured check inspects contracts, adapters, policies, and commands without performing live I/O:

```bash
npm run file-document-diff-live-plane -- --profile configured
```

The repository integrity check verifies that the connected implementation and its tests are present:

```bash
npm run file-document-diff-live-plane:check --silent
```

Code presence and a passing configured check do not prove that a live operation succeeded. A live claim requires an operator-triggered command and its resulting receipt.

## Live receipts

Run a live smoke operation only with paths you intend to read or write:

```bash
npm run file-document-diff-live-plane -- --profile staging-live --target file-transfer --confirm-live-io --source <path> --destination <path> --workspace-root <root>
```

Use `--target document-extract` with `--source`, or `--target diffs` with `--left` and `--right`. The result records whether live I/O occurred while omitting secret values.
