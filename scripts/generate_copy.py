#!/usr/bin/env python3
"""
Generador Inteligente de Copys de Ventas para WhatsApp y Redes Sociales.
Utiliza la API de Google Gemini para redactar mensajes persuasivos de alta conversión
basados en estructuras comerciales probadas (Gancho, Oferta, Urgencia y CTA).
"""

import os
import sys
import argparse
from pathlib import Path

# Intentar importar la biblioteca de Google Gemini
try:
    from google import genai
    USE_NEW_SDK = True
except ImportError:
    try:
        import google.generativeai as genai
        USE_NEW_SDK = False
    except ImportError:
        USE_NEW_SDK = None

def load_gemini_api_key():
    """Busca la API Key en el entorno o en el archivo .env.local del proyecto."""
    key = os.getenv("GEMINI_API_KEY") or os.getenv("VITE_GEMINI_API_KEY")
    if key:
        return key

    # Buscar en .env.local o .env
    base_dir = Path(__file__).resolve().parent.parent
    for env_file in [base_dir / ".env.local", base_dir / ".env"]:
        if env_file.exists():
            for line in env_file.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if line.startswith("VITE_GEMINI_API_KEY="):
                    return line.split("=", 1)[1].strip().strip('"').strip("'")
                elif line.startswith("GEMINI_API_KEY="):
                    return line.split("=", 1)[1].strip().strip('"').strip("'")
    return None

def generar_copys_ventas(producto, precio, modalidad_pago="Pago Móvil / Binance USDT / Zinli / Efectivo", formato="todos", categoria="general"):
    api_key = load_gemini_api_key()
    if not api_key:
        return (
            "❌ Error: No se encontró la clave GEMINI_API_KEY.\n"
            "Por favor asegúrese de tenerla configurada en .env.local (VITE_GEMINI_API_KEY)."
        )

    prompt = f"""
Actúa como el mejor redactor comercial (copywriter) de ventas para WhatsApp, Telegram y redes sociales.
Tu misión es redactar textos publicitarios de ALTA CONVERSIÓN basados en las estructuras comerciales de ventas (Gancho impactante, Oferta clara, Urgencia/Escasez y Llamada a la Acción precisa).

DATOS DEL PRODUCTO:
- Producto / Servicio: {producto}
- Precio de venta: {precio}
- Modalidades de pago aceptadas: {modalidad_pago}
- Categoría: {categoria}

INSTRUCCIONES DE FORMATO:
Redacta exactamente dos versiones optimizadas con emojis llamativos y redacción profesional persuasiva en español:

========================================
📱 OPCIÓN 1: ESTADO DE WHATSAPP (Rápido y Viral)
========================================
- Longitud: Corto, directo y contundente (máximo 4 a 6 líneas).
- Gancho disruptivo en la primera línea.
- Precio visible en negrita.
- Llamada a la acción (ej. "Responde este estado ya" o "Toca aquí para pedir el tuyo").

========================================
👥 OPCIÓN 2: GRUPOS DE COMPRA-VENTA (Completo con Viñetas)
========================================
- Encabezado llamativo con emojis.
- Explicación del beneficio principal y garantía.
- Lista limpia con viñetas de lo que incluye.
- Lista destacada de métodos de pago ({modalidad_pago}).
- Llamada a la acción hacia el chat directo o Telegram.

No agregues introducciones innecesarias; entrega directamente las dos opciones listas para copiar y pegar.
"""

    try:
        candidate_models = [
            "gemini-flash-lite-latest",
            "gemini-3.7-flash",
            "gemini-3.5-flash-lite",
            "gemini-3.8-flash",
            "gemini-2.0-flash",
        ]

        last_err = None
        if USE_NEW_SDK:
            client = genai.Client(api_key=api_key)
            for m in candidate_models:
                try:
                    response = client.models.generate_content(
                        model=m,
                        contents=prompt,
                    )
                    if response and response.text:
                        return response.text
                except Exception as e:
                    last_err = e
                    continue
            return f"❌ Error al contactar la API de Gemini tras probar modelos de respaldo: {last_err}"
        elif USE_NEW_SDK is False:
            genai.configure(api_key=api_key)
            for m in candidate_models:
                try:
                    model = genai.GenerativeModel(m)
                    response = model.generate_content(prompt)
                    if response and response.text:
                        return response.text
                except Exception as e:
                    last_err = e
                    continue
            return f"❌ Error al contactar la API de Gemini: {last_err}"
        else:
            return "❌ Error: Debe instalar el SDK de Gemini ejecutando: pip3 install google-genai"
    except Exception as e:
        return f"❌ Error al contactar la API de Gemini: {e}"

def main():
    parser = argparse.ArgumentParser(description="Generador de Copys Comerciales con Gemini para Agente Milos")
    parser.add_argument("--producto", "-p", required=True, help="Nombre del producto o servicio (ej. 'Max Platino 1 Mes')")
    parser.add_argument("--precio", "-pr", required=True, help="Precio de venta (ej. '3.50$' o '150 Bs')")
    parser.add_argument("--modalidad", "-m", default="Pago Móvil / Binance USDT / Zinli / Efectivo", help="Métodos de pago aceptados")
    parser.add_argument("--categoria", "-c", default="general", help="Categoría: streaming, comida, confeccion, recargas, general")
    parser.add_argument("--formato", "-f", default="todos", choices=["todos", "estado", "grupo"], help="Formato de salida")

    args = parser.parse_args()

    print("\n🚀 Generando copys de alta conversión con Agente Milos...\n")
    resultado = generar_copys_ventas(
        producto=args.producto,
        precio=args.precio,
        modalidad_pago=args.modalidad,
        categoria=args.categoria,
        formato=args.formato,
    )
    print(resultado)
    print("\n✨ ¡Listo para copiar, pegar y vender! ✨\n")

if __name__ == "__main__":
    main()
