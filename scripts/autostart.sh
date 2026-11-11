#!/usr/bin/env bash
set -e
cd /home/admin1/Documentos/jarvis
# Wait for network
sleep 8
# Start bridge + face in background
nohup npm start > /tmp/opencode/jarvis.log 2>&1 &
sleep 12
# Open browser
if command -v google-chrome >/dev/null 2>&1; then
  google-chrome http://localhost:5180 &
elif command -v chromium-browser >/dev/null 2>&1; then
  chromium-browser http://localhost:5180 &
elif command -v firefox >/dev/null 2>&1; then
  firefox http://localhost:5180 &
fi