import { call, fromApp, key, limited, send } from './_lib.js'

/*
 * GET /api/speech-token: a short-lived Azure Speech pass for the app's live sermon transcript. Azure's passes
 * last 10 minutes; the app asks for a new one every 8. The key itself (AZURE_SPEECH_KEY, with
 * AZURE_SPEECH_REGION) never leaves the relay. The audio goes from the app straight to Azure with the pass.
 */

export default async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'Use GET.' }, { Allow: 'GET' })
  if (!fromApp(req)) return send(res, 403, { error: 'This address is for the Krustr Studio app.' })
  // A 2-hour service needs about 15 passes; this leaves room for reconnects.
  if (limited(req, 'speech', 40)) {
    return send(res, 429, { error: 'Too many speech passes from this network. Try again in a few minutes.' }, { 'Retry-After': '120' })
  }
  const k = key('AZURE_SPEECH_KEY')
  const region = key('AZURE_SPEECH_REGION').toLowerCase().replace(/[^a-z0-9]/g, '')
  if (!k || !region) return send(res, 502, { error: "Krustr Studio's speech access isn't set up." })
  const upstream = await call(
    `https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`,
    { method: 'POST', headers: { 'Ocp-Apim-Subscription-Key': k, 'Content-Length': '0' } },
    10_000
  )
  if (!upstream) return send(res, 504, { error: 'Azure Speech didn’t answer in time.' })
  if (upstream.status === 401 || upstream.status === 403) {
    console.error(`Azure Speech refused the relay's key (${upstream.status})`)
    return send(res, 502, { error: "Krustr Studio's speech access isn't working right now." })
  }
  if (!upstream.ok) return send(res, 502, { error: `Azure Speech answered with an error (${upstream.status}).` })
  send(res, 200, { token: await upstream.text(), region, expiresIn: 600 })
}
