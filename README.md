# Krustr Studio website

The download site for [Krustr Studio](https://github.com/Sinmi007/krustr-studio/releases), church graphics for
livestreams and projectors. Plain HTML, CSS and JavaScript: no build step, no dependencies.

```
index.html        the page
404.html          shown for unknown addresses
favicon.svg       the beacon mark
assets/site.css   styles
assets/site.js    the sky, the scroll effects and the download buttons
assets/og.png     the picture shown when the link is shared (1200 × 630)
vercel.json       caching and security headers on Vercel
```

## Preview on this computer

```
python -m http.server 5055
```

Then open http://localhost:5055. (Opening `index.html` directly works too, but the stylesheet and script use
`/assets/…` paths, so a local server shows it exactly as it will be online.)

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
2. On vercel.com, **Add New → Project**, import the repository, leave the framework as **Other** and the build
   command empty, then **Deploy**.
3. The site is live at `krustr-studio.vercel.app` (or similar). Add a custom domain later under
   **Settings → Domains**.

Netlify works the same way: import the repository with no build command and `.` as the publish folder.
