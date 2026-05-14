#!/bin/bash
# =============================================================================
# Zavorth - Firecracker Smoke Test
# =============================================================================
# Roda um smoke test de ponta a ponta usando a engine do Zavorth.
# Esse script deve rodar em um host Linux real onde KVM esta configurado
# e o rootfs.ext4/vmlinux estao preparados.
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "======================================="
echo "  Zavorth Firecracker Smoke Test"
echo "======================================="
echo ""

if [ "${ZAVORTH_FIRECRACKER_ENABLED:-}" != "true" ] && ! grep -q "ZAVORTH_FIRECRACKER_ENABLED=true" "${PROJECT_ROOT}/.env" 2>/dev/null; then
  echo "ERRO: habilite ZAVORTH_FIRECRACKER_ENABLED=true no ambiente ou no .env"
  exit 1
fi

echo "-> Verificando KVM"
if [ ! -w /dev/kvm ]; then
  echo "ERRO: /dev/kvm nao esta acessivel em modo de escrita."
  exit 1
fi

echo "-> Iniciando Node.js para invocar FirecrackerSandboxRuntime..."

cat << 'EOF' > "${PROJECT_ROOT}/smoke.mjs"
import { FirecrackerSandboxRuntime } from './dist/services/sandbox/FirecrackerSandboxRuntime.js';

async function run() {
  console.log('Instanciando FirecrackerSandboxRuntime...');
  const fc = new FirecrackerSandboxRuntime();

  const status = fc.getStatus();
  if (!status.canRun) {
    console.error('Status indica que FC nao pode rodar:', status.detail);
    process.exit(1);
  }

  const code = `
    const os = require('os');
    console.log('--- Hello from MicroVM! ---');
    console.log('Arch:', os.arch());
    console.log('CPUs:', os.cpus().length);
    console.log('Memory:', Math.round(os.totalmem() / 1024 / 1024) + 'MB');
    console.log('---------------------------');
  `;

  console.log('\nDisparando execucao...');
  const start = Date.now();

  try {
    const result = await fc.execute({
      language: 'javascript',
      code,
      timeoutMs: 15000,
    });

    console.log('\nExecucao concluida em ' + (Date.now() - start) + 'ms');
    console.log('Exit Code:', result.exitCode);
    console.log('STDOUT:\n', result.stdout);
    if (result.stderr) {
      console.log('STDERR:\n', result.stderr);
    }
  } catch (err) {
    console.error('Falha na execucao:', err?.message || err);
    process.exit(1);
  }
}

run();
EOF

cd "${PROJECT_ROOT}"
node smoke.mjs
TS_EXIT=$?
rm -f smoke.mjs

if [ $TS_EXIT -eq 0 ]; then
  echo ""
  echo "Smoke test finalizado com sucesso."
else
  echo ""
  echo "Smoke test finalizou com erro (codigo $TS_EXIT)."
fi
exit $TS_EXIT
