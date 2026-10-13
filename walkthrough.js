/* The walkthrough template — a case study built to be presented live, modelled on the
   Kaizenfox Framer page she sent (2026-10-12): dark ground, a TOC docked bottom-left that
   lights the section you're in, the background easing between ink and navy as sections
   pass, prose that brightens as it scrolls in, numbered decisions, and screens dimmed until
   hovered under a scalloped cursor badge. Clicking any screen opens a viewer with the
   recorded interaction, the iteration strip, and a link to the live prototype; Esc or the
   browser's Back returns to the same spot. Self-contained: own CSS + JS inline, so the main
   site stylesheet never has to know this page exists. Used by any case-study JSON with
   "template": "walkthrough". */
const fs = require('fs');
const path = require('path');

/* Icons are drawn shapes, never font characters. A glyph like ‹ or ▶ sits wherever its font
   puts it — high, low, left — so it is never truly centred in a circle (2026-10-12: the viewer's
   side arrows sat visibly off-centre). Each path below was generated so its outline's bounding
   box is centred exactly on (12,12) of a 24×24 box; the build lint (lintIcons) refuses icon
   characters in buttons, and the localhost check (__checkIcons) measures every icon on screen. */
const ICONS = {
  prev: 'M15 6 L9 12 L15 18', next: 'M9 6 L15 12 L9 18',
  back: 'M19 12 L5 12 M11 6 L5 12 L11 18', arrow: 'M5 12 L19 12 M13 6 L19 12 L13 18',
  external: 'M7 17 L17 7 M9 7 L17 7 L17 15', swap: 'M9 7 L4 12 L9 17 M15 7 L20 12 L15 17',
  check: 'M5 12.25 L9.5 16.75 L19 7.25', edit: 'M4.5 19.5 L5.5 15.5 L16.5 4.5 L19.5 7.5 L8.5 18.5 Z',
  pointer: 'M6.5 3.5 L6.5 18.5 L10.1 15.1 L12.5 20.5 L14.8 19.5 L12.4 14.1 L17.5 14.1 Z',
  star: 'M12 3.86 L14.29 9.7 L20.56 10.08 L15.71 14.06 L17.29 20.14 L12 16.76 L6.71 20.14 L8.29 14.06 L3.44 10.08 L9.71 9.7 Z'
};
const ic = (name, cls = '') => `<svg class="ic${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[name]}"/></svg>`;

module.exports = function renderWalkthrough(cs, { esc, asset, site, cases, ROOT }) {
  const A = p => asset(/^(https?:|assets\/)/.test(p) ? p : `${cs.dir}/${p}`);
  /* **bold** and __underline__ inside escaped prose — the only markup the copy needs */
  const md = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/__(.+?)__/g, '<u>$1</u>').replace(/\bTK\b/g, '<mark class="tk">TK</mark>');
  const readOpt = rel => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, cs.dir, rel), 'utf8')); } catch { return null; } };

  /* clips + iterations are produced by tools outside the build; the page works without them
     (the viewer falls back to the screen itself) and picks them up on the next build */
  const clipList = readOpt('clips/clips.json') || [];
  const clips = Object.fromEntries(clipList.map(c => [c.name, { name: c.name,
    src: asset(`${cs.dir}/clips/${c.file}`), poster: c.poster ? asset(`${cs.dir}/clips/${c.poster}`) : '',
    title: c.title || '', desc: c.description || '' }]));
  const iters = readOpt('iter/iterations.json') || {};
  /* the localhost image picker offers every screen under shots/ and iter/ */
  const listDir = rel => { try { return fs.readdirSync(path.join(ROOT, cs.dir, rel)).filter(f => /\.(jpe?g|png|gif)$/.test(f)).sort((x, y) => x.localeCompare(y, undefined, { numeric: true })).map(f => `${rel}/${f}`); } catch { return []; } };
  const shotGroups = [['Latest shipped (iteration 65)', 'shots/latest'], ['Home before the face widget (64)', 'shots/before-face'], ['Old dashboard (45)', 'shots/old'],
    ...Object.keys(iters).map(k => [`Iterations: ${k}`, `iter/${k}`]), ['Deck screens', 'screens']]
    .map(([label, rel]) => ({ label, files: listDir(rel) })).filter(g => g.files.length);
  const views = {};
  for (const [id, v] of Object.entries(cs.views || {})) {
    const strip = (iters[v.iter] || []).map((i, j) => ({ src: asset(i.src), title: i.title || '', why: i.why || '', ask: i.ask || '', screen: i.screen || '', key: `iter:${v.iter}.${j}` }))
      .concat((v.images || []).map(src => ({ src: A(src), title: '', why: '' })));
    views[id] = { title: v.title, clips: [].concat(v.clip || []).map(n => clips[n]).filter(Boolean), strip, live: v.live ? (v.live.startsWith('/') ? cs.liveBase + v.live : A(v.live)) : '' };
    /* a /path is the live dashboard; anything else is a prototype shipped with the case study */
  }

  /* ---------- pieces ---------- */
  /* every string on the page carries the JSON path it came from, so on localhost the text
     can be edited in place and written back to the case-study file (see server.js /__edit) */
  const E = p => ` data-edit="${p}"`;
  const chrome = url => `<div class="chrome" aria-hidden="true"><i></i><i></i><i></i><span>${esc(url || 'driftwood.sh/dashboard')}</span></div>`;
  /* callouts: a handwritten label joined to a point on the screen. A note whose text was
     deleted is gone. On localhost, Edit text also lets the point (pin) and the label be dragged,
     so a line can be routed clear of the screen's own text; the numbers ride on the label */
  const notePath = n => { const lx = n.x + n.dx, ly = n.y + n.dy; return `M${lx} ${ly} Q${(n.x + lx) / 2 + (n.dy > 0 ? 6 : -6)} ${(n.y + ly) / 2} ${n.x} ${n.y}`; };
  const notesHTML = (notes, p) => {
    const live = (notes || []).map((n, i) => [n, i]).filter(([n]) => (n.text || '').trim());
    if (!live.length) return '';
    return `<svg class="notes-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${live.map(([n, i]) =>
      `<path data-i="${i}" d="${notePath(n)}" pathLength="1"/><circle data-i="${i}" cx="${n.x}" cy="${n.y}" r=".6"/>`).join('')}</svg>${live.map(([n, i]) =>
      `<span class="note" data-i="${i}" data-x="${n.x}" data-y="${n.y}" data-dx="${n.dx}" data-dy="${n.dy}" data-note="${p}.notes.${i}" style="left:${n.x + n.dx}%;top:${n.y + n.dy}%"${E(`${p}.notes.${i}.text`)}>${esc(n.text)}</span>` +
      `<span class="note-pin" data-i="${i}" style="left:${n.x}%;top:${n.y}%" title="Drag to move where the line points"></span>`).join('')}`;
  };
  /* a macOS-style pointer drawn where the mouse was, so a hover state in a screenshot (the
     blue 472 on Home) reads as hovered rather than as a random colour. Positions live in
     cs.cursors keyed by image path, so the same screen gets its pointer wherever it appears */
  const MOUSE = '<path d="M1 1v17l4.6-4.4 3.2 7.2 2.9-1.3-3.1-7h6.4z"/>';
  const mouseHTML = src => { const c = (cs.cursors || {})[src]; return c ? `<svg class="mouse" viewBox="0 0 18 22" style="left:${c[0]}%;top:${c[1]}%" aria-hidden="true">${MOUSE}</svg>` : ''; };
  /* a div, not a <button>: editable text can't live inside a button */
  const frame = (f, p, cls = '') => {
    const isGif = /\.gif$/.test(f.src);
    /* a gif renders as its still poster until hovered, so a dimmed frame isn't secretly
       burning CPU, then swaps to the moving original */
    const img = isGif && f.poster
      ? `<img src="${A(f.poster)}" data-gif="${A(f.src)}" alt="${esc(f.alt)}" loading="lazy" decoding="async">`
      : `<img src="${A(f.src)}" alt="${esc(f.alt)}" loading="lazy" decoding="async">`;
    return `<div class="frame ${cls}${f.narrow ? ' narrow' : ''}${f.lit ? ' lit' : ''}" role="button" tabindex="0" data-view="${esc(f.view)}" data-src-path="${p}.src" data-src="${esc(f.src)}" aria-label="Explore: ${esc(f.alt)}">
      ${f.narrow ? '' : chrome(f.url)}<span class="shot">${img}${mouseHTML(f.src)}${notesHTML(f.notes, p)}</span></div>`;
  };

  /* ASCII ducks for the client cards — driftwood's debugging duck, rubber-duck yellow, each
     one a little different. Faces stay anonymous; the quotes are paraphrased. */
  const DUCKS = {
    classic: ['   __    ', ' <(o )___', '  ( ._> /', '   `---\' '],
    right:   ['    __   ', '___( o)> ', '\\ <_. )  ', ' `---\'   '],
    sleepy:  ['   __  z ', ' <(- )___', '  ( ._> /', '   `---\' '],
    shocked: ['   __  ! ', ' <(O )___', '  ( ._> /', '   `---\' '],
    shades:  ['   __    ', ' <(■ )___', '  ( ._> /', '   `---\' '],
    captain: ['  _▄▄_   ', ' <(o )___', '  ( ._> /', '   `---\' '],
    swim:    ['   __    ', ' <(o )___', '  ( ._> /', '~~`---\'~~'],
    log:     ['    __   ', '___( o)> ', '\\ <_. )  ', '═══════  ']
  };
  const duck = (name, cls = '') => {
    const rows = DUCKS[name] || DUCKS.classic;
    return `<span class="duck ${cls}" aria-hidden="true">${rows.map((r, i) => {
      let h = esc(r).replace(/&lt;(?=\()/g, '<b>&lt;</b>').replace(/(\))&gt;/g, '$1<b>&gt;</b>');
      if (i === 3) h = h.replace(/(~+)/g, '<em class="w">$1</em>').replace(/(═+)/g, '<em class="l">$1</em>');
      if (i === 0) h = h.replace(/([z!])/g, '<em class="x">$1</em>').replace(/(▄+)/g, '<em class="x">$1</em>');
      return `<span>${h}</span>`;
    }).join('')}</span>`;
  };

  const block = (b, p) => {
    switch (b.type) {
      case 'lede': return `<div class="lede">${b.text.map((t, i) => `<p class="rv"${E(`${p}.text.${i}`)}>${md(t)}</p>`).join('')}</div>`;
      /* the opening: one relatable line per screen, so the room feels the problem before
         they hear whose problem it was */
      /* one line at a time, in the normal scroll (no pinning, by her ask): lines sit 48vh
         apart, close enough to reach in 2-3 scrolls, and each is only visible in the middle
         of the screen, so the current one is gone before the next fades in at ~3/4 height */
      case 'hook': return `<div class="hook">${b.lines.map((t, i) => `<p${E(`${p}.lines.${i}`)}>${md(t)}</p>`).join('')}</div>`;
      case 'meta': return `<dl class="meta">${b.items.map(([k, v], i) => `<div class="rv"><dt${E(`${p}.items.${i}.0`)}>${esc(k)}</dt><dd${E(`${p}.items.${i}.1`)}>${md(v)}</dd></div>`).join('')}</dl>`;
      case 'p': return `<p class="body rv"${E(`${p}.text`)}>${md(b.text)}</p>`;
      case 'payments': {
        const max = 8000;
        const ticks = [0, 2000, 4000, 6000, 8000];
        return `<figure class="chart fu" data-draw>
          <div class="legend">${b.rows.map(([l, , tone], i) => `<span class="k ${tone}"${E(`${p}.rows.${i}.0`)}>${esc(l)}</span>`).join('')}</div>
          <div class="hbars">${ticks.map(t => `<i class="grid" style="--g:${t / max}"><em>$${t / 1000}k</em></i>`).join('')}
          ${b.rows.map(([l, v, tone]) => `<div class="hrow"><span class="hl">${esc(l)}</span><span class="track"><span class="bar ${tone}" style="--w:${v / max * 100}%"></span><span class="end ${tone}" style="left:${v / max * 100}%">$${(v / 1000).toFixed(1)}k</span></span></div>`).join('')}</div>
          <p class="big-callout"${E(`${p}.callout`)}>${md(b.callout)}</p>
          <figcaption${E(`${p}.source`)}>${esc(b.source)}</figcaption></figure>`;
      }
      case 'timeline': {
        const pct = d => d / b.max * 100;
        return `<figure class="chart fu" data-draw><p class="chart-title"${E(`${p}.title`)}>${esc(b.title)}</p>
          <div class="tl">${[0, 5, 10, 15].map(d => `<i class="grid" style="--g:${d / b.max}"><em>${d ? `Week ${d / 5}` : 'Signed'}</em></i>`).join('')}
          ${b.rows.map((r, i) => `<div class="trow"><span class="hl${r.hint ? ' has-tip' : ''}"${r.hint ? ' tabindex="0"' : ''}><span${E(`${p}.rows.${i}.label`)}>${esc(r.label)}</span>${r.hint ? `<span class="tip" role="tooltip"${E(`${p}.rows.${i}.hint`)}>${md(r.hint)}</span>` : ''}</span><span class="track"><span class="seg" style="--l:${pct(r.from)}%;--w:${pct(r.to - r.from)}%"><em${E(`${p}.rows.${i}.note`)}>${esc(r.note)}</em></span></span></div>`).join('')}
          ${(b.marks || []).map((m, i) => `<span class="mark ${m.tone}" style="left:calc(var(--lab) + (100% - var(--lab)) * ${pct(m.at) / 100})"><em${E(`${p}.marks.${i}.text`)}>${esc(m.text)}</em></span>`).join('')}
          </div><figcaption${E(`${p}.source`)}>${esc(b.source)}</figcaption></figure>`;
      }
      case 'moments': return `<div class="moments">${b.heading ? `<h3 class="sub rv"${E(`${p}.heading`)}>${esc(b.heading)}</h3>` : ''}${b.items.map(([t, d], i) =>
        `<div class="moment fu"><span class="n">${i + 1}</span><h4${E(`${p}.items.${i}.0`)}>${esc(t)}</h4><p${E(`${p}.items.${i}.1`)}>${md(d)}</p></div>`).join('')}</div>`;
      /* the three themes sit above the cards, one per column, so the talk can summarise them
         and leave the cards as evidence; each card's back carries its theme's colour */
      case 'quotes': return `<ul class="themes fu">${b.themes.map((t, i) => `<li class="t${i}"${E(`${p}.themes.${i}`)}>${esc(t)}</li>`).join('')}</ul>
          <div class="quotes" data-quotes>${b.items.map((q, i) => `<article class="q fu t${q.theme}" tabindex="0"><div class="q-in">
          <div class="q-front"><svg class="qm" viewBox="0 0 28 20" aria-hidden="true"><path d="M0 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8c0 5-3 9-8 10l-1-3c3-1 4-3 4-5H2a2 2 0 0 1-2-2zM16 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8c0 5-3 9-8 10l-1-3c3-1 4-3 4-5h-5a2 2 0 0 1-2-2z"/></svg>
            <p${E(`${p}.items.${i}.text`)}>${md(q.text)}</p><footer>${duck(q.face, 'sm')}<cite${E(`${p}.items.${i}.who`)}>${esc(q.who)}</cite></footer></div>
          <div class="q-back" aria-hidden="true">${duck(q.face, 'lg')}<p>${esc(b.themes[q.theme])}</p></div></div></article>`).join('')}</div>
          <p class="fine fu"${E(`${p}.note`)}>${esc(b.note)}</p>`;
      case 'hmw': return `<p class="hmw rv" data-underline${E(`${p}.text`)}>${md(b.text)}</p>`;
      case 'measures': return `<p class="measures-lead rv"${E(`${p}.lead`)}>${esc(b.lead)}</p><div class="measures">${b.items.map(([t, d, was], i) =>
        `<div class="measure fu"><h4${E(`${p}.items.${i}.0`)}>${esc(t)}</h4><p${E(`${p}.items.${i}.1`)}>${esc(d)}</p><span class="was"${E(`${p}.items.${i}.2`)}>${esc(was)}</span></div>`).join('')}</div>`;
      case 'step': return `<div class="step${b.frame && b.frame.narrow ? ' side' : ''}"><div class="step-copy">
          <h3 class="step-h fu"><span class="circle">${b.n}</span><span${E(`${p}.title`)}>${esc(b.title)}</span></h3>
          <ul class="bul">${b.bullets.map((x, i) => `<li class="rv"${E(`${p}.bullets.${i}`)}>${md(x)}</li>`).join('')}</ul></div>
          ${b.frame ? `<div class="fu">${frame(b.frame, `${p}.frame`)}</div>` : ''}</div>`;
      case 'screens': return `<div class="screens-wrap">${b.title ? `<h3 class="step-h fu"><span class="circle">${b.n}</span><span${E(`${p}.title`)}>${esc(b.title)}</span></h3>` : ''}
          ${b.lead ? `<p class="body rv"${E(`${p}.lead`)}>${md(b.lead)}</p>` : ''}
          <div class="screens">${b.items.map((it, i) => `<figure class="scr fu">${frame(it, `${p}.items.${i}`)}<figcaption${E(`${p}.items.${i}.title`)}>${esc(it.title)}</figcaption></figure>`).join('')}</div></div>`;
      case 'callout': return `<aside class="callout fu"><p class="eyebrow"${E(`${p}.label`)}>${esc(b.label)}</p><p${E(`${p}.text`)}>${md(b.text)}</p></aside>`;
      case 'result': return `<p class="result fu">${ic('star', 'lead')}<span${E(`${p}.text`)}>${md(b.text)}</span></p>`;
      case 'options': return `<div class="options">${b.items.map((o, i) => `<div class="opt fu ${o.verdict}">
          <span class="verdict">${o.verdict === 'yes' ? ic('star') + '<span>Yes</span>' : '<span>No</span>'}</span><h4${E(`${p}.items.${i}.where`)}>${esc(o.where)}</h4><p${E(`${p}.items.${i}.why`)}>${md(o.why)}</p></div>`).join('')}</div>
          ${b.result ? `<p class="result fu">${ic('star', 'lead')}<span${E(`${p}.result`)}>${md(b.result)}</span></p>` : ''}`;
      /* the options people voted on can carry a screen each, shown side by side above the tally */
      case 'vote': {
        const dots = n => `<span class="dots">${Array.from({ length: 8 }, (_, j) => `<i class="${j < n ? 'on' : ''}" style="--i:${j}"></i>`).join('')}</span>`;
        /* with screens, each option is a column: its screen, then its own tally under it. A
           face (x, y, w in % of the screen) lays the talking loop over the porthole it shows */
        if (b.shots) return `<figure class="vote fu" data-draw><p class="chart-title"${E(`${p}.title`)}>${esc(b.title)}</p><div class="vote-shots">${b.items.map(([l, n, win], i) => {
          const fc = (b.faces || [])[i];
          return `<figure class="vshot${win ? ' win' : ''}"><span class="vimg"><img src="${A(b.shots[i])}" alt="${esc(l)}" loading="lazy">${fc ? `<img class="face-loop" src="${A(fc.src)}" alt="" style="left:${fc.x}%;top:${fc.y}%;width:${fc.w}%">` : ''}</span>
            <figcaption><span class="hl"${E(`${p}.items.${i}.0`)}>${esc(l)}</span><span class="vtally">${dots(n)}<b>${n} of 8</b></span></figcaption></figure>`; }).join('')}</div>
          <p class="fine"${E(`${p}.note`)}>${esc(b.note)}</p></figure>`;
        return `<figure class="vote fu" data-draw><p class="chart-title"${E(`${p}.title`)}>${esc(b.title)}</p>${b.items.map(([l, n, win], i) =>
        `<div class="vrow${win ? ' win' : ''}"><span class="hl"${E(`${p}.items.${i}.0`)}>${esc(l)}</span><span class="dots">${Array.from({ length: 8 }, (_, j) =>
          `<i class="${j < n ? 'on' : ''}" style="--i:${j}"></i>`).join('')}</span><b>${n} of 8</b></div>`).join('')}
          <figcaption${E(`${p}.note`)}>${esc(b.note)}</figcaption></figure>`; }
      /* what clients needed the dashboard for, with how many asked, and the section each became */
      case 'needs': return `<figure class="needs fu" data-draw><p class="chart-title"${E(`${p}.title`)}>${esc(b.title)}</p>${b.items.map((it, i) => {
          const n = typeof it.n === 'number' ? it.n : 0, pr = it.prompted || 0;
          return `<div class="nrow"><div class="nneed"><span${E(`${p}.items.${i}.need`)}>${md(it.need)}</span>${it.sub ? `<em${E(`${p}.items.${i}.sub`)}>${md(it.sub)}</em>` : ''}</div>
          <span class="dots">${Array.from({ length: 8 }, (_, j) => `<i class="${j < n ? 'on' : j < n + pr ? 'asked' : ''}" style="--i:${j}"></i>`).join('')}</span><b>${typeof it.n === 'number' ? it.n : md(String(it.n))}${pr ? ` <small>+${pr}</small>` : ''} of 8</b>
          <span class="nto">${ic('arrow')}<span${E(`${p}.items.${i}.to`)}>${esc(it.to)}</span></span></div>`; }).join('')}
          ${b.legend ? `<p class="nlegend"><span><i class="on"></i>${esc(b.legend[0])}</span><span><i class="asked"></i>${esc(b.legend[1])}</span></p>` : ''}
          ${b.note ? `<figcaption${E(`${p}.note`)}>${md(b.note)}</figcaption>` : ''}
          ${b.shots ? `<div class="nshots">${b.shots.map((sh, i) => `<figure><img src="${A(sh.src)}" alt="${esc(sh.title)}" loading="lazy"><figcaption${E(`${p}.shots.${i}.title`)}>${esc(sh.title)}</figcaption></figure>`).join('')}</div>` : ''}</figure>`;
      /* the menu before and after, as the real menus, side by side */
      case 'menu': if (b.shots) return `<figure class="ia ia-shots fu"><figure><p class="eyebrow">Before · ${b.before.length}</p><img src="${A(b.shots[0])}" alt="The old menu: ${esc(b.before.join(', '))}" loading="lazy"></figure>
          <span class="ia-arrow" aria-hidden="true">${ic('arrow')}</span><figure><p class="eyebrow">After · ${b.after.length}</p><img src="${A(b.shots[1])}" alt="The new menu: ${esc(b.after.join(', '))}" loading="lazy"></figure>
          <figcaption${E(`${p}.caption`)}>${esc(b.caption)}</figcaption></figure>`;
        return `<figure class="ia fu" data-draw><div class="ia-col before"><p class="eyebrow">Before · ${b.before.length}</p>${b.before.map((m, i) =>
          `<span style="--i:${i}"${E(`${p}.before.${i}`)}>${esc(m)}</span>`).join('')}</div><span class="ia-arrow" aria-hidden="true">${ic('arrow')}</span>
          <div class="ia-col after"><p class="eyebrow">After · ${b.after.length}</p>${b.after.map((m, i) => `<span style="--i:${i}"${E(`${p}.after.${i}`)}>${esc(m)}</span>`).join('')}</div>
          <figcaption${E(`${p}.caption`)}>${esc(b.caption)}</figcaption></figure>`;
      case 'pair': {
        const id = 'cmp-' + p.replace(/\D+/g, '-');
        views[id] = { title: `${b.a.label} / ${b.b.label}`, clips: [], strip: [], live: '',
          compare: { a: { src: A(b.a.src), label: b.a.label }, b: { src: A(b.b.src), label: b.b.label } } };
        /* each side opens its own viewer when it has one (the whole screen, zoomable, with its
           iterations and live link); the wipe compare is the fallback */
        return `<div class="pair">${['a', 'b'].map(k => `<div class="fu"><p class="eyebrow"${E(`${p}.${k}.label`)}>${esc(b[k].label)}</p>${frame(Object.assign({}, b[k], { view: b[k].view || id }), `${p}.${k}`)}</div>`).join('')}</div>
          ${b.explore ? `<p class="explore fu"><a class="v-live" href="${esc(cs.liveBase + b.explore.href)}" target="_blank" rel="noopener"><span${E(`${p}.explore.label`)}>${esc(b.explore.label)}</span>${ic('external')}</a></p>` : ''}`;
      }
      case 'outcome': {
        const max = Math.max(...b.items.map(i => i.b));
        return `<div class="outcome" data-draw>${b.items.map((it, i) => `<div class="orow fu"><p class="eyebrow"${E(`${p}.items.${i}.label`)}>${esc(it.label)}</p>
          <div class="obar before"><span style="--w:${it.b / max * 100}%"></span><em${E(`${p}.items.${i}.before`)}>${esc(it.before)}</em></div>
          <div class="obar after"><span style="--w:${it.a / max * 100}%"></span><em${E(`${p}.items.${i}.after`)}>${esc(it.after)}</em></div></div>`).join('')}</div>
          <p class="result fu">${ic('arrow', 'lead')}<span${E(`${p}.note`)}>${md(b.note)}</span></p>`;
      }
      /* an override with before/after screens opens them side by side; one about logic or
         wording has no screens to show, so it reads as words alone */
      case 'overrides': {
        const detail = (o, i) => { const id = 'ovr-' + i, pics = o.before && o.after;
          if (pics) views[id] = { title: 'Where I overrode the AI · iterations ' + o.n, clips: [], strip: [], live: '',
            side: { quote: o.said, a: { src: A(o.before), label: 'The AI built', text: o.ai }, b: { src: A(o.after), label: 'What shipped', text: o.shipped } } };
          const img = k => pics ? `<img src="${A(o[k])}" alt="" loading="lazy">` : '';
          return `<div class="ovr-d${i ? '' : ' on'}${pics ? '' : ' words'}" data-i="${i}">
          <dl class="ovr-dl"><div><dt>The AI built</dt><dd${E(`${p}.items.${i}.ai`)}>${esc(o.ai)}</dd></div><div class="kept"><dt>What shipped</dt><dd${E(`${p}.items.${i}.shipped`)}>${esc(o.shipped)}</dd></div></dl>
          ${pics ? `<div class="ovr-pair${o.stack ? ' stack' : ''}" role="button" tabindex="0" data-view="${id}" aria-label="Compare full screen"><figure data-src-path="${p}.items.${i}.before">${img('before')}<figcaption>Before</figcaption></figure><figure class="kept" data-src-path="${p}.items.${i}.after">${img('after')}<figcaption>After</figcaption></figure></div>` : ''}</div>`; };
        /* tucked (divs, not buttons: editable text can't live in a button): the quotes are a list, and only the one you point at opens its detail in the
           panel beside it. Every detail shares one grid cell, so the panel is always as tall as
           the longest and the page never jumps */
        return `<div class="overrides fu" data-ovr><ol class="ovr-list">${b.items.map((o, i) => `<li><div role="button" tabindex="0" class="ovr-q${i ? '' : ' on'}" data-i="${i}" aria-pressed="${!i}"><span class="said">“<span${E(`${p}.items.${i}.said`)}>${esc(o.said)}</span>”</span><span class="iter-n">Iterations ${esc(o.n)}</span></div></li>`).join('')}</ol>
          <div class="ovr-panel">${b.items.map(detail).join('')}</div></div>`;
      }
      /* how I work: the Edit text clip beside a tally of where the iterations went */
      case 'process': {
        const t = b.track, max = Math.max(...t.rows.map(r => r[1]));
        return `<div class="process">${b.heading ? `<h3 class="sub rv"${E(`${p}.heading`)}>${esc(b.heading)}</h3>` : ''}<div class="proc-grid">
          <figure class="proc fu"><video src="${A(b.tools.clip)}" poster="${A(b.tools.poster)}" muted loop playsinline autoplay preload="metadata" aria-label="Edit text mode: a label rewritten in place, then a callout dragged"></video>
            <figcaption><h4${E(`${p}.tools.title`)}>${esc(b.tools.title)}</h4><p${E(`${p}.tools.text`)}>${md(b.tools.text)}</p></figcaption></figure>
          <figure class="proc fu" data-draw><div class="tally"><p class="tally-stat"${E(`${p}.track.stat`)}>${esc(t.stat)}</p><p class="chart-title"${E(`${p}.track.chart`)}>${esc(t.chart)}</p>
            ${t.rows.map(([l, n], i) => `<div class="trow2" title="${esc(l)}: ${n} iterations"><span${E(`${p}.track.rows.${i}.0`)}>${esc(l)}</span><i style="--w:${(n / max * 100).toFixed(1)}%"></i><b>${n}</b></div>`).join('')}
            <p class="fine"${E(`${p}.track.note`)}>${esc(t.note)}</p></div>
            <figcaption><h4${E(`${p}.track.title`)}>${esc(t.title)}</h4><p${E(`${p}.track.text`)}>${md(t.text)}</p></figcaption></figure></div></div>`;
      }
      case 'lessons': return `<div class="lessons">${b.items.map(([t, d], i) => `<div class="lesson fu"><h4${E(`${p}.items.${i}.0`)}>${esc(t)}</h4><p class="rv"${E(`${p}.items.${i}.1`)}>${md(d)}</p></div>`).join('')}</div>`;
      default: throw new Error(`walkthrough: unknown block type "${b.type}" in ${cs.slug}`);
    }
  };

  const section = (s, si) => `<section id="${esc(s.id)}" class="sec" data-tone="${esc(s.tone || 'ink')}" data-toc="${esc(s.toc)}">
    ${s.eyebrow ? `<p class="eyebrow fu"${E(`sections.${si}.eyebrow`)}>${esc(s.eyebrow)}</p>` : ''}${s.heading ? `<h2 class="h2 fu"${E(`sections.${si}.heading`)}>${md(s.heading)}</h2>` : ''}
    ${s.blocks.map((b, bi) => block(b, `sections.${si}.blocks.${bi}`)).join('\n')}</section>`;

  /* the cursor badge: a scalloped ring, the same one the reference uses */
  const scallop = (() => {
    const pts = [];
    for (let i = 0; i <= 120; i++) { const t = i / 120 * Math.PI * 2, r = 44 + 3.2 * Math.cos(t * 12); pts.push(`${(50 + r * Math.cos(t)).toFixed(2)} ${(50 + r * Math.sin(t)).toFixed(2)}`); }
    return `M${pts.join('L')}Z`;
  })();

  const caseHref = slug => { const c = cases.find(x => x.slug === slug); return c ? `${c.slug}.html` : 'index.html#work'; };
  const toc = [['top', 'Title'], ...cs.sections.map(s => [s.id, s.toc])];

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(cs.name)} walkthrough — ${esc(site.title)}</title>
<meta name="description" content="${esc(cs.tagline)}">
<link rel="icon" type="image/png" sizes="32x32" href="assets/favicon/favicon-32.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<!-- her hand has no digits, dashes or brackets yet; these few glyphs come from a thin
     handwritten stand-in until she writes them (text= keeps the download to those glyphs) -->
<link href="https://fonts.googleapis.com/css2?family=Shadows+Into+Light&text=0123456789%E2%80%93%E2%80%94-():%2F%25%2B%E2%86%92%C3%97%3F%26%22%E2%80%9C%E2%80%9D&display=swap" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500&family=DM+Sans:opsz,wght@9..40,400;9..40,500&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<script>document.documentElement.classList.add('js');
/* a refresh always starts at the top of the walkthrough (a #view- link still opens its viewer) */
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
if (location.hash && !/^#view-/.test(location.hash)) history.replaceState(null, '', location.pathname);</script>
<style>${CSS(asset)}</style>
</head>
<body data-tone="ink" data-slug="${esc(cs.slug)}" data-dir="${esc(cs.dir)}">
<div class="cursor gone" aria-hidden="true"><svg viewBox="0 0 100 100"><path d="${scallop}"/></svg><span>Click to explore</span></div>

<nav class="pill" aria-label="Main">
  <a class="wm wm-load" href="index.html">${(m => m ? `<span class="wm-m">${esc(m[1])}</span><span class="wm-d">${esc(m[2])}</span><span class="wm-k">${esc(m[3])}</span>` : esc(site.wordmark))(String(site.wordmark).match(/^(.)(-+)(.)$/))}</a>
  <a href="index.html#work">Work</a><a class="nav-opt" href="index.html#about">About</a><a class="nav-res" href="assets/resume.pdf" target="_blank" rel="noopener">Resume</a>
  <a class="cta" href="${esc(site.calendly)}" target="_blank" rel="noopener">say hey!</a>
</nav>
<a class="edge prev arrow-btn" href="${caseHref(cs.prev)}" aria-label="Previous project">${ic('back')}</a>
<a class="edge next arrow-btn" href="${caseHref(cs.next)}" aria-label="Next project">${ic('arrow')}</a>

<aside class="toc" aria-label="On this page">${toc.map(([id, l], i) => `<a href="#${esc(id)}" data-for="${esc(id)}" style="--i:${i}"><span>${esc(l)}</span></a>`).join('')}</aside>

<main>
<header id="top" class="hero sec" data-tone="ink">
  <p class="brand"><img src="${A('logo.svg')}" alt="" width="34" height="34">driftwood</p>
  <h1${E('title')}>${md(cs.title)}</h1>
  <p class="sub"${E('subtitle')}>${md(cs.subtitle)}</p>
  ${cs.designSystem ? `<p class="ds-row"><a class="btn-o" href="${esc(cs.designSystem)}" target="_blank" rel="noopener"><span>View design system</span>${ic('external')}</a></p>` : ''}
  <div class="stage">
    <div class="mac"><div class="screen frame bare" role="button" tabindex="0" data-view="${esc(cs.hero.main.view)}" data-src-path="hero.main.src" data-src="${esc(cs.hero.main.src)}" aria-label="Explore: ${esc(cs.hero.main.alt)}">
      <span class="shot"><img src="${A(cs.hero.main.src)}" alt="${esc(cs.hero.main.alt)}" fetchpriority="high">${mouseHTML(cs.hero.main.src)}</span></div><span class="base" aria-hidden="true"></span></div>
    ${cs.hero.floats.map(f => `<img class="float ${f.pos}" src="${A(f.src)}" alt="${esc(f.alt)}">`).join('')}
  </div>
</header>


${cs.sections.map(section).join('\n')}
</main>

<footer class="foot">
  <a class="foot-next" href="${caseHref(cs.next)}"><span class="eyebrow">Next project</span><span class="foot-name">${esc((cases.find(c => c.slug === cs.next) || {}).name || 'All work')}<span class="arrow-btn" aria-hidden="true">${ic('arrow')}</span></span></a>
  <p><a href="mailto:${esc(site.email)}">${esc(site.email)}</a></p>
</footer>

<dialog class="viewer" aria-label="Explore this screen" tabindex="-1">
  <div class="v-top">
    <button class="v-close" type="button" aria-label="Back to the walkthrough">${ic('back')}<span>Back</span></button>
    <p class="v-title"></p>
    <div class="v-tabs" role="tablist"><span class="v-thumb" aria-hidden="true"></span><button type="button" role="tab" data-tab="clip">Interaction</button><button type="button" role="tab" data-tab="iter">Iterations</button></div>
    <a class="v-live" target="_blank" rel="noopener"><span>Open live prototype</span>${ic('external')}</a>
  </div>
  <div class="v-stage"><video playsinline muted loop controls preload="none"></video><img alt=""><svg class="mouse v-mouse" viewBox="0 0 18 22" hidden aria-hidden="true"></svg>
    <button class="v-nav prev arrow-btn" type="button" aria-label="Previous">${ic('back')}</button><button class="v-nav next arrow-btn" type="button" aria-label="Next">${ic('arrow')}</button>
    <div class="v-cmp" hidden><img class="ca" alt=""><img class="cb" alt=""><span class="cl la"></span><span class="cl lb"></span><span class="cmp-knob" aria-hidden="true">${ic('swap')}</span>
      <input type="range" min="0" max="100" value="50" step=".5" aria-label="Drag to wipe between before and after"></div>
    <div class="v-side" hidden><figure><img alt=""><figcaption></figcaption></figure><figure class="kept"><img alt=""><figcaption></figcaption></figure></div>
  </div>
  <div class="v-cap"><p class="v-why"></p><p class="v-ask"></p></div>
  <div class="v-groups" role="tablist" aria-label="Screen"></div>
  <div class="v-strip" role="list"></div>
</dialog>

<script>window.__SHOTS=${JSON.stringify(shotGroups).replace(/</g, '\\u003c')}</script>
<script>window.__IC=${JSON.stringify(ICONS)};window.__CURSORS=${JSON.stringify(Object.fromEntries(Object.entries(cs.cursors || {}).map(([k, v]) => [`${cs.dir}/${k}`, v])))};window.__MOUSE='${MOUSE}'</script>
<script>window.__VIEWS=${JSON.stringify(views).replace(/</g, '\\u003c')}</script>
<script>${JS}</script>
</body>
</html>`;
};

const CSS = asset => `
@font-face{font-family:'Madhu Hand';src:url(${asset('assets/fonts/madhu-hand.woff')}) format('woff');font-display:swap}
:root{--ink:#0f1013;--navy:#121a2c;--card:#161a24;--line:#262a33;--dim:#6b6f7a;--body:#a9adb7;--hi:#f3f4f6;--blue:#8fb2f2;--blue-soft:#a9c4f5;--pink:#ec6fa0;--ok:#62b58f;--bad:#e2686b;--cy:#5fc0d8;--lab:220px;
  --ease:cubic-bezier(.2,.7,.2,1)}
*{margin:0;padding:0;box-sizing:border-box}
html{scroll-behavior:smooth;scroll-padding-top:90px}
body{background:var(--ink);color:var(--body);font:300 18px/1.65 'Plus Jakarta Sans',system-ui,sans-serif;transition:background-color .9s var(--ease);-webkit-font-smoothing:antialiased;overflow-x:hidden}
/* design rule: no orphan words. Running text wraps so a last line never holds one word;
   headings and short labels balance their lines */
p,li,dd,dt,figcaption,h4,blockquote{text-wrap:pretty}
h1,h2,h3,.h2,.hmw,.hook p,.note,.said{text-wrap:balance}
body[data-tone=navy]{background:var(--navy)}
b{color:var(--hi);font-weight:600}
u{text-decoration:none;background:linear-gradient(currentColor,currentColor) 0 100%/var(--u,0%) 2px no-repeat;transition:background-size 1.2s .3s var(--ease)}
.in u{--u:100%}
a{color:inherit}
button{font:inherit;color:inherit;background:none;border:0;cursor:pointer}
img{display:block;max-width:100%}
.eyebrow{font:500 13px/1 'Plus Jakarta Sans';letter-spacing:.12em;text-transform:uppercase;color:var(--blue);margin-bottom:14px}

/* nav pill + edge arrows */
.pill{position:fixed;top:18px;left:50%;transform:translateX(-50%);z-index:30;display:flex;align-items:center;gap:6px;padding:6px 6px 6px 18px;border-radius:999px;background:rgba(22,27,40,.82);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border:1px solid #232a3a}
.pill a{white-space:nowrap;font-size:16px;font-weight:400;color:#9aa0ad;text-decoration:none;padding:8px 18px;border-radius:999px;transition:color .2s}
.pill a:hover{color:var(--hi)}
.pill a.cta{background:#fff;color:#111;font-weight:500}
/* the wordmark keeps the site's own face — Cormorant Garamond, as in the main nav */
.pill a.wm{font:400 22px/1 'Cormorant Garamond',Georgia,serif;letter-spacing:.02em;color:var(--hi);padding:6px 14px 6px 4px;--wm-dx:.34em}
/* the home page's wordmark greeting, copied from build.js: M and K start together and ease
   apart as the dashes appear; hovering squishes them back. --wm-dx is half the width of "--" */
.wm-m,.wm-k,.wm-d{display:inline-block}
.wm-m,.wm-k{transition:transform .38s cubic-bezier(.2,.7,.2,1)}
.wm-d{transform-origin:50% 50%;transition:transform .38s cubic-bezier(.2,.7,.2,1),opacity .28s cubic-bezier(.33,0,.2,1)}
.wm:hover .wm-m{transform:translateX(var(--wm-dx))}
.wm:hover .wm-k{transform:translateX(calc(-1*var(--wm-dx)))}
.wm:hover .wm-d{opacity:0;transform:scaleX(.1)}
@keyframes wm-in-m{from{transform:translateX(var(--wm-dx))}to{transform:none}}
@keyframes wm-in-k{from{transform:translateX(calc(-1*var(--wm-dx)))}to{transform:none}}
@keyframes wm-in-d{from{opacity:0;transform:scaleX(.1)}to{opacity:1;transform:none}}
.wm-load .wm-m{animation:wm-in-m .8s cubic-bezier(.2,.7,.2,1) .5s backwards}
.wm-load .wm-k{animation:wm-in-k .8s cubic-bezier(.2,.7,.2,1) .5s backwards}
.wm-load .wm-d{animation:wm-in-d .8s cubic-bezier(.2,.7,.2,1) .5s backwards}
/* one arrow button for the whole page: project edges, the viewer carousel, the footer */
.arrow-btn{flex:none;width:48px;height:48px;padding:0;border-radius:50%;border:1px solid #2a2f3a;display:grid;place-items:center;background:rgba(15,16,19,.75);color:#e9eaee;transition:border-color .2s,transform .3s var(--ease)}
.arrow-btn:hover,a:hover>*>.arrow-btn{border-color:#5a6070;transform:scale(1.06)}
.arrow-btn .ic{width:20px;height:20px;stroke-width:1.6}
.edge{position:fixed;top:22px;z-index:30}
.edge.prev{left:24px}.edge.next{right:24px}
/* the top bar (pill + project arrows) slides away while reading down and drops back on any
   scroll up */
.pill,.edge{transition:transform .6s cubic-bezier(.22,1,.36,1),opacity .5s ease,border-color .2s}
.nav-away .pill{transform:translate(-50%,-160%);opacity:0;pointer-events:none}
.nav-away .edge{transform:translateY(-160%);opacity:0;pointer-events:none}

/* TOC: a quiet column of dashes docked bottom-left, the section you're in longest and
   brightest. Moving onto the side opens it like the macOS Dock: the labels slide out on a
   dark panel and the dash under the pointer (and its neighbours, a little) grows. */
.toc{position:fixed;left:0;bottom:40px;z-index:20;display:flex;flex-direction:column;gap:6px;padding:16px 28px 16px 44px;border-radius:0 14px 14px 0;opacity:0;visibility:hidden;transform:translateY(10px);transition:opacity .6s var(--ease),visibility .6s,transform .6s var(--ease),background .3s}
/* it waits out the hero, where it crowded the title, and arrives with the second section */
.past-hero .toc{opacity:1;visibility:visible;transform:none}
.toc:hover{background:rgba(15,16,19,.88);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}
.toc a{display:flex;align-items:center;gap:12px;font-size:13px;font-weight:400;color:#5d616b;text-decoration:none;letter-spacing:.02em;transition:color .35s}
.toc a::before{content:'';flex:none;width:30px;height:2px;border-radius:1px;background:#3a3f4a;transform:scaleX(.4);transform-origin:left;transition:transform .3s var(--ease),background .3s}
.toc a.on::before{transform:scaleX(.73);background:var(--hi)}
.toc a span{opacity:0;transform:translateX(-6px);white-space:nowrap;transition:opacity .25s,transform .3s var(--ease)}
.toc:hover a span{opacity:1;transform:none;transition-delay:calc(var(--i) * 18ms)}
.toc a:hover,.toc a.on{color:var(--hi)}.toc a.on{font-weight:600}
.toc a:hover::before{transform:none;background:#b8bcc5}
.toc a:hover+a::before,.toc a:has(+a:hover)::before{transform:scaleX(.66)}
@media (max-width:1180px){.toc{display:none}}

main{position:relative}
.sec{max-width:820px;margin:0 auto;padding:120px 24px 40px}
/* a section blurs out once the next one's title reaches the middle of the screen */
.sec{transition:filter .7s var(--ease),opacity .7s var(--ease)}
.sec.past{filter:blur(6px);opacity:.3}
.editing .sec.past{filter:none;opacity:1}
#feel{padding-top:0;padding-bottom:0}
.h2{font-size:clamp(30px,4vw,44px);line-height:1.18;font-weight:600;color:var(--hi);letter-spacing:-.01em;margin-bottom:34px}
.sub{font-size:21px;color:var(--hi);font-weight:500;margin:52px 0 18px}
h3.sub{font-size:24px;margin:72px 0 26px}
.body{margin:30px 0}
.lede p{font-size:22px;line-height:1.6;margin-bottom:26px}

/* hero */
.hero{max-width:none;padding:118px 24px 0;text-align:center;overflow:hidden}
.brand{display:inline-flex;align-items:center;gap:10px;font:600 24px 'Plus Jakarta Sans';color:var(--hi);letter-spacing:-.01em}
.brand img{border-radius:9px}
.hero h1{font-size:clamp(38px,6.2vw,74px);line-height:1.04;font-weight:600;color:var(--hi);letter-spacing:-.025em;margin:46px auto 0;max-width:1080px}
.hero .sub{font-weight:300;font-size:clamp(19px,2.4vw,30px);margin:14px 0 0}
.hero h1,.hero .sub,.brand{animation:rise 1s var(--ease) both}.hero .sub{animation-delay:.12s}.hero h1{animation-delay:.06s}
.stage{position:relative;max-width:1000px;margin:70px auto 0;--p:0}
.mac{position:relative;width:min(760px,86%);margin:0 auto;transform:translateY(calc(var(--p) * -30px))}
.mac .screen{display:block;width:100%;border:10px solid #1d1f25;border-bottom-width:14px;border-radius:18px 18px 4px 4px;overflow:hidden;background:#fff;box-shadow:0 40px 120px -30px rgba(80,120,200,.35)}
.mac .screen img{width:100%;height:auto}
.mac .base{display:block;height:14px;margin:0 -7%;background:linear-gradient(#2b2e36,#16181d);border-radius:0 0 14px 14px}
.float{position:absolute;border-radius:16px;border:1px solid rgba(255,255,255,.18);box-shadow:0 30px 60px -20px rgba(0,0,0,.7),0 0 0 6px rgba(255,255,255,.04);animation:rise 1.2s .35s var(--ease) both}
.float.left{width:min(250px,28%);left:0;bottom:-6%;transform:translateY(calc(var(--p) * -110px)) rotate(-2deg)}
/* starts level with the screen's top edge and drifts up only a little, so it never rises into the subline */
.float.right{width:min(230px,26%);right:-2%;top:6%;transform:translateY(calc(var(--p) * -60px)) rotate(2deg)}
@keyframes rise{from{opacity:0;transform:translateY(24px)}}

.hook{margin-bottom:20vh}
.hook p{min-height:48vh;display:flex;align-items:center;font-size:clamp(30px,4.2vw,50px);line-height:1.2;font-weight:500;letter-spacing:-.015em;color:#d9dce2}
.hook b{color:var(--bad);font-weight:600}
@supports (animation-timeline:view()){
  .js .hook p{animation:hook-line linear both;animation-timeline:view();animation-range:entry 0% exit 100%}
  @keyframes hook-line{0%,28%{opacity:0}40%,60%{opacity:1}72%,100%{opacity:0}}
}
.editing .hook{margin-bottom:0}
.editing .hook p{min-height:0;margin:24px 0;animation:none!important;opacity:1!important}
/* project facts, up front under the hero: a quiet grid, no rules, room around each */
.meta{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:40px 56px;margin:72px 0 8vh}
/* one thing on screen at a time: the facts fade out as they rise, gone before the first idea
   line starts fading in below them */
@supports (animation-timeline:view()){
  .js .meta{animation:meta-out linear both;animation-timeline:view();animation-range:exit -30vh exit -5vh}
  @keyframes meta-out{to{opacity:0}}
}
.editing .meta{animation:none!important;opacity:1!important}
.meta dt{font-size:14px;color:var(--dim);font-weight:500}
.meta dd{margin:6px 0 0;font-size:16px;line-height:1.5;color:#c3c7cf}
@media (max-width:640px){.meta{grid-template-columns:repeat(2,minmax(0,1fr));gap:28px 24px}}
/* a label with more to say: dotted underline, and the note rises on hover or focus */
.has-tip{position:relative}
.has-tip>span:first-child{border-bottom:1px dashed #5d6270}
.tip{position:absolute;left:0;bottom:calc(100% + 10px);z-index:5;width:230px;padding:10px 12px;border-radius:10px;background:#1c2232;border:1px solid #2f3850;color:#d9dce2;font-size:13px;line-height:1.45;box-shadow:0 14px 30px rgba(0,0,0,.45);opacity:0;transform:translateY(6px);pointer-events:none;transition:opacity .25s,transform .25s var(--ease)}
.has-tip:hover .tip,.has-tip:focus-within .tip,.editing .tip{opacity:1;transform:none;pointer-events:auto}
.editing .tip{position:static;display:block;margin-top:6px;width:auto}
/* the pointer is sized to the screenshot it sits on (a real cursor is ~1.5% of a 1280px screen),
   so it shrinks with the hero's scaled-down dashboard instead of towering over it */
.mouse{position:absolute;width:1.5%;min-width:8px;height:auto;aspect-ratio:18/22;z-index:3;pointer-events:none;fill:#111;stroke:#fff;stroke-width:1.3;stroke-linejoin:round;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))}
.v-mouse{width:18px;height:auto;aspect-ratio:18/22}
.v-stage>svg.v-mouse{position:absolute;inset:auto}
.frame.placing,.frame.placing *{cursor:crosshair!important}
.place{position:absolute;top:10px;right:132px;z-index:5;padding:7px 12px;border-radius:999px;background:#1b1f29;border:1px solid var(--pink);color:#fff;font-size:13px;font-weight:500}
.frame.placing .place{background:var(--pink)}
/* every icon: a centred 24-unit shape in currentColor; icon + words sit on one centre line */
.ic{display:block;flex:none;width:1.1em;height:1.1em;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.v-close,.v-live,.edit-bar button,.swap,.place,.verdict,.result{display:inline-flex;align-items:center;gap:8px}
.result .ic.lead{width:20px;height:20px;color:#f2c46d;align-self:center}
.verdict .ic{width:13px;height:13px}
.ia-arrow{display:grid;place-items:center}.ia-arrow .ic{width:26px;height:26px}
mark.tk{background:#f2c46d;color:#1b1406;font-weight:700;padding:0 5px;border-radius:4px}

/* scroll-linked brightening — native scroll timelines, no JS; browsers without them just
   show the text at full strength */
@supports (animation-timeline:view()){
  .js .rv{animation:bright linear both;animation-timeline:view();animation-range:entry 0% cover 38%}
  @keyframes bright{from{opacity:.22}to{opacity:1}}
}
/* fade-up: JS adds .in when a block enters; without JS everything is simply visible */
.js .fu{opacity:0;transform:translateY(28px);transition:opacity .9s var(--ease),transform .9s var(--ease)}
.js .fu.in{opacity:1;transform:none}

/* charts — thin lines on dark, labels at the tips, source underneath */
.chart{margin:56px 0;padding:34px 0 0}
.chart-title{font-size:16px;font-weight:500;color:#d7dae0;margin-bottom:22px}
.legend{display:flex;gap:26px;justify-content:center;font-size:16px;color:#8d929e;margin-bottom:28px}
.k::before{content:'';display:inline-block;width:18px;height:2px;margin:0 8px 4px 0;background:currentColor;vertical-align:middle}
.k.ok{color:var(--ok)}.k.bad{color:var(--bad)}.k.dim{color:#7d828f}
.hbars,.tl{position:relative;padding:0 0 34px}
.grid{position:absolute;top:0;bottom:20px;width:1px;background:#23262e;left:calc(var(--lab) + (100% - var(--lab)) * var(--g,0))}
.grid em{position:absolute;bottom:-22px;left:0;transform:translateX(-50%);font:400 13px 'Plus Jakarta Sans';font-style:normal;color:#6c717c;white-space:nowrap}
.hrow,.trow{position:relative;display:flex;align-items:center;height:58px}
.hl{flex:0 0 var(--lab);font-size:15px;color:#9da2ad;padding-right:16px}
.track{position:relative;flex:1;height:100%}
.bar{position:absolute;left:0;top:50%;height:3px;margin-top:-1.5px;width:0;border-radius:2px;transition:width 1.4s var(--ease)}
.bar.ok{background:var(--ok)}.bar.bad{background:var(--bad);height:5px;margin-top:-2.5px}.bar.dim{background:#7d828f}
.in .bar,.drawn .bar{width:var(--w)}
.end{position:absolute;top:50%;transform:translate(10px,-50%);font-size:16px;font-weight:500;opacity:0;transition:opacity .5s 1.2s}
.end.ok{color:var(--ok)}.end.bad{color:var(--bad)}.end.dim{color:#9196a1}
.in .end{opacity:1}
.big-callout{margin:24px 0 0 var(--lab);font-size:17px;color:#9da2ad}.big-callout b{font-size:40px;color:var(--bad);margin-right:4px;letter-spacing:-.02em}
figcaption{font-size:12px;color:#5f636d;margin-top:20px}
.seg{position:absolute;left:var(--l);top:16px;height:26px;width:0;border-radius:4px;background:linear-gradient(90deg,rgba(143,178,242,.35),rgba(143,178,242,.15));border-left:2px solid var(--blue);transition:width 1.3s var(--ease)}
.trow:nth-of-type(2) .seg{transition-delay:.5s;background:linear-gradient(90deg,rgba(226,104,107,.35),rgba(226,104,107,.12));border-color:var(--bad)}
.in .seg{width:var(--w)}
.seg em{position:absolute;left:10px;top:50%;transform:translateY(-50%);white-space:nowrap;font:400 13px 'Plus Jakarta Sans';font-style:normal;color:#d3d7df;opacity:0;transition:opacity .5s 1.2s}
.in .seg em{opacity:1}
.tl{padding-bottom:84px}
.mark{position:absolute;top:-6px;bottom:52px;width:0;border-left:1.5px dashed;opacity:0;transition:opacity .6s 1.6s}
.mark.bad{color:var(--bad)}.mark.ok{color:var(--ok)}
.in .mark{opacity:1}
.mark em{position:absolute;bottom:-40px;left:0;font-family:'Madhu Hand','Shadows Into Light',cursive;font-size:21px;font-style:normal;white-space:nowrap;transform:translateX(-100%) translateX(-8px)}
.mark.ok em{transform:translateX(-50%);bottom:auto;top:-30px}

/* numbered moments */
.moments{margin:20px 0}
.moment{display:grid;grid-template-columns:44px 230px 1fr;gap:6px 20px;align-items:center;padding:24px 0;border-top:1px solid #1d2028}
.moment .n{width:28px;height:28px;border-radius:50%;border:1.5px solid #cfd3da;display:grid;place-items:center;font-size:14px;color:#cfd3da}
.moment h4{font-size:19px;font-weight:500;color:#c5c9d1}
.moment p{font-size:16px;color:#7e838e}
@media (max-width:720px){.moment{grid-template-columns:40px 1fr}.moment p{grid-column:2}}

/* voice-of-client cards; hover flips one to its theme, like the reference */
.quotes{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:26px -40px 14px}
@media (max-width:1060px){.quotes{margin-inline:0;grid-template-columns:repeat(2,1fr)}}
.themes{list-style:none;display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:40px -40px 0;padding:0}
.themes li{display:flex;align-items:center;gap:10px;padding:0 4px;font-size:16px;font-weight:500;color:var(--hi)}
.themes li::before{content:"";flex:none;width:10px;height:10px;border-radius:50%;background:var(--t)}
@media (max-width:1060px){.themes{margin-inline:0;display:flex;flex-wrap:wrap;gap:10px 24px}}
.t0{--t:#a9c4f5}.t1{--t:#f2c46d}.t2{--t:#8fd8c6}
/* a real card flip on the vertical axis, with perspective, as in the reference: hover turns
   the card to its theme, leaving turns it back */
.q{position:relative;min-height:236px;perspective:1100px;outline:none}
.q-in{position:absolute;inset:0;transform-style:preserve-3d;transition:transform .75s cubic-bezier(.3,.7,.2,1)}
.q.on .q-in{transform:rotateY(180deg)}
.q-front,.q-back{position:absolute;inset:0;padding:22px 18px 18px;display:flex;flex-direction:column;border-radius:14px;-webkit-backface-visibility:hidden;backface-visibility:hidden}
.q-front{background:linear-gradient(180deg,#141a2b,#11141c);border:1px solid #1d2232}
.q:focus-visible .q-front{outline:2px solid var(--cy);outline-offset:3px}
.qm{width:24px;fill:var(--blue);margin-bottom:22px}
.q-front p{font-size:14px;line-height:1.5;color:#b5bac4;font-weight:400}
.q-front footer{margin-top:auto;display:flex;align-items:center;gap:8px}
.q-front cite{font-size:11px;font-style:italic;color:#8fb2f2}
.q-back{background:var(--t);color:#10141f;align-items:center;justify-content:center;text-align:center;transform:rotateY(180deg)}
.q-back p{font-weight:600;font-size:17px}
.duck{display:inline-flex;flex-direction:column;justify-content:center;align-items:center;flex:none;font:700 6px/1.02 ui-monospace,'SF Mono',Menlo,monospace;color:#f0c33c;white-space:pre}
.duck>span{display:block}
.duck b{color:#e08a2e;font-weight:700}.duck em{font-style:normal}.duck .w{color:#8fb2f2}.duck .l{color:#a5774c}.duck .x{color:#e8eaee}
.duck.sm{width:52px;height:52px;border-radius:50%;background:#0d2a40;border:1px solid #1d3d57;font-size:6.6px}
.duck.lg{font-size:13px;padding:14px 18px;border-radius:14px;background:#0f1a2a;margin-bottom:16px}
.fine{font-size:12px;color:#5f636d}

/* the question */
.hmw{font-size:clamp(28px,3.6vw,40px);line-height:1.3;font-weight:600;color:var(--hi);letter-spacing:-.01em;margin-bottom:64px}
.measures-lead{font-size:17px;margin-bottom:18px}
.measures{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
@media (max-width:760px){.measures{grid-template-columns:1fr}}
.measure{padding:24px 22px;border-radius:14px;background:rgba(255,255,255,.035);border:1px solid #232b40}
.measure h4{color:var(--hi);font-size:19px;font-weight:600;margin-bottom:8px}
.measure p{font-size:15px;line-height:1.5;color:#8d93a1;margin-bottom:18px}
.was{display:inline-block;font-size:14px;color:var(--bad);border:1px solid rgba(226,104,107,.4);border-radius:999px;padding:3px 12px}

/* numbered steps */
.step{margin:84px 0}
.screens-wrap{margin:84px 0}
.screens{display:grid;grid-template-columns:1fr 1fr;gap:34px 26px;margin:26px -70px 0}
.scr{margin:0}.scr figcaption{margin-top:12px;font-size:15px;font-weight:500;color:#c5c9d1}
/* an odd last screen sits centred under the pairs */
.screens .scr:last-child:nth-child(odd){grid-column:1/-1;justify-self:center;width:calc(50% - 13px)}
@media (max-width:700px){.screens .scr:last-child:nth-child(odd){width:auto}}
.screens .note{font-size:16px;max-width:150px}
@media (max-width:1000px){.screens{margin-inline:0}}
@media (max-width:640px){.screens{grid-template-columns:1fr}}
.step-h{display:flex;align-items:center;gap:16px;font-size:21px;font-weight:500;color:var(--blue-soft);margin-bottom:22px}
.circle{flex:0 0 46px;height:46px;border-radius:50%;background:#e8eaee;color:#7d828f;display:grid;place-items:center;font-size:21px;font-weight:300}
.bul{list-style:none;margin:0 0 36px 62px}
.bul li{position:relative;font-size:17px;margin-bottom:8px}
.bul li::before{content:'';position:absolute;left:-16px;top:.75em;width:4px;height:4px;border-radius:50%;background:#6b6f7a}
.step.side{display:grid;grid-template-columns:1fr 330px;gap:40px;align-items:center}
@media (max-width:760px){.step.side{grid-template-columns:1fr}.bul{margin-left:24px}}

/* frames: dimmed until hovered, then reveal (a "lit" frame stays lit); click opens the viewer */
.frame{display:block;width:100%;position:relative;cursor:pointer;border-radius:16px;overflow:visible;background:#1a1d24;border:1px solid #2a2e38;text-align:left;box-shadow:0 30px 80px -40px rgba(0,0,0,.8);transition:transform .6s var(--ease),border-color .4s,box-shadow .6s}
.frame .chrome{display:flex;align-items:center;gap:6px;height:30px;padding:0 12px;background:#1e2129;border-bottom:1px solid #2a2e38;border-radius:15px 15px 0 0}
.frame .chrome i{width:9px;height:9px;border-radius:50%;background:#3a3e48}
.frame .chrome span{margin-left:12px;font-size:11px;color:#6e7380;background:#15171c;border-radius:6px;padding:2px 12px}
.shot{position:relative;display:block}
/* the frame doesn't clip (a callout may hang off the screen), so the screenshot rounds its own corners */
.frame img{width:100%;border-radius:0 0 15px 15px;transition:filter .7s var(--ease),transform 1.2s var(--ease)}
.frame.narrow img{border-radius:19px}.frame.bare .chrome{border-radius:17px 17px 0 0}.frame.bare img{border-radius:0 0 3px 3px}
@media (hover:hover){
  .frame img{filter:brightness(.42) saturate(.6)}
  .frame:hover img,.frame:focus-visible img,.frame.lit img{filter:none}
  .frame:hover{border-color:#4a5268;box-shadow:0 40px 100px -40px rgba(95,192,216,.25)}
}
.frame:focus-visible{outline:2px solid var(--cy);outline-offset:4px}
.frame.narrow{max-width:330px;margin:0 auto;border-radius:20px}
.frame.bare{border-radius:18px 18px 4px 4px}
.frame.bare img{filter:none!important}
.notes-svg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible}
.notes-svg path{fill:none;stroke:var(--pink);stroke-width:1.4;vector-effect:non-scaling-stroke;stroke-dasharray:.012 .012;stroke-dashoffset:0}
.notes-svg circle{fill:var(--pink)}
.note{position:absolute;z-index:4;width:max-content;max-width:190px;transform:translate(-50%,-50%);font-family:'Madhu Hand','Shadows Into Light',cursive;font-size:20px;line-height:1.05;color:var(--pink);text-align:center;pointer-events:none;text-shadow:0 1px 8px rgba(0,0,0,.55);transition:opacity .6s}
.js .fu:not(.in) .note{opacity:0}

.callout{margin:60px 0;padding:26px 28px;border-left:2px solid var(--blue);background:linear-gradient(90deg,rgba(143,178,242,.08),transparent)}
.callout p:last-child{font-size:20px;color:#c8ccd4}
.result{display:flex;gap:14px;align-items:center;margin:40px 0;padding:20px 24px;border-radius:14px;border:1px solid #233046;background:#121827;font-size:19px;color:#c5c9d1}
/* stats stacked after the evidence read as one group */
.result+.result{margin-top:-28px}

.options{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:10px}
@media (max-width:760px){.options{grid-template-columns:1fr}}
.opt{padding:24px 20px;border-radius:14px;border:1px solid #232733;background:#14161c}
.opt.yes{border-color:#3d5c8f;background:linear-gradient(180deg,#152038,#121827)}
.verdict{display:inline-flex;align-items:center;gap:6px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;border-radius:999px;padding:3px 10px;margin-bottom:16px;color:var(--bad);border:1px solid rgba(226,104,107,.4)}
.yes .verdict{color:#f2c46d;border-color:rgba(242,196,109,.5)}
.opt h4{color:var(--hi);font-size:19px;font-weight:600;margin-bottom:8px}
.opt p{font-size:15px;line-height:1.55;color:#8d93a1}

.vote{margin:70px 0}
.needs{margin:56px 0 100px}
.nrow{display:grid;grid-template-columns:minmax(0,1fr) auto 66px 120px;gap:18px;align-items:center;padding:16px 0;border-bottom:1px solid #1d2028}
.nneed{font-size:17px;color:#d2d6de;line-height:1.4}.nneed em{display:block;font-style:normal;font-size:14px;color:#8d93a1;margin-top:3px}
.nrow>b{font-size:14px;color:var(--blue-soft);font-weight:500;white-space:nowrap}
.nto{display:inline-flex;align-items:center;gap:8px;font-size:15px;font-weight:500;color:var(--hi)}.nto .ic{width:16px;height:16px;color:var(--blue)}
.in.needs .dots i.on,.needs.in .dots i.on{background:var(--blue);border-color:var(--blue)}
.in .needs .dots i.asked,.needs.in .dots i.asked{border-color:var(--blue);border-style:dashed}
.nrow>b small{font-size:12px;color:#8d93a1}
.nlegend{display:flex;gap:22px;margin-top:14px;font-size:13px;color:#8d93a1}.nlegend span{display:inline-flex;align-items:center;gap:8px}
.nlegend i{width:12px;height:12px;border-radius:50%;border:1.5px solid var(--blue)}.nlegend i.on{background:var(--blue)}.nlegend i.asked{border-style:dashed}
.nshots{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;margin:48px -60px 0}
/* each Home section shown whole at one shared height; a taller one sits on the dashboard's own ground */
.nshots figure{margin:0}.nshots img{width:100%;aspect-ratio:1400/918;object-fit:contain;object-position:center top;border-radius:12px;border:1px solid #2a2e38;background:#f4f6f8}
.nshots figcaption{margin-top:14px;font-size:14px;color:#c5c9d1}
@media (max-width:1000px){.nshots{margin-inline:0}}@media (max-width:640px){.nshots{grid-template-columns:1fr}}
.ia-shots{display:grid;grid-template-columns:1fr auto 1fr;gap:28px;align-items:start;max-width:620px;margin:50px auto}
.ia-shots>figure{margin:0}.ia-shots img{width:100%;border-radius:12px;border:1px solid #2a2e38}
.ia-shots .ia-arrow{align-self:center}.ia-shots>figcaption{grid-column:1/-1;font-size:14px;color:#8d93a1;text-align:center}
.needs figcaption{margin-top:16px;font-size:14px;color:#8d93a1}
@media (max-width:640px){.nrow{grid-template-columns:1fr auto;row-gap:8px}.nrow .dots{display:none}}
.vote-shots{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin:6px -60px 30px}
.vshot{margin:0}.vimg{position:relative;display:block}
.vimg>img:first-child{width:100%;border-radius:12px;border:1px solid #2a2e38;filter:brightness(.7) saturate(.7);transition:filter .5s var(--ease)}
.vshot:hover .vimg>img:first-child{filter:none}
.vshot.win .vimg>img:first-child{border-color:#3d5c8f;filter:none}
.vimg .face-loop{position:absolute;aspect-ratio:1;border-radius:50%;object-fit:cover}
.vshot figcaption{margin-top:14px;display:flex;flex-direction:column;gap:10px}
.vshot .hl{flex:none;padding:0;font-size:15px;color:#c5c9d1}.vshot.win .hl{color:var(--blue-soft)}
.vtally{display:flex;align-items:center;gap:14px}.vtally b{font-weight:500;font-size:15px;color:#8d929e}.vshot.win .vtally b{color:var(--blue)}
.in .vshot.win .dots i.on{background:var(--blue);border-color:var(--blue)}
.vote .fine{margin-top:22px;font-size:14px;color:#8d93a1}
@media (max-width:1000px){.vote-shots{margin-inline:0}}
@media (max-width:640px){.vote-shots{grid-template-columns:1fr}}
.vrow{display:flex;align-items:center;gap:18px;padding:12px 0;--lab:280px}
.vrow .hl{flex-basis:280px}
.dots{display:flex;gap:8px}
.dots i{width:16px;height:16px;border-radius:50%;border:1.5px solid #3a3f4b;transition:background-color .4s calc(var(--i) * 90ms),border-color .4s calc(var(--i) * 90ms)}
.in .dots i.on{background:#7d828f;border-color:#7d828f}
.in .win .dots i.on{background:var(--blue);border-color:var(--blue)}
.vrow b{font-weight:500;font-size:15px;color:#8d929e}.vrow.win b{color:var(--blue)}
@media (max-width:640px){.vrow{flex-wrap:wrap}.vrow .hl{flex-basis:100%}}

.ia{display:grid;grid-template-columns:1fr 60px 1fr;align-items:start;margin:30px 0 70px;padding:30px;border-radius:16px;border:1px solid #1f232c;background:#13151a}
.ia-col span{display:block;font-size:15px;padding:7px 12px;margin-bottom:4px;border-radius:8px;color:#9ba0ab;transition:opacity .5s calc(var(--i) * 70ms),transform .5s calc(var(--i) * 70ms) var(--ease),color .5s calc(var(--i) * 70ms)}
.in .ia-col.before span{opacity:.32;text-decoration:line-through;text-decoration-color:#4b505b}
.ia-col.after span{color:var(--hi);background:rgba(143,178,242,.08);opacity:0;transform:translateX(-14px);transition-delay:calc(.9s + var(--i) * 90ms)}
.in .ia-col.after span{opacity:1;transform:none}
.ia-arrow{align-self:center;text-align:center;font-size:26px;color:var(--blue)}
.ia figcaption{grid-column:1/-1}

/* wide: the two Homes run almost the window's width, so both read at a glance */
.pair{display:grid;grid-template-columns:1fr 1fr;gap:22px;margin:30px calc(50% - min(640px, 50vw - 24px)) 48px}
.explore{display:flex;justify-content:center;margin:0 0 70px}
.explore .v-live{display:inline-flex;align-items:center;gap:8px;font-size:15px;padding:11px 20px}
.explore .v-live .ic{width:15px;height:15px}
@media (max-width:700px){.pair{grid-template-columns:1fr}}

.outcome{margin:20px 0 10px}
.orow{padding:22px 0;border-top:1px solid #232b40}
.obar{position:relative;display:flex;align-items:center;gap:14px;height:34px}
.obar span{height:6px;border-radius:3px;width:0;transition:width 1.4s var(--ease)}
.obar.before span{background:#4a4f5b}.obar.after span{background:var(--blue);transition-delay:.4s}
.in .obar span{width:calc(var(--w) * .62)}
.obar em{font-style:normal;font-size:17px;white-space:nowrap}
.obar.before em{color:#8b909b;text-decoration:line-through;text-decoration-color:#555}
.obar.after em{color:var(--hi);font-weight:600;font-size:22px}

.overrides{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,7fr);gap:56px;align-items:start;margin:40px -90px 0}
@media (max-width:1060px){.overrides{margin-inline:0}}
@media (max-width:760px){.overrides{grid-template-columns:1fr;gap:28px}}
/* the quotes: quiet until pointed at; the open one is lit with a blue rule beside it */
.ovr-list{list-style:none;margin:0;padding:0}
.ovr-q{display:block;width:100%;text-align:left;padding:16px 0 16px 20px;border:0;border-left:2px solid #232733;background:none;cursor:pointer;transition:border-color .3s}
.ovr-q .said{display:block;font-size:17px;line-height:1.45;font-weight:500;color:#7d828f;transition:color .3s}
.ovr-q .iter-n{display:block;margin:6px 0 0}
.ovr-q:hover .said,.ovr-q.on .said{color:var(--hi)}
.ovr-q.on{border-left-color:var(--blue)}
.ovr-q:focus-visible{outline:2px solid var(--cy);outline-offset:4px}
.iter-n{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#5f636d}
.ovr-panel{display:grid}
.ovr-d{grid-area:1/1;opacity:0;visibility:hidden;transition:opacity .35s var(--ease),visibility 0s .35s}
.ovr-d.on{opacity:1;visibility:visible;transition:opacity .35s var(--ease)}
.ovr-d .ovr-dl{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-bottom:22px}
.ovr-d .ovr-dl div+div{margin-top:0}
@media (max-width:640px){.ovr-d .ovr-dl{grid-template-columns:1fr;gap:14px}}
.ovr-dl{margin:0}.ovr-dl div+div{margin-top:16px}
.ovr-dl dt{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#6b6f7a;margin-bottom:3px}
.ovr-dl .kept dt{color:var(--blue)}
.ovr-dl dd{margin:0;font-size:15px;line-height:1.55;color:#a9adb7}
.ovr-pair{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.ovr-pair figure{margin:0}
.ovr-pair img{width:100%;aspect-ratio:16/10;object-fit:cover;object-position:top;border-radius:10px;border:1px solid #2a2e38;filter:grayscale(.6) brightness(.6);transition:filter .6s var(--ease)}
.ovr-pair .kept img{filter:none;border-color:#3d5c8f}
/* a timeline strip (frames over time) runs full width, before above after, never cropped */
.ovr-pair.stack{grid-template-columns:1fr}.ovr-pair.stack img{aspect-ratio:auto;object-fit:fill;border:0;border-radius:0}
.ovr-d.on .ovr-pair img{filter:none}
.ovr-pair figcaption{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#6b6f7a;margin-top:8px}
.ovr-pair .kept figcaption{color:var(--blue)}
.process{margin:40px 0 20px}
.proc-grid{display:grid;grid-template-columns:1fr 1fr;gap:22px;margin:22px -90px 0}
@media (max-width:1060px){.proc-grid{margin-inline:0}}@media (max-width:760px){.proc-grid{grid-template-columns:1fr}}
/* the two cards share rows (subgrid), so the clip and the tally are one height and both captions start on one line */
.proc-grid{grid-template-rows:auto auto}
.proc{margin:0;display:grid;grid-row:span 2;grid-template-rows:subgrid;row-gap:18px}
.proc video,.tally{width:100%;aspect-ratio:16/10;border-radius:14px;border:1px solid #232733;background:#13151a;display:block}
.proc video{height:100%;aspect-ratio:auto;min-height:280px;object-fit:contain;object-position:center;background:#0f1013}
.proc figcaption h4{font-size:20px;font-weight:500;color:var(--hi);margin-bottom:6px}
.proc figcaption p{font-size:16px;line-height:1.6}
/* the tally: one hue, longest first, the count at the end of each bar */
.tally{aspect-ratio:auto;padding:22px 24px;display:flex;flex-direction:column;justify-content:center;gap:9px}
.tally-stat{font-size:15px;color:var(--hi);font-weight:500}
.tally .chart-title{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#7d828f;margin:2px 0 4px}
.trow2{display:grid;grid-template-columns:128px 1fr 28px;align-items:center;gap:12px;font-size:13px;color:#a9adb7;padding:2px 0;border-radius:4px}
.trow2 i{height:10px;width:0;border-radius:0 4px 4px 0;background:var(--blue);transition:width 1.1s var(--ease)}
.in .trow2 i,.trow2.in i{width:var(--w)}
.trow2 b{font-weight:500;color:var(--hi);text-align:right}
.trow2:hover{color:var(--hi)}.trow2:hover i{background:var(--blue-soft)}
.tally .fine{margin-top:6px;font-size:11px;color:#7d828f}
.lessons{margin-top:10px}
.lesson{padding:26px 0;border-top:1px solid #1d2028}
.lesson h4{font-size:20px;font-weight:500;color:var(--hi);margin-bottom:6px}

.foot{max-width:820px;margin:120px auto 0;padding:50px 24px 90px;border-top:1px solid #1d2028;display:flex;justify-content:space-between;align-items:end;gap:20px;flex-wrap:wrap}
.foot-next{text-decoration:none;font-size:30px;font-weight:600;color:var(--hi)}
.foot-next>span{display:block}
.foot-next .foot-name{display:flex;align-items:center;gap:16px}
.foot p{font-size:15px}

/* cursor badge — fine pointers only; touch keeps the platform behaviour */
.cursor{display:none}
@media (hover:hover) and (pointer:fine){
  .js body{cursor:none}.js a,.js button,.js .q{cursor:none}
  .cursor{display:block;position:fixed;left:0;top:0;z-index:60;pointer-events:none;width:42px;height:42px;margin:-21px 0 0 -21px;transition:width .35s var(--ease),height .35s var(--ease),margin .35s var(--ease),opacity .3s}
  .cursor svg{width:100%;height:100%;fill:none;stroke:var(--cy);stroke-width:4;transition:fill .3s,transform 4s linear}
  /* plain words under the ring, as first designed; white on a soft dark halo so they read on a bright screenshot and on the dark page alike */
  .cursor span{position:absolute;top:100%;left:50%;transform:translateX(-50%);margin-top:7px;font-size:11px;font-weight:600;line-height:1.2;letter-spacing:.08em;text-transform:uppercase;color:#fff;text-shadow:0 0 2px rgba(0,0,0,.95),0 1px 5px rgba(0,0,0,.85),0 0 14px rgba(0,0,0,.6);white-space:nowrap;opacity:0;transition:opacity .3s}
  .cursor.link svg{fill:rgba(95,192,216,.55)}
  .cursor.frame-on{width:64px;height:64px;margin:-32px 0 0 -32px}.cursor.frame-on span{opacity:1}.cursor.frame-on svg{transform:rotate(90deg)}
  .cursor.gone{opacity:0}
  dialog[open]{cursor:auto}dialog[open] *{cursor:auto!important}dialog[open] button,dialog[open] a{cursor:pointer!important}
}

/* viewer */
.viewer{position:fixed;inset:0;width:100vw;max-width:none;height:100dvh;max-height:none;margin:0;border:0;background:#090a0d;color:var(--body);padding:18px 24px 18px;display:none;grid-template-rows:auto minmax(0,1fr) auto auto auto;gap:12px}
.viewer[open]{display:grid;animation:vin .45s var(--ease)}
.viewer::backdrop{background:rgba(0,0,0,.6)}
@keyframes vin{from{opacity:0;transform:scale(.985)}}
.v-top{display:flex;align-items:center;gap:16px;flex-wrap:wrap}
.v-title{font-size:20px;font-weight:600;color:var(--hi);margin-right:auto}
/* a sliding switch: the white thumb glides between the two sides, follows a drag, and
   settles on whichever side it's let go nearer */
.v-tabs{position:relative;display:grid;grid-template-columns:1fr 1fr;padding:4px;border-radius:999px;background:#171a21;border:1px solid #262a33;--i:0;touch-action:none;user-select:none;cursor:pointer}
.v-thumb{position:absolute;top:4px;bottom:4px;left:4px;width:calc(50% - 4px);border-radius:999px;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.35);transform:translateX(calc(var(--i) * 100%));transition:transform .4s cubic-bezier(.3,.7,.2,1)}
.v-tabs.dragging .v-thumb{transition:none}
.viewer:focus{outline:none}
.v-tabs button{position:relative;z-index:1;padding:7px 18px;border-radius:999px;font-size:14px;color:#9aa0ad}
.v-tabs button[aria-selected=true]{color:#111;font-weight:500}
.v-tabs button:focus{outline:none}.v-tabs button:focus-visible{outline:2px solid var(--cy);outline-offset:2px}
.v-tabs button[hidden],.v-tabs[hidden]{display:none}
.v-live{font-size:14px;text-decoration:none;color:#111;background:var(--blue-soft);padding:9px 16px;border-radius:999px;font-weight:500}
.v-live[hidden]{display:none}
.v-close{font-size:14px;padding:9px 16px;border-radius:999px;border:1px solid #333845;color:#e6e8ec}
.v-close:hover{border-color:#5a6070}
/* the whole screen fits at once; click it to zoom to full width and scroll */
.v-stage{position:relative;min-height:0;border-radius:14px;background:#111318;border:1px solid #1f232b;overflow:hidden}
.v-stage>img,.v-stage>video{position:absolute;inset:10px;width:calc(100% - 20px);height:calc(100% - 20px);object-fit:contain}
/* iterations sit on the stage's top edge, so stepping through screens of different heights keeps them level */
.v-stage>img{cursor:zoom-in!important;object-position:top}
.v-stage.zoom{overflow:auto;overscroll-behavior:contain}
.v-stage.zoom>img{position:static;display:block;width:100%;height:auto;cursor:zoom-out!important}
/* before/after slider: the after screen is wiped over the before one by a native range input */
.v-cmp{position:absolute;inset:10px;--x:50%}
.v-cmp img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;object-position:top}
.v-cmp .cb{clip-path:inset(0 0 0 var(--x))}
.v-cmp::after{content:'';position:absolute;top:0;bottom:0;left:var(--x);width:2px;margin-left:-1px;background:var(--cy);box-shadow:0 0 12px rgba(95,192,216,.6);pointer-events:none}
.cmp-knob{position:absolute;z-index:2;top:50%;left:var(--x);width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;background:var(--cy);color:#0b1a20;display:grid;place-items:center;pointer-events:none}
.cmp-knob .ic{width:22px;height:22px}
.v-cmp input{position:absolute;inset:0;width:100%;height:100%;opacity:0;margin:0;cursor:ew-resize!important}
.v-cmp .cl{position:absolute;top:12px;z-index:2;padding:5px 12px;border-radius:999px;background:rgba(9,10,13,.8);color:var(--hi);font-size:13px;pointer-events:none}
.v-cmp .la{left:12px}.v-cmp .lb{right:12px}
.v-side{position:absolute;inset:10px;display:grid;grid-template-columns:1fr 1fr;gap:18px}
.v-side figure{display:grid;grid-template-rows:minmax(0,1fr) auto;gap:10px;min-height:0}
.v-side img{width:100%;height:100%;object-fit:contain;min-height:0}
.v-side figcaption{font-size:15px;color:#c5c9d1}
.v-side figcaption b{display:block;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#7d828f;margin-bottom:2px}
.v-side .kept figcaption b{color:var(--blue)}
@media (max-width:700px){.v-side{grid-template-columns:1fr}}
.ovr-pair{cursor:pointer}
/* in the override compare, her words lead: the quote sits above the two screens */
.viewer.side-mode{grid-template-rows:auto auto minmax(0,1fr) auto auto}
.viewer.side-mode .v-cap{order:-1}.viewer.side-mode .v-top{order:-2}
.viewer.side-mode .v-ask{font-size:30px;line-height:1.15}
/* the viewer is a carousel: drag or swipe the screen, use the side arrows, or the arrow keys */
.v-stage>img,.v-stage>video{touch-action:pan-y;user-select:none;-webkit-user-drag:none}
.v-stage.dragging>img,.v-stage.dragging>video{transition:none}
.v-stage>img.in-next,.v-stage>video.in-next{animation:in-next .45s var(--ease)}
.v-stage>img.in-prev,.v-stage>video.in-prev{animation:in-prev .45s var(--ease)}
@keyframes in-next{from{transform:translateX(70px);opacity:.2}}
@keyframes in-prev{from{transform:translateX(-70px);opacity:.2}}
.v-nav{position:absolute;top:50%;z-index:4;margin-top:-24px}
.v-nav.prev{left:14px}.v-nav.next{right:14px}
.v-nav[hidden],.v-stage.zoom .v-nav{display:none}
.v-strip{cursor:grab}.v-strip.dragging{cursor:grabbing;scroll-behavior:auto}
.v-strip img{-webkit-user-drag:none;user-select:none}
.v-groups{display:flex;gap:8px;flex-wrap:wrap}
.v-groups:empty{display:none}
.v-groups button{padding:6px 14px;border-radius:999px;border:1px solid #2c3242;font-size:13px;color:#9aa0ad}
.v-groups button[aria-selected=true]{background:var(--blue-soft);border-color:var(--blue-soft);color:#10141f;font-weight:500}
.v-groups button em{font-style:normal;opacity:.6;margin-left:6px}
.v-stage [hidden]{display:none}
.v-cap{min-height:24px;max-width:900px}
.v-why{font-size:16px;color:#c5c9d1}
.v-ask{font-family:'Madhu Hand','Shadows Into Light',cursive;font-size:21px;color:var(--pink);margin-top:4px}
.v-ask:empty{display:none}
.v-strip{display:flex;align-items:flex-start;gap:10px;overflow-x:auto;padding-bottom:4px;scrollbar-width:thin}
.v-strip button{flex:0 0 auto;width:150px;text-align:left;opacity:.5;transition:opacity .3s}
.v-strip button:hover,.v-strip button[aria-current=true]{opacity:1}
.v-strip img{width:150px;aspect-ratio:16/10;object-fit:cover;object-position:top;border-radius:8px;border:1.5px solid transparent}
.v-strip button[aria-current=true] img{border-color:var(--cy)}
/* every thumbnail label holds two lines, so a long one never makes the strip taller */
.v-strip span{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;height:2.6em;font-size:11px;line-height:1.3;color:#9aa0ad;margin-top:5px}

@media (max-width:700px){
  body{font-size:16px}.pill{padding-left:10px}.pill a{padding:7px 10px;font-size:14px}.pill a.nav-opt,.pill a.nav-res{display:none}
  .edge{display:none}.sec{padding-top:90px}.lede p{font-size:19px}
  :root{--lab:118px}.hl{font-size:13px}.float{display:none}
  .quotes{grid-template-columns:1fr}.q{min-height:200px}
  .ia{grid-template-columns:1fr;gap:10px}.ia-arrow{transform:rotate(90deg)}
  .note{font-size:15px;max-width:120px}
}
/* localhost-only text editing */
.edit-bar{position:fixed;right:20px;bottom:20px;z-index:45;display:flex;gap:10px;align-items:center}
.edit-bar button{padding:10px 16px;border-radius:999px;background:#fff;color:#111;font-size:14px;font-weight:500;box-shadow:0 10px 30px rgba(0,0,0,.4)}
.editing .edit-bar button{background:var(--pink);color:#fff}
.edit-toast{font-size:13px;color:#cfd3da;background:#1b1f29;border:1px solid #2c3242;border-radius:999px;padding:8px 14px;opacity:0;transition:opacity .3s}
.edit-toast.show{opacity:1}
.editing,.editing *{cursor:auto!important}.editing .cursor{display:none}
.editing [data-edit]{outline:1px dashed rgba(236,111,160,.55);outline-offset:3px;border-radius:3px;cursor:text!important}
.editing [data-edit]:focus{outline:2px solid var(--pink);background:rgba(236,111,160,.07)}
.editing .rv{animation:none!important;opacity:1!important}
.editing .fu{opacity:1!important;transform:none!important}
.editing .frame img{filter:none!important}
.editing .note{pointer-events:auto;opacity:1!important;cursor:move!important}
.note-pin{display:none;position:absolute;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;background:var(--pink);border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4);z-index:3;cursor:move}
.editing .note-pin{display:block}
.editing .q-in{transform:none!important}.editing .q-back{display:none}
.swap{position:absolute;top:10px;right:10px;z-index:5;padding:7px 12px;border-radius:999px;background:var(--pink);color:#fff;font-size:13px;font-weight:500;box-shadow:0 6px 20px rgba(0,0,0,.4)}
[data-src-path]{position:relative}
.picker{position:fixed;inset:24px;margin:auto;width:auto;max-width:1200px;height:auto;max-height:none;border:1px solid #2c3242;border-radius:16px;background:#0e1015;color:var(--body);padding:0;display:none;flex-direction:column}
.picker[open]{display:flex}.picker::backdrop{background:rgba(0,0,0,.7)}
.picker header{display:flex;align-items:center;gap:12px;padding:16px 20px;border-bottom:1px solid #1f232b}
.picker header p{margin-right:auto;color:var(--hi);font-weight:600}
.picker header button{padding:8px 14px;border-radius:999px;border:1px solid #333845;color:#e6e8ec;font-size:14px}
.picker .pk-body{overflow:auto;padding:8px 20px 24px}
.picker h5{font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--blue);margin:22px 0 10px}
.picker .pk-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px}
.picker .pk-grid button{text-align:left}
.picker .pk-grid img{width:100%;aspect-ratio:16/10;object-fit:cover;object-position:top;border-radius:8px;border:2px solid transparent;background:#fff}
.picker .pk-grid button:hover img{border-color:var(--pink)}
.picker .pk-grid button.cur img{border-color:var(--cy)}
.picker .pk-grid span{display:block;font-size:11px;color:#8d929e;margin-top:4px;word-break:break-all}
/* the design system button: the page's own blue pill, outlined, beside the filled Explore ones */
.btn-o{display:inline-flex;align-items:center;gap:8px;font-size:14px;font-weight:500;text-decoration:none;color:var(--blue-soft);border:1px solid rgba(169,196,245,.55);padding:9px 18px;border-radius:999px;transition:background-color .2s,color .2s}
.btn-o:hover{background:var(--blue-soft);color:#111}
.btn-o .ic{width:14px;height:14px}
.ds-row{margin-top:26px;display:flex;justify-content:center}

@media (prefers-reduced-motion:reduce){
  *,*::before,*::after{animation:none!important;transition:none!important}
  .q-in{transition:none}
  html{scroll-behavior:auto}
  .js .fu{opacity:1;transform:none}
}
`;

/* client JS — plain, no dependencies */
const JS = `(() => {
if (!/^#view-/.test(location.hash)) scrollTo(0, 0);
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* fade-ups + chart draws: once, as each block enters */
/* a callout's line starts just outside its label's box, so it never crosses the letters.
   Measured in the page, since the label's size depends on its words and the font */
function fitNotes(root = document) {
  $$('.shot', root).forEach(shot => {
    const sr = shot.getBoundingClientRect(); if (!sr.width) return;
    $$('.note', shot).forEach(lab => {
      const i = lab.dataset.i, path = $('path[data-i="' + i + '"]', shot); if (!path) return;
      const x = +lab.dataset.x, y = +lab.dataset.y, lr = lab.getBoundingClientRect(), pad = 6;
      const cx = lr.left + lr.width / 2 - sr.left, cy = lr.top + lr.height / 2 - sr.top;
      const px = x / 100 * sr.width, py = y / 100 * sr.height, dx = px - cx, dy = py - cy;
      const t = Math.min(dx ? (lr.width / 2 + pad) / Math.abs(dx) : Infinity, dy ? (lr.height / 2 + pad) / Math.abs(dy) : Infinity);
      if (!(t < 1)) { path.setAttribute('d', ''); return; }   // the pin sits under the label: no line
      const sx = (cx + dx * t) / sr.width * 100, sy = (cy + dy * t) / sr.height * 100;
      path.setAttribute('d', 'M' + sx.toFixed(2) + ' ' + sy.toFixed(2) + ' Q' + ((x + sx) / 2 + (y > sy ? 6 : -6)).toFixed(2) + ' ' + ((y + sy) / 2).toFixed(2) + ' ' + x + ' ' + y);
    });
  });
}
window.__fitNotes = fitNotes;
fitNotes(); addEventListener('load', () => fitNotes()); document.fonts && document.fonts.ready.then(() => fitNotes());
addEventListener('resize', () => fitNotes());
$$('.frame img').forEach(img => img.addEventListener('load', () => fitNotes(img.closest('.frame'))));

/* the AI section: the quote you point at (or tap, or tab to) opens its detail */
$$('[data-ovr]').forEach(box => { const qs = $$('.ovr-q', box), ds = $$('.ovr-d', box);
  const open = i => { qs.forEach((q, j) => { q.classList.toggle('on', j === i); q.setAttribute('aria-pressed', j === i); }); ds.forEach((d, j) => d.classList.toggle('on', j === i)); };
  qs.forEach((q, i) => { q.addEventListener('mouseenter', () => open(i)); q.addEventListener('focus', () => open(i)); q.addEventListener('click', () => open(i)); });
});

const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -12% 0px' });
$$('.fu, [data-draw], .hmw').forEach(el => io.observe(el));

/* TOC + background tone + blur: a section takes over once its title reaches the middle of
   the screen, and every section above it blurs out. Measured on scroll (not an
   IntersectionObserver band), so jumps and resizes can't leave it stale. */
const secs = $$('.sec'), links = Object.fromEntries($$('.toc a').map(a => [a.dataset.for, a]));
const heads = secs.map(x => x.querySelector(':scope > .eyebrow, :scope > .h2') || x);
let lastSec = null, raf = 0;
function where() {
  raf = 0; const y = innerHeight / 2;
  let i = heads.findLastIndex(h => h.getBoundingClientRect().top <= y); if (i < 0) i = 0;
  const s = secs[i];
  if (s === lastSec) return; lastSec = s;
  secs.forEach((x, j) => x.classList.toggle('past', j < i));
  document.body.dataset.tone = s.dataset.tone || 'ink';
  document.body.classList.toggle('past-hero', s.id !== 'top');
  Object.entries(links).forEach(([id, a]) => a.classList.toggle('on', id === s.id));
}
addEventListener('scroll', () => { raf = raf || requestAnimationFrame(where); }, { passive: true });
/* the top bar: away while reading down; back after a deliberate scroll up (40px, so a tremor
   on the trackpad doesn't flick it), or whenever the pointer goes up to the top edge */
let navY = scrollY, navUp = 0, navHover = false;
addEventListener('scroll', () => {
  const y = scrollY, d = y - navY; navY = y;
  if (d > 0) { navUp = 0; if (y > 140 && !navHover) document.body.classList.add('nav-away'); }
  else { navUp -= d; if (navUp > 40 || y < 140) document.body.classList.remove('nav-away'); }
}, { passive: true });
addEventListener('mousemove', e => {
  const near = e.clientY < 90; if (near === navHover) return; navHover = near;
  if (near) document.body.classList.remove('nav-away');
}, { passive: true });
addEventListener('resize', () => { lastSec = null; where(); });
where();

/* hero parallax: the floating cards drift up faster than the laptop */
const stage = $('.stage');
if (stage && !reduce) {
  let tick = false;
  addEventListener('scroll', () => { if (tick) return; tick = true; requestAnimationFrame(() => {
    stage.style.setProperty('--p', Math.min(1, scrollY / innerHeight).toFixed(3)); tick = false; }); }, { passive: true });
}

/* voice-of-client cards: the hovered card turns to its theme; the last one stays turned */
$$('[data-quotes]').forEach(g => $$('.q', g).forEach(q => {
  const on = () => { if (document.body.classList.contains('editing')) return; $$('.q', g).forEach(x => x.classList.toggle('on', x === q)); };
  const off = () => q.classList.remove('on');
  q.addEventListener('mouseenter', on); q.addEventListener('focus', on);
  q.addEventListener('mouseleave', off); q.addEventListener('blur', off);
}));

/* gifs play only while their frame is revealed */
$$('img[data-gif]').forEach(img => {
  const f = img.closest('.frame'), still = img.src, gif = img.dataset.gif;
  if (matchMedia('(hover: none)').matches) { img.src = gif; return; }
  f.addEventListener('mouseenter', () => { img.src = gif; });
  f.addEventListener('mouseleave', () => { img.src = still; });
});

/* cursor badge */
const cur = $('.cursor');
if (cur && matchMedia('(hover: hover) and (pointer: fine)').matches && !reduce) {
  let x = innerWidth / 2, y = innerHeight / 2, cx = x, cy = y;
  addEventListener('pointermove', e => { x = e.clientX; y = e.clientY; cur.classList.remove('gone');
    const t = e.target.closest && e.target.closest('[data-view], a, button, .q');
    const scr = !!(t && t.dataset.view !== undefined);
    cur.classList.toggle('frame-on', scr); cur.classList.toggle('link', !!t && !scr);
  });
  document.addEventListener('pointerleave', () => cur.classList.add('gone'));
  (function loop() { cx += (x - cx) * .2; cy += (y - cy) * .2; cur.style.transform = 'translate(' + cx + 'px,' + cy + 'px)'; requestAnimationFrame(loop); })();
} else if (cur) cur.remove();

/* viewer: clip / iterations / live; Back (button, Esc or browser) returns to the same spot */
const V = window.__VIEWS || {}, dlg = $('.viewer'), vid = $('video', dlg), still = $('.v-stage img', dlg);
const tabBox = $('.v-tabs', dlg), tabs = $$('.v-tabs button', dlg), strip = $('.v-strip', dlg), live = $('.v-live', dlg);
let cur_ = null, idx = 0, ci = 0, grp = '', mode = 'iter', pushed = false;
/* the strip under the stage lists clips on the Interaction tab and versions on Iterations */
function fillStrip(items, label, onPick) {
  strip.innerHTML = items.map((s, i) => '<button type="button" role="listitem"><img src="' + s.src + '" alt="" loading="lazy"><span>' +
    label(s, i).replace(/</g, '&lt;') + '</span></button>').join('');
  $$('button', strip).forEach((b, i) => b.addEventListener('click', () => onPick(i)));
  strip.hidden = items.length < 2;
}
function mark(i) {
  $$('button', strip).forEach((b, j) => b.setAttribute('aria-current', j === i));
  const b = $$('button', strip)[i]; if (b) b.scrollIntoView({ block: 'nearest', inline: 'center' });
}
function playClip(i) {
  const c = cur_.clips[i]; ci = i; setTimeout(navState);
  if (vid.dataset.src !== c.src) { vid.src = vid.dataset.src = c.src; vid.poster = c.poster; }
  vid.play().catch(() => {}); cap([[c.desc, c.name && 'clip:' + c.name + '.description']]); mark(i);
}
function show(tab) {
  tabs.forEach(t => t.setAttribute('aria-selected', t.dataset.tab === tab));
  tabBox.style.setProperty('--i', tab === 'clip' ? 0 : 1);
  const isClip = tab === 'clip' && cur_.clips.length > 0;
  vid.hidden = !isClip; still.hidden = isClip; mode = isClip ? 'clip' : 'iter'; vMouse.hidden = true;
  if (isClip) { fillStrip(cur_.clips.map(c => ({ src: c.poster })), (s, i) => cur_.clips[i].title, playClip); playClip(ci); }
  else { vid.pause(); groupChips(); showGroup(grp); }
  if (!isClip) return; $('.v-groups', dlg).innerHTML = '';
}
/* iterations are grouped by screen type (sign in, product question…), each group oldest
   first, so a change reads against the same screen instead of the whole flow's timeline */
function groups() { const g = []; cur_.strip.forEach(s => { const k = s.screen || ''; if (!g.includes(k)) g.push(k); }); return g; }
function groupChips() {
  const g = groups(), box = $('.v-groups', dlg);
  box.innerHTML = g.length > 1 ? g.map(k => '<button type="button" role="tab" data-g="' + k + '">' + k +
    '<em>' + cur_.strip.filter(s => s.screen === k).length + '</em></button>').join('') : '';
  $$('button', box).forEach(b => b.addEventListener('click', () => showGroup(b.dataset.g)));
}
function showGroup(k) {
  const g = groups(); grp = g.includes(k) ? k : g[0];
  $$('.v-groups button', dlg).forEach(b => b.setAttribute('aria-selected', b.dataset.g === grp));
  const ids = cur_.strip.map((s, i) => i).filter(i => (cur_.strip[i].screen || '') === grp);
  fillStrip(ids.map(i => cur_.strip[i]), (s, j) => s.title ? (j + 1) + ' of ' + ids.length + ' · ' + s.title : '', j => pick(ids[j]));
  pick(ids.includes(idx) ? idx : ids[0] ?? 0);
}
const vMouse = $('.v-mouse', dlg); vMouse.innerHTML = window.__MOUSE || '';
const CUR = window.__CURSORS || {};
function placeMouse() {
  const key = Object.keys(CUR).find(k => (still.getAttribute('src') || '').split('?')[0].endsWith(k));
  if (still.hidden || !key || !still.naturalWidth) { vMouse.hidden = true; return; }
  const [x, y] = CUR[key], ew = still.clientWidth, eh = still.clientHeight;
  const sc = Math.min(ew / still.naturalWidth, eh / still.naturalHeight), cw = still.naturalWidth * sc, ch = still.naturalHeight * sc;
  vMouse.style.left = still.offsetLeft + (ew - cw) / 2 + cw * x / 100 + 'px';
  vMouse.style.top = still.offsetTop + (eh - ch) / 2 + ch * y / 100 + 'px';
  vMouse.style.width = Math.max(10, cw * 0.015) + 'px'; // sized to the screen, as on the page
  vMouse.hidden = false;
}
still.addEventListener('load', placeMouse);
addEventListener('resize', () => dlg.open && placeMouse());
/* the caption under the screen. Each part carries the path of the string it shows (in the
   iterations or clips file), so on localhost Edit text rewords it in place like the page */
function cap(parts, ask = []) {
  const span = ([t, key]) => '<span' + (key ? ' data-edit="' + key + '"' : '') + '>' + String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</span>';
  $('.v-why', dlg).innerHTML = parts.filter(p => p[0]).map(span).join(' · ');
  $('.v-ask', dlg).innerHTML = ask[0] ? '“' + span(ask) + '”' : '';
  if (document.body.classList.contains('editing'))
    $$('.v-cap [data-edit]', dlg).forEach(el => { el.contentEditable = 'true'; el.spellcheck = true; el.dataset.orig = el.textContent; });
}
/* the caption box takes the height of the view's longest caption, so the screen above it
   keeps one size and position while stepping through iterations */
function fitCap() {
  const box = $('.v-cap', dlg); box.style.minHeight = ''; let h = 0;
  const all = [...cur_.clips.map(c => [[[c.desc]], []]), ...cur_.strip.map(it => [it.title ? [[it.title], [it.why]] : [], [it.ask]])];
  all.forEach(([parts, ask]) => { cap(parts, ask); h = Math.max(h, box.offsetHeight); });
  box.style.minHeight = h + 'px';
}
function pick(i) {
  const it = cur_.strip[i] || { src: cur_.fallback, title: '', why: '' }; idx = i;
  still.src = it.src; still.alt = it.title || cur_.title; requestAnimationFrame(placeMouse);
  const k = it.key ? f => it.key + '.' + f : () => '';
  cap(it.title ? [[it.title, k('title')], [it.why, k('why')]] : [], [it.ask, k('ask')]);
  const st = $('.v-stage', dlg); st.classList.remove('zoom'); st.scrollTop = 0; setTimeout(navState);
  const ids = cur_.strip.map((s, j) => j).filter(j => (cur_.strip[j].screen || '') === (cur_.strip[i] || {}).screen);
  mark(Math.max(0, ids.indexOf(i)));
}
const cmpEl = $('.v-cmp', dlg), sideEl = $('.v-side', dlg);
$('input', cmpEl).addEventListener('input', e => cmpEl.style.setProperty('--x', e.target.value + '%'));
function special(v) {
  const mode_ = v.compare ? 'cmp' : v.side ? 'side' : '';
  cmpEl.hidden = mode_ !== 'cmp'; sideEl.hidden = mode_ !== 'side'; dlg.classList.toggle('side-mode', mode_ === 'side');
  if (!mode_) return false;
  vid.pause(); vid.hidden = true; still.hidden = true; vMouse.hidden = true; strip.hidden = true; $('.v-groups', dlg).innerHTML = '';
  $('.v-tabs', dlg).hidden = true; live.hidden = true; $('.v-cap', dlg).style.minHeight = ''; cap([]);
  if (v.compare) {
    const [ia, ib] = $$('img', cmpEl); ia.src = v.compare.a.src; ib.src = v.compare.b.src;
    $('.la', cmpEl).textContent = v.compare.a.label; $('.lb', cmpEl).textContent = v.compare.b.label;
    $('input', cmpEl).value = 50; cmpEl.style.setProperty('--x', '50%');
    cap([['Drag across the screen to wipe between them.']]);
  } else {
    $$('figure', sideEl).forEach((f, i) => { const d = i ? v.side.b : v.side.a; $('img', f).src = d.src;
      $('figcaption', f).innerHTML = '<b></b>'; $('b', f).textContent = d.label; $('figcaption', f).append(d.text); });
    cap([], [v.side.quote]);
  }
  navP.hidden = navN.hidden = true;
  return true;
}
function open(id, fallback, push = true) {
  const v = V[id]; if (!v) return;
  if (special(v)) { cur_ = null; $('.v-title', dlg).textContent = v.title; if (!dlg.open) { dlg.showModal(); dlg.focus(); }
    if (push) { history.pushState({ view: id }, '', '#view-' + id); pushed = true; } return; }
  cur_ = Object.assign({ fallback }, v); idx = 0; ci = 0; grp = '';
  /* opened from a screen that is one of the iterations: start on it, in its own group */
  const path_ = u => decodeURI(String(u || '').split('?')[0]).replace(/^.*?(?=assets[/])/, '');
  const at = fallback ? v.strip.findIndex(s => path_(s.src) === path_(fallback)) : -1;
  if (at >= 0) { idx = at; grp = v.strip[at].screen || ''; }
  $('.v-title', dlg).textContent = v.title;
  const hasClip = v.clips.length > 0;
  tabs[0].hidden = !hasClip; tabs[1].hidden = !v.strip.length; $('.v-tabs', dlg).hidden = !(hasClip && v.strip.length);
  live.hidden = !v.live; if (v.live) live.href = v.live;
  if (!dlg.open) { dlg.showModal(); dlg.focus(); }
  fitCap(); show(hasClip && at < 0 ? 'clip' : 'iter');
  if (push) { history.pushState({ view: id }, '', '#view-' + id); pushed = true; }
}
function close() { vid.pause(); if (dlg.open) dlg.close(); }
const editing = () => document.body.classList.contains('editing');
$$('[data-view]').forEach(f => {
  const go = () => { if (editing()) return; const img = $('img', f); open(f.dataset.view, img && (img.dataset.gif || img.src)); };
  f.addEventListener('click', go);
  f.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target === f) { e.preventDefault(); go(); } });
});
tabs.forEach(t => t.addEventListener('click', () => { if (!tabMoved) show(t.dataset.tab); }));
/* drag the switch: the thumb tracks the pointer, release picks the nearer side */
let tabX = null, tabFrom = 0, tabMoved = false;
tabBox.addEventListener('pointerdown', e => { e.preventDefault(); tabX = e.clientX; tabFrom = mode === 'clip' ? 0 : 1; tabMoved = false; });
addEventListener('pointermove', e => {
  if (tabX === null) return; const w = tabBox.clientWidth / 2, d = e.clientX - tabX;
  if (Math.abs(d) > 4) { tabMoved = true; tabBox.classList.add('dragging'); tabBox.style.setProperty('--i', Math.min(1, Math.max(0, tabFrom + d / w))); }
});
addEventListener('pointerup', () => {
  if (tabX === null) return; tabX = null; tabBox.classList.remove('dragging');
  if (tabMoved) { show(parseFloat(tabBox.style.getPropertyValue('--i')) >= .5 ? 'iter' : 'clip'); setTimeout(() => { tabMoved = false; }); }
});
still.draggable = false;
still.addEventListener('click', () => { if (swiped) { swiped = false; return; } $('.v-stage', dlg).classList.toggle('zoom'); placeMouse(); });

/* ---- carousel: one step through whatever the strip holds. Iterations run on into the next
   screen-type group at either end, so you can swipe the whole history without clicking. */
const stageEl = $('.v-stage', dlg), navP = $('.v-nav.prev', dlg), navN = $('.v-nav.next', dlg);
let swiped = false;
function items() {
  if (!cur_) return { n: 0 };
  if (mode === 'clip') return { n: cur_.clips.length, at: ci };
  const ids = cur_.strip.map((s, j) => j).filter(j => (cur_.strip[j].screen || '') === grp);
  return { n: cur_.strip.length, ids, at: ids.indexOf(idx) };
}
function navState() {
  const it = items(), g = cur_ && mode !== 'clip' ? groups() : [];
  const many = it.n > 1;
  navP.hidden = navN.hidden = !many || cmpEl.hidden === false || sideEl.hidden === false;
  if (!many || mode === 'clip') return;
  const gi = g.indexOf(grp);
  navP.disabled = it.at <= 0 && gi <= 0; navN.disabled = it.at >= it.ids.length - 1 && gi >= g.length - 1;
  navP.style.opacity = navP.disabled ? .3 : 1; navN.style.opacity = navN.disabled ? .3 : 1;
}
function step(d) {
  const it = items(); if (it.n < 2) return;
  const el = mode === 'clip' ? vid : still;
  if (mode === 'clip') playClip((ci + d + it.n) % it.n);
  else {
    let nx = it.at + d;
    if (nx < 0 || nx >= it.ids.length) {
      const g = groups(), gi = g.indexOf(grp) + d; if (gi < 0 || gi >= g.length) return;
      showGroup(g[gi]);
      const ids = cur_.strip.map((s, j) => j).filter(j => (cur_.strip[j].screen || '') === grp);
      pick(d > 0 ? ids[0] : ids[ids.length - 1]);
    } else pick(it.ids[nx]);
  }
  el.classList.remove('in-next', 'in-prev'); void el.offsetWidth; el.classList.add(d > 0 ? 'in-next' : 'in-prev');
  navState();
}
navP.addEventListener('click', () => step(-1));
navN.addEventListener('click', () => step(1));
/* drag the screen itself: it follows the pointer, and a throw past 60px moves one step */
let sx = null, dx = 0;
stageEl.addEventListener('pointerdown', e => {
  if (stageEl.classList.contains('zoom') || e.target.closest('button, .v-cmp, .v-side') || e.button) return;
  if (e.target === vid && e.clientY > stageEl.getBoundingClientRect().bottom - 64) return; // the video's own controls
  sx = e.clientX; dx = 0;
});
addEventListener('pointermove', e => {
  if (sx === null) return; dx = e.clientX - sx;
  if (Math.abs(dx) > 8) { stageEl.classList.add('dragging'); (mode === 'clip' ? vid : still).style.transform = 'translateX(' + dx + 'px)'; }
});
addEventListener('pointerup', () => {
  if (sx === null) return;
  const el = mode === 'clip' ? vid : still; el.style.transform = ''; stageEl.classList.remove('dragging');
  if (Math.abs(dx) > 8) swiped = true;
  if (Math.abs(dx) > 60) step(dx < 0 ? 1 : -1);
  sx = null; setTimeout(() => { swiped = false; }, 0);
});
/* the thumbnail strip scrolls by dragging and by an ordinary vertical wheel */
let tx = null, tl = 0, tmoved = false;
strip.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') return; tx = e.clientX; tl = strip.scrollLeft; tmoved = false; });
addEventListener('pointermove', e => { if (tx === null) return; const d = e.clientX - tx; if (Math.abs(d) > 5) { tmoved = true; strip.classList.add('dragging'); strip.scrollLeft = tl - d; } });
addEventListener('pointerup', () => { tx = null; strip.classList.remove('dragging'); });
strip.addEventListener('click', e => { if (tmoved) { e.stopPropagation(); e.preventDefault(); tmoved = false; } }, true);
strip.addEventListener('wheel', e => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { strip.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false });
$('.v-close', dlg).addEventListener('click', () => pushed ? history.back() : close());
dlg.addEventListener('cancel', e => { e.preventDefault(); pushed ? history.back() : close(); });
dlg.addEventListener('close', () => vid.pause());
addEventListener('popstate', e => { if (e.state && e.state.view) open(e.state.view, null, false); else { pushed = false; close(); } });
dlg.addEventListener('keydown', e => {
  if (e.target.isContentEditable) return; // arrows move the caret while a caption is being edited
  if (e.key === 'ArrowRight') step(1);
  if (e.key === 'ArrowLeft') step(-1);
});
/* localhost only: click any text to rewrite it. On blur the new wording goes to the dev
   server, which writes it into the case-study JSON — the page rebuilds on the next refresh.
   **bold** survives as <b> (Cmd+B works while editing), __underline__ as <u>. */
if (/^(localhost|127\\.0\\.0\\.1)$/.test(location.hostname)) {
  const bar = document.createElement('div'); bar.className = 'edit-bar';
  const IC = (n) => '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="' + window.__IC[n] + '"/></svg>';
  bar.innerHTML = '<span class="edit-toast" role="status"></span><button type="button">' + IC('edit') + '<span>Edit text</span></button>';
  document.body.append(bar);
  const btn = $('button', bar), toast = $('.edit-toast', bar);
  let tt; const say = m => { toast.textContent = m; toast.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => toast.classList.remove('show'), 2600); };
  const toMd = el => [...el.childNodes].map(n => n.nodeType === 3 ? n.textContent
    : /^(B|STRONG)$/.test(n.nodeName) ? '**' + toMd(n) + '**' : n.nodeName === 'U' ? '__' + toMd(n) + '__'
    : n.nodeName === 'BR' ? ' ' : toMd(n)).join('');
  const clean = s => s.replace(/\\s+/g, ' ').replace(/\\*\\*\\s*\\*\\*/g, '').trim();
  btn.addEventListener('click', () => {
    const on = document.body.classList.toggle('editing');
    btn.innerHTML = on ? IC('check') + '<span>Done editing</span>' : IC('edit') + '<span>Edit text</span>';
    $$('[data-edit]').forEach(el => {
      if (on) { el.contentEditable = 'true'; el.spellcheck = true; el.dataset.orig = clean(toMd(el)); }
      else el.removeAttribute('contenteditable');
    });
    if (on) say('Click any outlined text to rewrite it');
  });
  document.addEventListener('keydown', e => { if (editing() && e.key === 'Enter' && e.target.dataset && e.target.dataset.edit !== undefined) { e.preventDefault(); e.target.blur(); } });
  document.addEventListener('focusout', async e => {
    const el = e.target; if (!editing() || !el.dataset || el.dataset.edit === undefined) return;
    const value = clean(toMd(el)); if (value === el.dataset.orig) return;
    try {
      const r = await fetch('/__edit', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: document.body.dataset.slug, path: el.dataset.edit, value }) });
      if (!r.ok) throw new Error(await r.text());
      el.dataset.orig = value; say('Saved');
    } catch (err) { say('Not saved: ' + err.message); }
  });
  /* the viewer is a modal dialog in the top layer, so the bar rides inside it while it's open */
  new MutationObserver(() => (dlg.open ? dlg : document.body).append(bar)).observe(dlg, { attributes: true, attributeFilter: ['open'] });

  /* callouts: while editing, drag a pin to move where the line points, or drag a label to
     move the words (a click without a drag still edits the text). Saved as numbers. */
  let drag = null;
  document.addEventListener('pointerdown', e => {
    if (!editing()) return;
    const pin = e.target.closest('.note-pin'), label = !pin && e.target.closest('.note');
    if (!pin && !label) return;
    const shot = (pin || label).closest('.shot'), i = (pin || label).dataset.i, lab = $('.note[data-i="' + i + '"]', shot);
    drag = { pin: !!pin, shot, lab, pinEl: $('.note-pin[data-i="' + i + '"]', shot), path: $('path[data-i="' + i + '"]', shot), dot: $('circle[data-i="' + i + '"]', shot),
      x0: e.clientX, y0: e.clientY, moved: false, n: { x: +lab.dataset.x, y: +lab.dataset.y, dx: +lab.dataset.dx, dy: +lab.dataset.dy } };
    drag.orig = Object.assign({}, drag.n);
    if (pin) e.preventDefault();
    e.stopPropagation();
  }, true);
  addEventListener('pointermove', e => {
    if (!drag) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 4) return;
    if (!drag.moved) { drag.moved = true; getSelection().removeAllRanges(); drag.lab.blur(); }
    const r = drag.lab.offsetParent.getBoundingClientRect(), n = drag.n; // the box the callouts are positioned in
    const px = Math.round((e.clientX - r.left) / r.width * 1000) / 10, py = Math.round((e.clientY - r.top) / r.height * 1000) / 10;
    if (drag.pin) { n.dx = Math.round((n.x + n.dx - px) * 10) / 10; n.dy = Math.round((n.y + n.dy - py) * 10) / 10; n.x = px; n.y = py; }
    else { n.dx = Math.round((px - n.x) * 10) / 10; n.dy = Math.round((py - n.y) * 10) / 10; }
    drag.lab.style.left = n.x + n.dx + '%'; drag.lab.style.top = n.y + n.dy + '%';
    drag.pinEl.style.left = n.x + '%'; drag.pinEl.style.top = n.y + '%';
    drag.lab.dataset.x = n.x; drag.lab.dataset.y = n.y; drag.dot.setAttribute('cx', n.x); drag.dot.setAttribute('cy', n.y); fitNotes(drag.shot.parentElement);
  });
  addEventListener('pointerup', async () => {
    if (!drag) return; const d = drag; drag = null;
    if (!d.moved) return;
    const base = d.lab.dataset.note;
    try {
      for (const k of ['x', 'y', 'dx', 'dy']) {
        if (d.orig[k] === d.n[k]) continue;
        const r = await fetch('/__edit', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug: document.body.dataset.slug, path: base + '.' + k, value: d.n[k] }) });
        if (!r.ok) throw new Error(await r.text());
        d.lab.dataset[k] = d.n[k];
      }
      say('Callout moved');
    } catch (err) { say('Not saved: ' + err.message); }
  });
  /* a pin or a dragged label never opens the viewer underneath */
  document.addEventListener('click', e => { if (editing() && e.target.closest('.note-pin, .note')) { e.stopPropagation(); e.preventDefault(); } }, true);

  /* image picker: in edit mode every screen gets a Swap button; the choice is written to
     the JSON like a text edit, and the image swaps in place */
  const dir = document.body.dataset.dir, groups = window.__SHOTS || [];
  const pk = document.createElement('dialog'); pk.className = 'picker';
  pk.innerHTML = '<header><p>Pick the final shipped screen</p><button type="button">Close</button></header><div class="pk-body">' +
    groups.map(g => '<h5>' + g.label + '</h5><div class="pk-grid">' + g.files.map(f =>
      '<button type="button" data-file="' + f + '"><img loading="lazy" src="' + dir + '/' + f + '" alt=""><span>' + f.split('/').pop() + '</span></button>').join('') + '</div>').join('') + '</div>';
  document.body.append(pk);
  let target = null;
  $('header button', pk).addEventListener('click', () => pk.close());
  pk.addEventListener('click', async e => {
    const b = e.target.closest('[data-file]'); if (!b || !target) return;
    const value = b.dataset.file;
    try {
      const r = await fetch('/__edit', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: document.body.dataset.slug, path: target.dataset.srcPath, value }) });
      if (!r.ok) throw new Error(await r.text());
      const img = $('img', target); img.removeAttribute('data-gif'); img.src = dir + '/' + value;
      pk.close(); say('Image saved');
    } catch (err) { say('Not saved: ' + err.message); }
  });
  btn.addEventListener('click', () => {
    if (editing()) $$('[data-src-path]').forEach(el => {
      const s = document.createElement('button'); s.type = 'button'; s.className = 'swap'; s.innerHTML = IC('swap') + '<span>Swap image</span>';
      s.addEventListener('click', e => { e.stopPropagation(); target = el;
        const cur = ($('img', el).getAttribute('src') || '').split('?')[0];
        $$('[data-file]', pk).forEach(x => x.classList.toggle('cur', cur.endsWith(x.dataset.file)));
        pk.showModal(); });
      el.append(s);
    });
    else $$('.swap').forEach(s => s.remove());
  });
  /* pointer placing: "⌖ Mouse" on a screen, then click where the mouse should sit;
     Alt-click removes it. Saved to cs.cursors through /__cursor. */
  let placing = null;
  btn.addEventListener('click', () => {
    if (editing()) $$('.frame[data-src]').forEach(f => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'place'; b.innerHTML = IC('pointer') + '<span>Mouse</span>';
      b.addEventListener('click', e => { e.stopPropagation(); if (placing) placing.classList.remove('placing');
        placing = placing === f ? null : f; if (placing) { f.classList.add('placing'); say('Click where the mouse should be · Alt-click removes it'); } });
      f.append(b);
    });
    else { $$('.place').forEach(b => b.remove()); if (placing) placing.classList.remove('placing'); placing = null; }
  });
  document.addEventListener('click', async e => {
    if (!placing || !placing.contains(e.target) || e.target.closest('button')) return;
    e.stopPropagation(); e.preventDefault();
    const shot = $('.shot', placing), img = $('img', shot), r = img.getBoundingClientRect();
    const x = +((e.clientX - r.left) / r.width * 100).toFixed(1), y = +((e.clientY - r.top) / r.height * 100).toFixed(1);
    const remove = e.altKey, src = placing.dataset.src;
    try {
      const res = await fetch('/__cursor', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: document.body.dataset.slug, src, x: remove ? null : x, y: remove ? null : y }) });
      if (!res.ok) throw new Error(await res.text());
      $$('.frame[data-src="' + src + '"] .shot').forEach(sh => {
        let m = $('.mouse', sh);
        if (remove) { if (m) m.remove(); return; }
        if (!m) { m = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); m.setAttribute('class', 'mouse'); m.setAttribute('viewBox', '0 0 18 22'); m.innerHTML = window.__MOUSE; sh.insertBefore(m, $('img', sh).nextSibling); }
        m.style.left = x + '%'; m.style.top = y + '%';
      });
      say(remove ? 'Mouse removed' : 'Mouse saved'); placing.classList.remove('placing'); placing = null;
    } catch (err) { say('Not saved: ' + err.message); }
  }, true);
  /* while editing, clicks on text inside frames don't open the viewer */
  document.addEventListener('click', e => { if (editing() && e.target.closest('[data-edit]')) e.stopPropagation(); }, true);
}

/* __checkIcons (localhost): measures every icon-only button that's on screen, comparing the
   drawn shape's real bounding box to the button's centre. Off by more than 1px → console
   error and a red outline on the button. Runs on load and whenever the viewer opens; call
   window.__checkIcons() any time. The build lint stops font-glyph icons; this stops a
   badly drawn or badly placed shape. */
window.__checkIcons = () => {
  const bad = [];
  $$('button, [role=button], a.edge, .cmp-knob').forEach(el => {
    const svg = $(':scope > svg, :scope > .ic', el); if (!svg) return;
    if ((el.textContent || '').trim()) return; // icon + words: aligned by flex, not by centre
    const b = el.getBoundingClientRect(); if (!b.width || !b.height) return; // hidden right now
    const shape = $('path, polygon, polyline, rect, circle', svg); if (!shape) return;
    const r = shape.getBoundingClientRect();
    const dx = (r.left + r.width / 2) - (b.left + b.width / 2), dy = (r.top + r.height / 2) - (b.top + b.height / 2);
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) { bad.push({ el, dx: +dx.toFixed(1), dy: +dy.toFixed(1) }); el.style.outline = '2px solid #e2686b'; }
  });
  bad.forEach(x => console.error('Icon off-centre by', x.dx, 'px,', x.dy, 'px:', x.el));
  return bad.map(x => ({ cls: x.el.className.baseVal ?? x.el.className, label: x.el.getAttribute('aria-label'), dx: x.dx, dy: x.dy }));
};
if (/^(localhost|127\\.0\\.0\\.1)$/.test(location.hostname)) {
  addEventListener('load', () => setTimeout(window.__checkIcons, 600));
  new MutationObserver(() => dlg.open && setTimeout(window.__checkIcons, 500)).observe(dlg, { attributes: true, attributeFilter: ['open'] });
}

/* a #view-x link opens straight into that viewer — handy mid-presentation */
const m = location.hash.match(/^#view-(.+)$/);
if (m && V[m[1]]) { history.replaceState(null, '', location.pathname); open(m[1], null); }
})();`;
