---
name: Milos Dev
description: Guía para trabajar en el código del Agente Milos (jarvis) — backend Gemini directo, bridge local 8787, memoria híbrida IndexedDB+Obsidian, herramientas, y la cadena de arranque. Usar siempre que se modifique o amplíe este repositorio.
---

# Desarrollo del Agente Milos (jarvis)

Asistente personal en español que trata al usuario de "señor". Nombre: Agente Milos.

## Reglas duras

- TODAS las respuestas del agente al usuario son en español (los comentarios del
  código pueden ir en español también).
- El agente NUNCA usa imágenes de robot como fondo ni avatar en pantalla.
- Las claves API viven SOLO en `.env.local` (nunca commiteado) o en
  `~/.config/jarvis/` (archivos planos). Nunca en el código.

## Arquitectura

- **Cerebro**: `src/lib/gemini.ts` — loop de function-calling contra la API
  pública de Gemini vía `src/lib/geminiApi.ts` (reintentos, rotación de claves
  primaria/secundaria, cadena de modelos de respaldo, modelo "sticky" 5 min).
  Modelo objetivo: `gemini-3.8-flash`.
- **Bridge**: `bridge/server.mjs` — servidor HTTP en :8787 con endpoints para
  repo git (`/repo/*`), bóveda Obsidian (`/obsidian/*`), correo (`/mail/*`),
  archivos (`/files/*`), extracción (`/extract/*`), Telegram (`/telegram/send`,
  `/telegram/pending`). Lee configuración de `~/.config/jarvis/` EN TIEMPO DE
  PETICIÓN (repo-path, vault-path, telegram-token) — cambiar la ruta no
  requiere reiniciar.
- **Memoria híbrida**: IndexedDB (`src/lib/memory.ts`, journal.ts, calendar.ts)
  para RAG rápido + espejo best-effort en Markdown a la bóveda de Obsidian
  (`~/Documentos/Boveda-Milos`, cliente en `src/lib/obsidian.ts`). Si el bridge
  no está, la memoria IndexedDB sigue funcionando.
- **Telegram como puerta de chatbot**: el bridge hace long-poll de
  `getUpdates` (token en `~/.config/jarvis/telegram-token`, offset persistido
  en `telegram-offset`), encola mensajes; App.tsx sondea `/telegram/pending`
  cada 4 s, pasa el mensaje por el MISMO conducto que la voz (`respond()` con
  `via: 'telegram'`) y devuelve la respuesta con `/telegram/send`.
- **UI**: `src/ui/PersonalAssistant.tsx` con pestañas (memoria, calendario,
  archivos, correo, telegram, ingesta, repo, notas). Estilos `pa-*` en
  `src/index.css`.

## Flujo de trabajo

1. `npx tsc -b` debe pasar SIN errores antes de dar por terminado un cambio.
2. El vite en desarrollo hace HMR: los cambios de frontend se aplican solos.
   Los cambios de `.env.local` o del bridge requieren reinicio completo.
3. Reinicio de producción (¡por PID exacto, nunca `pkill -f`!):
   - localizar el PID de `node scripts/start.mjs`
   - matar ese PID (bridge y vite mueren con él)
   - relanzar: `nohup npm start > /tmp/opencode/jarvis.log &`
4. Pruebas de humo del bridge:
   - `curl http://localhost:8787/obsidian/root`
   - `curl http://localhost:8787/telegram/pending`
   - `curl http://localhost:8787/repo/status`

## Convenciones

- Herramientas nuevas para el agente: declaración en `toolDeclarations` +
  case en `executeTool` (ambos en `src/lib/gemini.ts`), y mención en la
  sección correspondiente del prompt de sistema.
- Endpoints nuevos del bridge: helpers arriba de `handleRequest` + ruta
  antes del 404 final. Validar rutas contra traversals con los helpers
  `insideRepo`/`insideVault`.
- Los clientes frontend hablan al bridge con
  `(window as any).__BRIDGE_HTTP__ || 'http://localhost:8787'`.
