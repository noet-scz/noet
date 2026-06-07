#!/usr/bin/env bash
# noet — установка локального резолвера (демона) для Linux.
# Ставит один раз: kubo (IPFS) + демон noet как фоновые сервисы systemd --user.
# После этого noet.nt и личные страницы открываются в браузере как обычные сайты,
# а контент тянется из IPFS напрямую у тебя на машине. Сервер хранит только имена.
#
#   curl -fsSL https://noet-scz.github.io/noet/dist/install.sh | bash
#
# Переопределить адрес реестра имён:
#   REGISTRY_URL=http://1.2.3.4:8090 curl -fsSL .../install.sh | bash
set -euo pipefail

REGISTRY_URL="${REGISTRY_URL:-http://127.0.0.1:8091}"
REPO_RAW="https://raw.githubusercontent.com/noet-scz/noet/main"
APP="$HOME/.local/share/noet"
IPFS_REPO="$APP/ipfs-repo"
UNITS="$HOME/.config/systemd/user"
PAC_URL="https://noet-scz.github.io/noet/dist/proxy.pac"

say() { printf '\033[1;35mnoet\033[0m %s\n' "$1"; }

# --- node ---
if ! command -v node >/dev/null 2>&1; then
  echo "Нужен Node.js 18+. Поставь его пакетным менеджером и запусти снова." >&2
  exit 1
fi
NODE="$(command -v node)"

say "качаю файлы демона → $APP"
mkdir -p "$APP/web" "$APP/vendor" "$UNITS"
for f in server.mjs ws.mjs; do
  curl -fsSL "$REPO_RAW/$f" -o "$APP/$f"
done
for f in widget.js account.js i18n.js app.css logo.svg search.html account.html relay.html; do
  curl -fsSL "$REPO_RAW/web/$f" -o "$APP/web/$f"
done
curl -fsSL "$REPO_RAW/vendor/noble-secp256k1.js" -o "$APP/vendor/noble-secp256k1.js"

# --- kubo (IPFS) ---
if [ ! -x "$APP/ipfs" ]; then
  say "ставлю kubo (IPFS)"
  KV="v0.41.0"; ARCH="$(uname -m)"; case "$ARCH" in x86_64) A=amd64;; aarch64|arm64) A=arm64;; *) A=amd64;; esac
  TMP="$(mktemp -d)"
  curl -fsSL "https://dist.ipfs.tech/kubo/${KV}/kubo_${KV}_linux-${A}.tar.gz" -o "$TMP/kubo.tgz"
  tar -xzf "$TMP/kubo.tgz" -C "$TMP"
  cp "$TMP/kubo/ipfs" "$APP/ipfs"; chmod +x "$APP/ipfs"; rm -rf "$TMP"
fi
if [ ! -d "$IPFS_REPO" ]; then
  say "инициализирую IPFS-репозиторий"
  IPFS_PATH="$IPFS_REPO" "$APP/ipfs" init >/dev/null 2>&1 || true
fi

# --- systemd сервисы ---
say "создаю фоновые сервисы"
cat > "$UNITS/noet-ipfs.service" <<EOF
[Unit]
Description=noet — IPFS (kubo)
After=network.target

[Service]
Environment=IPFS_PATH=$IPFS_REPO
ExecStart=$APP/ipfs daemon --routing=auto
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
EOF

cat > "$UNITS/noet-daemon.service" <<EOF
[Unit]
Description=noet — локальный резолвер (PAC target для *.nt и *.me)
After=network.target noet-ipfs.service
Wants=noet-ipfs.service

[Service]
WorkingDirectory=$APP
Environment=PORT=8090
Environment=IPFS_GW=http://127.0.0.1:8080
Environment=IPFS_API=http://127.0.0.1:5001
Environment=REGISTRY_URL=$REGISTRY_URL
ExecStart=$NODE $APP/server.mjs
Restart=always
RestartSec=2

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now noet-ipfs.service
systemctl --user enable --now noet-daemon.service

say "готово. демон слушает 127.0.0.1:8090"
echo
echo "Осталось один раз указать браузеру PAC:"
echo "  Vivaldi:  echo '--proxy-pac-url=$PAC_URL' > ~/.config/vivaldi-stable.conf"
echo "  Chrome:   echo '--proxy-pac-url=$PAC_URL' > ~/.config/chrome-flags.conf"
echo "  Brave:    echo '--proxy-pac-url=$PAC_URL' > ~/.config/brave-flags.conf"
echo "  Firefox:  Настройки → Сеть → URL автонастройки прокси → $PAC_URL"
echo
echo "Перезапусти браузер и открой http://noet.nt/"
