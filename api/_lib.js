/*
 * Shared by the relay functions. Files starting with "_" aren't routes on Vercel.
 *
 * The relay holds Krustr Studio's API keys (Vercel environment variables, never in this repository) and does
 * a few fixed jobs for the app: translate song lines into English, and read Bibles from API.Bible. It never
 * forwards arbitrary requests, so the keys can't be used for anything else.
 */

/** A key from the environment. The .env names from the app work too, so its .env can be pasted into Vercel. */
export function key(...names) {
  for (const name of names) {
    for (const n of [name, `MAIN_VITE_${name}`]) {
      const v = (process.env[n] ?? '').trim()
      if (v) return v
    }
  }
  return ''
}

/** Only the app calls the relay; it says so in this header (with its version). */
export const fromApp = (req) => /^\d+\.\d+\.\d+/.test(String(req.headers['x-krustr-app'] ?? ''))

const WINDOW_MS = 10 * 60 * 1000
const hits = new Map()

/**
 * A simple per-network limit, counted in this function instance's memory. It's best effort (instances come
 * and go), but it stops one computer looping on the relay.
 */
export function limited(req, bucket, max) {
  const ip = String(req.headers['x-real-ip'] ?? req.headers['x-forwarded-for'] ?? req.socket?.remoteAddress ?? '')
    .split(',')[0]
    .trim()
  const id = `${bucket}:${ip}`
  const now = Date.now()
  const recent = (hits.get(id) ?? []).filter((t) => now - t < WINDOW_MS)
  if (recent.length >= max) return true
  recent.push(now)
  hits.set(id, recent)
  if (hits.size > 5000) hits.clear()
  return false
}

export function send(res, status, body, headers = {}) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v)
  res.end(typeof body === 'string' ? body : JSON.stringify(body))
}

/** The request's JSON body: parsed already on Vercel, read here when run locally. Null when too big or broken. */
export async function jsonBody(req, maxBytes = 48_000) {
  if (req.body !== undefined) {
    const b = typeof req.body === 'string' ? safeParse(req.body) : req.body
    return JSON.stringify(b ?? null).length <= maxBytes ? b : null
  }
  let size = 0
  const chunks = []
  for await (const c of req) {
    size += c.length
    if (size > maxBytes) return null
    chunks.push(c)
  }
  return safeParse(Buffer.concat(chunks).toString('utf8'))
}

function safeParse(s) {
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}

export const query = (req) => new URL(req.url ?? '/', 'http://relay').searchParams

/**
 * Sends the upstream answer back as it came (status, body, Retry-After), except that the relay's own key being
 * refused becomes a 502: the app must not tell the operator to fix a key that isn't theirs.
 */
export async function pass(res, upstream, label) {
  if (!upstream) return send(res, 504, { error: `${label} didn't answer in time.` })
  if (upstream.status === 401 || upstream.status === 403) {
    console.error(`${label} refused the relay's key (${upstream.status})`)
    return send(res, 502, { error: `Krustr Studio's ${label} access isn't working right now.` })
  }
  const headers = {}
  const retry = upstream.headers.get('retry-after')
  if (retry) headers['Retry-After'] = retry
  send(res, upstream.status, await upstream.text(), headers)
}

export async function call(url, init, timeoutMs) {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
  } catch {
    return null
  }
}
