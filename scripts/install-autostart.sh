#!/usr/bin/env bash
set -e
cd /home/admin1/Documentos/openmilos
chmod +x scripts/autostart.sh

mkdir -p ~/.config/autostart
cp scripts/jarvis.desktop ~/.config/autostart/milos.desktop

echo "✅ Autostart instalado con éxito."
echo "Agente Milos arrancará automáticamente al iniciar sesión o encender la PC."
