#!/bin/bash
# =============================================================================
# Zavorth - Firecracker Host Bootstrap
# =============================================================================
# Prepara um host Linux/KVM para o tier MicroVM do Zavorth.
#
# O que este script faz:
#   1. valida Linux + /dev/kvm
#   2. installs host dependencies
#   3. installs the Firecracker binary
#   4. garante o diretorio data/firecracker
#   5. opcionalmente constroi o rootfs do Zavorth
#
# What this script cannot do safely by itself:
#   - adivinhar um kernel vmlinux adequado para o seu host
#   - enable virtualization if the provider does not expose KVM
#
# usage:
#   sudo bash scripts/firecracker-host-bootstrap.sh
#   sudo bash scripts/firecracker-host-bootstrap.sh --with-rootfs
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
FC_DATA_DIR="${PROJECT_ROOT}/data/firecracker"
WITH_ROOTFS=false

for arg in "$@"; do
  case "$arg" in
    --with-rootfs)
      WITH_ROOTFS=true
      ;;
  esac
done

red='\033[0;31m'
green='\033[0;32m'
yellow='\033[0;33m'
cyan='\033[0;36m'
nc='\033[0m'

pass() { echo -e "  ${green}OK${nc} $1"; }
warn() { echo -e "  ${yellow}WARN${nc} $1"; }
fail() { echo -e "  ${red}error${nc} $1"; exit 1; }
info() { echo -e "  ${cyan}>>${nc} $1"; }

echo
echo "=================================================="
echo "  Zavorth Firecracker Host Bootstrap"
echo "=================================================="
echo

if [ "$(id -u)" -ne 0 ]; then
  fail "run este script com sudo/root"
fi

if [ "$(uname -s)" != "Linux" ]; then
  fail "Firecracker exige host Linux. Host current: $(uname -s)"
fi

if [ ! -e /dev/kvm ]; then
  fail "/dev/kvm does not exist on this host. Without KVM there is no functional Firecracker."
fi

if [ ! -r /dev/kvm ] || [ ! -w /dev/kvm ]; then
  warn "/dev/kvm existe, mas a permission may be restricted. Adjusting for the current host."
  chmod 666 /dev/kvm || true
fi

if command -v apt-get >/dev/null 2>&1; then
  info "installing base dependencies via apt"
  apt-get update -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
    curl ca-certificates wget tar jq e2fsprogs debootstrap util-linux
  pass "base dependencies installed"
else
  fail "apt-get not found. The automatic bootstrap is currently prepared for Ubuntu/Debian."
fi

ARCH="$(uname -m)"
case "$ARCH" in
  x86_64|amd64)
    FC_ASSET_FILTER='x86_64.*\.tgz'
    ;;
  aarch64|arm64)
    FC_ASSET_FILTER='aarch64.*\.tgz'
    ;;
  *)
    fail "architecture is not automatically supported: $ARCH"
    ;;
esac

if ! command -v firecracker >/dev/null 2>&1; then
  info "baixando o release oficial mais recente do Firecracker"
  RELEASE_JSON="$(curl -fsSL https://api.github.com/repos/firecracker-microvm/firecracker/releases/latest)"
  DOWNLOAD_URL="$(printf '%s' "$RELEASE_JSON" | grep -Eo 'https://[^"]+' | grep -E "$FC_ASSET_FILTER" | head -1 || true)"

  if [ -z "$DOWNLOAD_URL" ]; then
    fail "could not find the official Firecracker asset para $ARCH"
  fi

  TMP_DIR="$(mktemp -d)"
  trap 'rm -rf "$TMP_DIR"' EXIT
  TAR_PATH="${TMP_DIR}/firecracker.tgz"

  curl -fsSL "$DOWNLOAD_URL" -o "$TAR_PATH"
  tar -xzf "$TAR_PATH" -C "$TMP_DIR"

  FC_BIN="$(find "$TMP_DIR" -type f \( -name firecracker -o -name 'firecracker-*' \) | head -1 || true)"
  if [ -z "$FC_BIN" ]; then
    fail "asset downloaded, but Firecracker binary was not found inside the package"
  fi

  install -m 0755 "$FC_BIN" /usr/local/bin/firecracker
  pass "firecracker installed at /usr/local/bin/firecracker"
else
  pass "firecracker already isva present: $(command -v firecracker)"
fi

mkdir -p "$FC_DATA_DIR"
pass "diretorio de assets garantido em $FC_DATA_DIR"

if [ "$WITH_ROOTFS" = true ]; then
  info "construindo rootfs do Zavorth"
  bash "${SCRIPT_DIR}/firecracker-build-rootfs.sh"
  pass "rootfs do Zavorth construido"
else
  warn "rootfs was not built automatically. Run later:"
  echo "    sudo bash scripts/firecracker-build-rootfs.sh"
fi

if [ ! -f "${FC_DATA_DIR}/vmlinux" ]; then
  warn "kernel vmlinux does not exist yet em ${FC_DATA_DIR}/vmlinux"
  echo "    place a valid vmlinux here or point ZAVORTH_FIRECRACKER_KERNEL_PATH"
else
  pass "kernel vmlinux encontrado em ${FC_DATA_DIR}/vmlinux"
fi

echo
echo "Resumo:"
echo "  - Firecracker: $(command -v firecracker || echo 'not found')"
echo "  - /dev/kvm: $(if [ -w /dev/kvm ]; then echo 'ok'; else echo 'without permission'; fi)"
echo "  - rootfs: $(if [ -f "${FC_DATA_DIR}/rootfs.ext4" ]; then echo 'ok'; else echo 'pending'; fi)"
echo "  - kernel: $(if [ -f "${FC_DATA_DIR}/vmlinux" ]; then echo 'ok'; else echo 'pending'; fi)"
echo
echo "next passo recomendado:"
echo "  bash scripts/sandbox-doctor.sh --smoke"
echo
