(() => {
  document.documentElement.classList.add('js')
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v))
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t) }

  /* ---- headline: letters come into focus one after another ---- */
  document.querySelectorAll('[data-reveal]').forEach((el) => {
    const byWords = el.dataset.by === 'words'
    const base = parseFloat(el.dataset.delay || '0.2')
    const step = byWords ? 0.035 : 0.028
    const text = el.textContent.trim()
    el.setAttribute('aria-label', text)
    el.textContent = ''
    let n = 0
    text.split(' ').forEach((word, wi, all) => {
      const w = document.createElement('span'); w.className = 'w'; w.setAttribute('aria-hidden', 'true')
      const units = byWords ? [word] : [...word]
      units.forEach((u) => { const c = document.createElement('span'); c.className = 'c'; c.textContent = u; c.style.setProperty('--d', (base + n++ * step).toFixed(3) + 's'); w.appendChild(c) })
      el.appendChild(w)
      if (wi < all.length - 1) el.appendChild(document.createTextNode(' '))
    })
  })

  /* ---- nav: glass deepens after scrolling; mobile sheet ---- */
  const nav = document.getElementById('nav'), menuBtn = document.getElementById('menuBtn')
  menuBtn.addEventListener('click', () => { const o = nav.classList.toggle('open'); menuBtn.setAttribute('aria-expanded', o); menuBtn.setAttribute('aria-label', o ? 'Close menu' : 'Open menu') })
  document.querySelectorAll('.sheet a').forEach((a) => a.addEventListener('click', () => { nav.classList.remove('open'); menuBtn.setAttribute('aria-expanded', 'false') }))

  /* ---- the dusk sky, drawn on canvas ---- */
  const sky = document.getElementById('sky'), back = document.getElementById('backdrop')
  const ctx = sky.getContext('2d'), bctx = back.getContext('2d')
  let W = 0, H = 0, clouds = [], motes = [], grass = []
  const rand = (a, b) => a + Math.random() * (b - a)
  function cloudSprite(r, warm) {
    const c = document.createElement('canvas'); c.width = r * 4; c.height = r * 2.2
    const g = c.getContext('2d')
    g.filter = `blur(${Math.round(r * .22)}px)`
    for (let i = 0; i < 16; i++) {
      const x = r * 2 + rand(-1.3, 1.3) * r, y = r * 1.1 + rand(-.25, .3) * r, rr = rand(.3, .62) * r
      const lit = g.createRadialGradient(x - rr * .3, y + rr * .35, 0, x, y, rr)
      lit.addColorStop(0, warm ? 'rgba(255,196,120,.55)' : 'rgba(150,110,190,.35)')
      lit.addColorStop(.55, warm ? 'rgba(170,80,90,.32)' : 'rgba(60,40,95,.3)')
      lit.addColorStop(1, 'rgba(30,20,50,0)')
      g.fillStyle = lit; g.beginPath(); g.arc(x, y, rr, 0, Math.PI * 2); g.fill()
    }
    return c
  }
  function setup() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.25)
    W = sky.clientWidth; H = sky.clientHeight
    sky.width = W * dpr; sky.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    back.width = Math.max(1, W / 4); back.height = Math.max(1, H / 4)
    clouds = Array.from({ length: Math.round(W / 70) + 6 }, () => {
      const y = rand(.05, .66), r = rand(40, 120) * (W / 1400 + .4)
      return { x: rand(-.2, 1.1) * W, y: y * H, r, v: rand(3, 11) * (y < .35 ? 1 : .6), img: cloudSprite(Math.round(r), y > .38) }
    })
    motes = Array.from({ length: Math.round(W / 26) }, () => ({ x: rand(0, W), y: rand(H * .35, H), s: rand(.6, 2), v: rand(4, 14), ph: rand(0, 6.28) }))
    grass = Array.from({ length: Math.round(W / 4) }, (_, i) => ({ x: (i / (W / 4)) * W + rand(-2, 2), h: rand(10, 46) * (H / 900 + .3), ph: rand(0, 6.28) }))
  }
  function draw(t) {
    const hz = H * .8, sunX = W * .2, sunY = hz - H * .02
    const g = ctx.createLinearGradient(0, 0, 0, hz)
    g.addColorStop(0, '#0e0b1f'); g.addColorStop(.3, '#2a1d52'); g.addColorStop(.55, '#6a3a7a'); g.addColorStop(.78, '#cf6a43'); g.addColorStop(.93, '#f2a24c'); g.addColorStop(1, '#ffd889')
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, hz + 1)
    // sun glow and slow rays
    let s = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, H * .75)
    s.addColorStop(0, 'rgba(255,226,160,.85)'); s.addColorStop(.12, 'rgba(255,180,100,.45)'); s.addColorStop(1, 'rgba(255,150,80,0)')
    ctx.fillStyle = s; ctx.fillRect(0, 0, W, hz)
    ctx.save(); ctx.globalCompositeOperation = 'lighter'
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI + .25 + i * .32 + Math.sin(t * .00007 + i) * .05
      ctx.fillStyle = 'rgba(255,190,120,.035)'
      ctx.beginPath(); ctx.moveTo(sunX, sunY); ctx.arc(sunX, sunY, H * 1.4, a, a + .07); ctx.closePath(); ctx.fill()
    }
    ctx.restore()
    // clouds drifting
    for (const c of clouds) {
      const x = ((c.x + t * .001 * c.v) % (W * 1.4)) - W * .2
      ctx.drawImage(c.img, x - c.r * 2, c.y - c.r * 1.1)
    }
    // sun disc
    s = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 22)
    s.addColorStop(0, '#fffdf2'); s.addColorStop(.6, '#ffe7a6'); s.addColorStop(1, 'rgba(255,220,140,0)')
    ctx.fillStyle = s; ctx.beginPath(); ctx.arc(sunX, sunY, 22, 0, Math.PI * 2); ctx.fill()
    // far hills
    ctx.fillStyle = '#3a1f3a'
    ctx.beginPath(); ctx.moveTo(0, hz)
    for (let x = 0; x <= W; x += 20) ctx.lineTo(x, hz - 8 - Math.sin(x * .004) * 10 - Math.sin(x * .011 + 1) * 5)
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.fill()
    // field
    const f = ctx.createLinearGradient(0, hz, 0, H)
    f.addColorStop(0, '#2a1626'); f.addColorStop(.25, '#160c16'); f.addColorStop(1, '#07050a')
    ctx.fillStyle = f; ctx.fillRect(0, hz + 4, W, H - hz)
    // a small chapel on the horizon
    const cx = W * .7, cw = Math.max(34, W * .035), ch = cw * .62, base = hz + 2
    ctx.fillStyle = '#120a12'
    ctx.fillRect(cx, base - ch, cw, ch)
    ctx.beginPath(); ctx.moveTo(cx - cw * .08, base - ch); ctx.lineTo(cx + cw * .5, base - ch - cw * .42); ctx.lineTo(cx + cw * 1.08, base - ch); ctx.fill()
    ctx.fillRect(cx + cw * .02, base - ch - cw * .95, cw * .2, cw * .95)
    ctx.beginPath(); ctx.moveTo(cx - cw * .02, base - ch - cw * .95); ctx.lineTo(cx + cw * .12, base - ch - cw * 1.35); ctx.lineTo(cx + cw * .26, base - ch - cw * .95); ctx.fill()
    ctx.fillRect(cx + cw * .11, base - ch - cw * 1.62, cw * .025, cw * .3); ctx.fillRect(cx + cw * .06, base - ch - cw * 1.53, cw * .12, cw * .025)
    ctx.fillStyle = 'rgba(255,190,110,.75)'; ctx.fillRect(cx + cw * .6, base - ch * .62, cw * .12, ch * .26)
    // grass in the breeze
    ctx.strokeStyle = '#0a060b'; ctx.lineWidth = 1.2; ctx.beginPath()
    for (const b of grass) {
      const sway = Math.sin(t * .0012 + b.ph + b.x * .01) * b.h * .18
      ctx.moveTo(b.x, H); ctx.quadraticCurveTo(b.x + sway * .4, H - b.h * .6, b.x + sway, H - b.h)
    }
    ctx.stroke()
    // golden motes
    ctx.save(); ctx.globalCompositeOperation = 'lighter'
    for (const m of motes) {
      const y = H - ((H - m.y + t * .001 * m.v) % (H * .7)), x = m.x + Math.sin(t * .0006 + m.ph) * 14
      const a = .25 + .35 * Math.sin(t * .002 + m.ph) ** 2
      ctx.fillStyle = `rgba(255,214,150,${a.toFixed(3)})`; ctx.beginPath(); ctx.arc(x, y, m.s, 0, Math.PI * 2); ctx.fill()
    }
    ctx.restore()
    bctx.drawImage(sky, 0, 0, back.width, back.height)
  }

  /* ---- pinned hero: folds into a frame while the app rises into it ---- */
  const stage = document.getElementById('stage'), frame = document.getElementById('frame'), copy = document.getElementById('heroCopy'), works = document.getElementById('works'), mock = document.getElementById('mock')
  let target = 0, shown = 0, last = 0
  const progress = () => { const r = stage.getBoundingClientRect(); return clamp(-r.top / Math.max(1, r.height - innerHeight)) }
  function applyHero(p) {
    const a = smooth(0, .5, p), b = smooth(.22, .92, p)
    const inX = Math.min(innerWidth * .06, 72) * a, inY = Math.min(innerHeight * .1, 92) * a
    frame.style.clipPath = `inset(${inY + a * 20}px ${inX}px ${inY - a * 10}px ${inX}px round ${a * 28}px)`
    copy.style.opacity = 1 - smooth(.04, .38, p)
    copy.style.transform = `translateY(${-a * 70}px) scale(${1 - a * .06})`
    copy.style.filter = `blur(${smooth(.08, .4, p) * 10}px)`
    works.style.opacity = 1 - smooth(0, .18, p)
    const fit = Math.min((innerWidth - inX * 2 - 32) / 1200, (innerHeight - inY * 2 - 40) / 720) * .96
    mock.style.transform = `translateY(${(1 - b) * innerHeight * .75 + 10}px) scale(${fit * (.86 + .14 * b)})`
    mock.style.opacity = smooth(.18, .4, p)
    nav.classList.toggle('scrolled', scrollY > 8)
  }

  /* ---- statement: each word lights up as it scrolls through ---- */
  const scrub = document.getElementById('scrub')
  const units = []
  ;(function split(node) {
    [...node.childNodes].forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment()
        n.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return }
          const u = document.createElement('span'); u.className = 'u' + (node !== scrub ? ' kw' : ''); u.textContent = part; units.push(u); frag.appendChild(u)
        })
        node.replaceChild(frag, n)
      } else if (n.nodeType === 1) split(n)
    })
  })(scrub)
  let sTarget = 0, sShown = 0
  const scrubProgress = () => { const r = scrub.getBoundingClientRect(); const start = innerHeight * .85, end = innerHeight * .3; return clamp((start - (r.top + r.height * .5)) / (start - end)) }
  function applyScrub(p) {
    const n = units.length
    units.forEach((u, i) => {
      const t = clamp(p * (n + 3) - i)
      u.style.opacity = (.24 + .76 * t).toFixed(3)
      u.style.filter = t < 1 ? `blur(${((1 - t) * 4).toFixed(2)}px)` : ''
    })
  }

  /* ---- feature cards: each one slides over the last, which sinks back ---- */
  const slots = [...document.querySelectorAll('.card-slot')]
  function applyStack() {
    slots.forEach((slot, i) => {
      const card = slot.firstElementChild, next = slots[i + 1]
      if (!next) { card.style.transform = ''; card.style.filter = ''; return }
      const r = next.getBoundingClientRect(), mine = slot.getBoundingClientRect()
      const q = clamp((innerHeight - r.top) / Math.max(1, innerHeight - mine.top))
      card.style.transform = `scale(${1 - q * .07}) translateY(${-q * 14}px)`
      card.style.filter = `brightness(${1 - q * .45})`
    })
  }

  /* ---- the loop: eases each value toward the scroll position ---- */
  const TAU = .18
  function frameLoop(now) {
    const dt = Math.min((now - (last || now)) / 1000, .05); last = now
    const k = reduce ? 1 : 1 - Math.exp(-dt / TAU)
    target = progress(); shown += (target - shown) * k; if (Math.abs(target - shown) < 5e-4) shown = target
    sTarget = scrubProgress(); sShown += (sTarget - sShown) * k; if (Math.abs(sTarget - sShown) < 5e-4) sShown = sTarget
    const heroVisible = stage.getBoundingClientRect().bottom > 0
    if (heroVisible && (!reduce || !drawn)) { draw(reduce ? 0 : now); drawn = true }
    applyHero(shown); applyScrub(sShown); applyStack()
    requestAnimationFrame(frameLoop)
  }
  let drawn = false
  setup()
  addEventListener('resize', () => { setup(); drawn = false })
  requestAnimationFrame(frameLoop)

  /* ---- steps rise in as they arrive ---- */
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) } }), { rootMargin: '0px 0px -12% 0px' })
  document.querySelectorAll('.steps li').forEach((li) => io.observe(li))

  /* ---- feature demos, run while their card is on screen ---- */
  const whenSeen = (el, start) => { let on = false, stop; new IntersectionObserver(([e]) => { if (e.isIntersecting && !on) { on = true; stop = start() } else if (!e.isIntersecting && on) { on = false; stop && stop() } }, { threshold: .4 }).observe(el) }
  const tv = document.getElementById('tvBible'), typed = document.getElementById('typed')
  whenSeen(tv, () => {
    if (reduce) { typed.textContent = 'jn 3 16'; tv.classList.add('shown'); return }
    let alive = true, timers = []
    const later = (ms, fn) => timers.push(setTimeout(() => alive && fn(), ms))
    const run = () => {
      typed.textContent = ''; tv.classList.remove('shown')
      ;[...'jn 3 16'].forEach((ch, i) => later(500 + i * 130, () => (typed.textContent += ch)))
      later(1700, () => tv.classList.add('shown'))
      later(6200, () => tv.classList.remove('shown'))
      later(7400, run)
    }
    run()
    return () => { alive = false; timers.forEach(clearTimeout) }
  })
  const take = document.getElementById('take'), live = document.getElementById('liveScreen'), lyLT = document.getElementById('lyLT')
  whenSeen(take, () => {
    if (reduce) { live.classList.remove('live-empty'); lyLT.classList.add('on'); return }
    let alive = true, timers = []
    const later = (ms, fn) => timers.push(setTimeout(() => alive && fn(), ms))
    const run = () => {
      live.classList.add('live-empty'); lyLT.classList.remove('on')
      later(1200, () => take.classList.add('press'))
      later(1380, () => { take.classList.remove('press'); live.classList.remove('live-empty'); lyLT.classList.add('on') })
      later(5200, run)
    }
    run()
    return () => { alive = false; timers.forEach(clearTimeout) }
  })
  const comp = document.getElementById('comp')
  whenSeen(comp, () => { if (reduce) return; const id = setInterval(() => comp.classList.toggle('alt'), 3200); return () => clearInterval(id) })

  /* ---- downloads: point every button at the newest installer on GitHub Releases ---- */
  const REPO = 'Sinmi007/krustr-studio'
  const setDownload = (rel) => {
    const exe = (rel.assets || []).find((x) => /\.exe$/i.test(x.name) && !/blockmap/i.test(x.name))
    if (!exe) return
    document.querySelectorAll('.js-dl').forEach((a) => { a.href = exe.browser_download_url })
    const v = document.getElementById('dlVersion'), size = document.getElementById('dlSize')
    if (v) v.textContent = 'Version ' + rel.tag_name.replace(/^v/, '')
    if (size) size.textContent = Math.round(exe.size / 1048576) + ' MB'
  }
  try {
    const cached = JSON.parse(sessionStorage.getItem('krustr-release') || 'null')
    if (cached) setDownload(cached)
  } catch {}
  fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } })
    .then((r) => (r.ok ? r.json() : null))
    .then((rel) => {
      if (!rel) return
      setDownload(rel)
      try { sessionStorage.setItem('krustr-release', JSON.stringify({ tag_name: rel.tag_name, assets: rel.assets.map(({ name, size, browser_download_url }) => ({ name, size, browser_download_url })) })) } catch {}
    })
    .catch(() => { /* the buttons keep linking to the Releases page */ })
})()
