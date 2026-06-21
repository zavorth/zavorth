#!/data/data/com.termux/files/usr/bin/sh
set -eu

if [ "$(uname -o 2>/dev/null || true)" != "Android" ]; then
  echo "This installer is intended for Termux on Android." >&2
  exit 1
fi

pkg update -y
pkg install -y nodejs-lts git proot-distro
mkdir -p "$HOME/.zavorth"
echo "Termux dependencies are ready. Install Zavorth from a trusted local checkout or package source."
echo "PRoot is a compatibility layer, not a security boundary; keep untrusted code in a remote/container sandbox."
