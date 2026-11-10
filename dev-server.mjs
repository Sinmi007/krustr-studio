// Runs the site and the relay on this computer, the way Vercel serves them: `npm run dev`.
// Keys come from the environment, or from a .env file next to this one (never committed; see .gitignore).
import { createServer } from 'node:http'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('.', import.meta.url))
const port = Number(process.env.PORT ?? 5055)

for (const file of ['.env', process.env.KEYS_FILE].filter(Boolean)) {
  if (!existsSync(file)) continue
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

const routes = {
  '/api/translate': (await import('./api/translate.js')).default,
  '/api/bible': (await import('./api/bible.js')).default
}
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' }

createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost')
  const route = routes[pathname]
  if (route) {
    try {
      await route(req, res)
    } catch (err) {
      console.error(err)
      res.statusCode = 500
      res.end('{"error":"The relay crashed."}')
    }
    return
  }
  let file = normalize(join(root, pathname === '/' ? 'index.html' : pathname))
  if (!file.startsWith(root) || file.includes(`${root}api`) || /[\\/]\./.test(file.slice(root.length))) file = join(root, '404.html')
  if (!existsSync(file) || !statSync(file).isFile()) file = existsSync(`${file}.html`) ? `${file}.html` : join(root, '404.html')
  res.statusCode = file.endsWith('404.html') && pathname !== '/404' ? 404 : 200
  res.setHeader('Content-Type', types[extname(file)] ?? 'application/octet-stream')
  res.end(readFileSync(file))
}).listen(port, process.env.HOST ?? '127.0.0.1', () => console.log(`Krustr site and relay on http://${process.env.HOST ?? '127.0.0.1'}:${port}`))
