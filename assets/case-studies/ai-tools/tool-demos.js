/* TRY-IT DEMOS for "My AI tools" (her 2026-11-23: "when you click on the AI tools, I want you to be able to demo each tool ... that's the
   whole point"; and "this is a product demo ... very chiseled out demos of the product for people to walk through and use").
   - EDITOR (the Taste sliders folded in, her 2026-11-23: "the editor and the taste sliders are like the same tool"): her sample card (her
     site.json words + her clay paper plane). Hover for the ✕, click a text / the card and the panel shows its taste-slider rows
     (label, slider, number field; colour = a folded row that opens to the wheel); click again / double-click to type; the PLANE is
     selectable too (size + colour); ADD TEXT adds copy; RESET; the CHAT is an ALLOW-LIST: fixed replies, "Visual tweaks only.", nothing kept or sent.
   - VIDEO EDITOR: a real editor on her raw zoom-demo recording (see video() below).
   window.toolDemo.open(id, {name, line, from}). Native <dialog>: Esc, focus trap; ✕ / outside click close; focus goes back to `from`.
   The page behind is blurred under a wash (on ::backdrop, like her gallery); her cursor rides INTO the dialog so it never disappears;
   held knobs SQUISH (window.tasteSquish, taste-sliders.js); Full motion for everyone (the OS Reduce Motion setting is ignored, 2026-11-25). No network, ever. */
(function () {
  if (window.toolDemo) return;
  const A = (document.currentScript && document.currentScript.src || '').replace(/[^/]*$/, '') || 'assets/case-studies/ai-tools/';
  const still = () => !!(document.body && document.body.classList.contains('rm-mode'));   // only the site's own rm-mode; the OS Reduce Motion setting is ignored (her 2026-11-25 full-motion rule)
  const css = document.createElement('style');
  css.textContent = `
.td{--bg:#fbfaf7;--tile:#e9e8e3;--card:#fff;--ink:#161a24;--mut:#4f5866;--line:rgba(22,26,36,.16);--ac:#6a91de;--on-ac:#161a24;
  position:fixed;inset:0;width:100%;height:100%;max-width:none;max-height:none;margin:0;padding:16px;box-sizing:border-box;border:0;
  background:transparent;color:var(--ink);overflow:auto;opacity:0;transition:opacity .4s ease;font-family:'Plus Jakarta Sans',system-ui,sans-serif}
.td[open]{display:flex}.td.in{opacity:1}
/* the blur + wash live on ::backdrop, like her gallery's. NOT on the dialog: a backdrop-filter on the dialog made it the containing block
   for her position:fixed dot cursor, so the dot drifted with the dialog's scroll and vanished (her 2026-11-23 "the cursor cannot keep
   disappearing in all the demos") */
.td::backdrop{background:rgba(250,250,248,.55);-webkit-backdrop-filter:blur(24px);backdrop-filter:blur(24px);opacity:0;transition:opacity .4s ease}
.td.in::backdrop{opacity:1}
html[data-theme=night] .td::backdrop,html[data-look=dark] .td::backdrop{background:rgba(12,13,16,.62)}
html[data-theme=night] .td,html[data-look=dark] .td{--bg:#121418;--tile:#1b1e24;--card:#23272e;--ink:#f3f4f6;--mut:#a9adb7;--line:rgba(243,244,246,.18);--xb:rgba(255,255,255,.12);--ac:#8fb2f2;--on-ac:#121418}
/* ONE calm accent, the site's own (her 2026-11-24: "match the colors of my website ... the pink is not doing it for me. The pink and the
   yellow, it's very in my face"; then "can you use a lighter blue"): by day #6a91de, the lightest of her blues that still holds 3:1 on the
   white panels (3.13:1; her ink on it 5.56:1, white on it only 3.13:1, so the ✕ and zoom labels are ink); by night her moon blue #8fb2f2 */
body.dc-on dialog.td[open],body.dc-on dialog.td[open] *,dialog.td.td-ring[open],dialog.td.td-ring[open] *{cursor:none!important}   /* her cursor is the cursor here too: it rides into the dialog (home: the #dc dot; the drafts pages: their .cursor ring) */
/* ONE SURFACE, her gallery's (her 2026-11-23: "doesn't look like it was intentionally designed ... not designed in my design system";
   "especially the difference in the photo labels"): no card inside a card. The demo sits straight on the blurred page like a print on
   the gallery's desk, the ✕ is the gallery's .dg-x (44px, 20px in from the top-right corner of the screen), and the caption is the
   gallery's .dg-cap to the pixel: 13px/500 capitals eyebrow in her blue, 22px/600 name, 16px/300 line, on the 86% cream panel, 12px/18px, r12 */
.td-in{margin:auto;width:min(960px,100%);padding:56px 0 8px;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;gap:22px;transform:translateY(12px);transition:transform .45s cubic-bezier(.2,.7,.2,1)}
.td.in .td-in{transform:none}
/* CLOSE = it DROPS out of view (her 2026-11-24: "when the demo get x-ed out can they drop down out of view rather than just snap out"): ✕, Esc
   and a click outside all fall the same way: ease-in (it gathers speed) for .5s, past the screen's bottom edge (--drop, measured in close()),
   fading only in the last .18s; the wash and the ✕ fade as it goes. Reduce Motion: a .2s fade (at the end of this sheet). */
.td.out .td-in{transform:translateY(var(--drop,100vh));opacity:0;transition:transform .5s cubic-bezier(.55,0,.85,.4),opacity .18s ease .32s}
.td.out::backdrop{opacity:0}.td.out .td-x,.td.out::before{opacity:0;transition:opacity .25s ease}
.td-in.wide{width:min(1120px,100%)}   /* the demos need the room of a real editor */
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
@media (pointer:coarse){.td input:not([type=range]),.td textarea{font-size:16px!important}}   /* iPhones zoom into a text box under 16px: the page jumps and the cursor draws in the wrong place (her 2026-11-24) */
.td .td-x:focus-visible{outline:none;box-shadow:0 0 0 2px var(--bg),0 0 0 3.5px var(--ink)}.td:focus{outline:none}
html.td-lock{overflow:hidden}
/* editor = ONE tool with the taste sliders folded in (her 2026-11-23: "the editor and the taste sliders are like the same tool ... take a
   lot of the UI from the taste sliders and put it into the editor styling ... add copy ... combine it together"): her sample card (her
   words + her clay paper plane) on the left; click anything and the panel shows THAT element's properties as taste-slider rows (label,
   slider, number field you can type into; colour = the wheel + swatch); click again / double-click to type; ADD TEXT adds copy; ✕ deletes */
.ed{display:grid;grid-template-columns:minmax(0,1fr) 340px;grid-template-areas:"card panel" "chat panel";grid-template-rows:1fr auto;gap:20px;padding:24px;align-items:start}
.ed-card{grid-area:card;align-self:center;background:var(--card);border-radius:14px;padding:28px;display:flex;flex-direction:column;align-items:flex-start;gap:14px;min-height:150px;cursor:pointer;outline-offset:4px}
@media (hover:hover){.ed-card:hover{outline:1.5px dashed var(--ac)}}   /* touch: no sticky hover outline after a tap */
.ed-card.sel{outline:2px solid var(--ac)}
.ed-it{position:relative;max-width:100%}.ed-it[hidden]{display:none}
.ed-pic img{display:block;width:120px;height:auto;pointer-events:none}
/* the plane is selectable like the words (her 2026-11-24: "I want to be able to click the airplane and then change the color of it"): its
   colour is a multiply layer cut to the plane's own outline, so the clay's light and shadow stay (white = untouched) */
.ed-pic{cursor:pointer;border-radius:6px;outline-offset:4px;isolation:isolate}
.ed-pic:focus-visible{outline:1.5px dashed var(--ac)}@media (hover:hover){.ed-pic:hover{outline:1.5px dashed var(--ac)}}
.ed-pic.sel{outline:2px solid var(--ac)}
.ed-pic::after{content:'';position:absolute;inset:0;background:var(--pc,#fff);mix-blend-mode:multiply;-webkit-mask:var(--pm) center/100% 100% no-repeat;mask:var(--pm) center/100% 100% no-repeat;pointer-events:none}
.ed-pic .ed-x{z-index:1}
.ed-t{display:block;margin:0;cursor:pointer;border-radius:3px;outline-offset:3px;color:var(--ink);min-width:2ch}
.ed-t:hover,.ed-t:focus-visible{outline:1.5px dashed var(--ac)!important;outline-offset:3px}
.ed-it.sel .ed-t{outline:2px solid var(--ac)!important}
.ed-t[contenteditable=true]{cursor:text;caret-color:var(--ac)}
.ed-t:empty::before{content:'Type here';color:var(--mut)}
h3.ed-t{font:700 30px/1.15 'Plus Jakarta Sans',system-ui,sans-serif}
p.ed-t{font:300 16px/1.5 'Plus Jakarta Sans',system-ui,sans-serif;max-width:34ch}
.ed-t.ed-b{display:inline-block;padding:11px 20px;border-radius:999px;background:var(--ink);color:var(--card);font:600 13px/1 'Plus Jakarta Sans',system-ui,sans-serif;letter-spacing:.08em}
.ed-x{position:absolute;top:-12px;right:-12px;width:24px;height:24px;border-radius:50%;border:0;padding:0;background:var(--ac);color:var(--on-ac);font:700 13px/24px system-ui,sans-serif;text-align:center;cursor:pointer;opacity:0;pointer-events:none;transition:opacity .2s ease}
.ed-x::before{content:'';position:absolute;inset:-10px}
.ed-x svg{display:block;width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round}   /* a drawn ✕ (her rule: icons are drawn shapes, never font characters): the glyph sat .7px low on phones (icon audit 2026-11-25) */
.ed-it:hover .ed-x,.ed-it.sel .ed-x,.ed-it:focus-within .ed-x{opacity:1;pointer-events:auto}
.ed-p{grid-area:panel;background:var(--card);border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:14px;font:500 13px/1.3 'Plus Jakarta Sans',system-ui,sans-serif;transition:opacity .3s ease;min-width:0}
.ed-p.off .ed-rows{opacity:.45;pointer-events:none}
.ed-ph{margin:0;font:600 13px/1.3 'Plus Jakarta Sans',system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:var(--mut)}
/* the taste sliders' rows: label | control | value (a number field you can type in, or the colour's swatch) */
.ed-rows{display:grid;grid-template-columns:max-content minmax(0,1fr) max-content;grid-auto-flow:row dense;column-gap:12px;row-gap:12px;align-items:center}
.ed-rows>span{color:var(--mut)}
.ed-row{display:contents}.ed-chips{display:none}
@media (max-width:700px){
/* the chips row (her 2026-11-24: "I don't like when things ... are disappearing from the edges ... padding so you can pull it extra ...
   springs back"): it runs to the sheet's edges, the first and last chip sit 16px in (spacers, since WebKit drops a flex scroller's end
   padding), the edge with chips hidden past it fades in as you scroll (0 → 28px, set from the scroll position, so it never pops), and
   nothing here blocks the native elastic pull (no overscroll-behavior, no touch-action, no JS on touch): it stretches and springs back */
.ed-chips{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;margin:0 -16px;padding:2px 0;
  -webkit-mask-image:linear-gradient(90deg,transparent,#000 var(--f0,0px),#000 calc(100% - var(--f1,0px)),transparent);mask-image:linear-gradient(90deg,transparent,#000 var(--f0,0px),#000 calc(100% - var(--f1,0px)),transparent)}
.ed-chips::-webkit-scrollbar{display:none}.ed-chips::before,.ed-chips::after{content:'';flex:none;width:10px}
.ed-chips button{flex:none;height:36px;padding:0 13px;border:0;border-radius:999px;background:var(--tile);color:var(--ink);font:600 12px/1 'Plus Jakarta Sans',system-ui,sans-serif;letter-spacing:.06em;-webkit-tap-highlight-color:transparent;transition:background .2s,color .2s,transform .3s cubic-bezier(.3,1.6,.5,1)}
.ed-chips button[aria-selected=true]{background:var(--ink);color:var(--card)}
.ed-rows.one{grid-template-columns:minmax(0,1fr) max-content}
.ed-rows.one>.ed-row:not(.on){display:none}
.ed-rows.one>.ed-row>span:first-child{display:none}
.ed-rows.one>.ed-row.on>.ed-cx{display:none}   /* the wheel is already open here; its swatch + code button would say the same thing twice */
.ed-rows.one .ed-more{display:grid!important;grid-column:1/-1;grid-template-columns:max-content minmax(0,1fr);grid-template-rows:auto auto auto;column-gap:16px;row-gap:6px;align-items:center}
.ed-rows.one .ed-more .ed-w{grid-row:1/4;grid-column:1;--tw:92px;justify-self:start}   /* wheel left, Lightness stacked beside it: Colour stays as short as one control */
.ed-rows.one .ed-more>span{grid-column:2;color:var(--mut)}.ed-rows.one .ed-more>input{grid-column:2;min-width:0}.ed-rows.one .ed-more>.ed-n{justify-self:start;width:64px}
/* the chat is one slim bar under the controls */
.td .ed-chat{padding:10px 10px 10px 14px;flex-direction:row;align-items:center;gap:10px}   /* one slim bar, in the flow: never on top of anything */
.td .ed-chat>.ed-ph{display:none}.td .ed-chat .ed-msgs:empty{display:none}.td .ed-chat .ed-ask{flex:1}
.td .ed-chat{flex-wrap:wrap}.td .ed-chat .ed-msgs{flex:1 0 100%}   /* the turns sit on their own full-width line above the field (in the row they were squeezed to one letter a line) */
.td .ed-pic img{max-height:58px}.td .ed-card{gap:10px;padding:16px 20px}
}
.ed-n{width:3.7em;box-sizing:border-box;margin:0;padding:5px 6px;border:0;border-radius:6px;box-shadow:inset 0 0 0 1px var(--line);background:transparent;color:var(--ink);font:500 13px/1.2 'Plus Jakarta Sans',system-ui,sans-serif;text-align:right;font-variant-numeric:tabular-nums;-moz-appearance:textfield;appearance:textfield}
.ed-n::-webkit-inner-spin-button,.ed-n::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
.ed-n:focus-visible{outline:2px solid var(--ac);outline-offset:1px}
.ed-sw{width:24px;height:24px;flex:none;border-radius:6px;box-shadow:inset 0 0 0 1px var(--line)}
/* a colour row folds (her 2026-11-24: "it could also be collapsed and expanded ... It doesn't need to take up so much space"): folded = swatch + hex + a drawn plus; open = the wheel (+ Lightness) under it */
.ed-cx{grid-column:2/4;display:flex;align-items:center;gap:10px;min-height:44px;padding:0 12px 0 10px;border:0;border-radius:10px;background:transparent;color:var(--ink);cursor:pointer;font:500 13px/1 'Plus Jakarta Sans',system-ui,sans-serif;text-align:left}
.ed-cx code{flex:1;font:inherit;font-variant-numeric:tabular-nums;letter-spacing:.02em;color:var(--mut)}
.ed-cx svg{width:16px;height:16px;flex:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;fill:none}
.ed-more{display:contents}.ed-more[hidden]{display:none}
.ed-p input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:24px;margin:0;cursor:grab;touch-action:pan-y;
  background:linear-gradient(var(--ac),var(--ac)) 8px 50%/calc((100% - 16px) * var(--f,.5)) 2px no-repeat,linear-gradient(var(--line),var(--line)) 8px 50%/calc(100% - 16px) 2px no-repeat}
.ed-p input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;border-radius:var(--sq-br,50%);background:var(--ac);border:0;transform:var(--sq,none)}
.ed-p input[type=range]::-moz-range-thumb{width:16px;height:16px;border-radius:var(--sq-br,50%);background:var(--ac);border:0;transform:var(--sq,none)}
.ed-p input.held{cursor:grabbing}
/* colour = the same wheel as the taste sliders (her 2026-11-23: "a circle thing that we can change the hue"); the handle and the swatch ARE the applied colour */
.ed-w{--tw:118px;grid-column:1/-1;justify-self:center}
@media (max-width:480px){.ed-w{grid-column:1/-1;justify-self:center}}   /* phones: the wheel gets its own line under its label + swatch, never squeezed past the panel */
/* Lightness: its track IS the colours (black → this hue → white) and runs exactly where the 22px thumb's centre runs, so the colour under the thumb = the applied colour */
.ed-p input.ed-ltr{--tc:#161a24;height:28px;background:var(--lt,linear-gradient(90deg,#000,#888,#fff)) 11px 50%/calc(100% - 22px) 8px no-repeat}
.ed-p input.ed-ltr::-webkit-slider-thumb{width:22px;height:22px;background:var(--tc);box-shadow:0 0 0 1px rgba(22,26,36,.38)}
.ed-p input.ed-ltr::-moz-range-thumb{width:22px;height:22px;background:var(--tc);box-shadow:0 0 0 1px rgba(22,26,36,.38)}
.ed-acts{display:flex;flex-wrap:wrap;gap:8px}
/* her editor's DOCK chat: full width under the card and the panel (her 2026-11-23: "a chat box where you can type stuff into Claude") */
.ed-chat{grid-area:chat;min-width:0;background:var(--card);border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:12px}
.ed-msgs{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.ed-msgs:empty{display:none}
.ed-msgs li{align-self:flex-start;max-width:85%;padding:8px 12px;border-radius:14px 14px 14px 4px;background:var(--tile);color:var(--ink);font:400 14px/1.4 'Plus Jakarta Sans',system-ui,sans-serif;white-space:pre-line;overflow-wrap:anywhere}
.ed-msgs li.me{align-self:flex-end;background:var(--ink);color:var(--card);border-radius:14px 14px 4px 14px}
.ed-ask{display:flex;gap:10px;align-items:center;margin:0}
.ed-ask input{flex:1;min-width:0;height:44px;box-sizing:border-box;margin:0;padding:0 16px;border:0;border-radius:999px;background:var(--bg);color:var(--ink);font:400 14px/20px 'Plus Jakarta Sans',system-ui,sans-serif}
.ed-ask input::placeholder{color:var(--mut)}
.ed-ask input:focus-visible{outline:2px solid var(--ac);outline-offset:1px}
.ed-ask button{position:relative;flex:none;height:44px;padding:0 20px;border:0;border-radius:999px;background:var(--ink);color:var(--card);font:600 12px/1 'Plus Jakarta Sans',system-ui,sans-serif;letter-spacing:.08em;cursor:pointer}
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
.vx{--zc:#6a91de;--zt:#161a24;--hov:rgba(22,26,36,.08);display:grid;grid-template-columns:auto minmax(280px,1fr);grid-template-areas:"mon insp" "bar bar" "tl tl" "chat chat" "keys keys";gap:14px 18px;padding:20px;user-select:none;-webkit-user-select:none;font:500 13px/1.3 'Plus Jakarta Sans',system-ui,sans-serif;color:var(--ink)}
html[data-theme=night] .vx,html[data-look=dark] .vx{--zc:#8fb2f2;--zt:#121418;--hov:rgba(255,255,255,.1)}
.vx:focus{outline:none}
.vx-mon{grid-area:mon;justify-self:center;position:relative;height:min(50vh,480px);max-width:100%;aspect-ratio:4/3;border-radius:8px;overflow:hidden;background:#F0EBED;box-shadow:0 0 0 1px var(--line)}
.vx-view{position:absolute;inset:0;transform-origin:0 0}
.vx-view video{width:100%;height:100%;display:block;object-fit:cover}
.vx-zl{position:absolute;left:10px;top:10px;padding:5px 8px;border-radius:6px;background:rgba(22,26,36,.78);color:#fff;font:600 13px/1 'Plus Jakarta Sans',system-ui,sans-serif;font-variant-numeric:tabular-nums;opacity:0;transition:opacity .2s ease}
.vx-mon.z .vx-zl{opacity:1}
.vx-insp{grid-area:insp;min-width:0;background:var(--card);border-radius:12px;padding:14px;display:flex;flex-direction:column;gap:12px;align-self:stretch;contain:size;overflow-y:auto;overscroll-behavior:contain}   /* contain:size = the panel never sets the row's height (the preview does), so selecting a zoom or a clip never pushes the transport + timeline down; long panels scroll inside */
.vx-insp>*{flex:none}
.vx-pb{display:flex;flex-direction:column;gap:12px}
/* the side panel folds to a slim rail (her 2026-11-24: "Is the clip to section on the side like viewport too big? ... make it smaller"): the preview gets the room */
.vx-pt{all:unset;box-sizing:border-box;align-self:flex-start;display:inline-flex;align-items:center;gap:10px;min-width:44px;height:44px;margin:-8px -8px -4px;padding:0 12px;border-radius:10px;cursor:pointer;color:var(--ink);font:600 13px/1 'Plus Jakarta Sans',system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase}
.vx-pt:hover{box-shadow:inset 0 0 0 999px var(--hov)}.vx-pt:focus-visible{outline:2px solid var(--ink);outline-offset:2px}
.vx-pt svg{width:18px;height:18px;flex:none;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linejoin:round}
.vx-pt span{display:none}
.vx-pt{justify-content:center}   /* icon only: the panel icon sits in the middle of its 44px tile, not 1px left (icon audit 2026-11-25) */
.vx.rail{grid-template-columns:minmax(0,1fr) 60px}
.vx.rail .vx-insp{padding:8px}.vx.rail .vx-pt{margin:0;padding:0;width:44px;justify-content:center}.vx.rail .vx-pb{display:none}
.vx-chat{grid-area:chat}
/* first visit: ONE guided moment — the playhead runs into the zoom and back, then its knob breathes until she touches anything */
.vx-tip{position:absolute;top:44px;z-index:4;padding:6px 10px;border-radius:999px;background:var(--ink);color:var(--card);font:600 12px/1 'Plus Jakarta Sans',system-ui,sans-serif;white-space:nowrap;pointer-events:none;opacity:0;transition:opacity .4s ease}
.vx-tip.on{opacity:1}
.vx-ph.hint i::after{content:'';position:absolute;inset:-6px;border-radius:50%;box-shadow:0 0 0 2px var(--ink);opacity:.0;animation:vx-breathe 1.8s ease-in-out infinite}
@keyframes vx-breathe{0%,100%{opacity:0;transform:scale(.7)}50%{opacity:.7;transform:scale(1.15)}}
.vx-b.u{padding:0;width:44px;min-width:44px;height:44px}
.vx-b svg.s{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
.vx-insp h4{margin:0;font:600 13px/1.3 'Plus Jakarta Sans',system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:var(--mut)}
.vx-row{display:grid;grid-template-columns:1fr auto;gap:6px 10px;align-items:center}
.vx-row output,.vx-row b{font-weight:500;font-variant-numeric:tabular-nums;color:var(--mut)}
.vx-row b{color:var(--ink)}
.vx-insp input[type=range]{grid-column:1/-1}
.vx input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:24px;margin:0;cursor:grab;touch-action:pan-y;
  background:linear-gradient(var(--ac),var(--ac)) 8px 50%/calc((100% - 16px) * var(--f,.5)) 2px no-repeat,linear-gradient(var(--line),var(--line)) 8px 50%/calc(100% - 16px) 2px no-repeat}
.vx input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;border-radius:var(--sq-br,50%);background:var(--ac);border:0;transform:var(--sq,none)}
.vx input[type=range]::-moz-range-thumb{width:16px;height:16px;border-radius:var(--sq-br,50%);background:var(--ac);border:0;transform:var(--sq,none)}
.vx-seg{grid-column:1/-1;display:grid;grid-template-columns:repeat(3,1fr);gap:4px}.vx-seg .vx-b{background:var(--tile);padding:0 6px}.vx-seg .vx-b.on{background:var(--ink);color:var(--card)}
.vx-aim{grid-column:1/-1;position:relative;aspect-ratio:4/3;width:100%;max-width:240px;border-radius:6px;overflow:hidden;background-repeat:no-repeat;background-size:2700% 100%;touch-action:none;cursor:move}
.vx-aim i{position:absolute;box-sizing:border-box;border:2px solid var(--ac);border-radius:3px;box-shadow:0 0 0 999px rgba(22,26,36,.42);pointer-events:none}
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
.vx-clip.sel::after{box-shadow:inset 0 0 0 3px var(--ac)}
.vx-h{position:absolute;top:0;bottom:0;width:14px;z-index:1;background:var(--ac);opacity:0;touch-action:none;cursor:ew-resize;transition:opacity .15s ease;display:grid;place-items:center}
.vx-h::before{content:'';width:2px;height:16px;border-radius:1px;background:var(--on-ac)}
.vx-h.l{left:0;border-radius:6px 0 0 6px}.vx-h.r{right:0;border-radius:0 6px 6px 0}
.vx-clip:hover .vx-h,.vx-clip.sel .vx-h,.vx-h.on{opacity:1}
.vx-z{position:absolute;top:0;bottom:0;border-radius:6px;background:var(--zc);color:var(--zt);touch-action:none;cursor:grab;outline:0;transition:box-shadow .15s ease}
.vx-z:hover{box-shadow:0 0 0 2px var(--mut)}
.vx-z.sel{box-shadow:0 0 0 3px var(--ink)}
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
.vx-ph::before{content:'';position:absolute;top:8px;bottom:0;left:-1px;width:2px;border-radius:1px;background:var(--ink)}
.vx-ph i{position:absolute;top:2px;left:-8px;width:16px;height:16px;border-radius:var(--sq-br,50%);background:var(--ink);pointer-events:auto;touch-action:none;cursor:grab;transform:var(--sq,none);outline-offset:3px}
.vx-hv,.vx-snap{position:absolute;top:0;bottom:0;width:1px;pointer-events:none;display:none;z-index:2}
.vx-hv{background:var(--ink);opacity:.3}.vx-snap{background:var(--zc)}
.vx-keys{grid-area:keys;display:flex;flex-wrap:wrap;gap:6px 16px;color:var(--mut);font-weight:400}
.vx-keys kbd{font:600 12px/1 'Plus Jakarta Sans',system-ui,sans-serif;padding:3px 6px;margin-right:5px;border-radius:4px;background:var(--card);color:var(--ink)}
@media (hover:none){.vx-keys{display:none}.vx-h{width:20px}}
@media (max-width:420px){.vx-tc{font-size:13px}.vx-b.i{width:34px;min-width:34px}.vx-play{width:42px;height:42px;min-height:42px}}
@media (max-width:860px){.vx-insp{contain:none;overflow:visible}.vx,.vx.rail{grid-template-columns:minmax(0,1fr);grid-template-areas:"mon" "bar" "tl" "insp" "chat" "keys";padding:14px;gap:12px}.vx-mon,.vx.rail .vx-mon{height:auto;width:100%}
  .vx-pt span{display:inline}.vx-pt svg{translate:0 -.85px}   /* beside its words: on the capitals' middle line (icon audit 2026-11-25) */
  .vx.rail .vx-pt{width:auto;padding:0 12px}.vx-pb>h4:first-child{display:none}.vx.rail .vx-insp{padding:8px 14px}
  .vx-tl{grid-template-columns:58px minmax(0,1fr)}.vx-heads span{left:8px;font-size:12px;letter-spacing:.04em}.vx-sp{display:none}.vx-zg{flex:1 1 100%}.vx-zm{width:auto;flex:1}}
@media (max-width:700px){.td{padding:10px 18px}.td-in{padding:64px 0 6px;gap:16px}.ed{grid-template-columns:minmax(0,1fr);grid-template-areas:"card" "panel" "chat";grid-template-rows:none;padding:16px;gap:12px}.ed-w{--tw:120px}
/* EDITOR ON PHONES (her 2026-11-24: "I need to be able to differentiate what is like the viewport and what are the things that I'm
   editing ... I don't immediately think that these like little knobs are going to be affecting my thing at the top"): the sample is a
   canvas you're editing (dotted, like a design tool) that stays pinned while the knobs scroll under it; the knobs are a sheet attached
   below with a grabber, headed by a chip in the same blue as the selected text; a knob moved makes the selected text pulse */
@media (max-width:700px){
.td-stage{overflow:clip}
.td .ed-card{--ink:#161a24;--mut:#4f5866;--card:#fff;padding:20px 22px;border-radius:18px;background-color:#efeee9;background-image:radial-gradient(rgba(22,26,36,.16) 1px,transparent 1.3px);background-size:14px 14px;box-shadow:inset 0 0 0 1px rgba(22,26,36,.07),var(--lift)}   /* the canvas stays cream at night, so its words keep the day ink (night ink #f3f4f6 on #efeee9 was 1.06:1; #161a24 is 15:1, #4f5866 6.2:1) */
/* THE CUBBY (her 2026-11-24: "it feels odd to have something so starkly disappear under the canvas ... or its own little cubby"): the canvas
   is no longer pinned with the knobs sliding under it. Canvas, controls and chat fit the screen together; the controls' sheet is only as
   tall as the room left (--ed-max, measured in editor()), and when one control is taller than that (the colour wheel on a small phone) it
   scrolls INSIDE the sheet, its edges fading by how much is hidden past them. The label + chips and ADD TEXT / RESET stay put. */
.ed-p{max-height:var(--ed-max,none);box-sizing:border-box}.ed-p>*{flex:none}
.ed-p>.ed-rows{flex:0 1 auto;min-height:0;overflow-y:auto;overscroll-behavior-y:contain;scrollbar-width:none;padding:8px 6px;margin:-8px -6px 0;
  -webkit-mask-image:linear-gradient(transparent,#000 var(--f0,0px),#000 calc(100% - var(--f1,0px)),transparent);mask-image:linear-gradient(transparent,#000 var(--f0,0px),#000 calc(100% - var(--f1,0px)),transparent)}
.ed-p>.ed-rows::-webkit-scrollbar{display:none}
.ed-pic img{max-height:76px;width:auto}
.ed-p{position:relative;border-radius:24px;padding-top:28px;box-shadow:0 -16px 30px -26px rgba(22,26,36,.4)}
.ed-p::before{content:'';position:absolute;top:10px;left:50%;width:38px;height:5px;margin-left:-19px;border-radius:3px;background:rgba(22,26,36,.18)}
.ed-p .ed-ph{display:inline-flex;align-self:flex-start;align-items:center;gap:7px;padding:7px 11px;border-radius:9px;outline:2px solid var(--ac);outline-offset:0;color:var(--ink)}
.ed-p .ed-ph::before{content:'';width:9px;height:9px;border-radius:2px;background:var(--ac)}
}
  .ed-card{padding:22px 18px}h3.ed-t{font-size:24px}.td-ts{aspect-ratio:4/3}}
@media (max-width:640px){.td-cap b{font-size:16px}.td-cap span{font-size:14px}}
/* DEPTH (her 2026-11-24: "I want the demos to feel ... 3D tactile ... not this flat 2D, very minimalist design approach"; the way her
   Velocity Express cards and buttons did it): light from above = a hairline highlight on every raised top edge; soft layered shadows
   tinted with her ink (Velocity's rgb(49 50 79)); fields and number boxes sit IN the surface (inset); presses sink (an inset shadow here; the
   dip itself, Velocity's 80ms in / springy 280ms out, is press.js, the one press on every page). Fills stay flat: depth is light and shadow, never a gradient on a button. */
.td{--hi:rgba(255,255,255,.85);--rise:0 1px 2px rgba(49,50,79,.08),0 10px 26px -12px rgba(49,50,79,.22);--lift:0 1px 2px rgba(49,50,79,.1),0 6px 12px -6px rgba(49,50,79,.16),0 26px 48px -22px rgba(49,50,79,.38);
  --sunk:inset 0 1px 2px rgba(22,26,36,.12),inset 0 0 0 1px var(--line);--btn:inset 0 1px 0 rgba(255,255,255,.2),0 1px 2px rgba(22,26,36,.22),0 5px 12px -5px rgba(22,26,36,.32);--knob:0 1px 2px rgba(22,26,36,.32),0 3px 7px -2px rgba(22,26,36,.3)}
html[data-theme=night] .td,html[data-look=dark] .td{--hi:rgba(255,255,255,.07);--rise:0 1px 2px rgba(0,0,0,.45),0 12px 30px -12px rgba(0,0,0,.75);--lift:0 1px 2px rgba(0,0,0,.5),0 8px 16px -8px rgba(0,0,0,.55),0 30px 56px -22px rgba(0,0,0,.9);
  --sunk:inset 0 1px 3px rgba(0,0,0,.5),inset 0 0 0 1px var(--line);--btn:inset 0 1px 0 rgba(255,255,255,.16),0 1px 2px rgba(0,0,0,.5),0 6px 14px -6px rgba(0,0,0,.7);--knob:0 1px 2px rgba(0,0,0,.6),0 3px 8px -2px rgba(0,0,0,.6)}
.ed-p,.ed-chat,.vx-insp,.vx-tl{box-shadow:inset 0 1px 0 var(--hi),var(--rise)}
.ed-card{box-shadow:inset 0 1px 0 var(--hi),var(--lift)}
.ed-n,.ed-cx,.ed-ask input{box-shadow:var(--sunk)}
.vx-mon{box-shadow:0 0 0 1px var(--line),var(--rise)}
.ed-a,.ed-r,.ed-ask button,.ed-t.ed-b,.vx-b:not(:disabled),.vx-li{box-shadow:var(--btn);transition:transform .28s cubic-bezier(.34,1.56,.64,1),box-shadow .15s ease,opacity .15s ease}
.vx-b:hover:not(:disabled),.vx-li:hover{box-shadow:inset 0 0 0 999px var(--hov),var(--btn)}
.ed-a:active,.ed-r:active,.ed-ask button:active,.vx-b:active:not(:disabled),.vx-li:active,.ed-cx:active{transition-duration:80ms;box-shadow:inset 0 1px 2px rgba(0,0,0,.22)}   /* the dip itself = press.js, the one press on every page */
.ed-p input[type=range]::-webkit-slider-thumb,.vx input[type=range]::-webkit-slider-thumb,.vx-ph i{box-shadow:var(--knob)}
.ed-p input[type=range]::-moz-range-thumb,.vx input[type=range]::-moz-range-thumb{box-shadow:var(--knob)}
.ed-p input.ed-ltr::-webkit-slider-thumb{box-shadow:0 0 0 1px rgba(22,26,36,.38),inset 0 0 0 1px rgba(255,255,255,.35),var(--knob)}
.ed-p input.ed-ltr::-moz-range-thumb{box-shadow:0 0 0 1px rgba(22,26,36,.38),inset 0 0 0 1px rgba(255,255,255,.35),var(--knob)}
.td .tw-k{box-shadow:0 0 0 1px rgba(22,26,36,.38),inset 0 0 0 1px rgba(255,255,255,.35),var(--knob)}
.td .tw-disc{box-shadow:inset 0 0 0 1px var(--line),inset 0 2px 4px rgba(22,26,36,.18),0 1px 0 var(--hi)}
.vx-clip{box-shadow:inset 0 0 0 1px rgba(22,26,36,.18),0 1px 2px rgba(22,26,36,.22),0 4px 10px -4px rgba(22,26,36,.3)}
.vx-z{box-shadow:inset 0 1px 0 rgba(255,255,255,.3),0 1px 2px rgba(22,26,36,.25),0 4px 10px -4px rgba(22,26,36,.3)}
.vx-z:hover{box-shadow:0 0 0 2px var(--mut),0 4px 10px -4px rgba(22,26,36,.3)}.vx-z.sel{box-shadow:0 0 0 3px var(--ink),0 4px 10px -4px rgba(22,26,36,.3)}
`;
  document.head.appendChild(css);

  const dg = document.createElement('dialog');
  dg.className = 'td';
  dg.innerHTML = `<button type="button" class="td-x" aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
<div class="td-in"><div class="td-stage"></div><div class="td-cap"><i>My AI tools</i><b></b><span></span></div></div>`;
  const stage = dg.querySelector('.td-stage');
  let from = null, closing = 0, dc = null, dcHome = null;
  const add = () => { if (!dg.isConnected) document.body.appendChild(dg); };

  /* the DOCK CHAT, one for both demos (her 2026-11-24: "I don't know if it should be called Claude. It should be more of a chat"): her
     line on the right, the reply on the left, the field and SEND on one line at one height. Nothing typed is kept or sent anywhere. */
  const CHAT = `<div class="ed-chat"><h4 class="ed-ph">Chat</h4><ol class="ed-msgs" aria-live="polite"></ol>
<form class="ed-ask"><input type="text" maxlength="80" aria-label="Message" placeholder="Describe a change" autocomplete="off" spellcheck="false"><button type="submit" data-hand="SEND">SEND</button></form></div>`;
  function dock(box, answer) {
    const msgs = box.querySelector('.ed-msgs'), inp = box.querySelector('input');
    box.querySelector('form').addEventListener('submit', e => {
      e.preventDefault(); const said = inp.value.trim(); if (!said) return;
      const out = answer(said); inp.value = '';
      [[said, 'me'], [out.join('\n'), '']].forEach(([m, c]) => { const li = document.createElement('li'); li.textContent = m; if (c) li.className = c; msgs.appendChild(li); });
      while (msgs.children.length > 4) msgs.firstChild.remove();   // the last two turns, whole
      inp.scrollIntoView({ block: 'nearest', behavior: still() ? 'auto' : 'smooth' });   // the turns grew the chat: the field she is typing in stays in view (phones, keyboard up)
    });
  }
  /* EDITOR — her words from site.json hero: headline, first line, the SAY HEY! button */
  const ED = `<div class="ed"><div class="ed-card">
<div class="ed-it ed-pic" tabindex="0" role="button" aria-label="Paper plane" style="--pm:url(${A}taste-plane.png)"><img src="${A}taste-plane.png" alt="" width="640" height="389"><button type="button" class="ed-x" aria-label="Delete"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.25 8.25l7.5 7.5M15.75 8.25l-7.5 7.5"/></svg></button></div>
<div class="ed-it"><h3 class="ed-t" tabindex="0">Hi, I'm Madhu</h3><button type="button" class="ed-x" aria-label="Delete"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.25 8.25l7.5 7.5M15.75 8.25l-7.5 7.5"/></svg></button></div>
<div class="ed-it"><p class="ed-t" tabindex="0">Architecture taught me how to guide people with design.</p><button type="button" class="ed-x" aria-label="Delete"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.25 8.25l7.5 7.5M15.75 8.25l-7.5 7.5"/></svg></button></div>
<div class="ed-it"><span class="ed-t ed-b" tabindex="0">SAY HEY!</span><button type="button" class="ed-x" aria-label="Delete"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.25 8.25l7.5 7.5M15.75 8.25l-7.5 7.5"/></svg></button></div></div>
<div class="ed-p"><h4 class="ed-ph"></h4><div class="ed-rows"></div><div class="ed-acts"><button type="button" class="ed-a" data-hand="ADD TEXT">ADD TEXT</button><button type="button" class="ed-r" data-hand="RESET">RESET</button></div></div>
${CHAT}</div>`;
  /* THE DOCK CHAT, an allow-list (her 2026-11-23: "if it's not like a visual tweak, just say no"; and, on the first cut's list of
     examples, "there's so many different things that we could visually tweak and adjust for taste"). It understands what her editor's
     style panel can change on the sample card — text size, weight, alignment, line spacing, letter spacing, text colour, fill, corner
     radius, padding, border, opacity — on the heading, the line, the button or the card, in common phrasings. EVERY word must come from
     this vocabulary or the whole line gets the one fixed reply, her words: "Visual tweaks only." Replies are fixed strings (property,
     old to new); her line shows on her side of the chat while the demo is open, and is never kept or sent. */
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
    button: 2, cta: 2, link: 2, card: 3, box: 3, container: 3, plane: 4, airplane: 4, aeroplane: 4, jet: 4 };
  const NEG = new Set('less reduce decrease lower down fewer no remove without off none minus drop'.split(' '));
  const FILL = new Set(('make it its s the a an bit little tad please more and to much slightly some lot can you colour color font go turn set align aligned '
    + 'than with in on this that be everything all text words letters letter characters very really super extra way give add put up increase raise '
    + 'bump higher of i want would like could should change into as is it’s fill background bg height line paper paint tint recolour recolor').split(' '));
  const NO = 'Visual tweaks only.';
  function chat(raw, root, sel, pick) {
    const hex = [];   // "#3d6fd6" is a colour too: lifted out before the letters-only check
    const t = String(raw).slice(0, 80).toLowerCase().replace(/#([0-9a-f]{6}|[0-9a-f]{3})(?![0-9a-z])/g, m => ' zhex' + 'abcdefgh'[hex.push(m) - 1] + ' ');
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
      if (/^zhex[a-h]$/.test(x)) { acts.push(['col', hex['abcdefgh'.indexOf(x[4])]]); continue; }
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
    const its = root.querySelectorAll('.ed-it:not(.ed-pic)'), card = root.querySelector('.ed-card'), cs = el => getComputedStyle(el), pic = root.querySelector('.ed-pic');
    const nm = v => PAL[v] ? v : v.toUpperCase();
    /* the plane: its colour and its size, nothing else */
    if (tg === 4 || (tg === null && sel === pic)) {
      if (pic.hidden) return [NO];
      pick(pic); const out = [], img = pic.querySelector('img');
      for (const [k, v] of acts) {
        if (k === 'col') { pic.style.setProperty('--pc', PAL[v] || v); out.push(`Fill: ${nm(v)}`); }
        else if (k === 'size') { const a = Math.round(img.getBoundingClientRect().width), b = Math.max(60, Math.min(240, a + v * 5)); img.style.width = b + 'px'; out.push(`Plane size: ${a} to ${b}px`); }
      }
      return out.length ? out : [NO];
    }
    if (sel === pic) sel = null;
    const el = i => (its[i] && !its[i].hidden) ? its[i].querySelector('.ed-t') : null;
    if (tg !== null && tg < 3 && el(tg)) sel = pick(el(tg));
    if (!sel) sel = pick([...root.querySelectorAll('.ed-it:not([hidden]) .ed-t')][0] || null);
    const box = tg === 3 ? card : (tg !== null && el(tg)) || card;   // radius / padding / border / fill: the named element, else the card
    const txt = tg === 3 ? sel : sel;
    const out = [], px = v => Math.round(parseFloat(v) || 0), name = (e, k, d) => e.dataset[k] || d;
    for (const [k, v] of acts) {
      if (k === 'size' && txt) { const a = px(cs(txt).fontSize), b = Math.max(10, Math.min(56, a + v)); txt.style.fontSize = b + 'px'; out.push(`Font size: ${a} to ${b}px`); }
      else if (k === 'weight' && txt) { const a = +cs(txt).fontWeight, b = v === 'to700' ? Math.max(a, 700) : v === 'to300' ? Math.min(a, 300) : Math.max(200, Math.min(800, a + v)); txt.style.fontWeight = b; out.push(`Weight: ${a} to ${b}`); }
      else if (k === 'align') { const a = name(card, 'al', 'left'); card.style.alignItems = { left: 'flex-start', centre: 'center', right: 'flex-end' }[v]; card.style.textAlign = v === 'centre' ? 'center' : v; card.dataset.al = v; out.push(`Alignment: ${a} to ${v}`); }
      else if (k === 'line' && txt) { const f = parseFloat(cs(txt).fontSize), a = Math.round(parseFloat(cs(txt).lineHeight) / f * 100) / 100 || 1.2, b = Math.round(Math.max(.9, Math.min(2.4, a + .15 * v)) * 100) / 100; txt.style.lineHeight = b; out.push(`Line height: ${a} to ${b}`); }
      else if (k === 'letter' && txt) { const a = px(cs(txt).letterSpacing), b = Math.max(-2, Math.min(10, a + v)); txt.style.letterSpacing = b + 'px'; out.push(`Letter spacing: ${a} to ${b}px`); }
      else if (k === 'radius') { const a0 = px(cs(box).borderTopLeftRadius), a = a0 > 60 ? 'pill' : a0 + 'px';
        const b = v === 'pill' ? 999 : v === 'square' ? 0 : Math.max(0, Math.min(48, Math.min(a0, 40) + v)); box.style.borderRadius = b + 'px'; out.push(`Corner radius: ${a} to ${b > 60 ? 'pill' : b + 'px'}`); }
      else if (k === 'pad') { const a = px(cs(box).paddingTop), b = Math.max(0, Math.min(56, a + v)); box.style.padding = b + 'px'; out.push(`Padding: ${a} to ${b}px`); }
      else if (k === 'border') { const a = px(cs(box).borderTopWidth), b = v > 0 ? 2 : 0; box.style.border = b ? '2px solid currentColor' : '0'; if (box === card) box.style.color = 'var(--ink)'; out.push(`Border: ${a} to ${b}px`); }
      else if (k === 'op' && txt) { const a = Math.round(+cs(txt).opacity * 100), b = Math.max(20, Math.min(100, a + v)); txt.style.opacity = b / 100; out.push(`Opacity: ${a} to ${b}%`); }
      else if (k === 'col') {
        const toFill = fillCx || (!textCx && tg !== null && (tg === 2 || tg === 3));
        if (toFill) { const e = tg === null ? card : box; e.style.background = PAL[v] || v; e.dataset.fn = v; out.push(`${e === card ? 'Card' : 'Button'} fill: ${nm(v)}`); }
        else if (txt) { txt.style.color = PAL[v] || v; txt.dataset.cn = v; txt.dataset.c = ''; out.push(`Fill: ${nm(v)}`); }
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
  const hexOf = c => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
  let wheelOpen = false;   // the colour rows fold by default; open stays open while she clicks round the card
  /* a scroller's edges fade by how much is hidden past them (0 → 28px, so a fade grows in as you scroll and never pops), set as --f0
     (top / left) and --f1 (bottom / right) for the masks on .ed-chips and the phone cubby's .ed-rows (her 2026-11-24: no stark cuts) */
  const fadeEdges = el => { const x = el.classList.contains('ed-chips'), at = x ? el.scrollLeft : el.scrollTop, rest = (x ? el.scrollWidth - el.clientWidth : el.scrollHeight - el.clientHeight) - at;
    el.style.setProperty('--f0', Math.max(0, Math.min(28, at)) + 'px'); el.style.setProperty('--f1', Math.max(0, Math.min(28, rest)) + 'px'); };
  let fit = null;   // the phone cubby's measure (see editor())
  function editor(host, first) {
    host.innerHTML = ED;
    const root = host.firstElementChild;   // fresh listeners per open / RESET (the stage is reused, so never stack them on it)
    const card = root.querySelector('.ed-card'), p = root.querySelector('.ed-p'), rows = p.querySelector('.ed-rows'), ph = p.querySelector('.ed-ph');
    const pic = root.querySelector('.ed-pic'), img = pic.querySelector('img');
    let sel = null, wh = null, lt = null, one = 0;   // sel: a text (.ed-t), the plane (.ed-pic) or the card; one: the control shown on phones
    const kind = t => t === card ? 'card' : t === pic ? 'plane' : t.classList.contains('ed-b') ? 'button' : 'text';
    const label = t => !t ? 'Nothing selected' : t === card ? 'Card' : t === pic ? 'Plane' : t.classList.contains('ed-b') ? 'Button' : t.tagName === 'H3' ? 'Heading' : 'Text';
    /* the taste-slider rows for each kind of element: [label, key, min, max, step]; colour rows (tc, cf, pc) fold. Her 2026-11-24: "rather
       than just the weight, I should also be able to adjust things like the spacing or kern". Weight runs 200-800 in steps of 1 (her
       2026-11-24: "it always jumped by 100 ... the scale should actually be gradual"): Plus Jakarta Sans is a variable font, and theme.json
       asks Google for its whole wght 200..800 axis, so 437 really draws as 437 */
    /* her 2026-11-24: "the words you use like line and letter aren't the words Figma would traditionally use": Figma's own names, in full,
       on the chips too (Font size, Letter spacing, Line height, Corner radius, and Fill for colour) */
    const TXT = [['Font size (px)', 'fs', 10, 56, 1], ['Weight', 'fw', 200, 800, 1], ['Letter spacing (px)', 'ls', -2, 10, .5], ['Line height', 'lh', .9, 2.4, .05],
      ['Word spacing (px)', 'ws', -4, 20, 1], ['Fill', 'tc']];
    const SPEC = { text: TXT, button: TXT.slice(0, -1).concat([['Corner radius (px)', 'br', 0, 30, 1], TXT[TXT.length - 1]]),
      card: [['Corner radius (px)', 'br', 0, 48, 1], ['Padding (px)', 'pad', 4, 56, 1], ['Fill', 'cf']],
      plane: [['Size (px)', 'ps', 60, 240, 1], ['Fill', 'pc']] };
    const rgbOf = s => s.match(/[\d.]+/g).slice(0, 3).map(Number);
    const planeRGB = () => rgbOf(getComputedStyle(pic, '::after').backgroundColor);
    const showL = c => { if (!lt) return; lt.style.setProperty('--tc', `rgb(${c})`); lt.style.setProperty('--lt', `linear-gradient(90deg,#000,rgb(${wh.colorAt(wh.h, wh.r, .5)}),#fff)`); };
    const showC = c => { const sw = rows.querySelector('.ed-sw'), code = rows.querySelector('.ed-cx code'); if (sw) sw.style.background = `rgb(${c})`; if (code) code.textContent = hexOf(c); };
    const range = (l, key, a, b, st) => `<span>${l}</span><input type="range" min="${a}" max="${b}" step="${st}" data-k="${key}" aria-label="${l}"${key === 'tl' ? ' class="ed-ltr"' : ''}><input class="ed-n" type="number" min="${a}" max="${b}" step="${st}" data-k="${key}" aria-label="${l}, value" inputmode="decimal">`;
    const plus = o => `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10${o ? '' : 'M8 3v10'}"/></svg>`;
    function build() {
      const k = sel ? kind(sel) : 'text';
      ph.textContent = label(sel); p.classList.toggle('off', !sel);
      rows.innerHTML = SPEC[k].map(([l, key, a, b, st]) => '<div class="ed-row">' + (/^(tc|cf|pc)$/.test(key)
        ? `<span>${l}</span><button type="button" class="ed-cx" aria-expanded="${wheelOpen}" aria-controls="ed-more" aria-label="${l}, ${wheelOpen ? 'hide' : 'show'} the colour wheel"><i class="ed-sw" aria-hidden="true"></i><code></code>${plus(wheelOpen)}</button>
<div class="ed-more" id="ed-more"${wheelOpen ? '' : ' hidden'}><div class="ed-w"></div>${key === 'tc' ? range('Lightness', 'tl', 0, 100, 1) : ''}</div>`
        : range(l, key, a, b, st)) + '</div>').join('');
      // phones: one control at a time, picked from a row of chips (her 2026-11-24: "having to like scroll down for all the commands")
      const short = l => l.replace(/ \(px\)/, '');   // the chip says the full Figma name
      if (one >= SPEC[k].length) one = 0;
      let chips = p.querySelector('.ed-chips');
      if (!chips) { chips = document.createElement('div'); chips.className = 'ed-chips'; chips.setAttribute('role', 'tablist'); rows.before(chips); chips.addEventListener('scroll', () => fadeEdges(chips), { passive: true }); }
      const showOne = () => { chips.querySelectorAll('button').forEach((x, i) => x.setAttribute('aria-selected', String(i === one))); rows.querySelectorAll(':scope > .ed-row').forEach((r, i) => r.classList.toggle('on', i === one)); };
      chips.innerHTML = SPEC[k].map(([l], i) => `<button type="button" role="tab" data-i="${i}">${short(l).toUpperCase()}</button>`).join('');
      chips.onclick = e => { const b = e.target.closest('[data-i]'); if (!b) return; one = +b.dataset.i; showOne();
        // the tapped chip glides to the middle of the row, so it is never left half under a fade (scrollBy: only this row moves, never the page)
        const br = b.getBoundingClientRect(), cr = chips.getBoundingClientRect(); chips.scrollBy({ left: br.left + br.width / 2 - cr.left - cr.width / 2, behavior: still() ? 'auto' : 'smooth' }); };
      rows.classList.add('one'); showOne();
      lt = rows.querySelector('.ed-ltr'); wh = null;
      const wEl = rows.querySelector('.ed-w');
      if (k === 'card') {   // the taste sliders' Card fill: centre = the card's own colour, rim = every hue at full strength
        wEl.style.color = getComputedStyle(root).getPropertyValue('--card').trim() || '#fff';
        wh = window.tasteWheel(wEl, { h: +(card.dataset.wh || 35), r: +(card.dataset.wr || 0), base: 'ink', label: 'Fill',
          change: c => { card.style.background = `rgb(${c})`; card.dataset.wh = wh.h; card.dataset.wr = wh.r; delete card.dataset.fn; showC(c); } });
      } else if (k === 'plane') {   // centre = white = the plane's own clay; out to the rim = every hue, full strength
        wh = window.tasteWheel(wEl, { h: 220, r: 0, base: 'white', label: 'Fill', change: c => { pic.style.setProperty('--pc', `rgb(${c})`); showC(c); } });
      } else if (wEl) {
        wh = window.tasteWheel(wEl, { h: 220, r: 0, l: .1, label: 'Fill', change: c => { if (sel) sel.style.color = `rgb(${c})`; showC(c); showL(c); } });
      }
      rows.querySelectorAll('input').forEach(i => { i.disabled = !sel; });
      rows.querySelectorAll('input[type=range]').forEach(i => {
        if (window.tasteSquish) window.tasteSquish(i, { axis: 'x' });
        if (window.tasteBubble) window.tasteBubble(i, { src: i, size: i.classList.contains('ed-ltr') ? 26 : 24, at: window.tasteBubble.range(i, i.classList.contains('ed-ltr') ? 22 : 16) });
        i.addEventListener('pointerdown', () => i.classList.add('held')); ['pointerup', 'pointercancel', 'lostpointercapture', 'blur'].forEach(t => i.addEventListener(t, () => i.classList.remove('held'))); });
      sync(); fadeEdges(chips); fadeEdges(rows);
    }
    const get = key => { const cs = getComputedStyle(key === 'pad' ? card : key === 'ps' ? img : sel), fs = parseFloat(cs.fontSize);
      return key === 'fs' ? Math.round(fs) : key === 'fw' ? +cs.fontWeight : key === 'br' ? Math.min(+(sel === card ? 48 : 30), Math.round(parseFloat(cs.borderTopLeftRadius))) : key === 'pad' ? Math.round(parseFloat(cs.paddingTop))
        : key === 'ls' ? Math.round((parseFloat(cs.letterSpacing) || 0) * 2) / 2 : key === 'lh' ? (cs.lineHeight === 'normal' ? 1.2 : Math.round(parseFloat(cs.lineHeight) / fs * 20) / 20)
        : key === 'ws' ? Math.round(parseFloat(cs.wordSpacing) || 0) : key === 'ps' ? Math.round(parseFloat(cs.width)) : key === 'tl' ? Math.round(wh.l * 100) : 0; };
    function sync() {
      if (!sel) return;
      if (wh && sel === pic) { const c = planeRGB(), [h] = toHSL(c); wh.set(h == null ? wh.h : h, h == null ? 0 : 1 - Math.min(...c) / 255, true); showC(c); }   // the handle goes to the tint's hue; how far out = how much white is left out of it
      else if (wh && sel !== card) { const [h, st, l] = toHSL(rgbOf(getComputedStyle(sel).color)); wh.setL(l, true); const c = wh.set(h == null ? wh.h : h, st, true); showC(c); showL(c); }
      if (wh && sel === card) { const c = card.style.background ? rgbOf(getComputedStyle(card).backgroundColor) : wh.set(wh.h, wh.r, true);
        if (card.dataset.fn) { const [h, st] = toHSL(c); wh.set(h == null ? wh.h : h, st, true); }   // a colour the chat set: the handle goes to its hue
        showC(c); }
      rows.querySelectorAll('[data-k]').forEach(i => { const v = get(i.dataset.k); if (document.activeElement !== i || i.type === 'range') i.value = v;
        if (i.type === 'range') i.style.setProperty('--f', ((v - i.min) / (i.max - i.min)).toFixed(4)); });
    }
    function apply(key, v) {
      if (!sel) return;
      if (key === 'fs') sel.style.fontSize = v + 'px'; else if (key === 'fw') sel.style.fontWeight = v;
      else if (key === 'ls') sel.style.letterSpacing = v + 'px'; else if (key === 'lh') sel.style.lineHeight = v; else if (key === 'ws') sel.style.wordSpacing = v + 'px';
      else if (key === 'br') sel.style.borderRadius = v + 'px'; else if (key === 'pad') card.style.padding = v + 'px'; else if (key === 'ps') img.style.width = v + 'px';
      else if (key === 'tl' && wh) wh.setL(v / 100);
      sync();
    }
    // (the pulse that beat round the selected text while a knob moved is gone: her 2026-11-24 "The thin steady outline ... The round ✕ ... Yes, don't do 3")
    rows.addEventListener('input', e => { const i = e.target.closest('[data-k]'); if (!i) return; const v = +i.value; if (i.value === '' || isNaN(v)) return;
      apply(i.dataset.k, Math.max(+i.min, Math.min(+i.max, v))); });
    rows.addEventListener('click', e => { if (!e.target.closest('.ed-cx')) return; wheelOpen = !wheelOpen; build(); rows.querySelector('.ed-cx').focus(); });
    rows.addEventListener('focusin', e => { if (e.target.classList.contains('ed-n')) setTimeout(() => e.target.select(), 0); });   // like Figma: click a number, it's all selected, type the new one
    rows.addEventListener('change', e => { if (e.target.classList.contains('ed-n')) sync(); });   // a typed number out of range snaps back to what was applied
    const select = t => { root.querySelectorAll('.ed-it.sel').forEach(i => i.classList.remove('sel')); card.classList.toggle('sel', t === card); sel = t; if (t && t !== card) t.closest('.ed-it').classList.add('sel'); build(); };
    const done = t => { if (t.isContentEditable) { t.contentEditable = 'false'; if (!t.textContent.trim() && t.dataset.added) { const it = t.parentNode; if (sel === t) select(null); it.remove(); } } };
    const edit = (t, e) => {
      if (t.isContentEditable) return;
      // where she tapped, read BEFORE focusing: focusing can zoom or scroll the page and the point would land on the wrong letter (her 2026-11-24)
      const r = e && document.caretRangeFromPoint && document.caretRangeFromPoint(e.clientX, e.clientY), s = getSelection();
      t.contentEditable = 'true'; t.focus({ preventScroll: true });
      if (r && t.contains(r.startContainer)) { s.removeAllRanges(); s.addRange(r); } else { s.selectAllChildren(t); s.collapseToEnd(); }
    };
    const addText = () => {   // "add copy": a new line on the card, ready to type into
      const it = document.createElement('div'); it.className = 'ed-it';
      it.innerHTML = '<p class="ed-t" tabindex="0" data-added="1"></p><button type="button" class="ed-x" aria-label="Delete"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.25 8.25l7.5 7.5M15.75 8.25l-7.5 7.5"/></svg></button>';
      card.appendChild(it); const t = it.firstChild; select(t); edit(t);
    };
    root.addEventListener('click', e => {
      const x = e.target.closest('.ed-x');
      if (x) { const it = x.parentNode; if (sel && it.contains(sel)) select(null); it.hidden = true; return; }
      if (e.target.closest('.ed-r')) { editor(host); host.querySelector('.ed-r').focus(); return; }
      if (e.target.closest('.ed-a')) { addText(); return; }
      if (e.target.closest('.ed-pic')) { root.querySelectorAll('.ed-t').forEach(done); select(pic); return; }
      const t = e.target.closest('.ed-t');
      if (t) { if (t === sel) edit(t, e); else { root.querySelectorAll('.ed-t').forEach(done); select(t); } return; }
      if (e.target.closest('.ed-card')) { root.querySelectorAll('.ed-t').forEach(done); select(card); }   // the card itself (its fill, the space round things)
    });
    root.addEventListener('dblclick', e => { const t = e.target.closest('.ed-t'); if (t) { select(t); edit(t, e); } });
    root.addEventListener('focusout', e => { if (e.target.classList && e.target.classList.contains('ed-t')) done(e.target); });
    root.addEventListener('paste', e => { if (e.target.closest('.ed-t')) { e.preventDefault(); document.execCommand('insertText', false, (e.clipboardData || window.clipboardData).getData('text/plain')); } });
    root.addEventListener('keydown', e => {
      const t = e.target.closest && e.target.closest('.ed-t, .ed-pic');
      if (!t || e.target.closest('.ed-x')) return;
      if (t.isContentEditable) { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(t); if (t.isConnected) t.focus(); } return; }
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); t === sel ? (t !== pic && edit(t)) : select(t); }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && t === sel) { e.preventDefault(); t.closest('.ed-it').querySelector('.ed-x').click(); }
    });
    /* phones, THE CUBBY: the controls' sheet gets the height the screen has left under the canvas and above the chat (the dialog's height
       minus its 10px + 64px top, a 16px bottom margin, the editor's 16px padding x2 and two 12px gaps = 146px), never less than the
       label + chips + one slider + the buttons (232px; below that the whole tool scrolls as one, the canvas going with it) */
    const chatEl = root.querySelector('.ed-chat');
    rows.addEventListener('scroll', () => fadeEdges(rows), { passive: true });
    if (fit) fit.disconnect();
    if (window.ResizeObserver) { fit = new ResizeObserver(() => { if (!root.isConnected) return fit.disconnect();
      root.style.setProperty('--ed-max', Math.max(232, dg.clientHeight - 146 - card.offsetHeight - chatEl.offsetHeight) + 'px'); fadeEdges(rows); const ch = p.querySelector('.ed-chips'); if (ch) fadeEdges(ch); });
      [dg, card, chatEl, rows].forEach(e => fit.observe(e)); }
    dock(chatEl, said => { const out = chat(said, root, sel === card ? null : sel, t => { select(t); return t; }); sync(); return out; });
    select(first === 'card' ? card : root.querySelector('.ed-t'));
  }

  /* VIDEO EDITOR — a real editor on her raw zoom-demo recording (Pratu's Kitchen: lineup → SHOP NOW → product page). The camera is NOT
     baked into this clip: the Zoom track IS the camera, applied to the preview live, the way her zoom-demo tool plans it (ease in on the
     click, hold, ease out). Every control works on the real video; nothing is decoration. */
  const FPS = 30, NT = 27, TW = 67;   // strip: 27 frames of the raw clip, a tile every 0.2 s; lane tiles are 67 x 50 (4:3)
  const MARKS = [[1.5, 'Hover'], [2.5, 'Click'], [3.15, 'New page']];   // from her recording's log (source seconds)
  const EASE = { smooth: k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2, snappy: k => 1 - Math.pow(1 - k, 4), linear: k => k };
  const tc = t => { const f = Math.round(Math.max(0, t) * FPS), p = n => String(n).padStart(2, '0'); return `${p(Math.floor(f / 1800))}:${p(Math.floor(f / FPS) % 60)}:${p(f % FPS)}`; };
  const IC = { play: '<path d="M4.83 2.5v11l9.5-5.5z"/>', pause: '<path d="M3.5 2.5h3.2v11H3.5zM9.3 2.5h3.2v11H9.3z"/>', start: '<path d="M1.8 2.21h2v11h-2zM13.3 2.21v11L4.8 7.71z"/>',
    undo: '<path d="M5.65 2.68l-3 3 3 3M2.65 5.68h7.25a3.5 3.5 0 0 1 0 7H7.15"/>', redo: '<path d="M10.65 2.68l3 3-3 3M13.65 5.68H6.4a3.5 3.5 0 0 0 0 7H9.15"/>',
    panel: '<rect x="1.38" y="2.75" width="12.5" height="10.5" rx="2"/><path d="M9.63 2.75v10.5"/>',
    end: '<path d="M12.2 2.21h2v11h-2zM2.7 2.21v11L11.2 7.71z"/>', back: '<path d="M2.5 3h2v10h-2zM13.5 3v10L6 8z"/>', fwd: '<path d="M11.5 3h2v10h-2zM2.5 3v10L10 8z"/>',
    plus: '<path d="M8 4.55v6.5M4.75 7.8h6.5"/>', minus: '<path d="M4.75 7.8h6.5"/>' };   // icon audit 2026-11-25: start/end/undo/redo/panel moved by their measured soft centres; zoom +/− drawn on 8,8 (as type they sat 1-1.5px low)
  const ic = (k, c) => `<svg viewBox="0 0 16 16" aria-hidden="true"${c ? ` class="${c}"` : ''}>${IC[k]}</svg>`;
  let vxKey = null;
  function video(root) {
    root.innerHTML = `<div class="vx rail" tabindex="-1" style="--strip:url(${A}zoom-demo-raw-strip.jpg)">
<div class="vx-mon"><div class="vx-view"><video src="${A}zoom-demo-raw.mp4" poster="${A}zoom-demo-click.jpg" muted playsinline preload="auto" aria-label="Preview: a visitor on Pratu's Kitchen clicks SHOP NOW"></video></div><span class="vx-zl"></span></div>
<aside class="vx-insp"><button type="button" class="vx-pt" aria-expanded="false" aria-label="Show panel">${ic('panel')}<span></span></button><div class="vx-pb" aria-live="polite"></div></aside>
<div class="vx-bar">
 <div class="vx-g"><button type="button" class="vx-b i" data-a="start" aria-label="Go to start">${ic('start')}</button><button type="button" class="vx-b i" data-a="back" aria-label="Back one frame">${ic('back')}</button><button type="button" class="vx-b vx-play" data-a="play" aria-label="Play">${ic('play')}</button><button type="button" class="vx-b i" data-a="fwd" aria-label="Forward one frame">${ic('fwd')}</button><button type="button" class="vx-b i" data-a="end" aria-label="Go to end">${ic('end')}</button>
 <span class="vx-tc" aria-label="Time"><b></b> <span></span></span></div>
 <div class="vx-g"><button type="button" class="vx-b" data-a="split">SPLIT</button><button type="button" class="vx-b" data-a="zoom">ADD ZOOM</button><button type="button" class="vx-b" data-a="del">DELETE</button></div>
 <div class="vx-g"><button type="button" class="vx-b u" data-a="undo" aria-label="Undo">${ic('undo', 's')}</button><button type="button" class="vx-b u" data-a="redo" aria-label="Redo">${ic('redo', 's')}</button></div>
 <span class="vx-sp"></span>
 <div class="vx-g vx-zg"><button type="button" class="vx-b i" data-a="out" aria-label="Zoom timeline out">${ic('minus', 's')}</button><input class="vx-zm" type="range" min="0" max="1" step=".001" value="0" aria-label="Timeline zoom"><button type="button" class="vx-b i" data-a="in" aria-label="Zoom timeline in">${ic('plus', 's')}</button></div>
</div>
<div class="vx-tl"><div class="vx-heads"><span style="top:52px">Video</span><span style="top:101px">Zoom</span><span style="top:131px">Clicks</span></div>
 <div class="vx-sc"><div class="vx-cv"><div class="vx-ruler"></div><div class="vx-lane vx-lv"></div><div class="vx-lane vx-lz"></div><div class="vx-lane vx-lc"></div>
 <span class="vx-hv"></span><span class="vx-snap"></span><div class="vx-ph"><i role="slider" tabindex="0" aria-label="Playhead"></i></div></div></div></div>
${CHAT.replace('class="ed-chat"', 'class="ed-chat vx-chat"')}
<div class="vx-keys"><span><kbd>Space</kbd>Play</span><span><kbd>J</kbd><kbd>K</kbd><kbd>L</kbd>Shuttle</span><span><kbd>Left</kbd><kbd>Right</kbd>Frame</span><span><kbd>S</kbd>Split</span><span><kbd>Z</kbd>Add zoom</span><span><kbd>⌫</kbd>Delete</span><span><kbd>⌘Z</kbd>Undo</span><span><kbd>⇧⌘Z</kbd>Redo</span><span><kbd>+</kbd><kbd>−</kbd>Timeline zoom</span></div></div>`;
    const $ = s => root.querySelector(s), vxr = $('.vx'), v = $('video'), view = $('.vx-view'), mon = $('.vx-mon'), zl = $('.vx-zl'), insp = $('.vx-insp'), pb = $('.vx-pb'), pt = $('.vx-pt');
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
      if (pb.contains(document.activeElement)) vxr.focus({ preventScroll: true });   // the panel is about to be rebuilt: keep focus (and the shortcuts) in the editor
      if (sel && sel.k === 'zoom') {
        const z = st.zooms[sel.i], f = cl(Math.floor((z.s + z.a + z.h / 2) / SD * NT), 0, NT - 1);
        pb.innerHTML = `<h4>Zoom</h4><label class="vx-row">Zoom level<output data-o="l"></output><input type="range" min="1.2" max="3" step=".05" data-p="l"></label>
<div class="vx-row">Easing<div class="vx-seg">${['smooth', 'snappy', 'linear'].map(e => `<button type="button" class="vx-b" data-e="${e}">${e.toUpperCase()}</button>`).join('')}</div></div>
<label class="vx-row">Hold<output data-o="h"></output><input type="range" min="0" step=".05" data-p="h"></label>
<div class="vx-row">Aim<div class="vx-aim" role="slider" tabindex="0" aria-label="Camera aim" style="background-image:url(${A}zoom-demo-raw-strip.jpg);background-position:${(f / (NT - 1) * 100).toFixed(3)}% 0"><i></i></div></div>`;
        insp.querySelectorAll('input').forEach(i => { if (window.tasteSquish) window.tasteSquish(i, { axis: 'x' }); });
      } else if (sel && sel.k === 'clip') {
        pb.innerHTML = `<h4>Clip ${sel.i + 1}</h4><div class="vx-row">Starts at<b data-o="cs"></b></div><div class="vx-row">In<b data-o="ci"></b></div><div class="vx-row">Out<b data-o="co"></b></div><div class="vx-row">Length<b data-o="cl"></b></div><p class="vx-note">Drag its edges to trim.</p>`;
      } else {   // the project: the recording's real facts + every clip and zoom (click one to select it and jump there)
        const S = starts();
        pb.innerHTML = `<h4>Project</h4><p class="vx-note">Click a clip or a zoom on the timeline to change it.</p><div class="vx-row">Length<b data-o="pl"></b></div><div class="vx-row">Size<b>${v.videoWidth || 1600} × ${v.videoHeight || 1200}</b></div>
<div class="vx-row">Aspect<b>4:3</b></div><div class="vx-row">Frame rate<b>${FPS} fps</b></div>
<h4>Clips</h4><ol class="vx-list">${st.clips.map((c, k) => `<li><button type="button" class="vx-li" data-sel="clip" data-k="${k}"><i class="c"></i>Clip ${k + 1}<span>${tc(S[k])} · ${tc(len(c))}</span></button></li>`).join('')}</ol>
<h4>Zooms</h4>${st.zooms.length ? `<ol class="vx-list">${st.zooms.map((z, k) => `<li><button type="button" class="vx-li" data-sel="zoom" data-k="${k}"><i></i>${z.l.toFixed(1)}×<span>${tc(z.s)} · ${tc(zEnd(z) - z.s)}</span></button></li>`).join('')}</ol>` : '<p class="vx-note">None</p>'}`;
      }
      pt.querySelector('span').textContent = pb.querySelector('h4').textContent;
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
    /* the panel folds to a rail and back */
    pt.addEventListener('click', () => { const open = vxr.classList.toggle('rail') === false; pt.setAttribute('aria-expanded', open); pt.setAttribute('aria-label', open ? 'Hide panel' : 'Show panel'); draw(); });
    /* FIRST VISIT (her 2026-11-24: "I almost like don't know how to use the video editor"): one guided moment. The playhead runs into
       the zoom and back (the preview zooms as it passes, which is the whole idea), then its knob breathes beside one plain line until
       she touches anything. Once per browser. Reduce Motion: no run, a still ring. */
    let tried = 0; try { tried = +localStorage.getItem('vx-tried') || 0; } catch (e) { }
    const tip = document.createElement('span'); tip.className = 'vx-tip'; tip.textContent = 'Drag this line'; cv.appendChild(tip);
    const tipAt = () => { tip.style.left = (xOf(T) + 12) + 'px'; };
    const unhint = () => { ph.classList.remove('hint'); tip.classList.remove('on'); try { localStorage.setItem('vx-tried', '1'); } catch (e) { }
      vxr.removeEventListener('pointerdown', unhint, true); vxr.removeEventListener('keydown', unhint, true); };
    if (!tried) {
      vxr.addEventListener('pointerdown', unhint, true); vxr.addEventListener('keydown', unhint, true);
      ph.classList.add('hint');
      setTimeout(() => {
        if (!vxr.isConnected || !ph.classList.contains('hint')) return;
        const show = () => { tipAt(); tip.classList.add('on'); };
        if (still()) return show();
        const z = st.zooms[0], to = z ? z.s + z.a + z.h / 2 : 1, A1 = 1500, HOLD = 600, A2 = 1000, t0 = performance.now(), e2 = k => (1 - Math.cos(Math.PI * k)) / 2;
        (function nudge(t) {
          if (!ph.classList.contains('hint') || drag || playing || !vxr.isConnected) return;
          const u = t - t0; seek(u < A1 ? to * e2(u / A1) : u < A1 + HOLD ? to : to * (1 - e2(Math.min(1, (u - A1 - HOLD) / A2))));
          if (u < A1 + HOLD + A2) requestAnimationFrame(nudge); else show();
        })(t0);
      }, 900);
    }
    /* THE CHAT, an allow-list like the Editor's: it understands playing, cutting and the zoom track in plain words; every word must be
       from this list or the one fixed reply. Replies say what changed. */
    const VW = new Set(('the a an it its this that please can you on in at to of make go and now more bit little lot slightly much some just here there then with into be is me back way '
      + 'zoom zooms zoomed camera in out closer tighter wider less add new remove delete drop no without off cut split play preview watch pause stop start beginning end '
      + 'undo redo slower slow faster quick quicker snappier smoother gentler button shop click again from video clip').split(' '));
    const fx = n => n.toFixed(1) + '×';
    const zIdx = () => { if (sel && sel.k === 'zoom') return sel.i; const i = st.zooms.findIndex(z => T >= z.s && T <= zEnd(z)); return i >= 0 ? i : st.zooms.length ? 0 : -1; };
    const show = i => { sel = { k: 'zoom', i }; inspect(); commit(); stop(); const z = st.zooms[i]; seek(z.s + z.a); };
    function vchat(raw) {
      const w = String(raw).slice(0, 80).toLowerCase().split(/[\s,.!?'’-]+/).filter(Boolean), has = (...x) => x.some(y => w.includes(y));
      if (!w.length || w.some(x => !VW.has(x))) return [NO];
      if (has('undo')) { undo(); return ['Undone']; }
      if (has('redo')) { redo(); return ['Redone']; }
      if (has('cut', 'split')) { if (!canSplit()) return ['Move the line into the clip first']; split(); return [`Cut at ${tc(T)}`]; }
      const zoomy = has('zoom', 'zooms', 'zoomed', 'camera', 'closer', 'tighter', 'wider');
      if (zoomy && has('remove', 'delete', 'drop', 'no', 'without', 'off')) { const i = zIdx(); if (i < 0) return ['No zoom to remove']; st.zooms.splice(i, 1); sel = null; inspect(); commit(); seek(T); return ['Zoom removed']; }
      if (has('button', 'shop', 'click')) {   // "zoom in on the button": the zoom over the click, aimed at SHOP NOW
        const tB = toTL(MARKS[1][0]); if (tB == null) return [NO];
        let i = st.zooms.findIndex(z => tB >= z.s && tB <= zEnd(z));
        if (i < 0) { const r = room(Math.max(0, tB - .8)); if (!r) return ['No room for a zoom there']; st.zooms.push({ s: r[0], a: r[1] / 4, h: r[1] / 2, b: r[1] / 4, l: 1.8, x: .5, y: .762, e: 'smooth' }); st.zooms.sort((p, q) => p.s - q.s); i = st.zooms.findIndex(z => z.s === r[0]); }
        const z = st.zooms[i], a = z.l; z.l = cl(z.l + (has('out', 'wider', 'less') ? -.4 : .4), 1.2, 3); z.x = .5; z.y = .762; show(i); return [`Zoom on the button: ${fx(a)} to ${fx(z.l)}`];
      }
      if (zoomy && has('add', 'new', 'here')) { if (!room(T)) return ['No room for a zoom here']; addZoom(); return [`Zoom added at ${tc(st.zooms[sel.i].s)}`]; }
      if (has('slower', 'slow', 'faster', 'quick', 'quicker', 'snappier', 'smoother', 'gentler')) {
        const sl = has('slower', 'slow', 'smoother', 'gentler');
        if (has('play', 'preview', 'watch')) { play(sl ? .5 : 2); return [`Playing at ${sl ? .5 : 2}×`]; }
        const i = zIdx(); if (i < 0) return ['No zoom to change'];
        const z = st.zooms[i], a0 = z.a, tot = z.a + z.h + z.b, f = sl ? 1.5 : 1 / 1.5, mx = (tot - .1) / 2;   // the block keeps its length: the ease comes out of the hold
        z.a = cl(z.a * f, .1, mx); z.b = cl(z.b * f, .1, mx); z.h = tot - z.a - z.b; show(i); seek(z.s); play(); return [`Zoom ease: ${a0.toFixed(2)} to ${z.a.toFixed(2)} s`];
      }
      if (zoomy) { const i = zIdx(); if (i < 0) return ['No zoom to change']; const z = st.zooms[i], a = z.l; z.l = cl(z.l + (has('out', 'wider', 'less') ? -.3 : .3), 1.2, 3); show(i); return [`Zoom: ${fx(a)} to ${fx(z.l)}`]; }
      if (has('pause', 'stop')) { stop(); return ['Paused']; }
      if (has('start', 'beginning')) { stop(); seek(0); return ['Back to the start']; }
      if (has('end')) { stop(); seek(D()); return ['At the end']; }
      if (has('play', 'preview', 'watch')) { play(); return ['Playing']; }
      return [NO];
    }
    dock(root.querySelector('.vx-chat'), vchat);
    inspect(); draw(); seek(0);
    root.vx = { get st() { return st; }, get T() { return T; }, get sel() { return sel; }, seek, play, stop, cam, undo, redo, get hist() { return hist.length + ':' + hi; }, get drag() { return drag && drag.m; } };   // for checks
  }

  /* PHONE = the Mobile website editor (her 2026-11-24: "I wanted a demo experience of my mobile website and web app editor. I talked
     about putting in the way I designed interactions with it, which is why it's so helpful" / "The demo doesn't work the same and can we
     pick a more fun demo option" / "You can make the phone smaller in the mobile demo so you can see the caption at the bottom").
     The phone shows a slice of her Driftwood draft with ONE review switch that changes an interaction she designed WITH this tool (her
     real options, process/driftwood-widget/log.md), and Vantage's REAL review script runs on it (phone-demo/vantage-review.js, copied
     from Vantage cli/phone.js): hold an option = thumbs up / thumbs down / microphone, slide onto one and lift to choose; tap the picked
     one again = the same bubble; the underlined name jumps to the part it changes. The page is its own little document (a srcdoc
     iframe): fetch, storage and the microphone are stubbed there and its CSP forbids any connection, so nothing is sent, recorded or stored.
       TAP  = the before/after TAP hint: HALO / DROPS / MIST (her rings, make-driftwood-top.py .bh-tap; she kept MIST)
       SWAP = how the two laptops trade places: FLASHCARD (the first try: "almost like they're crashing into each other") / ORBIT (her fix)
     Which one the tile opens = the local DEMO review switch (bottom left, local builds only), so she compares them full size. */
  const PD = { tap: ['TAP', [['halo', 'HALO'], ['drops', 'DROPS'], ['mist', 'MIST']]], swap: ['SWAP', [['flash', 'FLASHCARD'], ['orbit', 'ORBIT']]] };
  const PDK = 'mk-review-phonedemo';
  let pdKind = 'tap';
  try { const v = localStorage.getItem(PDK); if (PD[v]) pdKind = v; } catch (e) { }

  /* GOOEY SWITCH (her rule 2026-11-24 "Every switch is gooey and draggable"; the drafts' goo() in parts.py, same spring 520/17): one
     white blob for the picked option slides, stretches along its travel, squashes at the walls; drag it and the option under it is
     picked as you cross. A STILL hold (350ms) is never a drag: it belongs to Vantage's vote bubble. Self-contained (it is also written
     into the demo phone's page), so it uses only its own window. */
  function goo(g) {
    var W = g.ownerDocument.defaultView;
    if (g.__goo) return; var bs = [].slice.call(g.querySelectorAll('button')); if (bs.length < 2) return; g.__goo = 1;
    var k = g.ownerDocument.createElement('i'); k.className = 'rv-knob'; k.setAttribute('aria-hidden', 'true'); g.insertBefore(k, g.firstChild);
    var x = null, w = 0, vx = 0, vw = 0, tx = 0, tw = 0, raf = 0, last = 0, drag = null, dragEnd = 0, holdT = 0;
    function cur() { return bs.filter(function (b) { return b.getAttribute('aria-pressed') === 'true'; })[0] || bs[0]; }
    function ctr(b) { return b.offsetLeft + b.offsetWidth / 2; }
    function paint() {
      var lo = bs[0].offsetLeft, hi = bs[bs.length - 1].offsetLeft + bs[bs.length - 1].offsetWidth, s = Math.min(.5, Math.abs(vx) / 900) * w, L = x, R = x + w;
      if (vx > 0) L -= s; else R += s; L = Math.max(lo, L); R = Math.min(hi, R); var min = w * .6; if (R - L < min) { if (L <= lo) R = lo + min; else L = hi - min; }
      var sq = 1 - (R - L) / w, sy = sq > 0 ? 1 + Math.min(.12, sq * .35) : 1 - Math.min(.15, s / w * .3);
      k.style.width = (R - L).toFixed(2) + 'px'; k.style.transform = 'translateX(' + L.toFixed(2) + 'px) scaleY(' + sy.toFixed(3) + ')';
    }
    function step(now) {
      var dt = Math.min(.032, (now - last) / 1000 || .016); last = now;
      if (!drag) { vx += ((tx - x) * 520 - vx * 17) * dt; x += vx * dt; vw += ((tw - w) * 520 - vw * 17) * dt; w += vw * dt; }
      paint(); if (drag || Math.abs(tx - x) > .3 || Math.abs(vx) > 4 || Math.abs(tw - w) > .3) raf = W.requestAnimationFrame(step); else { x = tx; w = tw; vx = vw = 0; paint(); raf = 0; }
    }
    function run() { if (!raf) { last = W.performance.now(); raf = W.requestAnimationFrame(step); } }
    function settle() {
      if (!g.offsetWidth) { x = null; return; } var b = cur(); tx = b.offsetLeft; tw = b.offsetWidth; k.style.top = b.offsetTop + 'px'; k.style.height = b.offsetHeight + 'px';
      if (x === null) { x = tx; w = tw; vx = vw = 0; paint(); } else run();
    }
    new W.MutationObserver(function () { if (!drag) settle(); }).observe(g, { subtree: true, attributes: true, attributeFilter: ['aria-pressed'] });
    g.addEventListener('pointerdown', function (e) {
      if (e.button || !e.target.closest('button')) return; if (x === null) settle(); if (x === null) return;
      drag = { px: e.clientX, off: e.clientX - g.getBoundingClientRect().left - (x + w / 2), t: e.timeStamp, moved: false };
      W.clearTimeout(holdT); holdT = W.setTimeout(function () { if (drag && !drag.moved) { drag = null; settle(); } }, 350);
    });
    W.addEventListener('pointermove', function (e) {
      if (!drag) return; if (!drag.moved) { if (Math.abs(e.clientX - drag.px) < 4) return; drag.moved = true; W.clearTimeout(holdT); run(); }
      var c = e.clientX - g.getBoundingClientRect().left - drag.off, c0 = ctr(bs[0]), cn = ctr(bs[bs.length - 1]);
      if (c < c0) c = c0 - (c0 - c) * .3; if (c > cn) c = cn + (c - cn) * .3;
      var i = 0; while (i < bs.length - 2 && c > ctr(bs[i + 1])) i++; var a = bs[i], b = bs[i + 1], f = Math.max(0, Math.min(1, (c - ctr(a)) / (ctr(b) - ctr(a))));
      var nw = a.offsetWidth + (b.offsetWidth - a.offsetWidth) * f, nx = c - nw / 2, dtm = Math.max(8, e.timeStamp - drag.t); vx = vx * .6 + ((nx - x) / dtm * 1000) * .4; x = nx; w = nw; drag.t = e.timeStamp;
      var near = f < .5 ? a : b; if (near.getAttribute('aria-pressed') !== 'true') near.click();
    });
    function up() { W.clearTimeout(holdT); if (!drag) return; var m = drag.moved; drag = null; if (m) dragEnd = W.performance.now(); settle(); }
    W.addEventListener('pointerup', up); W.addEventListener('pointercancel', up);
    g.addEventListener('click', function (e) { if (e.isTrusted && W.performance.now() - dragEnd < 400) { e.preventDefault(); e.stopPropagation(); } }, true);   /* the lift after a drag is not a tap */
    var re = function () { if (!drag) { x = null; settle(); } }; W.addEventListener('resize', re); W.addEventListener('load', re);
    if (W.document.fonts && W.document.fonts.addEventListener) W.document.fonts.addEventListener('loadingdone', re); settle();
  }

  /* the demo phone's own page script (written into its srcdoc; its settings come in window.PD_CFG). Her before/after card: the orbit
     maths are hers verbatim (make-driftwood-top.py BA_JS at/geo/bounds), the TAP rings are her .bh-tap presets and ripple() pace */
  function pdInner() {
    var C = window.PD_CFG, de = document.documentElement, PI = Math.PI;
    var st = document.getElementById('ba'), box = st.querySelector('.ba-box'), A_ = st.querySelector('.ba-after'), B_ = st.querySelector('.ba-before'),
      tap = st.querySelector('.bh-tap'), sws = [].slice.call(document.querySelectorAll('.rv-sw')), M = { tap: 'halo', swap: 'orbit' };
    var K = .53, AR = 546 / 896, LB = 26, BX = -.42, BY = -.27, G = null, O = { x: 0, y: 0 }, th = 0, anim = 0, cyc = 0, litT = 0;
    if (C.nocur) de.classList.add('nocur');
    function at(g, t) { var co = Math.cos(t), si = Math.sin(t), n = (1 + co) / 2; n *= n; n *= n; return { x: g.c.x + g.u.x * g.A * co + g.w.x * g.B * si, y: g.c.y + g.u.y * g.A * co + g.w.y * g.B * si, s: K + (1 - K) * n, d: co, n: n }; }
    function box_(g, p) { var w = g.F * p.s, h = g.F * AR * p.s; return { l: p.x - w / 2, r: p.x + w / 2, t: p.y - h / 2 - LB, b: p.y + h / 2 }; }
    function apart(g) { var gap = g.F * .02; for (var i = 0; i <= 8; i++) { var t = PI * (86 + i) / 180, a = box_(g, at(g, t)), b = box_(g, at(g, t + PI)); if (a.l < b.r + gap && b.l < a.r + gap && a.t < b.b + gap && b.t < a.b + gap) return false; } return true; }
    function geo(F) { var bc = { x: BX * F, y: BY * F }, L = Math.hypot(bc.x, bc.y), wl = Math.hypot(1, .8), g = { F: F, c: { x: bc.x / 2, y: bc.y / 2 }, u: { x: -bc.x / L, y: -bc.y / L }, w: { x: -1 / wl, y: .8 / wl }, A: L / 2, B: F * .1 }; while (!apart(g) && g.B < 2 * F) g.B += F * .01; return g; }
    function bounds(g) { var r = { l: 1e9, r: -1e9, t: 1e9, b: -1e9 }; for (var i = 0; i < 72; i++) { var q = box_(g, at(g, i * PI / 36)); r.l = Math.min(r.l, q.l); r.r = Math.max(r.r, q.r); r.t = Math.min(r.t, q.t); r.b = Math.max(r.b, q.b); } return r; }
    function place(e, q) {
      var w = G.F * q.s, hh = G.F * AR * q.s;
      e.style.transform = 'translate3d(' + (O.x + q.x - w / 2).toFixed(2) + 'px,' + (O.y + q.y - hh / 2).toFixed(2) + 'px,0) scale(' + q.s.toFixed(4) + ')';
      e.querySelector('.mac-media').style.opacity = (.5 + .5 * q.n).toFixed(3); e.style.zIndex = q.d >= 0 ? 2 : 1; e.classList.toggle('q', q.d < 0);
    }
    function lerp(a, b, k) { return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, s: a.s + (b.s - a.s) * k, n: a.n + (b.n - a.n) * k, d: a.d + (b.d - a.d) * k }; }
    function render(t) { if (!G) return; place(A_, at(G, t)); place(B_, at(G, t + PI)); }
    function layout() {
      var W = box.clientWidth; if (!W) return; var pad = 20, F = W * .84, g, b;
      for (var k = 0; k < 4; k++) { g = geo(F); b = bounds(g); var r = (W - 2 * pad) / (b.r - b.l); if (r >= 1) break; F *= r; }
      var rt = 1e9, rb = -1e9; [0, PI].forEach(function (t) { var q = box_(g, at(g, t)); rt = Math.min(rt, q.t); rb = Math.max(rb, q.b); });
      G = g; O = { x: pad + ((W - 2 * pad) - (b.r - b.l)) / 2 - b.l, y: pad - rt }; box.style.height = Math.round(rb - rt + 2 * pad) + 'px';
      A_.style.width = B_.style.width = F + 'px'; render(th); placeTap();
    }
    var ease = function (k) { return .5 - .5 * Math.cos(PI * k); };
    function front() { return Math.cos(th) >= 0 ? 'after' : 'before'; }
    /* one tap on the card = one swap. SWAP's options are HOW it moves: FLASHCARD slides both straight across (they pass through each
       other: her "crashing"), 0.6s; ORBIT turns them round her invisible tilted orbit, 1.1s, eased both ends, with the slight camera
       pull-back mid-turn. TAP's demo always swaps on her ORBIT. Reduce Motion: a quick fade (her 2026-11-23) */
    function swap() {
      if (anim || !G) return; stopTap(); var t0 = th, t1 = th + PI, flash = M.swap === 'flash';
      var D = flash ? 600 : 1100, s0 = performance.now();
      anim = requestAnimationFrame(function f(now) {
        var k = Math.min(1, Math.max(0, (now - s0) / D)), e = ease(k);
        if (flash) { var a = at(G, t0), b = at(G, t1); place(A_, lerp(a, b, e)); place(B_, lerp(b, a, e)); } else render(t0 + PI * e);
        box.style.transform = flash ? '' : 'scale(' + (1 - .035 * Math.sin(PI * k)).toFixed(4) + ')';
        if (k < 1) anim = requestAnimationFrame(f); else { anim = 0; th = t1; render(th); box.style.transform = ''; label(); }
      });
    }
    function label() { st.setAttribute('aria-label', front() === 'after' ? 'Show Before in front' : 'Show After in front'); }
    function placeTap() {
      if (!G) return; var b = box.getBoundingClientRect(), F = front() === 'after' ? A_ : B_, Bk = F === A_ ? B_ : A_,
        f = F.querySelector('.mac-lid').getBoundingClientRect(), k = Bk.querySelector('.mac-media').getBoundingClientRect();
      tap.style.left = ((f.left - b.left) / 2).toFixed(1) + 'px'; tap.style.top = (((k.bottom - b.top) + b.height) / 2).toFixed(1) + 'px';
    }
    function pace() { return tap.dataset.tv === 'halo' ? { n: 2, g: 950, gm: 1.35, d: 2600, dm: 1.05, s0: .7, c: 4700 } : { n: 3, g: 320, gm: 1.4, d: 1800, dm: 1.06, s0: .55, c: 3900 }; }
    function ripple() {
      if (tap.classList.contains('gone')) return; var T = pace(), rs = tap.querySelectorAll('i'), S = parseFloat(getComputedStyle(tap).getPropertyValue('--tr-scale')) || 1.8, n = Math.min(T.n, rs.length), d = 0, gp = T.g;
      for (var q = 0; q < n; q++) {
        var pk = .9 * Math.pow(.8, q), kf = []; for (var z = 0; z <= 14; z++) { var tt = z / 14, s = Math.pow(Math.sin(PI * Math.pow(tt, .55)), 1.6); kf.push({ opacity: +(pk * s).toFixed(3), offset: tt }); }
        kf[0].transform = 'scale(' + T.s0 + ')'; kf[14].transform = 'scale(' + (S * (1 + q * .06)).toFixed(2) + ')';
        rs[q].animate(kf, { duration: T.d * Math.pow(T.dm, q), delay: d, easing: 'cubic-bezier(.33,.5,.35,1)' }); d += gp; gp *= T.gm;
      }
      var em = tap.querySelector('em'), o = getComputedStyle(em).opacity;
      em.animate([{ transform: 'scale(1)', opacity: o }, { transform: 'scale(.95)', opacity: 1, offset: .3 }, { transform: 'scale(1)', opacity: o }], { duration: 1800, easing: 'cubic-bezier(.45,0,.55,1)' });
      cyc = setTimeout(ripple, T.c);
    }
    function stopTap() { clearTimeout(cyc); clearTimeout(litT); tap.classList.add('gone'); tap.querySelectorAll('i,em').forEach(function (e) { if (e.getAnimations) e.getAnimations().forEach(function (a) { a.cancel(); }); }); }
    function startTap() {
      stopTap(); tap.dataset.tv = M.tap; placeTap(); tap.classList.remove('gone', 'calm', 'on', 'lit'); void tap.offsetWidth; tap.classList.add('on', 'lit');
      cyc = setTimeout(ripple, 200); litT = setTimeout(function () { tap.classList.remove('lit'); tap.classList.add('calm'); }, 2900);
    }
    /* the part a switch changes gets her hairline ring: fades in, holds, fades out (on its first use, and when its name is tapped) */
    function glow(t) {
      var r = t.getBoundingClientRect(), e = document.createElement('div'), R = parseFloat(getComputedStyle(t).borderTopLeftRadius) || 0; e.className = 'rv-glow'; e.setAttribute('aria-hidden', 'true');
      e.style.cssText = 'left:' + (r.left + scrollX - 6) + 'px;top:' + (r.top + scrollY - 6) + 'px;width:' + (r.width + 12) + 'px;height:' + (r.height + 12) + 'px;border-radius:' + (R + 6) + 'px';
      document.body.appendChild(e); setTimeout(function () { e.remove(); }, 1900);
    }
    function paint(sw) { var k = sw.dataset.k; sw.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.v === M[k])); }); }
    sws.forEach(function (sw) {
      var k = sw.dataset.k, nm = sw.querySelector(':scope > span');
      sw.querySelectorAll('button').forEach(function (b) {
        b.addEventListener('click', function () {
          M[k] = b.dataset.v; paint(sw); if (!sw.__glowed) { sw.__glowed = 1; setTimeout(function () { glow(st); }, 220); }
          if (k === 'tap') startTap(); else swap();   /* picking an option plays it at once: the switch changes something she can SEE */
        });
      });
      nm.setAttribute('role', 'button'); nm.tabIndex = 0; nm.setAttribute('aria-expanded', 'false');
      function toggle() {
        var o = !sw.classList.contains('open'); sws.forEach(function (x) { x.classList.remove('open'); x.querySelector(':scope > span').setAttribute('aria-expanded', 'false'); });
        if (o) { sw.classList.add('open'); nm.setAttribute('aria-expanded', 'true'); dispatchEvent(new Event('resize')); setTimeout(function () { glow(st); }, 650); }   /* Vantage scrolls (capture), then the ring */
      }
      nm.addEventListener('click', toggle); nm.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
      paint(sw); goo(sw);
    });
    setTimeout(function () { document.querySelector('.rv-stack').classList.add('in'); }, 900);   /* they pop into place once the page is there */
    st.addEventListener('click', swap);
    st.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); swap(); } });
    layout(); label();
    addEventListener('resize', layout); addEventListener('load', layout); if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
    /* a real iPhone lifts Vantage's note sheet above its home bar (env(safe-area-inset-bottom), 0 inside this little page): the same lift here,
       so the screen's rounded corners never clip it */
    addEventListener('load', function () { var h = [].filter.call(document.body.children, function (e) { return e.shadowRoot; })[0]; if (!h) return; var s = document.createElement('style'); s.textContent = '.talk{bottom:30px}'; h.shadowRoot.appendChild(s); });
    setTimeout(startTap, 700);   /* after the dialog has eased in */
    window.__pd = { swap: swap, get mode() { return M; }, get front() { return front(); }, get anim() { return !!anim; } };   /* for checks */
  }

  /* the bezel CSS (her macFrame) the page already carries: only rules that are plain .mac selectors, copied into the phone's page */
  function macCSS() {
    let out = '';
    for (const s of document.styleSheets) {
      let rs; try { rs = s.cssRules; } catch (e) { continue; }
      for (const r of rs) if (r.selectorText && r.selectorText.split(',').every(x => /^\s*\.mac[\w-]*(::?[\w-]+)?(\s+[\w.-]+)?\s*$/.test(x))) out += r.cssText + '\n';
    }
    return out;
  }

  function phonePage(kind) {
    const [nm, opts] = PD[kind], de = document.documentElement, night = de.dataset.theme === 'night' || de.dataset.look === 'dark';
    const P = new URL(A + 'phone-demo/', location.href).href, O = new URL(P).origin;
    const mac = (src, alt) => `<div class="mac-media"><div class="mac"><div class="mac-lid" aria-hidden="true"><span class="mac-cam"></span></div><div class="mac-screen"><img class="fw-bar" src="${P}chrome-bar.png" alt=""><div class="mac-page"><img class="poster" src="${P}${src}" alt="${alt}"></div></div><div class="mac-base" aria-hidden="true"></div></div></div>`;
    const cfg = { kind, nocur: document.body.classList.contains('dc-on') || !!document.querySelector('body > .cursor') };
    return `<!doctype html><html lang="en"${night ? ' class="night"' : ''}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${O} data:; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'unsafe-inline' ${O}; connect-src 'none'; form-action 'none'">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap">
<style>${macCSS()}
*{box-sizing:border-box}
:root{--bg:#fbfaf7;--ink:#161a24;--mut:#4f5866;--lab:#15557e;--grey:#5d6470;--panel:linear-gradient(165deg,#f1efe9 0%,#e3e8ec 48%,#cbd8e2 100%);--gl:rgba(21,85,126,.55);--gl2:rgba(21,85,126,.22)}
html.night{--bg:#121418;--ink:#f3f4f6;--mut:#a9adb7;--lab:#b4cdf7;--grey:#9aa1ad;--panel:radial-gradient(60% 75% at 18% 22%,#2b4a64 0,rgba(43,74,100,0) 70%),radial-gradient(55% 70% at 82% 30%,#1d3550 0,rgba(29,53,80,0) 72%),#17202b;--gl:rgba(219,231,255,.5);--gl2:rgba(219,231,255,.16)}
html{background:var(--bg);-webkit-text-size-adjust:100%}
body{margin:0;color:var(--ink);font-family:'Plus Jakarta Sans',system-ui,sans-serif;-webkit-tap-highlight-color:transparent}
html.nocur,html.nocur *{cursor:none!important}
main{padding:56px 16px 112px}
h2{margin:0 0 16px;font-weight:600;font-size:20px;line-height:1.25}
.h2b{margin-top:64px}
.card{position:relative;border-radius:16px;background:var(--panel);overflow:hidden;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;cursor:pointer;outline:none}
.card:focus-visible{box-shadow:0 0 0 1.5px var(--lab)}
.ba-box{position:relative;height:180px;transform-origin:50% 50%}
.ba-card{position:absolute;left:0;top:0;margin:0;transform-origin:0 0;will-change:transform}
.ba-l{position:absolute;bottom:100%;right:7.6%;margin:0 -.34em 0 0;transform:translateY(-8px);white-space:nowrap;font:500 12px/1 'Plus Jakarta Sans',system-ui,sans-serif;letter-spacing:.34em;text-transform:uppercase;color:var(--lab)}
.ba-card.q .ba-l{color:var(--grey)}
.fw-bar{display:block;width:100%;height:auto;flex:0 0 auto}
.solo{padding:20px;cursor:default}
.cap{margin:16px 0 0}.cap b{display:block;font-weight:600;font-size:15px;line-height:1.3}.cap p{margin:4px 0 0;font-weight:300;font-size:14px;line-height:1.5;color:var(--mut)}
/* her TAP hint (make-driftwood-top.py .bh-tap, every ring a preset of the same dials) */
.bh-tap{position:absolute;z-index:4;left:20%;top:80%;width:0;height:0;pointer-events:none;--tr-col:var(--lab);--tr-size:44px;--tr-in:52%;--tr-peak:64%;--tr-tail:72%;--tr-out:80%;--tr-a:.38;--tr-ta:.14;--tr-blur:1.6px;--tr-scale:1.8;--tr-lo:.1;--tr-turn:9s}
html.night .bh-tap{--tr-col:#dbe7ff}
.bh-tap[data-tv=halo]{--tr-size:62px;--tr-in:52%;--tr-peak:64%;--tr-tail:72%;--tr-out:80%;--tr-a:.38;--tr-ta:.14;--tr-blur:1.2px;--tr-lo:1}
.bh-tap[data-tv=drops]{--tr-size:36px;--tr-in:60%;--tr-peak:66%;--tr-tail:70%;--tr-out:75%;--tr-a:.55;--tr-ta:.12;--tr-blur:.7px;--tr-scale:2.3;--tr-lo:.25}
.bh-tap[data-tv=mist]{--tr-size:70px;--tr-in:34%;--tr-peak:58%;--tr-tail:74%;--tr-out:88%;--tr-a:.26;--tr-ta:.16;--tr-blur:3.2px;--tr-scale:1.6;--tr-lo:.05}
html:not(.night) .bh-tap[data-tv=mist]{--tr-col:#15557E;--tr-a:.58;--tr-ta:.28;--tr-blur:2.4px}
html:not(.night) .bh-tap[data-tv=halo]{--tr-col:#15557E;--tr-a:.55;--tr-ta:.22}
html.night .bh-tap[data-tv=halo]{--tr-a:.2;--tr-ta:.07;--tr-blur:1.8px}html.night .bh-tap[data-tv=mist]{--tr-a:.34;--tr-ta:.2}
.bh-tap span{position:absolute;left:0;top:0;transform:translate(-50%,-50%) scale(0);opacity:0}
.bh-tap.on span{animation:bh-pop 1.1s cubic-bezier(.33,.9,.35,1) .25s forwards}
.bh-tap.gone{opacity:0;transition:opacity .6s ease}
.bh-tap em{display:block;padding-left:.16em;font:500 11px/1 'Plus Jakarta Sans',system-ui,sans-serif;font-style:normal;letter-spacing:.16em;white-space:nowrap;color:var(--lab);opacity:.55;transition:opacity .9s ease}
.bh-tap.lit em{opacity:.95}.bh-tap.calm em{opacity:.42}
html:not(.night) .bh-tap.lit em{opacity:1;color:#0d2a44;text-shadow:0 0 14px rgba(255,255,255,.95)}html:not(.night) .bh-tap.calm em{opacity:.78}
html.night .bh-tap em{color:#dbe7ff}
.bh-tap i{position:absolute;left:50%;top:50%;width:var(--tr-size);height:var(--tr-size);margin:calc(var(--tr-size)/-2) 0 0 calc(var(--tr-size)/-2);border-radius:50%;opacity:0;
 background:radial-gradient(circle closest-side,transparent var(--tr-in),color-mix(in srgb,var(--tr-col) calc(var(--tr-a)*100%),transparent) var(--tr-peak),color-mix(in srgb,var(--tr-col) calc(var(--tr-ta)*100%),transparent) var(--tr-tail),transparent var(--tr-out));
 -webkit-mask:conic-gradient(from var(--ra,20deg),#000,rgba(0,0,0,var(--tr-lo)) 30%,rgba(0,0,0,calc(var(--tr-lo) + .45)) 55%,rgba(0,0,0,var(--tr-lo)) 80%,#000);
 mask:conic-gradient(from var(--ra,20deg),#000,rgba(0,0,0,var(--tr-lo)) 30%,rgba(0,0,0,calc(var(--tr-lo) + .45)) 55%,rgba(0,0,0,var(--tr-lo)) 80%,#000);
 filter:blur(var(--tr-blur));animation:bh-turn var(--tr-turn) linear infinite}
@property --ra{syntax:"<angle>";inherits:false;initial-value:20deg}@keyframes bh-turn{to{--ra:380deg}}
@keyframes bh-pop{0%{transform:translate(-50%,-50%) scale(.82);opacity:0}60%{transform:translate(-50%,-50%) scale(1.03);opacity:1}100%{transform:translate(-50%,-50%) scale(1);opacity:1}}
/* the review switches, pinned bottom-left of the phone screen, gooey (her rules 2026-11-24). HER DEMO FLOW (2026-11-24: "you are on the page,
   and then the little toggle should pop into place, maybe they slide in from the right, boom, boom, boom ... they are retracted, and then
   you click on them, and then they take you to the area ... then you click on the different options, and then you're able to kind of
   vote on them"): they load CLOSED (just the underlined name), slide in from the right one after another, a tap on the name opens one
   (and Vantage takes the page to the part it changes) */
.rv-stack{position:fixed;left:14px;bottom:22px;z-index:10;display:flex;flex-direction:column;align-items:flex-start;gap:8px}
.rv-stack .rv-sw{position:relative!important;left:auto!important;bottom:auto!important;opacity:0;transform:translateX(-56px)}
.rv-stack.in .rv-sw{opacity:1;transform:none;transition:transform .6s cubic-bezier(.2,.9,.3,1.25) calc(var(--i)*170ms),opacity .3s ease calc(var(--i)*170ms)}
.rv-sw:not(.open) button,.rv-sw:not(.open) .rv-knob{display:none}.rv-sw:not(.open){padding:4px 12px}.rv-sw:not(.open){min-height:38px;box-sizing:border-box}.rv-sw:not(.open)>span{margin-right:-.08em;padding:0;display:block;line-height:1;text-box:trim-both cap alphabetic}   /* closed: the word dead centre (her 2026-11-25) */
.rv-sw{position:fixed;left:14px;bottom:22px;z-index:10;display:flex;align-items:center;gap:2px;padding:4px 4px 4px 12px;border-radius:999px;background:rgba(22,26,36,.92);color:#fff;font:600 11px/1 'Plus Jakarta Sans',system-ui,sans-serif;letter-spacing:.08em;box-shadow:0 10px 30px -12px rgba(0,0,0,.5)}
html.night .rv-sw{background:rgba(46,50,60,.95)}
.rv-sw>span{margin-right:6px;padding:9px 0;opacity:.85;cursor:pointer;text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:3px}
.rv-sw button{all:unset;position:relative;z-index:1;cursor:pointer;display:grid;place-items:center;height:30px;padding:0 8px;border-radius:999px;color:#fff;transition:color .25s}
html .rv-sw[role=group] button{touch-action:none}
.rv-sw button[aria-pressed=true]{color:#161a24}
.rv-sw button:focus-visible{box-shadow:0 0 0 1px #fff}
.rv-knob{position:absolute;left:0;top:0;border-radius:999px;background:#fff;pointer-events:none}
.rv-glow{position:absolute;z-index:5;pointer-events:none;box-sizing:border-box;border:1px solid var(--gl);box-shadow:0 0 22px var(--gl2);animation:rv-glow 1.8s cubic-bezier(.2,.7,.3,1) both}
@keyframes rv-glow{0%{opacity:0;transform:scale(1.015)}25%{opacity:1;transform:none}65%{opacity:1}100%{opacity:0}}
</style>
<script>/* nothing leaves this page: storage lives in memory, fetch and beacons go nowhere (the CSP blocks them too), and the microphone is a
   pretend: it shows the stop icon for a moment and hears nothing */
(function(){function mem(){var m=Object.create(null);return{getItem:function(k){return k in m?m[k]:null},setItem:function(k,v){m[k]=String(v)},removeItem:function(k){delete m[k]},clear:function(){m=Object.create(null)},key:function(i){return Object.keys(m)[i]||null},get length(){return Object.keys(m).length}}}
['localStorage','sessionStorage'].forEach(function(n){try{Object.defineProperty(window,n,{value:mem(),configurable:true})}catch(e){}});
window.fetch=function(){return Promise.resolve(new Response('{}'))};try{Object.defineProperty(navigator,'sendBeacon',{value:function(){return true},configurable:true})}catch(e){}
function SR(){}SR.prototype.start=function(){var r=this;clearTimeout(r.t);r.t=setTimeout(function(){r.onstart&&r.onstart();r.t=setTimeout(function(){r.onend&&r.onend()},2400)},200)};
SR.prototype.stop=SR.prototype.abort=function(){var r=this;clearTimeout(r.t);setTimeout(function(){r.onend&&r.onend()},0)};
window.SpeechRecognition=window.webkitSpeechRecognition=SR;
/* on a real phone this page IS the screen: scrolling to a part (Vantage's name tap) moves only this page, never the site around the demo;
   clamped to the page (iOS WebKit left a smooth scroll to a negative top hanging inside the iframe) */
Element.prototype.scrollIntoView=function(o){var r=this.getBoundingClientRect(),b=o&&o.block||'start',y=b==='center'?r.top+r.height/2-innerHeight/2:b==='end'?r.bottom-innerHeight:r.top;var de=document.documentElement;window.scrollTo({top:Math.max(0,Math.min(de.scrollHeight-innerHeight,scrollY+y)),behavior:o&&o.behavior==='smooth'?'smooth':'auto'})}})();</script></head><body>
<main>
<h2>What shipped</h2>
<div class="card" id="ba" role="button" tabindex="0"><div class="ba-box">
<figure class="ba-card ba-before"><p class="ba-l">Before</p>${mac('before.jpg', 'Before: 12 menu items')}</figure>
<figure class="ba-card ba-after"><p class="ba-l">After</p>${mac('after.jpg', 'After: 6 focused tabs')}</figure>
<div class="bh-tap" aria-hidden="true"><span><i></i><i></i><i></i><em>TAP</em></span></div></div></div>
<div class="cap"><b>A calmer dashboard</b><p>Reduced 12 tabs to 6 focused&nbsp;tabs.</p></div>
<h2 class="h2b">Moving face cloning</h2>
<div class="card solo">${mac('face.jpg', 'After: a Set up your face and voice alert at the top of Home')}</div>
</main>
<div class="rv-stack">${Object.keys(PD).map((k, i) => `<div class="rv-sw" role="group" data-review data-k="${k}" aria-label="${PD[k][0]}" data-target="#ba" style="--i:${i}"><span>${PD[k][0]}</span>${PD[k][1].map(([v, t]) => `<button type="button" data-v="${v}">${t}</button>`).join('')}</div>`).join('')}</div>
<script>window.PD_CFG=${JSON.stringify(cfg)};${goo.toString()}
(${pdInner.toString()})();</script>
<script src="${P}vantage-review.js"></script>
</body></html>`;
  }

  function phone(root, kind) {
    kind = PD[kind] ? kind : 'tap';
    const btn = s => `<span class="phone-btn ${s}" aria-hidden="true"></span>`;
    root.innerHTML = `<style>
.pd{display:flex;justify-content:center;padding:clamp(20px,5vw,40px) 20px}   /* her 2026-11-25: "all of them have like a healthy amount of space around them": the phone never runs to the stage edge */
.pd .phone-media{max-width:none;width:var(--pd-w,300px)}
.pd .phone-screen{background:#fbfaf7}
html[data-theme=night] .pd .phone-screen,html[data-look=dark] .pd .phone-screen{background:#121418}
.pd iframe{position:absolute;left:0;top:0;border:0;display:block;transform-origin:0 0;background:transparent}
</style>
<div class="pd"><div class="phone-media"><div class="phone">${btn('l action')}${btn('l volup')}${btn('l voldn')}${btn('r power')}${btn('r camera')}
<div class="phone-screen"><iframe title="Her Driftwood draft on a phone, with a ${PD[kind][0]} review switch"></iframe></div><span class="phone-island" aria-hidden="true"></span></div></div></div>`;
    const media = root.querySelector('.phone-media'), scr = root.querySelector('.phone-screen'), ifr = root.querySelector('iframe');
    /* the page inside renders at 250 CSS px or more (her switch and her card need that room) and is scaled down to the screen when it
       is narrower, so every tap target keeps its shape */
    const size = () => {
      const W = scr.clientWidth, H = scr.clientHeight; if (!W) return; const vw = Math.max(250, W), s = W / vw;
      ifr.style.width = vw + 'px'; ifr.style.height = (H / s).toFixed(1) + 'px'; ifr.style.transform = s < 1 ? `scale(${s.toFixed(4)})` : ''; ifr.__s = s;
    };
    /* her 2026-11-24: "make the phone smaller in the mobile demo so you can see the caption at the bottom": the phone takes only the
       height the screen has left once the ✕ row, the caption under it (and the local review switch) have theirs: no scrolling to read it */
    const fit = () => {
      const inn = dg.querySelector('.td-in'), cs = getComputedStyle(dg), ph = media.offsetHeight;
      const rest = inn.offsetHeight - ph + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      const w = Math.max(170, Math.min(300, innerWidth - 64, (dg.clientHeight - rest - 2) * 1.1036 / 2.2705));
      media.style.setProperty('--pd-w', w.toFixed(1) + 'px'); size();
    };
    root.__fit = fit;
    ifr.addEventListener('load', () => {
      const w = ifr.contentWindow; if (!w) return;
      /* her dot cursor keeps following over the phone (the phone's page hides its own pointer): moves inside it are passed up */
      w.addEventListener('pointermove', e => {
        if (e.pointerType && e.pointerType !== 'mouse') return; const r = ifr.getBoundingClientRect(), s = ifr.__s || 1;
        const o = { clientX: r.left + e.clientX * s, clientY: r.top + e.clientY * s, bubbles: true, pointerType: 'mouse' };
        document.dispatchEvent(new PointerEvent('pointermove', o)); document.dispatchEvent(new MouseEvent('mousemove', o));
      }, { passive: true });
      w.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });   /* Esc still closes while focus is in the phone */
    });
    ifr.srcdoc = phonePage(kind);
    fit(); requestAnimationFrame(fit); if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (stage.__fit === fit) fit(); });
  }
  addEventListener('resize', () => { if (dg.open && stage.__fit) stage.__fit(); });

  /* LOCAL REVIEW: the DEMO switch picks which phone demo the tile opens (TAP / SWAP). It lives in the page's pinned review stack
     (.rv-sws, bottom left, only in local builds: build.js adds it only with data/review-links.local.json), rides into the demo while it is
     open (like the gallery's) so she can flip demos at full size, and its underlined name jumps to what it changes: the phone tile, or the
     open demo's phone */
  const pdTarget = () => dg.open && stage.querySelector('.pd') ? '.td .pd .phone' : '[data-tool=phone] .tb-vis';
  function ring(t) {
    const r = t.getBoundingClientRect(), e = document.createElement('div'), R = parseFloat(getComputedStyle(t).borderTopLeftRadius) || 0;
    e.className = 'td-glow'; e.setAttribute('aria-hidden', 'true');
    e.style.cssText = `left:${r.left - 6}px;top:${r.top - 6}px;width:${r.width + 12}px;height:${r.height + 12}px;border-radius:${R + 6}px`;
    (dg.open ? dg : document.body).appendChild(e); setTimeout(() => e.remove(), 1900);
  }
  function rvSwitch() {
    return;   /* DEMO switch retired 2026-11-24: TAP and SWAP now both live on the demo's own page (her flow: closed switches slide in, tap, vote) */
    const rv = document.querySelector('.rv-sws'); if (!rv || rv.querySelector('.rv-pdemo')) return;
    const css = document.createElement('style');
    /* HER SWITCH RULES (2026-11-24: "I reloaded the site and demo was like open. It shouldn't be open"): it loads as a CLOSED pill (just
       its underlined name); tapping the name opens it (and jumps to what it changes); tapping again closes it */
    css.textContent = `.rv-sw.rv-pdemo:not(.open) button,.rv-sw.rv-pdemo:not(.open) .rv-knob{display:none}.rv-sw.rv-pdemo:not(.open){padding-right:14px}
.rv-sw.rv-pdemo{position:relative}.rv-pdemo>span{cursor:pointer;text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:3px;border-radius:6px;padding:8px 0}
.rv-pdemo>span:focus-visible{outline:none;box-shadow:0 0 0 1.5px #fff}
.rv-sw.rv-pdemo button{position:relative;z-index:1;transition:color .25s}.rv-sw.rv-pdemo button[aria-pressed=true]{background:transparent}
.rv-pdemo .rv-knob{position:absolute;left:0;top:0;border-radius:999px;background:#fff;pointer-events:none}
.td-glow{position:fixed;z-index:2147483600;pointer-events:none;box-sizing:border-box;border:1px solid rgba(58,98,171,.55);box-shadow:0 0 22px rgba(58,98,171,.22);animation:td-glow 1.8s cubic-bezier(.2,.7,.3,1) both}
html[data-theme=night] .td-glow{border-color:rgba(219,231,255,.5);box-shadow:0 0 22px rgba(219,231,255,.16)}
@keyframes td-glow{0%{opacity:0;transform:scale(1.015)}25%{opacity:1;transform:none}65%{opacity:1}100%{opacity:0}}
@media (max-width:1000px){.td.td-rv .td-in{padding-bottom:68px}}`;
    document.head.appendChild(css);
    rv.insertAdjacentHTML('beforeend', `<div class="rv-sw rv-pdemo" role="group" aria-label="Phone demo" data-target="${pdTarget()}"><span tabindex="0" role="button">DEMO</span>${Object.keys(PD).map(k => `<button type="button" data-d="${k}" aria-pressed="${k === pdKind}">${PD[k][0]}</button>`).join('')}</div>`);
    const g = rv.querySelector('.rv-pdemo'), RM = still;
    let used = 0;
    g.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      if (b.dataset.d === pdKind) return; pdKind = b.dataset.d; try { localStorage.setItem(PDK, pdKind); } catch (e) { }
      g.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      const open = dg.open && stage.querySelector('.pd'); if (open) phone(stage, pdKind);
      if (!used++) setTimeout(() => { const t = document.querySelector(pdTarget()); if (t) ring(t); }, 300);   /* her rule: ring the changed part on a switch's first use */
    }));
    const name = g.querySelector('span'), go = () => {
      const t = document.querySelector(pdTarget()); if (!t) return;
      if (dg.open) t.scrollIntoView({ block: 'center', behavior: RM() ? 'auto' : 'smooth' });
      else { const r = t.getBoundingClientRect(), room = Math.min(innerHeight, g.getBoundingClientRect().top - 12); scrollTo({ top: Math.max(0, scrollY + r.top - (r.height < room - 24 ? (room - r.height) / 2 : 16)), behavior: RM() ? 'auto' : 'smooth' }); }
      setTimeout(() => ring(t), RM() ? 60 : 650);   /* centred in the room above the switches, then her hairline ring */
    };
    const toggle = () => { const o = g.classList.toggle('open'); name.setAttribute('aria-expanded', String(o)); if (o) { window.dispatchEvent(new Event('resize')); go(); } };   // the knob re-measures once its buttons exist
    name.setAttribute('aria-expanded', 'false');
    name.addEventListener('click', toggle); name.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
    goo(g);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', rvSwitch); else rvSwitch();

  function open(id, o) {
    o = o || {}; add();
    from = o.from || document.activeElement; closing = 0;
    dg.querySelector('.td-cap b').textContent = o.name || '';
    dg.querySelector('.td-cap span').textContent = o.line || '';
    stage.className = 'td-stage'; stage.innerHTML = ''; stage.__fit = null;
    /* the Taste sliders are part of the Editor now (her 2026-11-23: "the editor and the taste sliders are like the same tool"): a Taste
       sliders tile/card still on a page opens the one Editor with the card (fill, corners, padding) selected */
    if (id === 'editor' || id === 'taste-sliders') editor(stage, id === 'taste-sliders' ? 'card' : null);
    else if (id === 'video-editor') video(stage);
    else if (id === 'phone') phone(stage, pdKind);
    dg.querySelector('.td-in').classList.toggle('wide', id !== 'phone');   // a phone needs no editor's width   // both demos get the room of a real editor (her 2026-11-24: "maybe we can expand the viewport")
    dg.classList.remove('in');
    document.documentElement.classList.add('td-lock');
    dg.showModal();
    { const rv = document.querySelector('.rv-sws'); if (rv) { dg.appendChild(rv); dg.classList.add('td-rv'); } const p = document.querySelector('.rv-pdemo'); if (p) p.dataset.target = pdTarget(); }   /* the local review switches ride along (as in her gallery): DEMO can be flipped while the demo is open */
    if (stage.__fit) stage.__fit();
    // 2. iPhone: no auto-zoom while a demo is open (a tapped text smaller than 16px would zoom the page); pinch-zoom still works on iOS
    const vp = document.querySelector('meta[name=viewport]');
    if (vp && /iPhone|iPad|iPod/.test(navigator.userAgent) && !vp.dataset.was) { vp.dataset.was = vp.content; vp.content = vp.content.replace(/,?\s*maximum-scale=[^,]*/, '') + ', maximum-scale=1'; }
    /* her cursor rides into the top layer (as the gallery's does): the home page's #dc dot, or a drafts page's .cursor ring */
    dc = document.getElementById('dc') || document.querySelector('body > .cursor');
    if (dc) { dcHome = dc.parentNode; dg.appendChild(dc); }
    dg.classList.toggle('td-ring', !!dc && !dc.id && getComputedStyle(dc).display !== 'none');
    if (matchMedia('(hover:hover)').matches) dg.querySelector('.td-x').focus({ preventScroll: true }); else { dg.tabIndex = -1; dg.focus({ preventScroll: true }); }   // touch: no focus box on the ✕ (her 2026-11-24 "why is the X button a square?")
    if (still()) dg.classList.add('in'); else requestAnimationFrame(() => requestAnimationFrame(() => dg.classList.add('in')));
  }
  function close() {
    if (!dg.open || closing) return; closing = 1;
    const inn = dg.querySelector('.td-in');
    inn.style.setProperty('--drop', Math.max(0, innerHeight - inn.getBoundingClientRect().top) + 24 + 'px');   // its top lands below the screen, wherever it was scrolled
    dg.classList.add('out');
    setTimeout(() => dg.close(), still() ? 200 : 520);
  }
  dg.addEventListener('close', () => {
    { const vp = document.querySelector('meta[name=viewport]'); if (vp && vp.dataset.was != null) { vp.content = vp.dataset.was; delete vp.dataset.was; } }
    closing = 0; dg.classList.remove('in', 'out'); dg.querySelector('.td-in').style.removeProperty('--drop'); stage.innerHTML = ''; vxKey = null;
    if (dc && dcHome) dcHome.appendChild(dc); dc = null;
    { const rv = dg.querySelector('.rv-sws'); if (rv) document.body.appendChild(rv); dg.classList.remove('td-rv'); stage.__fit = null; const p = document.querySelector('.rv-pdemo'); if (p) p.dataset.target = pdTarget(); }
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
  /* the ?demo=editor shortcut is retired: her 2026-11-24 it opened the demo on its own when she next opened the link */
})();
