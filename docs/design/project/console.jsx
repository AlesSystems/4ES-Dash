// Direction 3 — "Console"
// Terminal/CRT character, modern restraint. Monospace headings, grid-paper bg,
// single phosphor accent. Dark = amber on black. Light = espresso ink on cream.

const CN_TOKENS = {
  dark: {
    bg: '#0a0c0a',
    bg2: '#0e110e',
    panel: '#101310',
    panel2: '#141813',
    line: '#1f2520',
    line2: '#2c332c',
    text: '#d4ddd2',
    text2: '#8b948a',
    text3: '#5a625a',
    accent: '#ffb547',          // amber phosphor
    accentGlow: 'rgba(255,181,71,0.18)',
    up: '#7ce38b',
    down: '#ff6b6b',
    gridStroke: 'rgba(120,140,118,0.05)',
    scanline: 'rgba(255,181,71,0.018)',
    chip: '#181c18',
  },
  light: {
    bg: '#f0e9d6',              // drafting paper cream
    bg2: '#ebe3cd',
    panel: '#f7f1de',
    panel2: '#f2ebd4',
    line: '#d8ceb3',
    line2: '#bfb497',
    text: '#1c1a14',            // espresso
    text2: '#5a5340',
    text3: '#8a8067',
    accent: '#a63c1b',          // letterpress red
    accentGlow: 'rgba(166,60,27,0.10)',
    up: '#3d6b30',
    down: '#a63c1b',
    gridStroke: 'rgba(60,50,30,0.08)',
    scanline: 'transparent',
    chip: '#ebe3cd',
  },
};

const CN_MONO = `"JetBrains Mono", "IBM Plex Mono", ui-monospace, "SF Mono", Menlo, monospace`;
const CN_SANS = `"Inter", -apple-system, system-ui, sans-serif`;

function CnIcon({ d, size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

const CN_ICONS = {
  search: 'M7 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM14 14l-3.5-3.5',
  sun: 'M8 4.5V3M8 13v-1.5M3.5 8H2M14 8h-1.5M5 5L4 4M12 12l-1-1M5 11l-1 1M12 4l-1 1M8 6a2 2 0 1 1 0 4 2 2 0 0 1 0-4z',
  bell: 'M4 7a4 4 0 0 1 8 0v3l1 2H3l1-2zM6.5 13a1.5 1.5 0 0 0 3 0',
  cursor: 'M2 2l5 12 2-5 5-2z',
  arrowUp: 'M3 10l5-5 5 5',
  arrowDown: 'M3 6l5 5 5-5',
  dot: 'M8 8h.01',
  arrowRight: 'M3 8h10M9 4l4 4-4 4',
  chevron: 'M6 4l4 4-4 4',
  terminal: 'M2 3h12v10H2zM4 7l2 1.5L4 10M8 10h3',
};

// pads "12" → "  12" so number columns align
const pad = (n, w) => String(n).padStart(w, ' ').replace(/ /g, '\u2007'); // figure space

function CnBar({ pct, w = 200, h = 10, t, label, lit = false }) {
  // Discrete block bar like a HUD meter.
  const blocks = 24;
  const filled = Math.round(blocks * pct);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 1, fontFamily: CN_MONO, lineHeight: 1 }}>
      {Array.from({ length: blocks }, (_, i) => (
        <span key={i} style={{
          display: 'inline-block', width: w / blocks - 1, height: h,
          background: i < filled ? (lit ? t.accent : t.text2) : t.line,
          opacity: i < filled ? 1 : 0.6,
        }} />
      ))}
    </div>
  );
}

function CnDelta({ value, unit, t }) {
  const sign = value > 0 ? '+' : value < 0 ? '-' : '±';
  const abs = Math.abs(value);
  const color = value > 0 ? t.up : value < 0 ? t.down : t.text3;
  const arrow = value > 0 ? '▲' : value < 0 ? '▼' : '◆';
  return (
    <span style={{ color, fontFamily: CN_MONO, fontSize: 12, fontVariantNumeric: 'tabular-nums', letterSpacing: 0 }}>
      <span style={{ fontSize: 9, marginRight: 4 }}>{arrow}</span>
      {sign}{abs}{unit ? ' ' + unit : ''}
    </span>
  );
}

function Console({ theme = 'dark' }) {
  const t = CN_TOKENS[theme];
  const s = window.STEAM;
  const topMax = Math.max(...s.top.map(g => g.hours));

  return (
    <div data-screen-label={`Console · ${theme}`} style={{
      width: 1440, minHeight: 1100, background: t.bg, color: t.text,
      fontFamily: CN_SANS, fontSize: 13,
      position: 'relative',
      backgroundImage: `
        linear-gradient(${t.gridStroke} 1px, transparent 1px),
        linear-gradient(90deg, ${t.gridStroke} 1px, transparent 1px)
      `,
      backgroundSize: '24px 24px',
    }}>
      {/* scanline overlay (dark only) */}
      {theme === 'dark' && (
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1,
          background: `repeating-linear-gradient(0deg, ${t.scanline} 0 1px, transparent 1px 3px)`,
        }} />
      )}

      {/* APP BAR */}
      <div style={{
        height: 56, borderBottom: `1px solid ${t.line2}`,
        background: t.bg,
        display: 'flex', alignItems: 'center', padding: '0 20px', gap: 24,
        position: 'relative', zIndex: 2,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 22, border: `1.5px solid ${t.accent}`, borderRadius: 2,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative',
            boxShadow: theme === 'dark' ? `0 0 12px ${t.accentGlow}` : 'none',
          }}>
            <span style={{ fontFamily: CN_MONO, fontSize: 11, color: t.accent, fontWeight: 700, letterSpacing: '-0.04em' }}>4E</span>
          </div>
          <span style={{ fontFamily: CN_MONO, fontSize: 13, color: t.text, fontWeight: 600, letterSpacing: '-0.01em' }}>4ES-DASH</span>
          <span style={{ fontFamily: CN_MONO, fontSize: 10, color: t.text3, padding: '2px 5px', border: `1px solid ${t.line2}`, borderRadius: 2 }}>tty/2</span>
        </div>
        <nav style={{ display: 'flex', gap: 0, fontFamily: CN_MONO, fontSize: 12, marginLeft: 8 }}>
          {[['dashboard', true], ['library'], ['games'], ['friends']].map(([n, active]) => (
            <span key={n} style={{
              padding: '6px 12px',
              color: active ? t.accent : t.text2,
              background: active ? t.accentGlow : 'transparent',
              border: `1px solid ${active ? t.accent : 'transparent'}`,
              borderRadius: 0,
              marginRight: -1,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              fontWeight: active ? 600 : 400,
            }}>
              {active && '> '}{n}
            </span>
          ))}
        </nav>
        <div style={{ flex: 1 }} />
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
          background: t.panel, border: `1px solid ${t.line2}`, borderRadius: 2,
          width: 300, color: t.text3, fontFamily: CN_MONO,
        }}>
          <span style={{ color: t.accent }}>$</span>
          <span style={{ fontSize: 12, flex: 1 }}>find . -name "*.game"</span>
          <span style={{ fontSize: 10, padding: '1px 5px', border: `1px solid ${t.line2}`, borderRadius: 2 }}>⌘K</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, color: t.text2 }}>
          <CnIcon d={CN_ICONS.bell} size={15} />
          <CnIcon d={CN_ICONS.sun} size={15} />
          <div style={{ width: 28, height: 28, borderRadius: 2, background: `url(${s.user.avatar}) center/cover`, border: `1px solid ${t.line2}` }} />
        </div>
      </div>

      <div style={{ display: 'flex', position: 'relative', zIndex: 2 }}>
        {/* SIDEBAR */}
        <aside style={{ width: 240, borderRight: `1px solid ${t.line2}`, padding: '20px 16px', minHeight: 1044, fontFamily: CN_MONO }}>
          <div style={{ fontSize: 10, color: t.text3, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '0 4px 10px' }}>[ navigation ]</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {[
              ['dashboard', null, true],
              ['library', '312'],
              ['recently_played', '5'],
              ['achievements', '4128'],
              ['friends', '48'],
              ['backlog', '178'],
            ].map(([label, count, active]) => (
              <div key={label} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px',
                color: active ? t.accent : t.text2,
                background: active ? t.accentGlow : 'transparent',
                borderLeft: `2px solid ${active ? t.accent : 'transparent'}`,
                fontSize: 12,
              }}>
                <span style={{ width: 8, color: active ? t.accent : t.text3 }}>{active ? '>' : ' '}</span>
                <span style={{ flex: 1 }}>{label}</span>
                {count && <span style={{ fontSize: 11, color: t.text3, fontVariantNumeric: 'tabular-nums' }}>{count}</span>}
              </div>
            ))}
          </div>
          <div style={{ fontSize: 10, color: t.text3, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '28px 4px 10px' }}>[ lists ]</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {[['to_finish', 12], ['co-op', 6], ['cozy', 9]].map(([l, n]) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', color: t.text2, fontSize: 12 }}>
                <span style={{ width: 8, color: t.text3 }}>·</span>
                <span style={{ flex: 1 }}>{l}</span>
                <span style={{ fontSize: 11, color: t.text3, fontVariantNumeric: 'tabular-nums' }}>{n}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 32, padding: '12px', border: `1px dashed ${t.line2}`, fontSize: 11, color: t.text2, lineHeight: 1.6 }}>
            <div style={{ color: t.text3, marginBottom: 4 }}>// uptime</div>
            <div style={{ color: t.text, fontVariantNumeric: 'tabular-nums' }}>4y 218d <span style={{ color: t.accent }}>online</span></div>
            <div style={{ color: t.text3, marginTop: 8 }}>// sync</div>
            <div style={{ color: t.text }}>OK <span style={{ color: t.text3 }}>(00:42)</span></div>
          </div>
        </aside>

        {/* MAIN */}
        <main style={{ flex: 1, padding: '20px 24px 40px', fontFamily: CN_SANS, position: 'relative' }}>
          {/* Command line breadcrumb */}
          <div style={{ fontFamily: CN_MONO, fontSize: 12, color: t.text3, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: t.accent }}>altan@4es</span>
            <span>:</span>
            <span>~/dashboard</span>
            <span style={{ color: t.accent }}>$</span>
            <span style={{ color: t.text2 }}>status --week</span>
            <span style={{ display: 'inline-block', width: 7, height: 13, background: t.accent, marginLeft: 2, animation: 'none' }} />
          </div>

          {/* Profile strip */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 18, padding: '14px 18px',
            border: `1px solid ${t.line2}`, background: t.panel, marginBottom: 16,
            fontFamily: CN_MONO,
          }}>
            <div style={{ position: 'relative' }}>
              <div style={{ width: 48, height: 48, background: `url(${s.user.avatar}) center/cover`, border: `1px solid ${t.line2}` }} />
              <div style={{ position: 'absolute', bottom: -4, right: -4, padding: '1px 5px', background: t.accent, color: t.bg, fontSize: 10, fontFamily: CN_MONO, fontWeight: 700 }}>47</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 14, color: t.text, fontWeight: 600, letterSpacing: '-0.01em' }}>
                Altan <span style={{ color: t.text3, fontWeight: 400, fontSize: 12 }}>· uid=4128</span>
              </div>
              <div style={{ display: 'flex', gap: 16, fontSize: 11, color: t.text2, fontVariantNumeric: 'tabular-nums' }}>
                <span><span style={{ color: t.text3 }}>joined.</span> 2014</span>
                <span><span style={{ color: t.text3 }}>games.</span> 312</span>
                <span><span style={{ color: t.text3 }}>hours.</span> 2847</span>
                <span><span style={{ color: t.text3 }}>ach.</span> 4128</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 7, height: 7, background: t.up, borderRadius: 0 }} />
                  <span style={{ color: t.up }}>online</span>
                  <span style={{ color: t.text3 }}>· 2m ago</span>
                </span>
              </div>
            </div>
            <div style={{ flex: 1 }} />
            <div style={{ display: 'flex', alignItems: 'center', fontSize: 11, color: t.text3 }}>
              <span style={{ padding: '4px 10px', borderRight: `1px solid ${t.line2}` }}>span:</span>
              {['day','week','month','all'].map((p, i) => (
                <span key={p} style={{
                  padding: '4px 10px',
                  color: i === 1 ? t.accent : t.text2,
                  background: i === 1 ? t.accentGlow : 'transparent',
                  borderRight: i < 3 ? `1px solid ${t.line2}` : 'none',
                  fontWeight: i === 1 ? 600 : 400,
                }}>{i === 1 ? '['+p+']' : p}</span>
              ))}
            </div>
          </div>

          {/* KPI grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, border: `1px solid ${t.line2}`, marginBottom: 16, background: t.panel }}>
            {[
              ['hours/wk', '18.2', 'h', +2.1, 'h', true],
              ['achievements', '07', '', -3, '', false],
              ['new_games', '02', '', +1, '', false],
              ['sessions', '11', '', 0, '', false],
            ].map(([label, val, unit, delta, du, lit], i) => (
              <div key={label} style={{
                padding: '16px 20px 14px',
                borderRight: i < 3 ? `1px solid ${t.line2}` : 'none',
                position: 'relative',
              }}>
                <div style={{ fontFamily: CN_MONO, fontSize: 11, color: t.text3, marginBottom: 8 }}>
                  [{label}]
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 10 }}>
                  <span style={{ fontFamily: CN_MONO, fontSize: 40, color: lit ? t.accent : t.text, fontVariantNumeric: 'tabular-nums', fontWeight: 600, letterSpacing: '-0.04em', lineHeight: 1, textShadow: lit && theme === 'dark' ? `0 0 18px ${t.accentGlow}` : 'none' }}>{val}</span>
                  {unit && <span style={{ fontFamily: CN_MONO, fontSize: 16, color: t.text3 }}>{unit}</span>}
                </div>
                {/* discrete bar */}
                <CnBar pct={Math.min(1, parseFloat(val) / (label === 'hours/wk' ? 25 : label === 'achievements' ? 15 : label === 'new_games' ? 5 : 15))} t={t} w={180} h={5} lit={lit} />
                <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, fontFamily: CN_MONO }}>
                  <CnDelta value={delta} unit={du} t={t} />
                  <span style={{ fontSize: 11, color: t.text3 }}>w-1</span>
                </div>
              </div>
            ))}
          </div>

          {/* Recently played + side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 16, marginBottom: 16 }}>
            <div style={{ border: `1px solid ${t.line2}`, background: t.panel }}>
              <div style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', borderBottom: `1px solid ${t.line2}`, fontFamily: CN_MONO }}>
                <span style={{ fontSize: 12, color: t.accent, fontWeight: 600 }}>[ recent_activity ]</span>
                <span style={{ marginLeft: 8, fontSize: 11, color: t.text3 }}>last 14d · n=5</span>
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: 11, color: t.text2 }}>--all</span>
              </div>
              {/* Header row */}
              <div style={{ display: 'grid', gridTemplateColumns: '92px 1fr 90px 70px 90px', gap: 14, padding: '6px 16px', borderBottom: `1px dashed ${t.line2}`, fontFamily: CN_MONO, fontSize: 10, color: t.text3, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                <span>art</span><span>title</span><span style={{ textAlign: 'right' }}>hrs.this</span><span style={{ textAlign: 'right' }}>sess</span><span style={{ textAlign: 'right' }}>last</span>
              </div>
              {s.recent.map((g, i) => {
                const hovered = i === 0;
                return (
                  <div key={g.title} style={{
                    display: 'grid', gridTemplateColumns: '92px 1fr 90px 70px 90px',
                    gap: 14, padding: '10px 16px', alignItems: 'center',
                    borderBottom: i < s.recent.length - 1 ? `1px dashed ${t.line2}` : 'none',
                    background: hovered ? t.accentGlow : 'transparent',
                    borderLeft: hovered ? `2px solid ${t.accent}` : `2px solid transparent`,
                  }}>
                    <div style={{
                      width: 92, height: 43,
                      background: `linear-gradient(135deg, #1a1a1a 0%, #000 100%)`,
                      border: `1px solid ${t.line2}`,
                      position: 'relative', overflow: 'hidden',
                      filter: theme === 'light' ? 'sepia(0.3) contrast(0.95)' : 'none',
                    }}>
                      <div style={{ position: 'absolute', inset: 0, background: `url(${g.art}) center/cover`, opacity: 0.7 }} />
                      <div style={{ position: 'absolute', inset: 0, background: `repeating-linear-gradient(0deg, rgba(0,0,0,.25) 0 1px, transparent 1px 2px)` }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, color: t.text, fontWeight: 500, fontFamily: CN_SANS }}>{g.title}</div>
                      <div style={{ fontSize: 11, color: t.text3, fontFamily: CN_MONO, marginTop: 2 }}>
                        id=app/{(871710 + i * 1234).toString().padStart(7, '0')} · single-player
                      </div>
                    </div>
                    <span style={{ fontFamily: CN_MONO, fontSize: 13, color: hovered ? t.accent : t.text, fontVariantNumeric: 'tabular-nums', fontWeight: 600, textAlign: 'right' }}>
                      {g.hours.toFixed(1)}<span style={{ color: t.text3, marginLeft: 2 }}>h</span>
                    </span>
                    <span style={{ fontFamily: CN_MONO, fontSize: 12, color: t.text2, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
                      {Math.round(g.hours * 6).toString().padStart(2, '0')}
                    </span>
                    <span style={{ fontFamily: CN_MONO, fontSize: 11, color: t.text3, textAlign: 'right' }}>{g.last}</span>
                  </div>
                );
              })}
            </div>

            {/* Backlog */}
            <div style={{
              border: `1px solid ${t.line2}`, background: t.panel,
              display: 'flex', flexDirection: 'column',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', borderBottom: `1px solid ${t.line2}`, fontFamily: CN_MONO }}>
                <span style={{ fontSize: 12, color: t.accent, fontWeight: 600 }}>[ backlog ]</span>
                <span style={{ marginLeft: 8, fontSize: 11, color: t.text3 }}>unplayed</span>
              </div>
              <div style={{ padding: '18px 18px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontFamily: CN_MONO, fontSize: 56, color: t.accent, fontVariantNumeric: 'tabular-nums', fontWeight: 700, letterSpacing: '-0.06em', lineHeight: 1, textShadow: theme === 'dark' ? `0 0 24px ${t.accentGlow}` : 'none' }}>178</span>
                  <span style={{ fontFamily: CN_MONO, fontSize: 13, color: t.text3 }}>games_waiting</span>
                </div>
                <div style={{ fontSize: 13, color: t.text2, lineHeight: 1.55, marginTop: 12, fontFamily: CN_SANS }}>
                  <span style={{ fontFamily: CN_MONO, color: t.text3 }}>// </span>
                  Subnautica has been waiting since <span style={{ fontFamily: CN_MONO, color: t.text }}>2019-03-14</span>.
                  Estimated <span style={{ fontFamily: CN_MONO, color: t.text }}>1240h</span> unstarted.
                </div>
              </div>
              <div style={{ borderTop: `1px solid ${t.line2}`, padding: '14px 18px' }}>
                <div style={{ fontFamily: CN_MONO, fontSize: 10, color: t.text3, marginBottom: 10, letterSpacing: '0.08em', textTransform: 'uppercase' }}>distribution by tenure</div>
                {[
                  ['5+_yrs', 12, 12/178],
                  ['3-5_yrs', 28, 28/178],
                  ['1-3_yrs', 71, 71/178],
                  ['<1_yr', 67, 67/178],
                ].map(([label, n, pct], i) => (
                  <div key={label} style={{ display: 'grid', gridTemplateColumns: '70px 1fr 28px', gap: 10, alignItems: 'center', marginBottom: 6, fontSize: 11, fontFamily: CN_MONO, color: t.text2 }}>
                    <span style={{ color: i === 0 ? t.accent : t.text2 }}>{label}</span>
                    <CnBar pct={pct} t={t} w={170} h={6} lit={i === 0} />
                    <span style={{ textAlign: 'right', color: t.text, fontVariantNumeric: 'tabular-nums' }}>{pad(n, 3)}</span>
                  </div>
                ))}
              </div>
              <div style={{ borderTop: `1px solid ${t.line2}`, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 10, fontFamily: CN_MONO, fontSize: 12 }}>
                <span style={{ color: t.accent }}>$</span>
                <span style={{ color: t.text2 }}>pick --random</span>
                <span style={{ marginLeft: 'auto', color: t.text3, fontSize: 11 }}>↵</span>
              </div>
            </div>
          </div>

          {/* Top games */}
          <div style={{ border: `1px solid ${t.line2}`, background: t.panel }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', borderBottom: `1px solid ${t.line2}`, fontFamily: CN_MONO }}>
              <span style={{ fontSize: 12, color: t.accent, fontWeight: 600 }}>[ top_games ]</span>
              <span style={{ marginLeft: 8, fontSize: 11, color: t.text3 }}>order_by=playtime · desc · limit=5</span>
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 11, color: t.text2, fontVariantNumeric: 'tabular-nums' }}>sum=1726h</span>
            </div>
            <div style={{ padding: '10px 16px', fontFamily: CN_MONO }}>
              {s.top.map((g, i) => {
                const pct = g.hours / topMax;
                return (
                  <div key={g.title} style={{
                    display: 'grid', gridTemplateColumns: '32px 200px 1fr 80px',
                    gap: 14, alignItems: 'center', padding: '7px 0',
                    borderBottom: i < s.top.length - 1 ? `1px dotted ${t.line2}` : 'none',
                  }}>
                    <span style={{ fontSize: 12, color: t.text3, fontVariantNumeric: 'tabular-nums' }}>{String(i+1).padStart(2,'0')}.</span>
                    <span style={{ fontSize: 13, color: t.text, fontFamily: CN_SANS, fontWeight: 500 }}>{g.title}</span>
                    <CnBar pct={pct} t={t} w={400} h={8} lit={i === 0} />
                    <span style={{ fontSize: 13, color: i === 0 ? t.accent : t.text, fontVariantNumeric: 'tabular-nums', fontWeight: 600, textAlign: 'right' }}>
                      {pad(g.hours, 4)}<span style={{ color: t.text3, marginLeft: 2, fontWeight: 400 }}>h</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Hover caller */}
          <div style={{ position: 'absolute', top: 305, left: 60, pointerEvents: 'none' }}>
            <svg width="240" height="120" style={{ overflow: 'visible' }}>
              <path d="M 0 0 L 0 40 L 120 40" stroke={t.accent} strokeWidth="0.75" fill="none" />
              <circle cx="0" cy="0" r="2.5" fill={t.accent} />
            </svg>
            <div style={{ position: 'absolute', left: 130, top: 30, fontFamily: CN_MONO, fontSize: 10, color: t.accent, letterSpacing: '0.06em', textTransform: 'uppercase', width: 200 }}>
              hover: lit kpi<br/>
              <span style={{ color: t.text3, textTransform: 'none', letterSpacing: 0 }}>amber = primary state; bar fills + glow on hover</span>
            </div>
          </div>
        </main>
      </div>

      {/* Spec strip */}
      <div style={{ borderTop: `1px solid ${t.line2}`, padding: '10px 24px', display: 'flex', gap: 22, fontFamily: CN_MONO, fontSize: 10, color: t.text3, letterSpacing: '0.04em', textTransform: 'uppercase', background: t.bg, position: 'relative', zIndex: 2 }}>
        <span>body · inter 13/1.4</span>
        <span>mono · jetbrains mono 12</span>
        <span>accent · <span style={{ color: t.accent }}>{t.accent}</span></span>
        <span>bg · {t.bg}</span>
        <span>grid · 24 px @ 5% opacity</span>
        <span>{theme === 'dark' ? 'scanline · on · 3 px' : 'paper · cream drafting'}</span>
      </div>
    </div>
  );
}

Object.assign(window, { Console });
