/* Vantage REVIEW, copied verbatim from /Users/madhumita/Desktop/Vantage/cli/phone.js (exports.REVIEW) on 2026-11-24 for the
   Mobile website editor try-it demo (tool-demos.js phone()). It runs inside the demo phone (a srcdoc iframe) whose stubs make fetch,
   storage and the microphone go nowhere. ONE change: in phone.js the comment "her drafts' pills open and scroll themselves" runs into
   the next statement on the same line, so const g / t were commented out and tapping a switch name threw (no scroll); here a line
   break ends the comment. Refresh: re-run this copy when REVIEW changes. */
(()=>{try{
const sv=(d,x)=>'<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"'+(x||'')+'>'+d+'</svg>';
const HAND='<g transform="translate(.7 -.8)"><rect x="2.8" y="10.2" width="4.2" height="9.6" rx="1.4"/><path d="M7 11.2l3.6-6.3c.5-.9 1.9-.8 2.2.2.2.6.2 1.2.1 1.8L12.3 10h5.2c1.5 0 2.5 1.4 2.2 2.8l-1.3 5.4c-.3 1.1-1.2 1.8-2.3 1.8H7"/><path d="M17.6 2.6v2M20.5 3.9l-1.4 1.4M21.6 7h-1.9" stroke-width="1.4"/></g>';
const UP=sv(HAND),DN=sv(HAND,' style="transform:rotate(180deg)"');
const MIC=sv('<g transform="translate(.1 -1.05)"><rect x="9" y="2.8" width="6" height="11.4" rx="3"/><path d="M5.6 11.2a6.4 6.4 0 0 0 12.8 0M12 17.6v3.6M9 21.2h6"/></g>');
const XI=sv('<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>'),STOP='<svg viewBox="0 0 24 24" width="18" height="18"><rect x="5" y="5" width="14" height="14" rx="3.5" fill="currentColor"/></svg>';
const ARW='<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path transform="translate(0 .95)" d="M12 19.5V5M5.8 11.2 12 5l6.2 6.2"/></svg>';
const st=document.createElement('style');st.textContent='[role=group]:is([data-review],[class*=rv-sw]),[role=group]:is([data-review],[class*=rv-sw]) *{-webkit-touch-callout:none!important;-webkit-user-select:none!important;user-select:none!important}'+
 '[role=group]:is([data-review],[class*=rv-sw]) button{touch-action:manipulation}[role=group] button[data-vote=up]{box-shadow:0 0 0 2px #6fd39b!important}[role=group] button[data-vote=down]{opacity:.45;text-decoration:line-through}'+
 '[role=group]:is([data-review],[class*=rv-sw])[data-target]>span,[role=group]:is([data-review],[class*=rv-sw])[aria-controls]>span{cursor:pointer;text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:3px}';
document.head.appendChild(st);
const h=document.createElement('div');h.style.cssText='all:initial';const r=h.attachShadow({mode:'open'});
r.innerHTML=`<style>
*{box-sizing:border-box;margin:0;font-family:-apple-system,system-ui,sans-serif}
.pop{position:fixed;z-index:2147483647;display:flex;gap:6px;padding:6px;border-radius:30px;background:#1d1f27;box-shadow:0 10px 30px rgba(0,0,0,.3);transform-origin:50% 100%;animation:in .32s cubic-bezier(.2,.9,.3,1.3) both}
.pop[hidden],.talk[hidden]{display:none}
.pop button{width:48px;height:48px;border:0;border-radius:24px;background:#2c2e36;color:#fff;display:grid;place-items:center;transition:transform .3s cubic-bezier(.3,1.6,.5,1),background .2s}
.pop button:active{transform:scale(.9);transition:transform .08s}
.pop .up:active,.pop .up.on{background:#2f6b4f;color:#b9f5d2}.pop .dn:active,.pop .dn.on{background:#7a2f2b;color:#ffd0cb}
.pop button.hov{transform:scale(1.16)}.pop .up.hov{background:#2f6b4f;color:#b9f5d2}.pop .dn.hov{background:#7a2f2b;color:#ffd0cb}.pop .mic.hov{background:#4a4e5c}
.tip{position:fixed;z-index:2147483647;padding:7px 11px;border-radius:999px;background:#1d1f27;color:#fff;font:700 11px/1 -apple-system,system-ui,sans-serif;letter-spacing:.08em;pointer-events:none;white-space:nowrap}.tip[hidden]{display:none}.tip.go{animation:in .32s cubic-bezier(.2,.9,.3,1.3) both,out .3s ease 1.4s forwards}@keyframes out{to{opacity:0;transform:translateY(-4px)}}
.talk{position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom));z-index:2147483647;padding:14px;border-radius:24px;background:#1d1f27;color:#fff;animation:rise .4s cubic-bezier(.2,.9,.3,1.12) both}
.talk .grab{display:block;position:relative;width:56px;height:22px;margin:-10px auto 2px;padding:0;border:0;background:none;-webkit-tap-highlight-color:transparent}.talk .grab::before{content:"";translate:0 .6px;position:absolute;left:12px;right:12px;top:8px;height:5px;border-radius:3px;background:#4a4e5c}
.talk b{display:block;font:600 13px/1.2 system-ui;letter-spacing:.06em;color:#9ea3ad;margin-bottom:8px}
.talk textarea{width:100%;min-height:72px;border:0;border-radius:14px;padding:10px 12px;background:#2c2e36;color:#fff;font:16px/1.35 -apple-system,system-ui,sans-serif;resize:none}
.talk .row{display:flex;align-items:center;gap:10px;margin-top:10px}
.talk .row button{flex:none;position:relative;width:44px;height:44px;border:0;border-radius:22px;display:grid;place-items:center;-webkit-tap-highlight-color:transparent;transition:transform .32s cubic-bezier(.3,1.6,.5,1),background .2s,color .2s,opacity .2s}
.talk .row button:active{transform:scale(.9);transition:transform .08s}.talk .row button[hidden]{display:none}
.talk .no,.talk .mk{background:#2c2e36;color:#fff}.talk .go{background:#fff;color:#1d1f27}.talk .go:disabled{opacity:.3}

.talk .sp{flex:1;min-width:0;font:400 13px/1.3 -apple-system,system-ui,sans-serif;color:#9ea3ad}
@keyframes ring{from{transform:scale(.92);opacity:.9}to{transform:scale(1.3);opacity:0}}
@keyframes in{from{transform:scale(.6) translateY(8px);opacity:0}}@keyframes rise{from{transform:translateY(120%)}}@keyframes beat{50%{opacity:.25}}
</style><div class="pop" hidden><button class="up" aria-label="Thumbs up">${UP}</button><button class="dn" aria-label="Thumbs down">${DN}</button><button class="mic" aria-label="Say what you think">${MIC}</button></div>
<div class="talk" hidden><button class="grab" aria-label="Close"></button><b></b><textarea placeholder="Say or type what you think"></textarea><div class="row"><span class="sp" aria-live="polite"></span><button class="mk" aria-label="Talk">${MIC}</button><button class="go" aria-label="Send">${ARW}</button></div></div>`;
(document.body||document.documentElement).appendChild(h);
const pop=r.querySelector('.pop'),talk=r.querySelector('.talk'),ta=talk.querySelector('textarea');
const name=g=>((g.querySelector(':scope > span')||{}).textContent||g.getAttribute('aria-label')||'').trim();
const key=(g,b)=>'__vantage_vote|'+location.pathname+'|'+name(g)+'|'+b.textContent.trim();
const send=o=>fetch('/__vantage/note',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(Object.assign({page:location.pathname},o))}).catch(()=>{});
let cur=null,timer=0,longed=false,rec=null;

const front=()=>{if(h.nextElementSibling)(document.body||document.documentElement).appendChild(h)};
function open(b){front();cur=b;const g=b.closest('[role=group]'),R=b.getBoundingClientRect();pop.hidden=false;const W=pop.offsetWidth;
 pop.style.left=Math.max(8,Math.min(innerWidth-W-8,R.left+R.width/2-W/2))+'px';pop.style.top=Math.max(8,R.top-pop.offsetHeight-10)+'px';
 pop.querySelector('.up').classList.toggle('on',b.dataset.vote==='up');pop.querySelector('.dn').classList.toggle('on',b.dataset.vote==='down');
 if(navigator.vibrate)navigator.vibrate(10)}
function close(){pop.hidden=true}
function vote(v){const g=cur.closest('[role=group]');const was=cur.dataset.vote;if(was===v){delete cur.dataset.vote;v='clear'}else cur.dataset.vote=v;
 try{v==='clear'?localStorage.removeItem(key(g,cur)):localStorage.setItem(key(g,cur),v)}catch(e){}send({switch:name(g),option:cur.textContent.trim(),vote:v});close()}
pop.querySelector('.up').onclick=()=>vote('up');pop.querySelector('.dn').onclick=()=>vote('down');
const mk=talk.querySelector('.mk'),go=talk.querySelector('.go'),sp=talk.querySelector('.sp'),SR=window.SpeechRecognition||window.webkitSpeechRecognition;
const sync=()=>{go.disabled=!ta.value.trim()};ta.addEventListener('input',sync);
// her 2026-11-24: "I thought I was recording, but then it wasn't ... then it automatically started recording, but I never told it to".
// The phone takes a moment (and the first time, a permission ask) before listening really starts. So: the button turns into the
// stop icon the instant it's tapped, and if she stops before the phone catches up, the late start is cancelled, never left running.
// No red, no status lines (her: "as long as the icon changes, they know that the state is different"); one line only if the mic can't work.
let want=false;
const idle=()=>{want=false;mk.innerHTML=MIC;mk.setAttribute('aria-label','Talk')};
const busy=()=>{mk.innerHTML=STOP;mk.setAttribute('aria-label','Stop')};
function listen(){sp.textContent='';if(!SR){mk.hidden=true;ta.focus();return}
 want=true;busy();
 try{let fin=ta.value.trim()?ta.value.trim()+' ':'';const R=new SR();rec=R;R.lang=navigator.language||'en-US';R.interimResults=true;R.continuous=true;
  R.onstart=()=>{if(!want||rec!==R){try{R.abort()}catch(e){}}};
  R.onresult=e=>{if(!want||rec!==R)return;let t='';for(let i=e.resultIndex;i<e.results.length;i++){if(e.results[i].isFinal)fin+=e.results[i][0].transcript+' ';else t+=e.results[i][0].transcript}
   ta.value=(fin+t).trimStart();ta.scrollTop=ta.scrollHeight;sync()};
  R.onerror=e=>{if(/not-allowed|service-not-allowed/.test(e.error))sp.textContent='Mic is off for this site. Type, or use the keyboard mic';if(rec===R){rec=null;idle()}};   // Safari sends no 'end' after a refusal: back to the mic icon here
  R.onend=()=>{if(rec===R){rec=null;idle()}};
  R.start()}catch(e){rec=null;idle();ta.focus()}}
const stopL=()=>{want=false;const R=rec;rec=null;idle();if(R)try{R.stop()}catch(e){try{R.abort()}catch(_){}}};
mk.onclick=()=>want?stopL():listen();
pop.querySelector('.mic').onclick=()=>{const g=cur.closest('[role=group]'),b=cur;close();front();stopL();talk.hidden=false;ta.value='';sp.textContent='';mk.hidden=false;sync();
 talk.querySelector('b').textContent=name(g)+' · '+b.textContent.trim();talk.dataset.sw=name(g);talk.dataset.op=b.textContent.trim();listen()};
const shut=()=>{stopL();talk.hidden=true;talk.style.translate='';talk.style.transition=''};talk.querySelector('.grab').onclick=shut;
// swipe it down to close (her 2026-11-24: "swipe up, swipe down ... with a little tab" instead of an X)
(function(){let y0=null,dy=0,t0=0;talk.addEventListener('touchstart',e=>{if(e.target.closest('textarea'))return;y0=e.touches[0].clientY;dy=0;t0=Date.now();talk.style.transition='none'},{passive:true});
 talk.addEventListener('touchmove',e=>{if(y0===null)return;dy=e.touches[0].clientY-y0;talk.style.translate='0 '+(dy>0?dy:dy*.2)+'px';if(Math.abs(dy)>6&&e.cancelable)e.preventDefault()},{passive:false});
 talk.addEventListener('touchend',()=>{if(y0===null)return;const v=dy/Math.max(1,Date.now()-t0);y0=null;talk.style.transition='translate .36s cubic-bezier(.2,.9,.3,1)';
  if(dy>70||v>.55){talk.style.translate='0 '+innerHeight+'px';setTimeout(shut,320)}else talk.style.translate='0 0'})})();
go.onclick=()=>{stopL();const t=ta.value.trim();if(t)send({switch:talk.dataset.sw,option:talk.dataset.op,note:t});talk.hidden=true};
const hit=e=>e.target.closest&&e.target.closest('[role=group]:is([data-review],[class*=rv-sw]) button');
// after a touch, phones also send copy-cat mouse events; those must not restart the hold or it would end up switching the option
let lastTouch=0;
let sx=0,sy=0,drag=false,hov=null;
function hover(x,y){let f=null,best=1e9;pop.querySelectorAll('button').forEach(b=>{const R=b.getBoundingClientRect(),dx=Math.abs(x-(R.left+R.width/2)),dy=Math.abs(y-(R.top+R.height/2));if(dx<=R.width/2+2&&dy<=R.height/2+18&&dx<best){best=dx;f=b}});pop.querySelectorAll('button').forEach(b=>b.classList.toggle('hov',b===f));
 if(f&&f!==hov&&navigator.vibrate)navigator.vibrate(6);hov=f}
const down=e=>{if(e.type==='touchstart'){lastTouch=Date.now();sx=e.touches[0].clientX;sy=e.touches[0].clientY}else if(Date.now()-lastTouch<1500)return;const b=hit(e);if(!b)return;
 longed=false;clearTimeout(timer);timer=setTimeout(()=>{if(b.getAttribute('aria-pressed')==='false')b.click();   // holding an option that isn't picked moves the toggle there first (her 2026-11-24)
  longed=true;drag=e.type==='touchstart';open(b)},380)};
// while the bubble is open from a hold, the finger steers it and the page holds still; small wobbles before that don't cancel the hold
const move=e=>{const t=e.touches&&e.touches[0];if(!t)return;if(drag&&!pop.hidden){if(e.cancelable)e.preventDefault();hover(t.clientX,t.clientY);return}
 if(Math.hypot(t.clientX-sx,t.clientY-sy)>10)clearTimeout(timer)};
const up=e=>{if(e.type==='touchend')lastTouch=Date.now();if(e.type==='mouseup'&&Date.now()-lastTouch<1500)return;clearTimeout(timer);
 if(drag&&e.type!=='mouseup'){drag=false;const t=e.changedTouches&&e.changedTouches[0];if(t)hover(t.clientX,t.clientY);const b=hov;hover(-99,-99);if(b&&e.type==='touchend')b.click()}};   // let go on a choice = pick it; anywhere else, the bubble stays for a tap
document.addEventListener('touchstart',down,{passive:true,capture:true});document.addEventListener('mousedown',down,true);
document.addEventListener('touchmove',move,{passive:false,capture:true});
['touchend','touchcancel','mouseup'].forEach(t=>document.addEventListener(t,up,{passive:true,capture:true}));
document.addEventListener('contextmenu',e=>{if(hit(e))e.preventDefault()},true);document.addEventListener('selectstart',e=>{if(e.target.closest&&e.target.closest('[role=group]:is([data-review],[class*=rv-sw])'))e.preventDefault()},true);
// her 2026-11-24: "a jiggle or something to let people know that they could long press on it, like bloop bloop ... then people
// tap on it and it just says long press feedback". Each switch's options hop twice, one after another, when it first scrolls
// into view; the first few plain taps show a small HOLD FOR FEEDBACK label over the option.
const still=false;
const io=null;   // the option hop is retired (her 2026-11-24); the switches open from a closed pill instead
// pages often add their switches after load: pick each one up whenever it appears (saved votes back on, hop once in view)
const seenG=new WeakSet();let mt=0;
const scan=()=>document.querySelectorAll('[role=group]:is([data-review],[class*=rv-sw])').forEach(g=>{if(seenG.has(g))return;seenG.add(g);if(io)io.observe(g);
 g.querySelectorAll('button').forEach(b=>{try{const v=localStorage.getItem(key(g,b));if(v)b.dataset.vote=v}catch(e){}})});
scan();new MutationObserver(()=>{clearTimeout(mt);mt=setTimeout(scan,150)}).observe(document.documentElement,{childList:true,subtree:true});
const tipEl=document.createElement('div');tipEl.className='tip';tipEl.textContent='TAP AGAIN FOR FEEDBACK';tipEl.hidden=true;r.appendChild(tipEl);
let tips=0,tipT=0;try{tips=top.__vantageTip?1:0}catch(e){}   // her 2026-11-24: shown ONE time, ever (the demo's storage is stubbed, so the site page remembers)
function tip(b){if(tips>=1)return;tips=1;try{top.__vantageTip=1}catch(e){}
 const R=b.getBoundingClientRect();tipEl.hidden=false;tipEl.classList.remove('go');void tipEl.offsetWidth;tipEl.classList.add('go');
 tipEl.style.left=Math.max(8,Math.min(innerWidth-tipEl.offsetWidth-8,R.left+R.width/2-tipEl.offsetWidth/2))+'px';tipEl.style.top=Math.max(8,R.top-tipEl.offsetHeight-8)+'px';
 clearTimeout(tipT);tipT=setTimeout(()=>{tipEl.hidden=true},1700)}
document.addEventListener('click',e=>{
 if(longed&&hit(e)){e.preventDefault();e.stopImmediatePropagation();longed=false;return} // a long press never also switches the option
 const hb=e.isTrusted&&hit(e);if(hb){const g=hb.closest('[role=group]');   // a drag across options fires untrusted clicks: never 'tap again'   // her 2026-11-24: "I can also just tap on A, B, C, or D a second time"
  if(g.__vLast===hb){e.preventDefault();e.stopImmediatePropagation();g.__vLast=null;open(hb);return}g.__vLast=hb;tip(hb)}
 const sp=e.target.closest&&e.target.closest('[role=group]:is([data-review],[class*=rv-sw]) > span');if(sp&&!sp.parentElement.matches('.rv-sw2')){   // her drafts' pills open and scroll themselves
const g=sp.parentElement,sel=g.dataset.target||(g.getAttribute('aria-controls')?'#'+g.getAttribute('aria-controls'):''),t=sel&&document.querySelector(sel);
  if(t){e.preventDefault();t.scrollIntoView({behavior:'smooth',block:'center'})}}
 if(!pop.hidden&&!e.composedPath().includes(pop))close()},true);
}catch(e){}})()
