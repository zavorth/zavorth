# Zavorth Installation Guide

Zavorth provides a conservative one-command installer for macOS, Linux and Windows.
Until signed standalone binaries are published, the public installer uses the
official npm package and verifies the CLI after install.

## Quick Install

The installer does not start the runtime, write secrets or edit shell profiles.
It checks Node.js 18+, installs `zavorth` globally from npm and runs safe help
checks.

### Linux / macOS (Unix)

Run the raw GitHub installer command in your terminal:

```bash
curl -fsSL https://raw.githubusercontent.com/zavorth/zavorth-core/main/Zavorth/scripts/install.sh | bash
```

Preview without installing:

```bash
curl -fsSL https://raw.githubusercontent.com/zavorth/zavorth-core/main/Zavorth/scripts/install.sh | bash -s -- --dry-run
```

Install from a release channel:

```bash
ZAVORTH_CHANNEL=beta curl -fsSL https://raw.githubusercontent.com/zavorth/zavorth-core/main/Zavorth/scripts/install.sh | bash
```

### Windows

Run the raw PowerShell installer command:

```powershell
irm https://raw.githubusercontent.com/zavorth/zavorth-core/main/Zavorth/scripts/install.ps1 | iex
```

Preview without installing:

```powershell
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/zavorth/zavorth-core/main/Zavorth/scripts/install.ps1))) -DryRun
```

Install from a release channel:

```powershell
$env:ZAVORTH_CHANNEL = "beta"
irm https://raw.githubusercontent.com/zavorth/zavorth-core/main/Zavorth/scripts/install.ps1 | iex
```

---

## Manual npm Installation

You can also install the npm package directly.

### Requirements
- Node.js 18 or newer
- NPM

### Installation

```bash
npm install -g zavorth
```

---

## Verification

After installation, verify that the `zavorth` command is available:

```bash
zavorth --help
```

For a cleaner terminal flow, prefer the Zavorth wrappers instead of
raw npm commands:

```bash
zavorth install
zavorth build
zavorth check
```

They run the underlying npm tasks with compact panels, duration, output tail and
next actions.

Next, initialize your workspace and connect the core runtime:

```bash
zavorth setup
```

## Release Integrity Manifest

The current public installer is npm-based. Standalone binaries must not be
advertised until release assets, checksums and signature metadata exist.

Before publishing an installer update, generate and check the local release
manifest:

```bash
npm run installer-release:manifest
npm run installer-release:check
```

The manifest records:
- npm package name and version;
- installer and CLI input file SHA-256 hashes;
- alpha, beta and stable channel gates;
- the current distribution mode;
- rollback rules that preserve `.zavorth` user data.

## Release Channels

Zavorth supports four installer/update channels:

| Channel | npm tag | Intended use |
| --- | --- | --- |
| `stable` | `latest` | Recommended daily install path |
| `beta` | `beta` | Limited public testing |
| `nightly` | `nightly` | Fast preview builds |
| `dev` | `dev` | Maintainer/developer testing |

CLI update commands:

```bash
zavorth version
zavorth update --channel beta
zavorth update --channel beta --yes
```

`zavorth update` previews the exact command and checksum marker first. It only
executes the global npm update when `--yes` is present.

## Standalone Launcher Artifacts

Zavorth can be packaged as a single-file Node launcher plus platform wrappers.
Release artifacts are produced by the maintainer release flow, not by the normal
user install path.

Generated artifact names use this shape:

```txt
zavorth.cjs
zavorth-linux-x64
zavorth-linux-arm64
zavorth-macos-x64
zavorth-macos-arm64
zavorth-win-x64.cmd
zavorth-win-arm64.cmd
```

This is not yet a native `.exe`/ELF/Mach-O binary. The launcher still requires
Node.js 18+. Native standalone binaries must remain marked `not-built` until the
release pipeline has real compiled assets, checksums and signature metadata.

## Shell Completions

Generate completions:

```bash
zavorth completions bash
zavorth completions zsh
zavorth completions fish
zavorth completions powershell
```

Install completions with explicit consent:

```bash
zavorth completions bash --install
```

```powershell
zavorth completions powershell --install
```

The installer can print completion setup hints with `--completions`, but it does
not edit shell profiles silently.

## Headless Mode

Use `-p` for one-shot automation:

```bash
zavorth -p "explain this repo"
zavorth -p "review src" --json
zavorth -p "fix tests" --approval-mode governed
```

Headless mode is routed through the same `ask`/Experience Core path as the
interactive CLI. It does not bypass policy, approvals, receipts or sandbox rules.

## Inspect Command

Use `inspect` to see what Zavorth discovered about the current project and local
runtime configuration:

```bash
zavorth inspect
zavorth inspect --json
zavorth inspect --live
```

The report includes provider/model, workspace, instructions, skills, plugins,
MCP, hooks, channels, Mnemos, trust mode, receipts and pending approvals. It only
reports credential presence and never serializes raw secret values.

## Managed Config

Enterprise or managed environments can provide transparent configuration without
turning Zavorth into a black box:

```bash
zavorth managed-config --source ./managed_config.json --checksum <sha256>
zavorth managed-config apply --source ./managed_config.json --checksum <sha256> --yes
```

Environment variables are also supported:

```bash
ZAVORTH_MANAGED_CONFIG_URL=https://example.com/managed_config.json
ZAVORTH_DEPLOYMENT_KEY=...
```

Managed config always previews first. Apply requires `--yes` and a checksum.
Raw secret values are blocked; use `secretRefs` such as `OPENAI_API_KEY` instead.
Applied config is written under `data/runtime/managed-config/` with a receipt in
`managed_config_receipts.jsonl`.

## Release Safety

Published releases should include platform metadata, checksums and clear version
information. Installer and update flows must keep preview, consent and no-secret
logging guarantees intact.
