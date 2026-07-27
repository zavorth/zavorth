#!/usr/bin/env bash
set -euo pipefail

SSH_PORT="${SSH_PORT:-22}"
if [ -n "${ZAVORTH_PORT:-}" ]; then
  ZAVORTH_PORT="${ZAVORTH_PORT}"
else
  ZAVORTH_PORT="33333"
fi

echo "[hardening] preparando host Linux para Zavorth"

if command -v apt-get >/dev/null 2>&1; then
  apt-get update
  apt-get install -y ufw auditd acl libseccomp2
fi

if command -v ufw >/dev/null 2>&1; then
  ufw default deny incoming
  ufw default allow outgoing
  ufw allow "${SSH_PORT}/tcp"
  ufw allow "${ZAVORTH_PORT}/tcp"
  ufw --force enable
fi

if command -v systemctl >/dev/null 2>&1; then
  systemctl enable auditd || true
  systemctl start auditd || true
fi

if [ "$(id -u)" -eq 0 ] && command -v sysctl >/dev/null 2>&1; then
  cat >/etc/sysctl.d/99-zavorth-hardening.conf <<'EOF'
kernel.dmesg_restrict=1
kernel.kptr_restrict=2
kernel.yama.ptrace_scope=1
net.ipv4.conf.all.rp_filter=1
net.ipv4.conf.default.rp_filter=1
net.ipv4.tcp_syncookies=1
net.ipv6.conf.all.accept_redirects=0
net.ipv6.conf.default.accept_redirects=0
net.ipv4.conf.all.accept_redirects=0
net.ipv4.conf.default.accept_redirects=0
EOF
  sysctl --system || true
fi

if [ -e /dev/kvm ] && command -v setfacl >/dev/null 2>&1; then
  setfacl -m u:node:rw /dev/kvm || true
fi

echo "[hardening] completed"
echo "[hardening] allowed ports: ${SSH_PORT}, ${ZAVORTH_PORT}"
