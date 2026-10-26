// Swipe deck gesture test: real CDP wheel/mouse/touch input in headless Chrome 1280x800 against the dev server
// (node server.js 4174 running). Run: node tools/deck-gestures.test.mjs   Exit code 1 on any failure.
// Two checks per case: (1) it lands on the expected card, never passing more than one card per gesture;
// (2) RULE "a gesture on a scroller is never silently ignored": every gesture either changes the card or visibly
//     moves the deck (>= 3px) within its own window.
import os from 'node:os';
const { launch, client, sleep } = await import(os.homedir() + '/.claude/skills/device-check/scripts/cdp.mjs');
const { proc, ws } = await launch(); const c = await client(ws);
const rows = []; let fails = 0;
try {
  await c.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await c.send('Page.navigate', { url: 'http://localhost:4174/' }); await sleep(1500);
  await c.evaluate(`localStorage['mk-work-view']='deck'`);
  await c.send('Page.reload'); await sleep(2500);
  await c.evaluate(`document.querySelector('.sdeck').scrollIntoView({block:'center'})`); await sleep(1500);
  const box = await c.evaluate(`(()=>{const r=document.querySelector('.sdeck-stage').getBoundingClientRect();return {x:r.left+r.width*.34,y:r.top+r.height/2,w:document.querySelector('.scard').offsetWidth}})()`);
  // per frame: active card + the x of every card (any card moving = the deck visibly answering)
  await c.evaluate(`window.__rec=[];window.__marks=[];const cs=[...document.querySelectorAll('.sdeck .scard')];
    (function f(){__rec.push({t:performance.now(),a:__deckActive(),x:cs.map(c=>c.getBoundingClientRect().left)});requestAnimationFrame(f)})()`);
  const mark = () => c.evaluate(`__marks.push(performance.now())`);
  const go = async i => { await c.evaluate(`dispatchEvent(new CustomEvent('mk-deck-go',{detail:{i:${i}}}))`); await sleep(400); await c.evaluate('__rec.length=0;__marks.length=0'); };
  const judge = () => c.evaluate(`(()=>{const ms=__marks.concat(Infinity),g=[];
    for(let k=0;k<ms.length-1;k++){const w=__rec.filter(r=>r.t>=ms[k]&&r.t<ms[k+1]+300);if(!w.length){g.push('noframes');continue}
      const a0=w[0].a,moved=w.some(r=>r.a!==a0)||w.some(r=>r.x.some((x,i)=>Math.abs(x-w[0].x[i])>=3));g.push(moved?'ok':'IGNORED')}
    const as=__rec.map(r=>r.a);const wl=JSON.stringify(window.__wl||[]);window.__wl=[];return {wl,end:__deckActive(),min:Math.min(...as),max:Math.max(...as),gestures:g.join(',')}})()`);
  const wheel = async d => { await c.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: box.x, y: box.y, deltaX: d, deltaY: 0 }); await sleep(16); };
  const finger = [2, 5, 10, 18, 26, 32, 30, 24];
  const tail = (from, n, k = .955) => Array.from({ length: n }, (_, i) => from * Math.pow(k, i)).filter(v => v >= .5);
  const swipe = async (s = 1, tl = 110, bumpy = false) => { await mark(); for (const d of finger) await wheel(s * d); let i = 0; for (const d of tail(30, tl)) await wheel(s * d * (bumpy && i++ % 7 === 3 ? 2.4 : 1)); };
  const test = async (name, start, expect, fn) => { await go(start); await fn(); await sleep(1300); const r = await judge();
    const ok = r.end === expect && !/IGNORED|noframes/.test(r.gestures) && r.max - r.min <= Math.abs(expect - start) + (expect === start ? 1 : 0);
    if (!ok) fails++; rows.push({ ok: ok ? 'PASS' : 'FAIL', name, start, expect, ...r }); };
  await test('trackpad swipe + 1.8s momentum tail', 1, 2, () => swipe());
  await test('hard swipe, bumpy tail (single 2.4x jumps)', 1, 2, () => swipe(1, 140, true));
  await test('two swipes, 250ms quiet between', 0, 2, async () => { await swipe(1, 40); await sleep(250); await swipe(1, 40); });
  await test('swipe then reverse mid-tail', 1, 1, async () => { await mark(); for (const d of finger) await wheel(d); for (const d of tail(30, 12)) await wheel(d); await mark(); for (const d of finger) await wheel(-d); });
  await test('tail stalls 300ms mid-way, then resumes', 1, 2, async () => { await mark(); for (const d of finger) await wheel(d); const t = tail(30, 120); for (let i = 0; i < t.length; i++) { if (i === 30) await sleep(300); await wheel(t[i]); } });
  await test('bumpy tail stalls 250ms right before a bump', 1, 2, async () => { await mark(); for (const d of finger) await wheel(d); const t = tail(30, 120); for (let i = 0; i < t.length; i++) { if (i === 24) await sleep(250); await wheel(t[i] * (i % 7 === 3 ? 2.4 : 1)); } });
  await test('2nd swipe 300ms into the 1st one\'s momentum, no gap', 1, 3, async () => { await mark(); for (const d of finger) await wheel(d); for (const d of tail(30, 19)) await wheel(d); await swipe(1, 80); });
  await test('2nd swipe 150ms after the glide lands (tail still streaming)', 1, 3, async () => { await mark(); for (const d of finger) await wheel(d); const t = tail(30, 200, .97); for (let i = 0; i < 46; i++) await wheel(t[i]); await swipe(1, 60); });
  await test('2nd swipe 200ms after the 1st tail', 1, 3, async () => { await swipe(1, 60); await sleep(200); await swipe(1, 60); });
  await test('swipe back (left)', 2, 1, () => swipe(-1));
  await test('tiny push 15px (eases back, visibly)', 1, 1, async () => { await mark(); for (const d of [3, 4, 4, 4]) await wheel(d); });
  await test('mouse sideways wheel: 3 clicks, 250ms apart', 0, 3, async () => { for (let k = 0; k < 3; k++) { await mark(); await wheel(100); await sleep(250); } });
  const mouse = async (dx, steps, dt) => { await mark(); await c.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box.y, button: 'left', clickCount: 1 });
    for (let i = 1; i <= steps; i++) { await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.x + dx * i / steps, y: box.y, button: 'left', buttons: 1 }); await sleep(dt); }
    await c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x + dx, y: box.y, button: 'left', clickCount: 1 }); };
  await test('mouse: fast drag across 2.5 cards', 1, 2, () => mouse(-box.w * 2.5, 12, 8));
  await test('mouse: slow drag across 2.5 cards', 1, 2, () => mouse(-box.w * 2.5, 60, 20));
  await test('mouse: slow drag 10% of a card', 1, 1, () => mouse(-box.w * .1, 20, 25));
  await c.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  const touch = async (dx, steps, dt) => { await mark(); await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x, y: box.y }] });
    for (let i = 1; i <= steps; i++) { await c.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: box.x + dx * i / steps, y: box.y }] }); await sleep(dt); }
    await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); };
  await test('touch: long fast flick (2 cards)', 1, 2, () => touch(-box.w * 2, 8, 8));
  await test('touch: slow drag 30% of a card', 1, 2, () => touch(-box.w * .3, 15, 25));
} finally { c.close(); proc.kill(); }
for (const r of rows) console.log(r.ok, '|', r.name, '|', r.start, '->', r.end, '(expect', r.expect + ', seen', r.min + '..' + r.max + ') gestures:', r.gestures);
console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exitCode = fails ? 1 : 0;
