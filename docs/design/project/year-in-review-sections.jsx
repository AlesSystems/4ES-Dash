// Year in Review — sections 2 through 7, plus fixtures and the top-level frames.

// ---------------- 2. PLAYTIME STORY ----------------

function YRMonthlyChart({ t, theme, mode, width = 1056, height = 280 }) {
  // months[] indexed Jan..Dec
  const populated = [38.2, 42.1, 56.4, 51.8, 47.3, 12.3, 28.6, 44.9, 68.1, 87.4, 79.2, 56.5];
  const early     = [0, 0, 0, 0, 0, 0, 0, 0, 0, 8.2, 22.1, 8.1];
  const data = mode === 'populated' ? populated : early;
  const labels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const min = 0;
  const max = mode === 'populated' ? 100 : 30;
  const padX = 16, padTop = 56, padBottom = 36;
  const w = width - padX * 2 - 46;
  const h = height - padTop - padBottom;
  const step = w / (data.length - 1);
  const pts = data.map((v, i) => [padX + i * step, padTop + h - ((v - min) / (max - min)) * h]);
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map(p => padTop + h * p);
  const peakIdx = data.indexOf(Math.max(...data));
  const peakPt = pts[peakIdx];
  // For early, only Oct/Nov/Dec carry the line
  let linePath, fillPath;
  if (mode === 'populated') {
    linePath = pts.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(' ');
    fillPath = linePath + ` L${pts[pts.length-1][0]},${padTop + h} L${pts[0][0]},${padTop + h} Z`;
  } else {
    const live = pts.slice(9);
    linePath = live.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(' ');
    fillPath = linePath + ` L${live[live.length-1][0]},${padTop + h} L${live[0][0]},${padTop + h} Z`;
  }
  const troughIdx = mode === 'populated' ? data.indexOf(Math.min(...data.filter((v,i)=>v>0))) : -1;
  const troughPt = troughIdx >= 0 ? pts[troughIdx] : null;
  const fillId = `yr-area-${theme}-${mode}`;
  const avg = mode === 'populated' ? data.reduce((s,v)=>s+v,0) / 12 : null;
  const avgY = avg ? padTop + h - (avg / max) * h : null;

  return (
    <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={t.accent} stopOpacity={theme === 'dark' ? 0.32 : 0.22} />
          <stop offset="100%" stopColor={t.accent} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {/* grid */}
      {gridLines.map((y, i) => (
        <line key={i} x1={padX} x2={padX + w} y1={y} y2={y}
          stroke={t.line} strokeWidth="0.75"
          strokeDasharray={i === gridLines.length - 1 ? '0' : '2,4'} />
      ))}
      {/* y axis labels */}
      {[max, max*0.75, max*0.5, max*0.25, 0].map((v, i) => (
        <text key={v + '-' + i} x={padX + w + 10} y={padTop + h * (i / 4) + 4}
          fontFamily={YR_MONO} fontSize="10" fill={t.ink3} style={{ fontVariantNumeric: 'tabular-nums' }}>
          {Math.round(v)} h
        </text>
      ))}
      {/* avg baseline (populated only) */}
      {avg && (
        <React.Fragment>
          <line x1={padX} x2={padX + w} y1={avgY} y2={avgY} stroke={t.accent2} strokeWidth="0.75" strokeDasharray="3,3" opacity="0.55" />
          <text x={padX + 4} y={avgY - 6} fontFamily={YR_MONO} fontSize="10" fill={t.accent2}
            style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            AVG · {avg.toFixed(1)} h
          </text>
        </React.Fragment>
      )}

      <path d={fillPath} fill={`url(#${fillId})`} />
      <path d={linePath} stroke={t.accent} strokeWidth="1.75" fill="none" strokeLinecap="round" strokeLinejoin="round" />

      {/* trough annotation (populated) */}
      {troughPt && (
        <React.Fragment>
          <line x1={troughPt[0]} x2={troughPt[0]} y1={troughPt[1] + 6} y2={troughPt[1] + 28}
            stroke={t.line2} strokeWidth="0.75" />
          <text x={troughPt[0]} y={troughPt[1] + 44} textAnchor="middle"
            fontFamily={YR_SERIF} fontSize="12" fontStyle="italic" fill={t.ink3}>
            quietest — <tspan fontFamily={YR_MONO} fontStyle="normal" fontSize="11" fill={t.ink2}>12.3 h</tspan>
          </text>
          <circle cx={troughPt[0]} cy={troughPt[1]} r="3" fill={t.bg} stroke={t.line2} strokeWidth="1.25" />
        </React.Fragment>
      )}

      {/* peak annotation */}
      {peakPt && data[peakIdx] > 0 && (
        <React.Fragment>
          <line x1={peakPt[0]} x2={peakPt[0]} y1={peakPt[1] - 6} y2={peakPt[1] - 30}
            stroke={t.accent} strokeWidth="0.75" />
          <g transform={`translate(${peakPt[0]}, ${peakPt[1] - 50})`}>
            <text textAnchor="middle"
              fontFamily={YR_SERIF} fontSize="14" fontStyle="italic" fill={t.ink2}>
              peak — <tspan fontFamily={YR_MONO} fontStyle="normal" fontSize="13" fill={t.ink}>
                {mode === 'populated' ? '87.4 h' : '22.1 h'}
              </tspan>
            </text>
            <text textAnchor="middle" dy="14"
              fontFamily={YR_MONO} fontSize="10" fill={t.ink3}
              style={{ letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {mode === 'populated' ? 'OCT · BG3 launch follow-up' : 'NOV · stardew weekend'}
            </text>
          </g>
          <circle cx={peakPt[0]} cy={peakPt[1]} r="4.5" fill={t.bg} stroke={t.accent} strokeWidth="1.75" />
        </React.Fragment>
      )}

      {/* x labels */}
      {pts.map((p, i) => (
        <text key={'x' + i} x={p[0]} y={height - 10}
          fontFamily={YR_MONO} fontSize="10"
          fill={mode === 'early' && i < 9 ? t.line2 : (i === peakIdx ? t.ink2 : t.ink3)}
          textAnchor="middle"
          style={{ fontWeight: i === peakIdx ? 500 : 400 }}>
          {labels[i]}
        </text>
      ))}
    </svg>
  );
}

function YRStatCard({ label, value, valueSuffix, italic, t, mono }) {
  return (
    <div style={{ flex: 1, padding: '20px 22px', minWidth: 0 }}>
      <div style={{ fontFamily: YR_SANS, fontSize: 11, color: t.ink3, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 500, marginBottom: 14 }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, fontFamily: YR_SERIF, color: t.ink, lineHeight: 0.95 }}>
        <span style={{ fontSize: 40, fontWeight: 400, letterSpacing: '-0.03em', fontVariantNumeric: mono ? 'tabular-nums' : 'normal' }}>
          {value}
        </span>
        {valueSuffix && (
          <span style={{ fontSize: italic ? 16 : 18, color: t.ink3, fontStyle: italic ? 'italic' : 'normal' }}>
            {valueSuffix}
          </span>
        )}
      </div>
    </div>
  );
}

function YRPlaytimeSection({ t, theme, mode }) {
  const isPop = mode === 'populated';
  const lede = isPop
    ? <React.Fragment>October was your <span style={{ fontStyle: 'normal', color: t.ink, fontFamily: YR_MONO, fontSize: 16 }}>87 h</span> month — mostly <span style={{ color: t.ink }}>Baldur's Gate 3</span>. June, your quietest, was barely a weekend.</React.Fragment>
    : <React.Fragment>Three months on the platform. November was your loudest at <span style={{ fontStyle: 'normal', color: t.ink, fontFamily: YR_MONO, fontSize: 16 }}>22 h</span> — the chart will fill in.</React.Fragment>;

  const cards = isPop ? [
    ['Avg per day', '1.68', 'h', true],
    ['Sessions', '384', null, false],
    ['Longest session', '9h 24m', null, false],
    ['Days played', '247', 'of 365', true],
  ] : [
    ['Avg per day since joining', '0.51', 'h', true],
    ['Sessions', '41', null, false],
    ['Longest session', '3h 48m', null, false],
    ['Days played', '28', 'of 81', true],
  ];

  return (
    <section style={{ marginTop: 96 }}>
      <YRSectionHead
        t={t}
        eyebrow="Chapter one"
        heading="Your year in"
        italicWord="hours"
        lede={lede}
      />
      <div style={{
        border: `1px solid ${t.line}`, borderRadius: 14,
        background: theme === 'dark' ? 'rgba(244,236,226,0.02)' : 'rgba(255,253,247,0.5)',
        padding: '28px 24px 12px',
      }}>
        <YRMonthlyChart t={t} theme={theme} mode={mode} />
      </div>
      <div style={{
        marginTop: 22, display: 'flex',
        border: `1px solid ${t.line}`, borderRadius: 10,
        background: theme === 'dark' ? 'rgba(244,236,226,0.015)' : 'rgba(255,253,247,0.35)',
        overflow: 'hidden',
      }}>
        {cards.map(([label, val, suf, italic], i) => (
          <div key={label} style={{ flex: 1, borderRight: i < cards.length - 1 ? `1px solid ${t.line}` : 'none', display: 'flex' }}>
            <YRStatCard label={label} value={val} valueSuffix={suf} italic={italic} t={t} mono />
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------------- 3. TOP GAMES ----------------

function YRTopOneCard({ t, theme, game, rankLabel = '01', subtitle }) {
  return (
    <div style={{
      position: 'relative', overflow: 'hidden',
      borderRadius: 14, border: `1px solid ${t.line2}`,
      height: 360,
    }}>
      {/* art backdrop */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `url(${game.art}) center/cover no-repeat`,
        opacity: theme === 'dark' ? 0.78 : 0.62,
      }} />
      {/* ambient tone */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `linear-gradient(120deg, ${game.tone}99 0%, ${game.tone}33 60%, transparent 100%)`,
        mixBlendMode: theme === 'dark' ? 'soft-light' : 'multiply',
      }} />
      {/* horizontal scrim left → right */}
      <div style={{
        position: 'absolute', inset: 0,
        background: theme === 'dark'
          ? `linear-gradient(90deg, rgba(15,12,10,0.92) 0%, rgba(15,12,10,0.78) 40%, rgba(15,12,10,0.4) 75%, rgba(15,12,10,0.1) 100%)`
          : `linear-gradient(90deg, rgba(244,237,225,0.95) 0%, rgba(244,237,225,0.82) 40%, rgba(244,237,225,0.5) 75%, rgba(244,237,225,0.18) 100%)`,
      }} />
      {/* bottom fade */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, height: 90,
        background: theme === 'dark'
          ? 'linear-gradient(180deg, transparent 0%, rgba(15,12,10,0.55) 100%)'
          : 'linear-gradient(180deg, transparent 0%, rgba(244,237,225,0.55) 100%)',
      }} />

      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', alignItems: 'stretch',
      }}>
        {/* LEFT: rank glyph */}
        <div style={{
          width: 280, flexShrink: 0,
          padding: '28px 0 28px 40px',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        }}>
          <div style={{
            fontFamily: YR_MONO, fontSize: 11, color: t.ink3,
            letterSpacing: '0.16em', textTransform: 'uppercase',
          }}>
            {subtitle || 'Game of your year'}
          </div>
          <div style={{
            fontFamily: YR_SERIF, fontWeight: 400,
            fontSize: 200, lineHeight: 0.82,
            letterSpacing: '-0.06em', color: t.ink,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {rankLabel[0]}<span style={{ fontStyle: 'italic', color: t.ink2 }}>{rankLabel[1]}</span>
          </div>
        </div>
        {/* RIGHT: title + stats */}
        <div style={{
          flex: 1, minWidth: 0,
          padding: '28px 40px 28px 0',
          display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
          alignItems: 'flex-end', textAlign: 'right',
        }}>
          <div style={{ flex: 1 }} />
          <div style={{
            fontFamily: YR_SERIF, fontSize: 56, fontWeight: 400,
            letterSpacing: '-0.025em', lineHeight: 1, color: t.ink,
            marginBottom: 22, maxWidth: 560,
          }}>
            {game.titleParts ? (
              <React.Fragment>
                {game.titleParts[0]}<span style={{ fontStyle: 'italic', color: t.ink2 }}>{game.titleParts[1]}</span>{game.titleParts[2]}
              </React.Fragment>
            ) : game.title}
          </div>
          <div style={{
            display: 'flex', gap: 28, alignItems: 'baseline',
            fontFamily: YR_MONO, fontVariantNumeric: 'tabular-nums',
          }}>
            <div>
              <div style={{ fontSize: 32, color: t.ink, fontFamily: YR_SERIF, letterSpacing: '-0.02em', lineHeight: 1 }}>
                {game.hours.toFixed(1)}<span style={{ fontSize: 16, color: t.ink3, fontStyle: 'italic', marginLeft: 3 }}>h</span>
              </div>
              <div style={{ fontSize: 10, color: t.ink3, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 4 }}>this year</div>
            </div>
            <div style={{ width: 1, height: 36, background: t.line2, alignSelf: 'flex-end' }} />
            <div>
              <div style={{ fontSize: 32, color: t.ink, fontFamily: YR_SERIF, letterSpacing: '-0.02em', lineHeight: 1 }}>
                {game.ach}
              </div>
              <div style={{ fontSize: 10, color: t.ink3, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 4 }}>achievements</div>
            </div>
            <div style={{ width: 1, height: 36, background: t.line2, alignSelf: 'flex-end' }} />
            <div>
              <div style={{ fontFamily: YR_SERIF, fontSize: 22, color: t.ink, fontStyle: 'italic', lineHeight: 1 }}>
                your #1
              </div>
              <div style={{ fontSize: 10, color: t.ink3, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 4, fontFamily: YR_MONO }}>by hours</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function YRTopHalfCard({ t, theme, game, rank }) {
  return (
    <div style={{
      position: 'relative', overflow: 'hidden',
      borderRadius: 12, border: `1px solid ${t.line2}`,
      height: 220,
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: `url(${game.art}) center/cover no-repeat`,
        opacity: theme === 'dark' ? 0.7 : 0.55,
      }} />
      <div style={{
        position: 'absolute', inset: 0,
        background: `linear-gradient(120deg, ${game.tone}aa 0%, ${game.tone}44 100%)`,
        mixBlendMode: theme === 'dark' ? 'soft-light' : 'multiply',
      }} />
      <div style={{
        position: 'absolute', inset: 0,
        background: theme === 'dark'
          ? 'linear-gradient(180deg, rgba(15,12,10,0.25) 0%, rgba(15,12,10,0.82) 100%)'
          : 'linear-gradient(180deg, rgba(244,237,225,0.2) 0%, rgba(244,237,225,0.88) 100%)',
      }} />
      <div style={{
        position: 'relative', height: '100%',
        padding: '20px 24px 22px',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      }}>
        <div style={{
          fontFamily: YR_SERIF, fontWeight: 400,
          fontSize: 84, lineHeight: 0.82,
          letterSpacing: '-0.05em', color: t.ink,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {rank[0]}<span style={{ fontStyle: 'italic', color: t.ink2 }}>{rank[1]}</span>
        </div>
        <div>
          <div style={{
            fontFamily: YR_SERIF, fontSize: 26, fontWeight: 400,
            letterSpacing: '-0.015em', lineHeight: 1.05, color: t.ink, marginBottom: 12,
          }}>
            {game.title}
          </div>
          <div style={{
            display: 'flex', gap: 16, alignItems: 'baseline',
            fontFamily: YR_MONO, fontVariantNumeric: 'tabular-nums',
          }}>
            <span style={{ fontSize: 20, color: t.ink, fontFamily: YR_SERIF, letterSpacing: '-0.01em' }}>
              {game.hours.toFixed(1)}<span style={{ fontSize: 13, color: t.ink3, fontStyle: 'italic', marginLeft: 2 }}>h</span>
            </span>
            <span style={{ color: t.line2 }}>·</span>
            <span style={{ fontSize: 12, color: t.ink2 }}>{game.ach} achievements</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function YRTopRow({ t, game, rank, topHours, last }) {
  const pct = (game.hours / topHours) * 100;
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '70px 1.2fr 1fr 110px',
      gap: 24, alignItems: 'center',
      padding: '18px 0',
      borderTop: `1px solid ${t.line}`,
      borderBottom: last ? `1px solid ${t.line}` : 'none',
    }}>
      <div style={{
        fontFamily: YR_SERIF, fontSize: 38, fontWeight: 400,
        letterSpacing: '-0.04em', lineHeight: 1, color: t.ink2,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {rank[0]}<span style={{ fontStyle: 'italic', color: t.ink3 }}>{rank[1]}</span>
      </div>
      <div style={{
        fontFamily: YR_SERIF, fontSize: 20, fontWeight: 500,
        letterSpacing: '-0.012em', color: t.ink, lineHeight: 1.2,
      }}>
        {game.title}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, height: 4, background: `${t.accent}1a`, borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: t.accent, borderRadius: 2 }} />
        </div>
        <span style={{ fontFamily: YR_MONO, fontSize: 11, color: t.ink3, fontVariantNumeric: 'tabular-nums', minWidth: 32, textAlign: 'right' }}>
          {Math.round(pct)}%
        </span>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontFamily: YR_SERIF, fontSize: 22, color: t.ink, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', lineHeight: 1 }}>
          {game.hours.toFixed(1)}<span style={{ fontSize: 13, color: t.ink3, fontStyle: 'italic', marginLeft: 2 }}>h</span>
        </div>
        <div style={{ fontFamily: YR_MONO, fontSize: 10, color: t.ink3, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 4 }}>
          {game.ach} ach
        </div>
      </div>
    </div>
  );
}

function YRTopGamesSection({ t, theme, mode }) {
  const list = mode === 'populated' ? YR_TOP_GAMES : YR_TOP_GAMES_EARLY;
  const isPop = mode === 'populated';
  const topHours = list[0].hours;

  return (
    <section style={{ marginTop: 112 }}>
      <YRSectionHead
        t={t}
        eyebrow="Chapter two"
        heading="What you"
        italicWord="played"
        lede={isPop
          ? <React.Fragment>Ten games carried your year. The top three account for nearly half of it.</React.Fragment>
          : <React.Fragment>Three games so far. One ran away with it.</React.Fragment>
        }
      />

      {/* #1 hero */}
      <YRTopOneCard t={t} theme={theme} game={list[0]}
        subtitle={isPop ? 'Game of your year' : 'Your most-played, so far'} />

      {isPop && (
        <React.Fragment>
          {/* #2 + #3 */}
          <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <YRTopHalfCard t={t} theme={theme} game={list[1]} rank="02" />
            <YRTopHalfCard t={t} theme={theme} game={list[2]} rank="03" />
          </div>

          {/* #4-#10 list */}
          <div style={{ marginTop: 40 }}>
            <div style={{
              fontFamily: YR_MONO, fontSize: 11, color: t.ink3,
              letterSpacing: '0.16em', textTransform: 'uppercase',
              marginBottom: 4,
            }}>
              The rest of the ten
            </div>
            <div>
              {list.slice(3).map((g, i) => (
                <YRTopRow key={g.title} t={t} game={g} rank={`0${i+4}`.slice(-2)} topHours={topHours} last={i === list.length - 4} />
              ))}
            </div>
            <div style={{
              marginTop: 22, fontFamily: YR_SERIF, fontStyle: 'italic',
              fontSize: 16, color: t.ink3,
            }}>
              These ten games are <span style={{ fontFamily: YR_MONO, fontStyle: 'normal', color: t.ink2, fontSize: 14 }}>76%</span> of your year.
            </div>
          </div>
        </React.Fragment>
      )}

      {!isPop && (
        <React.Fragment>
          <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <YRTopHalfCard t={t} theme={theme} game={list[1]} rank="02" />
            <YRTopHalfCard t={t} theme={theme} game={list[2]} rank="03" />
          </div>
          <div style={{
            marginTop: 32, padding: '20px 24px',
            border: `1px dashed ${t.line2}`, borderRadius: 10,
            background: theme === 'dark' ? 'rgba(244,236,226,0.015)' : 'rgba(31,26,20,0.015)',
            fontFamily: YR_SERIF, fontSize: 17, color: t.ink2, fontStyle: 'italic', lineHeight: 1.55,
          }}>
            You played <span style={{ fontStyle: 'normal', fontFamily: YR_MONO, color: t.ink, fontSize: 15 }}>3</span> games this year. The list will fill in as you play more.
          </div>
        </React.Fragment>
      )}
    </section>
  );
}

// ---------------- 4. ACHIEVEMENTS ----------------

function YRKpiCell({ label, value, valueSuffix, italic, sub, t, lastCol }) {
  return (
    <div style={{
      flex: 1, padding: '24px 24px', minWidth: 0,
      borderRight: lastCol ? 'none' : `1px solid ${t.line}`,
    }}>
      <div style={{ fontFamily: YR_SANS, fontSize: 11, color: t.ink3, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 500, marginBottom: 14 }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginBottom: 8, color: t.ink, lineHeight: 0.95 }}>
        <span style={{ fontFamily: YR_SERIF, fontSize: 56, fontWeight: 400, letterSpacing: '-0.035em', fontVariantNumeric: 'tabular-nums' }}>
          {value}
        </span>
        {valueSuffix && (
          <span style={{ fontFamily: YR_SERIF, fontSize: italic ? 18 : 22, color: t.ink3, fontStyle: italic ? 'italic' : 'normal' }}>
            {valueSuffix}
          </span>
        )}
      </div>
      {sub && (
        <div style={{ fontFamily: YR_MONO, fontSize: 12, color: t.ink3, fontVariantNumeric: 'tabular-nums', lineHeight: 1.4 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function YRRarestCard({ t, theme, mode }) {
  const isPop = mode === 'populated';
  const data = isPop ? {
    title: 'Foe-Smiter',
    desc: 'Defeat Malenia in under three minutes.',
    game: 'Elden Ring',
    rarity: '0.4%',
    date: 'September 3, 2025',
    tone: '#5a4828',
    art: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=920&h=430&fit=crop',
  } : {
    title: 'Joja Co. Member of the Month',
    desc: 'Earn the corporate path achievement.',
    game: 'Stardew Valley',
    rarity: '4.1%',
    date: 'November 22, 2025',
    tone: '#3b5a3b',
    art: 'https://images.unsplash.com/photo-1500964757637-c85e8a162699?w=920&h=430&fit=crop',
  };

  return (
    <div style={{
      position: 'relative', overflow: 'hidden',
      borderRadius: 12, border: `1px solid ${t.line2}`,
      padding: '24px 28px',
      background: theme === 'dark' ? 'rgba(244,236,226,0.02)' : 'rgba(255,253,247,0.45)',
    }}>
      {/* ambient color seep from the right edge */}
      <div style={{
        position: 'absolute', right: -40, top: -40, width: 360, height: 360,
        background: `radial-gradient(circle, ${data.tone}55 0%, transparent 60%)`,
        filter: 'blur(40px)', pointerEvents: 'none',
      }} />
      <div style={{ position: 'relative', display: 'flex', gap: 28, alignItems: 'flex-start' }}>
        {/* big achievement icon — 96 × 96 */}
        <div style={{
          width: 96, height: 96, borderRadius: 12, flexShrink: 0,
          background: `linear-gradient(135deg, ${t.accent}28 0%, ${t.accent}0a 100%)`,
          border: `1px solid ${t.line2}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: t.accent,
          position: 'relative', boxShadow: `0 0 0 4px ${t.accent}12`,
        }}>
          <svg width="52" height="52" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round">
            <path d={YR_ICONS.laurel} />
          </svg>
          <span style={{
            position: 'absolute', top: -8, right: -8,
            padding: '3px 8px', borderRadius: 999,
            background: t.accent, color: t.accentInk,
            fontFamily: YR_MONO, fontSize: 10, fontWeight: 600,
            letterSpacing: '0.06em', textTransform: 'uppercase',
          }}>Rarest</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: YR_MONO, fontSize: 11, color: t.ink3, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 10 }}>
            Rarest unlock of the year
          </div>
          <div style={{
            fontFamily: YR_SERIF, fontSize: 34, fontWeight: 400,
            letterSpacing: '-0.02em', lineHeight: 1.05, color: t.ink, marginBottom: 10,
          }}>
            {data.title}
          </div>
          <div style={{
            fontFamily: YR_SERIF, fontSize: 17, color: t.ink2,
            fontStyle: 'italic', lineHeight: 1.5, marginBottom: 16, maxWidth: 560,
          }}>
            {data.desc}
          </div>
          <div style={{ display: 'flex', gap: 28, alignItems: 'baseline', fontFamily: YR_MONO, fontSize: 12, color: t.ink2, fontVariantNumeric: 'tabular-nums' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ color: t.ink3, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Game</span>
              <span style={{ fontFamily: YR_SERIF, fontStyle: 'italic', fontSize: 15, color: t.ink }}>{data.game}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ color: t.ink3, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Rarity</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, color: t.ink, fontWeight: 500 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.accent, boxShadow: `0 0 0 3px ${t.accent}22` }} />
                {data.rarity} of players
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ color: t.ink3, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Unlocked</span>
              <span style={{ fontSize: 13, color: t.ink }}>{data.date}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function YRBookend({ t, label, title, game, date }) {
  return (
    <div style={{
      padding: '20px 22px',
      border: `1px solid ${t.line}`, borderRadius: 10,
      background: 'transparent',
    }}>
      <div style={{ fontFamily: YR_MONO, fontSize: 10, color: t.ink3, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 12 }}>
        {label}
      </div>
      <div style={{ fontFamily: YR_SERIF, fontSize: 22, fontWeight: 500, letterSpacing: '-0.015em', color: t.ink, lineHeight: 1.15, marginBottom: 8 }}>
        {title}
      </div>
      <div style={{ fontFamily: YR_SANS, fontSize: 13, color: t.ink2, display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontStyle: 'italic', fontFamily: YR_SERIF, color: t.ink3 }}>{game}</span>
        <span style={{ color: t.line2 }}>·</span>
        <span style={{ fontFamily: YR_MONO, fontVariantNumeric: 'tabular-nums', fontSize: 12, color: t.ink2 }}>{date}</span>
      </div>
    </div>
  );
}

function YRAchievementsSection({ t, theme, mode }) {
  const isPop = mode === 'populated';
  return (
    <section style={{ marginTop: 112 }}>
      <YRSectionHead
        t={t}
        eyebrow="Chapter three"
        heading="What you"
        italicWord="accomplished"
        lede={isPop
          ? <React.Fragment>You unlocked <span style={{ fontStyle: 'normal', fontFamily: YR_MONO, color: t.ink, fontSize: 16 }}>412</span> achievements across <span style={{ fontStyle: 'normal', color: t.ink }}>14</span> games. One of them, almost no one has.</React.Fragment>
          : <React.Fragment>A dozen unlocks in three months. Your rarest is rarer than most.</React.Fragment>
        }
      />

      {/* KPI row */}
      <div style={{
        display: 'flex',
        border: `1px solid ${t.line}`, borderRadius: 12,
        background: theme === 'dark' ? 'rgba(244,236,226,0.015)' : 'rgba(255,253,247,0.4)',
        overflow: 'hidden', marginBottom: 28,
      }}>
        {isPop ? (
          <React.Fragment>
            <YRKpiCell t={t} label="Unlocked this year" value="412" valueSuffix="/ 938" italic sub="44% of your library" />
            <YRKpiCell t={t} label="Rarest unlock" value="0.4" valueSuffix="%" sub="Foe-Smiter · Sep 3" />
            <YRKpiCell t={t} label="Most prolific game" value="49" valueSuffix="unlocks" italic sub="Hades · 100% complete" lastCol />
          </React.Fragment>
        ) : (
          <React.Fragment>
            <YRKpiCell t={t} label="Unlocked" value="12" valueSuffix="/ 51" italic sub="24% of your library" />
            <YRKpiCell t={t} label="Rarest unlock" value="4.1" valueSuffix="%" sub="Joja Co. · Nov 22" lastCol />
          </React.Fragment>
        )}
      </div>

      {/* Rarest spotlight */}
      <YRRarestCard t={t} theme={theme} mode={mode} />

      {/* Bookends */}
      <div style={{ marginTop: 22, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        {isPop ? (
          <React.Fragment>
            <YRBookend t={t} label="First unlock of the year" title="Welcome to the Multiverse" game="Hades" date="Jan 4, 2025" />
            <YRBookend t={t} label="Last unlock of the year" title="All's Well That Ends Well" game="Baldur's Gate 3" date="Dec 30, 2025" />
          </React.Fragment>
        ) : (
          <React.Fragment>
            <YRBookend t={t} label="First unlock since joining" title="Welcome to the Multiverse" game="Hades" date="Oct 14, 2025" />
            <YRBookend t={t} label="Last unlock of the year" title="Cornucopia" game="Stardew Valley" date="Dec 28, 2025" />
          </React.Fragment>
        )}
      </div>
    </section>
  );
}

Object.assign(window, {
  YRPlaytimeSection, YRTopGamesSection, YRAchievementsSection,
});
