# Wrriter UI reference: exact styling from the editor view mockup

Oct 25, 2026 · @Krishna

This is the companion to "Wrriter UI hand-off: look, feel and behaviour". That doc says what to build. This one holds the exact values, copied from the Editor view mockup (published 25 Oct 2026), so nothing has to be measured by eye. It has two parts: the style code and the icons.

## How to use the style code

- It is the mockup's own stylesheet, minus the parts that exist only to preview options on the canvas. Use it as the source of truth for every colour, size, spacing, radius, duration and curve. Port it into the app's components. Do not copy the mockup's markup, and do not keep the class names if the app's structure needs others.
- `.wr` is the app's root element. Set `data-theme` to `light` or `dark` on it, and `data-accent` to `sky`, `yellow`, `coral`, `mint` or `lilac`. Sky has no override block because its values are the base values.
- `main.ed` is the note pane. Inside it the accent is replaced by a grey, as the hand-off doc explains. Do not remove that block.
- `--col-gut` is the space between the note text and the pane edge. It is 24px here. In the app it is set by the Note margin setting (hand-off doc, section 5). `--col` is 4000px here, which means no width limit. Keep it that way.
- Custom properties that hold colour mixes, such as `--d1` and `--t1`, resolve where they are declared. This is on purpose: callouts keep the real accent even though the rest of the note pane uses grey. Do not move those lines.
- The `.hdl` rules (the block handle in the left margin) show the mockup as it was drawn: a grip on every block and the heading arrow hidden. The hand-off doc, section 7, replaces them. Follow section 7.
- `--sk1`, `--sk2`, `--sun` and `--h1` colour the sample hill pictures in the mockup. They are sample images, not part of the look.
- Not in this code, because the mockup did not draw them: the Find bar, command palette, quick switcher, settings window, dialogs, notices and tooltips. The hand-off doc, section 13, says how to build them.
- A line comment that names a style (Soft, Editorial, Retro print, Quiet minimal, Bold blocks, Playful) is only history. The result is one look, and this code is it.

## The style code

```css

/* ===== tokens: one list, every value below comes from here ===== */
.wr{
/* colour: the Apple Notes theme. Neutral macOS greys, white list and editor, yellow as the accent. Text greys are held at 4.5:1 or better on every pane */
--bar:#EEEDEB;--bar-hi:#F4F3F1;--bar-glint:rgba(255,255,255,.75);--side:#F5F4F2;--list:#FFFFFF;--ed:#FFFFFF;--tab:#FFFFFF;--field:#FFFFFF;--line:rgba(0,0,0,.08);--div:rgba(0,0,0,.14);
--tx:#1D1D1F;--tx2:#5E5E5E;--tx3:#6B6B6B;
--hov:rgba(0,0,0,.05);--pop:#FFFFFF;--shadow:0 1px 2px rgba(0,0,0,.06),0 8px 28px rgba(0,0,0,.12);
--accent:#2F96E0;--soft:rgba(47,150,224,.14);--selbg:rgba(47,150,224,.26);--onacc:#FFFFFF;--link:#1B73B3;--lul:rgba(27,115,179,.4);
--tile:rgba(0,0,0,.05);--hash:color-mix(in srgb,var(--accent) 35%,var(--tx));
--vault-p:#456EB8;--vault-w:#2F7A62;--ok:#2E8B57;
--shadow-bar:0 10px 24px -14px rgba(0,0,0,.35);--shadow-tab:0 0 0 1px var(--line),0 1px 2px rgba(0,0,0,.08),0 3px 8px -3px rgba(0,0,0,.10);
/* spacing scale: 4 8 12 16 24 32 48 64 */
--s-1:4px;--s-2:8px;--s-3:12px;--s-4:16px;--s-5:24px;--s-6:32px;--s-7:48px;--s-8:64px;
/* type scale: 11 13 15 18 24 38, three weights, line heights */
--fs-label:11px;--fs-small:13px;--fs-ui:15px;--fs-read:18px;--fs-h2:24px;--fs-title:38px;
--fw-regular:400;--fw-semi:600;--fw-bold:700;
--lh-label:16px;--lh-small:18px;--lh-ui:20px;--lh-read:30px;--lh-callout:26px;--lh-h2:32px;--lh-title:48px;
--ls-label:.06em;--ls-head:-.02em;--ls-display:-.03em;
/* shape: two radii, plus full for dots and circles */
--r-s:8px;--r-l:16px;--r-full:999px;
/* sizes on the 4px grid */
--ctl:32px;--tile-size:48px;--col:4000px;--col-min:360px;--col-gut:var(--s-5);--tb-h:40px;--tb-ctl:28px;--wc-d:24px;--sbt-w:28px;--tabs-h:32px;
/* toolbar and pane geometry: --band is the strip the panes keep clear at the top, --sidew and --listw are the widths the toolbar follows */
--band:var(--tb-h);--sidew:248px;--listw:320px;--wc-w:calc(3*var(--wc-d) + 2*var(--s-2));--bar-edge:inset 0 1px 0 var(--bar-glint),inset 0 -1px 0 var(--line);
/* motion: four speeds, three curves (Features 8) and the bar timing from Features 1 */
--t-instant:0ms;--t-fast:100ms;--t-base:180ms;--t-slow:280ms;
--ease-arrive:cubic-bezier(.16,1,.3,1);--ease-move:cubic-bezier(.4,0,.2,1);--ease-leave:cubic-bezier(.4,0,1,1);
--bar-fade:150ms;--bar-delay:500ms;
/* one selected / active look for tile, folder row, note row and tag chip */
--chk:#2A8AD8;--ink:var(--link);--sel-bg:var(--soft);--sel-ring:inset 0 0 0 1px color-mix(in srgb,var(--accent) 45%,transparent);
/* selected folder row and selected note row: a solid accent fill with its own text colours (yellow overrides below); folder icons */
--pick:var(--selbg);--pick-1:var(--tx);--pick-2:color-mix(in srgb,var(--tx) 84%,transparent);--fold:var(--d1);
/* one hover look for everything you can click */
--hov-fill:inset 0 0 0 999px var(--hov);
/* note elements: Soft as the base, Editorial headings and quote, Retro print callouts, Quiet minimal code, Bold blocks web link, Playful file blocks */
--fs-sec:32px;--lh-sec:36px;--fs-sub:23px;--lh-sub:30px;--fs-quote:30px;--lh-quote:38px;--fs-code:13px;--lh-code:22px;--fw-heavy:800;
--hc:#E8604C;--hl:#8B6FD6;--ha:#D9921B;--hm:#2FA58A;--hs:#2F96E0;
/* tag colours: five soft tones, each 4.5:1 on the page (pastels in dark) */
--tc1:#C15343;--tc2:#2A836F;--tc3:#2B7BB6;--tc4:#7F66C2;--tc5:#9B6B1C;
/* danger text in menus, and the five highlight colours (soft blocks behind the text) */
--dgr:#C42B1C;--mk1:#FFEB99;--mk2:#C8EDD3;--mk3:#C6E1F8;--mk4:#FAD0D8;--mk5:#E2D7F7;
--i1:var(--accent);--i2:var(--hc);--k1:67%;--k2:69%;
--d1:color-mix(in srgb,var(--i1) var(--k1),var(--tx));--d2:color-mix(in srgb,var(--i2) var(--k2),var(--tx));
--t1:color-mix(in srgb,var(--i1) 15%,var(--ed));--t2:color-mix(in srgb,var(--i2) 15%,var(--ed));--tg:color-mix(in srgb,var(--tx) 7%,var(--ed));
--code:rgba(0,0,0,.06);--fpaper:#FFFFFF;--fshadow:0 1px 1px rgba(0,0,0,.14),0 5px 12px rgba(0,0,0,.12);
}
.wr[data-theme="dark"]{--bar:#323232;--bar-hi:#3A3A3A;--bar-glint:rgba(255,255,255,.05);--hash:color-mix(in srgb,var(--accent) 78%,var(--tx));--side:#2B2B2B;--list:#232323;--ed:#1E1E1E;--tab:#1E1E1E;--field:rgba(255,255,255,.07);--line:rgba(255,255,255,.08);--div:rgba(255,255,255,.14);--tx:#F2F2F2;--tx2:#A6A6A6;--tx3:#9C9C9C;--hov:rgba(255,255,255,.06);--pop:#353535;--shadow:0 1px 2px rgba(0,0,0,.4),0 10px 32px rgba(0,0,0,.5);--accent:#5BB8F2;--soft:rgba(91,184,242,.18);--selbg:rgba(91,184,242,.32);--onacc:#062235;--link:#8CD0F8;--lul:rgba(140,208,248,.45);--tile:rgba(255,255,255,.06);--chk:#3391E3;--hc:#FF8A75;--hl:#B6A0F7;--ha:#F0BE55;--hm:#52CDAA;--hs:#66BDF5;--code:rgba(255,255,255,.1);--fpaper:#2E2E2E;--fshadow:0 1px 1px rgba(0,0,0,.45),0 5px 12px rgba(0,0,0,.4)}
.wr[data-accent="yellow"]{--accent:#FFE066;--soft:rgba(255,224,102,.42);--selbg:rgba(255,224,102,.7);--onacc:#2A2208;--link:var(--tx);--lul:#FFE066;--pick:#FFE066;--pick-1:#1D1D1F;--pick-2:rgba(29,29,31,.76);--fold:#AD8500;--qm:#9C7F00}
.wr[data-accent="coral"]{--accent:#E8604C;--soft:rgba(232,96,76,.14);--selbg:rgba(232,96,76,.26);--onacc:#FFFFFF;--link:#C2432F;--lul:rgba(194,67,47,.4)}
.wr[data-accent="mint"]{--accent:#2FA58A;--soft:rgba(47,165,138,.16);--selbg:rgba(47,165,138,.28);--onacc:#FFFFFF;--link:#1F7F69;--lul:rgba(31,127,105,.4)}
.wr[data-accent="lilac"]{--accent:#8B6FD6;--soft:rgba(139,111,214,.15);--selbg:rgba(139,111,214,.28);--onacc:#FFFFFF;--link:#6A4FC0;--lul:rgba(106,79,192,.4)}
.wr[data-theme="dark"][data-accent="yellow"]{--accent:#FFE27A;--soft:rgba(255,226,122,.20);--selbg:rgba(255,226,122,.34);--onacc:#1D1700;--link:var(--tx);--lul:#FFE27A;--pick-f:#6A5418;--pick:#8C6D1C;--pick-1:#FFFFFF;--pick-2:rgba(255,255,255,.95);--fold:#FFE27A;--qm:#FFE27A}
.wr[data-theme="dark"][data-accent="coral"]{--accent:#FF8A75;--soft:rgba(255,138,117,.18);--selbg:rgba(255,138,117,.32);--onacc:#2B1410;--link:#FFA391;--lul:rgba(255,163,145,.45)}
.wr[data-theme="dark"][data-accent="mint"]{--accent:#52CDAA;--soft:rgba(82,205,170,.18);--selbg:rgba(82,205,170,.32);--onacc:#06241C;--link:#7FE0C4;--lul:rgba(127,224,196,.45)}
.wr[data-theme="dark"][data-accent="lilac"]{--accent:#B6A0F7;--soft:rgba(182,160,247,.19);--selbg:rgba(182,160,247,.34);--onacc:#1D1238;--link:#C9B9FA;--lul:rgba(201,185,250,.45)}
.wr[data-accent="yellow"]{--i2:var(--hs);--k1:57%;--k2:67%}
.wr[data-accent="coral"]{--i2:var(--hs);--k1:69%;--k2:67%}
.wr[data-accent="mint"]{--i2:var(--hc);--k1:64%;--k2:69%}
.wr[data-accent="lilac"]{--i2:var(--ha);--k1:77%;--k2:57%}
.wr[data-theme="dark"]{--k1:100%;--k2:100%;--t1:color-mix(in srgb,var(--i1) 17%,var(--ed));--t2:color-mix(in srgb,var(--i2) 17%,var(--ed));--tg:color-mix(in srgb,var(--tx) 9%,var(--ed))}

/* inside the note and its menus nothing follows the accent: tints, rings, bars, bullets, link underlines and the quote mark are greys of the text colour.
   Their own colours stay: callouts (info, tip, warning, danger), tags, highlights, coloured text, the blue tick, the five-dot divider, file chips and the error colour */
main.ed{--accent:var(--tx3);--soft:color-mix(in srgb,var(--tx) 8%,transparent);--selbg:color-mix(in srgb,var(--tx) 16%,transparent);--link:var(--tx);--lul:var(--tx3);--ink:var(--tx);--fold:var(--tx3);--qm:var(--tx2);
--sel-bg:color-mix(in srgb,var(--tx) 9%,transparent);--sel-ring:inset 0 0 0 1px color-mix(in srgb,var(--tx) 55%,transparent);
--g1c:var(--tx2)}
main.ed .li.n2 .num{background:color-mix(in srgb,var(--tx) 7%,transparent)}
main.ed .tail{caret-color:var(--tx)}

:where(.wr) *{box-sizing:border-box}
:where(.wr) button{font:inherit;color:inherit;background:none;border:0;padding:0;margin:0;text-align:left;cursor:pointer}
:where(.wr) h1,:where(.wr) h2,:where(.wr) p,:where(.wr) ul{margin:0;padding:0}
.wr{width:100%;font-family:'Inter',system-ui,'Segoe UI',sans-serif;color:var(--tx);font-size:var(--fs-ui);line-height:var(--lh-ui);font-weight:var(--fw-regular);-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
.wr svg{display:block;flex:none}
/* window width settings: "fit the board" fills the frame (resize the frame to resize the window); the others pin it. The note floor is the narrowest the note column gets */
.wr button:focus-visible{outline:2px solid var(--ink);outline-offset:2px}
.wr[data-theme="dark"]{--tc1:#EE8879;--tc2:#63BCA7;--tc3:#63B0E8;--tc4:#A893E0;--tc5:#E2AD54;--dgr:#FF8A75;--mk1:rgba(255,214,70,.32);--mk2:rgba(80,200,130,.30);--mk3:rgba(90,160,240,.34);--mk4:rgba(240,110,140,.34);--mk5:rgba(170,140,245,.36);}
.ic{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.ic.xl{width:24px;height:24px}
.ic.m{width:16px;height:16px}
.ic.xs{width:12px;height:12px;stroke-width:2.2}

/* one hover look: the same flat tint over whatever the element already is */
.ib,.fr,.row,.tile,.fb,.vadd,.tab,.tnew,.wc button{transition:box-shadow var(--t-fast) var(--ease-move),background-color var(--t-fast) var(--ease-move)}
.ib:hover,.fr:not(.sel):hover,.row:not(.sel):hover,.tile:not(.on):hover,.fb:hover,.vadd:hover,.tab:not(.on):hover,.tnew:hover,.htag:hover,.wc button:hover{box-shadow:var(--hov-fill)}

.tbw{position:absolute;z-index:30;top:0;left:0;right:0;height:var(--tb-h);transition:left var(--t-slow) var(--ease-move)}
.tb{height:100%;display:flex;align-items:center;gap:var(--s-1);padding:0 calc(var(--wc-w) + var(--s-3) * 2) 0 calc(var(--s-2) + var(--sbt-w) + var(--s-1));background:linear-gradient(to bottom,var(--bar-hi),var(--bar));box-shadow:var(--bar-edge)}
.wr.sideshut{--sidew:0px}
/* glass: the bar lets the panes and the note show through, blurred */
.ib{width:var(--ctl);height:var(--ctl);display:grid;place-items:center;border-radius:var(--r-s);color:var(--tx2);flex:none}
.tb .ib{width:var(--tb-ctl);height:var(--tb-ctl)}
.sbt{position:absolute;z-index:35;top:calc((var(--tb-h) - var(--tb-ctl)) / 2);left:var(--s-2);display:flex;align-items:center;justify-content:center;gap:2px;width:var(--sbt-w);height:var(--tb-ctl);transition:left var(--t-slow) var(--ease-move),box-shadow var(--t-fast) var(--ease-move),background-color var(--t-fast) var(--ease-move)}
.sbt[aria-expanded="true"]{color:var(--tx)}
/* toolbar contents, after the macOS Notes bar: back and forward on the left, the note name in a compact field in the middle, the new note button right after it */
.tbl{display:flex;align-items:center;gap:var(--s-1)}
.tb .ib.dim{opacity:.4}
.tbmid{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:clamp(200px,26%,360px)}
.tbpill{height:var(--wc-d);display:flex;align-items:center;justify-content:center;border-radius:var(--r-s);background:color-mix(in srgb,var(--tx) 6%,transparent);transition:background-color var(--t-fast) var(--ease-move),box-shadow var(--t-fast) var(--ease-move)}
.tbpill:not(.ed):hover{background:color-mix(in srgb,var(--tx) 10%,transparent)}
.tbpill .pnb{flex:1;min-width:0;height:100%;display:flex;align-items:center;justify-content:center;gap:var(--s-2);padding:0 var(--s-3);border-radius:var(--r-s);cursor:text}
.tbpill .pn{min-width:0;font-size:var(--fs-small);line-height:var(--lh-small);font-weight:var(--fw-semi);color:var(--tx);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
/* renaming: the field turns into a text box in place, with an accent ring */
.tbpill.ed{background:var(--field);box-shadow:0 0 0 2px color-mix(in srgb,var(--fold) 82%,var(--tx))}
.tbpill .rin{flex:1;min-width:0;width:100%;height:100%;padding:0 var(--s-3);border:0;outline:0;border-radius:var(--r-s);background:transparent;color:var(--tx);font-family:inherit;font-size:var(--fs-small);line-height:var(--lh-small);font-weight:var(--fw-semi);text-align:center;caret-color:var(--tx)}
.tbnew{position:absolute;left:calc(100% + var(--s-2));top:50%;margin-top:calc(var(--tb-ctl) / -2)}
.wc{position:absolute;z-index:35;top:0;right:var(--s-3);height:var(--tb-h);display:flex;align-items:center;gap:var(--s-2)}
.wc button{width:var(--wc-d);height:var(--wc-d);display:grid;place-items:center;border-radius:var(--r-full);background:color-mix(in srgb,var(--tx) 8%,transparent);color:var(--tx2)}
.wc svg{width:10px;height:10px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
.wc button:hover{color:var(--tx)}
.wc button:active{transform:scale(.92)}
.wc .x:hover{background:#C42B1C;color:#fff;box-shadow:none}
.wc .x:active{background:#A8271A}
.wc .mn:hover{background:#FFC83D;color:#2B1F00;box-shadow:none}
.wc .mn:active{background:#E5AE1F}
.wc .mx:hover{background:#3CC76A;color:#04290F;box-shadow:none}
.wc .mx:active{background:#2AAE55}
.wc button,.tile{transition:box-shadow var(--t-fast) var(--ease-move),background-color var(--t-fast) var(--ease-move),color var(--t-fast) var(--ease-move),transform var(--t-fast) var(--ease-move)}

/* body */
.main{flex:1;min-height:0;display:flex}
.side{width:248px;flex:none;overflow:hidden;background:var(--side);border-right:1px solid var(--div);transition:width var(--t-slow) var(--ease-move),border-right-width var(--t-slow) var(--ease-move)}
.side.shut{width:0;border-right-width:0}
.sin{width:247px;height:100%;display:flex;flex-direction:column;padding-top:var(--band)}
.side.shut .sin{visibility:hidden;transition:visibility 0s linear var(--t-slow)}
.list{width:320px;flex:none;display:flex;flex-direction:column;padding-top:var(--band);background:var(--list);border-right:1px solid var(--div)}
.ed{flex:1;min-width:0;position:relative;background:var(--ed)}

/* the first thing in each of the three panes starts 16px under the toolbar */

/* sidebar: icon strip, folder icons and labels all start at x = 16 */
.tiles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--s-2);padding:var(--s-4)}
.tiles.four{grid-template-columns:repeat(4,var(--tile-size));justify-content:space-between}
.tile{height:44px;border-radius:var(--r-l);display:grid;place-items:center;background:var(--tile);color:var(--tx2)}
.tiles.four .tile{height:var(--tile-size)}
.tile .ic{width:22px;height:22px;stroke-width:2.1}
.tile:not(.on):hover{color:var(--tx)}
.tile:active{transform:scale(.96)}
.tile.on{background:var(--accent);color:var(--onacc);box-shadow:0 1px 2px rgba(0,0,0,.12),inset 0 1px 0 rgba(255,255,255,.4)}
.sep{height:1px;background:var(--line);margin:0 var(--s-4) var(--s-4)}
.lbl{padding:0 var(--s-4) var(--s-2);font-size:var(--fs-label);line-height:var(--lh-label);font-weight:var(--fw-semi);letter-spacing:var(--ls-label);text-transform:uppercase;color:var(--tx3)}
.tree{flex:1;min-height:0;padding:0 var(--s-2)}
.fr{display:flex;align-items:center;gap:var(--s-2);height:var(--ctl);padding:0 var(--s-2);border-radius:var(--r-s)}
.fr.d1{margin-left:var(--s-5)}
.fr.sel{background:var(--pick-f,var(--pick))}
.fslot{position:relative;width:20px;height:20px;display:grid;place-items:center;color:var(--fold);flex:none}
.fslot svg{grid-area:1/1;width:20px;height:20px;transition:opacity var(--t-base) var(--ease-move),transform var(--t-base) var(--ease-move)}
.fi .fbk{fill:currentColor;fill-opacity:.18;stroke:none}
.fi .ffr{fill:currentColor;fill-opacity:.34}
.fr:not(.open) .fslot .fopen{opacity:0;transform:scale(.86)}
.fr.open .fslot .fshut{opacity:0;transform:scale(.86)}
.fr.sel .fslot{color:var(--pick-1)}
/* the folder icon is also the expand toggle: hover or focus the icon (not the row) and a chevron takes its place; it turns down when the folder is open */
.ftg{cursor:pointer;border-radius:var(--r-s)}
.ftg:before{content:"";position:absolute;left:-4px;right:-4px;top:-6px;bottom:-6px}
.fslot .cv{width:16px;height:16px;stroke-width:2.4;color:var(--tx3);opacity:0;--rot:0deg;--sc:.8;transform:rotate(var(--rot)) scale(var(--sc));transition:opacity var(--t-base) var(--ease-move),transform var(--t-base) var(--ease-move)}
.ftg[aria-expanded="true"] .cv{--rot:90deg}
.fr.sel .ftg .cv{color:var(--pick-2)}
.ftg:hover .cv,.ftg:focus-visible .cv{opacity:1;--sc:1}
.ftg:hover .fi,.ftg:focus-visible .fi{opacity:0;transform:scale(.8)}
.fr .nm{flex:0 1 auto;min-width:0;font-size:var(--fs-ui);line-height:var(--lh-ui);font-weight:var(--fw-regular);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fr.sel .nm{font-weight:var(--fw-semi);color:var(--pick-1)}
.fr .ct{margin-left:auto;font-size:var(--fs-small);line-height:var(--lh-small);color:var(--tx3);font-variant-numeric:tabular-nums}
.fr.sel .ct{color:var(--pick-2)}
/* vault dropdown: one button at the bottom of the sidebar, a floating menu above it */
.vaults{display:flex;align-items:center;gap:var(--s-2);padding:var(--s-3) var(--s-2) var(--s-3) var(--s-3);border-top:1px solid var(--line)}
.vtrig{flex:1;min-width:0;display:flex;align-items:center;gap:var(--s-2);height:var(--ctl);padding:0 var(--s-2) 0 var(--s-1);border-radius:var(--r-s);transition:box-shadow var(--t-fast) var(--ease-move)}
.vtrig:hover,.vtrig[aria-expanded="true"]{box-shadow:var(--hov-fill)}
.vtrig .ic{color:var(--tx3)}
.vc{width:var(--wc-d);height:var(--wc-d);border-radius:var(--r-full);display:grid;place-items:center;font-size:var(--fs-small);line-height:1;font-weight:var(--fw-semi);color:#fff;text-align:center;flex:none}
.vc.p{background:var(--vault-p)}
.vc.w{background:var(--vault-w)}
.vn{flex:1;min-width:0;font-size:var(--fs-ui);line-height:var(--lh-ui);font-weight:var(--fw-semi);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sin{position:relative}
.vscrim{position:absolute;inset:0;z-index:40;cursor:default}
.vmenu{position:absolute;z-index:50;left:var(--s-2);right:var(--s-2);bottom:calc(var(--ctl) + var(--s-3) * 2 + 1px + var(--s-2));list-style:none;margin:0;padding:var(--s-2);border-radius:var(--r-l);background:var(--pop);box-shadow:0 0 0 1px var(--line),var(--shadow);transform-origin:bottom left;animation:vin var(--t-fast) var(--ease-arrive) both}
@keyframes vin{from{opacity:0;transform:translateY(4px) scale(.96)}to{opacity:1;transform:none}}
.vmh{padding:var(--s-1) var(--s-2) var(--s-2);font-size:var(--fs-label);line-height:var(--lh-label);font-weight:var(--fw-semi);letter-spacing:var(--ls-label);text-transform:uppercase;color:var(--tx3)}
.wr[data-theme="dark"] .vmh{color:var(--tx2)}
.vi{display:flex;align-items:center;gap:var(--s-3);width:100%;height:var(--ctl);padding:0 var(--s-2);border-radius:var(--r-s);font-size:var(--fs-ui);line-height:var(--lh-ui);transition:box-shadow var(--t-fast) var(--ease-move)}
.vi:hover{box-shadow:var(--hov-fill)}
.vi .vn{font-weight:var(--fw-regular)}
.vi[aria-checked="true"] .vn{font-weight:var(--fw-semi)}
.vi[role="menuitemcheckbox"] .vn{font-weight:var(--fw-regular)}
.vi .ic{color:var(--tx2)}
.vi .ck{color:var(--tx)}
.vi .ks{margin-left:auto;font-size:var(--fs-small);line-height:var(--lh-small);color:var(--tx2);white-space:nowrap}
.vi .chv{color:var(--tx3)}
.vi.dg,.vi.dg .ic{color:var(--dgr)}
.list.nopv .row .pv{display:none}
.list.nodt .row .dt{display:none}
.vi .ck{width:16px;height:16px;color:var(--tx);opacity:0}
.vi .ck.on{opacity:1}
.vi.add .vc{background:var(--tile);color:var(--tx2)}
.vmd{height:1px;margin:var(--s-2);background:var(--line)}

/* note list: title, date and preview all start at x = 24 */
.lh{position:relative;display:flex;align-items:center;gap:var(--s-1);height:var(--s-7);margin-top:var(--s-2);padding:0 var(--s-2) 0 var(--s-5)}
.lt{flex:1;min-width:0;display:flex;align-items:center;gap:var(--s-2)}
.lt .pnl{margin-left:calc((var(--ctl) - 20px) / -2)}
.lname{flex:0 1 auto;min-width:0;font-size:var(--fs-read);line-height:var(--s-5);font-weight:var(--fw-bold);color:var(--tx);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
/* the three-dot menu of the notes pane: same floating look as the vault menu, opens under the dots */
.lmenu{position:absolute;z-index:50;top:calc(100% - var(--s-1));right:var(--s-2);min-width:248px;list-style:none;margin:0;padding:var(--s-2);border-radius:var(--r-l);background:var(--pop);box-shadow:0 0 0 1px var(--line),var(--shadow);transform-origin:top right;animation:lin var(--t-fast) var(--ease-arrive) both}
.pnl[aria-expanded="true"] .chs,.pnl[aria-expanded="false"] .cho{display:none}
.lmenu.ed{top:calc(var(--band) + var(--s-4) + var(--ctl) - var(--s-1));right:var(--s-4);min-width:272px}
@keyframes lin{from{opacity:0;transform:translateY(-4px) scale(.96)}to{opacity:1;transform:none}}
.rows{flex:1;min-height:0;padding:0 var(--s-2) var(--s-4)}
.grp{display:flex;align-items:center;gap:var(--s-1);padding:var(--s-4) var(--s-4) var(--s-2);font-size:var(--fs-label);line-height:var(--lh-label);font-weight:var(--fw-semi);letter-spacing:var(--ls-label);text-transform:uppercase;color:var(--tx3)}
.grp.first{padding-top:var(--s-2)}
.row{display:flex;align-items:center;gap:var(--s-3);width:100%;padding:var(--s-3) var(--s-4);margin-bottom:var(--s-1);border-radius:var(--r-s)}
.row .rtx{flex:1;min-width:0;display:block}
.row .thumb{flex:none;width:var(--tile-size);height:var(--tile-size);border-radius:var(--r-s);overflow:hidden;background:linear-gradient(180deg,var(--sk1),var(--sk2));box-shadow:0 0 0 1px var(--line)}
.row .thumb svg{width:100%;height:100%}
.list.noim .row .thumb{display:none}
.row.sel{background:var(--pick)}
.row .t1,.row .dt,.row .pv{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.row .t1{font-size:var(--fs-ui);line-height:var(--lh-ui);font-weight:var(--fw-semi);color:var(--tx)}
.row .dt{font-size:var(--fs-small);line-height:var(--lh-small);font-weight:var(--fw-regular);color:var(--tx3)}
.row .pv{font-size:var(--fs-small);line-height:var(--lh-small);font-weight:var(--fw-regular);color:var(--tx2)}
.row.sel .t1{color:var(--pick-1)}
.row.sel .dt,.row.sel .pv{color:var(--pick-2)}

/* editor: the three-dot menu sits in the top right corner, on the same first row as the other two panes */
.nmore{position:absolute;right:var(--s-4);top:calc(var(--band) + var(--s-4));z-index:3;background:var(--ed)}
/* blockquote: the plain markdown quote, a bar on the left and quieter text (the pull quote above it is the styled one) */
.bq{margin:0 0 var(--s-4);padding:var(--s-1) 0 var(--s-1) var(--s-4);border-left:3px solid var(--fold);color:var(--tx2)}
.bq p{margin:0 0 var(--s-2);font-size:var(--fs-read);line-height:var(--lh-read)}
.bq>:last-child{margin-bottom:0}
/* the live end of the note: type / on an empty line and a menu of blocks opens under it */
.livew{position:relative;min-height:460px;margin-top:var(--s-4)}
.live{outline:0;caret-color:var(--tx)}
.live>p:only-child:has(>br:only-child):before{content:"Type / for commands";float:left;height:0;color:var(--tx3);pointer-events:none}
.live [data-ph][data-e="1"]:before{content:attr(data-ph);float:left;height:0;color:var(--tx3);pointer-events:none}
.live .lx{display:block;flex:1;min-width:0;outline:0}
.live .chk{cursor:pointer}
.live .tw :is(th,td){outline:0}
.live .tw :is(th,td):focus{box-shadow:inset 0 0 0 2px var(--fold)}
.live .cbody{white-space:pre-wrap;overflow:visible;min-height:calc(var(--lh-code) * 2)}
.live .bq p,.live h2,.live h3{outline:0}
.live .co [data-ph][data-e="1"]:before{color:color-mix(in srgb,var(--tx) 70%,var(--ct))}
.sm{position:absolute;z-index:40;width:344px;display:flex;flex-direction:column;border-radius:var(--r-l);background:var(--pop);box-shadow:0 0 0 1px var(--line),var(--shadow);transform-origin:top left;animation:lin var(--t-fast) var(--ease-arrive) both}
.sml{max-height:388px;overflow-y:auto;overscroll-behavior:contain;padding:var(--s-2);scrollbar-width:thin;scrollbar-color:var(--div) transparent}
.smg{padding:var(--s-2) var(--s-2) var(--s-1);font-size:var(--fs-label);line-height:var(--lh-label);font-weight:var(--fw-semi);letter-spacing:var(--ls-label);text-transform:uppercase;color:var(--tx2)}
.smg.off,.smi.off,.smo.off{display:none}
.smi{display:flex;align-items:center;gap:var(--s-3);width:100%;padding:var(--s-1) var(--s-2);border-radius:var(--r-s)}
.smi.sel{background:var(--sel-bg);box-shadow:var(--sel-ring)}
.smi.sel .smd,.smi.sel .smk,.smi.sel .smt{color:var(--tx)}
.smt{width:36px;height:36px;flex:none;display:grid;place-items:center;border-radius:var(--r-s);background:var(--tile);color:var(--tx2)}
.smx{flex:1;min-width:0;display:flex;flex-direction:column}
.smn{font-size:var(--fs-ui);line-height:var(--lh-ui);font-weight:var(--fw-semi);color:var(--tx)}
.smd{font-size:var(--fs-small);line-height:var(--lh-small);color:var(--tx2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.smk{flex:none;margin-left:auto;font-size:var(--fs-small);line-height:var(--lh-small);color:var(--tx2);font-variant-numeric:tabular-nums}
.smo{padding:var(--s-3);font-size:var(--fs-small);line-height:var(--lh-small);color:var(--tx2)}
.smf{display:flex;justify-content:space-between;gap:var(--s-3);padding:var(--s-2) var(--s-4);border-top:1px solid var(--line);font-size:var(--fs-small);line-height:var(--lh-small);color:var(--tx2)}
.bq .bq{margin:var(--s-2) 0 0;color:var(--tx3)}

/* editor: one column, 18px text on 30px lines. The column fills the pane with 24px of room each side (the Apple Notes margin), down to --col-min (360px). Below that it holds its width and the pane scrolls sideways. --col is the widest it may get (4000px = no limit; the Window settings can set 640 to 960). The note scrolls inside the pane */
.edscroll{position:absolute;left:0;right:0;top:0;bottom:var(--tabs-h);overflow-x:auto;overflow-y:auto;scrollbar-width:thin;scrollbar-color:var(--div) transparent}
.col{position:relative;width:min(calc(var(--col) + var(--col-gut) * 2),max(calc(var(--col-min) + var(--col-gut) * 2),100%));margin:0 auto;padding:calc(var(--band) + var(--s-7)) var(--col-gut) var(--s-8)}
.meta{text-align:center;font-size:var(--fs-small);line-height:var(--lh-small);font-weight:var(--fw-regular);color:var(--tx3);margin-bottom:var(--s-4)}
.ed1{font-size:var(--fs-title);line-height:var(--lh-title);font-weight:var(--fw-bold);letter-spacing:var(--ls-display);margin-bottom:var(--s-2)}
.props{display:flex;flex-wrap:wrap;align-items:center;gap:0;margin:0 calc(var(--s-2) * -1) var(--s-5)}
/* tags: plain coloured text like Apple Notes, each tag its own soft colour (--tc1 to --tc5) */
.htag{display:inline-flex;align-items:center;height:var(--wc-d);padding:0 var(--s-2);border-radius:var(--r-s);font-size:var(--fs-ui);line-height:var(--lh-ui);font-weight:var(--fw-bold);color:var(--tagc,var(--tx2));cursor:pointer;transition:box-shadow var(--t-fast) var(--ease-move),transform var(--t-fast) var(--ease-move)}
.htag.c1{--tagc:var(--tc1)}
.htag.c2{--tagc:var(--tc2)}
.htag.c3{--tagc:var(--tc3)}
.htag.c4{--tagc:var(--tc4)}
.htag.c5{--tagc:var(--tc5)}
.htag i{font-style:normal}
.htag:active{transform:scale(.97)}
.edp,.live>p{font-size:var(--fs-read);line-height:var(--lh-read);margin-bottom:var(--s-3);text-wrap:pretty}
.edp b{font-weight:var(--fw-bold)}
.edp s{color:var(--tx2);text-decoration-color:var(--tx3)}
.ic2{font-size:.86em;padding:3px var(--s-2);border-radius:var(--r-s);background:var(--code);letter-spacing:0}
.mono{font-family:'Cascadia Code','Cascadia Mono',Consolas,ui-monospace,Menlo,monospace}
.blk{position:relative}

/* headings (Editorial): a hairline rule, heavy tight type, no colour */
.ed2{margin:var(--s-7) 0 var(--s-4);padding-top:var(--s-4);border-top:1px solid var(--tx);font-size:var(--fs-sec);line-height:var(--lh-sec);font-weight:var(--fw-heavy);letter-spacing:-.04em}
.ed3{margin:var(--s-6) 0 var(--s-2);font-size:var(--fs-sub);line-height:var(--lh-sub);font-weight:var(--fw-bold);letter-spacing:-.025em}
.hdl{position:absolute;left:calc(-1 * var(--col-gut));top:22px;display:flex;align-items:center;gap:var(--s-1);color:var(--tx3)}
.hdl span{width:24px;height:24px;display:grid;place-items:center;border-radius:var(--r-s)}
.hdl span:first-child{display:none}

/* lists and tasks (Soft) */
.tasks{margin:0 0 var(--s-3)}
.task{display:flex;align-items:flex-start;gap:var(--s-3);margin-bottom:var(--s-1);font-size:var(--fs-read);line-height:var(--lh-read)}
.chk{width:24px;height:24px;margin-top:3px;border-radius:var(--r-full);border:2px solid var(--tx3);display:grid;place-items:center;color:transparent;flex:none}
.chk.on{background:var(--chk);border-color:var(--chk);color:#fff}
.chk svg{width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round}
.done{color:var(--tx3);text-decoration:line-through;text-decoration-color:var(--tx3)}
.li{display:flex;gap:var(--s-3);margin-bottom:var(--s-1);font-size:var(--fs-read);line-height:var(--lh-read)}
.bul{width:8px;height:8px;border-radius:var(--r-full);background:var(--ink);margin-top:11px;flex:none}

/* numbered list (Soft): a soft circle per number, a nested level restarts at 1 */
.num{width:var(--wc-d);height:var(--wc-d);margin-top:3px;border-radius:var(--r-full);background:var(--soft);display:grid;place-items:center;font-size:var(--fs-small);line-height:1;font-weight:var(--fw-bold);color:var(--tx);font-variant-numeric:tabular-nums;flex:none}
.li.n2{margin-left:calc(var(--wc-d) + var(--s-3))}
.li.n2 .num{width:20px;height:20px;margin-top:5px;font-size:var(--fs-label);background:color-mix(in srgb,var(--hl) 18%,transparent)}

/* divider (Soft): five dots in the five accent inks. One real hr, the dots are its shadows */
.hr{display:block;width:8px;height:8px;margin:var(--s-6) auto;border:0;border-radius:var(--r-full);background:var(--hc);box-shadow:20px 0 0 var(--ha),40px 0 0 var(--hm),60px 0 0 var(--hs),80px 0 0 var(--hl);transform:translateX(-40px)}

/* table (Soft): a tinted header row, hairlines between rows, rounded outline */
.tw{margin:var(--s-4) 0 var(--s-3);border-radius:var(--r-s);box-shadow:0 0 0 1px var(--div);overflow:hidden}
.tw table{width:100%;border-collapse:collapse;font-size:var(--fs-ui);line-height:var(--lh-ui)}
.tw th{padding:var(--s-2) var(--s-4);text-align:left;font-size:var(--fs-small);line-height:var(--lh-small);font-weight:var(--fw-semi);color:var(--tx2);background:var(--tile)}
.tw td{padding:var(--s-3) var(--s-4);border-top:1px solid var(--line)}
.tw td:first-child{font-weight:var(--fw-semi)}
.tw .r{text-align:right;font-variant-numeric:tabular-nums}

/* quote (Editorial) */
.quote{position:relative;display:grid;grid-template-columns:80px minmax(0,1fr);margin:var(--s-5) 0 var(--s-6);padding:var(--s-5) 0;border-top:3px solid var(--tx);border-bottom:1px solid var(--tx)}
.quote .qm{height:62px;font-size:118px;line-height:92px;font-weight:var(--fw-heavy);letter-spacing:-.05em;color:var(--qm,color-mix(in srgb,var(--accent) 60%,var(--tx)))}
.quote p{font-size:var(--fs-quote);line-height:var(--lh-quote);font-weight:var(--fw-bold);letter-spacing:-.034em;text-wrap:pretty}
/* light theme: the big quote mark is plain text colour, not the accent */
.wr:not([data-theme="dark"]) .quote .qm{color:var(--tx)}

/* callouts (Retro print): flat spot-ink blocks, square corners, heavy heading; one solid bar on the left in the same colour as the block */
.co{--c:color-mix(in srgb,var(--tx) 62%,transparent);--ct:var(--tg);--ic:var(--tx2);position:relative;margin:var(--s-4) 0;padding:var(--s-3) var(--s-4) var(--s-4) var(--s-5);background:var(--ct)}
.co.info{--c:var(--i1);--ct:var(--t1);--ic:var(--d1)}
.co.tip{--c:var(--i2);--ct:var(--t2);--ic:var(--d2)}
.co.warn{--c:var(--i2);--ct:var(--t2);--ic:var(--d2)}
.co.danger{--c:color-mix(in srgb,var(--i1) 48%,var(--i2));--ct:color-mix(in srgb,var(--i1) 12%,var(--t2));--ic:var(--tx)}
.co:before{content:"";position:absolute;left:0;top:0;bottom:0;width:6px;background:var(--c)}
.co .ch{display:flex;align-items:center;gap:var(--s-2);min-height:28px;font-size:var(--fs-ui);line-height:var(--lh-ui);font-weight:var(--fw-heavy);letter-spacing:-.008em}
.co .ch .ic{color:var(--ic);stroke-width:2.4}
.co .ch .fold{margin-left:auto;width:26px;height:26px;padding:7px;background:color-mix(in srgb,var(--c) 22%,transparent);color:var(--tx);stroke-width:2.6}
.co .cb{margin-top:1px;font-size:var(--fs-ui);line-height:var(--lh-callout);text-wrap:pretty}
.co .cb .li{font-size:var(--fs-ui);line-height:var(--lh-callout);margin-bottom:0}
.co .cb .bul{margin-top:9px;background:var(--d1)}
.co.shut{padding-bottom:var(--s-3)}

/* code (Quiet minimal): a grey tile, a small muted label, bold keywords and nothing else */
.codeb{margin:var(--s-4) 0;border-radius:var(--r-s);background:var(--tile)}
.ctop{display:flex;align-items:center;justify-content:space-between;height:36px;padding:0 var(--s-3) 0 var(--s-4);font-size:var(--fs-small);line-height:var(--lh-small);font-weight:500;color:var(--tx3)}
.cbody{padding:0 var(--s-4) var(--s-4);font-size:var(--fs-code);line-height:var(--lh-code);white-space:pre;overflow:hidden}
.cbody .k{font-weight:var(--fw-bold)}
.cbody .s{color:var(--tx2)}
.cicon{width:24px;height:24px;display:grid;place-items:center;color:var(--tx3)}
.pill{display:flex;align-items:center;height:20px;padding:0 var(--s-2);border-radius:6px;box-shadow:inset 0 0 0 1px var(--tx3);font-size:var(--fs-label);line-height:var(--lh-label);font-weight:500;color:var(--tx3)}

/* links: Soft pill for note links, Bold blocks type with a thick underline and a globe for web links */
.wl{display:inline-block;padding:0 9px 1px;margin:0 1px;border-radius:var(--r-full);background:var(--soft);color:color-mix(in srgb,var(--link) 84%,var(--tx));font-size:.94em;font-weight:var(--fw-semi);line-height:25px}
.wl.web{display:inline;padding:0;margin:0;border-radius:0;background:none;font-size:1em;font-weight:var(--fw-bold);line-height:inherit;color:var(--tx);white-space:nowrap}
.wl.web svg{display:inline-block;vertical-align:-3px;margin-right:var(--s-1);color:var(--tx);stroke-width:2.4}
.wl.web .u{text-decoration:underline;text-decoration-color:var(--accent);text-decoration-thickness:4px;text-underline-offset:3px;text-decoration-skip-ink:none}

/* file blocks (Playful): little tickets with a notch each side, a slight tilt, a coloured type tile */
.files{display:flex;flex-wrap:wrap;gap:20px var(--s-4);margin:var(--s-5) 0 var(--s-3)}
.fchip{position:relative;display:flex;align-items:center;gap:var(--s-3);height:56px;padding:0 20px 0 10px;background:var(--fpaper);color:var(--tx);border-radius:8px 6px 9px 6px/6px 9px 6px 8px;box-shadow:var(--fshadow);transform:rotate(-1.2deg)}
.fchip:nth-child(2){transform:rotate(.9deg)}
.fchip:nth-child(3){transform:rotate(-.5deg)}
.fchip:before,.fchip:after{content:"";position:absolute;top:50%;width:10px;height:10px;margin-top:-5px;border-radius:50%;background:var(--ed)}
.fchip:before{left:-5px}
.fchip:after{right:-5px}
.ftype{width:36px;height:38px;border-radius:5px 8px 5px 7px/7px 5px 8px 5px;display:grid;place-items:center;font-size:var(--fs-label);font-weight:var(--fw-heavy);color:#fff;background:var(--fc)}
.fmeta{display:block}
.fname{display:block;font-size:var(--fs-small);line-height:var(--lh-small);font-weight:var(--fw-bold)}
.fsize{display:block;font-size:var(--fs-label);line-height:var(--lh-label);color:var(--tx2)}
.fchip.miss{background:transparent;color:var(--tx2);box-shadow:none;border:2px dashed color-mix(in srgb,var(--hc) 75%,transparent);padding-left:var(--s-4);transform:rotate(.6deg)}
.fchip.miss:before,.fchip.miss:after{display:none}
.fchip.miss svg{color:var(--hc)}
.fchip.miss .fname{color:var(--tx2);font-weight:500}
.tsel{position:relative;background:var(--selbg)}
.ft{position:absolute;left:50%;bottom:calc(100% + var(--s-3));transform:translateX(-50%);display:flex;align-items:center;gap:var(--s-1);padding:var(--s-1);border-radius:var(--r-l);background:var(--pop);border:1px solid var(--line);box-shadow:var(--shadow);white-space:nowrap;font-size:var(--fs-small);line-height:var(--lh-small);font-weight:var(--fw-regular);color:var(--tx);letter-spacing:0}
.fb{height:var(--ctl);min-width:var(--ctl);padding:0 var(--s-2);display:flex;align-items:center;justify-content:center;gap:var(--s-1);border-radius:var(--r-s);color:var(--tx2)}
.fb.txt{color:var(--tx)}
.fb b{font-weight:var(--fw-bold);color:var(--tx)}
.fb i{font-style:italic;font-family:'Inter',system-ui,sans-serif;color:var(--tx)}
.fb s{text-decoration:line-through;color:var(--tx)}
.fs{width:1px;height:var(--s-4);margin:0 var(--s-1);background:var(--line)}

/* images (version 1): left, centre or right on their own line. Click an image to select it, the bar above it sets the position.
   Selected look: ring and four corner handles in the deep accent (--fold), so they stay 3:1 on the white page, even for yellow */
.phw{position:relative;width:var(--pw);max-width:100%;margin:var(--s-7) 0 var(--s-5)}
.phw.c{margin-left:auto;margin-right:auto}
.phw.r{margin-left:auto}
.ph{position:relative;display:block;width:100%;aspect-ratio:16/10;overflow:hidden;border-radius:var(--r-s);background:linear-gradient(180deg,var(--sk1),var(--sk2));transition:box-shadow var(--t-fast) var(--ease-move)}
.ph svg{width:100%;height:100%}
.ph:after{content:"";position:absolute;left:0;top:0;right:0;bottom:0;border-radius:inherit;box-shadow:inset 0 0 0 1px var(--line);pointer-events:none}
.phw:not(.on) .ph:hover{box-shadow:0 0 0 2px var(--div)}
.phw.on .ph{box-shadow:0 0 0 2px var(--fold)}
.phh{display:none;position:absolute;width:12px;height:12px;border-radius:3px;background:#fff;border:1.5px solid var(--fold);pointer-events:none}
.phw.on .phh{display:block}
.phh.tl{left:-6px;top:-6px}
.phh.tr{right:-6px;top:-6px}
.phh.bl{left:-6px;bottom:-6px}
.phh.br{right:-6px;bottom:-6px}
.phbar{display:none;position:absolute;left:50%;bottom:calc(100% + var(--s-1));transform:translateX(-50%);align-items:center;gap:var(--s-1);padding:var(--s-1);border-radius:var(--r-l);background:var(--pop);border:1px solid var(--line);box-shadow:var(--shadow);white-space:nowrap;z-index:2}
.phw.on .phbar{display:flex}
.phbar .fb[aria-pressed="true"]{background:var(--sel-bg);color:var(--tx)}

/* colour and highlights: five soft blocks behind the text (--mk1 to --mk5), five text colours (--tc1 to --tc5) */
.mk{padding:1px 4px;margin:0 -1px;border-radius:4px;-webkit-box-decoration-break:clone;box-decoration-break:clone;background:var(--mkc,var(--mk1))}
.mk.m2{--mkc:var(--mk2)}
.mk.m3{--mkc:var(--mk3)}
.mk.m4{--mkc:var(--mk4)}
.mk.m5{--mkc:var(--mk5)}
.wr .fc1{color:var(--tc1)}
.wr .fc2{color:var(--tc2)}
.wr .fc3{color:var(--tc3)}
.wr .fc4{color:var(--tc4)}
.wr .fc5{color:var(--tc5)}
/* tabs: a quiet strip under the note. Same colour as the page, one hairline above, grey text; the open tab gets the same soft tint as the name field */
.tabs{position:absolute;left:0;right:0;bottom:0;height:var(--tabs-h);display:flex;align-items:center;gap:var(--s-1);padding:0 var(--s-2);background:var(--ed);box-shadow:inset 0 1px 0 var(--line)}
.tab{display:flex;align-items:center;gap:var(--s-2);height:var(--wc-d);max-width:200px;padding:0 var(--s-3);border-radius:var(--r-s);font-size:var(--fs-small);line-height:var(--lh-small);font-weight:var(--fw-regular);color:var(--tx3)}
.tab .tn{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tab .ic{color:var(--tx3)}
.tab.on{background:color-mix(in srgb,var(--tx) 6%,transparent);color:var(--tx)}
.tnew{width:var(--wc-d);height:var(--wc-d);display:grid;place-items:center;border-radius:var(--r-s);color:var(--tx3);flex:none}
.tnew:hover{color:var(--tx)}
/* rounded window: one hairline drawn over the edge so the corners stay crisp on any backdrop */
.wr:after{content:"";position:absolute;left:0;top:0;right:0;bottom:0;border-radius:inherit;box-shadow:inset 0 0 0 1px var(--div);pointer-events:none;z-index:60}

@media (prefers-reduced-motion:reduce){.wr *{transition-duration:var(--t-instant)!important}.vmenu,.lmenu{animation:none}}
```

## Icons

Every icon is a line drawing on a 24 by 24 grid unless it says otherwise. Default look: no fill, stroke is the current text colour, stroke width 2, round ends and joins (the `.ic` rule in the style code). Sizes: 12 (`xs`, stroke 2.2), 16 (`m`), 20 (default), 24 (`xl`). Tile icons are drawn at 22 with stroke 2.1. The window control icons sit on a 10 by 10 grid at stroke 1.7. The checklist tick is stroke 3.2. Callout chevrons are stroke 2.4 and the fold button 2.6. The web link globe is stroke 2.4.

Each line below gives the icon's name, the attributes of its svg element, and what is inside it. Copy the markup as it is.

1. Sidebar toggle (toolbar): `class="ic" viewBox="0 0 24 24" aria-hidden="true"` `<rect x="3" y="4" width="18" height="16" rx="2.5"></rect><path d="M9.5 4v16"></path>`
2. Back: `class="ic" viewBox="0 0 24 24" aria-hidden="true"` `<path d="M15 5l-7 7 7 7"></path>`
3. Forward and folder expand (chevron right): `class="ic" viewBox="0 0 24 24" aria-hidden="true"` `<path d="M9 5l7 7-7 7"></path>`
4. New note (compose): `class="ic" viewBox="0 0 24 24" aria-hidden="true"` `<path d="M12 4H6.5A2.5 2.5 0 0 0 4 6.5v11A2.5 2.5 0 0 0 6.5 20h11a2.5 2.5 0 0 0 2.5-2.5V12"></path><path d="M17.6 3.9a1.9 1.9 0 0 1 2.7 2.7l-8 8-3.6.9.9-3.6z"></path>`
5. Minimise (10 px grid): `viewBox="0 0 10 10" aria-hidden="true"` `<path d="M0.5 5h9"></path>`
6. Maximise (10 px grid): `viewBox="0 0 10 10" aria-hidden="true"` `<rect x=".5" y=".5" width="9" height="9" rx="2"></rect>`
7. Close (10 px grid): `viewBox="0 0 10 10" aria-hidden="true"` `<path d="M.5 .5l9 9M9.5 .5l-9 9"></path>`
8. Notes tile: `class="ic xl" viewBox="0 0 24 24" aria-hidden="true"` `<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"></path><path d="M14 3v5h5"></path><path d="M9 13h6M9 17h4"></path>`
9. Inbox tile: `class="ic xl" viewBox="0 0 24 24" aria-hidden="true"` `<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"></polyline><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path>`
10. Tags tile: `class="ic xl" viewBox="0 0 24 24" aria-hidden="true"` `<path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"></path><circle cx="7.5" cy="7.5" r="1.2"></circle>`
11. Search tile: `class="ic xl" viewBox="0 0 24 24" aria-hidden="true"` `<circle cx="11" cy="11" r="7"></circle><path d="M20 20l-3.6-3.6"></path>`
12. Archive tile: `class="ic xl" viewBox="0 0 24 24" aria-hidden="true"` `<rect x="3" y="4" width="18" height="5" rx="1.5"></rect><path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9"></path><path d="M10 13h4"></path>`
13. Trash tile: `class="ic xl" viewBox="0 0 24 24" aria-hidden="true"` `<path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="M6 6l1 14h10l1-14"></path><path d="M10 10.5v6M14 10.5v6"></path>`
14. Folder, closed (tinted): `class="ic fi fshut" viewBox="0 0 24 24" aria-hidden="true"` `<path class="fbk" d="M3 7.5A2.5 2.5 0 0 1 5.5 5h3.4a2 2 0 0 1 1.5.7l1.1 1.3h7A2.5 2.5 0 0 1 21 9.5v8A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5z"></path><path class="ffr" d="M3 11h18v6.5a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"></path><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h3.4a2 2 0 0 1 1.5.7l1.1 1.3h7A2.5 2.5 0 0 1 21 9.5v8A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5z"></path><path d="M3 11h18"></path>`
15. Folder, open (tinted): `class="ic fi fopen" viewBox="0 0 24 24" aria-hidden="true"` `<path class="fbk" d="M3 17.5v-10A2.5 2.5 0 0 1 5.5 5h3.4a2 2 0 0 1 1.5.7l1.1 1.3h6.5A2.5 2.5 0 0 1 20.5 9.5V11H7.2a2 2 0 0 0-1.9 1.4z"></path><path d="M3 17.5v-10A2.5 2.5 0 0 1 5.5 5h3.4a2 2 0 0 1 1.5.7l1.1 1.3h6.5A2.5 2.5 0 0 1 20.5 9.5V11"></path><path class="ffr" d="M5.3 12.4A2 2 0 0 1 7.2 11h13.9a1.5 1.5 0 0 1 1.45 1.9l-1.7 6A2.5 2.5 0 0 1 18.4 20H5.5A2.5 2.5 0 0 1 3 17.5z"></path><path d="M5.3 12.4A2 2 0 0 1 7.2 11h13.9a1.5 1.5 0 0 1 1.45 1.9l-1.7 6A2.5 2.5 0 0 1 18.4 20H5.5A2.5 2.5 0 0 1 3 17.5"></path>`
16. Switch vault (small): `class="ic xs" viewBox="0 0 24 24" aria-hidden="true"` `<path d="M7 15l5 5 5-5M7 9l5-5 5 5"></path>`
17. Settings: `class="ic" viewBox="0 0 24 24" aria-hidden="true"` `<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle>`
18. Check mark in menus: `class="ic m ck {{ckP}}" viewBox="0 0 24 24" aria-hidden="true"` `<path d="M5 12.5l4.2 4.2L19 7"></path>`
19. Plus (add vault): `class="ic xs" viewBox="0 0 24 24" aria-hidden="true"` `<path d="M12 5v14M5 12h14"></path>`
20. Pane toggle with chevron (notes pane header): `class="ic" viewBox="0 0 24 24" aria-hidden="true"` `<rect x="3" y="4" width="18" height="16" rx="2.5"></rect><path d="M9 4v16"></path><path class="cho" d="M16 9l-3 3 3 3"></path><path class="chs" d="M13 9l3 3-3 3"></path>`
21. Sort: `class="ic" viewBox="0 0 24 24" aria-hidden="true"` `<path d="M7 4v16M7 20l-3-3M7 20l3-3M17 20V4M17 4l-3 3M17 4l3 3"></path>`
22. Three dots, horizontal (menu button, filled): `class="ic" viewBox="0 0 24 24" aria-hidden="true" style="fill:currentColor;stroke:none"` `<circle cx="5" cy="12" r="2.1"></circle><circle cx="12" cy="12" r="2.1"></circle><circle cx="19" cy="12" r="2.1"></circle>`
23. Pin (small): `class="ic xs" viewBox="0 0 24 24" aria-hidden="true"` `<path d="M12 17v5M8 3h8l-1 6 3 3v2H6v-2l3-3z"></path>`
24. Duplicate: `class="ic m" viewBox="0 0 24 24" aria-hidden="true"` `<rect x="9" y="9" width="11" height="11" rx="2"></rect><path d="M5 15V6a2 2 0 0 1 2-2h8"></path>`
25. Move to folder: `class="ic m" viewBox="0 0 24 24" aria-hidden="true"` `<path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><path d="M9 13h6M12.5 10.5L15 13l-2.5 2.5"></path>`
26. Pop out: `class="ic m" viewBox="0 0 24 24" aria-hidden="true"` `<path d="M14 4h6v6"></path><path d="M20 4l-8 8"></path><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"></path>`
27. Share: `class="ic m" viewBox="0 0 24 24" aria-hidden="true"` `<path d="M12 15V3"></path><path d="M8 7l4-4 4 4"></path><path d="M8 11H6.5A1.5 1.5 0 0 0 5 12.5v6A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5v-6a1.5 1.5 0 0 0-1.5-1.5H16"></path>`
28. Export as: `class="ic m" viewBox="0 0 24 24" aria-hidden="true"` `<path d="M12 4v11"></path><path d="M8 11l4 4 4-4"></path><path d="M5 20h14"></path>`
29. Show in File Explorer: `class="ic m" viewBox="0 0 24 24" aria-hidden="true"` `<rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="M3 10h18"></path>`
30. Chevron down (small): `class="ic xs" viewBox="0 0 24 24" aria-hidden="true"` `<path d="M6 9l6 6 6-6"></path>`
31. Bullet list (floating toolbar): `class="ic m" viewBox="0 0 24 24" aria-hidden="true"` `<path d="M9 6h11M9 12h11M9 18h11"></path><circle cx="4.5" cy="6" r="1"></circle><circle cx="4.5" cy="12" r="1"></circle><circle cx="4.5" cy="18" r="1"></circle>`
32. Link: `class="ic m" viewBox="0 0 24 24" aria-hidden="true"` `<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"></path><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"></path>`
33. More (three dots, floating toolbar): `class="ic m" viewBox="0 0 24 24" aria-hidden="true"` `<circle cx="5" cy="12" r="1.3"></circle><circle cx="12" cy="12" r="1.3"></circle><circle cx="19" cy="12" r="1.3"></circle>`
34. Block grip (six dots, filled): `class="ic m" viewBox="0 0 24 24" aria-hidden="true" style="fill:currentColor;stroke:none"` `<circle cx="9" cy="6" r="1.9"></circle><circle cx="15" cy="6" r="1.9"></circle><circle cx="9" cy="12" r="1.9"></circle><circle cx="15" cy="12" r="1.9"></circle><circle cx="9" cy="18" r="1.9"></circle><circle cx="15" cy="18" r="1.9"></circle>`
35. Callout: tip: `class="ic m" viewBox="0 0 24 24" aria-hidden="true"` `<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"></path><path d="M9 18h6"></path><path d="M10 22h4"></path>`
36. Callout: warning: `class="ic m" viewBox="0 0 24 24" aria-hidden="true"` `<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path>`
37. Callout: danger: `class="ic m" viewBox="0 0 24 24" aria-hidden="true"` `<path d="M12 16h.01"></path><path d="M12 8v4"></path><path d="M15.312 2a2 2 0 0 1 1.414.586l4.688 4.688A2 2 0 0 1 22 8.688v6.624a2 2 0 0 1-.586 1.414l-4.688 4.688a2 2 0 0 1-1.414.586H8.688a2 2 0 0 1-1.414-.586l-4.688-4.688A2 2 0 0 1 2 15.312V8.688a2 2 0 0 1 .586-1.414l4.688-4.688A2 2 0 0 1 8.688 2z"></path>`
38. Align left: `class="ic m" viewBox="0 0 24 24" aria-hidden="true"` `<path d="M4 6h16M4 12h10M4 18h14"></path>`
39. Centre: `class="ic m" viewBox="0 0 24 24" aria-hidden="true"` `<path d="M4 6h16M7 12h10M5 18h14"></path>`
40. Align right: `class="ic m" viewBox="0 0 24 24" aria-hidden="true"` `<path d="M4 6h16M10 12h10M6 18h14"></path>`
41. Remove from note: `class="ic m" viewBox="0 0 24 24" aria-hidden="true"` `<path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="M6 6l1 14h10l1-14"></path>`
42. Web link globe: `class="ic m" viewBox="0 0 24 24" aria-hidden="true"` `<circle cx="12" cy="12" r="9"></circle><path d="M3 12h18"></path><path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18z"></path>`
43. Slash menu: Heading: `class="ic" viewBox="0 0 24 24" aria-hidden="true"` `<path d="M4 12h8"></path><path d="M4 18V6"></path><path d="M12 18V6"></path><path d="M17 12l3-2v8"></path>`
44. Slash menu: Subheading: `class="ic" viewBox="0 0 24 24" aria-hidden="true"` `<path d="M4 12h8"></path><path d="M4 18V6"></path><path d="M12 18V6"></path><path d="M21 18h-4c0-4 4-3 4-6 0-1.5-2-2.5-4-1"></path>`
45. Slash menu: Quote: `class="ic" viewBox="0 0 24 24" aria-hidden="true"` `<path d="M5 5v14"></path><path d="M10 8h9"></path><path d="M10 12h9"></path><path d="M10 16h5"></path>`
46. Slash menu: Numbered list: `class="ic" viewBox="0 0 24 24" aria-hidden="true"` `<path d="M10 6h11M10 12h11M10 18h11"></path><path d="M4 6h1v4"></path><path d="M4 10h2"></path><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"></path>`
47. Slash menu: Task list: `class="ic" viewBox="0 0 24 24" aria-hidden="true"` `<path d="M3 17l2 2 4-4"></path><path d="M3 7l2 2 4-4"></path><path d="M13 6h8"></path><path d="M13 12h8"></path><path d="M13 18h8"></path>`
48. Slash menu: Table: `class="ic" viewBox="0 0 24 24" aria-hidden="true"` `<rect x="3" y="4" width="18" height="16" rx="2"></rect><path d="M3 10h18"></path><path d="M10 4v16"></path>`
49. Slash menu: Code block: `class="ic" viewBox="0 0 24 24" aria-hidden="true"` `<path d="M18 16l4-4-4-4"></path><path d="M6 8l-4 4 4 4"></path><path d="M14.5 4l-5 16"></path>`
50. Slash menu: Callout (also the info callout icon): `class="ic" viewBox="0 0 24 24" aria-hidden="true"` `<circle cx="12" cy="12" r="9"></circle><path d="M12 11v5"></path><path d="M12 8h.01"></path>`
51. Slash menu: Divider: `class="ic" viewBox="0 0 24 24" aria-hidden="true"` `<path d="M3 12h3"></path><path d="M10.5 12h3"></path><path d="M18 12h3"></path>`
52. Slash menu: Image: `class="ic" viewBox="0 0 24 24" aria-hidden="true"` `<rect x="3" y="3" width="18" height="18" rx="2"></rect><circle cx="9" cy="9" r="2"></circle><path d="M21 15l-3.1-3.1a2 2 0 0 0-2.8 0L6 21"></path>`
53. Close mark (tabs, small): `class="ic xs" viewBox="0 0 24 24" aria-hidden="true"` `<path d="M6 6l12 12M18 6L6 18"></path>`
