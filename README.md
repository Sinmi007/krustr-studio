# Krustr Studio website

The download site for [Krustr Studio](https://github.com/Sinmi007/krustr-studio/releases), church graphics for
livestreams and projectors, and the app's **relay**, which holds its API keys. Plain HTML, CSS and JavaScript:
no build step, no dependencies.

```
index.html        the page
404.html          shown for unknown addresses
favicon.svg       the beacon mark
assets/site.css   styles
assets/site.js    the sky, the scroll effects and the download buttons
assets/og.png     the picture shown when the link is shared (1200 × 630)
api/translate.js  the relay: song-line translation drafts (Gemini, NaijaLLM, Langa, Azure)
api/bible.js      the relay: API.Bible reads (Bible list, books, chapters, search)
api/_lib.js       shared by the two (not a route)
dev-server.mjs    runs the site and the relay locally
vercel.json       caching, security headers and the relay's time limit on Vercel
```

## The relay

The app has no API keys in it. When a church hasn't entered its own key, the app asks the relay, and the relay
calls the service with Krustr Studio's key. The keys are Vercel environment variables, never in this public
repository. The relay only does these two jobs: it builds each request itself from the lines or the Bible
reference it's given, so it can't be used as a general AI or translation service. It also refuses callers that
aren't the app, limits each network's requests, caps request sizes, and never forwards arbitrary paths.

| Variable | For |
| --- | --- |
| `API_BIBLE_KEY` | Licensed Bibles (NIV, NLT, The Message…) |
| `GEMINI_KEY` | Gemini, the first choice for translation drafts |
| `NAIJALLM_KEY` | NaijaLLM |
| `LANGA_KEY` | Langa |
| `TRANSLATOR_KEY`, `TRANSLATOR_REGION` | Azure AI Translator (optional) |

The app's `.env` names (`MAIN_VITE_GEMINI_KEY` and so on) work too, so its `.env` can be pasted into Vercel as
it is. A service without a key answers "not set up", and the app's backups take over.

## Preview on this computer

```
npm run dev
```

Then open http://127.0.0.1:5055. The relay runs at http://127.0.0.1:5055/api, with keys from a `.env` here
(not committed) or another file: `set KEYS_FILE=..\media\.env` first. To point the app at it, set
`MAIN_VITE_RELAY_URL=http://127.0.0.1:5055/api` in the app's `.env` and rebuild.

## How the download buttons work

Every **Download** button links to `https://github.com/Sinmi007/krustr-studio/releases/latest`. When the page
loads, `assets/site.js` asks GitHub for the latest release and points the buttons straight at its `.exe`, and
fills in the version and size. If GitHub can't be reached, the buttons still open the Releases page.

To use a different repository, change `REPO` in `assets/site.js` and the links in `index.html`.

## Publishing a new version of the app

From the app's folder (`media`), with the version raised in `package.json`:

```
set GH_TOKEN=<a GitHub token with "repo" access>
npm run release
```

That builds the installer and uploads it, with `latest.yml` for updates, to a new release in
`Sinmi007/krustr-studio`. The site picks it up on the next page load; nothing here needs to change.

## Putting the site online (Vercel)

1. Push this folder to the public `Sinmi007/krustr-studio` repository on GitHub.
2. On vercel.com, **Add New → Project** and import the repository. Leave the framework as **Other** and the
   build command empty.
3. Before deploying, open **Environment Variables** on the same page and add the keys from the table above.
   The quickest way is to paste the app's `.env` into the first field: Vercel splits it into variables.
4. **Deploy**. The site is live at `krustr-studio.vercel.app`, which the app uses by default. If Vercel gives
   a different address, set `MAIN_VITE_RELAY_URL` in the app's `.env` to `https://<that address>/api` before
   building the installer.
5. Check it: `https://<address>/api/bible` should answer `{"error":"This address is for the Krustr Studio app."}`.

Changing a key later: edit it under **Settings → Environment Variables**, then **Redeploy**. Installers already
out there keep working, since none of them hold a key.
