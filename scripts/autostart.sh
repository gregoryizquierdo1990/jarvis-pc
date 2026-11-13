#!/usr/bin/env bash
set -e
PROJECT_DIR="/home/admin1/Documentos/openmilos"
cd "$PROJECT_DIR"

mkdir -p /tmp/openmilos

# Esperar a que la red y el entorno gráfico se estabilicen
sleep 6

# Iniciar servidor Vite de Agente Milos
nohup npm run dev -- --port 5173 > /tmp/openmilos/milos.log 2>&1 &

# Esperar a que el servidor web local esté listo
for i in {1..30}; do
  if curl -s http://localhost:5173 >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

CHROME_FLAGS="--app=http://localhost:5173/?autostart=1 --autoplay-policy=no-user-gesture-required --use-fake-ui-for-media-stream"

# Abrir el navegador en modo app desatendida con permisos multimedia automáticos
if command -v google-chrome >/dev/null 2>&1; then
  google-chrome $CHROME_FLAGS &
elif command -v chromium-browser >/dev/null 2>&1; then
  chromium-browser $CHROME_FLAGS &
elif command -v chromium >/dev/null 2>&1; then
  chromium $CHROME_FLAGS &
elif command -v firefox >/dev/null 2>&1; then
  firefox "http://localhost:5173/?autostart=1" &
fi