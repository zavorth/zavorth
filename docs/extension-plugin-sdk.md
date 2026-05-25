# Zavorth Extension / Plugin SDK

Phase 8 formalizes the plugin layer as a governed SDK surface. Plugins are no
longer just catalog rows or local state entries; each plugin action is projected
through:

```txt
manifest -> checksum/signature -> permission review -> lifecycle plan -> approval -> receipt
```

## Manifest

The SDK manifest schema is `zavorth.plugin-sdk.v1`.

Required fields:

- `schemaVersion`;
- `id`;
- `name`;
- `version`;
- `entrypoint`;
- `permissions`;
- `lifecycle`.

Validate a manifest:

```bash
npm run zavorth:extension-plugin-sdk -- --action manifest.validate --manifest <path>
```

If no manifest is provided, Zavorth uses a safe local template to prove the SDK
contract without executing external code.

## Integrity

Every manifest receives a canonical `sha256:` checksum. Trusted installs require
checksum review. Remote or registry-backed trusted installs also require a
trusted signature key.

Rules:

- checksum mismatch blocks the lifecycle;
- unsigned plugins stay in review mode;
- signatures do not unlock permissions by themselves;
- secret values are never serialized into receipts.

## Permissions

Permission decisions are deterministic:

- read-only metadata and local artifact reads are allowed;
- filesystem writes, provider calls, channel sends, node invocation, external
  network, process spawn and secret reads require approval;
- `system` scope is blocked.

This prevents a plugin from silently escalating from “extension” to “agent with
host authority”.

## Lifecycle

Lifecycle actions:

- install;
- enable;
- disable;
- uninstall;
- upgrade;
- invoke;
- doctor.

Plan a lifecycle action:

```bash
npm run zavorth:extension-plugin-sdk -- --action lifecycle.plan --plugin <id> --lifecycle enable
```

Apply a lifecycle action:

```bash
npm run zavorth:extension-plugin-sdk -- --action lifecycle.apply --plugin <id> --lifecycle enable --approval-id <id>
```

State-changing lifecycle actions require approval and emit a receipt.

## Local Marketplace

```bash
npm run zavorth:extension-plugin-sdk -- --action marketplace.list
```

The local marketplace is projected from the existing Zavorth plugin registry and
workspace extension registry. Each entry includes:

- id;
- label;
- version;
- source;
- status;
- checksum;
- signature status;
- install command.

## Hot Reload Dev

```bash
npm run zavorth:extension-plugin-sdk -- --action dev.hot-reload --dev --manifest <path>
```

Hot reload is a development convenience only. It does not bypass manifest
validation, permission review, lifecycle approval or receipts.

## QA

```bash
npm run zavorth:extension-plugin-sdk:check --silent
npm run qa:zavorth-extension-plugin-sdk --silent
npm run zavorth:product-readiness:check --silent
```
