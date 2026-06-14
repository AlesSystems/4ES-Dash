// Year in Review — sections 5–7, fixtures, and top-level frames.

// ---------------- 5. GENRE SHARE ----------------

const YR_GENRES = [
  { name: 'RPG',         pct: 38, hours: 232.9, color: null }, // primary accent
  { name: 'Strategy',    pct: 22, hours: 134.8, color: null }, // secondary accent
  { name: 'Action',      pct: 18, hours: 110.3, color: null },
  { name: 'Simulation',  pct: 14, hours: 85.8,  color: null },
  { name: 'Co-op',       pct: 8,  hours: 49.0,  color: null },
];

function YRGenreSection({ t, theme, mode }) {
  if (mode === 'early') {
    return (
      <section style={{ marginTop: 112 }}>
        <YRSectionHead
          t={t}
          eyebrow="Chapter four"
          heading="The shape of your"
          italicWord="year"
          lede={<React.Fragment>You barely had time to pick a side. One game ate the calendar.</React.Fragment>}
        />
        <div style={{
          padding: '40px 36px',
          border: `1px solid ${t.line}`, borderRadius: 14,
          background: theme === 'dark' ? 'rgba(244,236,226,0.02)' : 'rgba(255,253,247,0.45)',
        }}>
          <div style={{
            fontFamily: YR_SERIF, fontSize: 56, fontWeight: 400,
            letterSpacing: '-0.025em', lineHeight: 1.02, color: t.ink, marginBottom: 18,
          }}>
            Mostly <span style={{ fontStyle: 'italic', color: t.ink2 }}>Stardew Valley</span>.
          </div>
          <div style={{
            fontFamily: YR_SERIF, fontSize: 19, color: t.ink2, lineHeight: 1.55, maxWidth: 680,
          }}>
            <span style={{ fontFamily: YR_MONO, color: t.ink, fontSize: 17, fontStyle: 'normal' }}>74%</span> of your hours this year were one game. The genre mix will balance out as you play more.
          </div>
        </div>
      </section>
    );
  }

  // Populated — horizontal stacked bar with labeled segments.
  // Use a deliberately restrained palette: accent for #1, a stepped accent for #2,
  // then warm neutrals stepping toward background.
  const palette = theme === 'dark'
    ? [t.accent, '#d4805d', '#8e7866', '#5e544a', '#3a322c']
    : [t.accent, '#c97755', '#967b5e', '#736654', '#bcae93'];
  const segments = YR_GENRES.map((g, i) => ({ ...g, color: palette[i] }));

  return (
    <section style={{ marginTop: 112 }}>
      <YRSectionHead
        t={t}
        eyebrow="Chapter four"
        heading="The shape of your"
        italicWord="year"
        lede={<React.Fragment>You leaned hard into RPGs and strategy. Action faded after spring; co-op stayed a small, loud corner.</React.Fragment>}
      />
      {/* The bar itself, with each segment labeled inline */}
      <div style={{
        padding: '32px 32px 36px',
        border: `1px solid ${t.line}`, borderRadius: 14,
        background: theme === 'dark' ? 'rgba(244,236,226,0.02)' : 'rgba(255,253,247,0.45)',
      }}>
        {/* labels above */}
        <div style={{ display: 'flex', width: '100%', marginBottom: 14, alignItems: 'flex-end' }}>
          {segments.map((s, i) => (
            <div key={s.name} style={{
              width: `${s.pct}%`, paddingRight: 14, position: 'relative',
              borderLeft: i === 0 ? `1px solid ${t.line2}` : 'none',
              paddingLeft: i === 0 ? 0 : 14,
              minWidth: 0,
            }}>
              <div style={{
                fontFamily: YR_MONO, fontSize: 10, color: t.ink3,
                letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6, fontWeight: 500,
              }}>
                {s.name}
              </div>
              <div style={{
                fontFamily: YR_SERIF, fontSize: i === 0 ? 36 : 26, color: t.ink,
                fontWeight: 400, letterSpacing: '-0.02em', lineHeight: 0.95,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {s.pct}<span style={{ fontSize: i === 0 ? 18 : 14, color: t.ink3, fontStyle: 'italic' }}>%</span>
              </div>
            </div>
          ))}
        </div>
        {/* the bar */}
        <div style={{ display: 'flex', width: '100%', height: 64, borderRadius: 6, overflow: 'hidden' }}>
          {segments.map((s, i) => (
            <div key={s.name} style={{
              width: `${s.pct}%`, background: s.color,
              borderRight: i < segments.length - 1 ? `1px solid ${t.bg}` : 'none',
              position: 'relative',
            }} />
          ))}
        </div>
        {/* hours line */}
        <div style={{ display: 'flex', width: '100%', marginTop: 14 }}>
          {segments.map((s, i) => (
            <div key={s.name} style={{
              width: `${s.pct}%`, paddingLeft: i === 0 ? 0 : 14, paddingRight: 14,
              fontFamily: YR_MONO, fontSize: 11, color: t.ink3,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {s.hours.toFixed(1)} h
            </div>
          ))}
        </div>
      </div>

      {/* Sorted list beneath */}
      <div style={{ marginTop: 22, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
        {segments.map((s, i) => (
          <div key={s.name} style={{
            padding: '14px 16px',
            borderTop: `2px solid ${s.color}`,
            background: theme === 'dark' ? 'rgba(244,236,226,0.015)' : 'rgba(255,253,247,0.4)',
            borderRadius: '0 0 8px 8px',
          }}>
            <div style={{ fontFamily: YR_SANS, fontSize: 13, color: t.ink, fontWeight: 500, marginBottom: 6 }}>
              {s.name}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontFamily: YR_MONO, fontVariantNumeric: 'tabular-nums' }}>
              <span style={{ fontSize: 16, color: t.ink, letterSpacing: '-0.01em', fontWeight: 500 }}>{s.pct}%</span>
              <span style={{ color: t.line2 }}>·</span>
              <span style={{ fontSize: 12, color: t.ink3 }}>{s.hours.toFixed(1)} h</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------------- 6. NEW ON THE SHELF ----------------

function YRShelfTile({ t, theme, g }) {
  const isUntouched = g.status === 'untouched';
  const isFinished = g.status === 'finished';
  return (
    <div style={{
      position: 'relative', overflow: 'hidden',
      borderRadius: 10, border: `1px solid ${t.line}`,
      background: theme === 'dark' ? 'rgba(28,24,22,0.6)' : 'rgba(253,248,237,0.85)',
    }}>
      <div style={{
        position: 'relative', aspectRatio: '2 / 1',
        background: g.tone, overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: `url(${g.art}) center/cover`,
          opacity: isUntouched ? 0.45 : 0.84,
          filter: isUntouched ? 'grayscale(0.4)' : 'none',
        }} />
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, height: 16,
          background: `linear-gradient(180deg, transparent 0%, ${g.tone}aa 70%, ${g.tone} 100%)`,
        }} />
        {/* status pill */}
        <span style={{
          position: 'absolute', top: 8, left: 8,
          padding: '3px 8px',
          background: isFinished
            ? t.pillSuccessBg
            : (isUntouched ? 'rgba(0,0,0,0.42)' : 'rgba(0,0,0,0.38)'),
          color: isFinished ? t.pillSuccessInk : '#f1ebde',
          border: isFinished ? `1px solid ${t.pillSuccessInk}33` : `1px solid rgba(255,255,255,0.18)`,
          backdropFilter: 'blur(6px)',
          borderRadius: 999,
          fontFamily: YR_MONO, fontSize: 10, fontWeight: 500,
          letterSpacing: '0.06em', textTransform: 'uppercase',
        }}>
          {g.statusLabel}
        </span>
      </div>
      <div style={{ padding: '12px 14px 14px' }}>
        <div style={{
          fontFamily: YR_SERIF, fontSize: 15, fontWeight: 500,
          letterSpacing: '-0.01em', color: t.ink, lineHeight: 1.2,
          marginBottom: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {g.title}
        </div>
        <div style={{ fontFamily: YR_MONO, fontSize: 11, color: t.ink3, fontVariantNumeric: 'tabular-nums', display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span>added {g.added}</span>
        </div>
      </div>
    </div>
  );
}

function YRShelfSection({ t, theme, mode }) {
  const isPop = mode === 'populated';
  const tiles = isPop ? YR_SHELF_POP : YR_SHELF_EARLY;

  return (
    <section style={{ marginTop: 112 }}>
      <YRSectionHead
        t={t}
        eyebrow="Chapter five"
        heading="What you"
        italicWord="bought"
        lede={isPop
          ? <React.Fragment>You added <span style={{ fontStyle: 'normal', fontFamily: YR_MONO, color: t.ink, fontSize: 16 }}>27</span> games this year. About half got opened. Fewer got finished.</React.Fragment>
          : <React.Fragment>You added four games since joining. Three of them have hours on the clock.</React.Fragment>
        }
      />

      {/* KPI row */}
      <div style={{
        display: 'flex',
        border: `1px solid ${t.line}`, borderRadius: 12,
        background: theme === 'dark' ? 'rgba(244,236,226,0.015)' : 'rgba(255,253,247,0.4)',
        overflow: 'hidden', marginBottom: 30,
      }}>
        {isPop ? (
          <React.Fragment>
            <YRKpiCell t={t} label="New games" value="27" valueSuffix="added" italic sub="$312.40 spent · 1.96 h/$" />
            <YRKpiCell t={t} label="Actually played" value="14" valueSuffix="of 27" italic sub="52% of new purchases" />
            <YRKpiCell t={t} label="Finished" value="4" valueSuffix="games" italic sub="FF7R · Tactical Breach · Animal Well · Cocoon" lastCol />
          </React.Fragment>
        ) : (
          <React.Fragment>
            <YRKpiCell t={t} label="New games" value="4" valueSuffix="added" italic sub="$48.00 spent · 0.80 h/$" />
            <YRKpiCell t={t} label="Actually played" value="3" valueSuffix="of 4" italic sub="75% of your library" />
            <YRKpiCell t={t} label="Finished" value="0" valueSuffix="games" italic sub="three months is not many" lastCol />
          </React.Fragment>
        )}
      </div>

      {/* Tile grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16,
      }}>
        {tiles.map(g => <YRShelfTile key={g.title} t={t} theme={theme} g={g} />)}
      </div>

      <div style={{
        marginTop: 28, padding: '18px 22px',
        borderTop: `1px solid ${t.line}`,
        fontFamily: YR_SERIF, fontStyle: 'italic', fontSize: 18, color: t.ink2, lineHeight: 1.5,
      }}>
        {isPop
          ? <React.Fragment><span style={{ fontFamily: YR_MONO, fontStyle: 'normal', color: t.ink, fontSize: 16 }}>13</span> of the 27 are now part of your backlog. <span style={{ color: t.ink3 }}>The shelf grew from 165 to 178 this year.</span></React.Fragment>
          : <React.Fragment>Your backlog has <span style={{ fontFamily: YR_MONO, fontStyle: 'normal', color: t.ink, fontSize: 16 }}>1</span> game in it. <span style={{ color: t.ink3 }}>Welcome to the rest of the platform.</span></React.Fragment>
        }
      </div>
    </section>
  );
}

// ---------------- 7. OUTRO ----------------

function YROutro({ t, theme, mode }) {
  const isPop = mode === 'populated';
  return (
    <section style={{ marginTop: 112, paddingBottom: 56 }}>
      <YRSectionHead
        t={t}
        heading="That was your"
        italicWord="year."
      />

      <div style={{
        marginTop: 16, padding: '52px 40px 48px',
        border: `1px solid ${t.line}`, borderRadius: 14,
        background: theme === 'dark'
          ? 'linear-gradient(180deg, rgba(244,236,226,0.025) 0%, rgba(244,236,226,0.01) 100%)'
          : 'linear-gradient(180deg, rgba(255,253,247,0.7) 0%, rgba(249,241,225,0.5) 100%)',
        textAlign: 'center', position: 'relative', overflow: 'hidden',
      }}>
        {/* decorative hairlines */}
        <div style={{ position: 'absolute', left: 40, right: 40, top: 26, height: 1, background: t.line, opacity: 0.6 }} />
        <div style={{ position: 'absolute', left: 40, right: 40, bottom: 26, height: 1, background: t.line, opacity: 0.6 }} />

        <div style={{
          fontFamily: YR_MONO, fontSize: 11, color: t.ink3,
          letterSpacing: '0.32em', textTransform: 'uppercase', marginBottom: 28,
        }}>
          fin
        </div>
        <div style={{
          fontFamily: YR_SERIF, fontWeight: 400,
          fontSize: 60, lineHeight: 1.05, letterSpacing: '-0.025em', color: t.ink,
        }}>
          {isPop ? (
            <React.Fragment>See you in <span style={{ fontStyle: 'italic', color: t.ink2 }}>2026</span>.</React.Fragment>
          ) : (
            <React.Fragment><span style={{ fontStyle: 'italic', color: t.ink2 }}>Welcome.</span> See you next year.</React.Fragment>
          )}
        </div>

        <div style={{ marginTop: 36, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            padding: '10px 18px', borderRadius: 8,
            border: `1px solid ${t.line2}`,
            color: t.ink, background: 'transparent',
            fontFamily: YR_SANS, fontSize: 13, fontWeight: 500,
            display: 'inline-flex', alignItems: 'center', gap: 8,
          }}>
            <YRIcon d={YR_ICONS.download} size={12} sw={1.6} />
            Export as PDF
          </span>
          {isPop && (
            <span style={{
              padding: '10px 18px',
              color: t.ink2, fontFamily: YR_SANS, fontSize: 13, fontWeight: 500,
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              View 2024 recap
              <YRIcon d={YR_ICONS.external} size={11} sw={1.6} />
            </span>
          )}
        </div>
      </div>

      <div style={{
        marginTop: 24, textAlign: 'center',
        fontFamily: YR_MONO, fontSize: 11, color: t.ink3,
        fontVariantNumeric: 'tabular-nums', letterSpacing: '0.04em',
      }}>
        Recap generated May 18, 2026  ·  Data through December 31, 2025
      </div>
    </section>
  );
}

// ---------------- fixtures ----------------

const YR_TOP_GAMES = [
  { title: "Baldur's Gate 3",  titleParts: ["Baldur's ", 'Gate', ' 3'], hours: 142.3, ach: 42, tone: '#6b3a2f', art: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1600&h=620&fit=crop' },
  { title: 'Helldivers 2',     hours: 87.6,  ach: 18, tone: '#2a4a6b', art: 'https://images.unsplash.com/photo-1614624532983-4ce03382d63d?w=1600&h=620&fit=crop' },
  { title: 'Elden Ring',       hours: 64.1,  ach: 24, tone: '#5a4828', art: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1600&h=620&fit=crop' },
  { title: 'Counter-Strike 2', hours: 58.4,  ach: 11, tone: '#3a4250', art: 'https://images.unsplash.com/photo-1542751110-97427bbecf20?w=1600&h=620&fit=crop' },
  { title: 'Factorio',         hours: 42.8,  ach: 7,  tone: '#3a3a2a', art: 'https://images.unsplash.com/photo-1518709594023-6eab9bab7b23?w=1600&h=620&fit=crop' },
  { title: 'RimWorld',         hours: 38.1,  ach: 8,  tone: '#4a3a2a', art: 'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?w=1600&h=620&fit=crop' },
  { title: 'Stardew Valley',   hours: 27.6,  ach: 5,  tone: '#3b5a3b', art: 'https://images.unsplash.com/photo-1500964757637-c85e8a162699?w=1600&h=620&fit=crop' },
  { title: 'Hades',            hours: 22.4,  ach: 49, tone: '#5e2a3a', art: 'https://images.unsplash.com/photo-1551103782-8ab07afd45c1?w=1600&h=620&fit=crop' },
  { title: 'Disco Elysium',    hours: 18.4,  ach: 22, tone: '#3a4a4a', art: 'https://images.unsplash.com/photo-1518709766631-a6a7f45921c3?w=1600&h=620&fit=crop' },
  { title: 'Cyberpunk 2077',   hours: 12.1,  ach: 4,  tone: '#4a4828', art: 'https://images.unsplash.com/photo-1542736667-069246bdbc6d?w=1600&h=620&fit=crop' },
];

const YR_TOP_GAMES_EARLY = [
  { title: 'Stardew Valley', hours: 28.4, ach: 5, tone: '#3b5a3b', art: 'https://images.unsplash.com/photo-1500964757637-c85e8a162699?w=1600&h=620&fit=crop' },
  { title: 'Hades',          hours: 10.0, ach: 7, tone: '#5e2a3a', art: 'https://images.unsplash.com/photo-1551103782-8ab07afd45c1?w=1600&h=620&fit=crop' },
  { title: 'Celeste',        hours: 0.0,  ach: 0, tone: '#3a2e4a', art: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1600&h=620&fit=crop' },
];

const YR_SHELF_POP = [
  { title: 'Balatro',                tone: '#3a2e22', art: 'https://images.unsplash.com/photo-1500964757637-c85e8a162699?w=600&h=300&fit=crop',  added: 'Feb 22',  status: 'played',    statusLabel: 'Played 47.6 h' },
  { title: 'Pacific Drive',          tone: '#2a3a4a', art: 'https://images.unsplash.com/photo-1542736667-069246bdbc6d?w=600&h=300&fit=crop', added: 'Apr 14',  status: 'played',    statusLabel: 'Played 18.4 h' },
  { title: 'Helldivers 2',           tone: '#2a4a6b', art: 'https://images.unsplash.com/photo-1614624532983-4ce03382d63d?w=600&h=300&fit=crop',  added: 'Feb 09',  status: 'played',    statusLabel: 'Played 87.6 h' },
  { title: 'Animal Well',            tone: '#2a3a2a', art: 'https://images.unsplash.com/photo-1551103782-8ab07afd45c1?w=600&h=300&fit=crop',  added: 'May 12',  status: 'finished',  statusLabel: 'Finished Aug 12' },
  { title: 'FF VII Rebirth',         tone: '#3a3a52', art: 'https://images.unsplash.com/photo-1518709766631-a6a7f45921c3?w=600&h=300&fit=crop', added: 'Jul 03',  status: 'played',    statusLabel: 'Played 64.2 h' },
  { title: "Dragon's Dogma 2",       tone: '#4a2e2a', art: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&h=300&fit=crop', added: 'Mar 22',  status: 'untouched', statusLabel: 'Untouched' },
  { title: 'Tactical Breach Wizards',tone: '#3a3a4a', art: 'https://images.unsplash.com/photo-1518709594023-6eab9bab7b23?w=600&h=300&fit=crop', added: 'Aug 27',  status: 'finished',  statusLabel: 'Finished Oct 03' },
  { title: 'Indika',                 tone: '#3a2a3a', art: 'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?w=600&h=300&fit=crop', added: 'May 03',  status: 'untouched', statusLabel: 'Untouched' },
];

const YR_SHELF_EARLY = [
  { title: 'Stardew Valley', tone: '#3b5a3b', art: 'https://images.unsplash.com/photo-1500964757637-c85e8a162699?w=600&h=300&fit=crop', added: 'Oct 12', status: 'played',    statusLabel: 'Played 28.4 h' },
  { title: 'Hades',          tone: '#5e2a3a', art: 'https://images.unsplash.com/photo-1551103782-8ab07afd45c1?w=600&h=300&fit=crop', added: 'Oct 14', status: 'played',    statusLabel: 'Played 10.0 h' },
  { title: 'Cocoon',         tone: '#3a4a52', art: 'https://images.unsplash.com/photo-1542736667-069246bdbc6d?w=600&h=300&fit=crop',added: 'Nov 02', status: 'played',    statusLabel: 'Played 0.1 h' },
  { title: 'Celeste',        tone: '#3a2e4a', art: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&h=300&fit=crop',added: 'Nov 20', status: 'untouched', statusLabel: 'Untouched' },
];

// ---------------- top-level frames ----------------

const YR_AMBIENT_POP = [
  { art: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=920&h=430&fit=crop',  top: -60,  left: -120, w: 700, h: 400, rot: -8 },
  { art: 'https://images.unsplash.com/photo-1614624532983-4ce03382d63d?w=920&h=430&fit=crop', top: 80,   left: 900,  w: 700, h: 400, rot: 6 },
  { art: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=920&h=430&fit=crop', top: 400,  left: 200,  w: 600, h: 360, rot: -3 },
  { art: 'https://images.unsplash.com/photo-1551103782-8ab07afd45c1?w=920&h=430&fit=crop',  top: 360,  left: 980,  w: 500, h: 340, rot: 10 },
];

const YR_AMBIENT_EARLY = [
  { art: 'https://images.unsplash.com/photo-1500964757637-c85e8a162699?w=920&h=430&fit=crop', top: 40,  left: 80,  w: 700, h: 400, rot: -6 },
  { art: 'https://images.unsplash.com/photo-1551103782-8ab07afd45c1?w=920&h=430&fit=crop',   top: 240, left: 880, w: 540, h: 360, rot: 4 },
];

function YearInReviewPopulated({ theme = 'dark' }) {
  const t = YRTokens(theme);
  const total = 6000;
  return (
    <div data-screen-label={`Year in Review · populated · ${theme}`} style={{
      width: 1440, minHeight: total, background: t.bgGrad, color: t.ink,
      fontFamily: YR_SANS, fontSize: 14, position: 'relative', overflow: 'hidden',
    }}>
      <YRAppBar t={t} />
      <div style={{ display: 'flex' }}>
        <YRSidebar t={t} minH={total - 56 - 40} />
        <main style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          <YRCover t={t} theme={theme} mode="populated" ambientArts={YR_AMBIENT_POP} />
          {/* main content column */}
          <div style={{ maxWidth: 1040, margin: '0 auto', padding: '0 40px 60px' }}>
            <YRPlaytimeSection t={t} theme={theme} mode="populated" />
            <YRTopGamesSection t={t} theme={theme} mode="populated" />
            <YRAchievementsSection t={t} theme={theme} mode="populated" />
            <YRGenreSection t={t} theme={theme} mode="populated" />
            <YRShelfSection t={t} theme={theme} mode="populated" />
            <YROutro t={t} theme={theme} mode="populated" />
          </div>
        </main>
      </div>
      <YRSpecStrip t={t} extras="populated · 2025 · 612.8 h" contentWidth={1040} heroPx={460} totalPx={total} />
    </div>
  );
}

function YearInReviewEarly({ theme = 'dark' }) {
  const t = YRTokens(theme);
  const total = 5140;
  return (
    <div data-screen-label={`Year in Review · early · ${theme}`} style={{
      width: 1440, minHeight: total, background: t.bgGrad, color: t.ink,
      fontFamily: YR_SANS, fontSize: 14, position: 'relative', overflow: 'hidden',
    }}>
      <YRAppBar t={t} />
      <div style={{ display: 'flex' }}>
        <YRSidebar t={t} minH={total - 56 - 40} />
        <main style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          <YRCover t={t} theme={theme} mode="early" ambientArts={YR_AMBIENT_EARLY} />
          <div style={{ maxWidth: 1040, margin: '0 auto', padding: '0 40px 60px' }}>
            <YRPlaytimeSection t={t} theme={theme} mode="early" />
            <YRTopGamesSection t={t} theme={theme} mode="early" />
            <YRAchievementsSection t={t} theme={theme} mode="early" />
            <YRGenreSection t={t} theme={theme} mode="early" />
            <YRShelfSection t={t} theme={theme} mode="early" />
            <YROutro t={t} theme={theme} mode="early" />
          </div>
        </main>
      </div>
      <YRSpecStrip t={t} extras="early-data · joined Oct 12 · 38.4 h" contentWidth={1040} heroPx={460} totalPx={total} />
    </div>
  );
}

Object.assign(window, {
  YRGenreSection, YRShelfSection, YROutro,
  YearInReviewPopulated, YearInReviewEarly,
});
