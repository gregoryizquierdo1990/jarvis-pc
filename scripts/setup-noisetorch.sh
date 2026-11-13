#!/usr/bin/env bash
set -e

echo "=== Configuración de NoiseTorch (Cancelación de Ruido AI para Milos) ==="

# 1. Comprobar utilidades de audio
if command -v pacmd >/dev/null 2>&1 || command -v pactl >/dev/null 2>&1; then
    echo "✓ Utilidades de audio del sistema detectadas."
else
    echo "Instalando utilidades de audio..."
    sudo apt update && sudo apt install -y pulseaudio-utils alsa-utils
fi

# 2. Comprobar si NoiseTorch ya está instalado
if command -v noisetorch >/dev/null 2>&1; then
    echo "✓ NoiseTorch ya está instalado en: $(which noisetorch)"
else
    echo "Descargando e instalando NoiseTorch oficial..."
    curl -s https://raw.githubusercontent.com/lawl/NoiseTorch/master/install.sh | bash
fi

echo ""
echo "=========================================================="
echo "✓ NoiseTorch instalado correctamente."
echo "Para activar el micrófono virtual limpio con IA:"
echo "1. Ejecuta: noisetorch"
echo "2. Selecciona tu micrófono físico y pulsa 'Load NoiseTorch'."
echo "3. En Zorin OS, selecciona 'NoiseTorch Microphone' como micro predeterminado."
echo "=========================================================="
