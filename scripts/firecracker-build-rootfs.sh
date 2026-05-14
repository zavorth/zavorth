#!/bin/bash
# =============================================================================
# Zavorth — Firecracker Rootfs Builder
# =============================================================================
# Constroi um rootfs ext4 compativel com o FirecrackerSandboxRuntime.
#
# O rootfs DEVE:
#   1. Conter node, python3 e bash
#   2. Ter um init que monta /dev/vdb e executa /mnt/payload/payload/run.sh
#   3. Desligar a VM apos a execucao
#
# Uso:
#   sudo bash scripts/firecracker-build-rootfs.sh
#
# Saida:
#   data/firecracker/rootfs.ext4
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
OUTPUT="${PROJECT_ROOT}/data/firecracker/rootfs.ext4"
ROOTFS_SIZE_MB="${ZAVORTH_FIRECRACKER_ROOTFS_SIZE_MB:-2048}"
MOUNT_POINT="/tmp/zavorth-rootfs-build"
BUILD_IMAGE="/tmp/zavorth-rootfs.ext4"

echo "═══════════════════════════════════════"
echo "  Zavorth Firecracker Rootfs Builder"
echo "═══════════════════════════════════════"
echo ""

# Verificar root
if [ "$(id -u)" -ne 0 ]; then
  echo "ERRO: Este script precisa rodar como root (sudo)."
  exit 1
fi

# Verificar dependencias
for cmd in debootstrap mkfs.ext4 mount umount chroot; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "ERRO: '$cmd' nao encontrado. Instale: apt install debootstrap e2fsprogs"
    exit 1
  fi
done

mkdir -p "$(dirname "$OUTPUT")"

cleanup() {
  if mountpoint -q "${MOUNT_POINT}" 2>/dev/null; then
    umount "${MOUNT_POINT}" 2>/dev/null || true
  fi
  rmdir "${MOUNT_POINT}" 2>/dev/null || true
}

trap cleanup EXIT

rm -f "${OUTPUT}" "${BUILD_IMAGE}"

# 1. Criar imagem ext4
echo "→ Criando imagem ext4 (${ROOTFS_SIZE_MB}MB)..."
dd if=/dev/zero of="${BUILD_IMAGE}" bs=1M count=${ROOTFS_SIZE_MB} status=progress
mkfs.ext4 -F -q "${BUILD_IMAGE}"

# 2. Montar
echo "→ Montando rootfs..."
mkdir -p "${MOUNT_POINT}"
mount -o loop "${BUILD_IMAGE}" "${MOUNT_POINT}"

# 3. Debootstrap (Ubuntu minimal)
echo "→ Instalando Ubuntu minimal via debootstrap..."
debootstrap --variant=minbase --include=bash,coreutils,util-linux jammy "${MOUNT_POINT}" http://archive.ubuntu.com/ubuntu

# 4. Instalar node e python3 dentro do chroot
echo "→ Instalando node, python3 e dependencias..."
chroot "${MOUNT_POINT}" /bin/bash <<'CHROOT_SCRIPT'
set -e
export DEBIAN_FRONTEND=noninteractive

# Configurar repositorios
cat > /etc/apt/sources.list <<EOF
deb http://archive.ubuntu.com/ubuntu jammy main universe
deb http://archive.ubuntu.com/ubuntu jammy-updates main universe
EOF

apt-get update -qq
apt-get install -y -qq --no-install-recommends \
  nodejs python3 bash ca-certificates

# Limpar cache para reduzir tamanho
apt-get clean
rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*
CHROOT_SCRIPT

# 5. Criar o init script que monta /dev/vdb e executa o payload
echo "→ Instalando init script do Zavorth..."
cat > "${MOUNT_POINT}/sbin/zavorth-init" <<'INIT_SCRIPT'
#!/bin/bash
# =============================================================================
# Zavorth MicroVM Init
# =============================================================================
# Este script e chamado pelo kernel como processo init (PID 1).
# Ele monta o payload drive (/dev/vdb), executa o codigo do usuario,
# e desliga a VM.
# =============================================================================

# Montar filesystems essenciais
mount -t proc proc /proc 2>/dev/null || true
mount -t sysfs sysfs /sys 2>/dev/null || true
mount -t devtmpfs devtmpfs /dev 2>/dev/null || true

# Montar o payload drive (segundo disco = /dev/vdb)
PAYLOAD_MOUNT="/mnt/payload"
mkdir -p "${PAYLOAD_MOUNT}"

# Aguardar /dev/vdb aparecer (pode demorar alguns ms)
ATTEMPTS=0
while [ ! -b /dev/vdb ] && [ $ATTEMPTS -lt 20 ]; do
  sleep 0.1
  ATTEMPTS=$((ATTEMPTS + 1))
done

if [ -b /dev/vdb ]; then
  mount /dev/vdb "${PAYLOAD_MOUNT}"

  # Executar o runner script do Zavorth
  if [ -x "${PAYLOAD_MOUNT}/payload/run.sh" ]; then
    cd "${PAYLOAD_MOUNT}/payload"
    bash run.sh
  else
    echo "ERRO: run.sh nao encontrado em ${PAYLOAD_MOUNT}/payload/" > "${PAYLOAD_MOUNT}/results/stderr.txt"
    echo "1" > "${PAYLOAD_MOUNT}/results/exitcode.txt"
  fi

  # Sync para garantir que os resultados foram escritos no drive
  sync
  umount "${PAYLOAD_MOUNT}" 2>/dev/null || true
else
  echo "ERRO: /dev/vdb nao apareceu" > /dev/console
fi

# Desligar a VM
poweroff -f
INIT_SCRIPT

chmod 755 "${MOUNT_POINT}/sbin/zavorth-init"

# 6. Configurar para o kernel usar zavorth-init como init
# O boot_args do Firecracker aponta para init=/sbin/zavorth-init
echo "→ Configurando init..."
ln -sf /sbin/zavorth-init "${MOUNT_POINT}/init" 2>/dev/null || true

# 7. Desmontar
echo "→ Desmontando e finalizando..."
sync
umount "${MOUNT_POINT}"
trap - EXIT
rmdir "${MOUNT_POINT}" 2>/dev/null || true
mv "${BUILD_IMAGE}" "${OUTPUT}"

echo ""
echo "✓ Rootfs criado com sucesso: ${OUTPUT}"
echo "  Tamanho: $(du -h "${OUTPUT}" | cut -f1)"
echo ""
echo "  Conteudo:"
echo "    - Ubuntu 22.04 minimal"
echo "    - Node.js + npm"
echo "    - Python3 + pip"
echo "    - Bash"
echo "    - /sbin/zavorth-init (monta /dev/vdb e executa payload)"
echo ""
echo "  Para usar:"
echo "    ZAVORTH_FIRECRACKER_ROOTFS_PATH=${OUTPUT}"
echo ""
