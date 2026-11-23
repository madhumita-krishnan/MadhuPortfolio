/* TRY-IT DEMOS for "My AI tools" (her 2026-11-23: "when you click on the AI tools, I want you to be able to demo each tool ... that's the
   whole point"; and "this is a product demo ... very chiseled out demos of the product for people to walk through and use").
   - EDITOR (the Taste sliders folded in, her 2026-11-23: "the editor and the taste sliders are like the same tool"): her sample card (her
     site.json words + her clay paper plane). Hover for the pink ✕, click a text / the card and the panel shows its taste-slider rows
     (label, slider, number field; colour = wheel + Lightness + swatch); click again / double-click to type; ADD TEXT adds copy; RESET;
     the dock chat ("Ask Claude, or describe a change") is an ALLOW-LIST: fixed replies, "Visual tweaks only.", nothing kept or sent.
   - VIDEO EDITOR: a real editor on her raw zoom-demo recording (see video() below).
   window.toolDemo.open(id, {name, line, from}). Native <dialog>: Esc, focus trap; ✕ / outside click close; focus goes back to `from`.
   The page behind is blurred under a wash (on ::backdrop, like her gallery); her cursor rides INTO the dialog so it never disappears;
   held knobs SQUISH (window.tasteSquish, taste-sliders.js); Reduce Motion = no easing, no squish. No network, ever. */
(function () {
  if (window.toolDemo) return;
  const A = (document.currentScript && document.currentScript.src || '').replace(/[^/]*$/, '') || 'assets/case-studies/ai-tools/';
  const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const css = document.createElement('style');
  css.textContent = `
.td{--bg:#fbfaf7;--tile:#e9e8e3;--card:#fff;--ink:#161a24;--mut:#4f5866;--line:rgba(22,26,36,.16);--pk:#ec6fa0;
  position:fixed;inset:0;width:100%;height:100%;max-width:none;max-height:none;margin:0;padding:16px;box-sizing:border-box;border:0;
  background:transparent;color:var(--ink);overflow:auto;opacity:0;transition:opacity .4s ease;font-family:'Plus Jakarta Sans',system-ui,sans-serif}
.td[open]{display:flex}.td.in{opacity:1}
/* the blur + wash live on ::backdrop, like her gallery's. NOT on the dialog: a backdrop-filter on the dialog made it the containing block
   for her position:fixed dot cursor, so the dot drifted with the dialog's scroll and vanished (her 2026-11-23 "the cursor cannot keep
   disappearing in all the demos") */
.td::backdrop{background:rgba(250,250,248,.55);-webkit-backdrop-filter:blur(24px);backdrop-filter:blur(24px);opacity:0;transition:opacity .4s ease}
.td.in::backdrop{opacity:1}
html[data-theme=night] .td::backdrop,html[data-look=dark] .td::backdrop{background:rgba(12,13,16,.62)}
html[data-theme=night] .td,html[data-look=dark] .td{--bg:#121418;--tile:#1b1e24;--card:#23272e;--ink:#f3f4f6;--mut:#a9adb7;--line:rgba(243,244,246,.18);--xb:rgba(255,255,255,.12)}
body.dc-on dialog.td[open],body.dc-on dialog.td[open] *,dialog.td.td-ring[open],dialog.td.td-ring[open] *{cursor:none!important}   /* her cursor is the cursor here too: it rides into the dialog (home: the #dc dot; the drafts pages: their .cursor ring) */
/* ONE SURFACE, her gallery's (her 2026-11-23: "doesn't look like it was intentionally designed ... not designed in my design system";
   "especially the difference in the photo labels"): no card inside a card. The demo sits straight on the blurred page like a print on
   the gallery's desk, the ✕ is the gallery's .dg-x (44px, 20px in from the top-right corner of the screen), and the caption is the
   gallery's .dg-cap to the pixel: 13px/500 capitals eyebrow in her blue, 22px/600 name, 16px/300 line, on the 86% cream panel, 12px/18px, r12 */
.td-in{margin:auto;width:min(960px,100%);padding:56px 0 8px;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;gap:22px;transform:translateY(12px);transition:transform .45s cubic-bezier(.2,.7,.2,1)}
.td.in .td-in{transform:none}
.td-in.wide{width:min(1120px,100%)}   /* the video editor needs the room of a real editor */
.td-stage{position:relative;width:100%;border-radius:14px;background:var(--tile);overflow:hidden;box-shadow:0 26px 40px -18px rgba(60,45,30,.45),0 2px 5px rgba(60,45,30,.22)}
html[data-theme=night] .td-stage,html[data-look=dark] .td-stage{box-shadow:0 30px 60px -20px rgba(0,0,0,.8),0 2px 6px rgba(0,0,0,.4)}
.td-cap{display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;max-width:min(620px,88vw);box-sizing:border-box;padding:12px 18px;border-radius:12px;background:rgba(250,250,248,.86)}
.td-cap i{font:500 13px/1 'Plus Jakarta Sans',system-ui,sans-serif;font-style:normal;letter-spacing:.12em;text-transform:uppercase;color:#3a62ab}
.td-cap b{font:600 22px/1.3 'Plus Jakarta Sans',system-ui,sans-serif;color:#161a24}
.td-cap span{font:300 16px/1.5 'Plus Jakarta Sans',system-ui,sans-serif;color:#3d4552}
html[data-theme=night] .td-cap,html[data-look=dark] .td-cap{background:rgba(22,27,40,.86)}
html[data-theme=night] .td-cap i,html[data-look=dark] .td-cap i{color:#8fb2f2}html[data-theme=night] .td-cap b,html[data-look=dark] .td-cap b{color:#f3f4f6}html[data-theme=night] .td-cap span,html[data-look=dark] .td-cap span{color:#a9adb7}
.td-x{position:fixed;right:20px;top:20px;z-index:3;width:44px;height:44px;border:0;border-radius:999px;background:rgba(22,26,36,.12);display:grid;place-items:center;cursor:pointer;padding:0;transition:background .2s ease}
.td-x:hover{background:rgba(22,26,36,.2)}
@media (max-width:700px){.td::before{content:'';position:fixed;left:0;right:0;top:0;height:76px;z-index:2;pointer-events:none;background:linear-gradient(var(--bg) 78%,rgba(0,0,0,0))}html[data-theme=night] .td::before,html[data-look=dark] .td::before{background:linear-gradient(var(--bg) 78%,rgba(18,20,24,0))}}   /* phones: the content scrolls under a solid strip of the page colour, never straight under the ✕ */
html[data-theme=night] .td-x,html[data-look=dark] .td-x{background:rgba(255,255,255,.12)}html[data-theme=night] .td-x:hover,html[data-look=dark] .td-x:hover{background:rgba(255,255,255,.2)}
.td-x svg{width:18px;height:18px;stroke:var(--ink);stroke-width:1.8;stroke-linecap:round;fill:none}
.td button:focus-visible,.td [tabindex]:focus-visible,.td input:focus-visible{outline:2px solid var(--ink);outline-offset:3px}
html.td-lock{overflow:hidden}
/* editor = ONE tool with the taste sliders folded in (her 2026-11-23: "the editor and the taste sliders are like the same tool ... take a
   lot of the UI from the taste sliders and put it into the editor styling ... add copy ... combine it together"): her sample card (her
   words + her clay paper plane) on the left; click anything and the panel shows THAT element's properties as taste-slider rows (label,
   slider, number field you can type into; colour = the wheel + swatch); click again / double-click to type; ADD TEXT adds copy; ✕ deletes */
.ed{display:grid;grid-template-columns:minmax(0,1fr) 330px;gap:20px;padding:24px;align-items:start}
.ed-card{align-self:center;background:var(--card);border-radius:14px;padding:28px;display:flex;flex-direction:column;align-items:flex-start;gap:14px;min-height:150px;cursor:pointer;outline-offset:4px}
.ed-card:hover{outline:1.5px dashed var(--pk)}
.ed-card.sel{outline:2px solid var(--pk)}
.ed-it{position:relative;max-width:100%}.ed-it[hidden]{display:none}
.ed-pic img{display:block;width:120px;height:auto;pointer-events:none}
.ed-t{display:block;margin:0;cursor:pointer;border-radius:3px;outline-offset:3px;color:var(--ink);min-width:2ch}
.ed-t:hover,.ed-t:focus-visible{outline:1.5px dashed var(--pk)!important;outline-offset:3px}
.ed-it.sel .ed-t{outline:2px solid var(--pk)!important}
.ed-t[contenteditable=true]{cursor:text;caret-color:var(--pk)}
.ed-t:empty::before{content:'Type here';color:var(--mut)}
h3.ed-t{font:700 30px/1.15 'Plus Jakarta Sans',system-ui,sans-serif}
p.ed-t{font:300 16px/1.5 'Plus Jakarta Sans',system-ui,sans-serif;max-width:34ch}
.ed-t.ed-b{display:inline-block;padding:11px 20px;border-radius:999px;background:var(--ink);color:var(--card);font:600 13px/1 'Plus Jakarta Sans',system-ui,sans-serif;letter-spacing:.08em}
.ed-x{position:absolute;top:-12px;right:-12px;width:24px;height:24px;border-radius:50%;border:0;padding:0;background:var(--pk);color:#fff;font:700 13px/24px system-ui,sans-serif;text-align:center;cursor:pointer;opacity:0;pointer-events:none;transition:opacity .2s ease}
.ed-x::before{content:'';position:absolute;inset:-10px}
.ed-it:hover .ed-x,.ed-it.sel .ed-x,.ed-it:focus-within .ed-x{opacity:1;pointer-events:auto}
.ed-p{background:var(--card);border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:14px;font:500 13px/1.3 'Plus Jakarta Sans',system-ui,sans-serif;transition:opacity .3s ease;min-width:0}
.ed-p.off .ed-rows{opacity:.45;pointer-events:none}
.ed-ph{margin:0;font:600 13px/1.3 'Plus Jakarta Sans',system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:var(--mut)}
/* the taste sliders' rows: label | control | value (a number field you can type in, or the colour's swatch) */
.ed-rows{display:grid;grid-template-columns:max-content minmax(0,1fr) max-content;grid-auto-flow:row dense;column-gap:12px;row-gap:12px;align-items:center}
.ed-rows>span{color:var(--mut)}
.ed-n{width:3.7em;box-sizing:border-box;margin:0;padding:5px 6px;border:0;border-radius:6px;box-shadow:inset 0 0 0 1px var(--line);background:transparent;color:var(--ink);font:500 13px/1.2 'Plus Jakarta Sans',system-ui,sans-serif;text-align:right;font-variant-numeric:tabular-nums;-moz-appearance:textfield;appearance:textfield}
.ed-n::-webkit-inner-spin-button,.ed-n::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
.ed-n:focus-visible{outline:2px solid var(--pk);outline-offset:1px}
.ed-sw{grid-column:3;justify-self:end;width:1.9em;height:1.9em;border-radius:6px;box-shadow:inset 0 0 0 1px var(--line)}
.ed-p input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:24px;margin:0;cursor:grab;touch-action:pan-y;
  background:linear-gradient(var(--pk),var(--pk)) 8px 50%/calc((100% - 16px) * var(--f,.5)) 2px no-repeat,linear-gradient(var(--line),var(--line)) 8px 50%/calc(100% - 16px) 2px no-repeat}
.ed-p input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;border-radius:var(--sq-br,50%);background:var(--pk);border:0;transform:var(--sq,none)}
.ed-p input[type=range]::-moz-range-thumb{width:16px;height:16px;border-radius:var(--sq-br,50%);background:var(--pk);border:0;transform:var(--sq,none)}
.ed-p input.held{cursor:grabbing}
/* colour = the same wheel as the taste sliders (her 2026-11-23: "a circle thing that we can change the hue"); the handle and the swatch ARE the applied colour */
.ed-w{--tw:118px;grid-column:2;justify-self:start}
@media (max-width:480px){.ed-w{grid-column:1/-1;justify-self:center}}   /* phones: the wheel gets its own line under its label + swatch, never squeezed past the panel */
/* Lightness: its track IS the colours (black → this hue → white) and runs exactly where the 22px thumb's centre runs, so the colour under the thumb = the applied colour */
.ed-p input.ed-ltr{--tc:#161a24;height:28px;background:var(--lt,linear-gradient(90deg,#000,#888,#fff)) 11px 50%/calc(100% - 22px) 8px no-repeat}
.ed-p input.ed-ltr::-webkit-slider-thumb{width:22px;height:22px;background:var(--tc);box-shadow:0 0 0 2px #fff,0 0 0 3px rgba(22,26,36,.9)}
.ed-p input.ed-ltr::-moz-range-thumb{width:22px;height:22px;background:var(--tc);box-shadow:0 0 0 2px #fff,0 0 0 3px rgba(22,26,36,.9)}
.ed-acts{display:flex;flex-wrap:wrap;gap:8px}
/* her editor's DOCK chat: full width under the card and the panel (her 2026-11-23: "a chat box where you can type stuff into Claude") */
.ed-chat{grid-column:1/-1;background:var(--card);border-radius:14px;padding:14px 16px;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.3fr);gap:8px 20px;align-items:end}
.ed-chat h4{grid-column:1/-1}
.ed-chat h4{margin:0;font:600 13px/1.3 'Plus Jakarta Sans',system-ui,sans-serif}
.ed-msgs{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px;min-height:44px;justify-content:flex-end}
.ed-msgs li{align-self:flex-start;max-width:92%;padding:7px 10px;border-radius:10px;background:var(--tile);font:400 13px/1.35 'Plus Jakarta Sans',system-ui,sans-serif}
.ed-ask{display:flex;gap:6px;align-items:flex-end}
.ed-ask textarea{flex:1;min-width:0;min-height:44px;max-height:88px;resize:none;box-sizing:border-box;padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink);font:400 14px/1.35 'Plus Jakarta Sans',system-ui,sans-serif}
.ed-ask textarea::placeholder{color:var(--mut)}
.ed-ask button{position:relative;min-height:44px;padding:0 14px;border:0;border-radius:999px;background:var(--ink);color:var(--bg);font:600 12px/1 'Plus Jakarta Sans',system-ui,sans-serif;letter-spacing:.08em;cursor:pointer}
/* her dot cursor sits ON the knob while she drags a colour: over a colour control it takes the applied colour (with the same rings), so what's under the pointer is never the wrong colour */
.td.td-tint #dc .dc-body{background:var(--td-c)!important;box-shadow:none}   /* no ring of its own: on the knob it melts into one solid disc of the colour */
.ed-r{position:relative;align-self:flex-start;border:0;background:var(--tile);color:var(--ink);min-height:36px;border-radius:999px;padding:9px 18px;font:600 12px/1 'Plus Jakarta Sans',system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;cursor:pointer}
.ed-a{position:relative;border:0;background:var(--ink);color:var(--card);min-height:36px;border-radius:999px;padding:9px 18px;font:600 12px/1 'Plus Jakarta Sans',system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;cursor:pointer}
/* taste sliders */
.td-ts{aspect-ratio:16/10}
/* VIDEO EDITOR (her 2026-11-23: "The video editor doesn't have any of the normal functionality of a video editor ... I need the high-fi
   version with all of the bells and whistles ... very chiseled out demos of the product for people to walk through and use"): her RAW
   zoom-demo recording (no camera baked in) and the camera is the editor's zoom track, applied live. Transport + timecode, a zoomable
   timeline (Video, Zoom, Clicks), scrub, trim, split, delete, zoom blocks with keyframes + an inspector, undo/redo, snapping, shortcuts. */
.vx{--zc:#3a62ab;--zt:#fff;--hov:rgba(22,26,36,.08);display:grid;grid-template-columns:auto minmax(280px,1fr);grid-template-areas:"mon insp" "bar bar" "tl tl" "keys keys";gap:14px 18px;padding:20px;user-select:none;-webkit-user-select:none;font:500 13px/1.3 'Plus Jakarta Sans',system-ui,sans-serif;color:var(--ink)}
html[data-theme=night] .vx,html[data-look=dark] .vx{--zc:#8fb2f2;--zt:#121418;--hov:rgba(255,255,255,.1)}
.vx:focus{outline:none}
.vx-mon{grid-area:mon;position:relative;height:min(50vh,480px);aspect-ratio:4/3;border-radius:8px;overflow:hidden;background:#F0EBED;box-shadow:0 0 0 1px var(--line)}
.vx-view{position:absolute;inset:0;transform-origin:0 0}
.vx-view video{width:100%;height:100%;display:block;object-fit:cover}
.vx-zl{position:absolute;left:10px;top:10px;padding:5px 8px;border-radius:6px;background:rgba(22,26,36,.78);color:#fff;font:600 13px/1 'Plus Jakarta Sans',system-ui,sans-serif;font-variant-numeric:tabular-nums;opacity:0;transition:opacity .2s ease}
.vx-mon.z .vx-zl{opacity:1}
.vx-insp{grid-area:insp;min-width:0;background:var(--card);border-radius:12px;padding:14px;display:flex;flex-direction:column;gap:12px;align-self:stretch;contain:size;overflow-y:auto;overscroll-behavior:contain}   /* contain:size = the panel never sets the row's height (the preview does), so selecting a zoom or a clip never pushes the transport + timeline down; long panels scroll inside */
.vx-insp>*{flex:none}
.vx-insp h4{margin:0;font:600 13px/1.3 'Plus Jakarta Sans',system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:var(--mut)}
.vx-row{display:grid;grid-template-columns:1fr auto;gap:6px 10px;align-items:center}
.vx-row output,.vx-row b{font-weight:500;font-variant-numeric:tabular-nums;color:var(--mut)}
.vx-row b{color:var(--ink)}
.vx-insp input[type=range]{grid-column:1/-1}
.vx input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:24px;margin:0;cursor:grab;touch-action:pan-y;
  background:linear-gradient(var(--pk),var(--pk)) 8px 50%/calc((100% - 16px) * var(--f,.5)) 2px no-repeat,linear-gradient(var(--line),var(--line)) 8px 50%/calc(100% - 16px) 2px no-repeat}
.vx input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;border-radius:var(--sq-br,50%);background:var(--pk);border:0;transform:var(--sq,none)}
.vx input[type=range]::-moz-range-thumb{width:16px;height:16px;border-radius:var(--sq-br,50%);background:var(--pk);border:0;transform:var(--sq,none)}
.vx-seg{grid-column:1/-1;display:grid;grid-template-columns:repeat(3,1fr);gap:4px}.vx-seg .vx-b{background:var(--tile);padding:0 6px}.vx-seg .vx-b.on{background:var(--ink);color:var(--card)}
.vx-aim{grid-column:1/-1;position:relative;aspect-ratio:4/3;width:100%;max-width:240px;border-radius:6px;overflow:hidden;background-repeat:no-repeat;background-size:2700% 100%;touch-action:none;cursor:move}
.vx-aim i{position:absolute;box-sizing:border-box;border:2px solid var(--pk);border-radius:3px;box-shadow:0 0 0 999px rgba(22,26,36,.42);pointer-events:none}
.vx-note{margin:0;color:var(--mut);font-weight:400}
.vx-list{display:flex;flex-direction:column;gap:4px;margin:0;padding:0;list-style:none}
.vx-li{all:unset;box-sizing:border-box;width:100%;display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;padding:7px 10px;border-radius:8px;background:var(--tile);cursor:pointer;font-variant-numeric:tabular-nums;transition:box-shadow .15s ease}
.vx-li:hover{box-shadow:inset 0 0 0 999px var(--hov)}.vx-li:focus-visible{outline:2px solid var(--ink);outline-offset:2px}
.vx-li i{width:10px;height:10px;border-radius:3px;background:var(--zc)}.vx-li i.c{background:var(--mut)}.vx-li span{color:var(--mut)}
.vx-bar{grid-area:bar;min-width:0;display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px}
.vx-g{display:flex;flex-wrap:wrap;align-items:center;gap:6px;min-width:0}
.vx-sp{flex:1}
.vx-zg{flex-wrap:nowrap}
.vx-b{position:relative;min-height:36px;min-width:36px;padding:0 13px;border:0;border-radius:999px;background:var(--card);color:var(--ink);font:600 12px/1 'Plus Jakarta Sans',system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;display:inline-flex;align-items:center;justify-content:center;gap:6px;cursor:pointer;transition:box-shadow .15s ease,opacity .15s ease}
.vx-b:hover:not(:disabled){box-shadow:inset 0 0 0 999px var(--hov)}
.vx-b:disabled{opacity:.38;cursor:default}
.vx-b.on{background:var(--ink);color:var(--card)}
.vx-b svg{width:14px;height:14px;fill:currentColor}
.vx-b.i{padding:0;width:36px}
.vx-play{width:44px;height:44px;min-height:44px;padding:0;background:var(--ink);color:var(--card)}
.vx-play svg{width:16px;height:16px}
.vx-tc{font:500 14px/1 'Plus Jakarta Sans',system-ui,sans-serif;font-variant-numeric:tabular-nums;white-space:nowrap;padding:0 4px}
.vx-tc span{color:var(--mut)}
.vx-zm{width:110px}
.vx-tl{grid-area:tl;min-width:0;display:grid;grid-template-columns:72px minmax(0,1fr);background:var(--card);border-radius:12px;overflow:hidden}
.vx-heads{position:relative;border-right:1px solid var(--line)}
.vx-heads span{position:absolute;left:12px;font:600 12px/1 'Plus Jakarta Sans',system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:var(--mut)}
.vx-sc{position:relative;overflow-x:auto;overflow-y:hidden;scrollbar-width:thin;overflow-anchor:none}
.vx-cv{position:relative;height:150px;touch-action:pan-x;overflow:hidden}
.vx-ruler{position:absolute;left:0;right:0;top:0;height:26px;border-bottom:1px solid var(--line);touch-action:none;cursor:pointer}
.vx-ruler i{position:absolute;bottom:0;width:1px;height:5px;background:var(--mut);opacity:.5}
.vx-ruler i.L{height:9px;opacity:.9}
.vx-ruler b{position:absolute;top:4px;margin-left:4px;font:500 12px/1 'Plus Jakarta Sans',system-ui,sans-serif;font-variant-numeric:tabular-nums;color:var(--mut)}
.vx-lane{position:absolute;left:0;right:0}
.vx-lv{top:34px;height:50px}.vx-lz{top:92px;height:30px}.vx-lc{top:126px;height:22px}
.vx-clip{position:absolute;top:0;bottom:0;border-radius:6px;overflow:hidden;background:#d9d4d6;outline:0;box-shadow:inset 0 0 0 1px rgba(22,26,36,.18)}
.vx-clip .th{position:absolute;inset:0;display:flex;pointer-events:none}
.vx-clip .th s{flex:none;width:67px;height:100%;background-image:var(--strip);background-repeat:no-repeat;background-size:1809px 100%}
.vx-clip::after{content:'';position:absolute;inset:0;border-radius:inherit;pointer-events:none;transition:box-shadow .15s ease}
.vx-clip:hover::after{box-shadow:inset 0 0 0 2px var(--ink)}
.vx-clip.sel::after{box-shadow:inset 0 0 0 3px var(--pk)}
.vx-h{position:absolute;top:0;bottom:0;width:14px;z-index:1;background:var(--pk);opacity:0;touch-action:none;cursor:ew-resize;transition:opacity .15s ease;display:grid;place-items:center}
.vx-h::before{content:'';width:2px;height:16px;border-radius:1px;background:#fff}
.vx-h.l{left:0;border-radius:6px 0 0 6px}.vx-h.r{right:0;border-radius:0 6px 6px 0}
.vx-clip:hover .vx-h,.vx-clip.sel .vx-h,.vx-h.on{opacity:1}
.vx-z{position:absolute;top:0;bottom:0;border-radius:6px;background:var(--zc);color:var(--zt);touch-action:none;cursor:grab;outline:0;transition:box-shadow .15s ease}
.vx-z:hover{box-shadow:0 0 0 2px var(--ink)}
.vx-z.sel{box-shadow:0 0 0 3px var(--pk)}
.vx-z .r{position:absolute;top:0;bottom:0;background:rgba(255,255,255,.38);pointer-events:none}
html[data-theme=night] .vx-z .r,html[data-look=dark] .vx-z .r{background:rgba(18,20,24,.32)}
.vx-z .r.a{left:0;border-radius:6px 0 0 6px}.vx-z .r.b{right:0;border-radius:0 6px 6px 0}
.vx-z em{position:absolute;inset:0;display:grid;place-items:center;font:600 12px/1 'Plus Jakarta Sans',system-ui,sans-serif;font-style:normal;font-variant-numeric:tabular-nums;pointer-events:none;white-space:nowrap;overflow:hidden}
.vx-k{position:absolute;top:50%;width:24px;height:30px;margin:-15px 0 0 -12px;display:grid;place-items:center;touch-action:none;cursor:ew-resize;z-index:1}
.vx-k::before{content:'';width:9px;height:9px;border-radius:1px;background:var(--zt);box-shadow:0 0 0 1.5px var(--zc);transform:rotate(45deg);transition:transform .15s ease}
.vx-k:hover::before,.vx-k.on::before{transform:rotate(45deg) scale(1.35)}
.vx-m.dot{font-size:0;gap:0}   /* too close to the one before: the dot alone (its name is in its tooltip) */
.vx-m{position:absolute;top:0;height:22px;display:flex;align-items:center;gap:5px;font:500 12px/1 'Plus Jakarta Sans',system-ui,sans-serif;color:var(--mut);white-space:nowrap;cursor:pointer;border-radius:4px;padding:0 4px;margin-left:-8px}
.vx-m::before{content:'';width:8px;height:8px;border-radius:50%;background:var(--mut);flex:none}
.vx-m:hover{color:var(--ink)}.vx-m:hover::before{background:var(--ink)}
.vx-ph{position:absolute;top:0;bottom:0;width:0;z-index:3;pointer-events:none}
.vx-ph::before{content:'';position:absolute;top:8px;bottom:0;left:-1px;width:2px;border-radius:1px;background:var(--pk)}
.vx-ph i{position:absolute;top:2px;left:-8px;width:16px;height:16px;border-radius:var(--sq-br,50%);background:var(--pk);pointer-events:auto;touch-action:none;cursor:grab;transform:var(--sq,none);outline-offset:3px}
.vx-hv,.vx-snap{position:absolute;top:0;bottom:0;width:1px;pointer-events:none;display:none;z-index:2}
.vx-hv{background:var(--ink);opacity:.3}.vx-snap{background:var(--zc)}
.vx-keys{grid-area:keys;display:flex;flex-wrap:wrap;gap:6px 16px;color:var(--mut);font-weight:400}
.vx-keys kbd{font:600 12px/1 'Plus Jakarta Sans',system-ui,sans-serif;padding:3px 6px;margin-right:5px;border-radius:4px;background:var(--card);color:var(--ink)}
@media (hover:none){.vx-keys{display:none}.vx-h{width:20px}}
@media (max-width:420px){.vx-tc{font-size:13px}.vx-b.i{width:34px;min-width:34px}.vx-play{width:42px;height:42px;min-height:42px}}
@media (max-width:860px){.vx-insp{contain:none;overflow:visible}.vx{grid-template-columns:minmax(0,1fr);grid-template-areas:"mon" "bar" "tl" "insp" "keys";padding:14px;gap:12px}.vx-mon{height:auto;width:100%}
  .vx-tl{grid-template-columns:58px minmax(0,1fr)}.vx-heads span{left:8px;font-size:12px;letter-spacing:.04em}.vx-sp{display:none}.vx-zg{flex:1 1 100%}.vx-zm{width:auto;flex:1}}
@media (prefers-reduced-motion:reduce){.vx *{transition:none!important}.vx input[type=range]::-webkit-slider-thumb,.vx-ph i{transform:none!important}}
@media (max-width:700px){.td{padding:10px}.td-in{padding:64px 0 6px;gap:16px}.ed{grid-template-columns:1fr;padding:16px;gap:12px}.ed-chat{grid-template-columns:1fr}.ed-w{--tw:120px}
  .ed-card{padding:22px 18px}h3.ed-t{font-size:24px}.td-ts{aspect-ratio:4/3}}
@media (max-width:640px){.td-cap b{font-size:16px}.td-cap span{font-size:14px}}
@media (prefers-reduced-motion:reduce){.td,.td::backdrop,.td-in,.ed-x,.ed-p{transition:none}
  .ed-p input::-webkit-slider-thumb{transform:none!important}.ed-p input::-moz-range-thumb{transform:none!important}}`;
  document.head.appendChild(css);

  const dg = document.createElement('dialog');
  dg.className = 'td';
  dg.innerHTML = `<button type="button" class="td-x" aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
<div class="td-in"><div class="td-stage"></div><div class="td-cap"><i>My AI tools</i><b></b><span></span></div></div>`;
  const stage = dg.querySelector('.td-stage');
  let from = null, closing = 0, dc = null, dcHome = null;
  const add = () => { if (!dg.isConnected) document.body.appendChild(dg); };

  /* EDITOR — her words from site.json hero: headline, first line, the SAY HEY! button */
  const ED = `<div class="ed"><div class="ed-card">
<div class="ed-it ed-pic"><img src="${A}taste-plane.png" alt="Her clay paper plane" width="640" height="389"><button type="button" class="ed-x" aria-label="Delete">✕</button></div>
<div class="ed-it"><h3 class="ed-t" tabindex="0">Hi, I'm Madhu</h3><button type="button" class="ed-x" aria-label="Delete">✕</button></div>
<div class="ed-it"><p class="ed-t" tabindex="0">Architecture taught me how to guide people with design.</p><button type="button" class="ed-x" aria-label="Delete">✕</button></div>
<div class="ed-it"><span class="ed-t ed-b" tabindex="0">SAY HEY!</span><button type="button" class="ed-x" aria-label="Delete">✕</button></div></div>
<div class="ed-p"><h4 class="ed-ph"></h4><div class="ed-rows"></div><div class="ed-acts"><button type="button" class="ed-a" data-hand="ADD TEXT">ADD TEXT</button><button type="button" class="ed-r" data-hand="RESET">RESET</button></div></div>
<div class="ed-chat"><h4>Claude</h4><ol class="ed-msgs" aria-live="polite"></ol>
<form class="ed-ask"><textarea rows="2" maxlength="80" aria-label="Message to Claude" placeholder="Ask Claude, or describe a change" autocomplete="off" spellcheck="false"></textarea><button type="submit" data-hand="SEND">SEND</button></form></div></div>`;
  /* THE DOCK CHAT, an allow-list (her 2026-11-23: "if it's not like a visual tweak, just say no"; and, on the first cut's list of
     examples, "there's so many different things that we could visually tweak and adjust for taste"). It understands what her editor's
     style panel can change on the sample card — text size, weight, alignment, line spacing, letter spacing, text colour, fill, corner
     radius, padding, border, opacity — on the heading, the line, the button or the card, in common phrasings. EVERY word must come from
     this vocabulary or the whole line gets the one fixed reply, her words: "Visual tweaks only." Replies are fixed strings (property,
     old → new); the visitor's words are never shown, kept or sent. */
  const ACT = {};
  const put = (ws, a) => ws.split(' ').forEach(w => { ACT[w] = a; });
  put('bigger larger big large taller', ['size', 4]); put('huge giant massive enormous', ['size', 12]);
  put('smaller small shorter', ['size', -4]); put('tiny', ['size', -8]); put('size', ['size', 4, 'n']);
  put('bold heavy thick', ['weight', 'to700']); put('bolder heavier thicker', ['weight', 100]); put('thin light', ['weight', 'to300']); put('lighter thinner', ['weight', -100]); put('weight', ['weight', 100, 'n']);
  put('left', ['align', 'left']); put('center centre centered centred middle', ['align', 'centre']); put('right', ['align', 'right']);
  put('tighter tight', ['tight', -1]); put('looser loose', ['tight', 1]); put('wider wide spread', ['letter', 1]); put('narrower', ['letter', -1]);
  put('leading', ['line', 1, 'n']); put('tracking kerning', ['letter', 1, 'n']); put('spacing space', ['space', 1, 'n']);
  put('rounder round rounded curvier curved', ['radius', 6]); put('sharper sharp squarer boxier', ['radius', -6]); put('square', ['radius', 'square']);
  put('pill capsule', ['radius', 'pill']); put('radius corners corner', ['radius', 6, 'n']);
  put('padding', ['pad', 6, 'n']); put('roomier airier spacious', ['pad', 6]); put('cramped compact snug', ['pad', -6]);
  put('border outline outlined stroke bordered', ['border', 1]);
  put('fainter faint faded fade dimmer dim transparent ghostly translucent', ['op', -20]); put('stronger opaque solid vivid crisper', ['op', 20]);
  put('opacity', ['op', 20, 'n']); put('transparency', ['op', -20, 'n']);
  /* every colour word is ITS colour (the wheel reaches any hue now, so "purple" is purple, not the nearest of four); her own inks first */
  const PAL = { ink: '#161a24', black: '#000000', dark: '#161a24', navy: '#1f2f5c', charcoal: '#36393f', grey: '#7a7f88', gray: '#7a7f88',
    cream: '#f4efe6', white: '#ffffff', ivory: '#fbf7ec', beige: '#e6dac3', sand: '#d9c7a3',
    teal: '#47899A', green: '#3f9a5a', turquoise: '#2bb5b0', aqua: '#3cc6d0', cyan: '#1fb3d6', mint: '#8fd6b4', sage: '#9aae8c',
    blue: '#3d6fd6', indigo: '#4b3fb8', cobalt: '#2448b8', sky: '#7cb8ec',
    pink: '#ec6fa0', magenta: '#d12f9e', rose: '#e36a86', purple: '#8a4fd1', violet: '#7a4fe0', lilac: '#b9a2e3', fuchsia: '#e03fc0',
    terracotta: '#C9683B', clay: '#C9683B', red: '#d63a2f', orange: '#ec8a2c', rust: '#b5502a', coral: '#f0745e', brown: '#7a4e2f',
    peach: '#f5b08a', yellow: '#efc531', gold: '#cfa23a' };
  const CW = {}; Object.keys(PAL).forEach(w => { CW[w] = w; });
  const TGT = { heading: 0, title: 0, headline: 0, name: 0, header: 0, line: 1, paragraph: 1, sentence: 1, subline: 1, copy: 1, body: 1,
    button: 2, cta: 2, link: 2, card: 3, box: 3, container: 3 };
  const NEG = new Set('less reduce decrease lower down fewer no remove without off none minus drop'.split(' '));
  const FILL = new Set(('make it its s the a an bit little tad please more and to much slightly some lot can you colour color font go turn set align aligned '
    + 'than with in on this that be everything all text words letters letter characters very really super extra way give add put up increase raise '
    + 'bump higher of i want would like could should change into as is it’s fill background bg height line').split(' '));
  const NO = 'Visual tweaks only.';
  function chat(raw, root, sel, pick) {
    const t = String(raw).slice(0, 80).toLowerCase();
    if (!t.trim() || /[^a-z\s'’,.!?-]/.test(t)) return [NO];
    const w = t.split(/[\s,.!?'’-]+/).filter(Boolean);
    const has = re => w.some(x => re.test(x));
    // which words mean what, from context (so "line spacing" is a property, not the line)
    const letterCx = has(/^(letter|letters|characters|tracking|kerning)$/);
    const lineCx = w.some((x, i) => x === 'line' && /^(spacing|height|heights)$/.test(w[i + 1] || '')) || has(/^leading$/);
    const fillCx = has(/^(fill|background|bg)$/), textCx = has(/^(text|font|words)$/), padCx = has(/^(padding|space|roomier|airier|spacious|cramped|compact|snug)$/);
    const acts = [], nouns = []; let tg = null, neg = false;   // nouns ("padding", "line spacing") only count when no word already says which way
    for (let i = 0; i < w.length; i++) {
      const x = w[i];
      if (x === 'line' && /^(spacing|height|heights)$/.test(w[i + 1] || '')) { nouns.push(['line', neg ? -1 : 1]); neg = false; i++; continue; }
      if (x in TGT && !(x === 'line' && lineCx)) { tg = TGT[x]; continue; }
      if (x in CW) { acts.push(['col', CW[x]]); continue; }
      if (NEG.has(x)) { neg = true; continue; }
      if (x in ACT) {
        let [k, v, isNoun] = ACT[x];
        if (k === 'tight' || k === 'space') { k = letterCx ? 'letter' : lineCx ? 'line' : (padCx || k === 'space') ? 'pad' : 'line'; if (k === 'pad') v *= 6; }
        if (k === 'letter' && !letterCx && lineCx) k = 'line';
        if (neg && typeof v === 'number') v = -v;
        if (neg && /^to/.test(v)) v = v === 'to700' ? -100 : 100;   // "less bold"
        if (k === 'border' && neg) v = 0;
        (isNoun ? nouns : acts).push([k, v]); neg = false; continue;
      }
      if (!FILL.has(x)) return [NO];
    }
    nouns.forEach(n => { if (!acts.some(a => a[0] === n[0])) acts.push(n); });
    if (!acts.length) return [NO];
    const its = root.querySelectorAll('.ed-it:not(.ed-pic)'), card = root.querySelector('.ed-card'), cs = el => getComputedStyle(el);
    const el = i => (its[i] && !its[i].hidden) ? its[i].querySelector('.ed-t') : null;
    if (tg !== null && tg < 3 && el(tg)) sel = pick(el(tg));
    if (!sel) sel = pick([...root.querySelectorAll('.ed-it:not([hidden]) .ed-t')][0] || null);
    const box = tg === 3 ? card : (tg !== null && el(tg)) || card;   // radius / padding / border / fill: the named element, else the card
    const txt = tg === 3 ? sel : sel;
    const out = [], px = v => Math.round(parseFloat(v) || 0), name = (e, k, d) => e.dataset[k] || d;
    for (const [k, v] of acts) {
      if (k === 'size' && txt) { const a = px(cs(txt).fontSize), b = Math.max(10, Math.min(56, a + v)); txt.style.fontSize = b + 'px'; out.push(`Text size ${a} → ${b}px`); }
      else if (k === 'weight' && txt) { const a = +cs(txt).fontWeight, b = v === 'to700' ? Math.max(a, 700) : v === 'to300' ? Math.min(a, 300) : Math.max(200, Math.min(800, a + v)); txt.style.fontWeight = b; out.push(`Weight ${a} → ${b}`); }
      else if (k === 'align') { const a = name(card, 'al', 'left'); card.style.alignItems = { left: 'flex-start', centre: 'center', right: 'flex-end' }[v]; card.style.textAlign = v === 'centre' ? 'center' : v; card.dataset.al = v; out.push(`Alignment ${a} → ${v}`); }
      else if (k === 'line' && txt) { const f = parseFloat(cs(txt).fontSize), a = Math.round(parseFloat(cs(txt).lineHeight) / f * 100) / 100 || 1.2, b = Math.round(Math.max(.9, Math.min(2.4, a + .15 * v)) * 100) / 100; txt.style.lineHeight = b; out.push(`Line spacing ${a} → ${b}`); }
      else if (k === 'letter' && txt) { const a = px(cs(txt).letterSpacing), b = Math.max(-2, Math.min(10, a + v)); txt.style.letterSpacing = b + 'px'; out.push(`Letter spacing ${a} → ${b}px`); }
      else if (k === 'radius') { const a0 = px(cs(box).borderTopLeftRadius), a = a0 > 60 ? 'pill' : a0 + 'px';
        const b = v === 'pill' ? 999 : v === 'square' ? 0 : Math.max(0, Math.min(48, Math.min(a0, 40) + v)); box.style.borderRadius = b + 'px'; out.push(`Corner radius ${a} → ${b > 60 ? 'pill' : b + 'px'}`); }
      else if (k === 'pad') { const a = px(cs(box).paddingTop), b = Math.max(0, Math.min(56, a + v)); box.style.padding = b + 'px'; out.push(`Padding ${a} → ${b}px`); }
      else if (k === 'border') { const a = px(cs(box).borderTopWidth), b = v > 0 ? 2 : 0; box.style.border = b ? '2px solid currentColor' : '0'; if (box === card) box.style.color = 'var(--ink)'; out.push(`Border ${a} → ${b}px`); }
      else if (k === 'op' && txt) { const a = Math.round(+cs(txt).opacity * 100), b = Math.max(20, Math.min(100, a + v)); txt.style.opacity = b / 100; out.push(`Opacity ${a} → ${b}%`); }
      else if (k === 'col') {
        const toFill = fillCx || (!textCx && tg !== null && (tg === 2 || tg === 3));
        if (toFill) { const e = tg === null ? card : box, a = name(e, 'fn', 'default'); e.style.background = PAL[v]; e.dataset.fn = v; out.push(`Fill ${a} → ${v}`); }
        else if (txt) { const a = name(txt, 'cn', 'default'); txt.style.color = PAL[v]; txt.dataset.cn = v; txt.dataset.c = ''; out.push(`Text colour ${a} → ${v}`); }
      }
    }
    return out.length ? out : [NO];
  }
  /* rgb → [hue (null when grey), strength, lightness]: the wheel + Lightness are exactly hsl(), so ANY colour (her ink, white, a teal
     the chat set) lands on its true spot and the handle shows exactly what the text is */
  const toHSL = ([R, G, B]) => { const r = R / 255, g = G / 255, b = B / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    if (!d) return [null, 0, l];
    const h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [h * 60, Math.min(1, d / (1 - Math.abs(2 * l - 1))), l]; };
  function editor(host, first) {
    host.innerHTML = ED;
    const root = host.firstElementChild;   // fresh listeners per open / RESET (the stage is reused, so never stack them on it)
    const card = root.querySelector('.ed-card'), p = root.querySelector('.ed-p'), rows = p.querySelector('.ed-rows'), ph = p.querySelector('.ed-ph');
    let sel = null, wh = null, lt = null;   // sel: a text (.ed-t) or the card
    const kind = t => t === card ? 'card' : t.classList.contains('ed-b') ? 'button' : 'text';
    const label = t => !t ? 'Nothing selected' : t === card ? 'Card' : t.classList.contains('ed-b') ? 'Button' : t.tagName === 'H3' ? 'Heading' : 'Text';
    /* the taste-slider rows for each kind of element: [label, key, min, max, step] (colour rows have no range) */
    const TXT = [['Text size (px)', 'fs', 10, 56, 1], ['Weight', 'fw', 300, 800, 100], ['Text colour', 'tc'], ['Lightness', 'tl', 0, 100, 1]];
    const SPEC = { text: TXT, button: TXT.concat([['Corner radius (px)', 'br', 0, 30, 1]]),
      card: [['Corner radius (px)', 'br', 0, 48, 1], ['Padding (px)', 'pad', 4, 56, 1], ['Card fill', 'cf']] };
    const rgbOf = s => s.match(/[\d.]+/g).slice(0, 3).map(Number);
    const showL = c => { if (!lt) return; lt.style.setProperty('--tc', `rgb(${c})`); lt.style.setProperty('--lt', `linear-gradient(90deg,#000,rgb(${wh.colorAt(wh.h, wh.r, .5)}),#fff)`); };
    const sw = () => rows.querySelector('.ed-sw');
    function build() {
      const k = sel ? kind(sel) : 'text';
      ph.textContent = label(sel); p.classList.toggle('off', !sel);
      rows.innerHTML = SPEC[k].map(([l, key, a, b, st]) => /^(tc|cf)$/.test(key)
        ? `<span>${l}</span><i class="ed-sw" aria-hidden="true"></i><div class="ed-w"></div>`
        : `<span>${l}</span><input type="range" min="${a}" max="${b}" step="${st}" data-k="${key}" aria-label="${l}"${key === 'tl' ? ' class="ed-ltr"' : ''}><input class="ed-n" type="number" min="${a}" max="${b}" step="${st}" data-k="${key}" aria-label="${l}, value" inputmode="numeric">`).join('');
      lt = rows.querySelector('.ed-ltr'); wh = null;
      const wEl = rows.querySelector('.ed-w');
      if (k === 'card') {   // the taste sliders' Card fill: centre = the card's own colour, rim = every hue at full strength
        wEl.style.color = getComputedStyle(root).getPropertyValue('--card').trim() || '#fff';
        wh = window.tasteWheel(wEl, { h: +(card.dataset.wh || 35), r: +(card.dataset.wr || 0), base: 'ink', label: 'Card fill',
          change: c => { card.style.background = `rgb(${c})`; card.dataset.wh = wh.h; card.dataset.wr = wh.r; delete card.dataset.fn; sw().style.background = `rgb(${c})`; } });
      } else if (wEl) {
        wh = window.tasteWheel(wEl, { h: 220, r: 0, l: .1, label: 'Text colour', change: c => { if (sel) sel.style.color = `rgb(${c})`; sw().style.background = `rgb(${c})`; showL(c); } });
      }
      rows.querySelectorAll('input').forEach(i => { i.disabled = !sel; });
      rows.querySelectorAll('input[type=range]').forEach(i => { if (window.tasteSquish) window.tasteSquish(i, { axis: 'x' }); i.addEventListener('pointerdown', () => i.classList.add('held')); ['pointerup', 'pointercancel', 'lostpointercapture', 'blur'].forEach(t => i.addEventListener(t, () => i.classList.remove('held'))); });
      sync();
    }
    const get = key => { const cs = getComputedStyle(key === 'pad' ? card : sel);
      return key === 'fs' ? Math.round(parseFloat(cs.fontSize)) : key === 'fw' ? +cs.fontWeight : key === 'br' ? Math.min(+(sel === card ? 48 : 30), Math.round(parseFloat(cs.borderTopLeftRadius))) : key === 'pad' ? Math.round(parseFloat(cs.paddingTop)) : key === 'tl' ? Math.round(wh.l * 100) : 0; };
    function sync() {
      if (!sel) return;
      if (wh && sel !== card) { const [h, st, l] = toHSL(rgbOf(getComputedStyle(sel).color)); wh.setL(l, true); const c = wh.set(h == null ? wh.h : h, st, true); sw().style.background = `rgb(${c})`; showL(c); }
      if (wh && sel === card) { const c = card.style.background ? rgbOf(getComputedStyle(card).backgroundColor) : wh.set(wh.h, wh.r, true);
        if (card.dataset.fn) { const [h, st] = toHSL(c); wh.set(h == null ? wh.h : h, st, true); }   // a colour the chat set: the handle goes to its hue
        sw().style.background = `rgb(${c})`; }
      rows.querySelectorAll('[data-k]').forEach(i => { const v = get(i.dataset.k); if (document.activeElement !== i || i.type === 'range') i.value = v;
        if (i.type === 'range') i.style.setProperty('--f', ((v - i.min) / (i.max - i.min)).toFixed(4)); });
    }
    function apply(key, v) {
      if (!sel) return;
      if (key === 'fs') sel.style.fontSize = v + 'px'; else if (key === 'fw') sel.style.fontWeight = v;
      else if (key === 'br') sel.style.borderRadius = v + 'px'; else if (key === 'pad') card.style.padding = v + 'px';
      else if (key === 'tl' && wh) wh.setL(v / 100);
      sync();
    }
    rows.addEventListener('input', e => { const i = e.target.closest('[data-k]'); if (!i) return; const v = +i.value; if (i.value === '' || isNaN(v)) return;
      apply(i.dataset.k, Math.max(+i.min, Math.min(+i.max, v))); });
    rows.addEventListener('focusin', e => { if (e.target.classList.contains('ed-n')) setTimeout(() => e.target.select(), 0); });   // like Figma: click a number, it's all selected, type the new one
    rows.addEventListener('change', e => { if (e.target.classList.contains('ed-n')) sync(); });   // a typed number out of range snaps back to what was applied
    const select = t => { root.querySelectorAll('.ed-it.sel').forEach(i => i.classList.remove('sel')); card.classList.toggle('sel', t === card); sel = t; if (t && t !== card) t.parentNode.classList.add('sel'); build(); };
    const done = t => { if (t.isContentEditable) { t.contentEditable = 'false'; if (!t.textContent.trim() && t.dataset.added) { const it = t.parentNode; if (sel === t) select(null); it.remove(); } } };
    const edit = (t, e) => {
      if (t.isContentEditable) return;
      t.contentEditable = 'true'; t.focus();
      const r = e && document.caretRangeFromPoint && document.caretRangeFromPoint(e.clientX, e.clientY), s = getSelection();
      if (r && t.contains(r.startContainer)) { s.removeAllRanges(); s.addRange(r); } else { s.selectAllChildren(t); s.collapseToEnd(); }
    };
    const addText = () => {   // "add copy": a new line on the card, ready to type into
      const it = document.createElement('div'); it.className = 'ed-it';
      it.innerHTML = '<p class="ed-t" tabindex="0" data-added="1"></p><button type="button" class="ed-x" aria-label="Delete">✕</button>';
      card.appendChild(it); const t = it.firstChild; select(t); edit(t);
    };
    root.addEventListener('click', e => {
      const x = e.target.closest('.ed-x');
      if (x) { const it = x.parentNode; if (sel && it.contains(sel)) select(null); it.hidden = true; return; }
      if (e.target.closest('.ed-r')) { editor(host); host.querySelector('.ed-r').focus(); return; }
      if (e.target.closest('.ed-a')) { addText(); return; }
      const t = e.target.closest('.ed-t');
      if (t) { if (t === sel) edit(t, e); else { root.querySelectorAll('.ed-t').forEach(done); select(t); } return; }
      if (e.target.closest('.ed-card')) { root.querySelectorAll('.ed-t').forEach(done); select(card); }   // the card itself (its fill, the plane, the space round things)
    });
    root.addEventListener('dblclick', e => { const t = e.target.closest('.ed-t'); if (t) { select(t); edit(t, e); } });
    root.addEventListener('focusout', e => { if (e.target.classList && e.target.classList.contains('ed-t')) done(e.target); });
    root.addEventListener('paste', e => { if (e.target.closest('.ed-t')) { e.preventDefault(); document.execCommand('insertText', false, (e.clipboardData || window.clipboardData).getData('text/plain')); } });
    root.addEventListener('keydown', e => {
      const t = e.target.closest && e.target.closest('.ed-t');
      if (!t) return;
      if (t.isContentEditable) { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(t); if (t.isConnected) t.focus(); } return; }
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); t === sel ? edit(t) : select(t); }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && t === sel) { e.preventDefault(); t.parentNode.querySelector('.ed-x').click(); }
    });
    const msgs = root.querySelector('.ed-msgs'), ta = root.querySelector('.ed-ask textarea');
    const send = () => {
      const said = chat(ta.value, root, sel === card ? null : sel, t => { select(t); return t; });
      ta.value = '';   // never kept
      said.forEach(m => { const li = document.createElement('li'); li.textContent = m; msgs.appendChild(li); });
      while (msgs.children.length > 3) msgs.firstChild.remove();   // the last three, whole (never a half-cut bubble)
      msgs.scrollTop = msgs.scrollHeight; sync();
    };
    root.querySelector('.ed-ask').addEventListener('submit', e => { e.preventDefault(); send(); });
    ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
    select(first === 'card' ? card : root.querySelector('.ed-t'));
  }

  /* VIDEO EDITOR — a real editor on her raw zoom-demo recording (Pratu's Kitchen: lineup → SHOP NOW → product page). The camera is NOT
     baked into this clip: the Zoom track IS the camera, applied to the preview live, the way her zoom-demo tool plans it (ease in on the
     click, hold, ease out). Every control works on the real video; nothing is decoration. */
  const FPS = 30, NT = 27, TW = 67;   // strip: 27 frames of the raw clip, a tile every 0.2 s; lane tiles are 67 x 50 (4:3)
  const MARKS = [[1.5, 'Hover'], [2.5, 'Click'], [3.15, 'New page']];   // from her recording's log (source seconds)
  const EASE = { smooth: k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2, snappy: k => 1 - Math.pow(1 - k, 4), linear: k => k };
  const tc = t => { const f = Math.round(Math.max(0, t) * FPS), p = n => String(n).padStart(2, '0'); return `${p(Math.floor(f / 1800))}:${p(Math.floor(f / FPS) % 60)}:${p(f % FPS)}`; };
  const IC = { play: '<path d="M4 2.5v11l9.5-5.5z"/>', pause: '<path d="M3.5 2.5h3.2v11H3.5zM9.3 2.5h3.2v11H9.3z"/>', start: '<path d="M2.5 2.5h2v11h-2zM14 2.5v11L5.5 8z"/>',
    end: '<path d="M11.5 2.5h2v11h-2zM2 2.5v11L10.5 8z"/>', back: '<path d="M2.5 3h2v10h-2zM13.5 3v10L6 8z"/>', fwd: '<path d="M11.5 3h2v10h-2zM2.5 3v10L10 8z"/>' };
  const ic = k => `<svg viewBox="0 0 16 16" aria-hidden="true">${IC[k]}</svg>`;
  let vxKey = null;
  function video(root) {
    root.innerHTML = `<div class="vx" tabindex="-1" style="--strip:url(${A}zoom-demo-raw-strip.jpg)">
<div class="vx-mon"><div class="vx-view"><video src="${A}zoom-demo-raw.mp4" poster="${A}zoom-demo-click.jpg" muted playsinline preload="auto" aria-label="Preview: a visitor on Pratu's Kitchen clicks SHOP NOW"></video></div><span class="vx-zl"></span></div>
<aside class="vx-insp" aria-live="polite"></aside>
<div class="vx-bar">
 <div class="vx-g"><button type="button" class="vx-b i" data-a="start" aria-label="Go to start">${ic('start')}</button><button type="button" class="vx-b i" data-a="back" aria-label="Back one frame">${ic('back')}</button><button type="button" class="vx-b vx-play" data-a="play" aria-label="Play">${ic('play')}</button><button type="button" class="vx-b i" data-a="fwd" aria-label="Forward one frame">${ic('fwd')}</button><button type="button" class="vx-b i" data-a="end" aria-label="Go to end">${ic('end')}</button>
 <span class="vx-tc" aria-label="Time"><b></b> <span></span></span></div>
 <div class="vx-g"><button type="button" class="vx-b" data-a="split">SPLIT</button><button type="button" class="vx-b" data-a="zoom">ADD ZOOM</button><button type="button" class="vx-b" data-a="del">DELETE</button></div>
 <div class="vx-g"><button type="button" class="vx-b" data-a="undo">UNDO</button><button type="button" class="vx-b" data-a="redo">REDO</button></div>
 <span class="vx-sp"></span>
 <div class="vx-g vx-zg"><button type="button" class="vx-b i" data-a="out" aria-label="Zoom timeline out">−</button><input class="vx-zm" type="range" min="0" max="1" step=".001" value="0" aria-label="Timeline zoom"><button type="button" class="vx-b i" data-a="in" aria-label="Zoom timeline in">+</button></div>
</div>
<div class="vx-tl"><div class="vx-heads"><span style="top:52px">Video</span><span style="top:101px">Zoom</span><span style="top:131px">Clicks</span></div>
 <div class="vx-sc"><div class="vx-cv"><div class="vx-ruler"></div><div class="vx-lane vx-lv"></div><div class="vx-lane vx-lz"></div><div class="vx-lane vx-lc"></div>
 <span class="vx-hv"></span><span class="vx-snap"></span><div class="vx-ph"><i role="slider" tabindex="0" aria-label="Playhead"></i></div></div></div></div>
<div class="vx-keys"><span><kbd>Space</kbd>Play</span><span><kbd>J</kbd><kbd>K</kbd><kbd>L</kbd>Shuttle</span><span><kbd>Left</kbd><kbd>Right</kbd>Frame</span><span><kbd>S</kbd>Split</span><span><kbd>Z</kbd>Add zoom</span><span><kbd>⌫</kbd>Delete</span><span><kbd>⌘Z</kbd>Undo</span><span><kbd>⇧⌘Z</kbd>Redo</span><span><kbd>+</kbd><kbd>−</kbd>Timeline zoom</span></div></div>`;
    const $ = s => root.querySelector(s), vxr = $('.vx'), v = $('video'), view = $('.vx-view'), mon = $('.vx-mon'), zl = $('.vx-zl'), insp = $('.vx-insp');
    const sc = $('.vx-sc'), cv = $('.vx-cv'), ruler = $('.vx-ruler'), lv = $('.vx-lv'), lz = $('.vx-lz'), lc = $('.vx-lc'), ph = $('.vx-ph'), knob = $('.vx-ph i'), hv = $('.vx-hv'), snapL = $('.vx-snap');
    const btn = a => $(`[data-a="${a}"]`), zm = $('.vx-zm'), tcB = $('.vx-tc b'), tcS = $('.vx-tc span');
    if (window.tasteSquish) { window.tasteSquish(knob, { axis: 'x' }); window.tasteSquish(ruler, { target: knob, axis: 'x' }); window.tasteSquish(zm, { axis: 'x' }); }
    let SD = 5.4;   // source length; corrected from the file's metadata
    let st = { clips: [{ i: 0, o: SD }], zooms: [{ s: .95, a: .6, h: 1, b: .57, l: 1.8, x: .5, y: .762, e: 'smooth' }] };
    let sel = null, T = 0, cur = 0, playing = 0, shuttle = 0, rate = 1, raf = 0, zf = 0, drag = null;
    const hist = [JSON.stringify(st)]; let hi = 0;
    const X0 = 12, cl = (x, a, b) => Math.max(a, Math.min(b, x));
    const len = c => c.o - c.i, D = () => st.clips.reduce((n, c) => n + len(c), 0);
    const starts = () => { let n = 0; return st.clips.map(c => { const s = n; n += len(c); return s; }); };
    const zEnd = z => z.s + z.a + z.h + z.b;
    const locate = t => { const S = starts(); for (let k = 0; k < st.clips.length; k++) if (t < S[k] + len(st.clips[k]) - 1e-6 || k === st.clips.length - 1) return [k, st.clips[k].i + cl(t - S[k], 0, len(st.clips[k]))]; };
    const toTL = src => { const S = starts(); for (let k = 0; k < st.clips.length; k++) { const c = st.clips[k]; if (src >= c.i - 1e-6 && src <= c.o + 1e-6) return S[k] + src - c.i; } return null; };
    const span = () => Math.max(D(), ...st.zooms.map(zEnd));
    const fit = () => Math.max(20, (sc.clientWidth - X0 * 2) / Math.max(SD, span()));
    let lock = 0; const pps = () => lock || fit() * Math.pow(8, zf);   // the scale holds still while you drag (a trim must not rescale under the pointer)
    const xOf = t => X0 + t * pps(), tOf = cx => (cx - cv.getBoundingClientRect().left - X0) / pps();
    /* the camera at timeline time t: inside a zoom block, ease in → hold → ease out; the window clamps to the frame like her plan.py */
    const cam = t => { for (const z of st.zooms) { if (t < z.s || t > zEnd(z)) continue; const E = EASE[z.e] || EASE.smooth, u = t - z.s;
      const k = u < z.a ? E(u / z.a) : u <= z.a + z.h ? 1 : 1 - E((u - z.a - z.h) / z.b); return { l: 1 + (z.l - 1) * k, x: z.x, y: z.y }; } return { l: 1, x: .5, y: .5 }; };
    const shoot = () => { const c = cam(T), w = 1 / c.l, x0 = cl(c.x - w / 2, 0, 1 - w), y0 = cl(c.y - w / 2, 0, 1 - w);
      view.style.transform = c.l > 1.001 ? `scale(${c.l.toFixed(4)}) translate(${(-x0 * 100).toFixed(3)}%,${(-y0 * 100).toFixed(3)}%)` : '';
      mon.classList.toggle('z', c.l > 1.01); zl.textContent = c.l.toFixed(1) + '×'; };
    /* ---------- drawing ---------- */
    function ticks() {
      const p = pps(), step = [.1, .2, .5, 1, 2, 5].find(s => s * p >= 64) || 5, minor = step / 5, end = span() + step;
      let h = '';
      for (let n = 0; n * minor <= end; n++) { const t = n * minor, L = n % 5 === 0; h += `<i class="${L ? 'L' : ''}" style="left:${xOf(t).toFixed(1)}px"></i>`;
        if (L) h += `<b style="left:${xOf(t).toFixed(1)}px">${step < 1 ? t.toFixed(1) : Math.round(t)}s</b>`; }
      ruler.innerHTML = h;
    }
    function draw() {
      if (!vxr.isConnected) return ro.disconnect();   // the dialog closed: this editor is gone
      const p = pps(), S = starts(), gap = drag && drag.m === 'trimL' ? drag.c.i - drag.i0 : 0;
      cv.style.width = Math.max(sc.clientWidth, X0 * 2 + span() * p + 40, drag ? drag.w0 : 0) + 'px';   // never narrower mid-drag (the view would slide under the pointer)
      ticks();
      lv.innerHTML = st.clips.map((c, k) => {
        const left = xOf(S[k] + (drag && drag.m === 'trimL' && k >= drag.k ? gap : 0)), w = len(c) * p, n = Math.ceil(w / TW);
        let th = ''; for (let j = 0; j < n; j++) { const src = c.i + (j * TW + TW / 2) / p, f = cl(Math.floor(src / SD * NT), 0, NT - 1); th += `<s style="background-position:${-f * TW}px 0"></s>`; }
        return `<div class="vx-clip${sel && sel.k === 'clip' && sel.i === k ? ' sel' : ''}" data-k="${k}" role="button" tabindex="0" aria-label="Clip ${k + 1}, ${tc(c.i)} to ${tc(c.o)}" style="left:${left.toFixed(1)}px;width:${Math.max(2, w).toFixed(1)}px"><div class="th">${th}</div><span class="vx-h l" data-k="${k}" aria-hidden="true"></span><span class="vx-h r" data-k="${k}" aria-hidden="true"></span></div>`;
      }).join('');
      lz.innerHTML = st.zooms.map((z, k) => { const w = (zEnd(z) - z.s) * p, on = sel && sel.k === 'zoom' && sel.i === k;
        const keys = [z.s, z.s + z.a, z.s + z.a + z.h, zEnd(z)].map((t, j) => `<span class="vx-k${Math.abs(t - T) < .5 / FPS ? ' on' : ''}" data-k="${k}" data-j="${j}" style="left:${((t - z.s) * p).toFixed(1)}px" aria-hidden="true"></span>`).join('');
        return `<div class="vx-z${on ? ' sel' : ''}" data-k="${k}" role="button" tabindex="0" aria-label="Zoom ${z.l.toFixed(1)}× from ${tc(z.s)} to ${tc(zEnd(z))}" style="left:${xOf(z.s).toFixed(1)}px;width:${w.toFixed(1)}px"><i class="r a" style="width:${(z.a * p).toFixed(1)}px"></i><i class="r b" style="width:${(z.b * p).toFixed(1)}px"></i><em>${w > 34 ? z.l.toFixed(1) + '×' : ''}</em>${keys}</div>`; }).join('');
      const mx = MARKS.map(m => toTL(m[0]));
      lc.innerHTML = MARKS.map(([s, name], j) => { const t = mx[j]; if (t == null) return ''; const x = xOf(t), nx = mx.slice(j + 1).find(u => u != null), dot = nx != null && xOf(nx) - x < 22 + name.length * 7;   // no room before the next: the dot alone
        return `<span class="vx-m${dot ? ' dot' : ''}" data-t="${t}" title="${name}" aria-label="${name}" style="left:${x.toFixed(1)}px">${name}</span>`; }).join('');
      paint();
    }
    function paint() {
      const d = D(); T = cl(T, 0, d);
      ph.style.left = xOf(T) + 'px';
      tcB.textContent = tc(T); tcS.textContent = '/ ' + tc(d) + (playing && rate !== 1 ? `  ${rate}×` : shuttle ? `  −${rate}×` : '');
      knob.setAttribute('aria-valuenow', T.toFixed(2)); knob.setAttribute('aria-valuetext', tc(T)); knob.setAttribute('aria-valuemax', d.toFixed(2));
      lz.querySelectorAll('.vx-k').forEach(k => { const z = st.zooms[k.dataset.k]; if (!z) return; const t = [z.s, z.s + z.a, z.s + z.a + z.h, zEnd(z)][k.dataset.j]; k.classList.toggle('on', Math.abs(t - T) < .5 / FPS); });
      shoot(); ui();
      if (playing || shuttle) { const x = xOf(T), l = sc.scrollLeft, w = sc.clientWidth; if (x > l + w - 40 || x < l) sc.scrollLeft = x - 60; }
    }
    const canSplit = () => { const [k, src] = locate(T), c = st.clips[k]; return src - c.i > 1.5 / FPS && c.o - src > 1.5 / FPS; };
    /* where ADD ZOOM puts a zoom: at the playhead, 2 s long, shortened (to 1 s at least) or slid back to fit the free stretch */
    const room = t => { const D0 = D(); if (st.zooms.some(z => t >= z.s - 1e-6 && t < zEnd(z))) return null;
      const next = st.zooms.filter(z => z.s >= t).reduce((m, z) => Math.min(m, z.s), D0); let a = t, L = Math.min(2, next - t);
      if (L < 1) { const pe = st.zooms.filter(z => zEnd(z) <= t + 1e-6).reduce((m, z) => Math.max(m, zEnd(z)), 0); a = Math.max(pe, next - 2); L = next - a; }
      return L >= 1 - 1e-6 ? [a, L] : null; };
    function ui() {
      const pl = btn('play'); pl.innerHTML = ic(playing || shuttle ? 'pause' : 'play'); pl.setAttribute('aria-label', playing || shuttle ? 'Pause' : 'Play');
      btn('undo').disabled = hi === 0; btn('redo').disabled = hi >= hist.length - 1;
      btn('split').disabled = !canSplit(); btn('zoom').disabled = !room(T);
      btn('del').disabled = !sel || (sel.k === 'clip' && st.clips.length < 2);
      btn('start').disabled = T <= 0; btn('back').disabled = T <= 0; btn('end').disabled = btn('fwd').disabled = T >= D() - 1e-6;
      zm.value = zf; zm.style.setProperty('--f', zf); btn('out').disabled = zf <= 0; btn('in').disabled = zf >= 1;
    }
    /* ---------- the inspector: what's selected ---------- */
    function inspect() {
      if (insp.contains(document.activeElement)) vxr.focus({ preventScroll: true });   // the panel is about to be rebuilt: keep focus (and the shortcuts) in the editor
      if (sel && sel.k === 'zoom') {
        const z = st.zooms[sel.i], f = cl(Math.floor((z.s + z.a + z.h / 2) / SD * NT), 0, NT - 1);
        insp.innerHTML = `<h4>Zoom</h4><label class="vx-row">Zoom level<output data-o="l"></output><input type="range" min="1.2" max="3" step=".05" data-p="l"></label>
<div class="vx-row">Easing<div class="vx-seg">${['smooth', 'snappy', 'linear'].map(e => `<button type="button" class="vx-b" data-e="${e}">${e.toUpperCase()}</button>`).join('')}</div></div>
<label class="vx-row">Hold<output data-o="h"></output><input type="range" min="0" step=".05" data-p="h"></label>
<div class="vx-row">Aim<div class="vx-aim" role="slider" tabindex="0" aria-label="Camera aim" style="background-image:url(${A}zoom-demo-raw-strip.jpg);background-position:${(f / (NT - 1) * 100).toFixed(3)}% 0"><i></i></div></div>`;
        insp.querySelectorAll('input').forEach(i => { if (window.tasteSquish) window.tasteSquish(i, { axis: 'x' }); });
      } else if (sel && sel.k === 'clip') {
        insp.innerHTML = `<h4>Clip ${sel.i + 1}</h4><div class="vx-row">Starts at<b data-o="cs"></b></div><div class="vx-row">In<b data-o="ci"></b></div><div class="vx-row">Out<b data-o="co"></b></div><div class="vx-row">Length<b data-o="cl"></b></div><p class="vx-note">Drag its edges to trim.</p>`;
      } else {   // the project: the recording's real facts + every clip and zoom (click one to select it and jump there)
        const S = starts();
        insp.innerHTML = `<h4>Project</h4><div class="vx-row">Length<b data-o="pl"></b></div><div class="vx-row">Size<b>${v.videoWidth || 1600} × ${v.videoHeight || 1200}</b></div>
<div class="vx-row">Aspect<b>4:3</b></div><div class="vx-row">Frame rate<b>${FPS} fps</b></div>
<h4>Clips</h4><ol class="vx-list">${st.clips.map((c, k) => `<li><button type="button" class="vx-li" data-sel="clip" data-k="${k}"><i class="c"></i>Clip ${k + 1}<span>${tc(S[k])} · ${tc(len(c))}</span></button></li>`).join('')}</ol>
<h4>Zooms</h4>${st.zooms.length ? `<ol class="vx-list">${st.zooms.map((z, k) => `<li><button type="button" class="vx-li" data-sel="zoom" data-k="${k}"><i></i>${z.l.toFixed(1)}×<span>${tc(z.s)} · ${tc(zEnd(z) - z.s)}</span></button></li>`).join('')}</ol>` : '<p class="vx-note">None</p>'}`;
      }
      vals();
    }
    function vals() {
      const o = k => insp.querySelector(`[data-o="${k}"]`);
      if (sel && sel.k === 'zoom') { const z = st.zooms[sel.i], nx = st.zooms.filter(q => q.s > z.s).reduce((m, q) => Math.min(m, q.s), D());
        const [li, hi2] = insp.querySelectorAll('input'); li.value = z.l; hi2.max = Math.max(z.h, nx - z.s - z.a - z.b).toFixed(2); hi2.value = z.h;
        [li, hi2].forEach(i => i.style.setProperty('--f', ((i.value - i.min) / (i.max - i.min || 1)).toFixed(4)));
        o('l').textContent = z.l.toFixed(2).replace(/0$/, '') + '×'; o('h').textContent = z.h.toFixed(2) + ' s';
        insp.querySelectorAll('[data-e]').forEach(b => { b.classList.toggle('on', b.dataset.e === z.e); b.setAttribute('aria-pressed', b.dataset.e === z.e); });
        const w = 1 / z.l, x0 = cl(z.x - w / 2, 0, 1 - w), y0 = cl(z.y - w / 2, 0, 1 - w), r = insp.querySelector('.vx-aim i');
        Object.assign(r.style, { left: x0 * 100 + '%', top: y0 * 100 + '%', width: w * 100 + '%', height: w * 100 + '%' });
        insp.querySelector('.vx-aim').setAttribute('aria-valuetext', `${Math.round(z.x * 100)}% across, ${Math.round(z.y * 100)}% down`);
      } else if (sel && sel.k === 'clip') { const c = st.clips[sel.i]; o('cs').textContent = tc(starts()[sel.i]); o('ci').textContent = tc(c.i); o('co').textContent = tc(c.o); o('cl').textContent = tc(len(c)); }
      else o('pl').textContent = tc(D());
    }
    const select = s => { sel = s; inspect(); draw(); };
    /* ---------- history ---------- */
    const commit = () => { const j = JSON.stringify(st); if (j === hist[hi]) return; hist.splice(hi + 1); hist.push(j); hi++; if (!sel) inspect(); else vals(); draw(); };
    const restore = () => { st = JSON.parse(hist[hi]); if (sel && !(sel.k === 'clip' ? st.clips : st.zooms)[sel.i]) sel = null; inspect(); seek(T); draw(); };
    const undo = () => { if (hi > 0) { hi--; restore(); } }, redo = () => { if (hi < hist.length - 1) { hi++; restore(); } };
    /* ---------- playback over the edit (trimmed parts are skipped, clips play in order) ---------- */
    function seek(t) { T = cl(t, 0, D()); const [k, src] = locate(T); cur = k; if (Math.abs(v.currentTime - src) > 1e-3) try { v.currentTime = src; } catch (e) { } paint(); }
    function loop(now) {
      raf = 0; if (!root.isConnected) return;   // (every early return leaves raf clear, so the next play restarts the loop)
      const dt = Math.min(.05, (now - (loop.t || now)) / 1000); loop.t = now;
      if (shuttle) { T -= dt * rate; if (T <= 0) { seek(0); stop(); return; } seek(T); }
      else if (playing) {
        let c = st.clips[cur], src = v.currentTime;
        if (src >= c.o - .5 / FPS || v.ended) {
          if (cur + 1 < st.clips.length) { cur++; c = st.clips[cur]; if (Math.abs(v.currentTime - c.i) > 1.5 / FPS) v.currentTime = c.i; src = c.i; if (v.paused) v.play().catch(() => { }); }
          else { T = D(); stop(); paint(); return; }
        }
        T = starts()[cur] + cl(src - c.i, 0, len(c)); paint();
      }
      if (playing || shuttle) raf = requestAnimationFrame(loop);
    }
    const run = () => { if (!raf) { loop.t = 0; raf = requestAnimationFrame(loop); } };
    function play(r) { shuttle = 0; if (T >= D() - 1e-3) seek(0); rate = r || 1; playing = 1; v.playbackRate = rate; v.play().catch(() => { }); run(); paint(); }
    function stop() { playing = 0; shuttle = 0; rate = 1; v.pause(); v.playbackRate = 1; paint(); }
    const toggle = () => playing || shuttle ? stop() : play();
    const step = d => { stop(); seek(Math.round((T + d) * FPS) / FPS); };
    /* ---------- edits ---------- */
    function split() { if (!canSplit()) return; stop(); const [k, src] = locate(T), c = st.clips[k], s = Math.round(src * FPS) / FPS; st.clips.splice(k, 1, { i: c.i, o: s }, { i: s, o: c.o }); sel = null; inspect(); commit(); }
    function addZoom() { const r = room(T); if (!r) return; const [a, L] = r; st.zooms.push({ s: a, a: L / 4, h: L / 2, b: L / 4, l: 1.8, x: .5, y: .5, e: 'smooth' }); st.zooms.sort((p, q) => p.s - q.s);
      sel = { k: 'zoom', i: st.zooms.findIndex(z => z.s === a) }; inspect(); commit(); seek(a + L / 4); }
    function del() {
      if (!sel) return;
      if (sel.k === 'zoom') st.zooms.splice(sel.i, 1);
      else { if (st.clips.length < 2) return; const s = starts()[sel.i], l = len(st.clips[sel.i]); st.clips.splice(sel.i, 1); shift(s, -l, l, s); }
      sel = null; inspect(); commit(); seek(T);
    }
    /* ripple: zooms that start inside a removed stretch go with it; zooms after it close up (or move on, when a clip grows) */
    function shift(at, d, cut, floor) {
      if (cut) st.zooms = st.zooms.filter(z => !(z.s >= at - 1e-6 && z.s < at + cut - 1e-6));
      st.zooms.forEach(z => { if (z.s >= at + (cut || 0) - 1e-6) z.s = Math.max(floor || 0, z.s + d); });
      st.zooms.sort((p, q) => p.s - q.s); for (let n = 1; n < st.zooms.length; n++) st.zooms[n].s = Math.max(st.zooms[n].s, zEnd(st.zooms[n - 1]));   // never overlapping
    }
    const zoomTo = (f, anchorX) => { const ax = anchorX == null ? sc.clientWidth / 2 : anchorX, t = (sc.scrollLeft + ax - X0) / pps(); zf = cl(f, 0, 1); draw(); sc.scrollLeft = X0 + t * pps() - ax; };
    /* ---------- snapping: playhead, clip edges, zoom edges + keyframes, clicks ---------- */
    function snap(t, e, skip) {
      if (e && e.altKey) return t;
      const S = starts(), c = [0, D(), ...S, ...MARKS.map(m => toTL(m[0])).filter(x => x != null)];
      if (!drag || drag.m !== 'scrub') c.push(T);
      st.zooms.forEach((z, k) => { if (k !== skip) c.push(z.s, zEnd(z)); });
      let best = null, bd = 8 / pps(); c.forEach(x => { const d = Math.abs(x - t); if (d < bd) { bd = d; best = x; } });
      if (best == null) return t; snapL.style.left = xOf(best) + 'px'; snapL.style.display = 'block'; return best;
    }
    /* ---------- pointer on the timeline ---------- */
    cv.addEventListener('pointerdown', e => {
      if (e.button) return;
      const h = e.target.closest('.vx-h'), k = e.target.closest('.vx-k'), z = e.target.closest('.vx-z'), c = e.target.closest('.vx-clip'), m = e.target.closest('.vx-m');
      const t = tOf(e.clientX); let d = null;
      if (h) { const i = +h.dataset.k, cc = st.clips[i]; d = { m: h.classList.contains('l') ? 'trimL' : 'trimR', k: i, c: cc, i0: cc.i, o0: cc.o, s0: starts()[i] }; h.classList.add('on'); stop(); if (!(sel && sel.k === 'clip' && sel.i === i)) { sel = { k: 'clip', i }; inspect(); } }
      else if (k || z) { const i = +(k || z).dataset.k, zz = st.zooms[i]; d = { m: k ? 'key' : 'move', j: k ? +k.dataset.j : -1, k: i, z: zz, o: JSON.parse(JSON.stringify(zz)), t0: t, moved: 0 }; if (!(sel && sel.k === 'zoom' && sel.i === i)) { sel = { k: 'zoom', i }; inspect(); } }
      else if (c) { sel = { k: 'clip', i: +c.dataset.k }; inspect(); stop(); seek(t); draw(); return; }
      else if (m) { stop(); seek(+m.dataset.t); return; }
      else { if (e.pointerType !== 'mouse' && !e.target.closest('.vx-ruler, .vx-ph')) { stop(); seek(t); return; } d = { m: 'scrub' }; stop(); if (sel) { sel = null; inspect(); } seek(t); }
      e.preventDefault(); d.w0 = cv.offsetWidth; drag = d; lock = pps(); cv.setPointerCapture(e.pointerId); draw();
    });
    cv.addEventListener('pointermove', e => {
      const t = tOf(e.clientX);
      if (!drag) { if (e.pointerType === 'mouse') { hv.style.left = xOf(Math.max(0, t)) + 'px'; hv.style.display = t >= 0 && t <= span() ? 'block' : 'none'; } return; }
      hv.style.display = 'none'; snapL.style.display = 'none';
      if (drag.m === 'scrub') { seek(snap(t, e)); return; }
      const g = drag;
      if (g.m === 'trimL') { const S0 = g.s0; g.c.i = cl(g.i0 + (snap(S0 + (t - S0), e) - S0), 0, g.c.o - 2 / FPS); }
      else if (g.m === 'trimR') { g.c.o = cl(snap(t, e) - g.s0 + g.c.i, g.c.i + 2 / FPS, SD); }
      else {
        const z = g.z, o = g.o, end0 = zEnd(o), ks = st.zooms.filter(q => q !== z), prev = ks.filter(q => zEnd(q) <= o.s + 1e-6).reduce((a, q) => Math.max(a, zEnd(q)), 0), next = ks.filter(q => q.s >= end0 - 1e-6).reduce((a, q) => Math.min(a, q.s), D());
        if (Math.abs(t - g.t0) * pps() > 3) g.moved = 1; if (!g.moved) return;
        if (g.m === 'move') { const L = end0 - o.s; let s = o.s + t - g.t0; const se = snap(s, e, g.k), ee = snap(s + L, e, g.k); s = se !== s ? se : ee !== s + L ? ee - L : s; z.s = cl(s, prev, Math.max(prev, next - L)); }
        else if (g.j === 0) { z.s = cl(snap(t, e, g.k), prev, end0 - o.a - o.b); z.h = end0 - z.s - o.a - o.b; }
        else if (g.j === 3) { z.h = cl(snap(t, e, g.k), o.s + o.a + o.b, next) - o.s - o.a - o.b; }
        else if (g.j === 1) { z.a = cl(t - o.s, .1, o.a + o.h); z.h = o.a + o.h - z.a; }
        else { z.b = cl(end0 - t, .1, o.b + o.h); z.h = o.b + o.h - z.b; }
        seek(g.j === 1 ? z.s + z.a : g.j === 2 ? zEnd(z) - z.b : g.j === 0 ? z.s : g.j === 3 ? zEnd(z) : T);
      }
      vals(); draw();
    });
    const end = e => {
      if (!drag) return; const g = drag; drag = null; lock = 0; snapL.style.display = 'none'; cv.querySelectorAll('.vx-h.on').forEach(h => h.classList.remove('on'));
      if (g.m === 'trimL') { const dd = g.c.i - g.i0; if (dd) shift(g.s0, -dd, 0, g.s0); seek(g.s0); }
      if (g.m === 'trimR') { const dd = g.c.o - g.o0; if (dd) shift(g.s0 + g.o0 - g.i0, dd); }
      if ((g.m === 'key' || g.m === 'move') && !g.moved) seek(g.m === 'key' ? [g.z.s, g.z.s + g.z.a, g.z.s + g.z.a + g.z.h, zEnd(g.z)][g.j] : g.z.s + g.z.a);   // a click on a zoom shows it zoomed
      commit(); draw();
    };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
    cv.addEventListener('pointerleave', () => { hv.style.display = 'none'; });
    sc.addEventListener('wheel', e => { if (!(e.ctrlKey || e.metaKey)) return; e.preventDefault(); zoomTo(zf - e.deltaY * .004, e.clientX - sc.getBoundingClientRect().left); }, { passive: false });
    zm.addEventListener('input', () => zoomTo(+zm.value));
    /* ---------- the inspector's controls ---------- */
    insp.addEventListener('input', e => { const i = e.target.closest('input'); if (!i || !sel || sel.k !== 'zoom') return; const z = st.zooms[sel.i]; z[i.dataset.p] = +i.value; vals(); draw(); if (cam(T).l < 1.01) seek(z.s + z.a); });
    insp.addEventListener('change', commit);
    insp.addEventListener('click', e => { const li = e.target.closest('.vx-li'); if (li) { const k = +li.dataset.k, isZ = li.dataset.sel === 'zoom'; stop(); select({ k: li.dataset.sel, i: k }); seek(isZ ? st.zooms[k].s + st.zooms[k].a : starts()[k]); return; }
      const b = e.target.closest('[data-e]'); if (b && sel && sel.k === 'zoom') { st.zooms[sel.i].e = b.dataset.e; commit(); const z = st.zooms[sel.i]; stop(); seek(z.s); play(); } });
    const aimAt = e => { const a = insp.querySelector('.vx-aim'), r = a.getBoundingClientRect(), z = st.zooms[sel.i], w = 1 / z.l / 2;
      z.x = cl((e.clientX - r.left) / r.width, w, 1 - w); z.y = cl((e.clientY - r.top) / r.height, w, 1 - w); vals(); if (cam(T).l < 1.01) seek(z.s + z.a); shoot(); };
    insp.addEventListener('pointerdown', e => { if (!e.target.closest('.vx-aim')) return; e.preventDefault(); insp.setPointerCapture(e.pointerId); insp.dataset.aim = 1; aimAt(e); });
    insp.addEventListener('pointermove', e => { if (insp.dataset.aim) aimAt(e); });
    ['pointerup', 'pointercancel'].forEach(t => insp.addEventListener(t, () => { if (insp.dataset.aim) { delete insp.dataset.aim; commit(); } }));
    insp.addEventListener('keydown', e => { if (!e.target.closest('.vx-aim')) return; const d = { ArrowLeft: [-.02, 0], ArrowRight: [.02, 0], ArrowUp: [0, -.02], ArrowDown: [0, .02] }[e.key]; if (!d) return;
      e.preventDefault(); e.stopPropagation(); const z = st.zooms[sel.i], w = 1 / z.l / 2; z.x = cl(z.x + d[0], w, 1 - w); z.y = cl(z.y + d[1], w, 1 - w); vals(); shoot(); commit(); });
    /* ---------- buttons + keys ---------- */
    const ACT = { play: toggle, start: () => { stop(); seek(0); }, end: () => { stop(); seek(D()); }, back: () => step(-1 / FPS), fwd: () => step(1 / FPS), split, zoom: addZoom, del, undo, redo,
      in: () => zoomTo(zf + .2), out: () => zoomTo(zf - .2) };
    vxr.addEventListener('click', e => { const b = e.target.closest('.vx-bar [data-a]'); if (b && ACT[b.dataset.a]) ACT[b.dataset.a](); });
    vxKey = e => {
      const tg = e.target, k = e.key.toLowerCase(), mod = e.metaKey || e.ctrlKey;
      if (tg.closest && tg.closest('textarea, input[type=text]')) return;
      if (tg.matches && tg.matches('input[type=range]') && /^arrow/.test(k)) return;
      if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
      if (mod && k === 'y') { e.preventDefault(); redo(); return; }
      if (mod || e.altKey) return;
      const it = tg.closest && tg.closest('.vx-clip, .vx-z');
      if (k === 'enter' && it) { e.preventDefault(); select({ k: it.matches('.vx-clip') ? 'clip' : 'zoom', i: +it.dataset.k }); return; }
      const f = { ' ': toggle, k: stop, l: () => playing ? play(Math.min(4, rate * 2)) : play(), j: () => { const r = shuttle ? Math.min(4, rate * 2) : 1; playing = 0; v.pause(); shuttle = 1; rate = r; run(); paint(); },
        arrowleft: () => step(e.shiftKey ? -1 : -1 / FPS), arrowright: () => step(e.shiftKey ? 1 : 1 / FPS), home: ACT.start, end: ACT.end, s: split, z: addZoom,
        delete: del, backspace: del, '=': ACT.in, '+': ACT.in, '-': ACT.out }[k];
      if (f) { e.preventDefault(); f(); }
    };
    vxKey.esc = () => sel ? (select(null), true) : false;   // Esc first lets go of the selection, then closes (the dialog's cancel asks this)
    v.addEventListener('loadedmetadata', () => { if (v.duration && Math.abs(v.duration - SD) > .01 && hi === 0) { SD = v.duration; st.clips[0].o = SD; hist[0] = JSON.stringify(st); } if (!sel) inspect(); draw(); });
    v.addEventListener('seeked', shoot);
    const ro = new ResizeObserver(() => draw()); ro.observe(sc);
    inspect(); draw(); seek(0);
    root.vx = { get st() { return st; }, get T() { return T; }, get sel() { return sel; }, seek, play, stop, cam, undo, redo, get hist() { return hist.length + ':' + hi; }, get drag() { return drag && drag.m; } };   // for checks
  }

  function open(id, o) {
    o = o || {}; add();
    from = o.from || document.activeElement; closing = 0;
    dg.querySelector('.td-cap b').textContent = o.name || '';
    dg.querySelector('.td-cap span').textContent = o.line || '';
    stage.className = 'td-stage'; stage.innerHTML = '';
    /* the Taste sliders are part of the Editor now (her 2026-11-23: "the editor and the taste sliders are like the same tool"): a Taste
       sliders tile/card still on a page opens the one Editor with the card (fill, corners, padding) selected */
    if (id === 'editor' || id === 'taste-sliders') editor(stage, id === 'taste-sliders' ? 'card' : null);
    else if (id === 'video-editor') video(stage);
    dg.querySelector('.td-in').classList.toggle('wide', id === 'video-editor');
    dg.classList.remove('in');
    document.documentElement.classList.add('td-lock');
    dg.showModal();
    /* her cursor rides into the top layer (as the gallery's does): the home page's #dc dot, or a drafts page's .cursor ring */
    dc = document.getElementById('dc') || document.querySelector('body > .cursor');
    if (dc) { dcHome = dc.parentNode; dg.appendChild(dc); }
    dg.classList.toggle('td-ring', !!dc && !dc.id && getComputedStyle(dc).display !== 'none');
    dg.querySelector('.td-x').focus();
    if (still()) dg.classList.add('in'); else requestAnimationFrame(() => requestAnimationFrame(() => dg.classList.add('in')));
  }
  function close() {
    if (!dg.open || closing) return; closing = 1;
    dg.classList.remove('in');
    const end = () => { dg.close(); };
    if (still()) end(); else setTimeout(end, 420);
  }
  dg.addEventListener('close', () => {
    closing = 0; dg.classList.remove('in'); stage.innerHTML = ''; vxKey = null;
    if (dc && dcHome) dcHome.appendChild(dc); dc = null;
    document.documentElement.classList.remove('td-lock');
    if (from && from.focus) from.focus({ preventScroll: true });
  });
  /* the dot cursor takes the colour of the colour control it is on (wheel handle / Lightness thumb), live while dragging */
  let tintEl = null;
  const tint = () => { const c = tintEl && (tintEl.matches('.tw') ? tintEl.style.getPropertyValue('--tw-c') : tintEl.style.getPropertyValue('--tc'));
    dg.classList.toggle('td-tint', !!c); if (c) dg.style.setProperty('--td-c', c); };
  /* only ON the knob itself (or while dragging one): over the rest of a wheel or a Lightness track her dot keeps its own blue, or a light
     colour on a light part of the wheel would hide it (the cursor check caught exactly that: 0 px painted) */
  const onKnob = e => { const k = e.target.closest('.tw-k'); if (k) return k.closest('.tw'); const i = e.target.closest('input.ed-ltr'); if (!i) return null;
    const r = i.getBoundingClientRect(), cx = r.left + 11 + (r.width - 22) * (i.value - i.min) / (i.max - i.min); return Math.abs(e.clientX - cx) <= 12 ? i : null; };
  dg.addEventListener('pointermove', e => { if (!e.buttons) tintEl = onKnob(e); tint(); });
  dg.addEventListener('pointerdown', e => { tintEl = e.target.closest('.tw, input.ed-ltr'); tint(); });
  dg.addEventListener('pointerup', e => { tintEl = onKnob(e); tint(); });
  dg.addEventListener('input', tint);
  document.addEventListener('keydown', e => { if (dg.open && vxKey && stage.querySelector('.vx')) vxKey(e); });   // the video editor's shortcuts, wherever focus is (even when a rebuilt panel dropped it)
  dg.addEventListener('cancel', e => { e.preventDefault(); if (vxKey && vxKey.esc && stage.querySelector('.vx') && vxKey.esc()) return; close(); });   // Esc eases out too
  dg.addEventListener('click', e => { if (e.target === dg || e.target.closest('.td-x')) close(); });
  window.toolDemo = { open, close };
})();
