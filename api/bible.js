import { call, fromApp, key, limited, pass, query, send } from './_lib.js'

/*
 * GET /api/bible?path=/bibles/…: reads API.Bible with Krustr Studio's key, for the app's licensed Bibles (NIV,
 * NLT…). Only the reads the app makes are allowed: the list of Bibles, one Bible, its books, a chapter and a
 * search. FUMS reporting stays in the app (it needs no key).
 */

const API = 'https://rest.api.bible/v1'
const ID = '[A-Za-z0-9-]{1,64}'
const ALLOWED = new RegExp(`^/bibles(/${ID}(/books|/chapters/[0-9A-Z]{3}\\.\\d{1,3}|/search)?)?$`)
const PARAMS = new Set([
  'include-chapters',
  'content-type',
  'include-notes',
  'include-titles',
  'include-chapter-numbers',
  'include-verse-numbers',
  'include-verse-spans',
  'fums-version',
  'query',
  'limit',
  'sort'
])

export default async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'Use GET.' }, { Allow: 'GET' })
  if (!fromApp(req)) return send(res, 403, { error: 'This address is for the Krustr Studio app.' })
  if (limited(req, 'bible', 400)) {
    return send(res, 429, { error: 'Too many Bible requests from this network. Try again in a few minutes.' }, { 'Retry-After': '120' })
  }
  const wanted = new URL(String(query(req).get('path') ?? ''), 'http://x')
  if (!ALLOWED.test(wanted.pathname)) return send(res, 404, { error: 'Not a Bible request the relay makes.' })
  const params = new URLSearchParams()
  for (const [k, v] of wanted.searchParams) if (PARAMS.has(k) && v.length <= 200) params.append(k, v)
  const k = key('API_BIBLE_KEY')
  if (!k) return send(res, 502, { error: "Krustr Studio's API.Bible access isn't set up." })
  const qs = params.toString()
  const upstream = await call(`${API}${wanted.pathname}${qs ? `?${qs}` : ''}`, { headers: { 'api-key': k } }, 15_000)
  // 403 from API.Bible means "a Bible outside the plan" as often as a bad key; say so plainly.
  if (upstream?.status === 403) return send(res, 403, { error: "Krustr Studio's API.Bible plan doesn't include that Bible." })
  return pass(res, upstream, 'API.Bible')
}
