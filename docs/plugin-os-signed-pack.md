# Plugin OS — Signed pack format (third-party)

Wave 8 ecosystem format for distributing **third-party** Plugin OS packages
outside the monorepo. First-party packages still ship under `plugins/*` and
`config/plugin-marketplace-curated.json`; this document covers **remote signed
packs** referenced from a remote marketplace catalog.

Related:

- [Plugin OS overview](./plugin-os.md)
- [Gap closure waves](./plugin-os-gap-closure-waves.md)
- Generated atlas: [plugin-atlas.md](./generated/plugin-atlas.md)
- Config: `config/plugin-os-marketplace.json`
- Example catalog: `config/plugin-marketplace-remote.example.json`
- Integrity: `PluginSignatureService` (`src/services/PluginSignatureService.ts`)

---

## Manifest (`zavorth.plugin-os.v1`)

Every package must include a `manifest.json` that validates as Plugin OS:

| Field | Requirement |
|-------|-------------|
| `schemaVersion` | Must be `zavorth.plugin-os.v1` |
| `id` | Stable package id (kebab-case recommended) |
| `label` / `name` | Human-readable title |
| `version` | Semver string |
| `moduleKind` | e.g. `provider`, `channel`, `tool`, `memory`, `search`, `bridge`, `diagnostics` |
| `summary` | Short description |
| `capabilities[]` | At least one capability with `id` / `intent` / `label` |
| `entrypoint.module` | Relative path (usually `./index.js`) |
| `entrypoint.exportName` | Default `register` |
| `lifecycle.actions` | Must include `invoke` |
| `policy.defaultTrust` | `review` \| `trusted` \| `blocked` (third-party should use `review`) |
| `permissions[]` | Declared permission kinds the pack may request |

Optional integrity block (also accepted by `PluginSignatureService`):

```json
{
  "integrity": {
    "checksum": "<sha256 hex of package file set>",
    "signature": "<ed25519 base64 over checksum>",
    "publicKeyId": "optional-key-id"
  }
}
```

See first-party examples under `plugins/*/manifest.json`.

---

## Package layout

A signed pack is a directory (or zip of that directory) with at least:

```text
my-plugin/
  manifest.json     # zavorth.plugin-os.v1
  index.js          # entrypoint (register export)
  README.md         # operator-facing docs / setup tips
  SIGNATURE         # optional sidecar (recommended for third-party)
  plugin.sig        # alternate sidecar name (also accepted)
```

### Zip distribution

Remote marketplace `source` URLs should point to an **HTTPS** zip whose root
contains the files above (either at zip root or one top-level folder matching
`id`). Install paths extract under workspace or user plugin roots
(`.zavorth/plugins/<id>`), then verify integrity before enable.

### Entrypoint style

CommonJS is recommended for loader/Jest compatibility:

```js
function register(ctx) {
  ctx.bindCapability('demo.run', async ({ input }) => {
    return { output: { ok: true, echo: input } };
  });
}
module.exports = { register };
```

---

## Signature model (`PluginSignatureService`)

Package integrity is computed as a **SHA-256 of sorted relative paths + file
contents** (hex, no prefix). Sidecars and certain names are excluded from the
digest (`node_modules`, `.git`, `SIGNATURE`, `plugin.sig`, …).

### Strong proofs

When `ZAVORTH_PLUGIN_REQUIRE_SIGNATURE=1` (or install `requireSignature`), any
of the following is accepted:

1. **ed25519** — signature over the package checksum (base64), verified with
   `ZAVORTH_PLUGIN_ED25519_PUBLIC_KEY`
2. **HMAC-SHA256** — `hmac-sha256=<hex>` in sidecar, verified with
   `ZAVORTH_PLUGIN_HMAC_SECRET`
3. **Declared checksum** — matching `integrity.checksum` / sidecar `sha256=`

### Sidecar format (`SIGNATURE` or `plugin.sig`)

```text
sha256=<packageChecksumHex>
ed25519=<base64Signature>
public-key-id=<optionalId>
hmac-sha256=<optionalHmacHex>
```

### Signing env

| Variable | Role |
|----------|------|
| `ZAVORTH_PLUGIN_ED25519_PRIVATE_KEY` | Sign packages (PEM or key material) |
| `ZAVORTH_PLUGIN_ED25519_PUBLIC_KEY` | Verify ed25519 |
| `ZAVORTH_PLUGIN_ED25519_PUBLIC_KEY_ID` | Optional key id written into sidecar |
| `ZAVORTH_PLUGIN_HMAC_SECRET` | HMAC secret for hmac-sha256 |
| `ZAVORTH_PLUGIN_REQUIRE_SIGNATURE` | `1` to require strong proof on verify |

CLI / services may call `PluginSignatureService.signPackage` /
`verifyPackage` / `computePackageChecksum`.

---

## Marketplace entry `digest` field

Remote and curated entries may declare a **digest** of the published artifact
(zip or extracted package checksum). Recommended conventions:

| Field | Meaning |
|-------|---------|
| `digest` | `sha256:<hex>` of the downloadable zip **or** the package checksum produced by `computePackageChecksum` |
| `signed` | `true` when a signature is published and expected to verify |
| `signature` | ed25519 base64 (or reference) covering the digest/checksum |
| `version` | Package version string matching `manifest.json` |

Installers should:

1. Download over HTTPS only
2. Compare computed digest to the catalog `digest`
3. Verify signature (ed25519/HMAC/checksum) via `PluginSignatureService`
4. Refuse load when digest or signature fails under require-signature policy

Local curated catalog (`config/plugin-marketplace-curated.json`) always wins on
**id conflicts** over remote entries.

---

## Remote catalog entry shape

Remote catalogs are a **JSON array** of entries (or `{ "entries": [ ... ] }`).
Third-party style fields:

```json
{
  "id": "community-weather-demo",
  "name": "Community Weather Demo",
  "summary": "Example third-party signed weather lookup pack.",
  "moduleKind": "tool",
  "source": "https://cdn.example.com/plugins/community-weather-demo-1.0.0.zip",
  "signed": true,
  "signature": "BASE64_ED25519_SIGNATURE_OVER_CHECKSUM",
  "digest": "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  "version": "1.0.0",
  "tier": "community",
  "tags": ["community", "example", "weather"]
}
```

| Field | Required | Notes |
|-------|----------|--------|
| `id` | yes | Unique package id |
| `name` | yes | Display name |
| `summary` | recommended | Short description |
| `moduleKind` | recommended | Module kind for routing / atlas |
| `source` | yes (remote) | **HTTPS** URL to zip (or documented locator) |
| `signed` | recommended | Whether signature is published |
| `signature` | when signed | ed25519 base64 (or equivalent proof) |
| `digest` | when signed | `sha256:<hex>` artifact/package digest |
| `version` | recommended | Semver |
| `tier` | optional | e.g. `community`, `partner` (not auto-enabled as first-party) |
| `tags` | optional | Discovery / atlas pack grouping |

See `config/plugin-marketplace-remote.example.json` for full sample entries.

---

## Remote marketplace URL (`ZAVORTH_PLUGIN_MARKETPLACE_URL`)

| Item | Value |
|------|--------|
| Env | `ZAVORTH_PLUGIN_MARKETPLACE_URL` |
| Config key | `config/plugin-os-marketplace.json` → `defaultRemoteUrlEnv` |
| Default URL | `null` (operators set env or deploy-specific config) |
| Cache | `.zavorth/cache/plugin-marketplace-remote.json` |

```bash
export ZAVORTH_PLUGIN_MARKETPLACE_URL=https://example.com/plugin-catalog.json
zavorth plugins marketplace refresh-remote
zavorth plugins marketplace --curated
```

`PluginCuratedMarketplaceService` merges remote/cache entries under local
curated ids. Bootstrap **does not** auto-enable remote/community tiers as
first-party.

Machine defaults and notes: `config/plugin-os-marketplace.json`.

---

## Security requirements

1. **HTTPS only** for remote catalog URLs and pack `source` downloads.
2. **SSRF guards** — reject `localhost`, private/link-local hosts, `.local` /
   `.internal`, non-HTTPS schemes (`file:`, `data:`, `http:`). Implemented in
   remote catalog refresh (`assertSafeRemoteCatalogUrl` in
   `PluginCuratedMarketplaceService`).
3. **Never auto-enable** third-party or remote packs. Discovery and install are
   operator-driven; `plugin_recommend` / router return enable **hints** only.
4. Prefer `policy.defaultTrust: "review"` and least-privilege `permissions`.
5. Soft-fail load: a broken third-party package must not crash Plugin OS bootstrap.
6. High-risk capabilities still go through approval gates and sandbox policy.

---

## Operator checklist (publish a signed pack)

1. Scaffold package (`manifest.json`, `index.js`, `README.md`).
2. `PluginSignatureService.computePackageChecksum` / `signPackage` (or CLI sign).
3. Zip the directory; publish over HTTPS.
4. Publish catalog entry with `source`, `digest`, `signature`, `signed: true`.
5. Consumers set `ZAVORTH_PLUGIN_MARKETPLACE_URL`, refresh remote, install, then
   **explicitly** enable after review.

---

## Related config

| Path | Role |
|------|------|
| `config/plugin-os-marketplace.json` | Remote marketplace defaults & policy notes |
| `config/plugin-marketplace-remote.example.json` | Example remote catalog |
| `config/plugin-marketplace-curated.json` | Local first-party + examples (wins on id) |
| `docs/generated/plugin-atlas.json` | Generated atlas from curated + waves |
