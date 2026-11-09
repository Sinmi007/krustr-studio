import { call, fromApp, jsonBody, key, limited, pass, send } from './_lib.js'

/*
 * POST /api/translate: machine drafts of worship-song lines into English, with Krustr Studio's own keys.
 * The app sends only the lines and their language; the request to each service is built here, so the relay
 * can't be used as a general-purpose AI or translation endpoint.
 *
 *   { service: 'gemini', model, lines: string[], source }  → Gemini's generateContent answer
 *   { service: 'naijallm', text, source }                   → NaijaLLM's { text }
 *   { service: 'langa', text, source }                      → Langa's { translation }
 *   { service: 'azure', texts: string[], source }           → Azure Translator's list
 */

const LANGS = new Set(['yo', 'ig', 'ha', 'en', ''])
const LANGUAGE_NAMES = { yo: 'Yoruba', ig: 'Igbo', ha: 'Hausa' }
const MODELS = /^gemini-\d+(\.\d+)?-flash(-lite)?$/
const MAX_LINES = 200
const MAX_LINE = 400
const MAX_TEXT = 8000

const instructions = (language) =>
  [
    `You translate Christian worship song lyrics from ${language} into English, so a congregation that doesn't speak ${language} understands what it is singing.`,
    'The input is a JSON list of sung lines. Reply with a JSON list of the same length: the English for each line, in the same order.',
    'Lyrics are often typed without tone marks or diacritics; work out the intended words from the context of a worship song.',
    'Translate the meaning faithfully and naturally, as worshippers would understand it. Praise names and titles of God (oríkì and the like) carry meaning: give that meaning in English rather than replacing them with a generic title.',
    "Keep each line short enough to read on a screen. Don't add notes, explanations, quotation marks or line numbers."
  ].join(' ')

const strings = (v, max, each) => Array.isArray(v) && v.length > 0 && v.length <= max && v.every((s) => typeof s === 'string' && s.length <= each)
const text = (v) => typeof v === 'string' && v.trim().length > 0 && v.length <= MAX_TEXT

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Use POST.' }, { Allow: 'POST' })
  if (!fromApp(req)) return send(res, 403, { error: 'This address is for the Krustr Studio app.' })
  if (limited(req, 'translate', 80)) {
    return send(res, 429, { error: 'Too many translations from this network. Try again in a few minutes.' }, { 'Retry-After': '120' })
  }
  const b = await jsonBody(req)
  if (!b || typeof b !== 'object') return send(res, 400, { error: 'The request was not valid JSON (or was too big).' })
  const source = LANGS.has(b.source) ? b.source : ''

  if (b.service === 'gemini') {
    if (!MODELS.test(String(b.model ?? ''))) return send(res, 404, { error: 'No such Gemini model.' })
    if (!strings(b.lines, MAX_LINES, MAX_LINE)) return send(res, 400, { error: 'Send the lines as a list of short strings.' })
    const k = key('GEMINI_KEY')
    if (!k) return send(res, 502, { error: "Krustr Studio's Gemini access isn't set up." })
    const language = LANGUAGE_NAMES[source] ?? 'a Nigerian language (Yoruba, Igbo, Hausa or Pidgin; work out which)'
    const upstream = await call(
      `https://generativelanguage.googleapis.com/v1beta/models/${b.model}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': k },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: instructions(language) }] },
          contents: [{ role: 'user', parts: [{ text: JSON.stringify(b.lines) }] }],
          generationConfig: { responseMimeType: 'application/json', responseSchema: { type: 'ARRAY', items: { type: 'STRING' } }, temperature: 0.3 }
        })
      },
      45_000
    )
    // Gemini answers a bad key with 400 "API key not valid": that's the relay's key, not the app's.
    if (upstream?.status === 400) {
      const body = await upstream.text()
      if (/api key/i.test(body)) return send(res, 502, { error: "Krustr Studio's Gemini access isn't working right now." })
      return send(res, 400, body)
    }
    return pass(res, upstream, 'Gemini')
  }

  if (b.service === 'naijallm') {
    if (!text(b.text) || !source) return send(res, 400, { error: "Send the text and the song's language." })
    const k = key('NAIJALLM_KEY')
    if (!k) return send(res, 502, { error: "Krustr Studio's NaijaLLM access isn't set up." })
    const upstream = await call(
      'https://asr.naijallm.com/v1/translations',
      { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${k}` }, body: JSON.stringify({ text: b.text, source, target: 'en' }) },
      30_000
    )
    return pass(res, upstream, 'NaijaLLM')
  }

  if (b.service === 'langa') {
    if (!text(b.text)) return send(res, 400, { error: 'Send the text to translate.' })
    const k = key('LANGA_KEY')
    if (!k) return send(res, 502, { error: "Krustr Studio's Langa access isn't set up." })
    const upstream = await call(
      'https://langa.julimer.com/v1/translate',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${k}` },
        body: JSON.stringify({ text: b.text, target_language: 'en', source_language: source || 'auto' })
      },
      30_000
    )
    return pass(res, upstream, 'Langa')
  }

  if (b.service === 'azure') {
    if (!strings(b.texts, 100, MAX_LINE)) return send(res, 400, { error: 'Send the lines as a list of short strings.' })
    const k = key('TRANSLATOR_KEY')
    if (!k) return send(res, 502, { error: "Krustr Studio's Azure Translator access isn't set up." })
    const headers = { 'Content-Type': 'application/json', 'Ocp-Apim-Subscription-Key': k }
    const region = key('TRANSLATOR_REGION')
    if (region) headers['Ocp-Apim-Subscription-Region'] = region
    const upstream = await call(
      `https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&to=en${source && source !== 'en' ? `&from=${source}` : ''}`,
      { method: 'POST', headers, body: JSON.stringify(b.texts.map((t) => ({ text: t }))) },
      30_000
    )
    return pass(res, upstream, 'Azure Translator')
  }

  return send(res, 400, { error: 'Unknown translation service.' })
}
