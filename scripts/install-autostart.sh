#!/usr/bin/env bash
set -e
cd /home/admin1/Documentos/jarvis
mkdir -p ~/.config/autostart
cp scripts/jarvis.desktop ~/.config/autostart/jarvis.desktop
# systemd user service (optional)
mkdir -p ~/.config/systemd/user
cp scripts/jarvis.service ~/.config/systemd/user/jarvis.service
systemctl --user daemon-reload || true
systemctl --user enable jarvis.service || true
echo "Autostart instalado. JARVIS arrancará al iniciar sesión."
