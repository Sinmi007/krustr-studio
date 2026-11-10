(() => {
  const root = document.documentElement
  root.classList.add('js')
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  const fine = matchMedia('(pointer: fine)').matches
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v))
  const ease = (t) => 1 - Math.pow(1 - t, 3)
  const $ = (s) => document.querySelector(s)

  /* ---- smooth, inertial scrolling (off for reduced motion) ---- */
  let lenis = null
  if (!reduce && window.Lenis) {
    lenis = new window.Lenis({ duration: 1.15, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true })
    document.querySelectorAll('a[href^="#"]').forEach((a) =>
      a.addEventListener('click', (e) => {
        const id = a.getAttribute('href')
        const el = id.length > 1 && document.querySelector(id)
        if (!el) return
        e.preventDefault()
        lenis.scrollTo(el, { offset: id === '#top' ? 0 : -90 })
      })
    )
  }

  /* ---- headings: each word rises out of its own mask ---- */
  document.querySelectorAll('[data-words]').forEach((el) => {
    let i = 0
    const wrap = (node) => {
      ;[...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment()
          n.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return
            if (/^\s+$/.test(part)) return frag.appendChild(document.createTextNode(' '))
            const w = document.createElement('span')
            w.className = 'w'
            const s = document.createElement('span')
            s.textContent = part
            s.style.setProperty('--d', (0.08 + i++ * 0.055).toFixed(3) + 's')
            w.appendChild(s)
            frag.appendChild(w)
          })
          node.replaceChild(frag, n)
        } else if (n.nodeType === 1) wrap(n)
      })
    }
    el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim())
    wrap(el)
  })

  /* ---- reveal things as they arrive (the hero at once) ---- */
  const seen = new IntersectionObserver(
    (es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); seen.unobserve(e.target) } }),
    { rootMargin: '0px 0px -10% 0px' }
  )
  document.querySelectorAll('[data-in], [data-words]').forEach((el) => {
    if (el.closest('.hero')) requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('in')))
    else seen.observe(el)
  })

  /* ---- nav: solid after the top, hides going down, returns going up; mobile sheet ---- */
  const nav = $('#nav'), menuBtn = $('#menuBtn')
  menuBtn.addEventListener('click', () => {
    const open = nav.classList.toggle('open')
    menuBtn.setAttribute('aria-expanded', open)
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu')
  })
  document.querySelectorAll('.sheet a').forEach((a) => a.addEventListener('click', () => nav.classList.remove('open')))
  let lastY = 0
  const navOnScroll = (y) => {
    nav.classList.toggle('solid', y > 20)
    if (!nav.classList.contains('open')) nav.classList.toggle('away', y > 400 && y > lastY + 2)
    if (y < lastY - 2 || y < 400) nav.classList.remove('away')
    lastY = y
  }

  /* ---- the spotlight: light falling from above, drawn on the GPU ---- */
  const canvas = $('#light')
  const gl = canvas.getContext('webgl', { antialias: false, premultipliedAlpha: false, powerPreference: 'low-power' })
  let drawLight = () => {}
  if (!gl) document.querySelector('.hero').classList.add('no-gl')
  else {
    const vs = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}'
    const fs = `precision highp float;
uniform vec2 r;uniform float t;uniform vec2 m;
float h(float n){return fract(sin(n)*43758.5453);}
float n1(float x){float i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(h(i),h(i+1.),f);}
float h2(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
void main(){
  vec2 uv=gl_FragCoord.xy/r;
  vec2 src=vec2(r.x*(.6+m.x*.035),r.y*(1.14+m.y*.02));
  vec2 p=(gl_FragCoord.xy-src)/r.y;
  float a=atan(p.x,-p.y);
  float d=length(p);
  float rays=n1(a*13.+t*.12)*.55+n1(a*29.-t*.19)*.3+n1(a*57.+t*.07)*.15;
  rays=pow(rays,2.4);
  float cone=smoothstep(.62,.0,abs(a));
  float fall=exp(-d*1.25);
  float core=exp(-pow(a*3.2,2.))*exp(-d*.9);
  float beam=(rays*1.9+.22)*cone*fall+core*.35;
  vec3 violet=vec3(.47,.34,1.);
  vec3 warm=vec3(1.,.82,.64);
  vec3 col=mix(violet,warm,clamp(core*1.6+rays*.25,0.,1.));
  vec3 c=col*beam*.95;
  float haze=exp(-pow((uv.y-.02)*2.6,2.))*(.55+.45*n1(uv.x*5.+t*.08));
  c+=violet*.07*haze;
  c*=smoothstep(1.3,.25,length((uv-vec2(.58,.6))*vec2(1.,1.2)));
  c+=vec3(.027,.027,.047);
  c+=(h2(gl_FragCoord.xy+fract(t))-.5)/200.;
  gl_FragColor=vec4(c,1.);
}`
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s }
    const prog = gl.createProgram()
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs))
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs))
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) document.querySelector('.hero').classList.add('no-gl')
    else {
      gl.useProgram(prog)
      const buf = gl.createBuffer()
      gl.bindBuffer(gl.ARRAY_BUFFER, buf)
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
      const loc = gl.getAttribLocation(prog, 'p')
      gl.enableVertexAttribArray(loc)
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
      const uR = gl.getUniformLocation(prog, 'r'), uT = gl.getUniformLocation(prog, 't'), uM = gl.getUniformLocation(prog, 'm')
      const size = () => {
        const s = Math.min(window.devicePixelRatio || 1, 1.5) * 0.75
        canvas.width = Math.round(canvas.clientWidth * s)
        canvas.height = Math.round(canvas.clientHeight * s)
        gl.viewport(0, 0, canvas.width, canvas.height)
      }
      size()
      addEventListener('resize', size)
      drawLight = (time, mx, my) => {
        gl.uniform2f(uR, canvas.width, canvas.height)
        gl.uniform1f(uT, time)
        gl.uniform2f(uM, mx, my)
        gl.drawArrays(gl.TRIANGLES, 0, 3)
      }
    }
  }

  /* pointer, for the light, the cards and the buttons */
  let px = 0, py = 0, mx = 0, my = 0
  addEventListener('pointermove', (e) => { px = (e.clientX / innerWidth) * 2 - 1; py = (e.clientY / innerHeight) * 2 - 1 }, { passive: true })

  document.querySelectorAll('.spot').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect()
      card.style.setProperty('--mx', `${e.clientX - r.left}px`)
      card.style.setProperty('--my', `${e.clientY - r.top}px`)
    })
  })
  if (fine && !reduce) {
    document.querySelectorAll('.magnetic').forEach((b) => {
      b.addEventListener('pointermove', (e) => {
        const r = b.getBoundingClientRect()
        b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.22}px, ${(e.clientY - r.top - r.height / 2) * 0.32}px)`
      })
      b.addEventListener('pointerleave', () => { b.style.transform = '' })
    })
  }

  /* ---- statement: words light up as it scrolls through ---- */
  const scrub = $('#scrub'), units = []
  ;(function split(node, hl) {
    ;[...node.childNodes].forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment()
        n.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return
          if (/^\s+$/.test(part)) return frag.appendChild(document.createTextNode(part))
          const u = document.createElement('span')
          u.className = 'u' + (hl ? ' hl' : '')
          u.textContent = part
          units.push(u)
          frag.appendChild(u)
        })
        node.replaceChild(frag, n)
      } else if (n.nodeType === 1) split(n, n.classList.contains('hl'))
    })
  })(scrub, false)
  scrub.querySelectorAll('span.hl:not(.u)').forEach((s) => s.classList.remove('hl'))
  const lightWords = (p) => {
    const n = units.length
    units.forEach((u, i) => {
      const t = clamp(p * (n + 4) - i)
      if (u.classList.contains('hl')) u.style.color = `rgba(255,255,255,${(0.86 * (1 - t)).toFixed(3)})`, (u.style.opacity = (0.16 + 0.84 * t).toFixed(3))
      else u.style.color = `rgba(246,244,255,${(0.14 + 0.86 * t).toFixed(3)})`
    })
  }

  /* ---- the rest of the scroll-driven motion ---- */
  const hero = $('.hero'), heroCopy = $('#heroCopy')
  const layers = [...document.querySelectorAll('#scene .depth')].map((el) => ({ el, d: Number(el.dataset.depth) || 1 }))
  const appLayer = $('.app-layer')
  setTimeout(() => hero.classList.add('ready'), 60)
  const slots = [...document.querySelectorAll('.slot')]
  const timeline = $('#timeline'), steps = [...timeline.querySelectorAll('li')]
  let scrubShown = 0, lineShown = 0, last = 0

  function frame(now) {
    const dt = Math.min((now - (last || now)) / 1000, 0.05)
    last = now
    const k = reduce ? 1 : 1 - Math.exp(-dt / 0.14)
    const y = lenis ? lenis.scroll : scrollY
    const vh = innerHeight
    navOnScroll(y)

    mx += (px - mx) * (reduce ? 1 : 0.04)
    my += (py - my) * (reduce ? 1 : 0.04)
    const heroRect = hero.getBoundingClientRect()
    if (heroRect.bottom > 0) {
      drawLight(reduce ? 4 : now / 1000, mx, my)
      // scrolling away: the copy lifts and fades, the app turns toward you, the pieces drift apart
      const h = clamp(y / (vh * 0.8))
      heroCopy.style.transform = `translateY(${(-h * 50).toFixed(1)}px)`
      heroCopy.style.opacity = (1 - h * 0.85).toFixed(3)
      layers.forEach(({ el, d }) => {
        el.style.setProperty('--px', `${(-mx * d * 9).toFixed(2)}px`)
        el.style.setProperty('--py', `${(-my * d * 7 - h * d * 40).toFixed(2)}px`)
      })
      appLayer.style.setProperty('--ry', `${(-17 + h * 12 + mx * 3).toFixed(2)}deg`)
      appLayer.style.setProperty('--rx', `${(7 - h * 5 - my * 2).toFixed(2)}deg`)
    }

    const sr = scrub.getBoundingClientRect()
    if (sr.bottom > -100 && sr.top < vh + 100) {
      const p = clamp((vh * 0.85 - (sr.top + sr.height / 2)) / (vh * 0.55))
      scrubShown += (p - scrubShown) * k
      lightWords(scrubShown)
    }

    slots.forEach((slot, i) => {
      const card = slot.firstElementChild, next = slots[i + 1]
      const vis = card.querySelector('.vis > *')
      const r = slot.getBoundingClientRect()
      if (vis) vis.style.transform = `translateY(${clamp((r.top - vh * 0.3) / vh, -1, 1) * 26}px)`
      if (!next) return
      const q = clamp((vh - next.getBoundingClientRect().top) / Math.max(1, vh - r.top))
      card.style.transform = `scale(${(1 - q * 0.06).toFixed(4)}) translateY(${(-q * 18).toFixed(1)}px)`
      card.style.filter = q > 0.01 ? `brightness(${(1 - q * 0.5).toFixed(3)})` : ''
    })

    const tr = timeline.getBoundingClientRect()
    const lp = clamp((vh * 0.75 - tr.top) / (tr.height + vh * 0.25))
    lineShown += (lp - lineShown) * k
    timeline.style.setProperty('--p', lineShown.toFixed(4))
    steps.forEach((li, i) => li.classList.toggle('lit', lineShown >= (i === 0 ? 0.02 : i / (steps.length - 0.4))))

    requestAnimationFrame(frame)
  }
  if (lenis) {
    const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf) }
    requestAnimationFrame(raf)
  }
  requestAnimationFrame(frame)

  /* ---- the app in the hero runs a service: a tour of every mode, one scene after another ---- */
  // Lyrics: "Amazing Grace", John Newton (1779), public domain. Verses: King James Version, public domain.
  // The preacher's lines and everything else are our own wording.
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const appEl = $('#app'), rail = $('#mockRail'), railInd = $('#railInd'), take = $('#appTake')
  const pvScreen = $('#pvScreen'), pgScreen = $('#pgScreen')
  const pvTag = $('#pvTag'), pvName = $('#pvName'), pgName = $('#pgName'), pgFs = $('#pgFs'), pgCam = $('#pgCam'), lyLt = $('#lyLt'), lyFs = $('#lyFs')
  const count = $('#appCount'), air = $('#appAir'), clock = $('#appClock'), ctrlScene = $('#ctrlScene'), appNext = $('#appNext')
  const fLt = $('.card-lt'), fLtRef = $('#fLtRef'), fLtText = $('#fLtText')
  const heardRef = $('#heardRef'), heardCard = $('#heardCard')
  const inspVals = [...document.querySelectorAll('#mInsp .field div')], inspLabels = [...document.querySelectorAll('#mInsp .field label')]
  const pop = (el) => { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop') }
  const CAMS = { pulpit: 'Camera 1', choir: 'Camera 2' }

  // The rail's highlight glides to the mode; its pane crossfades in.
  const moveInd = () => {
    const on = rail.querySelector('[data-mode].on')
    if (on) { railInd.style.height = `${on.offsetHeight}px`; railInd.style.transform = `translateY(${on.offsetTop}px)` }
  }
  addEventListener('resize', moveInd)
  requestAnimationFrame(moveInd)
  const enter = async (mode, scene, insp) => {
    rail.querySelectorAll('[data-mode]').forEach((d) => d.classList.toggle('on', d.dataset.mode === mode))
    moveInd()
    appEl.querySelectorAll('.panes > .pane').forEach((p) => p.classList.toggle('show', p.dataset.pane === mode))
    ctrlScene.textContent = `◂ ${scene} ▸`
    inspVals.forEach((v) => v.classList.add('fade'))
    await wait(300)
    insp.forEach(([label, value], i) => { inspLabels[i].textContent = label; inspVals[i].textContent = value })
    inspVals.forEach((v) => v.classList.remove('fade'))
    await wait(650)
  }

  // Each screen changes one thing at a time: what's leaving goes, then what's coming arrives.
  const queues = new Map()
  const show = (screen, kind, html, cam) => {
    const run = async () => {
      if (cam && screen.dataset.cam !== cam) screen.dataset.cam = cam
      const target = kind ? screen.querySelector(`.ov[data-kind="${kind}"]`) : null
      const leaving = [...screen.querySelectorAll('.ov.on')].filter((o) => o !== target)
      leaving.forEach((o) => o.classList.remove('on'))
      if (target) {
        if (target.classList.contains('on')) { target.classList.remove('on'); await wait(340) }
        else if (leaving.length) await wait(300)
        if (html != null) target.innerHTML = html
        void target.offsetWidth
        target.classList.add('on')
      }
      await wait(120)
    }
    const next = (queues.get(screen) ?? Promise.resolve()).then(run)
    queues.set(screen, next)
    return next
  }
  let pv = { kind: 'lt', html: $('#pvLt').innerHTML, cam: 'pulpit', name: 'John 3:16 · KJV', tag: 'LT' }
  const preview = (kind, html, cam, name, tag) => {
    pv = { kind, html, cam: cam ?? pv.cam, name, tag }
    pvTag.textContent = tag
    pvName.textContent = name
    return show(pvScreen, kind, html, pv.cam)
  }
  const floatLt = (ref, text) => {
    fLt.classList.add('swap')
    setTimeout(() => { fLtRef.textContent = ref; fLtText.textContent = text; fLt.classList.remove('swap') }, 380)
  }
  const goLive = async () => {
    take.classList.add('press')
    await wait(170)
    take.classList.remove('press')
    const { kind, html, cam, name } = pv
    await show(pgScreen, kind, html, cam)
    lyLt.classList.toggle('on', kind === 'lt')
    lyFs.classList.toggle('on', kind === 'fs' || kind === 'title' || kind === 'comp')
    pgName.textContent = kind === 'lt' ? name.replace(/ · KJV$/, '') : 'Off'
    pgFs.textContent = kind === 'lt' || !kind ? 'Off' : name
    pgCam.textContent = CAMS[cam] ?? 'Camera 1'
    if (kind === 'lt') {
      const tmp = document.createElement('div'); tmp.innerHTML = html
      floatLt(tmp.querySelector('b')?.textContent ?? '', tmp.querySelector('span')?.textContent ?? '')
    }
  }
  const lt = (cap, text) => `<b>${cap}</b><span>${text}</span>`
  const select = (list, i) => [...list.children].forEach((c, k) => c.classList.toggle('sel', k === i))

  /* Bible: look up the next verse, put it in Preview, take it live */
  const verses = [...document.querySelectorAll('#appVerses p')], appSearch = $('#appSearch')
  let vi = 1
  const bibleScene = async () => {
    await enter('bible', 'Scripture reading', [['Style', 'Classic'], ['Version', 'King James Version'], ['Reference', `John 3:${verses[vi].dataset.v}`], ['Entrance', 'Slide from left']])
    for (let n = 0; n < 2; n++) {
      vi = (vi + 1) % verses.length
      const v = verses[vi]
      verses.forEach((x) => x.classList.toggle('sel', x === v))
      appSearch.textContent = `jn 3:${v.dataset.v}`
      inspVals[2].textContent = `John 3:${v.dataset.v}`
      const text = v.textContent.replace(/^\d+/, '').trim().split(' ').slice(0, 10).join(' ') + '…'
      await preview('lt', lt(`JOHN 3:${v.dataset.v} · KJV`, text), 'pulpit', `John 3:${v.dataset.v} · KJV`, 'LT')
      await wait(1500)
      await goLive()
      count.textContent = String(Number(count.textContent) + 1)
      await wait(1300)
    }
  }

  /* Sermon: the preacher names a verse, a card pops in, it goes to Preview and live */
  const smNow = $('#smNow'), smCard = $('#smCard'), smRef = $('#smRef'), smText = $('#smText'), smAt = $('#smAt'), smMeter = $('#smMeter'), smClock = $('#smClock')
  const HEARD = [
    ['turn with me to', 'Romans chapter 3 verse 23', 'Romans 3:23', 'ROMANS 3:23', 'For all have sinned, and come short of the glory of God;'],
    ['David writes in', 'Psalm 23 verse 1', 'Psalm 23:1', 'PSALM 23:1', 'The LORD is my shepherd; I shall not want.'],
    ['Paul says in', 'Philippians 4 verse 13', 'Philippians 4:13', 'PHILIPPIANS 4:13', 'I can do all things through Christ which strengtheneth me.']
  ]
  let heard = 0, smSecs = 18 * 60 + 42
  const stamp = () => `${String(Math.floor(smSecs / 60)).padStart(2, '0')}:${String(smSecs % 60).padStart(2, '0')}`
  setInterval(() => { smSecs++; smClock.textContent = stamp() }, 1000)
  const sermonScene = async () => {
    const [lead, said, label, cap, text] = HEARD[heard++ % HEARD.length]
    await enter('sermon', 'Sermon', [['Style', 'Classic'], ['Version', 'King James Version'], ['Reference', label], ['Entrance', 'Slide from left']])
    const meter = setInterval(() => { smMeter.style.transform = `scaleX(${(0.25 + Math.random() * 0.65).toFixed(2)})` }, 140)
    const words = `${lead} ${said}`.split(' ')
    for (let i = 0; i < words.length; i++) {
      smNow.innerHTML = `<span>${words.slice(0, i + 1).join(' ')}</span>`
      await wait(230)
    }
    smNow.innerHTML = `<span>${lead} <mark>${said}</mark></span>`
    smRef.textContent = label; smText.textContent = text; smAt.textContent = stamp(); pop(smCard)
    heardRef.textContent = label; pop(heardCard)
    await wait(900)
    await preview('lt', lt(`${cap} · KJV`, text), 'pulpit', `${label} · KJV`, 'LT')
    await wait(1500)
    await goLive()
    await wait(1600)
    clearInterval(meter)
  }

  /* Songs: the next slide, full screen, taken live */
  const slides = $('#mSlides')
  let si = 0
  const songScene = async () => {
    await enter('songs', 'Praise and worship', [['Style', 'Full screen'], ['Song', 'Amazing Grace'], ['Slide', `${si + 1} of 3`], ['Entrance', 'Fade']])
    for (let n = 0; n < 2; n++) {
      select(slides, si)
      inspVals[2].textContent = `${si + 1} of 3`
      const words = slides.children[si].querySelector('span').innerHTML
      await preview('fs', words, 'pulpit', `Amazing Grace · slide ${si + 1}`, 'FS')
      await wait(1400)
      await goLive()
      await wait(1300)
      si = (si + 1) % slides.children.length
    }
  }

  /* Schedule: cue the next item, it lands in Preview, take it */
  const sched = $('#mSched')
  const scheduleScene = async () => {
    await enter('scenes', 'Welcome', [['Style', 'Title card'], ['Title', 'Welcome home'], ['Subtitle', 'Sunday service'], ['Entrance', 'Fade']])
    const rows = [...sched.children]
    rows.forEach((r, k) => { r.classList.toggle('done', k === 0); r.classList.remove('live') })
    select(sched, 1)
    await preview('title', '<b>Welcome home</b><span>Sunday service · 10:00</span>', 'pulpit', 'Welcome', 'FS')
    await wait(1300)
    await goLive()
    rows[1].classList.add('live')
    appNext.textContent = 'Opening prayer'
    await wait(1300)
    rows[1].classList.remove('live'); rows[1].classList.add('done')
    select(sched, 2)
    ctrlScene.textContent = '◂ Opening prayer ▸'
    await preview('lt', lt('PASTOR ADE OKAFOR', 'Opening prayer'), 'pulpit', 'Opening prayer', 'LT')
    await wait(1300)
    await goLive()
    rows[2].classList.add('live')
    appNext.textContent = 'Praise and worship'
    await wait(1300)
  }

  /* Media: switch cameras, then an announcement over the new shot */
  const srcs = $('#mSrcs'), gfx = $('#mGfx')
  const mark = (list, s, cls) => list.querySelectorAll('p').forEach((p) => p.classList.toggle(cls, p.dataset.s === s))
  const mediaScene = async () => {
    await enter('sources', 'Offering', [['Input', 'Camera 2 · Choir'], ['Fit', 'Fill the screen'], ['Audio', 'Off'], ['Entrance', 'Crossfade']])
    mark(srcs, 'choir', 'sel'); mark(srcs, 'choir', 'pv')
    await preview(null, null, 'choir', 'Camera 2 · Choir', 'IN')
    await wait(1300)
    await goLive()
    mark(srcs, 'choir', 'live')
    srcs.querySelectorAll('p').forEach((p) => { p.querySelector('em').textContent = p.dataset.s === 'choir' ? 'LIVE' : '' })
    await wait(1100)
    mark(srcs, '', 'sel'); mark(srcs, '', 'pv'); mark(gfx, 'announce', 'sel')
    await preview('title', '<b>Youth Conference</b><span>Saturday · 4 PM · Main hall</span>', 'choir', 'Announcement', 'FS')
    await wait(1300)
    await goLive()
    await wait(1300)
    mark(gfx, '', 'sel')
    // back to the pulpit camera for the next round
    mark(srcs, 'pulpit', 'live')
    srcs.querySelectorAll('p').forEach((p) => { p.querySelector('em').textContent = p.dataset.s === 'pulpit' ? 'LIVE' : '' })
  }

  /* Layouts: the camera beside the verse, with the event strip */
  const lays = $('#mLays')
  const layoutScene = async () => {
    await enter('layouts', 'Sermon', [['Layout', 'Conference'], ['Camera box', 'Camera 1'], ['Content', 'Romans 8:28'], ['Strip', 'Youth Conference']])
    select(lays, 0)
    await preview('comp', '<div class="cb"><div class="cam"></div></div><div class="vb"><small>ROMANS 8:28 · KJV</small>And we know that all things work together for good to them that love God…</div><div class="sb">YOUTH CONFERENCE · DAY 2</div>', 'pulpit', 'Conference layout', 'FS')
    await wait(1500)
    await goLive()
    await wait(1800)
  }

  // A service's order: the schedule first, the sermon last.
  const SCENES = [scheduleScene, bibleScene, songScene, mediaScene, layoutScene, sermonScene]
  if (!reduce) {
    ;(async () => {
      await wait(2600)
      for (let k = 0; ; k++) await SCENES[k % SCENES.length]()
    })()
  }

  const pad = (n) => String(n).padStart(2, '0')
  let onAir = 42 * 60 + 10
  setInterval(() => {
    const d = new Date()
    clock.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
    onAir++
    air.textContent = `00:${pad(Math.floor(onAir / 60) % 60)}:${pad(onAir % 60)}`
  }, 1000)

  /* ---- feature demos, run while their card is on screen ---- */
  const whenSeen = (el, start) => {
    let stop = null
    new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !stop) stop = start() || (() => {})
      else if (!e.isIntersecting && stop) { stop(); stop = null }
    }, { threshold: 0.35 }).observe(el)
  }
  const loop = (steps, period) => {
    let alive = true, timers = []
    const run = () => {
      steps.forEach(([ms, fn]) => timers.push(setTimeout(() => alive && fn(), ms)))
      timers.push(setTimeout(() => alive && run(), period))
    }
    run()
    return () => { alive = false; timers.forEach(clearTimeout) }
  }
  const tv = $('#tvBible'), typed = $('#typed')
  whenSeen(tv, () => {
    if (reduce) { typed.textContent = 'jn 3 16'; tv.classList.add('shown'); return }
    return loop([
      [0, () => { typed.textContent = ''; tv.classList.remove('shown') }],
      ...[...'jn 3 16'].map((ch, i) => [500 + i * 120, () => (typed.textContent += ch)]),
      [1650, () => tv.classList.add('shown')],
      [6000, () => tv.classList.remove('shown')]
    ], 7200)
  })
  const takeKey = $('#take'), live = $('#liveScreen'), lyLT = $('#lyLT')
  whenSeen(takeKey, () => {
    if (reduce) { live.classList.remove('off'); lyLT.classList.add('on'); return }
    return loop([
      [0, () => { live.classList.add('off'); lyLT.classList.remove('on') }],
      [1300, () => takeKey.classList.add('press')],
      [1480, () => { takeKey.classList.remove('press'); live.classList.remove('off'); lyLT.classList.add('on') }]
    ], 5200)
  })
  const comp = $('#comp')
  whenSeen(comp, () => { if (reduce) return; const id = setInterval(() => comp.classList.toggle('alt'), 3400); return () => clearInterval(id) })

  /* ---- the Sermon card: words arrive as they're preached, the verse is spotted, a card slides in ---- */
  const listen = $('#listen'), saying = $('#saying'), verseCard = $('#verseCard'), meter = $('#meter'), listenClock = $('#listenClock')
  const WORDS = 'and the Bible says in Romans chapter 3 verse 23 that all of us have fallen short'.split(' ')
  const REF = [5, 9] // "Romans chapter 3 verse 23"
  const render = (n) => {
    const w = WORDS.slice(0, n)
    saying.innerHTML = w.map((x, i) => (i === REF[0] && n > REF[1] + 1 ? '<mark>' : '') + x + (i === REF[1] && n > REF[1] + 1 ? '</mark>' : '')).join(' ')
  }
  whenSeen(listen, () => {
    if (reduce) { render(WORDS.length); verseCard.classList.add('in'); return }
    let secs = 12 * 60 + 4
    const tickClock = setInterval(() => { secs++; listenClock.textContent = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}` }, 1000)
    const tickMeter = setInterval(() => { meter.style.transform = `scaleX(${(0.25 + Math.random() * 0.65).toFixed(2)})` }, 140)
    const stop = loop([
      [0, () => { render(0); verseCard.classList.remove('in') }],
      ...WORDS.map((_, i) => [400 + i * 260, () => render(i + 1)]),
      [400 + (REF[1] + 2) * 260 + 150, () => verseCard.classList.add('in')],
      [8200, () => verseCard.classList.remove('in')]
    ], 9000)
    return () => { stop(); clearInterval(tickClock); clearInterval(tickMeter) }
  })

  /* ---- downloads: point every button at the newest installer on GitHub Releases ---- */
  const REPO = 'Sinmi007/krustr-studio'
  const setDownload = (rel) => {
    const exe = (rel.assets || []).find((x) => /\.exe$/i.test(x.name) && !/blockmap/i.test(x.name))
    if (!exe) return
    document.querySelectorAll('.js-dl').forEach((a) => { a.href = exe.browser_download_url })
    const v = $('#dlVersion'), size = $('#dlSize')
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
      try {
        sessionStorage.setItem('krustr-release', JSON.stringify({ tag_name: rel.tag_name, assets: rel.assets.map(({ name, size, browser_download_url }) => ({ name, size, browser_download_url })) }))
      } catch {}
    })
    .catch(() => { /* the buttons keep linking to the Releases page */ })
})()
