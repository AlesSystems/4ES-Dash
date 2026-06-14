// CompareDetail — two-user side-by-side. Cool=you, warm=them; consistent throughout.

function CmpUserBlock({ u, color, t, align = 'left' }) {
  return (
    <div style={{ flex: 1, padding: '8px 24px 0', textAlign: align }}>
      <div style={{ display: 'flex', justifyContent: align === 'right' ? 'flex-end' : 'flex-start', marginBottom: 18 }}>
        <div style={{ position: 'relative' }}>
          <FrAvatar persona={u.persona} size={96} t={t} />
          {/* color band underneath signaling the convention */}
          <div style={{
            position: 'absolute', bottom: -6, left: '50%', transform: 'translateX(-50%)',
            width: 64, height: 3, borderRadius: 2, background: color,
          }} />
        </div>
      </div>
      <div style={{
        fontFamily: FR_SERIF, fontSize: 44, color: t.ink, fontWeight: 400,
        letterSpacing: '-0.025em', lineHeight: 1, marginBottom: 6,
      }}>
        {align === 'right' ? <span>{u.name}</span> : <span>{u.name}<span style={{ color: t.ink3, fontStyle: 'italic' }}>,</span></span>}
      </div>
      <div style={{ fontFamily: FR_MONO, fontSize: 11, color: t.ink3, letterSpacing: '0.04em', marginBottom: 20 }}>
        {u.since ? `friends since ${u.since}` : `mutual friend since ${u.mutualSince}`}
      </div>
      <div style={{ display: 'flex', gap: 24, justifyContent: align === 'right' ? 'flex-end' : 'flex-start' }}>
        {[
          ['Level', u.level],
          ['Hours', u.hours.toLocaleString()],
          ['Games', u.games],
        ].map(([k, v]) => (
          <div key={k} style={{ textAlign: align }}>
            <div style={{ fontFamily: FR_SERIF, fontSize: 32, color: t.ink, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', lineHeight: 1, fontWeight: 400 }}>{v}</div>
            <div style={{ fontFamily: FR_SANS, fontSize: 10, color: t.ink3, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 6, fontWeight: 500 }}>{k}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CmpHeader({ t }) {
  const c = window.FR_COMPARE;
  return (
    <div style={{ marginBottom: 28 }}>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 22, fontFamily: FR_SANS, fontSize: 12 }}>
        <span style={{ color: t.ink3 }}>Friends</span>
        <FRIcon d={FR_ICONS.chevronR} size={10} sw={1.6} />
        <span style={{ color: t.ink, fontWeight: 500 }}>Compare with kael</span>
      </div>

      {/* Two-user header */}
      <div style={{
        display: 'flex', alignItems: 'stretch',
        padding: '24px 0 28px',
        borderTop: `1px solid ${t.line}`, borderBottom: `1px solid ${t.line}`,
        position: 'relative',
      }}>
        <CmpUserBlock u={c.you}  color={t.youColor}  t={t} align="left" />
        {/* center vs divider */}
        <div style={{
          width: 88, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          borderLeft: `1px solid ${t.line}`, borderRight: `1px solid ${t.line}`,
          position: 'relative',
        }}>
          <div style={{
            fontFamily: FR_SERIF, fontSize: 22, fontStyle: 'italic', color: t.ink3, fontWeight: 400,
            letterSpacing: '-0.02em', lineHeight: 1,
          }}>vs</div>
          <div style={{
            fontFamily: FR_MONO, fontSize: 9, color: t.ink3, marginTop: 8,
            letterSpacing: '0.1em', textTransform: 'uppercase',
          }}>compare</div>
        </div>
        <CmpUserBlock u={c.them} color={t.themColor} t={t} align="right" />
      </div>

      {/* Editorial summary */}
      <div style={{ marginTop: 18, fontFamily: FR_SERIF, fontSize: 17, color: t.ink2, lineHeight: 1.5 }}>
        You share <span style={{ color: t.ink, fontFamily: FR_MONO, fontStyle: 'normal', fontSize: 15 }}>84</span> games. You've played <span style={{ color: t.ink, fontFamily: FR_MONO, fontStyle: 'normal', fontSize: 15 }}>47.2 h</span> together since <span style={{ color: t.ink, fontFamily: FR_MONO, fontStyle: 'normal', fontSize: 15 }}>2018</span>.
      </div>
    </div>
  );
}

// ---------- KPI row ----------
function CmpKpiCards({ t }) {
  const c = window.FR_COMPARE;
  const cards = [
    {
      headline: c.sharedCount, unit: 'games',
      label: 'In common',
      sub: <span><span style={{ color: t.youColor, fontWeight: 500 }}>{c.yourLibPct}%</span> of your library · <span style={{ color: t.themColor, fontWeight: 500 }}>{c.theirLibPct}%</span> of theirs</span>,
    },
    {
      headline: c.combinedHours.toLocaleString(), unit: 'h',
      label: 'Combined hours',
      sub: <span>across shared games</span>,
    },
    {
      headline: c.togetherHours.toFixed(1), unit: 'h',
      label: 'Played together',
      sub: <span>in co-op sessions</span>,
    },
  ];
  return (
    <div style={{ marginBottom: 36 }}>
      <div style={{ fontFamily: FR_SERIF, fontSize: 22, color: t.ink, fontWeight: 400, letterSpacing: '-0.01em', marginBottom: 14 }}>
        Shared <span style={{ fontStyle: 'italic' }}>games</span>
        <span style={{ fontFamily: FR_MONO, fontSize: 13, color: t.ink3, marginLeft: 12, fontStyle: 'normal' }}>· 84 in common</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {cards.map(k => (
          <div key={k.label} style={{
            border: `1px solid ${t.line}`, borderRadius: 10, background: t.panel,
            padding: '20px 22px',
          }}>
            <div style={{ fontFamily: FR_SANS, fontSize: 11, color: t.ink3, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 500, marginBottom: 12 }}>
              {k.label}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginBottom: 10 }}>
              <span style={{ fontFamily: FR_SERIF, fontSize: 56, lineHeight: '48px', fontWeight: 400, color: t.ink, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.03em' }}>{k.headline}</span>
              <span style={{ fontFamily: FR_SERIF, fontSize: 18, color: t.ink3, fontStyle: 'italic' }}>{k.unit}</span>
            </div>
            <div style={{ fontSize: 12, color: t.ink2, fontFamily: FR_SANS }}>{k.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Head-to-head bars ----------
function CmpH2HRow({ g, scale, t }) {
  const youPct = g.you / scale;
  const themPct = g.them / scale;
  const combined = g.you + g.them;
  const youShare = Math.round((g.you / combined) * 100);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '108px 1fr', gap: 18, padding: '14px 0', borderTop: `1px solid ${t.line}`, alignItems: 'center' }}>
      {/* art */}
      <div style={{
        width: 108, height: 54, borderRadius: 6, overflow: 'hidden', position: 'relative',
        background: g.tone,
      }}>
        <div style={{ position: 'absolute', inset: 0, background: `url(${g.art}) center/cover`, opacity: 0.85 }} />
        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, transparent 30%, ${g.tone}99 100%)` }} />
      </div>
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontFamily: FR_SERIF, fontSize: 17, color: t.ink, fontWeight: 500, letterSpacing: '-0.01em' }}>{g.title}</span>
          <span style={{ fontFamily: FR_MONO, fontSize: 11, color: t.ink3, fontVariantNumeric: 'tabular-nums' }}>combined {combined.toFixed(1)} h · you played {youShare}%</span>
        </div>
        {/* Bar: divergent from center */}
        <div style={{ display: 'flex', alignItems: 'center', height: 22, gap: 0 }}>
          {/* Left half (you) */}
          <div style={{ flex: 1, position: 'relative', height: 14, display: 'flex', justifyContent: 'flex-end' }}>
            <span style={{
              fontFamily: FR_MONO, fontSize: 12, color: t.ink, fontVariantNumeric: 'tabular-nums', fontWeight: 500,
              position: 'absolute', left: 0, top: -1, lineHeight: '14px',
            }}>{g.you.toFixed(1)}<span style={{ color: t.ink3, fontWeight: 400 }}> h</span></span>
            <div style={{
              width: `${youPct * 100}%`, height: 14, borderRadius: '2px 0 0 2px',
              background: t.youColor, opacity: 0.85,
            }} />
          </div>
          {/* center axis */}
          <div style={{ width: 1, height: 22, background: t.line2 }} />
          {/* Right half (them) */}
          <div style={{ flex: 1, position: 'relative', height: 14 }}>
            <div style={{
              width: `${themPct * 100}%`, height: 14, borderRadius: '0 2px 2px 0',
              background: t.themColor, opacity: 0.85,
            }} />
            <span style={{
              fontFamily: FR_MONO, fontSize: 12, color: t.ink, fontVariantNumeric: 'tabular-nums', fontWeight: 500,
              position: 'absolute', right: 0, top: -1, lineHeight: '14px',
            }}>{g.them.toFixed(1)}<span style={{ color: t.ink3, fontWeight: 400 }}> h</span></span>
          </div>
        </div>
      </div>
    </div>
  );
}

function CmpHeadToHead({ t }) {
  const c = window.FR_COMPARE;
  const scale = Math.max(...c.shared.map(g => Math.max(g.you, g.them)));
  return (
    <div style={{ marginBottom: 36 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ fontFamily: FR_SERIF, fontSize: 22, color: t.ink, fontWeight: 400, letterSpacing: '-0.01em' }}>
          Where your <span style={{ fontStyle: 'italic' }}>hours</span> go
          <span style={{ fontFamily: FR_MONO, fontSize: 12, color: t.ink3, marginLeft: 12, fontStyle: 'normal' }}>top 8 by combined playtime</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontFamily: FR_MONO, fontSize: 11, color: t.ink3, letterSpacing: '0.04em' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 14, height: 8, background: t.youColor, opacity: 0.85, borderRadius: 1 }} />
            you
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 14, height: 8, background: t.themColor, opacity: 0.85, borderRadius: 1 }} />
            kael
          </span>
        </div>
      </div>
      <div style={{ marginTop: 4 }}>
        {c.shared.map(g => <CmpH2HRow key={g.title} g={g} scale={scale} t={t} />)}
        {/* footer line */}
        <div style={{ borderTop: `1px solid ${t.line}`, padding: '14px 0 0', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: FR_SANS, fontSize: 13, color: t.ink2, borderBottom: `1px solid ${t.line2}`, paddingBottom: 1 }}>Show all 84 shared games</span>
        </div>
      </div>
    </div>
  );
}

// ---------- Genre overlap ----------
function CmpGenres({ t }) {
  const c = window.FR_COMPARE;
  // Two stacked horizontal bars (you on top, them below).
  // Use the youColor / themColor as the "primary" segment shade and segment via opacity.
  const Bar = ({ data, color, label, total }) => {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontFamily: FR_SANS, fontSize: 11, color: t.ink3, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 500 }}>{label}</span>
          <span style={{ fontFamily: FR_MONO, fontSize: 11, color: t.ink3, fontVariantNumeric: 'tabular-nums' }}>{total}% mapped</span>
        </div>
        <div style={{ display: 'flex', width: '100%', height: 22, borderRadius: 3, overflow: 'hidden', border: `1px solid ${t.line}` }}>
          {data.map((d, i) => (
            <div key={d.name} style={{
              width: `${d.v}%`, height: '100%', background: color,
              opacity: 1 - i * 0.13, position: 'relative',
              borderRight: i < data.length - 1 ? `1px solid ${t.bg}` : 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 0,
            }}>
              {d.v >= 12 && (
                <span style={{
                  fontFamily: FR_SANS, fontSize: 10, color: t.bg, fontWeight: 600,
                  letterSpacing: '0.04em', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden',
                }}>{d.name}</span>
              )}
            </div>
          ))}
        </div>
        {/* tick labels under */}
        <div style={{ display: 'flex', marginTop: 6, fontFamily: FR_MONO, fontSize: 10, color: t.ink3, fontVariantNumeric: 'tabular-nums' }}>
          {data.map((d, i) => (
            <div key={d.name} style={{ width: `${d.v}%`, textAlign: 'left', paddingLeft: 2 }}>{d.v}%</div>
          ))}
        </div>
      </div>
    );
  };

  const youData = c.genres.map(g => ({ name: g.name, v: g.you }));
  const themData = c.genres.map(g => ({ name: g.name, v: g.them }));
  const youTotal = youData.reduce((s, d) => s + d.v, 0);
  const themTotal = themData.reduce((s, d) => s + d.v, 0);

  return (
    <div style={{ marginBottom: 36 }}>
      <div style={{ fontFamily: FR_SERIF, fontSize: 22, color: t.ink, fontWeight: 400, letterSpacing: '-0.01em', marginBottom: 14 }}>
        What you both <span style={{ fontStyle: 'italic' }}>lean into</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22, padding: '22px 24px', border: `1px solid ${t.line}`, borderRadius: 10, background: t.panel }}>
        <Bar data={youData}  color={t.youColor}  label="Altan · share of hours by genre" total={youTotal} />
        <Bar data={themData} color={t.themColor} label="kael · share of hours by genre"  total={themTotal} />
        <div style={{ fontFamily: FR_SERIF, fontSize: 16, color: t.ink2, lineHeight: 1.5, paddingTop: 6, borderTop: `1px solid ${t.line}` }}>
          <span style={{ fontStyle: 'italic' }}>RPG</span> is the strongest overlap — <span style={{ color: t.youColor, fontFamily: FR_MONO, fontStyle: 'normal', fontSize: 14, fontWeight: 500 }}>38%</span> of your hours, <span style={{ color: t.themColor, fontFamily: FR_MONO, fontStyle: 'normal', fontSize: 14, fontWeight: 500 }}>31%</span> of theirs.
        </div>
      </div>
    </div>
  );
}

// ---------- Library asymmetry ----------
function CmpMiniTile({ g, t }) {
  return (
    <div style={{
      borderRadius: 8, border: `1px solid ${t.line}`, background: t.panel,
      overflow: 'hidden',
    }}>
      <div style={{ position: 'relative', aspectRatio: '2 / 1', background: g.tone, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: `url(${g.art}) center/cover`, opacity: 0.85 }} />
        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, transparent 50%, ${g.tone}cc 100%)` }} />
      </div>
      <div style={{ padding: '10px 12px' }}>
        <div style={{ fontFamily: FR_SERIF, fontSize: 14, color: t.ink, fontWeight: 500, letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.title}</div>
      </div>
    </div>
  );
}

function CmpAsymmetric({ t }) {
  const c = window.FR_COMPARE;
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 14 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: t.themColor, alignSelf: 'center' }} />
            <div style={{ fontFamily: FR_SERIF, fontSize: 19, color: t.ink, fontWeight: 400, letterSpacing: '-0.01em' }}>
              In <span style={{ fontStyle: 'italic' }}>their</span> library, not yours
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {c.inTheirsNotYours.map(g => <CmpMiniTile key={g.title} g={g} t={t} />)}
          </div>
          <div style={{ fontFamily: FR_MONO, fontSize: 11, color: t.ink3, marginTop: 12, fontVariantNumeric: 'tabular-nums' }}>+ {c.moreInTheirs} more</div>
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 14 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: t.youColor, alignSelf: 'center' }} />
            <div style={{ fontFamily: FR_SERIF, fontSize: 19, color: t.ink, fontWeight: 400, letterSpacing: '-0.01em' }}>
              In <span style={{ fontStyle: 'italic' }}>your</span> library, not theirs
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {c.inYoursNotTheirs.map(g => <CmpMiniTile key={g.title} g={g} t={t} />)}
          </div>
          <div style={{ fontFamily: FR_MONO, fontSize: 11, color: t.ink3, marginTop: 12, fontVariantNumeric: 'tabular-nums' }}>+ {c.moreInYours} more</div>
        </div>
      </div>
    </div>
  );
}

// ---------- Closing band ----------
function CmpClosing({ t }) {
  return (
    <div style={{
      borderTop: `1px solid ${t.line}`, padding: '22px 0 24px',
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <span style={{
        padding: '9px 14px', border: `1px solid ${t.line2}`, borderRadius: 8,
        fontFamily: FR_SANS, fontSize: 13, color: t.ink, fontWeight: 500,
        display: 'inline-flex', alignItems: 'center', gap: 6, background: t.panel,
      }}>
        Switch compare target <FRIcon d={FR_ICONS.arrowUpRight} size={12} sw={1.6} />
      </span>
      <span style={{
        padding: '9px 14px', borderRadius: 8,
        fontFamily: FR_SANS, fontSize: 13, color: t.ink2, fontWeight: 500,
        display: 'inline-flex', alignItems: 'center', gap: 6,
        border: `1px solid transparent`,
      }}>
        Export comparison
      </span>
      <div style={{ flex: 1 }} />
      <span style={{ fontFamily: FR_MONO, fontSize: 11, color: t.ink3, letterSpacing: '0.04em' }}>
        comparing <span style={{ color: t.youColor }}>you</span> · <span style={{ color: t.themColor }}>kael</span>
      </span>
    </div>
  );
}

// ---------- Compare detail frame ----------
function CompareDetail({ theme = 'dark' }) {
  const t = FRTokens(theme);
  return (
    <div data-screen-label={`Compare detail · ${theme}`} style={{
      width: 1440, minHeight: 1820, background: t.bgGrad, color: t.ink,
      fontFamily: FR_SANS, fontSize: 14, position: 'relative',
    }}>
      <FRAppBar t={t} />
      <div style={{ display: 'flex' }}>
        <FRSidebar t={t} minHeight={1764} />
        <main style={{ flex: 1, padding: '28px 32px 0', minWidth: 0, position: 'relative' }}>
          <CmpHeader t={t} />
          <CmpKpiCards t={t} />
          <CmpHeadToHead t={t} />
          <CmpGenres t={t} />
          <CmpAsymmetric t={t} />
          <CmpClosing t={t} />

          {/* h2h caller — explains the two-color rule */}
          <div style={{ position: 'absolute', top: 1010, right: -4, pointerEvents: 'none', width: 220 }}>
            <svg width="220" height="60" style={{ overflow: 'visible' }}>
              <path d="M 14 50 C 50 50, 110 12, 210 8" stroke={t.ink3} strokeWidth="0.75" fill="none" />
              <circle cx="14" cy="50" r="2.5" fill={t.ink3} />
            </svg>
            <div style={{ position: 'absolute', left: 30, top: 56, fontFamily: FR_MONO, fontSize: 10, color: t.ink3, letterSpacing: '0.06em', textTransform: 'uppercase', width: 200, lineHeight: 1.5 }}>
              divergent · neutral hues
              <div style={{ color: t.ink3, textTransform: 'none', letterSpacing: 0, fontStyle: 'italic', fontFamily: FR_SERIF, fontSize: 11, marginTop: 2 }}>
                neither side coded as "winning"
              </div>
            </div>
          </div>
        </main>
      </div>

      <FRSpecStrip t={t} extra="Compare · you = cool, them = warm · convention is consistent across every chart" />
    </div>
  );
}

Object.assign(window, { CompareDetail });
