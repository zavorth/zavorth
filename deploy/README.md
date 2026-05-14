# Deploy Profiles

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
- startup install bloqueado por padrao
- limite de 2048 MB, 2 CPUs e 256 processos
- rotacao de logs `25 MB x 5 arquivos`

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

O snapshot padrao cobre apenas o estado critico do produto:

- `data/zavorth.db`, `-wal`, `-shm`
- `memory/`
- `data/operational-memory/`
- `data/workspace-profiles/`
- arquivos canonicos de `data/runtime/` como tokens, pairing, locks, doctors e status de runtime

Logs, caches, perfis de smoke visual e artefatos pesados de `data/runtime/` ficam de fora por padrao.
