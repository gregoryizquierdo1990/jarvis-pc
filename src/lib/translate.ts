/**
 * Traducción multilingüe usando Gemini (texto o audio transcrito).
 */

import { generateContent, geminiKeys } from './geminiApi'

export const LANGS: Record<string, string> = {
  es: 'español', en: 'inglés', fr: 'francés', de: 'alemán', it: 'italiano',
  pt: 'portugués', zh: 'chino', ja: 'japonés', ko: 'coreano', ru: 'ruso',
  ar: 'árabe', hi: 'hindi', nl: 'holandés', tr: 'turco', pl: 'polaco',
}

export async function translate(text: string, target: string, source?: string): Promise<string> {
  if (geminiKeys().length === 0) throw new Error('Sin clave Gemini')
  const targetName = LANGS[target.toLowerCase()] || target
  const sourceHint = source ? ` desde ${LANGS[source.toLowerCase()] || source}` : ''
  const prompt = `Traduce el siguiente texto${sourceHint} al ${targetName}. Devuelve SOLO la traducción, sin explicaciones ni comillas.\n\nTEXTO:\n${text}`
  const data = await generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 8192 },
  })
  return (data?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim()
}

export async function detectLanguage(text: string): Promise<string> {
  if (geminiKeys().length === 0) throw new Error('Sin clave Gemini')
  const data = await generateContent({
    contents: [{ role: 'user', parts: [{ text: `Detecta el idioma del siguiente texto. Responde SOLO con el código ISO de 2 letras (es, en, fr, ...).\n\n${text}` }] }],
    generationConfig: { temperature: 0, maxOutputTokens: 8 },
  })
  return (data?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim().toLowerCase()
}
