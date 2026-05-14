#!/bin/bash
# =============================================================================
# Zavorth Sandbox Doctor
# =============================================================================
# Verifica e instala os runtimes de seguranca (gVisor e Firecracker).
# Rode com: bash scripts/sandbox-doctor.sh
#
# Funcoes:
#   --check       Apenas verifica o estado atual (default)
#   --install     Instala componentes faltantes
#   --smoke       Roda smoke tests nos runtimes disponiveis
# =============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
FC_DATA_DIR="${PROJECT_ROOT}/data/firecracker"

pass()  { echo -e "  ${GREEN}✓${NC} $1"; }
fail()  { echo -e "  ${RED}✗${NC} $1"; }
warn()  { echo -e "  ${YELLOW}⚠${NC} $1"; }
info()  { echo -e "  ${CYAN}→${NC} $1"; }

MODE="${1:---check}"

# =============================================================================
# Docker Check
# =============================================================================
echo ""
echo -e "${CYAN}═══════════════════════════════════════${NC}"
echo -e "${CYAN}  Zavorth Sandbox Doctor${NC}"
echo -e "${CYAN}═══════════════════════════════════════${NC}"
echo ""
echo "▸ Docker"

if command -v docker &>/dev/null; then
  DOCKER_VERSION=$(docker version --format '{{.Server.Version}}' 2>/dev/null || echo "N/A")
  pass "Docker CLI encontrado (Server: ${DOCKER_VERSION})"
else
  fail "Docker nao encontrado no PATH"
  echo "    Instale via: https://docs.docker.com/engine/install/"
  exit 1
fi

if docker info &>/dev/null; then
  pass "Docker daemon acessivel"
else
  fail "Docker daemon nao responde (rode 'sudo systemctl start docker')"
fi

# =============================================================================
# gVisor (runsc) Check
# =============================================================================
echo ""
echo "▸ gVisor (runsc)"

GVISOR_INSTALLED=false

if command -v runsc &>/dev/null; then
  RUNSC_VERSION=$(runsc --version 2>&1 | head -1 || echo "N/A")
  pass "runsc encontrado: ${RUNSC_VERSION}"
  GVISOR_INSTALLED=true
elif [ -f /usr/local/bin/runsc ]; then
  pass "runsc encontrado em /usr/local/bin/runsc"
  GVISOR_INSTALLED=true
else
  fail "runsc nao encontrado"
fi

if [ "$GVISOR_INSTALLED" = true ]; then
  # Readiness check real: tenta rodar um container com gVisor
  if docker run --rm --runtime=runsc busybox:latest true 2>/dev/null; then
    pass "gVisor ATIVO — container rodou com --runtime=runsc"
  else
    warn "runsc instalado mas Docker nao aceita --runtime=runsc"
    warn "Rode: sudo runsc install && sudo systemctl restart docker"
  fi
fi

if [ "$MODE" = "--install" ] && [ "$GVISOR_INSTALLED" = false ]; then
  info "Instalando gVisor (runsc)..."
  ARCH=$(uname -m)
  URL="https://storage.googleapis.com/gvisor/releases/release/latest/${ARCH}"
  (
    set -e
    cd /tmp
    wget -q "${URL}/runsc" "${URL}/runsc.sha512" \
      "${URL}/containerd-shim-runsc-v1" "${URL}/containerd-shim-runsc-v1.sha512"
    sha512sum -c runsc.sha512 containerd-shim-runsc-v1.sha512
    rm -f runsc.sha512 containerd-shim-runsc-v1.sha512
    chmod a+rx runsc containerd-shim-runsc-v1
    sudo mv runsc containerd-shim-runsc-v1 /usr/local/bin
    sudo /usr/local/bin/runsc install
    sudo systemctl restart docker
  )
  if docker run --rm --runtime=runsc busybox:latest true 2>/dev/null; then
    pass "gVisor instalado e ativo com sucesso!"
  else
    fail "Instalacao do gVisor falhou. Verifique os logs."
  fi
fi

# =============================================================================
# Firecracker Check
# =============================================================================
echo ""
echo "▸ Firecracker"

FC_INSTALLED=false

if command -v firecracker &>/dev/null; then
  FC_VERSION=$(firecracker --version 2>&1 | head -1 || echo "N/A")
  pass "firecracker encontrado: ${FC_VERSION}"
  FC_INSTALLED=true
else
  fail "firecracker nao encontrado no PATH"
  echo "    Bootstrap sugerido: sudo bash scripts/firecracker-host-bootstrap.sh"
fi

# KVM check
if [ -e /dev/kvm ]; then
  if [ -r /dev/kvm ] && [ -w /dev/kvm ]; then
    pass "/dev/kvm acessivel (leitura+escrita)"
  else
    warn "/dev/kvm existe mas sem permissao. Rode: sudo chmod 666 /dev/kvm"
  fi
else
  fail "/dev/kvm nao existe (KVM desabilitado ou maquina sem virtualizacao)"
fi

# Kernel check
if [ -f "${FC_DATA_DIR}/vmlinux" ]; then
  KERNEL_SIZE=$(du -h "${FC_DATA_DIR}/vmlinux" | cut -f1)
  pass "Kernel vmlinux presente (${KERNEL_SIZE})"
else
  fail "Kernel vmlinux nao encontrado em ${FC_DATA_DIR}/vmlinux"
  echo "    Use o bootstrap do host e depois coloque um kernel valido neste caminho."
fi

# Rootfs check
if [ -f "${FC_DATA_DIR}/rootfs.ext4" ]; then
  ROOTFS_SIZE=$(du -h "${FC_DATA_DIR}/rootfs.ext4" | cut -f1)
  pass "Rootfs ext4 presente (${ROOTFS_SIZE})"
else
  fail "Rootfs nao encontrado em ${FC_DATA_DIR}/rootfs.ext4"
  echo "    Rode: sudo bash scripts/firecracker-build-rootfs.sh"
fi

# e2fsprogs check (needed for payload drive)
if command -v mkfs.ext4 &>/dev/null && command -v debugfs &>/dev/null; then
  pass "e2fsprogs instalado (mkfs.ext4 + debugfs)"
else
  fail "e2fsprogs nao encontrado (apt install e2fsprogs)"
fi

# =============================================================================
# Smoke Tests
# =============================================================================
if [ "$MODE" = "--smoke" ]; then
  echo ""
  echo "▸ Smoke Tests"

  # gVisor smoke
  if docker run --rm --runtime=runsc busybox:latest echo "gVisor smoke OK" 2>/dev/null; then
    pass "gVisor: echo smoke OK"
  else
    fail "gVisor: smoke test falhou"
  fi

  # gVisor hardening smoke
  HARDENED_OUTPUT=$(docker run --rm --runtime=runsc \
    --network none \
    --cap-drop ALL \
    --security-opt no-new-privileges \
    --read-only \
    --tmpfs /tmp:rw,noexec,nosuid,size=64m \
    --pids-limit 64 \
    --memory 256m \
    --cpus 1.0 \
    busybox:latest sh -c 'echo "hardened"; whoami' 2>&1 || echo "FAIL")

  if echo "$HARDENED_OUTPUT" | grep -q "hardened"; then
    pass "gVisor: hardening flags aceitos (cap-drop, read-only, pids-limit)"
  else
    fail "gVisor: hardening flags rejeitados"
    echo "    Output: ${HARDENED_OUTPUT}"
  fi

  # Firecracker smoke (requires full setup)
  if [ "$FC_INSTALLED" = true ] && [ -f "${FC_DATA_DIR}/vmlinux" ] && [ -f "${FC_DATA_DIR}/rootfs.ext4" ]; then
    info "Executando Firecracker smoke test e2e..."
    sleep 1
    bash "${SCRIPT_DIR}/firecracker-smoke.sh"
  else
    warn "Firecracker: componentes faltando, smoke test pulado"
  fi
fi

# =============================================================================
# Summary
# =============================================================================
echo ""
echo -e "${CYAN}═══════════════════════════════════════${NC}"
echo -e "${CYAN}  Recomendacoes para .env${NC}"
echo -e "${CYAN}═══════════════════════════════════════${NC}"
echo ""

if [ "$GVISOR_INSTALLED" = true ]; then
  echo "  ZAVORTH_DOCKER_SANDBOX_RUNTIME=runsc"
fi

if [ "$FC_INSTALLED" = true ]; then
  echo "  ZAVORTH_FIRECRACKER_ENABLED=true"
  echo "  ZAVORTH_FIRECRACKER_BIN_PATH=$(which firecracker 2>/dev/null || echo '/usr/local/bin/firecracker')"
  echo "  ZAVORTH_FIRECRACKER_KERNEL_PATH=${FC_DATA_DIR}/vmlinux"
  echo "  ZAVORTH_FIRECRACKER_ROOTFS_PATH=${FC_DATA_DIR}/rootfs.ext4"
fi

echo ""
echo "Rode com --install para instalar componentes faltantes."
echo "Rode com --smoke para executar smoke tests."
echo ""
