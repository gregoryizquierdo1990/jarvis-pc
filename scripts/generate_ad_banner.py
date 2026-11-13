#!/usr/bin/env python3
"""
Generador Autónomo de Banners y Piezas Publicitarias para Agente Milos.
Crea piezas gráficas de alta definición (1080p) con fondos degradados modernos,
tipografía profesional, badges de precio y métodos de pago (Pago Móvil, Binance, etc.)
sin requerir GPUs pesadas.
"""

import os
import sys
import argparse
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

def get_font(size, bold=True):
    font_paths = [
        "/usr/share/fonts/truetype/space-grotesk-zorin-os/SpaceGrotesk-Bold.ttf" if bold else "/usr/share/fonts/truetype/space-grotesk-zorin-os/SpaceGrotesk-Regular.ttf",
        "/usr/share/fonts/truetype/roboto/unhinted/RobotoTTF/Roboto-Bold.ttf" if bold else "/usr/share/fonts/truetype/roboto/unhinted/RobotoTTF/Roboto-Regular.ttf",
        "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for p in font_paths:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                continue
    return ImageFont.load_default()

def draw_gradient_background(width, height, top_color, bottom_color):
    base = Image.new("RGBA", (width, height), top_color)
    top_r, top_g, top_b = top_color[:3]
    bot_r, bot_g, bot_b = bottom_color[:3]
    
    draw = ImageDraw.Draw(base)
    for y in range(height):
        ratio = y / float(height)
        r = int(top_r + (bot_r - top_r) * ratio)
        g = int(top_g + (bot_g - top_g) * ratio)
        b = int(top_b + (bot_b - top_b) * ratio)
        draw.line([(0, y), (width, y)], fill=(r, g, b, 255))
    return base

def create_ad_banner(
    titulo="MAX PLATINO + VIX",
    precio="$8.50",
    subtitulo="Películas, Series y Deportes en VIVO",
    formato="status",
    pagos="Pago Móvil · Binance USDT · Zinli · Efectivo",
    salida=None,
    categoria="streaming"
):
    # Dimensiones
    if formato == "status":
        width, height = 1080, 1920 # 9:16 WhatsApp Status / Stories
    else:
        width, height = 1080, 1080 # 1:1 Cuadrado para Grupos / Posts

    # Paleta de colores estilo Milos (Dark Cyberpunk / Neon Cyan & Gold)
    bg_top = (10, 15, 30)      # Azul muy oscuro
    bg_bottom = (3, 5, 12)     # Casi negro
    cyan_neon = (0, 225, 255)  # Cyan neón
    gold_accent = (255, 204, 0)# Oro brillante
    white = (255, 255, 255)
    gray_light = (200, 210, 230)
    card_bg = (20, 28, 50, 220)

    # Crear fondo degradado
    img = draw_gradient_background(width, height, bg_top, bg_bottom)
    draw = ImageDraw.Draw(img, "RGBA")

    # Marco o resplandor de acento superior
    draw.rectangle([(0, 0), (width, 16)], fill=cyan_neon)
    draw.rectangle([(0, height - 16), (width, height)], fill=gold_accent)

    # 1. Cinta Superior (Badge de Oferta)
    badge_font = get_font(32, bold=True)
    badge_text = "⚡ OFERTA ESPECIAL · ENTREGA INMEDIATA ⚡"
    draw.rounded_rectangle([(140, 70), (width - 140, 140)], radius=35, fill=(0, 225, 255, 40), outline=cyan_neon, width=3)
    bbox = draw.textbbox((0, 0), badge_text, font=badge_font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text(((width - tw) // 2, 85), badge_text, font=badge_font, fill=cyan_neon)

    # 2. Título Principal
    title_font = get_font(72, bold=True)
    title_words = titulo.upper().split()
    
    # Dividir título si es largo
    if len(titulo) > 18:
        mid = len(title_words) // 2
        line1 = " ".join(title_words[:mid])
        line2 = " ".join(title_words[mid:])
        lines = [line1, line2]
    else:
        lines = [titulo.upper()]

    y_text = 200 if formato == "status" else 170
    for l in lines:
        tbox = draw.textbbox((0, 0), l, font=title_font)
        lw = tbox[2] - tbox[0]
        # Sombra de texto
        draw.text(((width - lw) // 2 + 3, y_text + 3), l, font=title_font, fill=(0, 0, 0, 180))
        draw.text(((width - lw) // 2, y_text), l, font=title_font, fill=white)
        y_text += 85

    # 3. Subtítulo descriptivo
    sub_font = get_font(36, bold=False)
    sbox = draw.textbbox((0, 0), subtitulo, font=sub_font)
    sw = sbox[2] - sbox[0]
    draw.text(((width - sw) // 2, y_text + 15), subtitulo, font=sub_font, fill=gray_light)

    # 4. Tarjeta Central con Precio Gigante
    card_top = y_text + 90
    card_h = 420 if formato == "status" else 360
    card_left = 90
    card_right = width - 90
    draw.rounded_rectangle([(card_left, card_top), (card_right, card_top + card_h)], radius=30, fill=card_bg, outline=(50, 75, 120), width=2)

    # Etiqueta "PRECIO PROMOCIONAL"
    promo_font = get_font(30, bold=True)
    promo_text = "PRECIO PROMOCIÓN"
    pbox = draw.textbbox((0, 0), promo_text, font=promo_font)
    pw = pbox[2] - pbox[0]
    draw.text(((width - pw) // 2, card_top + 35), promo_text, font=promo_font, fill=gold_accent)

    # Precio gigante
    price_font = get_font(120, bold=True)
    prbox = draw.textbbox((0, 0), precio, font=price_font)
    prw, prh = prbox[2] - prbox[0], prbox[3] - prbox[1]
    # Sombra del precio
    draw.text(((width - prw) // 2 + 4, card_top + 85 + 4), precio, font=price_font, fill=(0, 0, 0, 200))
    draw.text(((width - prw) // 2, card_top + 85), precio, font=price_font, fill=gold_accent)

    # Mensaje de garantía / activación
    garantia_font = get_font(28, bold=True)
    garantia_text = "✓ 100% GARANTIZADO · PANTALLAS ULTRA HD · SIN CAÍDAS"
    gbox = draw.textbbox((0, 0), garantia_text, font=garantia_font)
    gw = gbox[2] - gbox[0]
    draw.text(((width - gw) // 2, card_top + card_h - 70), garantia_text, font=garantia_font, fill=cyan_neon)

    # 5. Lista de Beneficios
    y_benefits = card_top + card_h + 60
    benefits = [
        "🚀 Activación inmediata en menos de 2 minutos",
        "🔒 Soporte técnico personalizado todos los días",
        "🍿 Compatible con Smart TV, Celular, TV Box y PC",
        "⚡ Renueva mes a mes con tu mismo perfil",
    ]
    ben_font = get_font(34, bold=True)
    for b in (benefits if formato == "status" else benefits[:2]):
        draw.text((120, y_benefits), b, font=ben_font, fill=white)
        y_benefits += 65

    # 6. Barra de Métodos de Pago
    y_pay = height - 320 if formato == "status" else height - 200
    pay_title_font = get_font(26, bold=True)
    pt_text = "MÉTODOS DE PAGO ACEPTADOS:"
    ptbox = draw.textbbox((0, 0), pt_text, font=pay_title_font)
    ptw = ptbox[2] - ptbox[0]
    draw.text(((width - ptw) // 2, y_pay), pt_text, font=pay_title_font, fill=gray_light)

    pay_badge_font = get_font(30, bold=True)
    draw.rounded_rectangle([(80, y_pay + 40), (width - 80, y_pay + 115)], radius=20, fill=(15, 25, 45), outline=cyan_neon, width=2)
    pbbox = draw.textbbox((0, 0), pagos, font=pay_badge_font)
    pbw = pbbox[2] - pbbox[0]
    draw.text(((width - pbw) // 2, y_pay + 58), pagos, font=pay_badge_font, fill=white)

    # 7. Llamada a la Acción (CTA) Final
    y_cta = height - 160 if formato == "status" else height - 75
    if formato == "status":
        cta_font = get_font(36, bold=True)
        cta_text = "👇 ¡RESPONDE ESTE ESTADO Y PIDE TU CUENTA YA! 👇"
        cbox = draw.textbbox((0, 0), cta_text, font=cta_font)
        cw = cbox[2] - cbox[0]
        draw.text(((width - cw) // 2, y_cta), cta_text, font=cta_font, fill=gold_accent)

    # Guardar imagen resultante
    if not salida:
        out_dir = Path(__file__).resolve().parent.parent / "banners_generados"
        out_dir.mkdir(parents=True, exist_ok=True)
        filename = f"banner_{titulo.lower().replace(' ', '_').replace('+', '_')}_{formato}.png"
        salida = str(out_dir / filename)
    else:
        Path(salida).parent.mkdir(parents=True, exist_ok=True)

    img.convert("RGB").save(salida, "PNG", quality=95)
    return salida

def main():
    parser = argparse.ArgumentParser(description="Generador Autónomo de Banners Publicitarios para Agente Milos")
    parser.add_argument("--titulo", "-t", default="MAX PLATINO + VIX", help="Título del producto o promoción")
    parser.add_argument("--precio", "-p", default="$8.50", help="Precio visible de la promoción")
    parser.add_argument("--subtitulo", "-s", default="Películas, Series y Deportes en VIVO", help="Subtítulo o descripción")
    parser.add_argument("--formato", "-f", default="status", choices=["status", "post"], help="'status' (9:16 WhatsApp) o 'post' (1:1 Cuadrado)")
    parser.add_argument("--pagos", "-m", default="Pago Móvil 🇻🇪 · Binance USDT 🟡 · Zinli 💳 · Efectivo", help="Métodos de pago a listar")
    parser.add_argument("--salida", "-o", default=None, help="Ruta del archivo de salida PNG")

    args = parser.parse_args()

    print(f"\n🎨 Diseñando banner publicitario para: '{args.titulo}' ({args.precio})...")
    path = create_ad_banner(
        titulo=args.titulo,
        precio=args.precio,
        subtitulo=args.subtitulo,
        formato=args.formato,
        pagos=args.pagos,
        salida=args.salida
    )
    print(f"✅ ¡Banner generado con éxito en alta resolución (1080p)!\n📁 Archivo: {path}\n")

if __name__ == "__main__":
    main()
