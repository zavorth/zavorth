import fs from 'fs';
import os from 'os';
import path from 'path';
import { ProductionHardeningValidator } from '../../ops/production/ProductionHardeningValidator';

describe('ProductionHardeningValidator', () => {
  it('validates a hardened production profile', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-prod-validate-'));
    fs.mkdirSync(path.join(root, 'deploy'), { recursive: true });
    fs.mkdirSync(path.join(root, 'ops', 'production'), { recursive: true });
    fs.mkdirSync(path.join(root, 'ops', 'recovery'), { recursive: true });
    fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });

    fs.writeFileSync(
      path.join(root, 'deploy', 'docker-compose.prod.yml'),
      `
services:
  zavorth:
    read_only: true
    restart: unless-stopped
    environment:
      NODE_ENV: production
      ZAVORTH_PROFILE: ops
      ZAVORTH_CAPABILITY_POLICY: ask-on-demand
      ZAVORTH_SELFMOD_POLICY: owner_trusted
      ZAVORTH_ALLOW_STARTUP_INSTALL: "false"
    mem_limit: 2048m
    cpus: 2
    pids_limit: 256
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    tmpfs:
      - /tmp
    ports:
      - "33333:33333"
    volumes:
      - zavorth_data:/usr/src/app/data
      - zavorth_tmp:/usr/src/app/tmp
      - zavorth_memory:/usr/src/app/memory
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:33333/api/auth/status').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
    logging:
      driver: json-file
      options:
        max-size: "25m"
        max-file: "5"
`,
      'utf8',
    );

    fs.writeFileSync(
      path.join(root, 'deploy', 'production.Dockerfile'),
      `
FROM node:20-alpine
VOLUME ["/usr/src/app/data", "/usr/src/app/tmp", "/usr/src/app/memory"]
ENV ZAVORTH_PROFILE=ops \
    ZAVORTH_CAPABILITY_POLICY=ask-on-demand \
    ZAVORTH_ALLOW_STARTUP_INSTALL=false
USER zavorth
EXPOSE 33333
CMD ["node", "dist/host.js"]
`,
      'utf8',
    );

    fs.writeFileSync(
      path.join(root, 'ops', 'production', 'host-hardening.sh'),
      `#!/usr/bin/env bash
set -euo pipefail
ufw default deny incoming
ufw allow "\${SSH_PORT}/tcp"
ufw allow "\${ZAVORTH_PORT}/tcp"
systemctl enable auditd || true
systemctl start auditd || true
cat >/etc/sysctl.d/99-zavorth-hardening.conf <<'EOF'
kernel.dmesg_restrict=1
EOF
setfacl -m u:node:rw /dev/kvm || true
`,
      'utf8',
    );

    fs.writeFileSync(
      path.join(root, 'ops', 'recovery', 'DisasterRecoveryPlan.md'),
      `
npm run ops:backup -- --json
npm run ops:restore -- --manifest data/backups/example/manifest.json --dry-run
npm run ops:production:check -- --json
npm run sandbox:doctor:smoke
npm run sandbox:firecracker:smoke
`,
      'utf8',
    );
    fs.writeFileSync(
      path.join(root, 'scripts', 'sandbox-doctor.sh'),
      `#!/bin/bash
set -euo pipefail
command -v runsc
command -v firecracker
test -e /dev/kvm
echo --smoke
`,
      'utf8',
    );
    fs.writeFileSync(
      path.join(root, 'scripts', 'gvisor-wsl-bootstrap.ps1'),
      'runsc dockerd',
      'utf8',
    );
    fs.writeFileSync(
      path.join(root, 'scripts', 'firecracker-host-bootstrap.sh'),
      'firecracker /dev/kvm',
      'utf8',
    );
    fs.writeFileSync(
      path.join(root, 'scripts', 'firecracker-smoke.sh'),
      'ZAVORTH_FIRECRACKER_ENABLED FirecrackerSandboxRuntime',
      'utf8',
    );

    const validator = new ProductionHardeningValidator({ projectRoot: root });
    const report = validator.validate();

    expect(report.ok).toBe(true);
    expect(report.checks.every((entry) => entry.ok)).toBe(true);
  });
});
