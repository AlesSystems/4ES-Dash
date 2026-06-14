// Direction 1 — "Operator"
// Linear/Notion energy. Monochromatic neutral spine, single surgical teal accent.
// Hairline borders, no shadows, tabular mono numbers, sparklines + inline bars.

const OP_TOKENS = {
  dark: {
    bg: '#0e0f10',
    panel: '#131416',
    panel2: '#17181a',
    line: '#23262a',
    line2: '#2c2f34',
    text: '#e7e9ec',
    text2: '#a1a7af',
    text3: '#6b7079',
    accent: '#5fb3aa',
    accentSoft: 'rgba(95,179,170,0.12)',
    up: '#5fb56a',
    down: '#d97a6c',
    barTrack: '#1c1e21',
    barFill: '#3a4045',
    barFillTop: '#5fb3aa',
    focusRing: '#5fb3aa',
    hover: '#1a1c1f',
  },
  light: {
    bg: '#f7f7f5',
    panel: '#ffffff',
    panel2: '#fbfbf9',
    line: '#e6e5e0',
    line2: '#d8d6d0',
    text: '#1a1c1e',
    text2: '#56595e',
    text3: '#878a8f',
    accent: '#1f6a66',
    accentSoft: 'rgba(31,106,102,0.10)',
    up: '#1f7a36',
    down: '#a8392c',
    barTrack: '#ebeae5',
    barFill: '#cbc9c3',
    barFillTop: '#1f6a66',
    focusRing: '#1f6a66',
    hover: '#f1f0ec',
  },
};

const OP_MONO = `"JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace`;
const OP_SANS = `"Inter Tight", "Inter", -apple-system, system-ui, sans-serif`;

function OpIcon({ d, size = 14, stroke = 1.5 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

const OP_ICONS = {
  dashboard: 'M2 2h5v5H2zM9 2h5v5H9zM2 9h5v5H2zM9 9h5v5H9z',
  library: 'M3 2v12M6 2v12M9 2h4l1 12h-4z',
  games: 'M4 8h3M5.5 6.5v3M10 7.5h.01M12 9.5h.01M2 8a3 3 0 0 1 3-3h6a3 3 0 0 1 0 6H5a3 3 0 0 1-3-3z',
  friends: 'M5 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM11 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM2 13c0-2 1.5-3 3-3s3 1 3 3M8 13c0-2 1.5-3 3-3s3 1 3 3',
  achievements: 'M5 2h6v3a3 3 0 1 1-6 0zM3 3v1a2 2 0 0 0 2 2M13 3v1a2 2 0 0 1-2 2M8 8v3M5.5 13h5',
  backlog: 'M3 4h10M3 8h10M3 12h6',
  settings: 'M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM8 2v1.5M8 12.5V14M13.5 8H12M4 8H2.5M11.9 4.1l-1 1M5.1 10.9l-1 1M11.9 11.9l-1-1M5.1 5.1l-1-1',
  search: 'M7 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM14 14l-3.5-3.5',
  chevron: 'M6 4l4 4-4 4',
  arrowUp: 'M3 10l5-5 5 5',
  arrowDown: 'M3 6l5 5 5-5',
  arrowRight: 'M3 8h10M9 4l4 4-4 4',
  dot: 'M8 8h.01',
  sun: 'M8 4.5V3M8 13v-1.5M3.5 8H2M14 8h-1.5M5 5L4 4M12 12l-1-1M5 11l-1 1M12 4l-1 1M8 6a2 2 0 1 1 0 4 2 2 0 0 1 0-4z',
  bell: 'M4 7a4 4 0 0 1 8 0v3l1 2H3l1-2zM6.5 13a1.5 1.5 0 0 0 3 0',
};

function OpSparkline({ data, color, width = 84, height = 24 }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const step = width / (data.length - 1);
  const pts = data.map((v, i) => [i * step, height - ((v - min) / span) * (height - 4) - 2]);
  const path = pts.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(' ');
  const last = pts[pts.length - 1];
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <path d={path} stroke={color} strokeWidth="1.25" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="1.75" fill={color} />
    </svg>
  );
}

function OpDelta({ value, unit, t }) {
  const sign = value > 0 ? '+' : value < 0 ? '−' : '±';
  const abs = Math.abs(value);
  const color = value > 0 ? t.up : value < 0 ? t.down : t.text3;
  const arrow = value > 0 ? OP_ICONS.arrowUp : value < 0 ? OP_ICONS.arrowDown : OP_ICONS.dot;
  return (
    <span style={{ color, display: 'inline-flex', alignItems: 'center', gap: 3, fontFamily: OP_MONO, fontSize: 11, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>
      <OpIcon d={arrow} size={10} stroke={2} />
      {sign}{abs}{unit ? <span style={{ color: t.text3, marginLeft: 1 }}>{unit}</span> : null}
    </span>
  );
}

function OpKpi({ label, value, unit, delta, deltaUnit, spark, t, hoverNote }) {
  return (
    <div style={{
      flex: 1, padding: '14px 16px 14px', borderRight: `1px solid ${t.line}`, position: 'relative',
      background: hoverNote ? t.hover : 'transparent',
    }}>
      <div style={{ fontSize: 11, color: t.text3, letterSpacing: '0.04em', textTransform: 'uppercase', fontFamily: OP_MONO, marginBottom: 8 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, fontFamily: OP_SANS, fontWeight: 500, color: t.text, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.025em' }}>
          <span style={{ fontSize: 28, lineHeight: '32px' }}>{value}</span>
          {unit ? <span style={{ fontSize: 13, color: t.text3, fontWeight: 400 }}>{unit}</span> : null}
        </div>
        {spark ? <OpSparkline data={spark} color={t.accent} /> : null}
      </div>
      <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
        <OpDelta value={delta} unit={deltaUnit} t={t} />
        <span style={{ fontSize: 11, color: t.text3 }}>vs last week</span>
      </div>
    </div>
  );
}

function OpNav({ icon, label, count, active, t }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px', borderRadius: 4,
      color: active ? t.text : t.text2,
      background: active ? t.accentSoft : 'transparent',
      fontSize: 13, fontFamily: OP_SANS, position: 'relative',
      cursor: 'default',
    }}>
      {active && <span style={{ position: 'absolute', left: -12, top: 4, bottom: 4, width: 2, background: t.accent, borderRadius: 1 }} />}
      <span style={{ color: active ? t.accent : t.text3, display: 'inline-flex' }}><OpIcon d={icon} size={14} /></span>
      <span style={{ flex: 1 }}>{label}</span>
      {count != null && <span style={{ fontFamily: OP_MONO, fontSize: 11, color: t.text3, fontVariantNumeric: 'tabular-nums' }}>{count}</span>}
    </div>
  );
}

function OpHoverCaller({ children, x, y, w = 180, t, anchor = 'top-right' }) {
  // x,y are absolute coords of the line origin (on the element).
  // The note hangs out to the top-right with a thin caller line.
  const noteX = x + 130;
  const noteY = y - 60;
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 50 }}>
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <path d={`M${x},${y} L${x + 60},${y} L${noteX},${noteY + 12}`} stroke={t.accent} strokeWidth="0.75" fill="none" />
        <circle cx={x} cy={y} r="2" fill={t.accent} />
      </svg>
      <div style={{
        position: 'absolute', left: noteX, top: noteY, width: w,
        fontFamily: OP_MONO, fontSize: 10, color: t.accent, letterSpacing: '0.02em',
        textTransform: 'uppercase',
      }}>{children}</div>
    </div>
  );
}

function Operator({ theme = 'dark' }) {
  const t = OP_TOKENS[theme];
  const s = window.STEAM;
  const topMax = Math.max(...s.top.map(g => g.hours));

  return (
    <div data-screen-label={`Operator · ${theme}`} style={{
      width: 1440, minHeight: 1100, background: t.bg, color: t.text,
      fontFamily: OP_SANS, fontSize: 13, lineHeight: 1.4,
      fontFeatureSettings: '"ss01", "cv11"',
    }}>
      {/* APP BAR */}
      <div style={{
        height: 56, borderBottom: `1px solid ${t.line}`, background: t.bg,
        display: 'flex', alignItems: 'center', padding: '0 20px', gap: 24,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: 220 }}>
          <div style={{ width: 22, height: 22, borderRadius: 4, background: t.accent, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 8, height: 8, background: t.bg, borderRadius: 1, transform: 'rotate(45deg)' }} />
          </div>
          <span style={{ fontFamily: OP_MONO, fontSize: 13, color: t.text, letterSpacing: '-0.01em', fontWeight: 500 }}>4es-dash</span>
          <span style={{ fontFamily: OP_MONO, fontSize: 10, color: t.text3, padding: '2px 5px', border: `1px solid ${t.line}`, borderRadius: 3, marginLeft: 4 }}>v2.1</span>
        </div>
        <nav style={{ display: 'flex', gap: 2, fontFamily: OP_SANS, fontSize: 13 }}>
          {[['Dashboard', true], ['Library'], ['Games'], ['Friends']].map(([n, active]) => (
            <span key={n} style={{
              padding: '6px 10px', borderRadius: 4,
              color: active ? t.text : t.text2,
              background: active ? t.hover : 'transparent',
              position: 'relative',
            }}>
              {n}
              {active && <span style={{ position: 'absolute', left: 10, right: 10, bottom: -17, height: 1.5, background: t.accent }} />}
            </span>
          ))}
        </nav>
        <div style={{ flex: 1 }} />
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
          background: t.panel, border: `1px solid ${t.line}`, borderRadius: 5,
          width: 280, color: t.text3,
        }}>
          <OpIcon d={OP_ICONS.search} size={13} />
          <span style={{ fontSize: 12, flex: 1 }}>Search library, friends, achievements</span>
          <span style={{ fontFamily: OP_MONO, fontSize: 10, color: t.text3, padding: '1px 4px', border: `1px solid ${t.line}`, borderRadius: 3 }}>⌘K</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: t.text2 }}>
          <OpIcon d={OP_ICONS.bell} size={15} />
          <OpIcon d={OP_ICONS.sun} size={15} />
          <div style={{ width: 26, height: 26, borderRadius: 4, background: `url(${s.user.avatar}) center/cover`, border: `1px solid ${t.line2}` }} />
        </div>
      </div>

      <div style={{ display: 'flex' }}>
        {/* SIDEBAR */}
        <aside style={{ width: 240, borderRight: `1px solid ${t.line}`, padding: '20px 16px', minHeight: 1044 }}>
          <div style={{ fontSize: 10, color: t.text3, letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: OP_MONO, padding: '0 8px 8px' }}>Workspace</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <OpNav icon={OP_ICONS.dashboard} label="Dashboard" active t={t} />
            <OpNav icon={OP_ICONS.library} label="Library" count={312} t={t} />
            <OpNav icon={OP_ICONS.games} label="Recently played" count={5} t={t} />
            <OpNav icon={OP_ICONS.achievements} label="Achievements" count="4.1k" t={t} />
            <OpNav icon={OP_ICONS.friends} label="Friends" count={48} t={t} />
            <OpNav icon={OP_ICONS.backlog} label="Backlog" count={178} t={t} />
          </div>
          <div style={{ fontSize: 10, color: t.text3, letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: OP_MONO, padding: '24px 8px 8px' }}>Lists</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <OpNav icon={OP_ICONS.dot} label="To finish" count={12} t={t} />
            <OpNav icon={OP_ICONS.dot} label="Co-op queue" count={6} t={t} />
            <OpNav icon={OP_ICONS.dot} label="Cozy" count={9} t={t} />
          </div>
          <div style={{ marginTop: 32, padding: '0 8px' }}>
            <div style={{ fontSize: 10, color: t.text3, letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: OP_MONO, marginBottom: 8 }}>Sync</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: t.text2 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.up }} />
              <span style={{ fontFamily: OP_MONO, fontVariantNumeric: 'tabular-nums' }}>synced 00:42 ago</span>
            </div>
          </div>
        </aside>

        {/* MAIN */}
        <main style={{ flex: 1, padding: '24px 28px 40px', position: 'relative' }}>
          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: t.text3, fontFamily: OP_MONO, marginBottom: 16 }}>
            <span>workspace</span><OpIcon d={OP_ICONS.chevron} size={10} /><span style={{ color: t.text2 }}>dashboard</span>
          </div>

          {/* Profile strip */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 16, padding: '14px 16px',
            border: `1px solid ${t.line}`, borderRadius: 6, background: t.panel, marginBottom: 18,
          }}>
            <div style={{ width: 44, height: 44, borderRadius: 5, background: `url(${s.user.avatar}) center/cover`, border: `1px solid ${t.line2}` }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14, color: t.text, fontWeight: 500 }}>Altan</span>
                <span style={{ fontFamily: OP_MONO, fontSize: 10, padding: '1px 5px', border: `1px solid ${t.line2}`, borderRadius: 3, color: t.text2 }}>lvl 47</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: t.text3 }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: t.up }} />
                  <span style={{ fontFamily: OP_MONO }}>online · last seen {s.user.lastSeen}</span>
                </span>
              </div>
              <div style={{ fontSize: 11, color: t.text3, fontFamily: OP_MONO, fontVariantNumeric: 'tabular-nums', display: 'flex', gap: 14 }}>
                <span>joined {s.user.joined}</span>
                <span style={{ color: t.line2 }}>·</span>
                <span>{s.user.games} games</span>
                <span style={{ color: t.line2 }}>·</span>
                <span>{s.user.hours.toLocaleString()} h</span>
                <span style={{ color: t.line2 }}>·</span>
                <span>{s.user.achievements.toLocaleString()} achievements</span>
              </div>
            </div>
            <div style={{ flex: 1 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: OP_MONO, fontSize: 11, color: t.text3 }}>
              <span>span</span>
              <div style={{ display: 'inline-flex', border: `1px solid ${t.line}`, borderRadius: 4, overflow: 'hidden' }}>
                <span style={{ padding: '4px 8px', color: t.text3 }}>day</span>
                <span style={{ padding: '4px 8px', color: t.text, background: t.hover, borderLeft: `1px solid ${t.line}`, borderRight: `1px solid ${t.line}` }}>week</span>
                <span style={{ padding: '4px 8px', color: t.text3 }}>month</span>
                <span style={{ padding: '4px 8px', color: t.text3, borderLeft: `1px solid ${t.line}` }}>all</span>
              </div>
            </div>
          </div>

          {/* KPI row */}
          <div style={{
            display: 'flex', border: `1px solid ${t.line}`, borderRadius: 6, background: t.panel,
            overflow: 'hidden', marginBottom: 18, position: 'relative',
          }}>
            <OpKpi label="hours / wk" value="18.2" unit="h" delta={+2.1} deltaUnit="h" spark={s.playtimeWeeks} t={t} hoverNote />
            <OpKpi label="achievements" value="7" delta={-3} t={t} spark={[2,3,1,4,5,3,6,8,5,7,9,7]} />
            <OpKpi label="new games" value="2" delta={+1} t={t} spark={[0,1,0,2,1,0,1,3,1,2,1,2]} />
            <div style={{ flex: 1, padding: '14px 16px 14px', position: 'relative' }}>
              <div style={{ fontSize: 11, color: t.text3, letterSpacing: '0.04em', textTransform: 'uppercase', fontFamily: OP_MONO, marginBottom: 8 }}>sessions</div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, fontFamily: OP_SANS, fontWeight: 500, color: t.text, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.025em' }}>
                  <span style={{ fontSize: 28, lineHeight: '32px' }}>11</span>
                </div>
                <OpSparkline data={[8,6,9,12,10,7,11,14,9,12,10,11]} color={t.accent} />
              </div>
              <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <OpDelta value={0} t={t} />
                <span style={{ fontSize: 11, color: t.text3 }}>vs last week</span>
              </div>
            </div>
          </div>

          {/* Recently played + side column */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 18, marginBottom: 18 }}>
            <div style={{ border: `1px solid ${t.line}`, borderRadius: 6, background: t.panel }}>
              <div style={{ display: 'flex', alignItems: 'center', padding: '11px 16px', borderBottom: `1px solid ${t.line}` }}>
                <span style={{ fontSize: 12, color: t.text, fontWeight: 500 }}>Recently played</span>
                <span style={{ marginLeft: 8, fontSize: 11, color: t.text3, fontFamily: OP_MONO }}>last 14 days · 5</span>
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: 11, color: t.text2, fontFamily: OP_MONO, display: 'inline-flex', alignItems: 'center', gap: 4 }}>view all <OpIcon d={OP_ICONS.arrowRight} size={10} /></span>
              </div>
              <div>
                {s.recent.map((g, i) => {
                  const hovered = i === 0;
                  return (
                    <div key={g.title} style={{
                      display: 'grid', gridTemplateColumns: '92px 1fr 80px 80px 18px',
                      gap: 14, padding: '10px 16px', alignItems: 'center',
                      borderBottom: i < s.recent.length - 1 ? `1px solid ${t.line}` : 'none',
                      background: hovered ? t.hover : 'transparent',
                      position: 'relative',
                    }}>
                      <div style={{
                        width: 92, height: 43, borderRadius: 3,
                        background: `linear-gradient(135deg, ${g.tone} 0%, ${t.panel2} 130%)`,
                        border: `1px solid ${t.line2}`,
                        position: 'relative', overflow: 'hidden',
                      }}>
                        <div style={{ position: 'absolute', inset: 0, background: `url(${g.art}) center/cover`, opacity: 0.55 }} />
                        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, transparent 30%, ${g.tone}88 100%)` }} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: t.text, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.title}</div>
                        <div style={{ fontSize: 11, color: t.text3, fontFamily: OP_MONO, marginTop: 2 }}>
                          {Math.round(g.hours * 6) + ' sessions'} · single-player
                        </div>
                      </div>
                      <div style={{ fontFamily: OP_MONO, fontSize: 12, color: t.text, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
                        {g.hours.toFixed(1)} <span style={{ color: t.text3 }}>h</span>
                      </div>
                      <div style={{ fontFamily: OP_MONO, fontSize: 11, color: t.text3, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{g.last}</div>
                      <OpIcon d={OP_ICONS.chevron} size={12} />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Backlog */}
            <div style={{ border: `1px solid ${t.line}`, borderRadius: 6, background: t.panel, padding: 16, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 12, color: t.text, fontWeight: 500 }}>Backlog</span>
                <span style={{ marginLeft: 8, fontSize: 11, color: t.text3, fontFamily: OP_MONO }}>unplayed</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 36, fontFamily: OP_SANS, fontWeight: 500, color: t.text, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.03em', lineHeight: 1 }}>178</span>
                <span style={{ fontSize: 12, color: t.text3 }}>games waiting</span>
              </div>
              <div style={{ fontSize: 12, color: t.text2, lineHeight: 1.5, marginTop: 10, fontFamily: OP_SANS }}>
                Subnautica has been waiting since <span style={{ fontFamily: OP_MONO, color: t.text }}>2019-03-14</span>.
                You own roughly <span style={{ fontFamily: OP_MONO, color: t.text }}>1,240</span> hours of content you haven't started.
              </div>
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${t.line}` }}>
                <div style={{ fontSize: 10, color: t.text3, fontFamily: OP_MONO, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 8 }}>by tenure</div>
                {[
                  ['5+ yrs', 12, 12/178],
                  ['3–5 yrs', 28, 28/178],
                  ['1–3 yrs', 71, 71/178],
                  ['< 1 yr', 67, 67/178],
                ].map(([label, n, pct]) => (
                  <div key={label} style={{ display: 'grid', gridTemplateColumns: '64px 1fr 32px', gap: 8, alignItems: 'center', marginBottom: 4, fontSize: 11, fontFamily: OP_MONO, color: t.text2 }}>
                    <span>{label}</span>
                    <div style={{ height: 4, background: t.barTrack, borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ width: `${pct * 100}%`, height: '100%', background: label === '5+ yrs' ? t.accent : t.barFill }} />
                    </div>
                    <span style={{ textAlign: 'right', color: t.text, fontVariantNumeric: 'tabular-nums' }}>{n}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${t.line}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: t.accent, fontFamily: OP_MONO, fontWeight: 500 }}>pick one →</span>
              </div>
            </div>
          </div>

          {/* Top games */}
          <div style={{ border: `1px solid ${t.line}`, borderRadius: 6, background: t.panel }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '11px 16px', borderBottom: `1px solid ${t.line}` }}>
              <span style={{ fontSize: 12, color: t.text, fontWeight: 500 }}>Top games</span>
              <span style={{ marginLeft: 8, fontSize: 11, color: t.text3, fontFamily: OP_MONO }}>all-time · top 5</span>
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 11, color: t.text3, fontFamily: OP_MONO }}>1,726 h tracked</span>
            </div>
            <div style={{ padding: '8px 16px' }}>
              {s.top.map((g, i) => {
                const pct = g.hours / topMax;
                return (
                  <div key={g.title} style={{
                    display: 'grid', gridTemplateColumns: '24px 180px 1fr 80px',
                    gap: 14, alignItems: 'center', padding: '8px 0',
                    borderBottom: i < s.top.length - 1 ? `1px dashed ${t.line}` : 'none',
                  }}>
                    <span style={{ fontFamily: OP_MONO, fontSize: 11, color: t.text3, fontVariantNumeric: 'tabular-nums' }}>{String(i+1).padStart(2,'0')}</span>
                    <span style={{ fontSize: 13, color: t.text }}>{g.title}</span>
                    <div style={{ height: 6, background: t.barTrack, borderRadius: 1, position: 'relative', overflow: 'hidden' }}>
                      <div style={{ width: `${pct * 100}%`, height: '100%', background: i === 0 ? t.accent : t.barFill }} />
                    </div>
                    <span style={{ fontFamily: OP_MONO, fontSize: 12, color: t.text, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
                      {g.hours} <span style={{ color: t.text3 }}>h</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Hover caller annotation for KPI sparkline */}
          <div style={{ position: 'absolute', top: 260, left: 60, right: 28, height: 80, pointerEvents: 'none' }}>
            <svg width="100%" height="80" style={{ overflow: 'visible' }}>
              <path d="M 220 22 L 220 50 L 360 50" stroke={t.accent} strokeWidth="0.75" fill="none" strokeDasharray="0" />
              <circle cx="220" cy="22" r="2.5" fill={t.accent} />
            </svg>
            <div style={{ position: 'absolute', left: 370, top: 38, fontFamily: OP_MONO, fontSize: 10, color: t.accent, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              hover · 12 wk sparkline<br/>
              <span style={{ color: t.text3, textTransform: 'none', letterSpacing: 0 }}>click to expand into hourly view</span>
            </div>
          </div>
        </main>
      </div>

      {/* Spec strip */}
      <div style={{
        borderTop: `1px solid ${t.line}`, padding: '10px 28px', background: t.bg,
        display: 'flex', gap: 24, fontFamily: OP_MONO, fontSize: 10, color: t.text3,
        letterSpacing: '0.04em', textTransform: 'uppercase',
      }}>
        <span>body · inter tight 13/1.4</span>
        <span>mono · jetbrains mono 11</span>
        <span>accent · <span style={{ color: t.accent }}>{t.accent}</span></span>
        <span>bg · {t.bg}</span>
        <span>line · {t.line}</span>
        <span>density · 18 px gutter · 6 px radius</span>
      </div>
    </div>
  );
}

Object.assign(window, { Operator });
