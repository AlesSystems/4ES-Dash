// Game detail page — extends the Wrapped system established on Dashboard + Library.
// Reuses palette, type, sidebar, app bar, tile language, area-chart treatment.
// New vocabulary: editorial hero (ambient art backdrop + framed crisp header),
//   hero KPI numeric face, achievement row, friends strip, metadata table,
//   "untouched" empty composition.

const GD_SERIF = `"Source Serif 4", "Source Serif Pro", "Tiempos Text", Georgia, serif`;
const GD_SANS  = `"Söhne", "Inter Tight", -apple-system, system-ui, sans-serif`;
const GD_MONO  = `"JetBrains Mono", ui-monospace, monospace`;

function GDTokens(theme) { return window.WR_TOKENS_LIB[theme]; }

const GD_ICONS = {
  dashboard: 'M2 8l6-5 6 5v6H2zM6 14v-4h4v4',
  library: 'M3 2h3v12H3zM7 2h3v12H7zM11 4l2.5-.5L14 13l-2.5.5z',
  games: 'M2 8a3 3 0 0 1 3-3h6a3 3 0 0 1 0 6H5a3 3 0 0 1-3-3zM4 8h3M5.5 6.5v3M10 7.5h.01M12 9.5h.01',
  friends: 'M5 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM11 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM2 13c0-2 1.5-3 3-3s3 1 3 3M8 13c0-2 1.5-3 3-3s3 1 3 3',
  search: 'M7 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM14 14l-3.5-3.5',
  sun: 'M8 4.5V3M8 13v-1.5M3.5 8H2M14 8h-1.5M5 5L4 4M12 12l-1-1M5 11l-1 1M12 4l-1 1M8 6a2 2 0 1 1 0 4 2 2 0 0 1 0-4z',
  bell: 'M4 7a4 4 0 0 1 8 0v3l1 2H3l1-2zM6.5 13a1.5 1.5 0 0 0 3 0',
  chevron: 'M4 6l4 4 4-4',
  chevronR: 'M6 4l4 4-4 4',
  achievements: 'M5 2h6v3a3 3 0 1 1-6 0zM3 3v1a2 2 0 0 0 2 2M13 3v1a2 2 0 0 1-2 2M8 8v3M5.5 13h5',
  external: 'M9 3h4v4M13 3L7 9M11 8v4H3V4h4',
  lock: 'M4 7V5a4 4 0 0 1 8 0v2M3.5 7h9v6.5h-9z',
  arrowUp: 'M3 10l5-5 5 5',
};

function GDIcon({ d, size = 16, sw = 1.5 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

// ---------------- shared chrome ----------------

function GDAppBar({ t }) {
  const s = window.STEAM;
  return (
    <div style={{
      height: 56, borderBottom: `1px solid ${t.line}`,
      display: 'flex', alignItems: 'center', padding: '0 28px', gap: 28,
      background: t.bg, position: 'relative', zIndex: 5,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 24, height: 24, borderRadius: 12, background: t.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.bg }} />
        </div>
        <span style={{ fontFamily: GD_SERIF, fontSize: 18, color: t.ink, fontWeight: 500, fontStyle: 'italic', letterSpacing: '-0.01em' }}>4es</span>
        <span style={{ fontFamily: GD_SANS, fontSize: 13, color: t.ink2, fontWeight: 500, letterSpacing: '0.04em' }}>dash</span>
      </div>
      <nav style={{ display: 'flex', gap: 4, fontFamily: GD_SANS, fontSize: 14 }}>
        {[['Dashboard'], ['Library', true], ['Games'], ['Friends']].map(([n, active]) => (
          <span key={n} style={{ padding: '6px 12px', color: active ? t.ink : t.ink2, fontWeight: active ? 500 : 400, position: 'relative' }}>
            {n}
            {active && <span style={{ position: 'absolute', left: 12, right: 12, bottom: -17, height: 2, background: t.accent }} />}
          </span>
        ))}
      </nav>
      <div style={{ flex: 1 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, color: t.ink2 }}>
        <GDIcon d={GD_ICONS.bell} size={16} />
        <GDIcon d={GD_ICONS.sun} size={16} />
        <div style={{ width: 30, height: 30, borderRadius: '50%', background: `url(${s.user.avatar}) center/cover`, border: `1px solid ${t.line2}` }} />
      </div>
    </div>
  );
}

function GDSidebar({ t, minH }) {
  return (
    <aside style={{ width: 240, borderRight: `1px solid ${t.line}`, padding: '28px 18px', minHeight: minH, flexShrink: 0 }}>
      <div style={{ fontSize: 11, color: t.ink3, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: GD_SANS, padding: '0 10px 12px', fontWeight: 500 }}>Browse</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {[
          ['dashboard', 'Dashboard', null, false],
          ['library', 'Library', '312', true],
          ['games', 'Recently played', '5', false],
          ['achievements', 'Achievements', '4,128', false],
          ['friends', 'Friends', '48', false],
        ].map(([icon, label, count, active]) => (
          <div key={label} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '9px 10px', borderRadius: 6,
            color: active ? t.ink : t.ink2, background: active ? t.panel : 'transparent',
            fontSize: 14, position: 'relative',
          }}>
            {active && <span style={{ position: 'absolute', left: -18, top: 8, bottom: 8, width: 3, background: t.accent, borderRadius: 2 }} />}
            <GDIcon d={GD_ICONS[icon]} size={16} />
            <span style={{ flex: 1, fontWeight: active ? 500 : 400 }}>{label}</span>
            {count && <span style={{ fontSize: 12, color: t.ink3, fontFamily: GD_MONO }}>{count}</span>}
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: t.ink3, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: GD_SANS, padding: '28px 10px 12px', fontWeight: 500 }}>Collections</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {[['To finish', 12], ['Co-op queue', 6], ['Cozy', 9], ['Roguelikes', 14]].map(([l, n]) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '7px 10px', color: t.ink2, fontSize: 13 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: t.accent2, opacity: 0.7 }} />
            <span style={{ flex: 1 }}>{l}</span>
            <span style={{ fontSize: 11, color: t.ink3, fontFamily: GD_MONO }}>{n}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}

// ---------------- breadcrumb ----------------

function GDBreadcrumb({ t, title }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      fontFamily: GD_SANS, fontSize: 13, color: t.ink3,
      marginBottom: 16,
    }}>
      <span style={{ color: t.ink2, borderBottom: `1px solid ${t.line2}`, paddingBottom: 1 }}>Library</span>
      <span style={{ color: t.line2 }}>/</span>
      <span style={{ color: t.ink3, fontStyle: 'italic', fontFamily: GD_SERIF, fontSize: 14 }}>{title}</span>
    </div>
  );
}

// ---------------- hero ----------------
// Approach (a): blurred key art as ambient backdrop + crisp framed header on the right.

function GDHero({ t, theme, game, mode }) {
  const isPop = mode === 'populated';
  const scrimSolid = theme === 'dark' ? 'rgba(20,18,17,0.92)' : 'rgba(244,237,225,0.94)';
  const scrimMid   = theme === 'dark' ? 'rgba(20,18,17,0.78)' : 'rgba(244,237,225,0.78)';
  const scrimFar   = theme === 'dark' ? 'rgba(20,18,17,0.45)' : 'rgba(244,237,225,0.55)';
  const scrimEdge  = theme === 'dark' ? 'rgba(20,18,17,0.20)' : 'rgba(244,237,225,0.30)';
  const ambientHue = game.tone;

  return (
    <section style={{
      position: 'relative', overflow: 'hidden',
      borderBottom: `1px solid ${t.line}`, isolation: 'isolate',
    }}>
      {/* Blurred backdrop */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `url(${game.heroArt}) center/cover no-repeat`,
        filter: 'blur(28px) saturate(1.15)',
        transform: 'scale(1.12)',
        opacity: theme === 'dark' ? 0.85 : 0.7,
      }} />
      {/* Tonal tint baked from the art */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `linear-gradient(135deg, ${ambientHue}55 0%, transparent 55%, ${ambientHue}22 100%)`,
        mixBlendMode: theme === 'dark' ? 'soft-light' : 'multiply',
      }} />
      {/* Horizontal scrim — solid on left for type, fades through */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `linear-gradient(90deg, ${scrimSolid} 0%, ${scrimSolid} 32%, ${scrimMid} 55%, ${scrimFar} 82%, ${scrimEdge} 100%)`,
      }} />
      {/* Vertical fade to body */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, height: 100,
        background: `linear-gradient(180deg, transparent 0%, ${t.bg} 100%)`,
      }} />

      {/* Content */}
      <div style={{ position: 'relative', padding: '28px 40px 28px', display: 'flex', gap: 40, alignItems: 'flex-start', minHeight: 440 }}>
        {/* LEFT — type column */}
        <div style={{ flex: 1, minWidth: 0, paddingTop: 4 }}>
          <GDBreadcrumb t={t} title={game.title} />

          <h1 style={{
            margin: 0, fontFamily: GD_SERIF, fontWeight: 400,
            fontSize: 84, lineHeight: 0.95, letterSpacing: '-0.035em',
            color: t.ink,
          }}>
            {game.titleParts ? (
              <React.Fragment>
                {game.titleParts[0]}<span style={{ fontStyle: 'italic', color: t.ink2 }}>{game.titleParts[1]}</span>{game.titleParts[2]}
              </React.Fragment>
            ) : game.title}
          </h1>

          <div style={{ marginTop: 14, fontFamily: GD_SANS, fontSize: 15, color: t.ink2, display: 'flex', gap: 10, alignItems: 'baseline' }}>
            <span>{game.developer}</span>
            <span style={{ color: t.line2 }}>·</span>
            <span style={{ fontFamily: GD_SERIF, fontStyle: 'italic', color: t.ink3, fontSize: 16 }}>released</span>
            <span style={{ fontFamily: GD_MONO, fontSize: 13, fontVariantNumeric: 'tabular-nums', color: t.ink2 }}>{game.released}</span>
          </div>

          <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {game.tags.map(tag => (
              <span key={tag} style={{
                padding: '4px 10px',
                fontFamily: GD_SANS, fontSize: 12, fontWeight: 500,
                color: t.ink2,
                background: theme === 'dark' ? 'rgba(244,236,226,0.06)' : 'rgba(31,26,20,0.05)',
                border: `1px solid ${t.line2}`,
                borderRadius: 999, lineHeight: 1.4,
              }}>{tag}</span>
            ))}
          </div>

          <div style={{ marginTop: 22, display: 'flex', alignItems: 'flex-end', gap: 18 }}>
            <div style={{
              fontFamily: GD_SERIF, fontWeight: 400,
              fontSize: 168, lineHeight: 0.82, letterSpacing: '-0.05em',
              color: t.ink, fontVariantNumeric: 'tabular-nums',
            }}>
              {isPop ? (
                <React.Fragment>
                  142<span style={{ fontStyle: 'italic', color: t.ink2 }}>.3</span>
                </React.Fragment>
              ) : (
                <span style={{ color: t.ink2 }}>0</span>
              )}
            </div>
            <div style={{ paddingBottom: 12 }}>
              <div style={{ fontFamily: GD_SERIF, fontStyle: 'italic', fontSize: 22, color: t.ink3, lineHeight: 1, marginBottom: 10 }}>hours played</div>
              {isPop ? (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, background: t.pillSuccessBg, color: t.pillSuccessInk, fontFamily: GD_MONO, fontSize: 12, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
                  <GDIcon d={GD_ICONS.arrowUp} size={11} sw={2} />
                  +12.4 h<span style={{ opacity: 0.75, fontWeight: 400, marginLeft: 4 }}>· last 14 days</span>
                </div>
              ) : (
                <div style={{ fontFamily: GD_MONO, fontSize: 12, color: t.ink3, fontVariantNumeric: 'tabular-nums', display: 'flex', gap: 8, alignItems: 'baseline' }}>
                  <span>Owned since {game.ownedSince}</span>
                  <span style={{ color: t.line2 }}>·</span>
                  <span style={{ fontFamily: GD_SERIF, fontStyle: 'italic', fontSize: 13, color: t.ink3 }}>waiting {game.waiting}</span>
                </div>
              )}
            </div>
          </div>

          <div style={{ marginTop: 22, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              padding: '9px 16px', borderRadius: 8,
              background: theme === 'dark' ? 'rgba(244,236,226,0.06)' : 'rgba(31,26,20,0.05)',
              border: `1px solid ${t.line2}`, color: t.ink,
              fontFamily: GD_SANS, fontSize: 13, fontWeight: 500,
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>Launch on Steam <GDIcon d={GD_ICONS.external} size={11} sw={1.6} /></span>
            <span style={{
              padding: '9px 16px', borderRadius: 8,
              color: t.ink2, fontFamily: GD_SANS, fontSize: 13, fontWeight: 500,
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>View on Steam store <GDIcon d={GD_ICONS.external} size={11} sw={1.6} /></span>
            <span style={{
              padding: '9px 16px', color: t.ink3,
              fontFamily: GD_SANS, fontSize: 13, fontWeight: 500,
            }}>Hide from library</span>
          </div>
        </div>

        {/* RIGHT — framed crisp header art */}
        <div style={{ width: 460, flexShrink: 0, position: 'relative' }}>
          <div style={{
            width: 460, height: 215, borderRadius: 6, overflow: 'hidden',
            border: `1px solid ${t.line2}`,
            background: `url(${game.headerArt}) center/cover no-repeat`,
            position: 'relative',
          }}>
            <div style={{
              position: 'absolute', left: 0, right: 0, bottom: 0,
              padding: '8px 12px',
              background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.55) 100%)',
              display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
              fontFamily: GD_MONO, fontSize: 10, color: 'rgba(255,255,255,0.8)',
              letterSpacing: '0.06em', textTransform: 'uppercase',
            }}>
              <span>header · 460 × 215</span>
              <span style={{ color: 'rgba(255,255,255,0.6)' }}>steamcdn</span>
            </div>
          </div>

          {isPop && (
            <div style={{ marginTop: 22, padding: '14px 16px', borderRadius: 10, background: theme === 'dark' ? 'rgba(244,236,226,0.04)' : 'rgba(31,26,20,0.03)', border: `1px solid ${t.line}` }}>
              <div style={{ fontFamily: GD_SANS, fontSize: 11, color: t.ink3, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 500, marginBottom: 10 }}>Friends in this game</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ display: 'flex' }}>
                  {['1539571696857-e87b67d6ec5c', '1535713875002-d1d0cf377fde', '1494790108377-be9c29b29330'].map((id, i) => (
                    <div key={i} style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: `url(https://images.unsplash.com/photo-${id}?w=80&h=80&fit=crop&crop=faces) center/cover`,
                      border: `2px solid ${t.bg}`, marginLeft: i === 0 ? 0 : -8,
                    }} />
                  ))}
                </div>
                <div style={{ fontFamily: GD_SERIF, fontSize: 14, color: t.ink2, fontStyle: 'italic' }}>
                  <span style={{ fontFamily: GD_MONO, fontStyle: 'normal', color: t.ink }}>3</span> friends play this · <span style={{ color: t.up }}>1 online now</span>
                </div>
              </div>
            </div>
          )}

          {!isPop && (
            <div style={{ marginTop: 22, padding: '14px 16px', borderRadius: 10, background: theme === 'dark' ? 'rgba(244,236,226,0.02)' : 'rgba(31,26,20,0.02)', border: `1px dashed ${t.line2}` }}>
              <div style={{ fontFamily: GD_SERIF, fontStyle: 'italic', fontSize: 14, color: t.ink3, lineHeight: 1.5 }}>
                Quiet shelf. <span style={{ fontFamily: GD_SANS, fontStyle: 'normal', fontSize: 12, color: t.ink2 }}>None of your friends own this.</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// ---------------- KPI row ----------------

function GDKpiCell({ label, value, valueSuffix, sub, t, lastCol, italicSuffix }) {
  return (
    <div style={{
      padding: '14px 24px 12px',
      borderRight: lastCol ? 'none' : `1px solid ${t.line}`,
      position: 'relative', minWidth: 0,
    }}>
      <div style={{ fontFamily: GD_SANS, fontSize: 11, color: t.ink3, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 500, marginBottom: 12 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 8 }}>
        <span style={{ fontFamily: GD_SERIF, fontSize: 46, lineHeight: 0.95, fontWeight: 400, color: t.ink, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.035em' }}>{value}</span>
        {valueSuffix && <span style={{ fontFamily: GD_SERIF, fontSize: italicSuffix ? 18 : 22, color: t.ink3, fontStyle: italicSuffix ? 'italic' : 'normal', marginLeft: 4 }}>{valueSuffix}</span>}
      </div>
      <div style={{ fontFamily: GD_MONO, fontSize: 12, color: t.ink3, fontVariantNumeric: 'tabular-nums', lineHeight: 1.4 }}>{sub}</div>
    </div>
  );
}

function GDKpiRow({ t, theme, mode }) {
  if (mode === 'populated') {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderBottom: `1px solid ${t.line}` }}>
        <GDKpiCell t={t} label="Achievements" value="42" valueSuffix="/ 54" italicSuffix
          sub={<React.Fragment><span style={{ color: t.ink2 }}>78% complete</span> · <span style={{ color: t.pillSuccessInk }}>+3 in 14 days</span></React.Fragment>} />
        <GDKpiCell t={t} label="Last played" value="Today"
          sub={<span style={{ color: t.ink2 }}>4-hour session · ended 2h ago</span>} />
        <GDKpiCell t={t} label="Cost per hour" value="$0.42"
          sub={<React.Fragment><span style={{ color: t.ink2 }}>paid $59.99</span> · 142.3 h</React.Fragment>} />
        <GDKpiCell t={t} label="Library rank" value="#6" valueSuffix="of 312" italicSuffix lastCol
          sub={<span style={{ color: t.ink2 }}>by playtime · top 2%</span>} />
      </div>
    );
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', borderBottom: `1px solid ${t.line}` }}>
      <GDKpiCell t={t} label="Owned for" value="7" valueSuffix="yr 2 mo" italicSuffix
        sub={<React.Fragment><span style={{ color: t.ink2 }}>purchased March 14, 2019</span> · paid $24.99</React.Fragment>} />
      <GDKpiCell t={t} label="Library rank" value="—" valueSuffix="untouched" italicSuffix lastCol
        sub={<span style={{ color: t.ink2 }}>shared with 178 other games on the shelf</span>} />
    </div>
  );
}

// ---------------- chart ----------------

function GDPlayChart({ t, theme, width = 1056, height = 260 }) {
  const data = [4.8, 7.2, 10.4, 6.1, 9.3, 12.6, 15.1, 11.8, 13.2, 18.2, 14.6, 12.4];
  const labels = ['Mar 3', 'Mar 10', 'Mar 17', 'Mar 24', 'Mar 31', 'Apr 7', 'Apr 14', 'Apr 21', 'Apr 28', 'May 5', 'May 12', 'May 19'];
  const min = 0, max = 20;
  const padX = 14, padTop = 38, padBottom = 28;
  const w = width - padX * 2 - 44;
  const h = height - padTop - padBottom;
  const step = w / (data.length - 1);
  const pts = data.map((v, i) => [padX + i * step, padTop + h - ((v - min) / (max - min)) * h]);
  const linePath = pts.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(' ');
  const fillPath = linePath + ` L${pts[pts.length-1][0]},${padTop + h} L${pts[0][0]},${padTop + h} Z`;
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map(p => padTop + h * p);
  const peakIdx = data.indexOf(Math.max(...data));
  const peakPt = pts[peakIdx];
  const todayPt = pts[pts.length - 1];
  const fillId = `gd-area-${theme}`;

  return (
    <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={t.accent} stopOpacity={theme === 'dark' ? 0.32 : 0.22} />
          <stop offset="100%" stopColor={t.accent} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {gridLines.map((y, i) => (
        <line key={i} x1={padX} x2={padX + w} y1={y} y2={y}
          stroke={t.line} strokeWidth="0.75"
          strokeDasharray={i === gridLines.length - 1 ? '0' : '2,4'} />
      ))}
      {[20, 15, 10, 5, 0].map((v, i) => (
        <text key={v} x={padX + w + 8} y={padTop + h * (i / 4) + 4}
          fontFamily={GD_MONO} fontSize="10" fill={t.ink3} style={{ fontVariantNumeric: 'tabular-nums' }}>
          {v} h
        </text>
      ))}
      <line x1={todayPt[0]} x2={todayPt[0]} y1={padTop} y2={padTop + h}
        stroke={t.accent} strokeWidth="0.75" strokeDasharray="2,3" opacity="0.45" />

      <path d={fillPath} fill={`url(#${fillId})`} />
      <path d={linePath} stroke={t.accent} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />

      {/* peak annotation */}
      <line x1={peakPt[0]} x2={peakPt[0]} y1={peakPt[1] - 6} y2={peakPt[1] - 24}
        stroke={t.accent} strokeWidth="0.75" />
      <text x={peakPt[0]} y={peakPt[1] - 30} textAnchor="middle"
        fontFamily={GD_SERIF} fontSize="13" fontStyle="italic" fill={t.ink2}>
        Peak — <tspan fontFamily={GD_MONO} fontStyle="normal" fontSize="12" fill={t.ink}>18.2 h</tspan>
      </text>
      <circle cx={peakPt[0]} cy={peakPt[1]} r="3.5" fill={t.bg} stroke={t.accent} strokeWidth="1.5" />

      {/* today marker */}
      <circle cx={todayPt[0]} cy={todayPt[1]} r="4" fill={t.bg} stroke={t.accent} strokeWidth="1.8" />
      <text x={todayPt[0] - 8} y={todayPt[1] - 10} textAnchor="end"
        fontFamily={GD_MONO} fontSize="10" fill={t.ink} style={{ fontVariantNumeric: 'tabular-nums' }}>
        12.4h
      </text>

      {pts.map((p, i) => {
        if (i % 2 !== 0 && i !== pts.length - 1) return null;
        return (
          <text key={'x' + i} x={p[0]} y={height - 8}
            fontFamily={GD_MONO} fontSize="10" fill={i === pts.length - 1 ? t.ink2 : t.ink3}
            textAnchor="middle">
            {i === pts.length - 1 ? 'today' : labels[i]}
          </text>
        );
      })}
    </svg>
  );
}

function GDChartSection({ t, theme, mode }) {
  const segments = ['12 w', '6 mo', '1 y', 'All'];
  if (mode === 'untouched') {
    return (
      <div style={{ marginTop: 18, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <div style={{ fontFamily: GD_SERIF, fontSize: 26, color: t.ink, fontWeight: 400, letterSpacing: '-0.012em' }}>
              Playtime <span style={{ fontStyle: 'italic', color: t.ink2 }}>over time</span>
            </div>
            <div style={{ fontFamily: GD_SANS, fontSize: 13, color: t.ink3, marginTop: 4 }}>Weekly hours · waiting for the first session</div>
          </div>
          <div style={{ display: 'inline-flex', padding: 3, background: theme === 'dark' ? 'rgba(244,236,226,0.04)' : 'rgba(31,26,20,0.04)', border: `1px solid ${t.line}`, borderRadius: 999, opacity: 0.5 }}>
            {segments.map(s => (
              <span key={s} style={{ padding: '5px 13px', borderRadius: 999, fontFamily: GD_SANS, fontSize: 12, color: t.ink3 }}>{s}</span>
            ))}
          </div>
        </div>
        <div style={{
          position: 'relative', borderRadius: 14,
          border: `1px dashed ${t.line2}`,
          minHeight: 260, padding: '40px 32px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: theme === 'dark' ? 'rgba(244,236,226,0.015)' : 'rgba(31,26,20,0.015)',
          overflow: 'hidden',
        }}>
          <svg width="100%" height="60" viewBox="0 0 1000 60" preserveAspectRatio="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 60, opacity: 0.4, pointerEvents: 'none' }}>
            <line x1="20" x2="980" y1="55" y2="55" stroke={t.line2} strokeWidth="0.75" strokeDasharray="2,4" />
            <line x1="20" x2="980" y1="40" y2="40" stroke={t.line} strokeWidth="0.75" strokeDasharray="2,4" />
            <line x1="20" x2="980" y1="25" y2="25" stroke={t.line} strokeWidth="0.75" strokeDasharray="2,4" />
            <line x1="20" x2="980" y1="10" y2="10" stroke={t.line} strokeWidth="0.75" strokeDasharray="2,4" />
          </svg>
          <div style={{ position: 'relative', textAlign: 'center', maxWidth: 520 }}>
            <div style={{ fontFamily: GD_SERIF, fontSize: 34, color: t.ink, fontWeight: 400, letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: 14 }}>
              No playtime to <span style={{ fontStyle: 'italic', color: t.ink2 }}>chart yet</span>.
            </div>
            <div style={{ fontFamily: GD_SERIF, fontSize: 16, color: t.ink2, lineHeight: 1.55, marginBottom: 26 }}>
              Subnautica has been in your library for <span style={{ fontFamily: GD_MONO, fontSize: 14, color: t.ink, fontStyle: 'normal' }}>7 years</span>. The chart will fill in once you play.
            </div>
            <span style={{
              padding: '9px 16px', borderRadius: 8,
              border: `1px solid ${t.line2}`,
              color: t.ink, background: 'transparent',
              fontFamily: GD_SANS, fontSize: 13, fontWeight: 500,
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>Launch on Steam <GDIcon d={GD_ICONS.external} size={11} sw={1.6} /></span>
            <div style={{ marginTop: 22, fontFamily: GD_MONO, fontSize: 11, color: t.ink3, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.04em' }}>
              Average untouched game in your library: 4.2 years.
            </div>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div style={{ marginTop: 14, marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
        <div>
          <div style={{ fontFamily: GD_SERIF, fontSize: 26, color: t.ink, fontWeight: 400, letterSpacing: '-0.012em' }}>
            Playtime <span style={{ fontStyle: 'italic', color: t.ink2 }}>over time</span>
          </div>
          <div style={{ fontFamily: GD_SANS, fontSize: 13, color: t.ink3, marginTop: 4 }}>Weekly hours · 12 weeks of trend</div>
        </div>
        <div style={{ display: 'inline-flex', padding: 3, background: theme === 'dark' ? 'rgba(244,236,226,0.04)' : 'rgba(31,26,20,0.04)', border: `1px solid ${t.line}`, borderRadius: 999 }}>
          {segments.map((s, i) => (
            <span key={s} style={{
              padding: '5px 13px', borderRadius: 999, fontFamily: GD_SANS, fontSize: 12,
              background: i === 0 ? t.ink : 'transparent',
              color: i === 0 ? t.bg : t.ink2,
              fontWeight: i === 0 ? 500 : 400,
            }}>{s}</span>
          ))}
        </div>
      </div>
      <div style={{
        display: 'flex', gap: 32, padding: '8px 0 10px',
        borderTop: `1px solid ${t.line}`, borderBottom: `1px solid ${t.line}`,
        marginBottom: 10,
      }}>
        {[
          ['Last 14 days', '12.4 h'],
          ['Average week (12 w)', '8.6 h'],
          ['Longest session', '6h 12m on Apr 23'],
        ].map(([k, v]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontFamily: GD_SANS, fontSize: 11, color: t.ink3, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 500 }}>{k}</span>
            <span style={{ fontFamily: GD_MONO, fontSize: 13, color: t.ink, fontVariantNumeric: 'tabular-nums' }}>{v}</span>
          </div>
        ))}
      </div>
      <GDPlayChart t={t} theme={theme} />
    </div>
  );
}

// ---------------- achievements ----------------

const GD_ACH_GLYPHS = {
  sword:     'M14 2L7 9M14 2h-3M14 2v3M7 9l-2 2-3-1 1 3-2 2 4 1 1-4z',
  bolt:      'M9 2L3 9h4l-1 5 6-7H8z',
  laurel:    'M8 14c-3-1-5-4-5-7M8 14c3-1 5-4 5-7M5 8c0-2 1-3 3-3s3 1 3 3M8 5V3M4 11h1M11 11h1',
  tentacle:  'M3 13c0-3 2-5 5-5s5 2 5 5M8 8V5M6 5h4M5 11h.01M11 11h.01M8 13v.01',
  shield:    'M8 2l5 2v4c0 3-2 5-5 6-3-1-5-3-5-6V4z',
  hourglass: 'M4 2h8M4 14h8M4 2c0 3 4 4 4 6s-4 3-4 6M12 2c0 3-4 4-4 6s4 3 4 6',
  skull:     'M3 9a5 5 0 1 1 10 0v3l-1 1H4l-1-1zM6 8.5h.01M10 8.5h.01M7 11.5h2',
  burst:     'M8 2v3M8 11v3M2 8h3M11 8h3M4 4l2 2M10 10l2 2M4 12l2-2M10 6l2-2',
};

function GDAchievementRow({ row, t, theme, locked }) {
  const rarityPct = parseFloat(row.rarity);
  const intensity = Math.max(0.2, Math.min(1, (40 - Math.min(rarityPct, 40)) / 40));
  const dotOpacity = locked ? 0.35 : intensity;
  const isUltraRare = rarityPct < 5;

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '64px 1fr auto', gap: 14, alignItems: 'center',
      padding: '14px 0', borderTop: `1px solid ${t.line}`, minWidth: 0,
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: 8,
        background: locked
          ? (theme === 'dark' ? 'rgba(244,236,226,0.03)' : 'rgba(31,26,20,0.03)')
          : `linear-gradient(135deg, ${t.accent}1f 0%, ${t.accent}0a 100%)`,
        border: `1px solid ${locked ? t.line : t.line2}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: locked ? t.ink3 : t.accent,
        opacity: locked ? 0.55 : 1,
        flexShrink: 0,
      }}>
        <svg width="32" height="32" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
          <path d={GD_ACH_GLYPHS[row.glyph]} />
        </svg>
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontFamily: GD_SERIF, fontSize: 16, color: locked ? t.ink2 : t.ink,
          fontWeight: 500, letterSpacing: '-0.01em', marginBottom: 4, lineHeight: 1.2,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {locked && <span style={{ color: t.ink3 }}><GDIcon d={GD_ICONS.lock} size={11} sw={1.6} /></span>}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.title}</span>
        </div>
        <div style={{
          fontFamily: GD_SANS, fontSize: 13, color: t.ink3, lineHeight: 1.4,
          marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{row.desc}</div>
        <div style={{ fontFamily: GD_MONO, fontSize: 11, color: t.ink3, display: 'inline-flex', alignItems: 'center', gap: 6, fontVariantNumeric: 'tabular-nums' }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%', background: t.accent, opacity: dotOpacity,
            boxShadow: isUltraRare && !locked ? `0 0 0 3px ${t.accent}26` : 'none',
          }} />
          <span>{row.rarity} of players</span>
        </div>
      </div>
      <div style={{ textAlign: 'right', minWidth: 110, flexShrink: 0 }}>
        {locked ? (
          <span style={{ fontFamily: GD_SERIF, fontStyle: 'italic', fontSize: 14, color: t.ink3 }}>Locked</span>
        ) : (
          <div>
            <div style={{ fontFamily: GD_MONO, fontSize: 10, color: t.pillSuccessInk, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 3, fontWeight: 500 }}>Unlocked</div>
            <div style={{ fontFamily: GD_MONO, fontSize: 12, color: t.ink, fontVariantNumeric: 'tabular-nums' }}>{row.date}</div>
          </div>
        )}
      </div>
    </div>
  );
}

const GD_ACH_FIXTURE = [
  { title: 'Foe-Smiter',                desc: 'Reach level 12 with a character.',      rarity: '41%',  date: 'Dec 4, 2025',  glyph: 'sword' },
  { title: 'Critical Hit!',             desc: 'Deal 100+ damage in a single attack.',  rarity: '67%',  date: 'Nov 22, 2025', glyph: 'bolt' },
  { title: "All's Well That Ends Well", desc: 'Complete the game.',                    rarity: '38%',  date: 'Apr 12, 2026', glyph: 'laurel' },
  { title: 'Mind Flayer',               desc: 'Embrace the parasite.',                 rarity: '22%',  date: 'Feb 8, 2026',  glyph: 'tentacle' },
  { title: 'Mostly Harmless',           desc: 'Complete the game on Honour Mode.',     rarity: '0.8%', date: null,           glyph: 'shield',    forceLock: true },
  { title: 'Ceremorphosis Interruptus', desc: "Save Shadowheart's arc.",               rarity: '14%',  date: null,           glyph: 'hourglass', forceLock: true },
  { title: 'The Lord of Bhaal',         desc: 'Complete a Dark Urge playthrough.',     rarity: '6%',   date: null,           glyph: 'skull',     forceLock: true },
  { title: 'Crit Happens',              desc: 'Land 50 critical hits.',                rarity: '71%',  date: 'Oct 30, 2025', glyph: 'burst' },
];

function GDAchievements({ t, theme, mode }) {
  const isPop = mode === 'populated';
  const unlocked = isPop ? 42 : 0;
  const total = isPop ? 54 : 35;
  const pct = (unlocked / total) * 100;
  const rows = isPop ? GD_ACH_FIXTURE : [...GD_ACH_FIXTURE].sort((a, b) => parseFloat(a.rarity) - parseFloat(b.rarity));

  return (
    <section style={{ marginTop: 44 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ flex: 1, minWidth: 0, paddingRight: 24 }}>
          <div style={{ fontFamily: GD_SERIF, fontSize: 26, color: t.ink, fontWeight: 400, letterSpacing: '-0.012em', marginBottom: 8 }}>
            Achievements <span style={{ fontFamily: GD_MONO, fontSize: 15, color: t.ink3, fontVariantNumeric: 'tabular-nums' }}>· {unlocked} of {total} unlocked</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, maxWidth: 360 }}>
            <div style={{
              flex: 1, height: 3, borderRadius: 1.5,
              background: theme === 'dark' ? 'rgba(244,236,226,0.08)' : 'rgba(31,26,20,0.07)',
              overflow: 'hidden',
            }}>
              <div style={{ width: `${pct}%`, height: '100%', background: t.accent, borderRadius: 1.5 }} />
            </div>
            <span style={{ fontFamily: GD_MONO, fontSize: 11, color: t.ink2, fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>{Math.round(pct)}%</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '7px 12px', border: `1px solid ${t.line2}`, borderRadius: 8,
            fontFamily: GD_SANS, fontSize: 12, color: t.ink2,
          }}>
            <span style={{ color: t.ink3, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Sort</span>
            <span style={{ color: t.ink, fontWeight: 500 }}>{isPop ? 'Recently unlocked' : 'Rarity'}</span>
            <GDIcon d={GD_ICONS.chevron} size={11} sw={1.6} />
          </div>
          {isPop && (
            <div style={{
              display: 'inline-flex', padding: 3,
              border: `1px solid ${t.line2}`, borderRadius: 8,
              fontFamily: GD_SANS, fontSize: 12,
            }}>
              <span style={{ padding: '5px 10px', borderRadius: 5, background: t.ink, color: t.bg, fontWeight: 500 }}>Show locked</span>
              <span style={{ padding: '5px 10px', borderRadius: 5, color: t.ink3 }}>Hide</span>
            </div>
          )}
        </div>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 36,
        borderBottom: `1px solid ${t.line}`,
      }}>
        {rows.slice(0, 8).map((row, i) => (
          <GDAchievementRow key={i} row={row} t={t} theme={theme} locked={!isPop || row.forceLock} />
        ))}
      </div>

      <div style={{ marginTop: 18, fontFamily: GD_SANS, fontSize: 13, color: t.ink2, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span style={{ borderBottom: `1px solid ${t.line2}`, paddingBottom: 1 }}>Show all {total} achievements</span>
        <GDIcon d={GD_ICONS.chevronR} size={11} sw={1.6} />
      </div>
    </section>
  );
}

// ---------------- friends ----------------

const GD_FRIENDS = [
  { name: 'Pernille', persona: 'pern_writes',       hours: 87.2,  sub: 'last played 2 days ago',  online: false, avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop&crop=faces' },
  { name: 'Wojtek',   persona: 'theothernovgorod',  hours: 214.6, sub: 'online now',              online: true,  avatar: 'https://images.unsplash.com/photo-1539571696857-e87b67d6ec5c?w=80&h=80&fit=crop&crop=faces' },
  { name: 'Suresh',   persona: 'sureshdoespixels',  hours: 12.4,  sub: 'last played 3 weeks ago', online: false, avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop&crop=faces' },
];

function GDFriendsStrip({ t, theme, mode }) {
  if (mode === 'untouched') {
    return (
      <div>
        <div style={{ fontFamily: GD_SERIF, fontSize: 22, color: t.ink, fontWeight: 400, letterSpacing: '-0.012em', marginBottom: 14 }}>
          Friends who <span style={{ fontStyle: 'italic', color: t.ink2 }}>play</span>
        </div>
        <div style={{
          padding: '24px 22px', borderRadius: 10,
          border: `1px dashed ${t.line2}`,
          background: theme === 'dark' ? 'rgba(244,236,226,0.02)' : 'rgba(31,26,20,0.02)',
        }}>
          <div style={{ fontFamily: GD_SERIF, fontSize: 15, color: t.ink3, fontStyle: 'italic', lineHeight: 1.55 }}>
            None of your <span style={{ fontStyle: 'normal', fontFamily: GD_SANS, color: t.ink2 }}>48 friends</span> own this.
          </div>
        </div>
      </div>
    );
  }
  return (
    <div>
      <div style={{ fontFamily: GD_SERIF, fontSize: 22, color: t.ink, fontWeight: 400, letterSpacing: '-0.012em', marginBottom: 14 }}>
        Played by <span style={{ fontStyle: 'italic' }}>3 of your friends</span>
      </div>
      <div style={{
        display: 'flex', flexDirection: 'column',
        border: `1px solid ${t.line}`, borderRadius: 10, overflow: 'hidden',
        background: theme === 'dark' ? 'rgba(244,236,226,0.02)' : 'rgba(255,253,247,0.5)',
      }}>
        {GD_FRIENDS.map((f, i) => (
          <div key={f.name} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '14px 16px',
            borderTop: i === 0 ? 'none' : `1px solid ${t.line}`,
          }}>
            <div style={{ position: 'relative' }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: `url(${f.avatar}) center/cover`,
                border: `1px solid ${t.line2}`,
              }} />
              {f.online && <div style={{ position: 'absolute', bottom: -1, right: -1, width: 10, height: 10, borderRadius: '50%', background: t.up, border: `2px solid ${t.bg}` }} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontFamily: GD_SANS, fontSize: 14, color: t.ink, fontWeight: 500 }}>{f.name}</span>
                <span style={{ fontFamily: GD_MONO, fontSize: 11, color: t.ink3 }}>{f.persona}</span>
              </div>
              <div style={{ fontFamily: GD_MONO, fontSize: 11, color: f.online ? t.up : t.ink3, fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{f.sub}</div>
            </div>
            <div style={{ fontFamily: GD_SERIF, fontSize: 22, color: t.ink, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', lineHeight: 1 }}>
              {f.hours.toFixed(1)}<span style={{ fontSize: 13, color: t.ink3, fontStyle: 'italic', marginLeft: 2 }}>h</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------- metadata ----------------

function GDMetadata({ t, theme, mode }) {
  const rows = mode === 'populated' ? [
    ['Developer', 'Larian Studios'],
    ['Publisher', 'Larian Studios'],
    ['Released', 'August 3, 2023', true],
    ['Owned since', 'September 12, 2023', true],
    ['Paid', '$59.99', true],
    ['Current price', '$59.99', true],
    ['Languages', <span>English, German, French, Russian, Polish, Spanish — LatAm, Brazilian Portuguese, Chinese (Simplified), Japanese, Korean <span style={{ color: t.ink2, borderBottom: `1px solid ${t.line2}`, paddingBottom: 1 }}>+ 2 more</span></span>],
    ['Platforms', 'Windows, macOS'],
    ['Steam Deck', <span style={{ color: t.pillSuccessInk, fontWeight: 500 }}>Verified</span>],
  ] : [
    ['Developer', 'Unknown Worlds Entertainment'],
    ['Publisher', 'Unknown Worlds Entertainment'],
    ['Released', 'January 23, 2018', true],
    ['Owned since', 'March 14, 2019', true],
    ['Paid', '$24.99', true],
    ['Current price', '$29.99', true],
    ['Languages', <span>English, French, German, Italian, Spanish, Russian, Polish, Portuguese — Brazil, Chinese (Simplified) <span style={{ color: t.ink2, borderBottom: `1px solid ${t.line2}`, paddingBottom: 1 }}>+ 4 more</span></span>],
    ['Platforms', 'Windows, macOS, Linux'],
    ['Steam Deck', <span style={{ color: t.pillSuccessInk, fontWeight: 500 }}>Verified</span>],
  ];

  return (
    <div>
      <div style={{ fontFamily: GD_SERIF, fontSize: 22, color: t.ink, fontWeight: 400, letterSpacing: '-0.012em', marginBottom: 14 }}>
        About <span style={{ fontStyle: 'italic', color: t.ink2 }}>this game</span>
      </div>
      <div style={{
        border: `1px solid ${t.line}`, borderRadius: 10,
        background: theme === 'dark' ? 'rgba(244,236,226,0.015)' : 'rgba(255,253,247,0.4)',
        padding: '6px 20px',
      }}>
        {rows.map(([label, value, mono], i) => (
          <div key={label} style={{
            display: 'grid', gridTemplateColumns: '130px 1fr', gap: 18,
            padding: '12px 0',
            borderTop: i === 0 ? 'none' : `1px solid ${t.line}`,
            alignItems: 'baseline',
          }}>
            <span style={{ fontFamily: GD_SANS, fontSize: 12, color: t.ink3, letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: 500 }}>{label}</span>
            <span style={{
              fontFamily: mono ? GD_MONO : GD_SANS,
              fontSize: mono ? 13 : 14,
              color: t.ink, lineHeight: 1.5,
              fontVariantNumeric: mono ? 'tabular-nums' : 'normal',
            }}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------- spec strip ----------------

function GDSpecStrip({ t, extras }) {
  return (
    <div style={{
      borderTop: `1px solid ${t.line}`,
      padding: '12px 32px',
      display: 'flex', gap: 22, flexWrap: 'wrap',
      fontFamily: GD_MONO, fontSize: 10, color: t.ink3,
      letterSpacing: '0.06em', textTransform: 'uppercase',
      background: t.bg,
    }}>
      <span>body · söhne 14/1.5</span>
      <span>display · source serif 4</span>
      <span>mono · jb mono 12</span>
      <span>accent · <span style={{ color: t.accent }}>{t.accent}</span></span>
      <span>paper · {t.bg}</span>
      <span>hero scale · 84 / 0.95</span>
      <span>kpi face · 168 / 0.82</span>
      <span>chart · 260 px @ 1056 px</span>
      {extras && <span style={{ marginLeft: 'auto', color: t.ink2 }}>{extras}</span>}
    </div>
  );
}

// ---------------- fixtures ----------------

const GD_BG3 = {
  title: "Baldur's Gate 3",
  titleParts: ["Baldur's ", "Gate", " 3"],
  developer: 'Larian Studios',
  released: 'August 3, 2023',
  tags: ['RPG', 'Story Rich', 'Turn-Based Combat', 'Co-op', 'Choices Matter'],
  heroArt:   'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1600&h=620&fit=crop',
  headerArt: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=920&h=430&fit=crop',
  tone: '#6b3a2f',
};

const GD_SUB = {
  title: 'Subnautica',
  titleParts: ['Sub', 'naut', 'ica'],
  developer: 'Unknown Worlds Entertainment',
  released: 'January 23, 2018',
  tags: ['Survival', 'Underwater', 'Open World', 'Crafting', 'Atmospheric'],
  heroArt:   'https://images.unsplash.com/photo-1551244072-5d12893278ab?w=1600&h=620&fit=crop',
  headerArt: 'https://images.unsplash.com/photo-1551244072-5d12893278ab?w=920&h=430&fit=crop',
  tone: '#1f3a4a',
  ownedSince: 'March 14, 2019',
  waiting: '7 years',
};

// ---------------- frames ----------------

function GameDetailPopulated({ theme = 'dark' }) {
  const t = GDTokens(theme);
  return (
    <div data-screen-label={`Game detail · populated · ${theme}`} style={{
      width: 1440, minHeight: 2200, background: t.bgGrad, color: t.ink,
      fontFamily: GD_SANS, fontSize: 14, position: 'relative',
    }}>
      <GDAppBar t={t} />
      <div style={{ display: 'flex' }}>
        <GDSidebar t={t} minH={2144} />
        <main style={{ flex: 1, minWidth: 0 }}>
          <GDHero t={t} theme={theme} game={GD_BG3} mode="populated" />
          <GDKpiRow t={t} theme={theme} mode="populated" />
          <div style={{ padding: '0 40px 40px' }}>
            <GDChartSection t={t} theme={theme} mode="populated" />
            <GDAchievements t={t} theme={theme} mode="populated" />
            <section style={{ marginTop: 56, display: 'grid', gridTemplateColumns: '1fr 1.25fr', gap: 36 }}>
              <GDFriendsStrip t={t} theme={theme} mode="populated" />
              <GDMetadata t={t} theme={theme} mode="populated" />
            </section>
          </div>
        </main>
      </div>
      <GDSpecStrip t={t} extras="populated · BG3" />
    </div>
  );
}

function GameDetailUntouched({ theme = 'dark' }) {
  const t = GDTokens(theme);
  return (
    <div data-screen-label={`Game detail · untouched · ${theme}`} style={{
      width: 1440, minHeight: 1900, background: t.bgGrad, color: t.ink,
      fontFamily: GD_SANS, fontSize: 14, position: 'relative',
    }}>
      <GDAppBar t={t} />
      <div style={{ display: 'flex' }}>
        <GDSidebar t={t} minH={1844} />
        <main style={{ flex: 1, minWidth: 0 }}>
          <GDHero t={t} theme={theme} game={GD_SUB} mode="untouched" />
          <GDKpiRow t={t} theme={theme} mode="untouched" />
          <div style={{ padding: '0 40px 40px' }}>
            <GDChartSection t={t} theme={theme} mode="untouched" />
            <GDAchievements t={t} theme={theme} mode="untouched" />
            <section style={{ marginTop: 56, display: 'grid', gridTemplateColumns: '1fr 1.25fr', gap: 36 }}>
              <GDFriendsStrip t={t} theme={theme} mode="untouched" />
              <GDMetadata t={t} theme={theme} mode="untouched" />
            </section>
          </div>
        </main>
      </div>
      <GDSpecStrip t={t} extras="untouched · Subnautica · 2-kpi · empty composition" />
    </div>
  );
}

Object.assign(window, { GameDetailPopulated, GameDetailUntouched });
