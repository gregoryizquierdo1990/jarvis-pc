#!/usr/bin/env bash
set -e

echo "=== Configuración de NoiseTorch (Cancelación de Ruido AI para Milos) ==="

# 1. Comprobar utilidades de audio
if command -v pacmd >/dev/null 2>&1 || command -v pactl >/dev/null 2>&1; then
    echo "✓ Utilidades de audio del sistema detectadas."
fi

# 2. Comprobar si NoiseTorch ya está instalado
if command -v noisetorch >/dev/null 2>&1 || [ -f "$HOME/.local/bin/noisetorch" ]; then
    echo "✓ NoiseTorch ya está instalado en: $HOME/.local/bin/noisetorch"
else
    echo "Descargando e instalando NoiseTorch v0.12.2 oficial..."
    curl -sL "https://github.com/noisetorch/NoiseTorch/releases/download/v0.12.2/NoiseTorch_x64_v0.12.2.tgz" | tar -C "$HOME" -xzf -
    chmod +x "$HOME/.local/bin/noisetorch"
    # Asegurar capabilities para audio si es posible
    setcap 'CAP_SYS_RESOURCE=+ep' "$HOME/.local/bin/noisetorch" 2>/dev/null || true
    echo "✓ Binario instalado en $HOME/.local/bin/noisetorch"
fi

echo ""
echo "=========================================================="
echo "✓ NoiseTorch instalado y listo para usar."
echo "Para activar el micrófono virtual limpio con IA:"
echo "1. Ejecuta: ~/.local/bin/noisetorch"
echo "2. Selecciona tu micrófono físico y pulsa 'Load NoiseTorch'."
echo "3. En Zorin OS, selecciona 'NoiseTorch Microphone' como micro predeterminado."
echo "=========================================================="
