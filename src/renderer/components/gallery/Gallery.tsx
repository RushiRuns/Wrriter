import React, { useState } from 'react';
import * as Icons from '../icons';
import '../../styles/tokens.css';
import '../../styles/components.css';

export const ComponentGallery: React.FC = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [accent, setAccent] = useState<'sky' | 'yellow' | 'coral' | 'mint' | 'lilac'>('sky');
  const [reducedMotion, setReducedMotion] = useState(false);
  const [slowMotion, setSlowMotion] = useState(false);
  const [folderOpen, setFolderOpen] = useState(true);
  const [selectedNote, setSelectedNote] = useState(0);
  const [checkedTask, setCheckedTask] = useState(true);
  const [calloutFolded, setCalloutFolded] = useState(false);

  return (
    <div
      className="wr"
      data-theme={theme}
      data-accent={accent}
      data-reduced-motion={reducedMotion ? 'true' : undefined}
      data-slow-motion={slowMotion ? 'true' : undefined}
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bar)'
      }}
    >
      {/* --------------------------------------------------------------------
          Gallery Controls Bar
          -------------------------------------------------------------------- */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          background: 'var(--pop)',
          borderBottom: '1px solid var(--div)',
          padding: '8px 16px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '16px',
          boxShadow: 'var(--shadow)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: 'var(--fs-small)', fontWeight: 'var(--fw-bold)', color: 'var(--tx)' }}>
            Theme:
          </span>
          <button
            onClick={() => setTheme('light')}
            className={`tab ${theme === 'light' ? 'on' : ''}`}
            style={{ height: '24px', padding: '0 8px' }}
          >
            Light
          </button>
          <button
            onClick={() => setTheme('dark')}
            className={`tab ${theme === 'dark' ? 'on' : ''}`}
            style={{ height: '24px', padding: '0 8px' }}
          >
            Dark
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: 'var(--fs-small)', fontWeight: 'var(--fw-bold)', color: 'var(--tx)' }}>
            Accent:
          </span>
          {(['sky', 'yellow', 'coral', 'mint', 'lilac'] as const).map(acc => (
            <button
              key={acc}
              onClick={() => setAccent(acc)}
              className={`tab ${accent === acc ? 'on' : ''}`}
              style={{
                height: '24px',
                padding: '0 8px',
                textTransform: 'capitalize'
              }}
            >
              {acc}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--fs-small)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={reducedMotion}
              onChange={e => setReducedMotion(e.target.checked)}
            />
            Reduced Motion
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--fs-small)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={slowMotion}
              onChange={e => setSlowMotion(e.target.checked)}
            />
            Slow-Motion (5x)
          </label>
        </div>
      </div>

      {/* --------------------------------------------------------------------
          App Shell Simulation (Toolbar, Sidebar, Note List, Editor, Tabs)
          -------------------------------------------------------------------- */}
      <div style={{ position: 'relative', height: '800px', display: 'flex', flexDirection: 'column', borderBottom: '1px solid var(--div)' }}>
        {/* Toolbar */}
        <div className="tbw" style={{ position: 'relative' }}>
          <div className="tb">
            <button className="sbt" aria-expanded="true" title="Toggle Sidebar">
              <Icons.SidebarToggleIcon />
            </button>
            <div className="tbl" style={{ marginLeft: 'var(--sbt-w)' }}>
              <button className="ib" title="Back"><Icons.BackIcon /></button>
              <button className="ib dim" title="Forward"><Icons.ForwardIcon /></button>
            </div>
            <div className="tbmid">
              <div className="tbpill">
                <div className="pnb">
                  <span className="pn">Personal / Projects / Wrriter Architecture</span>
                </div>
              </div>
            </div>
            <button className="tbnew ib" title="New Note">
              <Icons.NewNoteIcon />
            </button>
            <div className="wc">
              <button className="mn" title="Minimize"><Icons.MinimiseIcon /></button>
              <button className="mx" title="Maximize"><Icons.MaximiseIcon /></button>
              <button className="x" title="Close"><Icons.CloseIcon /></button>
            </div>
          </div>
        </div>

        {/* Panes Container */}
        <div className="main" style={{ flex: 1, minHeight: 0 }}>
          {/* Sidebar */}
          <aside className="side">
            <div className="sin">
              <div className="tiles">
                <button className="tile on" title="Notes"><Icons.NotesTileIcon /></button>
                <button className="tile" title="Inbox"><Icons.InboxTileIcon /></button>
                <button className="tile" title="Tags"><Icons.TagsTileIcon /></button>
              </div>
              <div className="sep" />
              <div className="lbl">Folders</div>
              <div className="tree">
                <div className="fr sel">
                  <span className="fslot">
                    <span className="ftg" aria-expanded={folderOpen} onClick={() => setFolderOpen(!folderOpen)}>
                      <Icons.ChevronRightIcon className="cv" />
                      {folderOpen ? <Icons.FolderOpenIcon /> : <Icons.FolderClosedIcon />}
                    </span>
                  </span>
                  <span className="nm">Projects</span>
                  <span className="ct">5</span>
                </div>
                {folderOpen && (
                  <>
                    <div className="fr d1">
                      <span className="fslot">
                        <Icons.FolderClosedIcon />
                      </span>
                      <span className="nm">Wrriter</span>
                      <span className="ct">3</span>
                    </div>
                    <div className="fr d1">
                      <span className="fslot">
                        <Icons.FolderClosedIcon />
                      </span>
                      <span className="nm">Roadmap</span>
                      <span className="ct">2</span>
                    </div>
                  </>
                )}
                <div className="fr">
                  <span className="fslot">
                    <Icons.FolderClosedIcon />
                  </span>
                  <span className="nm">Personal</span>
                  <span className="ct">12</span>
                </div>
              </div>

              {/* Vault Switcher */}
              <div className="vaults">
                <button className="vtrig" aria-expanded="false">
                  <div className="vc p">P</div>
                  <span className="vn">Personal Vault</span>
                  <Icons.SwitchVaultIcon />
                </button>
              </div>
            </div>
          </aside>

          {/* Note List */}
          <section className="list">
            <div className="lh">
              <div className="lt">
                <span className="lname">Projects</span>
              </div>
              <button className="ib" title="Sort"><Icons.SortIcon /></button>
              <button className="ib" title="Menu"><Icons.ThreeDotsHorizontalIcon /></button>
            </div>
            <div className="rows">
              <div className="grp first">Today</div>
              {[
                { title: 'Wrriter Architecture', date: '10:24 AM', pv: 'Security baseline, IpcRouter, and tokens ported directly from UI hand-off.' },
                { title: 'TipTap Editor Serializer', date: 'Yesterday', pv: 'Spike comparing markdown-it vs mdast for byte-for-byte serialization.' },
                { title: 'SQLite Search Index', date: '24 Oct', pv: 'FTS5 prefix indexes and prepared statement benchmarks in utility worker.' }
              ].map((note, idx) => (
                <div
                  key={idx}
                  className={`row ${selectedNote === idx ? 'sel' : ''}`}
                  onClick={() => setSelectedNote(idx)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="rtx">
                    <span className="t1">{note.title}</span>
                    <span className="dt">{note.date}</span>
                    <span className="pv">{note.pv}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Note Pane (Editor View) */}
          <main className="ed">
            <div className="edscroll">
              <article className="col">
                <div className="meta">Created Today · 4,281 words · 18 min read</div>
                <h1 className="ed1">Wrriter Architecture & Design Foundations</h1>

                <div className="props">
                  <span className="htag c1">#architecture</span>
                  <span className="htag c2">#performance</span>
                  <span className="htag c3">#design-tokens</span>
                  <span className="htag c4">#tiptap</span>
                  <span className="htag c5">#offline-first</span>
                </div>

                <p className="edp">
                  Wrriter is a high-performance offline markdown notebook. All notes are saved directly
                  as local plain text files on disk with zero intermediate database lock-in.
                </p>

                {/* Editorial Section Heading */}
                <h2 className="ed2">Foundational Design Tokens</h2>
                <p className="edp">
                  Design tokens define all color palettes, type scales, spacing steps, and animation speeds.
                  Notice that inside the note pane, the accent color is restrained to neutral text greys
                  to preserve a calm, uncluttered reading surface.
                </p>

                {/* Tasks List */}
                <div className="tasks">
                  <div className="task">
                    <div
                      className={`chk ${checkedTask ? 'on' : ''}`}
                      onClick={() => setCheckedTask(!checkedTask)}
                    >
                      {checkedTask && <Icons.CheckIcon />}
                    </div>
                    <span className={checkedTask ? 'done' : ''}>
                      Port tokens.css with Apple Notes neutral palette and 5 accent sets
                    </span>
                  </div>
                  <div className="task">
                    <div className="chk on">
                      <Icons.CheckIcon />
                    </div>
                    <span className="done">Implement automated token, contrast, motion, and dash build checks</span>
                  </div>
                </div>

                {/* Numbered List */}
                <div className="li">
                  <div className="num">1</div>
                  <span>Four transition speeds: 0ms, 100ms, 180ms, 280ms.</span>
                </div>
                <div className="li">
                  <div className="num">2</div>
                  <span>Three easing curves: arrive, move, and leave.</span>
                </div>

                {/* Five-dot divider */}
                <hr className="hr" />

                {/* Editorial Pull Quote */}
                <div className="quote">
                  <div className="qm">“</div>
                  <p>Performance is a precondition, not a feature. A change that breaks a budget is redesigned before it ships.</p>
                </div>

                {/* Callouts */}
                <div className={`co info ${calloutFolded ? 'shut' : ''}`}>
                  <div className="ch">
                    <Icons.SlashCalloutIcon />
                    <span>Info Callout</span>
                    <button className="fold" onClick={() => setCalloutFolded(!calloutFolded)}>
                      <Icons.ChevronDownIcon />
                    </button>
                  </div>
                  {!calloutFolded && (
                    <div className="cb">
                      Callouts preserve their spot-ink accent colors even inside the note pane.
                    </div>
                  )}
                </div>

                <div className="co tip">
                  <div className="ch">
                    <Icons.CalloutTipIcon />
                    <span>Tip: Keyboard Navigation</span>
                  </div>
                  <div className="cb">
                    Press <span className="ic2 mono">Ctrl+Shift+P</span> to summon the command palette instantly.
                  </div>
                </div>

                <div className="co warn">
                  <div className="ch">
                    <Icons.CalloutWarnIcon />
                    <span>Warning: File Safety</span>
                  </div>
                  <div className="cb">
                    Files are atomically replaced using safe temporary files and flushed to disk before rename.
                  </div>
                </div>

                <div className="co danger">
                  <div className="ch">
                    <Icons.CalloutDangerIcon />
                    <span>Danger Notice</span>
                  </div>
                  <div className="cb">
                    Zero telemetry, zero analytics, zero uninvited network requests.
                  </div>
                </div>

                {/* Code Block */}
                <div className="codeb">
                  <div className="ctop">
                    <span>TypeScript</span>
                    <span className="pill">Copy</span>
                  </div>
                  <pre className="cbody mono">
                    <code>{`export function flipGlide(el: HTMLElement, startRect: DOMRect): Animation {\n  const deltaY = startRect.top - el.getBoundingClientRect().top;\n  return el.animate([{ transform: \`translateY(\${deltaY}px)\` }, { transform: 'none' }], {\n    duration: 180,\n    easing: 'cubic-bezier(0.4, 0, 0.2, 1)'\n  });\n}`}</code>
                  </pre>
                </div>

                {/* Links */}
                <p className="edp">
                  Refer to the internal architecture document <span className="wl">[[ARCHITECTURE]]</span> or visit the official site{' '}
                  <span className="wl web">
                    <Icons.WebLinkGlobeIcon />
                    <span className="u">https://syncthing.net</span>
                  </span>.
                </p>

                {/* File Blocks */}
                <div className="files">
                  <div className="fchip">
                    <div className="ftype">PDF</div>
                    <div className="fmeta">
                      <span className="fname">Wrriter_v1_Specification.pdf</span>
                      <span className="fsize">2.4 MB · Document</span>
                    </div>
                  </div>
                  <div className="fchip">
                    <div className="ftype" style={{ background: 'var(--vault-w)' }}>TS</div>
                    <div className="fmeta">
                      <span className="fname">tokens.css</span>
                      <span className="fsize">4.8 KB · Stylesheet</span>
                    </div>
                  </div>
                </div>
              </article>
            </div>

            {/* Tabs Bar */}
            <div className="tabs">
              <div className="tab on">
                <span className="tn">Wrriter Architecture</span>
                <Icons.TabCloseIcon />
              </div>
              <div className="tab">
                <span className="tn">TipTap Editor Serializer</span>
                <Icons.TabCloseIcon />
              </div>
              <button className="tnew" title="New Tab">
                <Icons.PlusIcon />
              </button>
            </div>
          </main>
        </div>
      </div>

      {/* --------------------------------------------------------------------
          Icon Set Showcase: All 53 Icons
          -------------------------------------------------------------------- */}
      <section style={{ padding: '32px 24px', background: 'var(--side)' }}>
        <h2 style={{ fontSize: 'var(--fs-h2)', fontWeight: 'var(--fw-bold)', marginBottom: '16px', color: 'var(--tx)' }}>
          Inline SVG Icon Set (53 Icons)
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: '12px'
          }}
        >
          {Object.entries(Icons).map(([name, Component]) => {
            if (typeof Component !== 'function') return null;
            const IconComp = Component as React.FC<any>;
            return (
              <div
                key={name}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '12px 8px',
                  background: 'var(--pop)',
                  borderRadius: 'var(--r-s)',
                  boxShadow: 'var(--shadow)',
                  color: 'var(--tx)'
                }}
              >
                <div style={{ color: 'var(--accent)', display: 'grid', placeItems: 'center', width: '28px', height: '28px' }}>
                  <IconComp />
                </div>
                <span
                  style={{
                    fontSize: '11px',
                    lineHeight: '14px',
                    color: 'var(--tx2)',
                    textAlign: 'center',
                    wordBreak: 'break-word'
                  }}
                >
                  {name.replace('Icon', '')}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
