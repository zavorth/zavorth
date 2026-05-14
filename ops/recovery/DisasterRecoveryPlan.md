# Disaster Recovery Plan

Runbook oficial para recuperar o estado critico do Zavorth.

## 1. Confirmar o incidente

```bash
npm run cli:fast -- doctor --json
npm run qa:regression
```

## 2. Capturar um ultimo snapshot antes de mexer

```bash
npm run ops:backup -- --json
```

## 3. Parar o host supervisionado

No ambiente local, encerre o launcher oficial. Em Docker:

```bash
docker compose -f deploy/docker-compose.prod.yml down
```

## 4. Restaurar um snapshot conhecido

```bash
npm run ops:restore -- --manifest data/backups/<snapshot-id>/manifest.json
```

Se quiser validar sem sobrescrever nada:

```bash
npm run ops:restore -- --manifest data/backups/<snapshot-id>/manifest.json --dry-run
```

## 5. Subir novamente

Local:

```bash
npm run ops:up
```

Docker:

```bash
docker compose -f deploy/docker-compose.prod.yml up -d --build
```

## 6. Validar o retorno

```bash
npm run qa:gateway:smoke
npm run qa:regression
npm run test:nodes:smoke
npm run test:transports:smoke -- --json
npm run ops:production:check -- --json
npm run sandbox:doctor:smoke
npm run sandbox:firecracker:smoke
```

Observacao: `sandbox:firecracker:smoke` exige host Linux/KVM com `ZAVORTH_FIRECRACKER_ENABLED=true`. O alias legado `ZAVORTH_FIRECRACKER_ENABLED` ainda e aceito com aviso de deprecacao. Em hosts sem KVM, registre a indisponibilidade como excecao operacional e mantenha gVisor como isolamento principal.

## 7. Revalidar politicas de producao

Depois do restore, confirme que o ambiente continua em modo sob demanda:

```bash
npm run ops:production:check -- --json
npm run ops:ecosystem
npm run ops:distributed
```

## Estado coberto pelo snapshot

- `data/zavorth.db`
- `data/zavorth.db-wal`
- `data/zavorth.db-shm`
- `memory`
- `data/operational-memory`
- `data/workspace-profiles`
- arquivos criticos de `data/runtime`:
  - tokens e chaves locais
  - identidade/autorizacao do host
  - pairing e estado do Node Mesh
  - status de canais, transportes e doctors
  - locks, snapshots e estado operacional supervisionado

## Estado que fica fora por padrao

- logs `.log`
- trilhas `.jsonl` de telemetria e historico
- caches e mirrors pesados
- perfis de `visual-smoke`
