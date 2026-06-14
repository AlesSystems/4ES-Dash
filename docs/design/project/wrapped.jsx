// Direction 2 — "Wrapped"
// Editorial Year-in-Review warmth. Huge KPI numbers, area chart, art-tinted cards.

const WR_TOKENS = {
  dark: {
    bg: '#141211',          // warm ink
    bgGrad: 'linear-gradient(180deg, #181513 0%, #141211 100%)',
    panel: '#1c1816',
    panel2: '#221d1a',
    ink: '#f4ece2',         // warm white
    ink2: '#c8bdb0',
    ink3: '#8b8278',
    line: '#2c2622',
    line2: '#3a322c',
    accent: '#e8a05c',      // warm amber accent
    accent2: '#7e9ba8',     // muted slate (secondary)
    accentInk: '#1a120a',
    up: '#7fbf7a',
    down: '#e07b6a',
    chartFill1: 'rgba(232,160,92,0.32)',
    chartFill2: 'rgba(232,160,92,0.02)',
    chartLine: '#e8a05c',
  },
  light: {
    bg: '#f4ede1',          // paper warm
    bgGrad: 'linear-gradient(180deg, #f7f0e4 0%, #f1eadd 100%)',
    panel: '#fdf8ed',
    panel2: '#f9f1e1',
    ink: '#1f1a14',
    ink2: '#5a4f42',
    ink3: '#8c7f6e',
    line: '#e3d8c4',
    line2: '#cdc0a8',
    accent: '#b8541f',      // editorial brick
    accent2: '#3e5562',     // deep slate
    accentInk: '#fff8eb',
    up: '#2f7a34',
    down: '#a8392c',
    chartFill1: 'rgba(184,84,31,0.22)',
    chartFill2: 'rgba(184,84,31,0.02)',
    chartLine: '#b8541f',
  },
};

const WR_SERIF = `"Source Serif 4", "Source Serif Pro", "Tiempos Text", Georgia, serif`;
const WR_SANS = `"Söhne", "Inter Tight", -apple-system, system-ui, sans-serif`;
const WR_MONO = `"JetBrains Mono", ui-monospace, monospace`;

function WrIcon({ d, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

const WR_ICONS = {
  dashboard: 'M2 8l6-5 6 5v6H2zM6 14v-4h4v4',
  library: 'M3 2h3v12H3zM7 2h3v12H7zM11 4l2.5-.5L14 13l-2.5.5z',
  games: 'M2 8a3 3 0 0 1 3-3h6a3 3 0 0 1 0 6H5a3 3 0 0 1-3-3zM4 8h3M5.5 6.5v3M10 7.5h.01M12 9.5h.01',
  friends: 'M5 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM11 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM2 13c0-2 1.5-3 3-3s3 1 3 3M8 13c0-2 1.5-3 3-3s3 1 3 3',
  store: 'M2 5h12l-1 8H3zM5 5V3a3 3 0 1 1 6 0v2',
  search: 'M7 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM14 14l-3.5-3.5',
  sun: 'M8 4.5V3M8 13v-1.5M3.5 8H2M14 8h-1.5M5 5L4 4M12 12l-1-1M5 11l-1 1M12 4l-1 1M8 6a2 2 0 1 1 0 4 2 2 0 0 1 0-4z',
  bell: 'M4 7a4 4 0 0 1 8 0v3l1 2H3l1-2zM6.5 13a1.5 1.5 0 0 0 3 0',
  chevron: 'M6 4l4 4-4 4',
  arrowUp: 'M3 10l5-5 5 5',
  arrowDown: 'M3 6l5 5 5-5',
  arrowRight: 'M3 8h10M9 4l4 4-4 4',
  dot: 'M8 8h.01',
  achievements: 'M5 2h6v3a3 3 0 1 1-6 0zM3 3v1a2 2 0 0 0 2 2M13 3v1a2 2 0 0 1-2 2M8 8v3M5.5 13h5',
  backlog: 'M3 4h10M3 8h10M3 12h6',
};

function WrDelta({ value, unit, t }) {
  const sign = value > 0 ? '+' : value < 0 ? '−' : '±';
  const abs = Math.abs(value);
  const color = value > 0 ? t.up : value < 0 ? t.down : t.ink3;
  const arrow = value > 0 ? WR_ICONS.arrowUp : value < 0 ? WR_ICONS.arrowDown : WR_ICONS.dot;
  return (
    <span style={{ color, display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: WR_MONO, fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
      <WrIcon d={arrow} size={11} />{sign}{abs}{unit ? ' ' + unit : ''}
    </span>
  );
}

function WrAreaChart({ data, width = 880, height = 200, t }) {
  const min = 0;
  const max = Math.ceil(Math.max(...data) / 5) * 5;
  const span = max - min || 1;
  const padX = 12, padY = 18;
  const w = width - padX * 2;
  const h = height - padY * 2;
  const step = w / (data.length - 1);
  const pts = data.map((v, i) => [padX + i * step, padY + h - ((v - min) / span) * h]);
  const linePath = pts.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(' ');
  const fillPath = linePath + ` L${pts[pts.length-1][0]},${padY + h} L${pts[0][0]},${padY + h} Z`;
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map(p => padY + h * p);

  return (
    <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={`wr-area-${t.bg.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={t.chartFill1} />
          <stop offset="100%" stopColor={t.chartFill2} />
        </linearGradient>
      </defs>
      {gridLines.map((y, i) => (
        <line key={i} x1={padX} x2={width - padX} y1={y} y2={y} stroke={t.line} strokeWidth="0.75" strokeDasharray={i === gridLines.length - 1 ? '0' : '2,3'} />
      ))}
      <path d={fillPath} fill={`url(#wr-area-${t.bg.replace('#','')})`} />
      <path d={linePath} stroke={t.chartLine} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r={i === pts.length - 1 ? 4 : 2.5} fill={t.bg} stroke={t.chartLine} strokeWidth="1.5" />
      ))}
      {/* Y axis labels */}
      {[max, max*0.75, max*0.5, max*0.25, 0].map((v, i) => (
        <text key={i} x={width - padX + 6} y={padY + h * (i/4) + 3} fontFamily={WR_MONO} fontSize="10" fill={t.ink3}>{Math.round(v)}h</text>
      ))}
      {/* X axis labels */}
      {pts.map((p, i) => (i % 2 === 0) && (
        <text key={'x' + i} x={p[0]} y={height - 4} fontFamily={WR_MONO} fontSize="10" fill={t.ink3} textAnchor="middle">
          w{i + 1}
        </text>
      ))}
      {/* Last marker callout */}
      <line x1={pts[pts.length-1][0]} x2={pts[pts.length-1][0]} y1={pts[pts.length-1][1] + 8} y2={padY + h} stroke={t.chartLine} strokeWidth="0.75" strokeDasharray="2,3" opacity="0.5" />
    </svg>
  );
}

function Wrapped({ theme = 'dark' }) {
  const t = WR_TOKENS[theme];
  const s = window.STEAM;
  const topMax = Math.max(...s.top.map(g => g.hours));

  return (
    <div data-screen-label={`Wrapped · ${theme}`} style={{
      width: 1440, minHeight: 1100, background: t.bgGrad, color: t.ink,
      fontFamily: WR_SANS, fontSize: 14,
    }}>
      {/* APP BAR */}
      <div style={{
        height: 56, borderBottom: `1px solid ${t.line}`,
        display: 'flex', alignItems: 'center', padding: '0 28px', gap: 28,
        background: t.bg,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 24, height: 24, borderRadius: 12, background: t.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.bg }} />
            </div>
            <span style={{ fontFamily: WR_SERIF, fontSize: 18, color: t.ink, fontWeight: 500, fontStyle: 'italic', letterSpacing: '-0.01em' }}>4es</span>
            <span style={{ fontFamily: WR_SANS, fontSize: 13, color: t.ink2, fontWeight: 500, letterSpacing: '0.04em' }}>dash</span>
          </div>
        </div>
        <nav style={{ display: 'flex', gap: 4, fontFamily: WR_SANS, fontSize: 14 }}>
          {[['Dashboard', true], ['Library'], ['Games'], ['Friends']].map(([n, active]) => (
            <span key={n} style={{ padding: '6px 12px', color: active ? t.ink : t.ink2, fontWeight: active ? 500 : 400, position: 'relative' }}>
              {n}
              {active && <span style={{ position: 'absolute', left: 12, right: 12, bottom: -17, height: 2, background: t.accent }} />}
            </span>
          ))}
        </nav>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', background: t.panel, border: `1px solid ${t.line}`, borderRadius: 999, width: 300, color: t.ink3 }}>
          <WrIcon d={WR_ICONS.search} size={14} />
          <span style={{ fontSize: 13, flex: 1, fontStyle: 'italic', fontFamily: WR_SERIF }}>Search your library</span>
          <span style={{ fontFamily: WR_MONO, fontSize: 11, padding: '1px 6px', border: `1px solid ${t.line2}`, borderRadius: 4 }}>⌘K</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, color: t.ink2 }}>
          <WrIcon d={WR_ICONS.bell} size={16} />
          <WrIcon d={WR_ICONS.sun} size={16} />
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: `url(${s.user.avatar}) center/cover`, border: `1px solid ${t.line2}` }} />
        </div>
      </div>

      <div style={{ display: 'flex' }}>
        {/* SIDEBAR */}
        <aside style={{ width: 240, borderRight: `1px solid ${t.line}`, padding: '28px 18px', minHeight: 1044 }}>
          <div style={{ fontSize: 11, color: t.ink3, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: WR_SANS, padding: '0 10px 12px', fontWeight: 500 }}>Browse</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {[
              ['dashboard', 'Dashboard', null, true],
              ['library', 'Library', '312'],
              ['games', 'Recently played', '5'],
              ['achievements', 'Achievements', '4,128'],
              ['friends', 'Friends', '48'],
            ].map(([icon, label, count, active]) => (
              <div key={label} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '9px 10px', borderRadius: 6,
                color: active ? t.ink : t.ink2, background: active ? t.panel : 'transparent',
                fontSize: 14, position: 'relative',
              }}>
                {active && <span style={{ position: 'absolute', left: -18, top: 8, bottom: 8, width: 3, background: t.accent, borderRadius: 2 }} />}
                <WrIcon d={WR_ICONS[icon]} size={16} />
                <span style={{ flex: 1, fontWeight: active ? 500 : 400 }}>{label}</span>
                {count && <span style={{ fontSize: 12, color: t.ink3, fontFamily: WR_MONO }}>{count}</span>}
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: t.ink3, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: WR_SANS, padding: '28px 10px 12px', fontWeight: 500 }}>Collections</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {[['To finish', 12], ['Co-op queue', 6], ['Cozy', 9], ['Roguelikes', 14]].map(([l, n]) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '7px 10px', color: t.ink2, fontSize: 13 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: t.accent2, opacity: 0.7 }} />
                <span style={{ flex: 1 }}>{l}</span>
                <span style={{ fontSize: 11, color: t.ink3, fontFamily: WR_MONO }}>{n}</span>
              </div>
            ))}
          </div>
        </aside>

        {/* MAIN */}
        <main style={{ flex: 1, padding: '32px 40px 40px', position: 'relative' }}>
          {/* Profile header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 28 }}>
            <div style={{ position: 'relative', width: 72, height: 72 }}>
              <div style={{ width: 72, height: 72, borderRadius: '50%', background: `url(${s.user.avatar}) center/cover`, border: `2px solid ${t.line2}` }} />
              <div style={{ position: 'absolute', bottom: -2, right: -2, padding: '2px 7px', background: t.accent, color: t.accentInk, borderRadius: 999, fontSize: 11, fontFamily: WR_MONO, fontWeight: 600 }}>47</div>
            </div>
            <div>
              <div style={{ fontFamily: WR_SERIF, fontSize: 28, color: t.ink, letterSpacing: '-0.01em', fontWeight: 400, lineHeight: 1.1, marginBottom: 4 }}>
                <span style={{ fontStyle: 'italic', color: t.ink2 }}>Altan,</span> <span>twelve years in.</span>
              </div>
              <div style={{ fontSize: 13, color: t.ink3, fontFamily: WR_MONO, fontVariantNumeric: 'tabular-nums', display: 'flex', gap: 12 }}>
                <span>312 games</span>
                <span style={{ color: t.line2 }}>·</span>
                <span>2,847 hours</span>
                <span style={{ color: t.line2 }}>·</span>
                <span>4,128 achievements</span>
                <span style={{ color: t.line2 }}>·</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.up }} />
                  online · last seen 2 min ago
                </span>
              </div>
            </div>
            <div style={{ flex: 1 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 0, border: `1px solid ${t.line}`, borderRadius: 999, padding: 3, background: t.panel }}>
              {['Week', 'Month', 'Year', 'All time'].map((p, i) => (
                <span key={p} style={{
                  padding: '6px 14px', borderRadius: 999, fontSize: 13,
                  background: i === 0 ? t.ink : 'transparent',
                  color: i === 0 ? t.bg : t.ink2,
                  fontWeight: i === 0 ? 500 : 400,
                }}>{p}</span>
              ))}
            </div>
          </div>

          {/* KPI row — huge editorial numbers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, borderTop: `1px solid ${t.line}`, borderBottom: `1px solid ${t.line}`, marginBottom: 32, position: 'relative' }}>
            {[
              ['Hours played', '18.2', 'h', +2.1, 'h', 'this week'],
              ['Achievements', '07', null, -3, null, 'unlocked'],
              ['New games', '02', null, +1, null, 'added'],
              ['Sessions', '11', null, 0, null, 'tracked'],
            ].map(([label, val, unit, delta, du, sub], i) => (
              <div key={label} style={{
                padding: '24px 24px 22px',
                borderRight: i < 3 ? `1px solid ${t.line}` : 'none',
                position: 'relative',
              }}>
                <div style={{ fontFamily: WR_SANS, fontSize: 11, color: t.ink3, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14, fontWeight: 500 }}>{label}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 6 }}>
                  <span style={{ fontFamily: WR_SERIF, fontSize: 88, lineHeight: '76px', fontWeight: 400, color: t.ink, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.04em', fontFeatureSettings: '"ss01"' }}>{val}</span>
                  {unit && <span style={{ fontFamily: WR_SERIF, fontSize: 24, color: t.ink3, fontStyle: 'italic' }}>{unit}</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <WrDelta value={delta} unit={du} t={t} />
                  <span style={{ fontSize: 12, color: t.ink3 }}>{sub}, vs last week</span>
                </div>
              </div>
            ))}
          </div>

          {/* Area chart */}
          <div style={{ marginBottom: 32, paddingBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 18 }}>
              <div>
                <div style={{ fontFamily: WR_SERIF, fontSize: 22, color: t.ink, fontWeight: 400, letterSpacing: '-0.01em' }}>
                  A <span style={{ fontStyle: 'italic' }}>good</span> twelve weeks
                </div>
                <div style={{ fontSize: 13, color: t.ink3, marginTop: 4, fontFamily: WR_SANS }}>Hours played per week · <span style={{ fontFamily: WR_MONO }}>avg 13.4 h</span></div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 12, color: t.ink3, fontFamily: WR_MONO }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 14, height: 2, background: t.chartLine }} /> playtime
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 14, height: 1, borderTop: `1px dashed ${t.line2}` }} /> baseline
                </span>
              </div>
            </div>
            <WrAreaChart data={s.playtimeWeeks} t={t} width={1080} height={200} />
          </div>

          {/* Recently played */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 18 }}>
              <div style={{ fontFamily: WR_SERIF, fontSize: 22, color: t.ink, fontWeight: 400, letterSpacing: '-0.01em' }}>
                Recently <span style={{ fontStyle: 'italic' }}>played</span>
                <span style={{ fontFamily: WR_MONO, fontSize: 13, color: t.ink3, marginLeft: 12, fontStyle: 'normal' }}>last 14 days</span>
              </div>
              <span style={{ fontSize: 13, color: t.accent, display: 'inline-flex', alignItems: 'center', gap: 4 }}>View all <WrIcon d={WR_ICONS.arrowRight} size={12} /></span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
              {s.recent.map((g, i) => {
                const hovered = i === 0;
                return (
                  <div key={g.title} style={{
                    borderRadius: 8, overflow: 'hidden',
                    border: `1px solid ${hovered ? t.line2 : t.line}`,
                    background: t.panel,
                    position: 'relative',
                    transform: hovered ? 'translateY(-2px)' : 'none',
                    transition: 'transform .2s',
                  }}>
                    <div style={{ height: 96, position: 'relative', background: g.tone, overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', inset: 0, background: `url(${g.art}) center/cover`, opacity: 0.85 }} />
                      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, transparent 30%, ${g.tone}cc 100%)` }} />
                    </div>
                    {/* Art-derived wash */}
                    <div style={{ position: 'absolute', inset: 0, top: 96, background: `linear-gradient(180deg, ${g.tone}22 0%, transparent 40%)`, pointerEvents: 'none' }} />
                    <div style={{ padding: '12px 14px 14px', position: 'relative' }}>
                      <div style={{ fontFamily: WR_SERIF, fontSize: 16, color: t.ink, fontWeight: 500, letterSpacing: '-0.01em', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.title}</div>
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                        <span style={{ fontFamily: WR_SERIF, fontSize: 26, color: t.ink, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', lineHeight: 1 }}>
                          {g.hours.toFixed(1)}<span style={{ fontSize: 14, color: t.ink3, fontStyle: 'italic', marginLeft: 2 }}>h</span>
                        </span>
                        <span style={{ fontSize: 11, color: t.ink3, fontFamily: WR_MONO }}>{g.last}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top games + Backlog */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20 }}>
            {/* Top games */}
            <div style={{ border: `1px solid ${t.line}`, borderRadius: 10, background: t.panel, padding: '22px 24px' }}>
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontFamily: WR_SERIF, fontSize: 20, color: t.ink, fontWeight: 400, letterSpacing: '-0.01em' }}>
                  Most played, <span style={{ fontStyle: 'italic' }}>all time</span>
                </div>
                <div style={{ fontSize: 12, color: t.ink3, fontFamily: WR_MONO, marginTop: 2 }}>1,726 hours across the top five</div>
              </div>
              <div>
                {s.top.map((g, i) => {
                  const pct = g.hours / topMax;
                  return (
                    <div key={g.title} style={{ display: 'grid', gridTemplateColumns: '22px 1fr 90px', gap: 14, alignItems: 'center', padding: '11px 0', borderTop: i === 0 ? 'none' : `1px solid ${t.line}` }}>
                      <span style={{ fontFamily: WR_SERIF, fontSize: 16, color: t.ink3, fontStyle: 'italic', fontVariantNumeric: 'tabular-nums' }}>{i+1}</span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 14, color: t.ink, fontWeight: 500, marginBottom: 6 }}>{g.title}</div>
                        <div style={{ height: 6, background: `${t.accent}22`, borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
                          <div style={{ width: `${pct * 100}%`, height: '100%', background: i === 0 ? t.accent : `${t.accent}88`, borderRadius: 3 }} />
                        </div>
                      </div>
                      <span style={{ fontFamily: WR_SERIF, fontSize: 20, color: t.ink, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', textAlign: 'right' }}>
                        {g.hours}<span style={{ fontSize: 12, color: t.ink3, fontStyle: 'italic', marginLeft: 2 }}>h</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Backlog */}
            <div style={{
              border: `1px solid ${t.line}`, borderRadius: 10,
              background: theme === 'dark' ? `linear-gradient(135deg, ${t.panel2} 0%, ${t.panel} 100%)` : `linear-gradient(135deg, ${t.panel} 0%, ${t.panel2} 100%)`,
              padding: '22px 24px', position: 'relative', overflow: 'hidden',
            }}>
              {/* decorative paper tear */}
              <div style={{ position: 'absolute', right: -40, top: -40, width: 180, height: 180, borderRadius: '50%', background: `${t.accent2}1a`, filter: 'blur(20px)', pointerEvents: 'none' }} />
              <div style={{ fontSize: 11, color: t.ink3, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: WR_SANS, fontWeight: 500, marginBottom: 14, position: 'relative' }}>The backlog</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
                <span style={{ fontFamily: WR_SERIF, fontSize: 92, lineHeight: '76px', color: t.ink, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.04em', fontWeight: 400 }}>178</span>
                <span style={{ fontFamily: WR_SERIF, fontSize: 18, color: t.ink3, fontStyle: 'italic' }}>games waiting</span>
              </div>
              <div style={{ fontFamily: WR_SERIF, fontSize: 17, color: t.ink2, lineHeight: 1.5, fontWeight: 400, position: 'relative' }}>
                Subnautica has been on the shelf since <span style={{ color: t.ink, fontStyle: 'italic' }}>March 14, 2019</span>. You own roughly <span style={{ color: t.accent, fontFamily: WR_MONO, fontStyle: 'normal', fontSize: 15 }}>1,240</span> hours of content you haven't started.
              </div>
              <div style={{ marginTop: 20, paddingTop: 18, borderTop: `1px solid ${t.line}`, display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
                <span style={{
                  padding: '8px 14px', background: t.accent, color: t.accentInk,
                  borderRadius: 6, fontSize: 13, fontWeight: 500, fontFamily: WR_SANS,
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}>Pick tonight's game <WrIcon d={WR_ICONS.arrowRight} size={13} /></span>
                <span style={{ fontSize: 12, color: t.ink3 }}>or <span style={{ borderBottom: `1px solid ${t.line2}` }}>review the shelf</span></span>
              </div>
            </div>
          </div>

          {/* Hover caller */}
          <div style={{ position: 'absolute', top: 412, left: 470, pointerEvents: 'none' }}>
            <svg width="240" height="120" style={{ overflow: 'visible' }}>
              <path d="M 0 100 C 30 100, 60 60, 110 30" stroke={t.accent} strokeWidth="0.75" fill="none" />
              <circle cx="0" cy="100" r="2.5" fill={t.accent} />
            </svg>
            <div style={{ position: 'absolute', left: 110, top: 12, fontFamily: WR_MONO, fontSize: 10, color: t.accent, letterSpacing: '0.06em', textTransform: 'uppercase', width: 180 }}>
              hover: week 12 peak<br/>
              <span style={{ color: t.ink3, textTransform: 'none', letterSpacing: 0, fontStyle: 'italic', fontFamily: WR_SERIF, fontSize: 12 }}>18.2 h — your highest week since February</span>
            </div>
          </div>
        </main>
      </div>

      {/* Spec strip */}
      <div style={{ borderTop: `1px solid ${t.line}`, padding: '12px 40px', display: 'flex', gap: 28, fontFamily: WR_MONO, fontSize: 10, color: t.ink3, letterSpacing: '0.06em', textTransform: 'uppercase', background: t.bg }}>
        <span>body · söhne 14/1.5</span>
        <span>display · source serif 4</span>
        <span>mono · jb mono 12</span>
        <span>accent · <span style={{ color: t.accent }}>{t.accent}</span></span>
        <span>second · <span style={{ color: t.accent2 }}>{t.accent2}</span></span>
        <span>paper · {t.bg}</span>
      </div>
    </div>
  );
}

Object.assign(window, { Wrapped });
