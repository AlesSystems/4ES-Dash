// Year in Review — the page Wrapped was named for.
// Extends the established system (palette, type, chart treatment, KPI face,
// art-derived ambient color). Long-scroll editorial chapter, not a dashboard.
// Two states: populated (full year) + early-data (joined Oct 2025).

const YR_SERIF = `"Source Serif 4", "Source Serif Pro", "Tiempos Text", Georgia, serif`;
const YR_SANS  = `"Söhne", "Inter Tight", -apple-system, system-ui, sans-serif`;
const YR_MONO  = `"JetBrains Mono", ui-monospace, monospace`;

function YRTokens(theme) { return window.WR_TOKENS_LIB[theme]; }

const YR_ICONS = {
  dashboard: 'M2 8l6-5 6 5v6H2zM6 14v-4h4v4',
  library: 'M3 2h3v12H3zM7 2h3v12H7zM11 4l2.5-.5L14 13l-2.5.5z',
  games: 'M2 8a3 3 0 0 1 3-3h6a3 3 0 0 1 0 6H5a3 3 0 0 1-3-3zM4 8h3M5.5 6.5v3M10 7.5h.01M12 9.5h.01',
  friends: 'M5 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM11 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM2 13c0-2 1.5-3 3-3s3 1 3 3M8 13c0-2 1.5-3 3-3s3 1 3 3',
  achievements: 'M5 2h6v3a3 3 0 1 1-6 0zM3 3v1a2 2 0 0 0 2 2M13 3v1a2 2 0 0 1-2 2M8 8v3M5.5 13h5',
  bell: 'M4 7a4 4 0 0 1 8 0v3l1 2H3l1-2zM6.5 13a1.5 1.5 0 0 0 3 0',
  sun: 'M8 4.5V3M8 13v-1.5M3.5 8H2M14 8h-1.5M5 5L4 4M12 12l-1-1M5 11l-1 1M12 4l-1 1M8 6a2 2 0 1 1 0 4 2 2 0 0 1 0-4z',
  search: 'M7 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM14 14l-3.5-3.5',
  chevronDown: 'M4 6l4 4 4-4',
  chevronR: 'M6 4l4 4-4 4',
  external: 'M9 3h4v4M13 3L7 9M11 8v4H3V4h4',
  download: 'M8 2v8M4 7l4 3 4-3M3 13h10',
  laurel: 'M8 14c-3-1-5-4-5-7M8 14c3-1 5-4 5-7M5 8c0-2 1-3 3-3s3 1 3 3M8 5V3M4 11h1M11 11h1',
};

function YRIcon({ d, size = 16, sw = 1.5 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

// ---------------- chrome ----------------

function YRAppBar({ t }) {
  const s = window.STEAM;
  return (
    <div style={{
      height: 56, borderBottom: `1px solid ${t.line}`,
      display: 'flex', alignItems: 'center', padding: '0 28px', gap: 28,
      background: t.bg, position: 'sticky', top: 0, zIndex: 5,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 24, height: 24, borderRadius: 12, background: t.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.bg }} />
        </div>
        <span style={{ fontFamily: YR_SERIF, fontSize: 18, color: t.ink, fontWeight: 500, fontStyle: 'italic', letterSpacing: '-0.01em' }}>4es</span>
        <span style={{ fontFamily: YR_SANS, fontSize: 13, color: t.ink2, fontWeight: 500, letterSpacing: '0.04em' }}>dash</span>
      </div>
      <nav style={{ display: 'flex', gap: 4, fontFamily: YR_SANS, fontSize: 14 }}>
        {[['Dashboard', true], ['Library'], ['Games'], ['Friends']].map(([n, active]) => (
          <span key={n} style={{ padding: '6px 12px', color: active ? t.ink : t.ink2, fontWeight: active ? 500 : 400, position: 'relative' }}>
            {n}
            {active && <span style={{ position: 'absolute', left: 12, right: 12, bottom: -17, height: 2, background: t.accent }} />}
          </span>
        ))}
      </nav>
      <div style={{ flex: 1 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, color: t.ink2 }}>
        <YRIcon d={YR_ICONS.bell} size={16} />
        <YRIcon d={YR_ICONS.sun} size={16} />
        <div style={{ width: 30, height: 30, borderRadius: '50%', background: `url(${s.user.avatar}) center/cover`, border: `1px solid ${t.line2}` }} />
      </div>
    </div>
  );
}

function YRSidebar({ t, minH }) {
  return (
    <aside style={{ width: 240, borderRight: `1px solid ${t.line}`, padding: '28px 18px', minHeight: minH, flexShrink: 0 }}>
      <div style={{ fontSize: 11, color: t.ink3, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: YR_SANS, padding: '0 10px 12px', fontWeight: 500 }}>Browse</div>
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
            <YRIcon d={YR_ICONS[icon]} size={16} />
            <span style={{ flex: 1, fontWeight: active ? 500 : 400 }}>{label}</span>
            {count && <span style={{ fontSize: 12, color: t.ink3, fontFamily: YR_MONO }}>{count}</span>}
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: t.ink3, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: YR_SANS, padding: '28px 10px 12px', fontWeight: 500 }}>Year in Review</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {[['2025', true], ['2024'], ['2023'], ['2022'], ['2021']].map(([y, active]) => (
          <div key={y} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '7px 10px', borderRadius: 6,
            color: active ? t.ink : t.ink2, background: active ? t.panel : 'transparent',
            fontSize: 13, position: 'relative',
          }}>
            {active && <span style={{ position: 'absolute', left: -18, top: 7, bottom: 7, width: 3, background: t.accent, borderRadius: 2 }} />}
            <span style={{ width: 8, height: 8, borderRadius: 2, background: active ? t.accent : t.accent2, opacity: active ? 1 : 0.7 }} />
            <span style={{ flex: 1, fontFamily: YR_MONO, fontWeight: active ? 500 : 400 }}>{y}</span>
            {active && <span style={{ fontSize: 10, color: t.accent, fontFamily: YR_MONO, textTransform: 'uppercase', letterSpacing: '0.08em' }}>NEW</span>}
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: t.ink3, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: YR_SANS, padding: '28px 10px 12px', fontWeight: 500 }}>Collections</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {[['To finish', 12], ['Co-op queue', 6], ['Cozy', 9], ['Roguelikes', 14]].map(([l, n]) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '7px 10px', color: t.ink2, fontSize: 13 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: t.accent2, opacity: 0.7 }} />
            <span style={{ flex: 1 }}>{l}</span>
            <span style={{ fontSize: 11, color: t.ink3, fontFamily: YR_MONO }}>{n}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}

// ---------------- shared bits ----------------

function YRSectionHead({ t, eyebrow, heading, italicWord, lede, side }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 24 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {eyebrow && (
            <div style={{ fontFamily: YR_MONO, fontSize: 11, color: t.ink3, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 14 }}>
              {eyebrow}
            </div>
          )}
          <div style={{
            fontFamily: YR_SERIF, fontSize: 42, color: t.ink, fontWeight: 400,
            letterSpacing: '-0.02em', lineHeight: 1.05,
          }}>
            {heading}
            {italicWord && (
              <React.Fragment> <span style={{ fontStyle: 'italic', color: t.ink2 }}>{italicWord}</span></React.Fragment>
            )}
          </div>
          {lede && (
            <div style={{
              marginTop: 16, fontFamily: YR_SERIF, fontSize: 18, color: t.ink2,
              fontStyle: 'italic', lineHeight: 1.5, maxWidth: 720,
            }}>
              {lede}
            </div>
          )}
        </div>
        {side}
      </div>
    </div>
  );
}

function YRSpecStrip({ t, extras, contentWidth, heroPx, totalPx }) {
  return (
    <div style={{
      borderTop: `1px solid ${t.line}`,
      padding: '12px 32px',
      display: 'flex', gap: 22, flexWrap: 'wrap',
      fontFamily: YR_MONO, fontSize: 10, color: t.ink3,
      letterSpacing: '0.06em', textTransform: 'uppercase',
      background: t.bg,
    }}>
      <span>body · söhne 14/1.5</span>
      <span>display · source serif 4</span>
      <span>mono · jb mono 12</span>
      <span>accent · <span style={{ color: t.accent }}>{t.accent}</span></span>
      <span>paper · {t.bg}</span>
      <span>cover hero · {heroPx} / 0.86</span>
      <span>content col · {contentWidth} px</span>
      <span>page · ~{totalPx} px tall</span>
      {extras && <span style={{ marginLeft: 'auto', color: t.ink2 }}>{extras}</span>}
    </div>
  );
}

// ---------------- 1. COVER ----------------

function YRCover({ t, theme, mode, ambientArts }) {
  const isPop = mode === 'populated';
  // The year glyph itself. Massive. The italic last digit is the editorial flourish.
  const yearGlyph = (
    <div style={{
      fontFamily: YR_SERIF, fontWeight: 400,
      fontSize: 460, lineHeight: 0.86, letterSpacing: '-0.05em',
      color: t.ink, fontVariantNumeric: 'tabular-nums',
      display: 'flex', alignItems: 'baseline', justifyContent: 'center',
    }}>
      <span>202</span><span style={{ fontStyle: 'italic', color: t.ink2 }}>5</span>
    </div>
  );

  return (
    <section style={{
      position: 'relative', overflow: 'hidden', isolation: 'isolate',
      borderBottom: `1px solid ${t.line}`,
      minHeight: 760,
    }}>
      {/* Ambient backdrop — low-opacity blurred header arts of the top games */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {ambientArts.map((a, i) => (
          <div key={i} style={{
            position: 'absolute',
            top: a.top, left: a.left, width: a.w, height: a.h,
            background: `url(${a.art}) center/cover no-repeat`,
            filter: 'blur(40px) saturate(1.15)',
            transform: `rotate(${a.rot}deg)`,
            opacity: theme === 'dark' ? 0.32 : 0.22,
            mixBlendMode: theme === 'dark' ? 'screen' : 'multiply',
          }} />
        ))}
      </div>
      {/* Scrim — defends type contrast at AA */}
      <div style={{
        position: 'absolute', inset: 0,
        background: theme === 'dark'
          ? `radial-gradient(ellipse at 50% 40%, rgba(20,18,17,0.55) 0%, rgba(20,18,17,0.88) 70%, ${t.bg} 100%)`
          : `radial-gradient(ellipse at 50% 40%, rgba(244,237,225,0.65) 0%, rgba(244,237,225,0.92) 70%, ${t.bg} 100%)`,
      }} />
      {/* Vertical fade to body */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, height: 120,
        background: `linear-gradient(180deg, transparent 0%, ${t.bg} 100%)`,
      }} />

      {/* Content */}
      <div style={{
        position: 'relative', zIndex: 1,
        padding: '56px 40px 64px',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        textAlign: 'center',
      }}>
        <div style={{
          fontFamily: YR_MONO, fontSize: 11, color: t.ink3,
          letterSpacing: '0.32em', textTransform: 'uppercase', marginBottom: 16,
          display: 'inline-flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ width: 24, height: 1, background: t.line2 }} />
          Year in Review
          <span style={{ width: 24, height: 1, background: t.line2 }} />
        </div>

        {yearGlyph}

        <div style={{
          marginTop: 22, fontFamily: YR_MONO, fontSize: 13, color: t.ink2,
          fontVariantNumeric: 'tabular-nums', letterSpacing: '0.04em',
          display: 'inline-flex', alignItems: 'center', gap: 14,
        }}>
          <span style={{ color: t.ink, fontFamily: YR_SERIF, fontStyle: 'italic', fontSize: 16, letterSpacing: 0 }}>Altan</span>
          <span style={{ color: t.line2 }}>·</span>
          {isPop ? (
            <React.Fragment>
              <span>312 games</span>
              <span style={{ color: t.line2 }}>·</span>
              <span>4,128 achievements</span>
              <span style={{ color: t.line2 }}>·</span>
              <span>joined 2014</span>
            </React.Fragment>
          ) : (
            <React.Fragment>
              <span>joined October 12, 2025</span>
              <span style={{ color: t.line2 }}>·</span>
              <span>first three months</span>
            </React.Fragment>
          )}
        </div>

        <div style={{
          marginTop: 38,
          fontFamily: YR_SERIF, fontWeight: 400,
          fontSize: 44, lineHeight: 1.08, letterSpacing: '-0.018em',
          color: t.ink, maxWidth: 880,
        }}>
          You played{' '}
          <span style={{ fontVariantNumeric: 'tabular-nums', color: t.ink, fontWeight: 400 }}>
            {isPop ? '612.8' : '38.4'}
          </span>{' '}
          <span style={{ fontStyle: 'italic', color: t.ink2 }}>hours</span>.
        </div>

        <div style={{
          marginTop: 18,
          fontFamily: YR_SANS, fontSize: 14, color: t.ink3,
          maxWidth: 640, lineHeight: 1.55,
        }}>
          {isPop ? (
            <React.Fragment>
              That's <span style={{ fontFamily: YR_MONO, color: t.ink2, fontVariantNumeric: 'tabular-nums' }}>47.2</span> more hours than 2024.
            </React.Fragment>
          ) : (
            <React.Fragment>
              This is your first year — there's nothing to compare against yet.
            </React.Fragment>
          )}
        </div>

        {/* scroll affordance */}
        <div style={{
          position: 'absolute', bottom: 38, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
          fontFamily: YR_MONO, fontSize: 10, color: t.ink3,
          letterSpacing: '0.18em', textTransform: 'uppercase',
        }}>
          Scroll to read your year
          <svg width="10" height="14" viewBox="0 0 10 14" fill="none">
            <path d="M5 1v12M1 9l4 4 4-4" stroke={t.ink3} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    </section>
  );
}

Object.assign(window, { YRCover });
