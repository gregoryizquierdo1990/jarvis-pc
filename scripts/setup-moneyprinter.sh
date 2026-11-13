#!/usr/bin/env bash
# Script para instalar y levantar MoneyPrinterTurbo
set -e

echo "=========================================================="
echo "🎬 Configuración e Inicio de MoneyPrinterTurbo"
echo "   Repositorio: https://github.com/harry0703/MoneyPrinterTurbo"
echo "=========================================================="

opcion="${1:-}"
if [ -z "$opcion" ]; then
    if [ -t 0 ]; then
        echo "Seleccione cómo desea ejecutar MoneyPrinterTurbo:"
        echo "1) Vía Docker (descarga y levanta la imagen oficial)"
        echo "2) Clonar repositorio con Git e instalar dependencias con Python (Automático si no hay Docker)"
        echo "3) Salir"
        echo ""
        read -p "Opción [1-3]: " opcion
    else
        if command -v docker &> /dev/null; then
            opcion="1"
        else
            opcion="2"
        fi
    fi
fi

case $opcion in
    1)
        echo "🐳 Verificando Docker..."
        if ! command -v docker &> /dev/null; then
            echo "❌ Docker no está instalado. Instalándolo o use la opción 2."
            exit 1
        fi
        echo "Iniciando contenedor oficial de MoneyPrinterTurbo en puertos 8080 (API) y 8501 (WebUI)..."
        docker run -d --name moneyprinterturbo \
            -p 8080:8080 \
            -p 8501:8501 \
            --restart unless-stopped \
            harry0703/moneyprinterturbo || docker start moneyprinterturbo
        echo "✅ MoneyPrinterTurbo está activo en:"
        echo "   - API Backend: http://localhost:8080"
        echo "   - Interfaz Web: http://localhost:8501"
        ;;
    2)
        TARGET_DIR="$HOME/Documentos/MoneyPrinterTurbo"
        if [ ! -d "$TARGET_DIR/.git" ]; then
            echo "📥 Clonando repositorio ligero (--depth 1) en $TARGET_DIR..."
            rm -rf "$TARGET_DIR"
            git clone --depth 1 https://github.com/harry0703/MoneyPrinterTurbo.git "$TARGET_DIR"
        fi
        cd "$TARGET_DIR"
        echo "📦 Instalando dependencias Python..."
        pip3 install -r requirements.txt
        echo "🚀 Iniciando MoneyPrinterTurbo en segundo plano..."
        nohup python3 main.py > moneyprinter.log 2>&1 &
        echo "✓ MoneyPrinterTurbo iniciado en segundo plano. Logs en: $TARGET_DIR/moneyprinter.log"
        ;;
    3)
        echo "Operación cancelada."
        exit 0
        ;;
    *)
        echo "Opción no válida."
        exit 1
        ;;
esac
