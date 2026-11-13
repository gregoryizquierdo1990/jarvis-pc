#!/usr/bin/env bash
# Script para compilar el APK de Agente Milos para Android
set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

echo "=========================================="
echo "🤖 Compilador de APK - Agente Milos Android"
echo "=========================================="

# 1. Comprobar Java / JDK
if ! command -v javac &> /dev/null; then
    echo "⚠️ Java Development Kit (JDK) no encontrado."
    echo "Para compilar el APK en Linux, se requiere OpenJDK 17."
    echo "Instalando openjdk-17-jdk (se solicitará contraseña sudo si es necesario)..."
    if command -v apt-get &> /dev/null; then
        sudo apt-get update && sudo apt-get install -y openjdk-17-jdk
    else
        echo "❌ No se pudo instalar automáticamente. Por favor instale OpenJDK 17 o abra el proyecto en Android Studio:"
        echo "   npx cap open android"
        exit 1
    fi
fi

echo "✅ Java instalado: $(javac -version 2>&1)"

# 2. Compilar aplicación web
echo "📦 1/3 Compilando frontend optimizado..."
npm run build

# 3. Sincronizar con el proyecto Android nativo de Capacitor
echo "🔄 2/3 Sincronizando assets nativos con Capacitor Android..."
npx cap sync android

# 4. Compilar APK usando el wrapper de Gradle
echo "🔨 3/3 Compilando APK nativo con Gradle..."
cd android

# Asegurar permisos de ejecución en gradlew
chmod +x gradlew

# Si ANDROID_HOME no está definido, intentar buscar en ubicaciones estándar
if [ -z "$ANDROID_HOME" ]; then
    if [ -d "$HOME/Android/Sdk" ]; then
        export ANDROID_HOME="$HOME/Android/Sdk"
    elif [ -d "/usr/lib/android-sdk" ]; then
        export ANDROID_HOME="/usr/lib/android-sdk"
    fi
fi

if [ -n "$ANDROID_HOME" ]; then
    echo "📱 Usando Android SDK en: $ANDROID_HOME"
fi

if ./gradlew assembleDebug; then
    cd "$PROJECT_DIR"
    APK_SRC="android/app/build/outputs/apk/debug/app-debug.apk"
    APK_DEST="milos-assistant.apk"
    if [ -f "$APK_SRC" ]; then
        cp "$APK_SRC" "$APK_DEST"
        echo ""
        echo "=========================================================="
        echo "🎉 ¡ÉXITO! APK de Agente Milos generado correctamente:"
        echo "   Ubicación: $PROJECT_DIR/$APK_DEST"
        echo "=========================================================="
        echo "Para instalar en su teléfono Android:"
        echo "1. Envíese el archivo '$APK_DEST' por Telegram o páselo por cable USB / Google Drive."
        echo "2. O si tiene el teléfono conectado por USB con Depuración activa:"
        echo "   adb install $APK_DEST"
    fi
else
    cd "$PROJECT_DIR"
    echo ""
    echo "💡 NOTA: Si Gradle no encontró el Android SDK completo en la terminal,"
    echo "puede abrir el proyecto directamente en Android Studio con un solo clic:"
    echo "   npx cap open android"
    echo "y seleccionar: Build -> Build Bundle(s) / APK(s) -> Build APK(s)."
fi
