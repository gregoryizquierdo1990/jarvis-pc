#!/usr/bin/env bash
# Script para instalar y levantar MoneyPrinterTurbo
set -e

echo "=========================================================="
echo "🎬 Configuración e Inicio de MoneyPrinterTurbo"
echo "   Repositorio: https://github.com/harry0703/MoneyPrinterTurbo"
echo "=========================================================="

echo "Seleccione cómo desea ejecutar MoneyPrinterTurbo:"
echo "1) Vía Docker (Recomendado: descarga y levanta la imagen oficial en 1 paso)"
echo "2) Clonar repositorio con Git e instalar dependencias con Python"
echo "3) Salir"
echo ""

read -p "Opción [1-3]: " opcion

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
        if [ ! -d "$TARGET_DIR" ]; then
            echo "📥 Clonando repositorio en $TARGET_DIR..."
            git clone https://github.com/harry0703/MoneyPrinterTurbo.git "$TARGET_DIR"
        fi
        cd "$TARGET_DIR"
        echo "📦 Instalando dependencias Python..."
        pip install -r requirements.txt
        echo "🚀 Iniciando MoneyPrinterTurbo..."
        python main.py
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
