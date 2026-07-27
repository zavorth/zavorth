# Deploy Profiles

## Idle cost model (honest)

| Layer | What it does | How to enable |
|-------|----------------|---------------|
| **Code sandbox** | Run snippets in Docker/Daytona/Modal | `zavorth_sandbox_cloud` / terminal backends |
| **Gateway adapter idle** | Shut down ociose channel adapters inside the process | `ZAVORTH_SCALE_TO_ZERO=1` |
| **Host hibernation** | Platform freezes the machine/container when traffic stops | Fly autostop, Render sleep, or equivalent — requires webhook/wake path |

Do not claim “$0 idle cloud agent” from `ScaleToZeroManager` alone. Prove idle → wake → reply on the chosen host.

## Docker image publish (GHCR / Docker Hub)

Release CI (`.github/workflows/release.yml`) builds and can push images on tags `v*`:

```bash
# GHCR (automatic with GITHUB_TOKEN)
docker pull ghcr.io/<owner>/zavorth:vX.Y.Z

# Docker Hub (optional — set repo secrets)
# DOCKERHUB_USERNAME
# DOCKERHUB_TOKEN
docker pull <DOCKERHUB_USERNAME>/zavorth:vX.Y.Z
```

Local tag helper:

```bash
npm run release:docker-tags
# or: node scripts/docker-release-tags.mjs v2.0.0
```

Dry-run release (`workflow_dispatch` with dry_run=true) builds without pushing.

## Docker Compose Production

Arquivo oficial:

```text
deploy/docker-compose.prod.yml
```

Subida:

```bash
docker compose -f deploy/docker-compose.prod.yml up -d --build
```

Esse perfil sobe:

- host supervisionado (`dist/host.js`)
- volume persistente para `data`, `tmp` e `memory`
- rootfs somente leitura com `tmpfs`
- healthcheck em `/api/auth/status`
- perfil `ops` com capability policy `ask-on-demand`
- selfmod restrito a `owner_trusted`
- startup install blocked by default
- limite de 2048 MB, 2 CPUs e 256 processos
- log rotation `25 MB x 5 files`

## Hardening do host Linux

Script oficial:

```bash
sudo bash ops/production/host-hardening.sh
```

O script configura firewall, `auditd`, baseline `sysctl` defensivo e ACL de `/dev/kvm` quando o host expuser KVM.

## Sandbox de producao

Valide gVisor e Firecracker antes de aceitar workloads mais sensiveis:

```bash
npm run sandbox:doctor:smoke
npm run sandbox:firecracker:smoke
```

Em hosts novos:

```bash
npm run sandbox:gvisor:bootstrap
npm run sandbox:firecracker:bootstrap
```

## Backup e restore

```bash
npm run ops:backup -- --json
npm run ops:restore -- --manifest data/backups/<snapshot-id>/manifest.json --dry-run
npm run ops:production:check -- --json
```

The default snapshot covers only the product-critical state:

- `data/zavorth.db`, `-wal`, `-shm`
- `memory/`
- `data/operational-memory/`
- `data/workspace-profiles/`
- arquivos canonicos de `data/runtime/` como tokens, pairing, locks, doctors e status de runtime

Logs, caches, visual smoke profiles, and heavy `data/runtime/` artifacts stay out by default.
